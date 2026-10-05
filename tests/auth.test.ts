import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({ getUser: vi.fn(), getClaims: vi.fn(), refresh: false }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: vi.fn() }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, options: {
    cookies: { setAll: (values: { name: string; value: string; options: { path: string; httpOnly: boolean } }[]) => void }
  }) => ({ auth: {
    getUser: state.getUser,
    getClaims: async () => {
      if (state.refresh) options.cookies.setAll([{ name: "sb-test-auth-token", value: "refreshed", options: { path: "/", httpOnly: true } }]);
      return state.getClaims();
    }
  } })
}));

import { requireAdmin } from "../src/lib/auth";
import { proxy } from "../src/proxy";

beforeEach(() => {
  vi.clearAllMocks(); state.refresh = false;
  vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "test-public");
  vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret");
  vi.stubEnv("ADMIN_USER_ID", "owner-id");
  state.getUser.mockResolvedValue({ data: { user: { id: "owner-id" } }, error: null });
  state.getClaims.mockResolvedValue({ data: { claims: { sub: "owner-id" } }, error: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("admin authorization after navigation optimization", () => {
  it("still obtains the current owner from Auth before granting access", async () => {
    expect(await requireAdmin()).toEqual({ id: "owner-id" });
    expect(state.getUser).toHaveBeenCalledOnce();
  });
  it.each([
    { data: { user: null }, error: null },
    { data: { user: { id: "other-user" } }, error: null },
    { data: { user: { id: "owner-id" } }, error: new Error("revoked") }
  ])("rejects absent, different or revoked users", async result => {
    state.getUser.mockResolvedValue(result);
    await expect(requireAdmin()).rejects.toThrow("redirect:/login");
  });
  it("does not retain an authorized result across independent requests", async () => {
    await requireAdmin();
    state.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(requireAdmin()).rejects.toThrow("redirect:/login");
  });
  it("keeps the private file sign-in destination", async () => {
    state.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(requireAdmin("/api/files/test-id")).rejects.toThrow("redirect:/login?next=%2Fapi%2Ffiles%2Ftest-id");
  });
  it("requires configuration before asking Auth", async () => {
    vi.stubEnv("ADMIN_USER_ID", "");
    await expect(requireAdmin()).rejects.toThrow("redirect:/setup");
    expect(state.getUser).not.toHaveBeenCalled();
  });
});

describe("session refresh proxy", () => {
  it("verifies claims and leaves the live user lookup to the protected page", async () => {
    const response = await proxy(new NextRequest("https://pp.example/admin"));
    expect(state.getClaims).toHaveBeenCalledOnce();
    expect(state.getUser).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("passes refreshed cookies to the request and browser without caching", async () => {
    state.refresh = true;
    const request = new NextRequest("https://pp.example/admin");
    const response = await proxy(request);
    expect(request.cookies.get("sb-test-auth-token")?.value).toBe("refreshed");
    expect(response.cookies.get("sb-test-auth-token")).toMatchObject({ value: "refreshed", httpOnly: true });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
