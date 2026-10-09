import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
export default async function RetiredChat() {
  await requireAdmin();
  redirect("/admin");
}
