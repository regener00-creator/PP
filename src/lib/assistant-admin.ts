import "server-only";
import { requireAdmin } from "./auth";
import { database, dbError } from "./db";
import { assistantAllowed } from "./assistant";
import { groupId } from "./line";
import type { AssistantScope } from "./assistant-types";

// Calendar management still uses the same owner/group boundaries as LINE.
export async function adminAssistantScope(group: string | null = null): Promise<AssistantScope> {
  const user = await requireAdmin();
  if (group) groupId.parse(group);
  const owner = await database().from("owner").select("line_user_id").eq("id", 1).single();
  dbError(owner.error);
  const scope = { sender: owner.data?.line_user_id || `admin:${user.id}`, group, web: true };
  if (!await assistantAllowed(scope)) throw Error("Assistant access denied");
  return scope;
}
