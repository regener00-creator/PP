import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../src/lib/auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("../src/lib/db", () => ({ database: vi.fn(), dbError: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { requireAdmin } from "../src/lib/auth";
import { database } from "../src/lib/db";
import { saveMemory, deleteMemory, saveOwner, savePermission, saveFriend } from "../src/app/admin/actions";
const empty = { ok: false, message: "" };
describe("admin write authorization", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(requireAdmin).mockRejectedValue(new Error("unauthorized")); });
  it.each([
    () => saveMemory(empty, new FormData()),
    () => deleteMemory(new FormData()),
    () => saveOwner(empty, new FormData()),
    () => savePermission(empty, new FormData()),
    () => saveFriend(new FormData())
  ])("rejects unauthenticated writes before any database access", async action => { await expect(action()).rejects.toThrow("unauthorized"); expect(database).not.toHaveBeenCalled(); });
});
