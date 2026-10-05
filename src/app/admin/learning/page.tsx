import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
// Old bookmarks return to Memory; group learning has been retired.
export default async function RetiredLearningPage() {
  await requireAdmin();
  redirect("/admin");
}
