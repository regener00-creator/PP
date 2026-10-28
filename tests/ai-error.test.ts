import { describe, expect, it } from "vitest";
import { aiFailure } from "../src/lib/ai-error";

describe("safe AI diagnostics", () => {
  it.each([
    [{ name: "TimeoutError" }, "timeout"],
    [{ name: "AI_NoObjectGeneratedError", finishReason: "length" }, "output"],
    [{ statusCode: 403 }, "access"],
    [{ statusCode: 429 }, "provider_quota"],
    [{ statusCode: 404 }, "model_not_found"],
    [{ statusCode: 400 }, "request"],
    [{ statusCode: 503 }, "provider_unavailable"],
    [{ message: "Billing account disabled" }, "billing"],
    [{ message: "invalid_grant: attribute condition rejected" }, "identity"],
  ])("classifies a provider failure without raw details", (error, reason) => {
    expect(aiFailure(error).reason).toBe(reason);
  });
  it("never returns prompt, token, response text or arbitrary provider fields", () => {
    const canary = "PRIVATE_CANARY";
    const result = aiFailure({ name: canary, message: canary, statusCode: canary,
      finishReason: canary, text: canary, responseBody: canary, url: canary,
      requestBodyValues: { prompt: canary }, response: { headers: { authorization: canary } } });
    expect(result).toEqual({ reason: "unknown" });
    expect(JSON.stringify(result)).not.toContain(canary);
  });
  it("handles missing errors and bounded status codes", () => {
    expect(aiFailure(null)).toEqual({ reason: "unknown" });
    expect(aiFailure({ response: { status: 403 } })).toEqual({ reason: "access", statusCode: 403 });
    expect(aiFailure({ statusCode: 999 })).toEqual({ reason: "unknown" });
  });
});
