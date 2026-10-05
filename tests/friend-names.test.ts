import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), from: vi.fn(), profile: vi.fn(), update: vi.fn(), filters: vi.fn(), ids: vi.fn(), upsert: vi.fn(),
  friends: [] as { id: string; line_user_id: string; display_name: string }[], enabled: true, race: false }));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.auth }));
vi.mock("@/lib/db", () => ({ database: () => ({ from: mocks.from }), dbError: (error: unknown) => { if (error) throw error; } }));
vi.mock("@/lib/line", async original => ({ ...await original<typeof import("@/lib/line")>(), getGroupMemberName: mocks.profile, getGroupMemberIds: mocks.ids }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { LineError } from "@/lib/line";
import { loadFriendNames, syncGroupFriends } from "@/app/admin/friend-actions";
import { friendName } from "@/lib/friends";
const group = "C" + "1".repeat(32), user = "U" + "1".repeat(32);
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("LINE_CHANNEL_ACCESS_TOKEN", "test-only");
  mocks.enabled = true; mocks.race = false;
  mocks.friends = [{ id: "one", line_user_id: user, display_name: "" }];
  mocks.auth.mockResolvedValue({ id: "admin" }); mocks.ids.mockResolvedValue({ ids: [user], complete: true }); mocks.upsert.mockResolvedValue({ error: null }); mocks.profile.mockResolvedValue("พี่ฟิ้ง");
  mocks.from.mockImplementation(table => {
    if (table === "permissions") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { enabled: mocks.enabled }, error: null }) }) }) };
    if (table !== "friends") throw new Error("Unexpected table");
    const read = { eq: vi.fn().mockImplementation(() => read), order: () => read, limit: async () => ({ data: mocks.friends, error: null }) };
    return { upsert: mocks.upsert, select: () => read, update: (value: unknown) => {
      mocks.update(value);
      const write = { eq: (key: string, val: unknown) => { mocks.filters(key, val); return write; }, select: () => write,
        maybeSingle: async () => ({ data: mocks.race ? null : { id: "one", display_name: "พี่ฟิ้ง" }, error: null }) };
      return write;
    } };
  });
});
describe("resolving known group members", () => {
  it("requires admin authorization before any access", async () => {
    mocks.auth.mockRejectedValue(new Error("unauthorized"));
    await expect(loadFriendNames(group)).rejects.toThrow("unauthorized");
    expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.profile).not.toHaveBeenCalled();
  });
  it("rejects invalid and disabled groups without calling LINE", async () => {
    expect((await loadFriendNames("invalid")).names).toEqual([]); expect(mocks.from).not.toHaveBeenCalled();
    mocks.enabled = false;
    expect((await loadFriendNames(group)).names).toEqual([]); expect(mocks.profile).not.toHaveBeenCalled();
  });
  it("fills missing names and protects group, blocked state and concurrent edits", async () => {
    expect((await loadFriendNames(group)).names).toEqual([{ id: "one", name: "พี่ฟิ้ง" }]);
    expect(mocks.profile).toHaveBeenCalledWith(group, user, "test-only");
    expect(mocks.filters.mock.calls).toEqual([["id", "one"], ["group_id", group], ["blocked", false], ["display_name", ""]]);
  });
  it("keeps an owner's custom name without fetching or overwriting it", async () => {
    mocks.friends[0].display_name = "ฟิ้ง เพื่อนสนิท";
    expect((await loadFriendNames(group)).names[0].name).toBe("ฟิ้ง เพื่อนสนิท");
    expect(mocks.profile).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("does not return a fetched name when a concurrent edit wins", async () => {
    mocks.race = true;
    expect((await loadFriendNames(group)).names).toEqual([]);
  });
  it("keeps the form usable on a LINE failure without writing a guessed name", async () => {
    mocks.profile.mockRejectedValue(new Error("unavailable"));
    expect(await loadFriendNames(group)).toMatchObject({ names: [], message: expect.stringContaining("ยังไม่มีชื่อ") });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("identifies the owner by LINE ID even before a name is loaded", () => {
    expect(friendName({ ...mocks.friends[0], group_id: group, blocked: false }, { display_name: "ปีโป้", line_user_id: user })).toBe("ปีโป้ (ฉัน)");
  });
});

 describe("group member refresh", () => {
  it("requires admin and an enabled group before member enumeration", async () => {
    mocks.auth.mockRejectedValueOnce(new Error("unauthorized"));
    await expect(syncGroupFriends(group)).rejects.toThrow("unauthorized"); expect(mocks.ids).not.toHaveBeenCalled();
    mocks.enabled=false; expect((await syncGroupFriends(group)).ok).toBe(false); expect(mocks.ids).not.toHaveBeenCalled();
  });
  it("imports IDs without overwriting blocked state or existing names", async () => {
    expect((await syncGroupFriends(group)).message).toContain("1 คน");
    expect(mocks.upsert).toHaveBeenCalledWith([{group_id:group,line_user_id:user}],{onConflict:"group_id,line_user_id",ignoreDuplicates:true});
  });
  it("explains the unsupported full roster API while refreshing known names", async () => {
    mocks.ids.mockRejectedValue(new LineError(403)); const result=await syncGroupFriends(group);
    expect(result.ok).toBe(true); expect(result.message).toContain("ส่งข้อความหรือสติกเกอร์");
    expect(mocks.upsert).not.toHaveBeenCalled(); expect(mocks.profile).toHaveBeenCalled();
  });
  it("does not claim a successful refresh on a LINE outage", async () => {
    mocks.ids.mockRejectedValue(new LineError(503)); expect((await syncGroupFriends(group)).ok).toBe(false);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
 });
