import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { required, adminConfigured } from "./env";
export async function authClient() {
  const jar = await cookies();
  return createServerClient(required("SUPABASE_URL"), required("SUPABASE_PUBLISHABLE_KEY"), {
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: values => {
        try { values.forEach(({ name, value, options }) => jar.set(name, value, options)); }
        catch { /* Server Components cannot write cookies; proxy refreshes them. */ }
      }
    }
  });
}
export async function requireAdmin() {
  if (!adminConfigured()) redirect("/setup");
  const client = await authClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user || data.user.id !== required("ADMIN_USER_ID")) redirect("/login");
  return data.user;
}
