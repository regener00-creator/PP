import { assistantReply } from "../src/lib/assistant";
vi.mock("../src/lib/assistant", () => ({
  assistantReply: vi.fn().mockResolvedValue(null),
}));
import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  fallback: "ยังไม่มีข้อมูลเรื่องนี้",
  enabled: true,
  allowMention: true,
  blocked: false,
  claim: "claimed",
  match: { decision: "unknown", answer: "" } as {
    decision: string;
    answer: string;
    mention_owner?: boolean;
  },
  rate: true,
  member: true,
  updates: [] as unknown[],
  rpc: vi.fn(),
  from: vi.fn(),
}));
vi.mock("../src/lib/db", () => ({
  dbError: (error: unknown) => {
    if (error) throw new Error("db failed");
  },
  database: () => ({ from: state.from, rpc: state.rpc }),
}));
vi.mock("../src/lib/line", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/line")>()),
  lineRequest: vi.fn(),
  ownerInGroup: vi.fn(),
}));
vi.mock("../src/lib/semantic", () => ({ semanticMatch: vi.fn() }));
import { semanticMatch } from "../src/lib/semantic";
import { processEvent } from "../src/lib/bot";
import { lineRequest, ownerInGroup, LineError } from "../src/lib/line";
const destination = `U${"a".repeat(32)}`;
const owner = `U${"b".repeat(32)}`;
const base = {
  type: "message",
  webhookEventId: "evt",
  timestamp: Date.now(),
  replyToken: "reply",
  source: {
    type: "group",
    groupId: `C${"c".repeat(32)}`,
    userId: `U${"d".repeat(32)}`,
  },
};
const event = (q: string) => ({
  ...base,
  message: {
    type: "text",
    id: "1",
    text: `@PP ${q}`,
    mention: {
      mentionees: [{ index: 0, length: 3, type: "user", isSelf: true }],
    },
  },
});
describe("bot orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assistantReply).mockResolvedValue({ text: "" });
    state.enabled = true;
    state.allowMention = true;
    state.blocked = false;
    state.claim = "claimed";
    state.match = { decision: "unknown", answer: "" };
    state.rate = true;
    state.updates = [];
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "test-token";
    state.fallback = "ยังไม่มีข้อมูลเรื่องนี้";
    vi.mocked(semanticMatch).mockResolvedValue({ decision: "unknown" });
    vi.mocked(ownerInGroup).mockResolvedValue(true);
    vi.mocked(lineRequest).mockResolvedValue();
    state.from.mockImplementation((table: string) => {
      if (table === "memories")
        throw new Error("Bot must never query raw memories");
      const data =
        table === "owner"
          ? {
              display_name: "ปีโป้",
              line_user_id: owner,
              unknown_replies: [state.fallback, "ข้อความสำรอง"],
            }
          : table === "permissions"
            ? {
                enabled: state.enabled,
                allow_owner_mention: state.allowMention,
              }
            : { blocked: state.blocked };
      const query = {
        then: (resolve: (v: unknown) => void) => resolve({ data, error: null }),
        select: () => query,
        eq: () => query,
        single: () => query,
        upsert: () => query,
        update: (v: unknown) => {
          state.updates.push(v);
          return query;
        },
      };
      return query;
    });
    state.rpc.mockImplementation(async (name: string) => ({
      error: null,
      data:
        name === "pp_claim_event"
          ? state.claim
          : name === "pp_answer"
            ? state.match
            : state.rate,
    }));
  });
  it("ignores ordinary group messages and unsupported rooms", async () => {
    await processEvent(
      { ...event("hello"), message: { type: "text", id: "1", text: "hello" } },
      destination,
    );
    await processEvent(
      {
        ...event("hello"),
        source: { type: "room", roomId: "room", userId: owner },
      },
      destination,
    );
    expect(state.from).not.toHaveBeenCalled();
    expect(lineRequest).not.toHaveBeenCalled();
  });
  it("requires group approval", async () => {
    state.enabled = false;
    await processEvent(event("อาหาร"), destination);
    expect(lineRequest).not.toHaveBeenCalled();
  });
  it("uses the saved unknown reply only for unknown questions and observes subsequent edits", async () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      state.fallback = "ยังไม่ทราบครับ\nลองถามเรื่องอื่นได้เลย";
      await processEvent(event("ชอบชาอะไร"), destination);
      expect(lineRequest).toHaveBeenLastCalledWith(
        "message/reply",
        "test-token",
        {
          replyToken: "reply",
          messages: [{ type: "text", text: state.fallback }],
        },
      );
      state.fallback = "ไม่มีข้อมูลนี้ครับ";
      await processEvent(event("ชอบชาอะไร"), destination);
      expect(lineRequest).toHaveBeenLastCalledWith(
        "message/reply",
        "test-token",
        {
          replyToken: "reply",
          messages: [{ type: "text", text: state.fallback }],
        },
      );
      state.match = { decision: "refuse", answer: "" };
      await processEvent(event("ขอรหัสผ่าน"), destination);
      expect(vi.mocked(lineRequest).mock.lastCall?.[2]).toEqual(
        expect.objectContaining({
          messages: [
            {
              type: "text",
              text: expect.stringContaining("เรื่องนี้ขอไม่ตอบ"),
            },
          ],
        }),
      );
      state.match = { decision: "unknown", answer: "" };
      random.mockReturnValue(0.99);
      await processEvent(event("ชอบชาอะไร"), destination);
      expect(lineRequest).toHaveBeenLastCalledWith(
        "message/reply",
        "test-token",
        {
          replyToken: "reply",
          messages: [{ type: "text", text: "ข้อความสำรอง" }],
        },
      );
    } finally {
      random.mockRestore();
    }
  });
  it("replies to the renamed typed trigger with the approved memory answer", async () => {
    vi.stubEnv("ALLOW_TEXT_TRIGGER", "true");
    try {
      state.match = { decision: "answer", answer: "อาหารไทย" };
      await processEvent(
        {
          ...base,
          message: { type: "text", id: "1", text: "@น้องโจอา ปีโป้ชอบกินอะไร" },
        },
        destination,
      );
      expect(state.rpc).toHaveBeenCalledWith(
        "pp_answer",
        expect.objectContaining({ p_question: "ปีโป้ชอบกินอะไร" }),
      );
      expect(lineRequest).toHaveBeenCalledWith("message/reply", "test-token", {
        replyToken: "reply",
        messages: [{ type: "text", text: "อาหารไทย" }],
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it("respects blocked friends", async () => {
    state.blocked = true;
    await processEvent(event("อาหาร"), destination);
    expect(lineRequest).not.toHaveBeenCalled();
  });
  it("does not send a duplicate completed reply", async () => {
    state.claim = "done";
    await processEvent(event("อาหาร"), destination);
    expect(lineRequest).not.toHaveBeenCalled();
  });
  it("propagates busy claim for retry", async () => {
    state.claim = "busy";
    await expect(processEvent(event("อาหาร"), destination)).rejects.toThrow();
    expect(lineRequest).not.toHaveBeenCalled();
  });
  it("legacy private refusals never reach AI or ping the owner", async () => {
    state.match = { decision: "refuse", answer: "" };
    await processEvent(event("ปีโป้เงินเดือนเท่าไหร่"), destination);
    expect(state.rpc.mock.calls.some((call) => call[0] === "pp_answer")).toBe(
      true,
    );
    expect(semanticMatch).not.toHaveBeenCalled();
    expect(ownerInGroup).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(lineRequest).mock.calls)).toContain(
      "เรื่องนี้ขอไม่ตอบ",
    );
  });
  it("answers approved product-code questions without a keyword veto or AI call", async () => {
    state.match = { decision: "answer", answer: "รหัสสินค้า JOAH-01" };
    await processEvent(event("ขอรหัสสินค้า"), destination);
    expect(lineRequest).toHaveBeenCalledWith("message/reply", "test-token", {
      replyToken: "reply",
      messages: [{ type: "text", text: "รหัสสินค้า JOAH-01" }],
    });
    expect(semanticMatch).not.toHaveBeenCalled();
  });
  it("answers approved facts without raw memory access", async () => {
    state.match = { decision: "answer", answer: "ชอบอาหารไทย" };
    await processEvent(event("ปีโป้ชอบกินอะไร"), destination);
    expect(lineRequest).toHaveBeenCalledWith("message/reply", "test-token", {
      replyToken: "reply",
      messages: [{ type: "text", text: "ชอบอาหารไทย" }],
    });
  });
  it("adds a real owner mention to a memory answer explicitly configured by the admin", async () => {
    state.match = { decision: "answer", answer: "มาตอบ", mention_owner: true };
    await processEvent(
      { ...event("ทดสอบ"), source: { ...base.source, userId: owner } },
      destination,
    );
    expect(lineRequest).toHaveBeenCalledWith("message/reply", "test-token", {
      replyToken: "reply",
      messages: [
        {
          type: "textV2",
          text: "มาตอบ\n{owner}",
          substitution: {
            owner: {
              type: "mention",
              mentionee: { type: "user", userId: owner },
            },
          },
        },
      ],
    });
  });
  it("keeps a configured memory answer when group mention permission is off", async () => {
    state.allowMention = false;
    state.match = { decision: "answer", answer: "มาตอบ", mention_owner: true };
    await processEvent(event("ทดสอบ"), destination);
    expect(ownerInGroup).not.toHaveBeenCalled();
    expect(lineRequest).toHaveBeenCalledWith("message/reply", "test-token", {
      replyToken: "reply",
      messages: [{ type: "text", text: "มาตอบ" }],
    });
  });
  it("never lets a memory mention flag bypass a database refusal or an empty answer", async () => {
    state.match = { decision: "refuse", answer: "", mention_owner: true };
    await processEvent(event("ทดสอบ"), destination);
    state.match = { decision: "answer", answer: "", mention_owner: true };
    await processEvent(event("ทดสอบ"), destination);
    expect(ownerInGroup).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(lineRequest).mock.calls)).not.toContain(
      "textV2",
    );
  });
  it("retains a memory answer without mention during the shared cooldown", async () => {
    state.match = { decision: "answer", answer: "มาตอบ", mention_owner: true };
    state.rpc.mockImplementation(
      async (name: string, params: { p_key?: string }) => ({
        error: null,
        data:
          name === "pp_claim_event"
            ? state.claim
            : name === "pp_answer"
              ? state.match
              : params.p_key?.startsWith("mention:")
                ? false
                : true,
      }),
    );
    await processEvent(event("ทดสอบ"), destination);
    expect(lineRequest).toHaveBeenCalledWith("message/reply", "test-token", {
      replyToken: "reply",
      messages: [{ type: "text", text: "มาตอบ" }],
    });
  });
  it("only calls AI for an unknown question after database permission checks", async () => {
    state.match = { decision: "answer", answer: "อาหารไทย" };
    await processEvent(event("ปีโป้ชอบกินอะไร"), destination);
    state.match = { decision: "refuse", answer: "" };
    await processEvent(event("อาหาร"), destination);
    await processEvent(event("เงินเดือน"), destination);
    expect(semanticMatch).not.toHaveBeenCalled();
  });
  it("replies with the stored semantic answer for a paraphrase", async () => {
    vi.mocked(semanticMatch).mockResolvedValue({
      decision: "answer",
      answer: "คำตอบที่อนุมัติ",
    });
    await processEvent(event("ปปชอบกินอะไร"), destination);
    expect(semanticMatch).toHaveBeenCalledWith(
      "ปปชอบกินอะไร",
      base.source.groupId,
      base.source.userId,
      "ปีโป้",
    );
    expect(JSON.stringify(vi.mocked(lineRequest).mock.calls)).toContain(
      "คำตอบที่อนุมัติ",
    );
  });
  it("hands an invitation to a verified group member using a real mention", async () => {
    await processEvent(event("ปีโป้พรุ่งนี้ว่างไหม"), destination);
    expect(ownerInGroup).toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(lineRequest).mock.calls)).toContain(
      '"type":"textV2"',
    );
  });
  it("mentions the owner for home presence after the privacy check, without calling AI", async () => {
    await processEvent(event("วันนี้อยู่บ้านไหม"), destination);
    expect(ownerInGroup).toHaveBeenCalled();
    expect(state.rpc.mock.calls.some((call) => call[0] === "pp_answer")).toBe(
      true,
    );
    expect(semanticMatch).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(lineRequest).mock.calls)).toContain(
      '"type":"textV2"',
    );
  });
  it("does not mention owner outside the group", async () => {
    vi.mocked(ownerInGroup).mockResolvedValue(false);
    await processEvent(event("ปีโป้ว่างไหม"), destination);
    expect(JSON.stringify(vi.mocked(lineRequest).mock.calls)).not.toContain(
      "textV2",
    );
  });
  it("uses a real owner mention when the owner asks the home question themselves", async () => {
    await processEvent(
      {
        ...event("วันนี้อยู่บ้านไหม"),
        source: { ...base.source, userId: owner },
      },
      destination,
    );
    expect(ownerInGroup).toHaveBeenCalledWith(
      base.source.groupId,
      owner,
      "test-token",
    );
    expect(lineRequest).toHaveBeenCalledWith("message/reply", "test-token", {
      replyToken: "reply",
      messages: [
        {
          type: "textV2",
          text: "อันนี้ให้เจ้าตัวตอบดีกว่า 😄\n{owner} มาช่วยตอบเพื่อนหน่อย",
          substitution: {
            owner: {
              type: "mention",
              mentionee: { type: "user", userId: owner },
            },
          },
        },
      ],
    });
    expect(semanticMatch).not.toHaveBeenCalled();
  });
  it("still applies the mention cooldown when the owner tests a handoff", async () => {
    state.rpc.mockImplementation(
      async (name: string, params: { p_key?: string }) => ({
        error: null,
        data:
          name === "pp_claim_event"
            ? state.claim
            : name === "pp_answer"
              ? state.match
              : params.p_key?.startsWith("mention:")
                ? false
                : true,
      }),
    );
    await processEvent(
      {
        ...event("วันนี้อยู่บ้านไหม"),
        source: { ...base.source, userId: owner },
      },
      destination,
    );
    expect(lineRequest).toHaveBeenCalledWith("message/reply", "test-token", {
      replyToken: "reply",
      messages: [{ type: "text", text: "อันนี้ให้เจ้าตัวตอบดีกว่า 😄" }],
    });
  });
  it("never mentions the bot account even when it is configured as owner", async () => {
    await processEvent(event("วันนี้อยู่บ้านไหม"), owner);
    expect(ownerInGroup).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(lineRequest).mock.calls)).not.toContain(
      "textV2",
    );
  });
  it("records failed delivery and permits LINE retry", async () => {
    vi.mocked(lineRequest).mockRejectedValue(new LineError(503));
    await expect(processEvent(event("อาหาร"), destination)).rejects.toThrow();
    expect(state.updates).toContainEqual(
      expect.objectContaining({ status: "failed" }),
    );
  });
  it("does not turn expired reply tokens into unsolicited pushes", async () => {
    vi.mocked(lineRequest).mockRejectedValue(new LineError(400));
    await processEvent(event("อาหาร"), destination);
    expect(state.updates).toContainEqual(
      expect.objectContaining({ status: "expired" }),
    );
    expect(lineRequest).toHaveBeenCalledTimes(1);
  });
  it("unknown questions continue to conversational assistant in the current group", async () => {
    vi.mocked(assistantReply).mockResolvedValue({ text: "คุยกันได้เลยครับ" });
    await processEvent(event("สวัสดี"), destination);
    expect(assistantReply).toHaveBeenCalledWith(
      "สวัสดี",
      { sender: base.source.userId, group: base.source.groupId },
      "evt",
    );
    expect(lineRequest).toHaveBeenCalledWith(
      "message/reply",
      "test-token",
      expect.objectContaining({
        messages: [{ type: "text", text: "คุยกันได้เลยครับ" }],
      }),
    );
  });
  it("explicit notebook commands bypass legacy lookup without bypassing group approval", async () => {
    vi.mocked(assistantReply).mockResolvedValue({
      text: "ตรวจสรุปก่อนยืนยันครับ",
    });
    await processEvent(event("จำว่า เพื่อนชอบชา"), destination);
    expect(semanticMatch).not.toHaveBeenCalled();
    expect(state.rpc.mock.calls.some((c) => c[0] === "pp_answer")).toBe(false);
    expect(assistantReply).toHaveBeenCalledOnce();
    vi.mocked(assistantReply).mockClear();
    state.enabled = false;
    await processEvent(event("จำว่า เพื่อนชอบชา"), destination);
    expect(assistantReply).not.toHaveBeenCalled();
  });
  it("refused legacy-private facts never enter general conversation", async () => {
    state.match = { decision: "refuse", answer: "" };
    await processEvent(event("ปีโป้เงินเดือนเท่าไร"), destination);
    expect(assistantReply).not.toHaveBeenCalled();
  });
});
