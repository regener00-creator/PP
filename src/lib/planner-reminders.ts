import "server-only";
import { database, dbError } from "./db";
import {
  dueContent,
  thaiDay,
  statusLabels,
  type ContentItem,
} from "./planner-types";
import { quotaStatus, lineJson, pushOnce } from "./reminders";
import { fileMessages, validateAttachments, APP_URL } from "./library";
import type { LineMessage } from "./line";
export async function sendContentReminders(now = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Bangkok",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
  const totals = { sent: 0, failed: 0, skipped: 0, deferred: 0 };
  if (hour !== 8) return { ...totals, outsideWindow: true };
  const started = Date.now(),
    db = database(),
    today = thaiDay(now);
  const rangeEnd = new Date(Date.parse(`${today}T00:00:00Z`) + 2 * 86400000)
    .toISOString()
    .slice(0, 10);
  const r = await db
    .from("content_items")
    .select("*")
    .eq("archived", false)
    .neq("status", "posted")
    .gte("scheduled_at", `${today}T00:00:00+07:00`)
    .lt("scheduled_at", `${rangeEnd}T00:00:00+07:00`)
    .order("scheduled_at")
    .limit(1000);
  dbError(r.error);
  const owner = await db
    .from("owner")
    .select("line_user_id")
    .eq("id", 1)
    .single();
  dbError(owner.error);
  for (const item of (r.data || []) as ContentItem[]) {
    for (const lead of dueContent(item, today))
      for (const target of [
        ...(item.notify_owner && owner.data?.line_user_id
          ? [owner.data.line_user_id]
          : []),
        ...(item.group_id ? [item.group_id] : []),
      ]) {
        if (Date.now() - started > 240000) {
          totals.deferred++;
          continue;
        }
        const occurs = thaiDay(new Date(item.scheduled_at!));
        const claim = await db.rpc("pp_claim_content", {
          p_item: item.id,
          p_occurs: occurs,
          p_lead: lead,
          p_target: target,
        });
        dbError(claim.error);
        if (!claim.data) continue;
        const d = claim.data as {
          id: string;
          attempts: number;
          retry_key: string;
          payload: LineMessage[] | null;
          item_revision: string | null;
        };
        let result = "delivery_error";
        try {
          const [fresh, o] = await Promise.all([
            db
              .from("content_items")
              .select("*")
              .eq("id", item.id)
              .maybeSingle(),
            db.from("owner").select("line_user_id").eq("id", 1).single(),
          ]);
          dbError(fresh.error);
          dbError(o.error);
          const e = fresh.data as ContentItem | null,
            isGroup = target.startsWith("C");
          if (
            !e ||
            !dueContent(e, today).includes(lead) ||
            thaiDay(new Date(e.scheduled_at!)) !== occurs ||
            (isGroup
              ? e.group_id !== target
              : !e.notify_owner || o.data?.line_user_id !== target) ||
            (d.payload && d.item_revision !== e.updated_at)
          )
            result = "changed";
          else {
            const group = isGroup
              ? await db
                  .from("permissions")
                  .select("enabled")
                  .eq("group_id", target)
                  .maybeSingle()
              : { data: { enabled: true }, error: null };
            dbError(group.error);
            if (!group.data?.enabled) result = "group_disabled";
            else if (
              !(await validateAttachments(
                e.attachment_ids,
                isGroup ? "shareable" : "private",
              ))
            )
              result = "changed";
            else {
              const quota = await quotaStatus(),
                count = isGroup
                  ? (await lineJson(`group/${target}/members/count`)).count
                  : 1;
              if (!quota || !Number.isInteger(count) || count < 1)
                result = "quota_unavailable";
              else if (quota.limit !== null && quota.used + count > quota.limit)
                result = "quota_exhausted";
              else {
                let messages = d.payload;
                if (!messages) {
                  const text = `${lead ? "พรุ่งนี้มีคอนเทนต์ที่วางแผนไว้" : "คอนเทนต์ที่วางแผนไว้วันนี้"}\n${e.title}\n${e.channel} · ${new Date(e.scheduled_at!).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}\nสถานะ: ${statusLabels[e.status]}${e.assignee ? `\nผู้รับผิดชอบ: ${e.assignee}` : ""}\nเปิดงาน (บัญชีเจ้าของ): ${APP_URL}/planner/work?item=${e.id}`;
                  const files = await fileMessages(e.attachment_ids, {
                    parent: e.id,
                    kind: "content",
                    group: isGroup ? target : null,
                    private: !isGroup,
                  });
                  const saved = await db
                    .from("content_deliveries")
                    .update({
                      payload: [{ type: "text", text }, ...files],
                      item_revision: e.updated_at,
                    })
                    .eq("id", d.id)
                    .eq("attempts", d.attempts)
                    .eq("status", "processing")
                    .is("payload", null)
                    .select("payload")
                    .maybeSingle();
                  dbError(saved.error);
                  messages = saved.data?.payload as LineMessage[] | null;
                }
                const latest = await db
                  .from("content_items")
                  .select("updated_at")
                  .eq("id", e.id)
                  .maybeSingle();
                dbError(latest.error);
                if (latest.data?.updated_at !== e.updated_at)
                  result = "changed";
                else if (messages)
                  result = await pushOnce(target, messages, d.retry_key);
              }
            }
          }
        } catch {
          /* No content, credentials or LINE ids in logs. */
        }
        const status =
          result === "sent"
            ? "sent"
            : ["changed", "group_disabled", "quota_exhausted"].includes(result)
              ? "skipped"
              : "failed";
        const saved = await db
          .from("content_deliveries")
          .update({
            status,
            reason: result,
            ...(status !== "failed" ? { payload: null } : {}),
            lease_until: new Date(Date.now() - 1).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", d.id)
          .eq("attempts", d.attempts)
          .eq("status", "processing");
        dbError(saved.error);
        totals[status]++;
      }
  }
  return totals;
}
