"use server";
import { requireAdmin } from "@/lib/auth";
export async function savePlannerGoals(..._args: unknown[]) { await requireAdmin(); return { ok: false, message: "นำ Content Planner ออกแล้ว" }; }
