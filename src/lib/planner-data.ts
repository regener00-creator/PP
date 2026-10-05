import "server-only";
import { cache } from "react";
import { requireAdmin } from "./auth";
import { database, dbError } from "./db";
import type { Brand, ContentSummary, Source } from "./planner-types";
export const plannerCatalog = cache(async () => {
  await requireAdmin();
  const db = database();
  const [brands, sources] = await Promise.all([
    db.from("content_brands").select("*").order("created_at").limit(20),
    db.from("content_sources").select("*").order("created_at").limit(500),
  ]);
  dbError(brands.error);
  dbError(sources.error);
  return {
    brands: (brands.data || []) as Brand[],
    sources: (sources.data || []) as Source[],
  };
});
export async function plannerItems() {
  await requireAdmin();
  const r = await database()
    .from("content_items")
    .select(
      "id,title,brand_id,channel,pillar,format,status,scheduled_at,assignee,views,saves,sales,post_url,updated_at,created_at,archived",
    )
    .order("created_at", { ascending: false })
    .limit(1000);
  dbError(r.error);
  return (r.data || []) as ContentSummary[];
}
export async function plannerAssets() {
  await requireAdmin();
  const db = database();
  const [files, folders, groups] = await Promise.all([
    db
      .from("files")
      .select("id,name,folder_id,mime,bytes,visibility")
      .order("created_at", { ascending: false })
      .limit(500),
    db.from("folders").select("id,name").order("name"),
    db.from("permissions").select("group_id,label,enabled").eq("enabled", true),
  ]);
  [files, folders, groups].forEach((r) => dbError(r.error));
  return {
    files: files.data || [],
    folders: folders.data || [],
    groups: groups.data || [],
  };
}
