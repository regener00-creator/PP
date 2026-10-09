import { timingSafeEqual } from "node:crypto";
import { sendDueReminders } from "@/lib/reminders";
import { sendAssistantReminders } from "@/lib/assistant-reminders";
export const maxDuration = 300;
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (
    !secret ||
    secret.length < 32 ||
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    return new Response("Unauthorized", { status: 401 });
  try {
    const legacy = await sendDueReminders();
    const assistant = await sendAssistantReminders();
    return Response.json({ ...legacy, assistant });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
