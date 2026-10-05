import { plannerGoals } from "@/lib/planner-goal-data";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { database, dbError } from "@/lib/db";
import { plannerCatalog } from "@/lib/planner-data";
import { semanticConfig } from "@/lib/semantic-config";
import { IdeaGenerator } from "@/components/planner/generator";
import type { Generation } from "@/lib/planner-types";
export default async function Planner({
  searchParams,
}: {
  searchParams: Promise<{ generation?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const db = database();
  const [catalog, selected, goalSettings] = await Promise.all([
    plannerCatalog(),
    params.generation && z.uuid().safeParse(params.generation).success
      ? db
          .from("content_generations")
          .select("*")
          .eq("id", params.generation)
          .eq("kind", "ideas")
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    plannerGoals(),
  ]);
  dbError(selected.error);
  return (
    <IdeaGenerator
      key={params.generation || "new"}
      {...catalog}
      goalSettings={goalSettings}
      initial={selected.data as Generation | null}
      aiEnabled={semanticConfig().enabled}
    />
  );
}
