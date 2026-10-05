import "server-only";
import { requireAdmin } from "./auth";
import { database, dbError } from "./db";
import { goalsSchema, type GoalSettings } from "./planner-goals";
export async function plannerGoals(): Promise<GoalSettings> {
  await requireAdmin();
  const result = await database()
    .from("content_goal_settings")
    .select("goals,updated_at")
    .eq("id", true)
    .single();
  dbError(result.error);
  if (!result.data) throw new Error("ไม่พบการตั้งค่าเป้าหมาย");
  return {
    goals: goalsSchema.parse(result.data.goals),
    updated_at: result.data.updated_at,
  };
}
