import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ auth: vi.fn(), scope: vi.fn(), from: vi.fn(), refresh: vi.fn() }));
vi.mock("../src/lib/auth", () => ({ requireAdmin: mock.auth }));
vi.mock("../src/lib/assistant-admin", () => ({ adminAssistantScope: mock.scope }));
vi.mock("next/cache", () => ({ revalidatePath: mock.refresh }));
vi.mock("../src/lib/db", () => ({ database: () => ({ from: mock.from }), dbError: (e: unknown) => { if(e) throw Error("db"); } }));
import { saveAssistantNote, deleteAssistantNote } from "../src/app/admin/assistant-note-actions";
const owner = `U${"a".repeat(32)}`, friend = `U${"b".repeat(32)}`, group = `C${"c".repeat(32)}`;
let row: Record<string, unknown> | null;
const initial = { ok: false, message: "" };
function form() {
  const f = new FormData();
  for (const [k,v] of Object.entries({ id: String(row!.id), updated_at: String(row!.updated_at), title: "กาแฟ", content: "หวานน้อย" })) f.set(k,v);
  return f;
}
beforeEach(() => {
  vi.clearAllMocks();
  row = { id: crypto.randomUUID(), scope_key: owner, sender_id: owner, title: "เดิม", content: "ไม่หวาน", updated_at: "2026-10-09T01:00:00.123456+00:00" };
  mock.auth.mockResolvedValue({ id: "admin" });
  mock.scope.mockImplementation(async g => ({ sender: owner, group: g }));
  mock.from.mockImplementation(() => {
    let changes: Record<string, unknown> | undefined, remove = false;
    const filters: [string, unknown][] = [];
    const q = {
      update: (v: Record<string, unknown>) => { changes = v; return q; }, delete: () => { remove = true; return q; },
      eq: (k: string,v: unknown) => { filters.push([k,v]); return q; }, select: () => q,
      maybeSingle: async () => {
        if (!row || !filters.every(([k,v]) => row![k] === v)) return { data: null, error: null };
        const id = row.id;
        if (remove) row = null; else Object.assign(row,changes);
        return { data: { id }, error: null };
      },
    };
    return q;
  });
});
it("authenticates both actions before database access", async () => {
  mock.auth.mockRejectedValue(Error("denied"));
  await expect(saveAssistantNote(initial,form())).rejects.toThrow("denied");
  await expect(deleteAssistantNote(initial,form())).rejects.toThrow("denied");
  expect(mock.from).not.toHaveBeenCalled();
});
it("edits the original note, keeping identity and scope regardless of injected fields", async () => {
  const id = row!.id;
  const f = form(); f.set("scope_key",friend); f.set("sender_id",friend);
  expect((await saveAssistantNote(initial,f)).ok).toBe(true);
  expect(row).toMatchObject({ id, title: "กาแฟ", content: "หวานน้อย", scope_key: owner, sender_id: owner });
  expect(row!.updated_at).not.toBe(f.get("updated_at"));
  expect(mock.from).toHaveBeenCalledWith("assistant_notes");
  expect(mock.refresh).toHaveBeenCalledWith("/admin");
});
it("cannot edit or delete another person's DM by guessing their record id", async () => {
  row!.scope_key = friend;
  expect((await saveAssistantNote(initial,form())).ok).toBe(false);
  expect((await deleteAssistantNote(initial,form())).ok).toBe(false);
  expect(row!.content).toBe("ไม่หวาน");
  expect(mock.refresh).not.toHaveBeenCalled();
});
it("rechecks group permissions and rejects revoked access without mutation", async () => {
  row!.scope_key = group;
  const f = form(); f.set("group",group);
  mock.scope.mockRejectedValue(Error("denied"));
  expect((await saveAssistantNote(initial,f)).ok).toBe(false);
  expect((await deleteAssistantNote(initial,f)).ok).toBe(false);
  expect(mock.from).not.toHaveBeenCalled();
});
it("deletes only the selected authorized group note", async () => {
  row!.scope_key = group;
  const f = form(); f.set("group",group);
  expect((await deleteAssistantNote(initial,f)).ok).toBe(true);
  expect(row).toBeNull();
  expect(mock.scope).toHaveBeenCalledWith(group);
});
it("stale editors cannot overwrite or delete a newer version", async () => {
  const f = form(); row!.updated_at = "2026-10-09T02:00:00+00:00";
  expect((await saveAssistantNote(initial,f)).ok).toBe(false);
  expect((await deleteAssistantNote(initial,f)).ok).toBe(false);
  expect(row!.content).toBe("ไม่หวาน");
  expect(mock.refresh).not.toHaveBeenCalled();
});
it("validates blank/oversize content, timestamps and arbitrary scopes", async () => {
  for (const [key,value] of [["content"," "],["content","a".repeat(2001)],["title","a".repeat(121)],["updated_at","bad"],["group",friend],["id","bad"]]) {
    const f = form(); f.set(key,value);
    expect((await saveAssistantNote(initial,f)).ok).toBe(false);
  }
  expect(mock.from).not.toHaveBeenCalled();
});
it("reports missing or failed records without claiming success", async () => {
  const f = form(); f.set("id",crypto.randomUUID());
  expect((await saveAssistantNote(initial,f)).ok).toBe(false);
  expect((await deleteAssistantNote(initial,f)).ok).toBe(false);
  mock.from.mockImplementation(() => { throw Error("db"); });
  expect((await saveAssistantNote(initial,form())).ok).toBe(false);
  expect((await deleteAssistantNote(initial,form())).ok).toBe(false);
});
