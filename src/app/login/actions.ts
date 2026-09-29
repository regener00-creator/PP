"use server";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authClient } from "@/lib/auth";
import { required, adminConfigured } from "@/lib/env";
import { database } from "@/lib/db";
export async function login(_: { message: string }, form: FormData) {
  if (!adminConfigured()) redirect("/setup");
  const h = await headers();
  // Vercel overwrites this header. Other hosts share a conservative global bucket.
  const ip = process.env.VERCEL ? h.get("x-vercel-forwarded-for") || "unknown" : "local";
  const key = createHmac("sha256", required("SUPABASE_SECRET_KEY")).update(ip).digest("hex");
  const { data, error } = await database().rpc("pp_take_rate", { p_key: `login:${key}`, p_limit: 5, p_seconds: 60 });
  if (error || !data) return { message: "กรุณารอสักครู่แล้วลองใหม่" };
  const email = String(form.get("email") || "").slice(0, 254);
  const password = String(form.get("password") || "");
  if (password.length > 256) return { message: "เข้าสู่ระบบไม่สำเร็จ" };
  const client = await authClient();
  const result = await client.auth.signInWithPassword({ email, password });
  if (result.error || result.data.user?.id !== required("ADMIN_USER_ID")) {
    await client.auth.signOut();
    return { message: "อีเมล รหัสผ่าน หรือสิทธิ์เข้าใช้งานไม่ถูกต้อง" };
  }
  redirect("/admin");
}
export async function logout() {
  await (await authClient()).auth.signOut(); redirect("/login");
}
