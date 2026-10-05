import { describe, it, expect } from "vitest";
import {
  builtinPatterns,
  truncateIdeaText,
  freeCandidates,
  normalizedIdea,
  reusablePatternSchema,
  type LearnedPattern,
} from "../src/lib/planner-templates";
import type { Brief, Source } from "../src/lib/planner-types";
const brief: Brief = {
  topic: "ถุงกระดาษ",
  brand_id: null,
  source_ids: [],
  audience: "ร้านกาแฟ",
  goal: "ให้ความรู้",
  channel: "TikTok",
  pillar: "",
  format: "",
  variation: 0,
};
const source = (id: string, kind: Source["kind"], title: string): Source => ({
  id,
  brand_id: "brand",
  kind,
  title,
  content: "ข้อเท็จจริง",
  start_date: null,
  end_date: null,
  updated_at: "rev",
});
const learned: LearnedPattern = {
  id: "learned",
  title: "สิ่งที่ต้องเตรียมก่อนเลือก{subject}",
  hook: "ชวน{audience}มาเตรียมตัว",
  angle: "เติมข้อเท็จจริงปัจจุบันก่อนเผยแพร่",
  cta: "ฝากคำถามไว้",
  format: "แนะนำสินค้า",
  enabled: true,
  generation_id: "g",
  source_ids: [],
};
describe("free reusable content engine", () => {
  it("has 56 distinct structures and a broad mix without inventing cases", () => {
    expect(builtinPatterns).toHaveLength(56);
    const c = freeCandidates(brief, [], [], "2026-10-02");
    expect(c).toHaveLength(48);
    expect(new Set(c.map((v) => normalizedIdea(v.idea.title))).size).toBe(48);
    expect(new Set(c.slice(0, 5).map((v) => v.idea.format)).size).toBe(5);
    expect(c.some((v) => v.idea.format === "เล่าเคส")).toBe(false);
  });
  it("uses the requested product, never silently selects an unrelated first SKU", () => {
    const sources = [
      source("1", "product", "สมุดปกผ้า"),
      source("2", "product", "ถุงกระดาษ"),
    ];
    const c = freeCandidates(brief, sources, [], "2026-10-02");
    expect(c.every((v) => v.idea.title.includes("ถุงกระดาษ"))).toBe(true);
  });
  it("respects format filters instead of relabeling other stories", () => {
    const c = freeCandidates(
      { ...brief, format: "วิธีใช้" },
      [source("q", "question", "ถุงกระดาษใช้ยังไง")],
      [],
      "2026-10-02",
    );
    expect(c.length).toBeGreaterThan(5);
    expect(c.every((v) => v.idea.format === "วิธีใช้")).toBe(true);
  });
  it("reuses learned structures without facts from the original product", () => {
    const c = freeCandidates(brief, [], [learned], "2026-10-02");
    const idea = c.find((v) => v.idea.origin === "ต่อยอดจาก Gemini")!.idea;
    expect(idea.title).toContain("ถุงกระดาษ");
    expect(idea.hook).toContain("ร้านกาแฟ");
    expect(idea.title).not.toContain("{");
  });
  it("respects disabled patterns and unavailable or expired source dependencies", () => {
    expect(
      freeCandidates(
        brief,
        [],
        [{ ...learned, enabled: false }],
        "2026-10-02",
      ).some((v) => v.idea.pattern_id === "learned"),
    ).toBe(false);
    const campaign = {
      ...source("old", "campaign", "ถุงกระดาษ"),
      end_date: "2026-10-01",
    };
    expect(
      freeCandidates(
        brief,
        [campaign],
        [{ ...learned, source_ids: ["old"] }],
        "2026-10-02",
      ).some((v) => v.idea.pattern_id === "learned"),
    ).toBe(false);
  });
  it("only includes case structures with a selected or relevant actual case", () => {
    const c = freeCandidates(
      { ...brief, format: "เล่าเคส" },
      [source("case", "case", "ถุงกระดาษร้านกาแฟ")],
      [],
      "2026-10-02",
    );
    expect(c).toHaveLength(8);
  });
  it("rejects unsupported template placeholders", () => {
    expect(
      reusablePatternSchema.safeParse({ ...learned, title: "เรื่อง{unknown}" })
        .success,
    ).toBe(false);
    expect(
      reusablePatternSchema.safeParse({ ...learned, hook: "ราคา {price}" })
        .success,
    ).toBe(false);
  });
  it("uses stable concept keys independent of page reload, platform or random variation", () => {
    const a = freeCandidates(brief, [], [], "2026-10-02");
    const b = freeCandidates(
      { ...brief, channel: "Facebook", variation: 9 },
      [],
      [],
      "2026-10-02",
    );
    expect(a.map((v) => v.key)).toEqual(b.map((v) => v.key));
  });
});

it("mixes story formats across multiple selected products without dropping combinations", () => {
  const sources = [
    source("1", "product", "สมุด"),
    source("2", "product", "ถุงกระดาษ"),
  ];
  const candidates = freeCandidates(
    { ...brief, source_ids: ["1", "2"] },
    sources,
    [],
    "2026-10-02",
  );
  expect(candidates).toHaveLength(96);
  expect(new Set(candidates.map((c) => c.key)).size).toBe(96);
  expect(new Set(candidates.slice(0, 5).map((c) => c.idea.format)).size).toBe(
    5,
  );
});

it("keeps complete emoji and Thai graphemes within every text limit", () => {
  expect(truncateIdeaText("ก".repeat(74) + "🆓", 75)).toBe("ก".repeat(74));
  expect(truncateIdeaText("A👨‍👩‍👧‍👦B", 5)).toBe("A");
  expect(truncateIdeaText("ก้าข", 1)).toBe("");
  expect(truncateIdeaText("ก้าข", 3)).toBe("ก้า");
  expect(truncateIdeaText("ก".repeat(73) + "🆓", 75)).toBe(
    "ก".repeat(73) + "🆓",
  );
});
