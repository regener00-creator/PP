import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../src/lib/auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("../src/lib/db", () => ({ database: vi.fn(), dbError: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { requireAdmin } from "../src/lib/auth";
import { database } from "../src/lib/db";
import { saveMemory, deleteMemory, saveOwner, saveUnknownReply, savePermission, saveFriend } from "../src/app/admin/actions";
import { checkGemini } from "../src/app/admin/ai-actions";
import { saveFolder,deleteFolder,saveFile,deleteFile,saveCalendarEvent,deleteCalendarEvent } from "../src/app/admin/workspace-actions";
const empty = { ok: false, message: "" };
describe("admin write authorization", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(requireAdmin).mockRejectedValue(new Error("unauthorized")); });
  it.each([
    () => saveMemory(empty, new FormData()),
    () => deleteMemory(new FormData()),
    () => saveOwner(empty, new FormData()),
    () => saveUnknownReply(empty, new FormData()),
    () => savePermission(empty, new FormData()),
    () => saveFriend(new FormData()),
    () => checkGemini(),
    ...[saveFolder,deleteFolder,saveFile,deleteFile,saveCalendarEvent,deleteCalendarEvent].map(action=>()=>action(empty,new FormData()))
  ])("rejects unauthenticated writes before any database access", async action => { await expect(action()).rejects.toThrow("unauthorized"); expect(database).not.toHaveBeenCalled(); });
});

describe("unknown reply settings", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(requireAdmin).mockResolvedValue(undefined as never); });
  it.each(["", " \n ", "ก".repeat(2001)])("rejects blank or oversized replies before a write", async value => {
    const form = new FormData(); form.append("unknown_replies", value);
    expect((await saveUnknownReply(empty, form)).ok).toBe(false);
    expect(database).not.toHaveBeenCalled();
  });
  it.each([0, 21])("rejects an invalid number of alternatives: %s", async count => {
    const form = new FormData(); for (let i = 0; i < count; i++) form.append("unknown_replies", "ยังไม่ทราบ");
    expect((await saveUnknownReply(empty, form)).ok).toBe(false); expect(database).not.toHaveBeenCalled();
  });
  it("saves multiple multiline alternatives without accepting owner identity fields", async () => {
    const update = vi.fn(), eq = vi.fn();
    const query = { update, eq, select: () => query, single: async () => ({ data: { id: 1 }, error: null }) };
    update.mockReturnValue(query); eq.mockReturnValue(query);
    vi.mocked(database).mockReturnValue({ from: () => query } as never);
    const form = new FormData(); form.append("unknown_replies", "  ยังไม่ทราบครับ\nลองถามเรื่องอื่นได้เลย  ");
    form.append("unknown_replies", "  โจอายังไม่มีข้อมูลนี้  ");
    form.set("id", "2"); form.set("line_user_id", "forged-owner");
    expect((await saveUnknownReply(empty, form)).ok).toBe(true);
    expect(update).toHaveBeenCalledWith({ unknown_reply: "ยังไม่ทราบครับ\nลองถามเรื่องอื่นได้เลย", unknown_replies: ["ยังไม่ทราบครับ\nลองถามเรื่องอื่นได้เลย", "โจอายังไม่มีข้อมูลนี้"] });
    expect(eq).toHaveBeenCalledWith("id", 1);
  });
});

describe("memory mention preference", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(requireAdmin).mockResolvedValue(undefined as never); });
  it.each([true, false])("saves the explicit checkbox preference: %s", async enabled => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(database).mockReturnValue({ from: () => ({ insert }) } as never);
    const form = new FormData();
    for (const [key, value] of Object.entries({ title: "ทดสอบ", content: "มาตอบ", aliases: "ทดสอบ", visibility: "shareable" })) form.set(key, value);
    if (enabled) form.set("mention_owner", "on");
    expect(await saveMemory(empty, form)).toEqual({ ok: true, message: "บันทึกความจำแล้ว" });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ mention_owner: enabled, content: "มาตอบ" }));
  });
});

describe("sharing defaults without changing old record permissions", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(requireAdmin).mockResolvedValue(undefined as never); });
  const formForMemory = () => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ title: "สินค้า", content: "รหัสสินค้า JOAH-01", aliases: "ขอรหัสสินค้า" })) form.set(key, value);
    return form;
  };
  it("creates shareable memories without a visibility field", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(database).mockReturnValue({ from: () => ({ insert }) } as never);
    expect((await saveMemory(empty, formForMemory())).ok).toBe(true);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ visibility: "shareable", content: "รหัสสินค้า JOAH-01" }));
  });
  it("rejects a stale private form instead of publishing it", async () => {
    const form = formForMemory(); form.set("visibility", "private");
    expect((await saveMemory(empty, form)).ok).toBe(false); expect(database).not.toHaveBeenCalled();
  });
  it("does not overwrite legacy visibility when editing a memory", async () => {
    const update = vi.fn().mockReturnValue({ eq: async () => ({ error: null }) });
    vi.mocked(database).mockReturnValue({ from: () => ({ update }) } as never);
    const form = formForMemory(); form.set("id", "550e8400-e29b-41d4-a716-446655440000");
    expect((await saveMemory(empty, form)).ok).toBe(true);
    expect(update.mock.calls[0][0]).not.toHaveProperty("visibility");
  });
  it("edits file metadata without accepting a forged visibility change", async () => {
    const update = vi.fn().mockReturnValue({ eq: async () => ({ error: null }) });
    vi.mocked(database).mockReturnValue({ from: () => ({ update }) } as never);
    const form = new FormData(); form.set("id", "550e8400-e29b-41d4-a716-446655440000"); form.set("name", "photo.jpg"); form.set("visibility", "shareable");
    expect((await saveFile(empty, form)).ok).toBe(true);
    expect(update).toHaveBeenCalledWith({ name: "photo.jpg", folder_id: null });
  });
});
