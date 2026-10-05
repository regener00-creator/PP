import { describe, it, expect } from "vitest";
import {
  emptyItem,
  itemSchema,
  templateIdeas,
  briefSchema,
  dueContent,
  postingInstant,
  localPostingTime,
  performanceSummary,
  type ContentItem,
  type Source,
} from "../src/lib/planner-types";
const fixture = (data: Partial<ContentItem> = {}): ContentItem => ({
  ...emptyItem(),
  id: "0c00c4ea-aee5-41b5-aacb-cfddc431e458",
  title: "งาน",
  updated_at: "2026-10-02T00:00:00Z",
  created_at: "2026-10-02T00:00:00Z",
  generation_id: null,
  idea_index: null,
  archived: false,
  ...data,
});
describe("content planner boundaries", () => {
  it("round trips Thai posting time across the UTC day boundary", () => {
    const iso = postingInstant("2026-10-02T00:15");
    expect(iso).toBe("2026-10-01T17:15:00.000Z");
    expect(localPostingTime(iso)).toBe("2026-10-02T00:15");
  });
  it("handles tomorrow reminders across months and leap years, not yesterday", () => {
    const i = fixture({
      scheduled_at: postingInstant("2028-03-01T13:00"),
      remind_before: true,
    });
    expect(dueContent(i, "2028-02-29")).toEqual([1]);
    expect(dueContent(i, "2028-03-01")).toEqual([0]);
    expect(dueContent(i, "2028-03-02")).toEqual([]);
  });
  it("never reminds archived, posted or unscheduled work", () => {
    for (const patch of [
      { archived: true },
      { status: "posted" as const },
      { scheduled_at: null },
    ])
      expect(
        dueContent(
          fixture({
            scheduled_at: postingInstant("2026-10-02T12:00"),
            ...patch,
          }),
          "2026-10-02",
        ),
      ).toEqual([]);
  });
  it("requires schedule and a reminder day when LINE recipients are selected", () => {
    expect(
      itemSchema.safeParse({ ...emptyItem(), title: "x", notify_owner: true })
        .success,
    ).toBe(false);
    expect(
      itemSchema.safeParse({
        ...emptyItem(),
        title: "x",
        notify_owner: true,
        scheduled_at: postingInstant("2026-10-02T12:00"),
        remind_day: false,
      }).success,
    ).toBe(false);
    expect(itemSchema.safeParse({ ...emptyItem(), title: "x" }).success).toBe(
      true,
    );
  });
  it("rejects unsafe links, invalid recipients, negative metrics and duplicate attachments", () => {
    for (const patch of [
      { post_url: "javascript:alert(1)" },
      { group_id: "any" },
      { views: -1 },
      { attachment_ids: [fixture().id, fixture().id] },
    ])
      expect(
        itemSchema.safeParse({ ...emptyItem(), title: "x", ...patch }).success,
      ).toBe(false);
  });
  it("creates five template ideas grounded in selected FAQs and cases", () => {
    const brief = briefSchema.parse({
      topic: "งานกระเป๋า",
      brand_id: null,
      source_ids: [],
      audience: "ลูกค้าใหม่",
      goal: "ให้ความรู้",
      channel: "TikTok",
      pillar: "",
      format: "",
      variation: 0,
    });
    const sources = [
      { title: "ทำขั้นต่ำกี่ใบ", content: "สอบถามจำนวนได้", kind: "question" },
      {
        title: "เคสงานจริง",
        content: "งานตามตัวอย่างที่อนุมัติ",
        kind: "case",
      },
    ] as Source[];
    const ideas = templateIdeas(brief, sources);
    expect(ideas).toHaveLength(5);
    expect(ideas.some((i) => i.angle === sources[0].content)).toBe(true);
    expect(ideas.some((i) => i.angle === sources[1].content)).toBe(true);
    expect(templateIdeas({ ...brief, variation: 1 }, sources)[0]).not.toEqual(
      ideas[0],
    );
  });
  it("does not treat missing metrics as measured zeros or average unequal view counts", () => {
    const result = performanceSummary([
      fixture({ status: "posted", views: 100, saves: 10 }),
      fixture({ status: "posted", views: 900, saves: 0 }),
      fixture({ status: "posted", views: 50, saves: null }),
      fixture({ status: "idea", views: 9000, saves: 9000 }),
    ]);
    expect(result[0]).toMatchObject({
      count: 3,
      measured: 2,
      views: 1000,
      saves: 10,
      saveRate: 1,
    });
  });
});
