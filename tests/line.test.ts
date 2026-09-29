import { createHmac } from "node:crypto";
import { describe, it, expect } from "vitest";
import { verifySignature, extractQuestion, mentionOwner, type TextEvent } from "../src/lib/line";
const bot = `U${"a".repeat(32)}`;
const owner = `U${"b".repeat(32)}`;
export const event: TextEvent = { type: "message", webhookEventId: "evt-1", timestamp: Date.now(), replyToken: "reply-token", source: { type: "group", groupId: `C${"c".repeat(32)}`, userId: owner }, message: { type: "text", id: "123", text: "@PP ปีโป้ชอบกินอะไร", mention: { mentionees: [{ index: 0, length: 3, type: "user", userId: bot, isSelf: true }] } } };
describe("LINE boundaries", () => {
  it("validates exact raw bytes and rejects tampering", () => {
    const raw = Buffer.from('{"events":[]}'); const signature = createHmac("sha256", "secret").update(raw).digest("base64");
    expect(verifySignature(raw, signature, "secret")).toBe(true);
    expect(verifySignature(Buffer.from('{ "events":[]}'), signature, "secret")).toBe(false);
    expect(verifySignature(raw, null, "secret")).toBe(false);
    expect(verifySignature(raw, "x", "secret")).toBe(false);
  });
  it("responds to real mention and removes only the bot span", () => expect(extractQuestion(event, bot)).toBe("ปีโป้ชอบกินอะไร"));
  it("handles UTF-16 emoji offsets", () => expect(extractQuestion({ ...event, message: { ...event.message, text: "😀 @PP สวัสดี", mention: { mentionees: [{ type: "user", index: 3, length: 3, isSelf: true }] } } }, bot)).toBe("😀  สวัสดี"));
  it("ignores typed @pp by default", () => expect(extractQuestion({ ...event, message: { ...event.message, mention: undefined } }, bot)).toBeNull());
  it("optional typed command requires boundary", () => {
    expect(extractQuestion({ ...event, message: { ...event.message, mention: undefined } }, bot, true)).toBe("ปีโป้ชอบกินอะไร");
    expect(extractQuestion({ ...event, message: { ...event.message, text: "@ppfake hello", mention: undefined } }, bot, true)).toBeNull();
  });
  it("does not trigger for a different account with the same name", () => expect(extractQuestion({ ...event, message: { ...event.message, mention: { mentionees: [{ type: "user", userId: owner, isSelf: false, index: 0, length: 3 }] } } }, bot, true)).toBeNull());
  it("uses a real textV2 user mention", () => expect(mentionOwner(owner)).toMatchObject({ type: "textV2", substitution: { owner: { type: "mention", mentionee: { type: "user", userId: owner } } } }));
});
