import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ enabled: true, blocked: false, claim: "claimed", match: { decision: "unknown", answer: "" }, rate: true, member: true, updates: [] as unknown[], rpc: vi.fn(), from: vi.fn() }));
vi.mock("../src/lib/db", () => ({
  dbError: (error: unknown) => { if (error) throw new Error("db failed"); },
  database: () => ({ from: state.from, rpc: state.rpc })
}));
vi.mock("../src/lib/line", async importOriginal => ({ ...await importOriginal<typeof import("../src/lib/line")>(), lineRequest: vi.fn(), ownerInGroup: vi.fn() }));
import { processEvent } from "../src/lib/bot";
import { lineRequest, ownerInGroup, LineError } from "../src/lib/line";
const destination = `U${"a".repeat(32)}`;
const owner = `U${"b".repeat(32)}`;
const base = { type: "message", webhookEventId: "evt", timestamp: Date.now(), replyToken: "reply", source: { type: "group", groupId: `C${"c".repeat(32)}`, userId: `U${"d".repeat(32)}` } };
const event = (q: string) => ({ ...base, message: { type: "text", id: "1", text: `@PP ${q}`, mention: { mentionees: [{ index: 0, length: 3, type: "user", isSelf: true }] } } });
describe("bot orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks(); state.enabled = true; state.blocked = false; state.claim = "claimed"; state.match = { decision: "unknown", answer: "" }; state.rate = true; state.updates = [];
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "test-token";
    vi.mocked(ownerInGroup).mockResolvedValue(true); vi.mocked(lineRequest).mockResolvedValue();
    state.from.mockImplementation((table: string) => {
      if (table === "memories") throw new Error("Bot must never query raw memories");
      const data = table === "owner" ? { display_name: "ปีโป้", line_user_id: owner } : table === "permissions" ? { enabled: state.enabled, allow_owner_mention: true } : { blocked: state.blocked };
      const query = { then: (resolve: (v: unknown) => void) => resolve({ data, error: null }), select: () => query, eq: () => query, single: () => query, upsert: () => query, update: (v: unknown) => { state.updates.push(v); return query; } };
      return query;
    });
    state.rpc.mockImplementation(async (name: string) => ({ error: null, data: name === "pp_claim_event" ? state.claim : name === "pp_answer" ? state.match : state.rate }));
  });
  it("ignores ordinary group messages and direct messages", async () => {
    await processEvent({ ...event("hello"), message: { type: "text", id: "1", text: "hello" } }, destination);
    await processEvent({ ...event("hello"), source: { type: "user", userId: owner } }, destination);
    expect(state.from).not.toHaveBeenCalled(); expect(lineRequest).not.toHaveBeenCalled();
  });
  it("requires group approval", async () => { state.enabled = false; await processEvent(event("อาหาร"), destination); expect(lineRequest).not.toHaveBeenCalled(); });
  it("respects blocked friends", async () => { state.blocked = true; await processEvent(event("อาหาร"), destination); expect(lineRequest).not.toHaveBeenCalled(); });
  it("does not send a duplicate completed reply", async () => { state.claim = "done"; await processEvent(event("อาหาร"), destination); expect(lineRequest).not.toHaveBeenCalled(); });
  it("propagates busy claim for retry", async () => { state.claim = "busy"; await expect(processEvent(event("อาหาร"), destination)).rejects.toThrow(); expect(lineRequest).not.toHaveBeenCalled(); });
  it("private questions never load content or ping owner", async () => { await processEvent(event("ปีโป้เงินเดือนเท่าไหร่"), destination); expect(state.rpc.mock.calls.some(call => call[0] === "pp_answer")).toBe(false); expect(ownerInGroup).not.toHaveBeenCalled(); expect(JSON.stringify(vi.mocked(lineRequest).mock.calls)).toContain("เรื่องนี้ขอไม่ตอบ"); });
  it("answers approved facts without raw memory access", async () => { state.match = { decision: "answer", answer: "ชอบอาหารไทย" }; await processEvent(event("ปีโป้ชอบกินอะไร"), destination); expect(lineRequest).toHaveBeenCalledWith("message/reply", "test-token", { replyToken: "reply", messages: [{ type: "text", text: "ชอบอาหารไทย" }] }); });
  it("hands an invitation to a verified group member using a real mention", async () => { await processEvent(event("ปีโป้พรุ่งนี้ว่างไหม"), destination); expect(ownerInGroup).toHaveBeenCalled(); expect(JSON.stringify(vi.mocked(lineRequest).mock.calls)).toContain('"type":"textV2"'); });
  it("does not mention owner outside the group", async () => { vi.mocked(ownerInGroup).mockResolvedValue(false); await processEvent(event("ปีโป้ว่างไหม"), destination); expect(JSON.stringify(vi.mocked(lineRequest).mock.calls)).not.toContain("textV2"); });
  it("records failed delivery and permits LINE retry", async () => { vi.mocked(lineRequest).mockRejectedValue(new LineError(503)); await expect(processEvent(event("อาหาร"), destination)).rejects.toThrow(); expect(state.updates).toContainEqual(expect.objectContaining({ status: "failed" })); });
  it("does not turn expired reply tokens into unsolicited pushes", async () => { vi.mocked(lineRequest).mockRejectedValue(new LineError(400)); await processEvent(event("อาหาร"), destination); expect(state.updates).toContainEqual(expect.objectContaining({ status: "expired" })); expect(lineRequest).toHaveBeenCalledTimes(1); });
});
