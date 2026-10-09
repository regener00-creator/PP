import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ auth: vi.fn(), allowed: vi.fn(), from: vi.fn() }));
vi.mock("../src/lib/auth", () => ({ requireAdmin: mock.auth }));
vi.mock("../src/lib/assistant", () => ({ assistantAllowed: mock.allowed }));
vi.mock("../src/lib/db", () => ({ database: () => ({ from: mock.from }), dbError: (e: unknown) => { if(e) throw Error("db"); } }));
import { adminAssistantNotes } from "../src/lib/assistant-notes";
const owner = `U${"a".repeat(32)}`, friend = `U${"b".repeat(32)}`;
const group = `C${"a".repeat(32)}`, denied = `C${"b".repeat(32)}`, disabled = `C${"c".repeat(32)}`;
let tables: Record<string, Record<string, unknown>[]>;
const reads: [string, string, unknown][] = [];
beforeEach(() => {
  vi.clearAllMocks(); reads.length = 0;
  mock.auth.mockResolvedValue({ id: "admin" });
  mock.allowed.mockImplementation(async s => s.group !== denied);
  tables = {
    owner: [{ id: 1, line_user_id: owner }],
    permissions: [{ group_id: group, label: "โจอา", enabled: true }, { group_id: denied, label: "denied", enabled: true }, { group_id: disabled, enabled: false }],
    assistant_notes: [owner, friend, group, denied, disabled].map(scope => ({ id: crypto.randomUUID(), scope_key: scope, title: "กาแฟ", content: scope === friend ? "PRIVATE FRIEND" : "ไม่หวาน", updated_at: "2026-10-09T01:00:00+00:00" })),
  };
  mock.from.mockImplementation((table: string) => {
    let rows = tables[table] || [], single = false, columns: string[] = [];
    const q = {
      select: (s: string) => { columns = s.split(","); return q; }, order: () => q,
      eq: (k: string, v: unknown) => { reads.push([table,k,v]); rows = rows.filter(r => r[k] === v); return q; },
      limit: (n: number) => { rows = rows.slice(0,n); return q; },
      single: () => { single = true; return q; },
      then: (resolve: (r: unknown) => void) => {
        const data = rows.map(r => Object.fromEntries(columns.map(c => [c,r[c]])));
        resolve({ data: single ? data[0] : data, error: null });
      },
    };
    return q;
  });
});
it("requires admin before reading notebooks", async () => {
  mock.auth.mockRejectedValue(Error("denied"));
  await expect(adminAssistantNotes()).rejects.toThrow("denied");
  expect(mock.from).not.toHaveBeenCalled();
});
it("shows only owner DM and allowed groups with readable origin labels", async () => {
  const result = await adminAssistantNotes();
  expect(result).toHaveLength(2);
  expect(result.map(n => [n.group,n.sourceLabel])).toEqual([[null,"แชตส่วนตัวของฉัน"],[group,"กลุ่ม โจอา"]]);
  expect(reads.filter(r => r[0] === "assistant_notes")).toEqual([["assistant_notes","scope_key",owner],["assistant_notes","scope_key",group]]);
  expect(JSON.stringify(result)).not.toContain("PRIVATE FRIEND");
  expect(JSON.stringify(result)).not.toContain(owner);
});
it("does not guess an owner or read other private notebooks when owner is unset", async () => {
  tables.owner[0].line_user_id = null;
  expect(await adminAssistantNotes()).toEqual([]);
  expect(mock.from).not.toHaveBeenCalledWith("assistant_notes");
});
it("reads changes and deletions from the original table, without copying into manual memories", async () => {
  tables.assistant_notes[0].content = "หวานน้อย";
  expect((await adminAssistantNotes())[0].content).toBe("หวานน้อย");
  tables.assistant_notes.shift();
  expect(await adminAssistantNotes()).toHaveLength(1);
  expect(mock.from).not.toHaveBeenCalledWith("memories");
});
it("fails closed when permission checking fails", async () => {
  mock.allowed.mockRejectedValue(Error("db"));
  await expect(adminAssistantNotes()).rejects.toThrow("db");
  expect(mock.from).not.toHaveBeenCalledWith("assistant_notes");
});
