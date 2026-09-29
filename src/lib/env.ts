import "server-only";
export function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value || value.includes("REPLACE_ME") || value.includes("YOUR_PROJECT")) {
    throw new Error(`Configuration missing: ${name}`);
  }
  return value;
}
export function adminConfigured() {
  return ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "ADMIN_USER_ID"].every(name => {
    try { required(name); return true; } catch { return false; }
  });
}
