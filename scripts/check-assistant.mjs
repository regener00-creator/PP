// Explicit, synthetic production diagnostic. Never run automatically in npm build.
// Invoke with: node --conditions=react-server scripts/check-assistant.mjs
// Uses the existing AI rate/monthly budget; never reads notebooks or sends LINE.
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); }
    catch (error) {
      if (error.code === "ERR_MODULE_NOT_FOUND" && /^\.{1,2}\//.test(specifier) && !/\.[a-z]+$/i.test(specifier)) {
        return nextResolve(specifier + ".ts", context);
      }
      throw error;
    }
  },
});

const { aiFailure } = await import("../src/lib/ai-error.ts");
let phase = "imports";
try {
  const { generateAssistantPlan } = await import("../src/lib/assistant.ts");
  if (process.argv.includes("--check-imports")) {
    console.log("PP diagnostic imports OK");
    process.exit(0);
  }
  phase = "configuration";
  const { semanticConfig } = await import("../src/lib/semantic-config.ts");
  const config = semanticConfig();
  if (!config.enabled) throw Error("AI diagnostic not configured");
  const { database, dbError } = await import("../src/lib/db.ts");
  const db = database();
  phase = "budget";
  const rate = await db.rpc("pp_take_rate", { p_key: "ai:global", p_limit: 6, p_seconds: 60 });
  dbError(rate.error);
  if (!rate.data) throw Error("AI diagnostic rate budget exhausted");
  const budget = await db.rpc("pp_reserve_ai", { p_limit: config.limit });
  dbError(budget.error);
  if (!budget.data) throw Error("AI diagnostic monthly budget exhausted");
  phase = "generation";
  const started = Date.now();
  const plan = await generateAssistantPlan(JSON.stringify({
    today: "2026-10-28", tomorrow: "2026-10-29", writeIntent: null,
    question: "สวัสดี ช่วยบอกสั้น ๆ ว่าช่วยอะไรได้บ้าง", history: [], notes: [],
  }));
  if (plan.kind !== "chat" || !plan.text.trim()) throw Error("Unexpected synthetic plan");
  console.log(JSON.stringify({ code: "PP_ASSISTANT_PROBE", ok: true, kind: plan.kind, durationMs: Date.now() - started }));
} catch (error) {
  console.error(JSON.stringify({ code: "PP_ASSISTANT_PROBE", ok: false, phase, ...aiFailure(error) }));
  process.exitCode = 1;
}
