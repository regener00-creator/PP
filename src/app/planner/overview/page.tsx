import { requireAdmin } from "@/lib/auth";
import { plannerCatalog, plannerItems } from "@/lib/planner-data";
import { database, dbError } from "@/lib/db";
import { PlannerOverview } from "@/components/planner/overview";
import { Suspense } from "react";
import { LineQuota, QuotaLoading } from "@/components/line-quota";
export default async function Overview() {
  await requireAdmin();
  const [catalog, items, deliveries] = await Promise.all([
    plannerCatalog(),
    plannerItems(),
    database()
      .from("content_deliveries")
      .select("id,item_id,status,reason,target,updated_at")
      .order("updated_at", { ascending: false })
      .limit(30),
  ]);
  dbError(deliveries.error);
  return (
    <>
      <PlannerOverview
        {...catalog}
        items={items}
        deliveries={deliveries.data || []}
      />
      <Suspense fallback={<QuotaLoading />}>
        <LineQuota />
      </Suspense>
    </>
  );
}
