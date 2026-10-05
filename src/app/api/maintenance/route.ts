import { timingSafeEqual } from "node:crypto";
import { database } from "@/lib/db";
import { runLearning } from "@/lib/learning";
export const maxDuration=60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || secret.length < 32 || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return new Response("Unauthorized", { status: 401 });
  const { error } = await database().rpc("pp_cleanup");
  if(!error)await runLearning();
  return Response.json({ ok: !error }, { status: error ? 503 : 200 });
}
