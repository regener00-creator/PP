"use server";
import { requireAdmin } from "@/lib/auth";
import type { PlannerState } from "@/lib/planner-types";
async function retired(): Promise<PlannerState> { await requireAdmin(); return { ok: false, message: "นำ Content Planner ออกแล้ว ใช้เลขาส่วนตัวแทนครับ" }; }
export async function savePlannerBrand(..._args: unknown[]): Promise<PlannerState> { return retired(); }
export async function savePlannerSource(..._args: unknown[]): Promise<PlannerState> { return retired(); }
export async function deletePlannerSource(..._args: unknown[]): Promise<PlannerState> { return retired(); }
export async function deleteUnusedBrand(..._args: unknown[]): Promise<PlannerState> { return retired(); }
export async function saveContentItem(..._args: unknown[]): Promise<PlannerState> { return retired(); }
export async function moveContentItem(..._args: unknown[]): Promise<PlannerState> { return retired(); }
export async function deleteArchivedContent(..._args: unknown[]): Promise<PlannerState> { return retired(); }
export async function createPlannerGeneration(..._args: unknown[]): Promise<PlannerState> { return retired(); }
export async function keepPlannerIdea(..._args: unknown[]): Promise<PlannerState> { return retired(); }
export async function setPlannerPatternEnabled(..._args: unknown[]): Promise<PlannerState> { return retired(); }
export async function loadContentItem(..._args: unknown[]) { await requireAdmin(); return null; }
export async function loadPlannerPatterns(..._args: unknown[]) { await requireAdmin(); return []; }
