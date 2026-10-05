import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ insert: vi.fn(), upload: vi.fn(), remove: vi.fn(), db: vi.fn() }));
vi.mock("../src/lib/auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("../src/lib/db", () => ({ database: state.db, dbError: (error: unknown) => { if (error) throw Error("db failed"); } }));
import { requireAdmin } from "../src/lib/auth";
import { POST } from "../src/app/api/files/route";
function request(visibility?: string, origin = "https://pp.example") {
  const body = new FormData(); body.set("file", new File(["approved file"], "test.txt"));
  if (visibility) body.set("visibility", visibility);
  return new Request("https://pp.example/api/files", { method: "POST", headers: { origin }, body });
}
describe("upload sharing defaults", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.mocked(requireAdmin).mockResolvedValue(undefined as never);
    state.insert.mockResolvedValue({ error: null }); state.upload.mockResolvedValue({ error: null }); state.remove.mockResolvedValue({ error: null });
    state.db.mockReturnValue({ from: () => ({ insert: state.insert }), storage: { from: () => ({ upload: state.upload, remove: state.remove }) } });
  });
  it("creates a shareable file when the new form has no visibility field", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(state.insert).toHaveBeenCalledWith(expect.objectContaining({ visibility: "shareable", name: "test.txt" }));
  });
  it.each(["private", "invalid"])("rejects stale/forged %s upload requests before storage", async value => {
    expect((await POST(request(value))).status).toBe(400); expect(state.db).not.toHaveBeenCalled();
  });
  it("requires an authenticated admin", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(Error("unauthorized"));
    await expect(POST(request())).rejects.toThrow("unauthorized"); expect(state.db).not.toHaveBeenCalled();
  });
  it("retains the same-origin check", async () => {
    expect((await POST(request(undefined, "https://other.example"))).status).toBe(403);
    expect(requireAdmin).not.toHaveBeenCalled(); expect(state.db).not.toHaveBeenCalled();
  });
});
