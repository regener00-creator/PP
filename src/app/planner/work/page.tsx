import {
  plannerCatalog,
  plannerItems,
  plannerAssets,
} from "@/lib/planner-data";
import { requireAdmin } from "@/lib/auth";
import { WorkPlanner } from "@/components/planner/work";
export default async function Work({
  searchParams,
}: {
  searchParams: Promise<{ item?: string }>;
}) {
  await requireAdmin();
  const { item } = await searchParams;
  const [catalog, items, assets] = await Promise.all([
    plannerCatalog(),
    plannerItems(),
    plannerAssets(),
  ]);
  return (
    <WorkPlanner
      items={items}
      assets={{ ...assets, brands: catalog.brands }}
      initialItem={item}
      campaigns={catalog.sources.filter((s) => s.kind === "campaign")}
    />
  );
}
