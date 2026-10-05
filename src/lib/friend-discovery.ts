import "server-only";
import { z } from "zod";
import { database, dbError } from "./db";
import { required } from "./env";
import { getGroupMemberName, groupId, userId } from "./line";

// Only identity fields survive parsing. Never retain message text or attachments.
const source = z.object({ type: z.literal("group"), groupId, userId: userId.optional() });
const discoveryEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("message"), mode: z.enum(["active", "standby"]).optional(), source,
    message: z.object({ type: z.string(), id: z.string() }) }),
  z.object({ type: z.literal("memberJoined"), mode: z.enum(["active", "standby"]).optional(), source,
    joined: z.object({ members: z.array(z.object({ type: z.literal("user"), userId })).max(100) }) }),
]);

// Called only after webhook signature verification. This never replies, calls AI,
// reads memories or changes group permission / blocked preferences.
export async function discoverGroupFriends(input: unknown, destination: string) {
  const parsed = discoveryEvent.safeParse(input);
  if (!parsed.success || parsed.data.mode === "standby") return;
  const event = parsed.data;
  const ids = [...new Set(event.type === "memberJoined" ? event.joined.members.map(member => member.userId) : [event.source.userId])]
    .filter((id): id is string => Boolean(id) && id !== destination);
  if (!ids.length) return;
  const group = event.source.groupId, db = database();
  const permission = await db.from("permissions").select("enabled").eq("group_id", group).maybeSingle();
  dbError(permission.error);
  if (!permission.data?.enabled) return;
  const saved = await db.from("friends").upsert(ids.map(id => ({ group_id: group, line_user_id: id })),
    { onConflict: "group_id,line_user_id", ignoreDuplicates: true }).select("id,line_user_id,display_name,blocked");
  dbError(saved.error);
  // Existing entries are untouched; missing names can also be refreshed in admin.
  const fresh = (saved.data || []).filter(friend => !friend.blocked && !friend.display_name.trim());
  if (!fresh.length) return;
  const token = required("LINE_CHANNEL_ACCESS_TOKEN");
  for (let index = 0; index < fresh.length; index += 4) {
    await Promise.all(fresh.slice(index, index + 4).map(async friend => {
      try {
        const name = await getGroupMemberName(group, friend.line_user_id, token);
        const updated = await db.from("friends").update({ display_name: name }).eq("id", friend.id)
          .eq("group_id", group).eq("blocked", false).eq("display_name", friend.display_name);
        dbError(updated.error);
      } catch { /* Keep the known ID if LINE cannot provide its name yet. */ }
    }));
  }
}
