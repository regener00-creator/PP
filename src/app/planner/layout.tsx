import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
export default async function RetiredPlanner() { await requireAdmin(); redirect("/admin/chat"); }
