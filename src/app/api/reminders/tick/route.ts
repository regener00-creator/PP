import { database, dbError } from "@/lib/db";
import { sendDueReminders } from "@/lib/reminders";
import { sendAssistantReminders } from "@/lib/assistant-reminders";
export const maxDuration = 300;
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const token = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.get("authorization") || "")?.[1];
  if (!token) return new Response("Unauthorized", {status:401});
  try {
    const auth = await database().rpc("pp_authorize_reminder_tick", {p_token:token});
    dbError(auth.error,"reminders:tick-auth");
    if(auth.data !== true) return new Response("Unauthorized", {status:401});
    // A no-send check of Cron -> HTTP -> server authentication, safe on production.
    if(new URL(request.url).searchParams.get("probe") === "1") return Response.json({ok:true,probe:true});
    const manual = await sendDueReminders();
    const assistant = await sendAssistantReminders();
    return Response.json({ok:true,manual,assistant});
  } catch {
    return Response.json({ok:false},{status:503});
  }
}
