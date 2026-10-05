import { describe, expect, it } from "vitest";
import {
  defaultGoals,
  goalsSchema,
  resolveGoal,
} from "../src/lib/planner-goals";
import { freeCandidates } from "../src/lib/planner-templates";
import { ideaSchema, type Brief } from "../src/lib/planner-types";
const brief: Brief = {
  topic: "ถุงกระดาษ",
  brand_id: null,
  source_ids: [],
  audience: "ร้านกาแฟ",
  goal: "ให้ความรู้",
  channel: "Facebook",
  pillar: "",
  format: "",
  variation: 0,
};
describe("editable content goals", () => {
  it("rejects blank, duplicate and excessive goals but accepts custom Thai labels", () => {
    expect(goalsSchema.safeParse(defaultGoals).success).toBe(true);
    expect(goalsSchema.safeParse([]).success).toBe(false);
    expect(
      goalsSchema.safeParse([
        ...defaultGoals,
        { ...defaultGoals[0], id: "new", label: " สร้างการรับรู้ " },
      ]).success,
    ).toBe(false);
    expect(
      goalsSchema.safeParse([{ ...defaultGoals[0], label: " " }]).success,
    ).toBe(false);
    expect(
      goalsSchema.safeParse(
        Array.from({ length: 31 }, (_, i) => ({
          ...defaultGoals[0],
          id: "g-" + i,
          label: "เป้าหมาย " + i,
        })),
      ).success,
    ).toBe(false);
  });
  it("keeps selection identity when renamed and does not remap deleted IDs", () => {
    const renamed = defaultGoals.map((g) => ({
      ...g,
      label: g.label + "ใหม่",
    }));
    expect(
      resolveGoal({ goal: "สร้างการรับรู้", goal_id: "awareness" }, renamed)
        ?.label,
    ).toBe("สร้างการรับรู้ใหม่");
    expect(
      resolveGoal({ goal: "สร้างการรับรู้", goal_id: "deleted" }),
    ).toBeUndefined();
    expect(resolveGoal({ goal: "ให้ความรู้" })?.direction).toBe("education");
  });
  it("changes template priorities, angle and CTA without evading duplicate history", () => {
    const trust = freeCandidates(
      { ...brief, goal: "เพิ่มความเชื่อมั่น" },
      [],
      [],
      "2026-10-03",
    );
    const sales = freeCandidates(
      { ...brief, goal: "กระตุ้นยอดขาย" },
      [],
      [],
      "2026-10-03",
    );
    expect(trust[0].idea.format).toBe("เบื้องหลัง");
    expect(sales[0].idea.format).toBe("แนะนำสินค้า");
    expect(trust[0].idea.cta).not.toBe(sales[0].idea.cta);
    expect(trust[0].idea.angle).toContain("ไม่แต่งรีวิว");
    expect(new Set(trust.map((c) => c.key))).toEqual(
      new Set(sales.map((c) => c.key)),
    );
    expect(new Set(trust.slice(0, 5).map((c) => c.idea.format)).size).toBe(5);
  });
  it("uses custom CTA and respects explicit format, case availability and output limits", () => {
    const goal = {
      ...defaultGoals[4],
      id: "custom",
      label: "ให้ลูกค้าทัก LINE",
      cta: "ทัก LINE @noosol เพื่อขอราคา",
    };
    const candidates = freeCandidates(
      { ...brief, format: "วิธีใช้" },
      [],
      [],
      "2026-10-03",
      goal,
    );
    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) {
      expect(c.idea.cta).toBe(goal.cta);
      expect(c.idea.format).toBe("วิธีใช้");
      expect(ideaSchema.safeParse(c.idea).success).toBe(true);
    }
  });
});
