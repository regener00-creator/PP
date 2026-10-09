import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), allowed: vi.fn(), reply: vi.fn(), confirm: vi.fn(), cancel: vi.fn(), from: vi.fn(), rpc: vi.fn() }));
vi.mock("../src/lib/auth", () => ({ requireAdmin: mocks.auth }));
vi.mock("../src/lib/assistant", () => ({ assistantAllowed: mocks.allowed, assistantReply: mocks.reply, confirmAssistant: mocks.confirm, cancelAssistant: mocks.cancel }));
vi.mock("../src/lib/db", () => ({ database: () => ({ from: mocks.from, rpc: mocks.rpc }), dbError: (e: unknown) => { if(e) throw Error("db"); } }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw Error(`redirect:${path}`); } }));
import * as actions from "../src/app/admin/chat/actions";
import { adminAssistantScope } from "../src/lib/assistant-admin";
import RetiredChat from "../src/app/admin/chat/page";
import Home from "../src/app/page";
import Workspace from "../src/app/workspace/page";
import manifest from "../src/app/manifest";
const sender = `U${"a".repeat(32)}`, group = `C${"b".repeat(32)}`;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ id: "admin-id" });
  mocks.allowed.mockResolvedValue(true);
  mocks.from.mockImplementation(() => {
    const q = { select: () => q, eq: () => q, single: async () => ({ data: { line_user_id: sender }, error: null }) };
    return q;
  });
});
it("stale web-chat actions authenticate and cannot call AI, confirm, cancel or delete stored data", async () => {
  for (const action of Object.values(actions)) {
    expect((await action({ question: "ยืนยัน", id: crypto.randomUUID() })).text).toContain("LINE");
  }
  expect(mocks.auth).toHaveBeenCalledTimes(4);
  for (const fn of [mocks.from,mocks.rpc,mocks.reply,mocks.confirm,mocks.cancel]) expect(fn).not.toHaveBeenCalled();
});
it("unauthenticated retired actions and calendar scope fail before accessing data", async () => {
  mocks.auth.mockRejectedValue(Error("denied"));
  for (const action of Object.values(actions)) await expect(action()).rejects.toThrow("denied");
  await expect(adminAssistantScope()).rejects.toThrow("denied");
  await expect(RetiredChat()).rejects.toThrow("denied");
  expect(mocks.from).not.toHaveBeenCalled();
});
it("calendar editing still derives the owner identity server-side and checks group access", async () => {
  expect(await adminAssistantScope(group)).toEqual({ sender,group,web:true });
  expect(mocks.allowed).toHaveBeenCalledWith({ sender,group,web:true });
  mocks.allowed.mockResolvedValue(false);
  await expect(adminAssistantScope(group)).rejects.toThrow("denied");
  expect(mocks.reply).not.toHaveBeenCalled();
});
it("old chat and workspace bookmarks redirect to Memory, and the installed app starts there", async () => {
  expect(() => Home()).toThrow("redirect:/admin");
  await expect(Workspace()).rejects.toThrow("redirect:/admin");
  await expect(RetiredChat()).rejects.toThrow("redirect:/admin");
  expect(manifest().start_url).toBe("/admin");
});
