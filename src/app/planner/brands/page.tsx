import { plannerCatalog } from "@/lib/planner-data";
import { BrandWorkspace } from "@/components/planner/brands";
export default async function Brands() {
  return <BrandWorkspace {...await plannerCatalog()} />;
}
