import "server-only";
import { randomUUID } from "node:crypto";
import { database, dbError } from "./db";
import { required } from "./env";
import { semanticMatch } from "./semantic";
import {
  decide,
  normalizeQuestion,
  ownerPresenceQuestion,
  type MemoryMatch,
} from "./policy";
import {
  extractQuestion,
  LineError,
  lineRequest,
  mentionOwner,
  ownerInGroup,
  ownerTextEvent,
  textEvent,
  userId,
  type LineMessage,
} from "./line";
import { processDirectMessage } from "./owner-chat";
import { memoryFiles } from "./library";
import { assistantReply } from "./assistant";
import { writeIntent } from "./assistant-types";

export async function processEvent(input: unknown, destination: string) {
  const direct = ownerTextEvent.safeParse(input);
  if (direct.success) {
    if (direct.data.mode !== "standby")
      await processDirectMessage(direct.data, destination);
    return;
  }
  const parsed = textEvent.safeParse(input);
  if (!parsed.success || parsed.data.mode === "standby") return;
  const event = parsed.data;
  const question = extractQuestion(
    event,
    destination,
    process.env.ALLOW_TEXT_TRIGGER === "true",
  );
  if (question === null || !event.source.userId) return;
  const db = database();
  const group = event.source.groupId;
  const sender = event.source.userId;
  // Discover only groups where PP is explicitly called. A discovered group is disabled.
  const discovered = await db
    .from("permissions")
    .upsert(
      { group_id: group },
      { onConflict: "group_id", ignoreDuplicates: true },
    );
  dbError(discovered.error);
  const permission = await db
    .from("permissions")
    .select("enabled,allow_owner_mention")
    .eq("group_id", group)
    .single();
  dbError(permission.error);
  if (!permission.data?.enabled) return;
  const friend = await db
    .from("friends")
    .upsert(
      { group_id: group, line_user_id: sender },
      { onConflict: "group_id,line_user_id", ignoreDuplicates: true },
    );
  dbError(friend.error);
  const known = await db
    .from("friends")
    .select("blocked")
    .eq("group_id", group)
    .eq("line_user_id", sender)
    .single();
  dbError(known.error);
  if (known.data?.blocked) return;
  const lease = randomUUID();
  const claim = await db.rpc("pp_claim_event", {
    p_event: event.webhookEventId,
    p_group: group,
    p_sender: sender,
    p_message: event.message.id,
    p_lease: lease,
  });
  dbError(claim.error);
  if (claim.data === "done") return;
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
      p_key: `message:${group}:${sender}`,
      p_limit: 8,
      p_seconds: 60,
    });
    dbError(rate.error);
    if (!rate.data) {
      await finish("ignored", "rate_limit");
      return;
    }
    const owner = await db
      .from("owner")
      .select("display_name,line_user_id,unknown_replies")
      .eq("id", 1)
      .single();
    dbError(owner.error);
    if (
      writeIntent(question) ||
      /^(ยืนยัน|ยกเลิก|คำสั่ง|help)$/.test(question.trim())
    ) {
      const reply = await assistantReply(
        question,
        { sender, group },
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
    const result = await db.rpc("pp_answer", {
      p_question: normalizeQuestion(question),
      p_group: group,
      p_sender: sender,
    });
    dbError(result.error);
    let match = result.data as MemoryMatch;
    if (
      match.decision === "unknown" &&
      !ownerPresenceQuestion(question, owner.data?.display_name || "ปีโป้")
    ) {
      match = await semanticMatch(
        question,
        group,
        sender,
        owner.data?.display_name || "ปีโป้",
      );
    }
    const decision = decide(
      question,
      match,
      owner.data?.display_name || "ปีโป้",
      owner.data?.unknown_replies,
    );
    const chat =
      decision.kind === "unknown"
        ? await assistantReply(
            question,
            { sender, group },
            event.webhookEventId,
          )
        : null;
    let message: LineMessage = {
      type: "text",
      text: chat?.text || decision.text,
    };
    const token = required("LINE_CHANNEL_ACCESS_TOKEN");
    const ownerId = owner.data?.line_user_id || process.env.OWNER_LINE_USER_ID;
    // Owners can test their own handoff; only the bot itself is excluded.
    const wantsMention =
      decision.kind === "handoff" ||
      (decision.kind === "answer" && decision.mention_owner === true);
    if (
      wantsMention &&
      permission.data.allow_owner_mention &&
      userId.safeParse(ownerId).success &&
      ownerId !== destination
    ) {
      if (await ownerInGroup(group, ownerId!, token)) {
        const cooldown = await db.rpc("pp_take_rate", {
          p_key: `mention:${group}`,
          p_limit: 1,
          p_seconds: 300,
        });
        dbError(cooldown.error);
        if (cooldown.data)
          message = mentionOwner(
            ownerId!,
            decision.kind === "answer" ? decision.text : undefined,
          );
      }
    }
    // A LINE reply token is single use. Retries never switch to push messages.
    const attachments =
      decision.kind === "answer"
        ? await memoryFiles(match.memory_id, sender, group)
        : [];
    await lineRequest("message/reply", token, {
      replyToken: event.replyToken,
      messages: [message, ...attachments],
    });
    await finish("replied", chat ? "assistant" : decision.kind);
  } catch (error) {
    const permanent = error instanceof LineError && error.status === 400;
    await finish(permanent ? "expired" : "failed", "delivery_error");
    if (!permanent) throw error;
  }
}
