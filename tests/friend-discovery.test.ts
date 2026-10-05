import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), upsert: vi.fn(), profile: vi.fn(), update: vi.fn(), filters: vi.fn(),
  enabled: true as boolean | null, inserted: [] as { id: string; line_user_id: string; display_name: string; blocked: boolean }[] }));
vi.mock("@/lib/db", () => ({ database: () => ({ from: mocks.from }), dbError: (error: unknown) => { if (error) throw error; } }));
vi.mock("@/lib/line", async original => ({ ...await original<typeof import("@/lib/line")>(), getGroupMemberName: mocks.profile }));
import { discoverGroupFriends } from "@/lib/friend-discovery";
const group = "C" + "1".repeat(32), user = "U" + "1".repeat(32), bot = "U" + "2".repeat(32);
const message = (type = "text") => ({ type: "message", source: { type: "group", groupId: group, userId: user }, message: { id: "1", type, text: "ข้อมูลที่ห้ามเก็บ", contentProvider: { originalContentUrl: "https://example.com/private" } } });
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("LINE_CHANNEL_ACCESS_TOKEN", "test-only"); mocks.enabled = true;
  mocks.inserted = [{ id: "friend", line_user_id: user, display_name: "", blocked: false }];
  mocks.profile.mockResolvedValue("ฟิ้ง");
  mocks.upsert.mockImplementation(() => ({ select: async () => ({ data: mocks.inserted, error: null }) }));
  mocks.from.mockImplementation(table => {
    if (table === "permissions") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mocks.enabled === null ? null : { enabled: mocks.enabled }, error: null }) }) }) };
    if (table !== "friends") throw new Error("Unexpected table");
    const write = { eq: (key: string, value: unknown) => { mocks.filters(key, value); return write; }, then: (resolve: (result: unknown) => void) => resolve({ error: null }) };
    return { upsert: mocks.upsert, update: (value: unknown) => { mocks.update(value); return write; } };
  });
});
describe("directory discovery from verified group events", () => {
  it.each(["text", "sticker", "image"])("learns a sender from %s without storing message contents", async type => {
    await discoverGroupFriends(message(type), bot);
    expect(mocks.upsert).toHaveBeenCalledWith([{ group_id: group, line_user_id: user }], { onConflict: "group_id,line_user_id", ignoreDuplicates: true });
    expect(mocks.update).toHaveBeenCalledWith({ display_name: "ฟิ้ง" });
    expect(mocks.filters.mock.calls).toEqual([["id", "friend"], ["group_id", group], ["blocked", false], ["display_name", ""]]);
  });
  it.each([false, null])("never registers members of a disabled or undiscovered group: %s", async enabled => {
    mocks.enabled = enabled; await discoverGroupFriends(message(), bot);
    expect(mocks.upsert).not.toHaveBeenCalled(); expect(mocks.profile).not.toHaveBeenCalled();
  });
  it("ignores direct chats, standby, missing identity and the bot itself", async () => {
    await discoverGroupFriends({ ...message(), source: { type: "user", userId: user } }, bot);
    await discoverGroupFriends({ ...message(), mode: "standby" }, bot);
    await discoverGroupFriends({ ...message(), source: { type: "group", groupId: group } }, bot);
    await discoverGroupFriends(message(), user);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("deduplicates member joins and excludes the bot", async () => {
    await discoverGroupFriends({ type: "memberJoined", source: { type: "group", groupId: group }, joined: { members: [user, user, bot].map(userId => ({ type: "user", userId })) } }, bot);
    expect(mocks.upsert.mock.calls[0][0]).toEqual([{ group_id: group, line_user_id: user }]);
  });
  it("does not overwrite existing names or unblock existing members", async () => {
    mocks.inserted = []; await discoverGroupFriends(message(), bot);
    expect(mocks.profile).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("keeps the discovered identity when profile lookup fails", async () => {
    mocks.profile.mockRejectedValue(new Error("unavailable"));
    await expect(discoverGroupFriends(message(), bot)).resolves.toBeUndefined();
    expect(mocks.upsert).toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
  });
});
