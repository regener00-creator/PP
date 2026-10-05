import "server-only";

export const AI_MODEL = "gemini-3.5-flash-lite";
export function semanticConfig() {
  const limit = Number(process.env.AI_MONTHLY_LIMIT || "1000");
  const credentials = process.env.GOOGLE_AUTH_MODE === "vercel-oidc"
    ? !!process.env.GOOGLE_VERTEX_PROJECT && !!process.env.GOOGLE_WIF_AUDIENCE && !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    : !!process.env.GOOGLE_VERTEX_API_KEY || (!!process.env.GOOGLE_VERTEX_PROJECT && !!process.env.GOOGLE_VERTEX_CREDENTIALS);
  const configured = credentials && Number.isInteger(limit) && limit > 0 && limit <= 1000;
  return {
    configured,
    enabled: process.env.AI_ENABLED === "true" && configured,
    limit,
    aliases: (process.env.OWNER_ALIASES || "ปีโป้,ปป").split(",").map(s => s.trim()).filter(Boolean).slice(0, 10),
  };
}
