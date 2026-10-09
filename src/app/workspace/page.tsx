import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
export default async function Workspace() { await requireAdmin(); redirect("/admin"); }
