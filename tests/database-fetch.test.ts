import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { databaseFetch } from "../src/lib/database-fetch";
import { database } from "../src/lib/db";

const url = "https://example.supabase.co/rest/v1/permissions?select=group_id";
const rejected = () => Response.json({ code: "PGRST303", message: "JWT claims validation failed" }, { status: 401 });
const request = vi.fn<typeof fetch>();
beforeEach(() => {
  request.mockReset();
  vi.stubGlobal("fetch", request);
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("database read recovery", () => {
  it("recovers a rejected SDK table read without changing credentials or timeout", async () => {
    request.mockResolvedValueOnce(rejected()).mockResolvedValueOnce(Response.json([{ group_id: "example" }]));
    const result = await database().from("permissions").select("group_id");
    expect(result.error).toBeNull();
    expect(result.data).toEqual([{ group_id: "example" }]);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1]).toEqual(request.mock.calls[0]);
    expect(request.mock.calls[0][1]?.cache).toBe("no-store");
    expect(request.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });
  it("returns a persistent JWT rejection after exactly one retry", async () => {
    request.mockImplementation(async () => rejected());
    const result = await database().from("permissions").select("group_id");
    expect(result.error?.code).toBe("PGRST303");
    expect(request).toHaveBeenCalledTimes(2);
  });
  it.each(["POST", "PATCH", "DELETE", "PUT"])("never replays a %s mutation", async method => {
    request.mockResolvedValue(rejected());
    expect((await databaseFetch(url, { method })).status).toBe(401);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it.each(["GET", "POST"])("never replays a %s RPC", async method => {
    request.mockResolvedValue(rejected());
    await databaseFetch("https://example.supabase.co/rest/v1/rpc/pp_save_memory", { method });
    expect(request).toHaveBeenCalledTimes(1);
  });
  it.each(["PGRST301", "42501"])("does not retry other authentication or permission failures: %s", async code => {
    request.mockResolvedValue(Response.json({ code }, { status: 401 }));
    expect(await (await databaseFetch(url)).json()).toEqual({ code });
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("does not retry successful reads, malformed errors or network failures", async () => {
    request.mockResolvedValueOnce(Response.json([])).mockResolvedValueOnce(new Response("bad gateway", { status: 401 })).mockRejectedValueOnce(new Error("network"));
    expect((await databaseFetch(url)).status).toBe(200);
    expect(await (await databaseFetch(url)).text()).toBe("bad gateway");
    await expect(databaseFetch(url)).rejects.toThrow("network");
    expect(request).toHaveBeenCalledTimes(3);
  });
  it("honors cancellation during the retry delay", async () => {
    const controller = new AbortController();
    request.mockImplementation(async () => { controller.abort(); return rejected(); });
    await expect(databaseFetch(url, { signal: controller.signal })).rejects.toThrow();
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("honors the method on Request objects and already-aborted signals", async () => {
    request.mockResolvedValue(rejected());
    await databaseFetch(new Request(url, { method: "POST" }));
    expect(request).toHaveBeenCalledTimes(1);
    await expect(databaseFetch(url, { signal: AbortSignal.abort() })).rejects.toThrow();
    expect(request).toHaveBeenCalledTimes(1);
  });
});
