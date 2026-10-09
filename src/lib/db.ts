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
export function dbError(error: unknown, operation = "database") {
  if (error) {
    // Log only the provider's error code and a developer-owned label, never SQL,
    // queries, credentials, note contents or personal identifiers.
    const code = typeof error === "object" && "code" in error ? String(error.code) : "unknown";
    console.error("PP database request failed", { operation, code: /^[A-Z0-9_]{1,24}$/.test(code) ? code : "unknown" });
    throw new Error("Database operation failed");
  }
}
