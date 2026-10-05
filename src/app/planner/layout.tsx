import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth";
import { AdminShell } from "@/components/admin-shell";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export default async function PlannerLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdmin();
  return <AdminShell area="planner">{children}</AdminShell>;
}
