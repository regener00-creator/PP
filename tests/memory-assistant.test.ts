import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ rpc: vi.fn(), generate: vi.fn(), admin: vi.fn(), vertex: vi.fn() }));
vi.mock("../src/lib/auth", () => ({ requireAdmin: state.admin }));
vi.mock("../src/lib/db", () => ({ database: () => ({ rpc: state.rpc }), dbError: (e: unknown) => { if (e) throw Error("DB failed"); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("ai", () => ({ generateText: state.generate, Output: { object: (x: unknown) => x } }));
vi.mock("@ai-sdk/google-vertex", () => ({ createVertex: state.vertex }));
import { payloadDigest, signReview, readReview, reviewMemoryCollection } from "../src/lib/memory-assistant";
import { saveAssistedMemory, auditMemories, dismissMemoryIssue } from "../src/app/admin/memory-assistant-actions";
const memory = { id: "550e8400-e29b-41d4-a716-446655440000", title: "น้ำท่วม", content: "น้ำลดแล้ว", question_examples: [], revision: "a".repeat(32), mention_owner: false, attachment_ids: [], expires_at: null };
const catalog = { revision: "b".repeat(32), memories: [memory] };
const empty = { ok: false, message: "" };
function form() { const f = new FormData(); f.set("title", "น้ำท่วม"); f.set("content", "น้ำแห้งแล้ว"); return f; }
describe("assisted memory saving", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.stubEnv("CRON_SECRET", "test-signature-key"); vi.stubEnv("AI_ENABLED", "true"); vi.stubEnv("GOOGLE_VERTEX_API_KEY", "test-key");
    state.admin.mockResolvedValue(undefined); state.vertex.mockReturnValue(() => "model");
    state.generate.mockResolvedValue({ output: { pairs: [] } });
    state.rpc.mockImplementation(async (name: string) => ({ error: null, data: name === "pp_memory_catalog" ? catalog : name === "pp_save_assisted_memory" ? { decision: "saved", id: memory.id } : true }));
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
  it("saves title and content without examples after checking all existing contents", async () => {
    expect((await saveAssistedMemory(empty, form())).ok).toBe(true);
    expect(state.generate.mock.calls[0][0].prompt).toContain("น้ำลดแล้ว");
    expect(state.rpc).toHaveBeenCalledWith("pp_save_assisted_memory", expect.objectContaining({ p_value: expect.objectContaining({ aliases: [], question_examples: [] }), p_catalog: catalog.revision }));
  });
  it("stops before a write for duplicates, then saves only the confirmed reviewed draft", async () => {
    state.generate.mockResolvedValue({ output: { pairs: [{ left: "draft", right: memory.id, kind: "duplicate", reason: "ข้อมูลเหมือนกัน" }] } });
    const f = form(), review = await saveAssistedMemory(empty, f);
    expect(review.concerns?.[0].kind).toBe("duplicate"); expect(review.receipt).toBeTruthy();
    expect(state.rpc.mock.calls.some(c => c[0] === "pp_save_assisted_memory")).toBe(false);
    f.set("receipt", review.receipt!); f.set("decision", "confirm");
    expect((await saveAssistedMemory(review, f)).ok).toBe(true); expect(state.generate).toHaveBeenCalledTimes(1);
  });
  it("rechecks a changed draft instead of accepting an old confirmation", async () => {
    state.generate.mockResolvedValue({ output: { pairs: [{ left: "draft", right: memory.id, kind: "conflict", reason: "ไม่ตรงกัน" }] } });
    const f = form(), review = await saveAssistedMemory(empty, f); f.set("content", "ยังท่วม"); f.set("receipt", review.receipt!); f.set("decision", "confirm");
    expect((await saveAssistedMemory(review, f)).ok).toBe(false); expect(state.generate).toHaveBeenCalledTimes(2);
  });
  it("fails safely on provider errors, requiring explicit save without AI", async () => {
    state.generate.mockRejectedValue(Error("SECRET_CANARY"));
    const f = form(), review = await saveAssistedMemory(empty, f);
    expect(review.unchecked).toBe(true); expect(JSON.stringify(review)).not.toContain("SECRET_CANARY");
    expect(state.rpc.mock.calls.some(c => c[0] === "pp_save_assisted_memory")).toBe(false);
    f.set("receipt", review.receipt!); f.set("decision", "confirm");
    expect((await saveAssistedMemory(review, f)).ok).toBe(true);
  });
  it("rejects hallucinated ids in a model review", async () => {
    state.generate.mockResolvedValue({ output: { pairs: [{ left: "draft", right: "invented", kind: "duplicate", reason: "bad" }] } });
    await expect(reviewMemoryCollection([memory], memory)).rejects.toThrow("AI ตรวจความจำไม่สำเร็จ");
  });
  it("binds receipts to data and time and rejects tampering", () => {
    const digest = payloadDigest({ content: "one" }); const token = signReview({ digest, catalog: catalog.revision, pairs: [] });
    expect(readReview(token, digest)).toBeTruthy(); expect(readReview(token, payloadDigest({ content: "two" }))).toBeNull();
    expect(readReview(token + "x", digest)).toBeNull();
    vi.useFakeTimers(); vi.setSystemTime(Date.now() + 11 * 60000); expect(readReview(token, digest)).toBeNull();
  });
  it.each([() => saveAssistedMemory(empty, form()), () => auditMemories(), () => dismissMemoryIssue(memory.id)])("requires admin before reading or writing", async action => {
    state.admin.mockRejectedValue(Error("unauthorized")); await expect(action()).rejects.toThrow("unauthorized"); expect(state.rpc).not.toHaveBeenCalled(); expect(state.generate).not.toHaveBeenCalled();
  });
});
