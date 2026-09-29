import { z } from "zod";
import { required } from "@/lib/env";
import { verifySignature, userId } from "@/lib/line";
import { processEvent } from "@/lib/bot";
export const runtime = "nodejs";
export const maxDuration = 60;
const envelope = z.object({ destination: userId, events: z.array(z.unknown()).max(100) });
const MAX_BODY = 1024 * 1024;
export async function POST(request: Request) {
  let secret: string;
  try { secret = required("LINE_CHANNEL_SECRET"); } catch { return new Response("Not configured", { status: 503 }); }
  if (Number(request.headers.get("content-length")) > MAX_BODY) return new Response("Too large", { status: 413 });
  const reader = request.body?.getReader();
  if (!reader) return new Response("Invalid body", { status: 400 });
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > MAX_BODY) { await reader.cancel(); return new Response("Too large", { status: 413 }); }
    chunks.push(value);
  }
  const raw = Buffer.concat(chunks);
  if (!verifySignature(raw, request.headers.get("x-line-signature"), secret)) return new Response("Invalid signature", { status: 401 });
  let body: z.infer<typeof envelope>;
  try { body = envelope.parse(JSON.parse(raw.toString("utf8"))); } catch { return new Response("Invalid body", { status: 400 }); }
  // Await work so LINE redelivery can retry failed events. No fire-and-forget work.
  const results = await Promise.allSettled(body.events.map(event => processEvent(event, body.destination)));
  const failed = results.filter(result => result.status === "rejected").length;
  if (failed) {
    console.error(JSON.stringify({ code: "PP_WEBHOOK_RETRY", count: failed }));
    return new Response("Retry later", { status: 503 });
  }
  return Response.json({ ok: true });
}
