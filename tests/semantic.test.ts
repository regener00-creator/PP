import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ rpc: vi.fn(), generate: vi.fn(), vertex: vi.fn() }));
vi.mock("../src/lib/db", () => ({ database: () => ({ rpc: state.rpc }), dbError: (e: unknown) => { if (e) throw Error("DB"); } }));
vi.mock("ai", () => ({ generateText: state.generate, Output: { object: (x: unknown) => x } }));
vi.mock("@ai-sdk/google-vertex", () => ({ createVertex: state.vertex }));
import { semanticMatch, semanticDirectMatch } from "../src/lib/semantic";
const candidate = { id: "550e8400-e29b-41d4-a716-446655440000", revision: "a".repeat(32), questions: ["ปีโป้ชอบรับประทานอะไร"] };
const run = (q = "ปปชอบกินอะไร") => semanticMatch(q, "group", "sender", "ปีโป้");
describe("semantic privacy, cost and failure boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.stubEnv("AI_ENABLED", "true"); vi.stubEnv("GOOGLE_VERTEX_API_KEY", "test-key"); vi.stubEnv("AI_MONTHLY_LIMIT", "1000");
    state.vertex.mockReturnValue(() => "test-model");
    state.generate.mockResolvedValue({ output: { decision: "match", id: candidate.id } });
    state.rpc.mockImplementation(async (name: string) => ({ error: null, data: name === "pp_ai_candidates" ? [candidate] : name === "pp_ai_answer" ? { decision: "answer", answer: "APPROVED_ANSWER" } : true }));
  });
  afterEach(() => vi.unstubAllEnvs());
  it("retains the database mention flag without sending it to the model", async () => {
    state.rpc.mockImplementation(async (name: string) => ({ error: null, data: name === "pp_ai_candidates" ? [candidate] : name === "pp_ai_answer" ? { decision: "answer", answer: "มาตอบ", mention_owner: true } : true }));
    expect(await run()).toEqual({ decision: "answer", answer: "มาตอบ", mention_owner: true });
    expect(state.generate.mock.calls[0][0].prompt).not.toContain("mention_owner");
  });
  it("sends only shareable question examples, not answer/revision/LINE identifiers", async () => {
    expect(await run()).toEqual({ decision: "answer", answer: "APPROVED_ANSWER" });
    const options = state.generate.mock.calls[0][0]; const payload = JSON.parse(options.prompt);
    expect(payload.ownerNames).toContain("ปป"); expect(payload.candidates).toEqual([{ id: candidate.id, questions: candidate.questions }]);
    expect(options.prompt).not.toMatch(/APPROVED_ANSWER|revision|sender|group|test-key/);
    expect(options).toMatchObject({ maxRetries: 0, maxOutputTokens: 512, experimental_telemetry: { isEnabled: false } });
    expect(state.rpc).toHaveBeenCalledWith("pp_ai_answer", expect.objectContaining({ p_id: candidate.id, p_revision: candidate.revision }));
  });
  it("lets owner-approved question examples match without keyword blocking the entire collection", async () => {
    const approved = { ...candidate, questions: ["ขอรหัสสินค้า"] };
    state.rpc.mockImplementation(async (name: string) => ({ error: null, data: name === "pp_ai_candidates" ? [approved] : name === "pp_ai_answer" ? { decision: "answer", answer: "รหัสสินค้า JOAH-01" } : true }));
    expect(await run("รหัสสินค้าคืออะไร")).toEqual({ decision: "answer", answer: "รหัสสินค้า JOAH-01" });
    expect(JSON.parse(state.generate.mock.calls[0][0].prompt).candidates).toEqual([{ id: candidate.id, questions: approved.questions }]);
    expect(state.rpc).toHaveBeenCalledWith("pp_ai_answer", expect.objectContaining({ p_revision: candidate.revision }));
  });
  it("does not call any database or AI when disabled or misconfigured", async () => {
    vi.stubEnv("AI_ENABLED", "false"); await run(); vi.stubEnv("AI_ENABLED", "true"); vi.stubEnv("AI_MONTHLY_LIMIT", "1001"); await run();
    expect(state.rpc).not.toHaveBeenCalled(); expect(state.generate).not.toHaveBeenCalled();
  });
  it("refuses empty candidate sets", async () => {
    state.rpc.mockResolvedValue({ data: [], error: null }); expect(await run()).toEqual({ decision: "unknown" }); expect(state.generate).not.toHaveBeenCalled();
  });
  it("refuses a payload exceeding the UTF-8 budget instead of truncating", async () => {
    state.rpc.mockResolvedValue({ error: null, data: Array(10).fill({ ...candidate, questions: Array(30).fill("ก".repeat(250)), content: "ก".repeat(2000) }) });
    await run(); expect(state.generate).not.toHaveBeenCalled();
  });
  it.each(["pp_take_rate", "pp_reserve_ai"])("does not call the provider when %s denies admission", async denied => {
    state.rpc.mockImplementation(async name => ({ error: null, data: name === "pp_ai_candidates" ? [candidate] : name !== denied }));
    expect(await run()).toEqual({ decision: "unknown" }); expect(state.generate).not.toHaveBeenCalled();
  });
  it.each([{ decision: "match", id: "invented-id" }, { decision: "unknown", id: null }, { answer: "made-up fact" }])("rejects hallucinated or nonmatching output", async output => {
    state.generate.mockResolvedValue({ output }); expect(await run()).toEqual({ decision: "unknown" });
    expect(state.rpc.mock.calls.some(c => c[0] === "pp_ai_answer")).toBe(false);
  });
  it("returns generic refusal for a sensitive model classification", async () => {
    state.generate.mockResolvedValue({ output: { decision: "refuse", id: null } }); expect(await run()).toEqual({ decision: "refuse" });
  });
  it("falls back on provider failure without logging payloads or retrying", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    state.generate.mockRejectedValue(Error("PRIVATE_CANARY key=test-key")); expect(await run()).toEqual({ decision: "unknown" });
    expect(state.generate).toHaveBeenCalledTimes(1); expect(warn).toHaveBeenCalledWith("PP semantic lookup unavailable"); warn.mockRestore();
  });
  it("honors SQL veto if memory permissions changed during generation", async () => {
    state.rpc.mockImplementation(async name => ({ error: null, data: name === "pp_ai_candidates" ? [candidate] : name === "pp_ai_answer" ? { decision: "refuse" } : true }));
    expect(await run()).toEqual({ decision: "refuse" });
  });
  it("routes owner paraphrases through owner-only RPCs with a shared AI budget", async () => {
    const flood = { ...candidate, questions: ["น้ำท่วมลดยัง", "มีน้ำท่วมไหม", "รถเข้าได้ไหม"] };
    state.rpc.mockImplementation(async name => ({ error: null, data: name === "pp_direct_ai_candidates" ? [flood] : name === "pp_direct_ai_answer" ? { decision: "answer", answer: "แห้งแล้วจ้า", memory_id: candidate.id } : true }));
    expect(await semanticDirectMatch("น้ำท่วมป่ะ", "owner-id", "event-id", "lease-id", "ปีโป้")).toEqual({ decision: "answer", answer: "แห้งแล้วจ้า", memory_id: candidate.id });
    expect(state.rpc).toHaveBeenCalledWith("pp_direct_ai_candidates", { p_sender: "owner-id", p_event: "event-id", p_lease: "lease-id" });
    expect(state.rpc).toHaveBeenCalledWith("pp_direct_ai_answer", expect.objectContaining({ p_sender: "owner-id", p_event: "event-id", p_lease: "lease-id", p_id: candidate.id, p_revision: candidate.revision }));
    expect(state.rpc).toHaveBeenCalledWith("pp_take_rate", { p_key: "ai:global", p_limit: 6, p_seconds: 60 });
    expect(state.rpc).toHaveBeenCalledWith("pp_reserve_ai", { p_limit: 1000 });
    expect(state.generate.mock.calls[0][0].prompt).not.toMatch(/owner-id|event-id|lease-id|แห้งแล้วจ้า/);
    expect(state.rpc.mock.calls.some(([name]) => name === "pp_ai_candidates" || name === "pp_ai_answer")).toBe(false);
  });
  it("rejects an unauthorized owner scope before sending anything to the model", async () => {
    state.rpc.mockResolvedValue({ error: null, data: { decision: "denied" } });
    expect(await semanticDirectMatch("น้ำท่วมป่ะ", "owner", "event", "lease", "ปีโป้")).toEqual({ decision: "denied" });
    expect(state.generate).not.toHaveBeenCalled(); expect(state.rpc).toHaveBeenCalledTimes(1);
  });
  it("honors owner revocation after the AI call", async () => {
    state.rpc.mockImplementation(async name => ({ error: null, data: name === "pp_direct_ai_candidates" ? [candidate] : name === "pp_direct_ai_answer" ? { decision: "denied" } : true }));
    expect(await semanticDirectMatch("น้ำท่วมป่ะ", "owner", "event", "lease", "ปีโป้")).toEqual({ decision: "denied" });
  });
  it("reads all 45 full memories including entries with no question examples", async () => {
    const memories = Array.from({ length: 45 }, (_, i) => ({ ...candidate, id: `550e8400-e29b-41d4-a716-${String(i).padStart(12, "0")}`, questions: [], title: `เรื่อง ${i}`, content: `ข้อมูล ${i}` }));
    state.generate.mockResolvedValue({ output: { decision: "match", id: memories[44].id } });
    state.rpc.mockImplementation(async name => ({ error: null, data: name === "pp_ai_candidates" ? memories : name === "pp_ai_answer" ? { decision: "answer", answer: "ข้อมูล 44" } : true }));
    expect(await run()).toEqual({ decision: "answer", answer: "ข้อมูล 44" });
    const payload = JSON.parse(state.generate.mock.calls[0][0].prompt);
    expect(payload.candidates).toHaveLength(45); expect(payload.candidates[44]).toMatchObject({ title: "เรื่อง 44", content: "ข้อมูล 44", questions: [] });
    expect(state.generate.mock.calls[0][0].prompt).not.toContain("revision");
  });
  it("records only validated model conflicts without generating an answer", async () => {
    const second = { ...candidate, id: "550e8400-e29b-41d4-a716-446655440001" };
    state.rpc.mockImplementation(async name => ({ error: null, data: name === "pp_ai_candidates" ? [candidate, second] : name === "pp_ai_answer" ? { decision: "answer", answer: "stored" } : true }));
    state.generate.mockResolvedValue({ output: { decision: "conflict", id: null, conflict_ids: [candidate.id, second.id] } });
    expect(await run()).toEqual({ decision: "conflict" });
    expect(state.rpc).toHaveBeenCalledWith("pp_record_memory_issue", expect.objectContaining({ p_left: candidate.id, p_right: second.id }));
  });
  it("does not record invented conflict ids", async () => {
    state.generate.mockResolvedValue({ output: { decision: "conflict", id: null, conflict_ids: [candidate.id, "invented"] } });
    expect(await run()).toEqual({ decision: "unknown" });
    expect(state.rpc.mock.calls.some(c => c[0] === "pp_record_memory_issue")).toBe(false);
  });
});
