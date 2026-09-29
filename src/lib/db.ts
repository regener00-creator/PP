import "server-only";
import { createClient } from "@supabase/supabase-js";
import { required } from "./env";
export function database() {
  return createClient(required("SUPABASE_URL"), required("SUPABASE_SECRET_KEY"), {
    db: { schema: "pp" },
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(5000), cache: "no-store" }) }
  });
}
export function dbError(error: unknown) {
  if (error) throw new Error("Database operation failed");
}
