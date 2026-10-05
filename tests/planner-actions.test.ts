import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  db: vi.fn(),
  generate: vi.fn(),
  model: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("../src/lib/auth", () => ({ requireAdmin: mocks.admin }));
vi.mock("../src/lib/db", () => ({
  database: mocks.db,
  dbError: (e: unknown) => {
    if (e) throw Error("database");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("ai", () => ({
  generateText: mocks.generate,
  Output: { object: (x: unknown) => x },
}));
vi.mock("../src/lib/google-model", () => ({ googleModel: mocks.model }));
vi.mock("../src/lib/planner-data", () => ({ plannerCatalog: vi.fn() }));
import {
  savePlannerBrand,
  savePlannerSource,
  deletePlannerSource,
  saveContentItem,
  moveContentItem,
  createPlannerGeneration,
  keepPlannerIdea,
  loadContentItem,
  loadPlannerPatterns,
  setPlannerPatternEnabled,
  deleteArchivedContent,
  deleteUnusedBrand,
} from "../src/app/planner/actions";
import { generatePlanner } from "../src/lib/planner-ai";
const id = "0c00c4ea-aee5-41b5-aacb-cfddc431e458",
  initial = { ok: false, message: "" };
describe("planner authorization and AI budget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.mockReturnValue({ rpc: mocks.rpc });
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    mocks.admin.mockResolvedValue(undefined);
    vi.stubEnv("AI_ENABLED", "true");
    vi.stubEnv("GOOGLE_VERTEX_API_KEY", "test");
  });
  afterEach(() => vi.unstubAllEnvs());
  it.each([
    () => savePlannerBrand(initial, new FormData()),
    () => savePlannerSource(initial, new FormData()),
    () => deletePlannerSource(id, "revision"),
    () => saveContentItem({}, id, null),
    () => moveContentItem(id, "revision", {}),
    () => createPlannerGeneration({}, id, "ai"),
    () => keepPlannerIdea(id, 0),
    () => loadContentItem(id),
    () => loadPlannerPatterns(null),
    () => setPlannerPatternEnabled(id, true),
    () => deleteArchivedContent(id, "revision"),
    () => deleteUnusedBrand(id, "revision"),
  ])(
    "requires the owner session before any privileged access",
    async (action) => {
      mocks.admin.mockRejectedValue(Error("unauthorized"));
      await expect(action()).rejects.toThrow("unauthorized");
      expect(mocks.db).not.toHaveBeenCalled();
      expect(mocks.generate).not.toHaveBeenCalled();
    },
  );
  it("does not call Google without a reserved shared monthly slot", async () => {
    mocks.rpc.mockImplementation(async (name: string) => ({
      data: name !== "pp_reserve_ai",
      error: null,
    }));
    await expect(generatePlanner("ideas", { topic: "test" })).rejects.toThrow(
      "โควตา AI",
    );
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("rejects oversized input before quota or model use", async () => {
    await expect(
      generatePlanner("ideas", { topic: "x".repeat(65000) }),
    ).rejects.toThrow("ข้อมูลมาก");
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("honors a disabled AI configuration", async () => {
    vi.stubEnv("AI_ENABLED", "false");
    await expect(generatePlanner("draft", {})).rejects.toThrow("Gemini");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects arbitrary patch columns, unsafe title and invalid ids before writes", async () => {
    expect(
      (await moveContentItem(id, "revision", { notify_owner: true })).ok,
    ).toBe(false);
    expect((await saveContentItem({}, id, null)).ok).toBe(false);
    expect((await keepPlannerIdea("bad", 9)).ok).toBe(false);
    expect(mocks.db).not.toHaveBeenCalled();
  });
});

it("stores a generated idea without generation-only metadata or enabling LINE", async () => {
  mocks.admin.mockResolvedValue(undefined);
  const insert = vi
    .fn()
    .mockReturnValue({
      select: () => ({ single: async () => ({ data: { id }, error: null }) }),
    });
  const eq = vi.fn().mockReturnThis();
  const builder = {
    eq,
    select: vi.fn().mockReturnThis(),
    single: async () => ({
      data: {
        request: { brief: { channel: "TikTok", brand_id: null } },
        result: {
          ideas: [
            {
              title: "สินค้า",
              hook: "ลองดู",
              angle: "ขั้นตอน",
              cta: "ถามเพิ่ม",
              format: "วิธีใช้",
              pillar: "ความรู้",
              origin: "ต่อยอดจาก Gemini",
              pattern_id: "pattern-1",
            },
          ],
        },
      },
      error: null,
    }),
    maybeSingle: async () => ({ data: null, error: null }),
    insert,
  };
  eq.mockReturnValue(builder);
  mocks.db.mockReturnValue({ from: () => builder });
  expect((await keepPlannerIdea(id, 0)).ok).toBe(true);
  expect(insert).toHaveBeenCalledWith(
    expect.objectContaining({
      title: "สินค้า",
      notify_owner: false,
      group_id: null,
    }),
  );
  expect(insert.mock.calls[0][0]).not.toHaveProperty("origin");
  expect(insert.mock.calls[0][0]).not.toHaveProperty("pattern_id");
});
