// Provider exceptions may contain prompts, credentials and model output.
// Return only fixed labels and bounded numeric metadata, never raw exceptions.
export function aiFailure(error: unknown) {
  const e = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const response = e.response && typeof e.response === "object" ? e.response as Record<string, unknown> : {};
  const status = Number(e.statusCode ?? response.status);
  const statusCode = Number.isInteger(status) && status >= 400 && status <= 599 ? status : undefined;
  const name = String(e.name || "");
  const finish = String(e.finishReason || "");
  const finishReason = ["stop", "length", "content-filter", "error", "other", "unknown"].includes(finish) ? finish : undefined;
  // Inspect only to classify; no text, URL, headers or bodies leave this function.
  const message = typeof e.message === "string" ? e.message.slice(0, 8000) : "";
  let reason = "unknown";
  if (/billing|billing_disabled|billing account/i.test(message)) reason = "billing";
  else if (/invalid_grant|attribute condition|workload identity|iamcredentials|sts.googleapis/i.test(message)) reason = "identity";
  else if (name === "AbortError" || name === "TimeoutError") reason = "timeout";
  else if (name === "AI_NoObjectGeneratedError" || name === "AI_TypeValidationError" || name === "ZodError") reason = "output";
  else if (statusCode === 401 || statusCode === 403) reason = "access";
  else if (statusCode === 429) reason = "provider_quota";
  else if (statusCode === 404) reason = "model_not_found";
  else if (statusCode === 400) reason = "request";
  else if (statusCode && statusCode >= 500) reason = "provider_unavailable";
  return { reason, ...(statusCode ? { statusCode } : {}), ...(finishReason ? { finishReason } : {}) };
}
