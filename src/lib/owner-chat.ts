import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { database, dbError } from "./db";
import { required } from "./env";
import {
  extractQuestion,
  LineError,
  lineRequest,
  type OwnerTextEvent,
} from "./line";
import { normalizeQuestion, unknownReply, CONFLICT } from "./policy";
import { memoryFiles } from "./library";
import { semanticDirectMatch } from "./semantic";
import { assistantReply } from "./assistant";
import { writeIntent } from "./assistant-types";

const directAnswer = z.object({
  decision: z.enum([
    "answer",
    "unknown",
    "ambiguous",
    "refuse",
    "denied",
    "conflict",
  ]),
  answer: z.string().min(1).max(2000).optional(),
  memory_id: z.uuid().optional(),
});

// Called only for a signed webhook whose source is a one-to-one user chat.
// Exact legacy-private answers stay local; AI reads approved shareable memories.
export async function processDirectMessage(
  event: OwnerTextEvent,
  destination: string,
) {
  const db = database();
  const sender = event.source.userId;
  const owner = await db
    .from("owner")
    .select("display_name,line_user_id,unknown_replies")
    .eq("id", 1)
    .single();
  dbError(owner.error);
  if (sender === destination) return;
  const question = (
    extractQuestion(event, destination, true) ?? event.message.text
  ).trim();
  if (!question) return;
  const lease = randomUUID();
  const claim = await db.rpc("pp_claim_direct_event", {
    p_event: event.webhookEventId,
    p_sender: sender,
    p_message: event.message.id,
    p_lease: lease,
  });
  dbError(claim.error);
  if (claim.data === "done" || claim.data === "denied") return;
  if (claim.data !== "claimed") throw new Error("Event is busy; retry later");
  async function finish(status: string, decision: string) {
    const result = await db
      .from("conversations")
      .update({ status, decision, lease_until: null })
      .eq("event_id", event.webhookEventId)
      .eq("lease_id", lease);
    dbError(result.error);
  }
  try {
    const rate = await db.rpc("pp_take_rate", {
      p_key: `direct:${sender}`,
      p_limit: 8,
      p_seconds: 60,
    });
    dbError(rate.error);
    if (!rate.data) {
      await finish("ignored", "rate_limit");
      return;
    }
    if (
      writeIntent(question) ||
      /^(ยืนยัน|ยกเลิก|คำสั่ง|help)$/.test(question.trim())
    ) {
      const allowed = await db.rpc("pp_direct_allowed", {
        p_sender: sender,
        p_event: event.webhookEventId,
        p_lease: lease,
      });
      dbError(allowed.error);
      if (!allowed.data) {
        await finish("ignored", "direct_denied");
        return;
      }
      const reply = await assistantReply(
        question,
        { sender, group: null },
        event.webhookEventId,
      );
      await lineRequest(
        "message/reply",
        required("LINE_CHANNEL_ACCESS_TOKEN"),
        {
          replyToken: event.replyToken,
          messages: [{ type: "text", text: reply.text }],
        },
      );
      await finish("replied", "assistant");
      return;
    }
    const result = await db.rpc("pp_direct_answer", {
      p_question: normalizeQuestion(question),
      p_sender: sender,
      p_event: event.webhookEventId,
      p_lease: lease,
    });
    dbError(result.error);
    let match = directAnswer.parse(result.data);
    if (match.decision === "unknown") {
      match = directAnswer.parse(
        await semanticDirectMatch(
          question,
          sender,
          event.webhookEventId,
          lease,
          owner.data?.display_name || "ปีโป้",
        ),
      );
    }
    if (match.decision === "denied") {
      await finish("ignored", "direct_denied");
      return;
    }
    if (match.decision === "answer" && !match.answer)
      throw new Error("Invalid direct answer");
    const chat =
      match.decision === "unknown"
        ? await assistantReply(
            question,
            { sender, group: null },
            event.webhookEventId,
          )
        : null;
    const text =
      match.decision === "answer"
        ? match.answer!
        : match.decision === "conflict"
          ? CONFLICT
          : match.decision === "ambiguous"
            ? "คำถามนี้ตรงกับหลายเรื่อง ลองถามให้เจาะจงขึ้นอีกนิดนะครับ"
            : chat?.text || unknownReply(owner.data?.unknown_replies);
    // The reply token belongs to this direct chat. Never push or mention in a group.
    const attachments =
      match.decision === "answer"
        ? await memoryFiles(match.memory_id, sender, null)
        : [];
    await lineRequest("message/reply", required("LINE_CHANNEL_ACCESS_TOKEN"), {
      replyToken: event.replyToken,
      messages: [{ type: "text", text }, ...attachments],
    });
    await finish(
      "replied",
      chat
        ? "assistant"
        : match.decision === "answer"
          ? sender === owner.data?.line_user_id
            ? "owner_answer"
            : "direct_answer"
          : match.decision,
    );
  } catch (error) {
    const permanent = error instanceof LineError && error.status === 400;
    await finish(permanent ? "expired" : "failed", "delivery_error");
    if (!permanent) throw error;
  }
}
