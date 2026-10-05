import "server-only";
import { database, dbError } from "./db";
import {
  reusablePatternSchema,
  type LearnedPattern,
} from "./planner-templates";
export async function reusablePatterns(
  brandId: string | null,
): Promise<LearnedPattern[]> {
  const r = await database()
    .from("content_patterns")
    .select("id,blueprint,enabled,generation_id,source_ids")
    .eq("scope", brandId || "unbranded")
    .order("created_at", { ascending: false })
    .limit(200);
  dbError(r.error);
  return (r.data || []).flatMap((row) => {
    const p = reusablePatternSchema.safeParse(row.blueprint);
    return p.success
      ? [
          {
            ...p.data,
            id: row.id,
            enabled: row.enabled,
            generation_id: row.generation_id,
            source_ids: row.source_ids,
          },
        ]
      : [];
  });
}
