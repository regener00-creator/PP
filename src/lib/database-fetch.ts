import "server-only";
import { setTimeout as delay } from "node:timers/promises";

// Only replay table reads rejected before execution. Never replay writes or RPCs.
export const databaseFetch: typeof fetch = async (input, options) => {
  const request = input instanceof Request ? input : undefined;
  const method = (options?.method || request?.method || "GET").toUpperCase();
  const path = new URL(request?.url || String(input)).pathname;
  const callerSignal = options?.signal || request?.signal;
  const timeout = AbortSignal.timeout(5000);
  const signal = callerSignal ? AbortSignal.any([callerSignal, timeout]) : timeout;
  const init = { ...options, signal, cache: "no-store" as const };
  signal.throwIfAborted();
  const response = await fetch(input, init);
  if (method !== "GET" || !path.startsWith("/rest/v1/") || path.startsWith("/rest/v1/rpc/") || response.status !== 401) return response;
  const error = await response.clone().json().catch(() => null);
  if (error?.code !== "PGRST303") return response;
  await delay(250, undefined, { signal });
  // Keep the same credentials and total timeout. Persistent failures stay failures.
  return fetch(input, init);
};
