import {timingSafeEqual} from "node:crypto";
import {sendContentReminders} from "@/lib/planner-reminders";
export const maxDuration=300;
export const dynamic="force-dynamic";
export async function GET(request:Request){const secret=process.env.CRON_SECRET,a=Buffer.from(request.headers.get("authorization")||""),b=Buffer.from(`Bearer ${secret}`);if(!secret||secret.length<32||a.length!==b.length||!timingSafeEqual(a,b))return new Response("Unauthorized",{status:401});try{return Response.json(await sendContentReminders());}catch{return Response.json({ok:false},{status:503});}}
