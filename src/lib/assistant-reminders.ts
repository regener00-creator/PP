import "server-only";
import { database, dbError } from "./db";
import { timedDueDates } from "./calendar";
import { lineJson, quotaStatus, pushOnce } from "./reminders";
import { assistantAllowed } from "./assistant";
import type { AssistantEvent } from "./assistant-types";
import type { LineMessage } from "./line";
export async function sendAssistantReminders(now = new Date()) {
  const db = database(),
    started = Date.now(),
    totals = { sent: 0, failed: 0, skipped: 0, deferred: 0 };
  // page through all scopes; never let the first family's old events starve others.
  for (let page = 0; ; page++) {
    const r = await db
      .from("assistant_events")
      .select("*")
      .eq("enabled", true)
      .order("id")
      .range(page * 100, page * 100 + 99);
    dbError(r.error);
    const events = (r.data || []) as AssistantEvent[];
    for (const e of events)
      for (const {lead,occurs} of timedDueDates({ ...e, remind_day: true }, now)) {
        if (Date.now() - started > 90000) {
          totals.deferred++;
          continue;
        }
        const claim = await db.rpc("pp_claim_assistant_reminder", {
          p_event: e.id,
          p_occurs: occurs,
          p_lead: lead,
        });
        dbError(claim.error);
        if (!claim.data) continue;
        const d = claim.data as {
          id: string;
          retry_key: string;
          attempts: number;
          payload: LineMessage[];
          event_revision?: string;
        };
        let result = "delivery_error";
        try {
          const current = await db
            .from("assistant_events")
            .select("*")
            .eq("id", e.id)
            .maybeSingle();
          dbError(current.error);
          const fresh = current.data as AssistantEvent | null;
          if (
            !fresh ||
            !fresh.enabled ||
            (d.event_revision && Date.parse(d.event_revision) !== Date.parse(fresh.updated_at || "")) ||
            !timedDueDates({ ...fresh, remind_day: true }, now).some(due => due.lead === lead && due.occurs === occurs) ||
            JSON.stringify(d.payload) !==
              JSON.stringify([
                {
                  type: "text",
                  text: `${lead ? "เตือนล่วงหน้า 1 วัน · " : ""}${e.title}\n${e.content}`,
                },
              ]) ||
            JSON.stringify([
              fresh.title,
              fresh.content,
              fresh.event_date,
              fresh.scope_key,
              fresh.remind_before,
              fresh.annual,
              fresh.reminder_time,
            ]) !==
              JSON.stringify([
                e.title,
                e.content,
                e.event_date,
                e.scope_key,
                e.remind_before,
                e.annual,
                e.reminder_time,
              ]) ||
            !(await assistantAllowed({
              sender: e.sender_id,
              group: e.scope_key.startsWith("C") ? e.scope_key : null,
            }))
          )
            result = "changed";
          else {
            const quota = await quotaStatus();
            const count = e.scope_key.startsWith("C")
              ? (await lineJson(`group/${e.scope_key}/members/count`)).count
              : 1;
            if (!quota || !Number.isInteger(count) || count < 1)
              result = "quota_unavailable";
            else if (quota.limit !== null && quota.used + count > quota.limit)
              result = "quota_exhausted";
            else result = await pushOnce(e.scope_key, d.payload, d.retry_key);
          }
        } catch {
          /* No content or credentials in logs. */
        }
        const status =
          result === "sent"
            ? "sent"
            : ["changed", "quota_exhausted"].includes(result)
              ? "skipped"
              : "failed";
        const finish = await db
          .from("assistant_deliveries")
          .update({
            status,
            reason: result,
            lease_until: new Date(Date.now() - 1).toISOString(),
          })
          .eq("id", d.id)
          .eq("attempts", d.attempts)
          .eq("status", "processing");
        dbError(finish.error);
        totals[status]++;
      }
    if (events.length < 100 || Date.now() - started > 90000) break;
  }
  return totals;
}
