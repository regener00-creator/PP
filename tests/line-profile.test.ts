import { afterEach, describe, expect, it, vi } from "vitest";
import { getGroupMemberName, getGroupMemberIds } from "@/lib/line";
const group = "C" + "1".repeat(32), user = "U" + "1".repeat(32);
afterEach(() => vi.unstubAllGlobals());
describe("LINE group profile lookup", () => {
  it("reads the matching group member's display name", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ userId: user, displayName: "  P 3 P O  " })); vi.stubGlobal("fetch", fetch);
    expect(await getGroupMemberName(group, user, "test-only")).toBe("P 3 P O");
    expect(fetch).toHaveBeenCalledWith(`https://api.line.me/v2/bot/group/${group}/member/${user}`, expect.objectContaining({ cache: "no-store", headers: { Authorization: "Bearer test-only" } }));
  });
  it("rejects mismatched profiles", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ userId: "U" + "2".repeat(32), displayName: "someone else" })));
    await expect(getGroupMemberName(group, user, "test-only")).rejects.toThrow("mismatch");
  });
  it("rejects unavailable or empty profiles", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 404 })).mockResolvedValueOnce(Response.json({ userId: user, displayName: " " })); vi.stubGlobal("fetch", fetch);
    await expect(getGroupMemberName(group, user, "test-only")).rejects.toThrow();
    await expect(getGroupMemberName(group, user, "test-only")).rejects.toThrow();
  });
});

describe("LINE member enumeration",()=>{
 it("follows an encoded cursor and deduplicates IDs",async()=>{
  const fetch=vi.fn().mockResolvedValueOnce(Response.json({memberIds:[user],next:"next /+"})).mockResolvedValueOnce(Response.json({memberIds:[user,"U"+"2".repeat(32)]}));vi.stubGlobal("fetch",fetch);
  expect(await getGroupMemberIds(group,"test-only")).toEqual({ids:[user,"U"+"2".repeat(32)],complete:true});
  expect(fetch.mock.calls[1][0]).toContain("?start=next%20%2F%2B");
 });
 it("preserves 403 as an explicit unsupported-account error",async()=>{
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(null,{status:403})));
  await expect(getGroupMemberIds(group,"test-only")).rejects.toMatchObject({status:403});
 });
 it("stops on a repeated pagination cursor",async()=>{
  vi.stubGlobal("fetch",vi.fn().mockImplementation(()=>Promise.resolve(Response.json({memberIds:[user],next:"same"}))));
  await expect(getGroupMemberIds(group,"test-only")).rejects.toThrow("repeated");
 });
});
