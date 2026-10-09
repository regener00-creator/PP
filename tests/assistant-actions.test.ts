import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  allowed: vi.fn(),
  reply: vi.fn(),
  confirm: vi.fn(),
  cancel: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  filters: [] as [string, unknown][],
}));
vi.mock("../src/lib/auth", () => ({ requireAdmin: mocks.auth }));
vi.mock("../src/lib/assistant", () => ({
  assistantAllowed: mocks.allowed,
  assistantReply: mocks.reply,
  confirmAssistant: mocks.confirm,
  cancelAssistant: mocks.cancel,
}));
vi.mock("../src/lib/db", () => ({
  database: () => ({ from: mocks.from, rpc: mocks.rpc }),
  dbError: (e: unknown) => {
    if (e) throw Error("db");
  },
}));
import {
  webScope,
  chatWithAssistant,
  confirmChat,
  cancelChat,
  deleteAssistantRecord,
} from "../src/app/admin/chat/actions";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { revalidatePath } from "next/cache";
const sender = `U${"a".repeat(32)}`,
  group = `C${"b".repeat(32)}`;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.filters = [];
  mocks.auth.mockResolvedValue({ id: crypto.randomUUID() });
  mocks.allowed.mockResolvedValue(true);
  mocks.reply.mockResolvedValue({ text: "สวัสดี" });
  mocks.confirm.mockResolvedValue({ text: "saved", saved: true });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.from.mockImplementation(() => {
    const q = {
      select: () => q,
      delete: () => q,
      eq: (k: string, v: unknown) => {
        mocks.filters.push([k, v]);
        return q;
      },
      single: () => q,
      then: (resolve: (v: unknown) => void) =>
        resolve({ data: { line_user_id: sender }, error: null }),
    };
    return q;
  });
});
it("every public secretary action authenticates before touching data", async () => {
  mocks.auth.mockRejectedValue(Error("denied"));
  const form = new FormData();
  for (const call of [
    () => webScope(),
    () => chatWithAssistant({}),
    () => confirmChat(crypto.randomUUID(), null),
    () => cancelChat(crypto.randomUUID(), null),
    () => deleteAssistantRecord(form),
  ])
    await expect(call()).rejects.toThrow("denied");
  expect(mocks.from).not.toHaveBeenCalled();
  expect(mocks.reply).not.toHaveBeenCalled();
});
it("the current owner's identity is derived server-side, never from payload", async () => {
  const input = {
    question: "สวัสดี",
    requestId: crypto.randomUUID(),
    group: null,
    sender: "ATTACKER",
  };
  await chatWithAssistant(input);
  expect(mocks.reply).toHaveBeenCalledWith(
    "สวัสดี",
    { sender, group: null, web: true },
    input.requestId,
  );
});
it("rejects a disabled/unauthorized group and cannot call the model", async () => {
  mocks.allowed.mockResolvedValue(false);
  await expect(webScope(group)).rejects.toThrow("denied");
  expect(mocks.reply).not.toHaveBeenCalled();
});
it("deletion binds both the id and the authorized notebook scope", async () => {
  const form = new FormData(),
    id = crypto.randomUUID();
  form.set("id", id);
  form.set("kind", "note");
  await deleteAssistantRecord(form);
  expect(mocks.filters).toContainEqual(["id", id]);
  expect(mocks.filters).toContainEqual(["scope_key", sender]);
});
it("invalid and rate-limited requests never reach generation", async () => {
  await chatWithAssistant({
    question: "x".repeat(2001),
    requestId: crypto.randomUUID(),
    group: null,
  });
  expect(mocks.reply).not.toHaveBeenCalled();
  mocks.rpc.mockResolvedValue({ data: false, error: null });
  await chatWithAssistant({
    question: "hi",
    requestId: crypto.randomUUID(),
    group: null,
  });
  expect(mocks.reply).not.toHaveBeenCalled();
});
it("refreshes Memory after button confirmation and a saved text reply", async () => {
  await confirmChat(crypto.randomUUID(), null);
  expect(revalidatePath).toHaveBeenCalledWith("/admin");
  vi.mocked(revalidatePath).mockClear();
  mocks.reply.mockResolvedValue({ text: "saved", saved: true });
  await chatWithAssistant({ question: "ยืนยัน", requestId: crypto.randomUUID(), group: null });
  expect(revalidatePath).toHaveBeenCalledWith("/admin");
});
