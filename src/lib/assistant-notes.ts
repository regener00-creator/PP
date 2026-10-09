import "server-only";
import { requireAdmin } from "./auth";
import { assistantAllowed } from "./assistant";
import { database, dbError } from "./db";
import type { ManagedAssistantNote } from "./assistant-notes-types";

export async function adminAssistantNotes(): Promise<ManagedAssistantNote[]> {
  await requireAdmin();
  const db = database();
  const [owner, permissions] = await Promise.all([
    db.from("owner").select("line_user_id").eq("id", 1).single(),
    db.from("permissions").select("group_id,label").eq("enabled", true).order("created_at"),
  ]);
  dbError(owner.error, "notes:owner");
  dbError(permissions.error, "notes:permissions");
  const sender = owner.data?.line_user_id;
  if (!sender) return [];
  const groups = new Map<string, string>((permissions.data || []).map(g => [g.group_id, g.label || "กลุ่มที่ยังไม่ตั้งชื่อ"]));
  const scopes: (string | null)[] = [null, ...groups.keys()];
  const notebooks = await Promise.all(scopes.map(async group => {
    // Owner DM only. Never query another person's private notebook with the server key.
    if (!await assistantAllowed({ sender, group, web: true })) return [];
    const result = await db.from("assistant_notes").select("id,title,content,updated_at")
      .eq("scope_key", group || sender).order("created_at").order("id").limit(200);
    dbError(result.error, "notes:list");
    return (result.data || []).map(note => ({
      ...note, group, sourceLabel: group ? `กลุ่ม ${groups.get(group)}` : "แชตส่วนตัวของฉัน",
    })) as ManagedAssistantNote[];
  }));
  return notebooks.flat();
}
