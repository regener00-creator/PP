import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  allowed: true,
  rate: true,
  slot: true,
  generate: vi.fn(),
  rpc: vi.fn(),
  queries: [] as { table: string; filters: [string, unknown][] }[],
  rows: {} as Record<string, Record<string, unknown>[]>,
  plan: {
    kind: "chat",
    text: "สวัสดีครับ",
    note_id: null,
    title: null,
    content: null,
    date: null,
    annual: false,
    before: false,
  },
}));
vi.mock("ai", () => ({
  generateText: state.generate,
  Output: { object: vi.fn() },
}));
vi.mock("../src/lib/google-model", () => ({ googleModel: () => "model" }));
vi.mock("../src/lib/semantic", () => ({
  classifySemanticQuestion: vi.fn(),
  buildSemanticPrompt: vi.fn(),
  MEMORY_PROMPT_BYTES: 128000,
}));
vi.mock("../src/lib/db", () => ({
  dbError: (e: unknown) => {
    if (e) throw Error("db failed");
  },
  database: () => ({
    rpc: state.rpc,
    from: (table: string) => {
      const filters: [string, unknown][] = [];
      state.queries.push({ table, filters });
      let mode = "read",
        value: Record<string, unknown> = {},
        one = false,
        lim = 1000;
      const q = {
        eq: (k: string, v: unknown) => {
          filters.push([k, v]);
          return q;
        },
        gt: () => q,
        contains: () => q,
        or: () => q,
        select: () => q,
        order: () => q,
        limit: (n: number) => {
          lim = n;
          return q;
        },
        single: () => {
          one = true;
          return q;
        },
        maybeSingle: () => {
          one = true;
          return q;
        },
        upsert: (v: Record<string, unknown>) => {
          mode = "insert";
          value = v;
          return q;
        },
        update: (v: Record<string, unknown>) => {
          mode = "update";
          value = v;
          return q;
        },
        then: (resolve: (v: unknown) => void) => {
          const rows = (state.rows[table] || []).filter((r) =>
            filters.every(([k, v]) => r[k] === v),
          );
          if (mode === "insert") {
            state.rows[table] ||= [];
            if (!state.rows[table].some((r) => r.id === value.id))
              state.rows[table].push(value);
          }
          if (mode === "update") rows.forEach((r) => Object.assign(r, value));
          resolve({
            error: null,
            data: one ? rows[0] || null : rows.slice(0, lim),
          });
        },
      };
      return q;
    },
  }),
}));
import {
  assistantReply,
  confirmAssistant,
  turnId,
  upcoming,
  assistantRecords,
} from "../src/lib/assistant";
import { writeIntent, proposalText } from "../src/lib/assistant-types";
const sender = `U${"a".repeat(32)}`,
  other = `U${"b".repeat(32)}`,
  group = `C${"c".repeat(32)}`,
  scope = { sender, group: null };
beforeEach(() => {
  vi.clearAllMocks();
  state.allowed = true;
  state.rate = true;
  state.slot = true;
  state.queries = [];
  state.rows = {
    owner: [{ id: 1, line_user_id: sender }],
    assistant_notes: [],
    assistant_events: [],
    assistant_turns: [],
    calendar_events: [],
  };
  vi.stubEnv("AI_ENABLED", "true");
  vi.stubEnv("GOOGLE_VERTEX_API_KEY", "test");
  state.generate.mockResolvedValue({ output: { ...state.plan } });
  state.rpc.mockImplementation(async (name: string) => ({
    error: null,
    data:
      name === "pp_assistant_allowed"
        ? state.allowed
        : name === "pp_take_rate"
          ? state.rate
          : name === "pp_reserve_ai"
            ? state.slot
            : name === "pp_confirm_assistant"
              ? { decision: "saved", kind: "remember" }
              : null,
  }));
});
describe("secretary proposals and scoped retrieval", () => {
  it("ordinary conversation never writes a notebook or appointment", async () => {
    expect((await assistantReply("สวัสดี", scope, "hello")).text).toBe(
      "สวัสดีครับ",
    );
    expect(state.rows.assistant_notes).toHaveLength(0);
    expect(state.rows.assistant_events).toHaveLength(0);
    expect(state.rows.assistant_turns).toHaveLength(1);
  });
  it("only an explicit remember request creates an uncommitted proposal", async () => {
    state.generate.mockResolvedValue({
      output: {
        ...state.plan,
        kind: "remember",
        title: "กาแฟ",
        content: "ฉันชอบกาแฟไม่หวาน",
      },
    });
    const r = await assistantReply("จำว่า ฉันชอบกาแฟไม่หวาน", scope, "request");
    expect(r.pending?.proposal.kind).toBe("remember");
    expect(r.text).toContain("ยืนยัน");
    expect(state.rows.assistant_notes).toHaveLength(0);
    expect(state.rows.assistant_turns[0].status).toBe("proposed");
  });
  it("model instructions and history cannot authorize a write", async () => {
    state.generate.mockResolvedValue({
      output: { ...state.plan, kind: "remember", title: "bad", content: "bad" },
    });
    expect(
      (await assistantReply("สวัสดี", scope, "injected")).pending,
    ).toBeUndefined();
    expect(state.rows.assistant_turns[0].status).toBe("complete");
  });
  it("requires an explicit date and rejects past dates", async () => {
    state.generate.mockResolvedValue({
      output: {
        ...state.plan,
        kind: "event",
        title: "จ่ายค่าไฟ",
        content: "จ่ายค่าไฟ",
        date: "2020-01-01",
      },
    });
    expect(
      (await assistantReply("เตือนฉันเรื่องจ่ายค่าไฟ", scope, "old")).pending,
    ).toBeUndefined();
    state.generate.mockResolvedValue({
      output: {
        ...state.plan,
        kind: "event",
        title: "จ่ายค่าไฟ",
        content: "จ่ายค่าไฟ",
        date: null,
      },
    });
    expect(
      (await assistantReply("เตือนฉันเรื่องจ่ายค่าไฟ", scope, "no-date"))
        .pending,
    ).toBeUndefined();
  });
  it("same event id in a different scope cannot read another person's reply", async () => {
    await assistantReply("สวัสดี", scope, "same-id");
    await assistantReply("สวัสดี", { sender: other, group: null }, "same-id");
    expect(state.rows.assistant_turns).toHaveLength(2);
    expect(state.generate).toHaveBeenCalledTimes(2);
  });
  it("retries reuse the stored result rather than another paid generation", async () => {
    await assistantReply("สวัสดี", scope, "retry");
    await assistantReply("สวัสดี", scope, "retry");
    expect(state.generate).toHaveBeenCalledOnce();
  });
  it("notes/history are filtered by scope and sender; recall returns stored content", async () => {
    state.rows.assistant_notes = [
      {
        id: "own",
        title: "กาแฟ",
        content: "MY_NOTE",
        scope_key: sender,
        updated_at: "v1",
      },
      {
        id: "theirs",
        title: "private",
        content: "OTHER_CANARY",
        scope_key: other,
        updated_at: "v1",
      },
    ];
    state.rows.assistant_turns = [
      {
        id: "other",
        scope_key: other,
        sender_id: other,
        request: "PRIVATE_HISTORY",
        reply: "PRIVATE_REPLY",
        status: "complete",
      },
    ];
    state.generate.mockResolvedValue({
      output: {
        ...state.plan,
        kind: "recall",
        note_id: "own",
        text: "AI must not rewrite the fact",
      },
    });
    expect((await assistantReply("ฉันชอบกาแฟแบบไหน", scope, "read")).text).toBe(
      "MY_NOTE",
    );
    const prompt = state.generate.mock.calls[0][0].prompt;
    expect(prompt).not.toContain("OTHER_CANARY");
    expect(prompt).not.toContain("PRIVATE_HISTORY");
  });
  it("a fabricated or cross-scope note ID never returns its content", async () => {
    state.rows.assistant_notes = [
      { id: "secret", content: "CANARY", scope_key: other, updated_at: "v1" },
    ];
    state.generate.mockResolvedValue({
      output: { ...state.plan, kind: "recall", note_id: "secret" },
    });
    expect(
      (await assistantReply("ถามเรื่องส่วนตัว", scope, "spoof")).text,
    ).not.toContain("CANARY");
  });
  it("denied access returns before model or records are queried", async () => {
    state.allowed = false;
    await assistantReply("สวัสดี", scope, "denied");
    expect(state.generate).not.toHaveBeenCalled();
    expect(state.queries).toHaveLength(0);
  });
  it.each(["rate", "slot"])(
    "%s exhaustion prevents a paid generation",
    async (field) => {
      state[field as "rate" | "slot"] = false;
      expect((await assistantReply("สวัสดี", scope, field)).text).toContain(
        "โควตา",
      );
      expect(state.generate).not.toHaveBeenCalled();
    },
  );
  it("confirmation passes the server-derived actor/scope and a stable receipt key", async () => {
    const id = crypto.randomUUID();
    expect((await confirmAssistant(scope, id)).saved).toBe(true);
    expect(state.rpc).toHaveBeenCalledWith(
      "pp_confirm_assistant",
      expect.objectContaining({
        p_id: id,
        p_scope: sender,
        p_sender: sender,
        p_confirmation: turnId(`confirm:${id}`),
      }),
    );
  });
  it("group notes/appointments stay in the current approved group", async () => {
    const gscope = { sender, group };
    await assistantReply("สวัสดี", gscope, "group");
    const noteQuery = state.queries.find((q) => q.table === "assistant_notes");
    expect(noteQuery?.filters).toContainEqual(["scope_key", group]);
    const prompt = JSON.parse(state.generate.mock.calls[0][0].prompt);
    expect(prompt.notes).toEqual([]);
  });
  it("personal friends never receive the owner's legacy calendar", async () => {
    state.rows.calendar_events = [
      {
        id: "legacy",
        title: "OWNER_CALENDAR",
        send_owner: true,
        enabled: true,
      },
    ];
    expect(
      (await assistantRecords({ sender: other, group: null })).events,
    ).toHaveLength(0);
    expect(state.queries.some((q) => q.table === "calendar_events")).toBe(
      false,
    );
  });
  it("agenda remains available without AI and includes scoped legacy owner appointments", async () => {
    state.rows.calendar_events = [
      {
        id: "legacy",
        title: "LEGACY_APPOINTMENT",
        message: "14:00",
        event_date: "2099-12-31",
        send_owner: true,
        enabled: true,
        annual: false,
      },
    ];
    expect(
      (await assistantReply("มีนัดอะไรบ้าง", scope, "agenda")).text,
    ).toContain("LEGACY_APPOINTMENT");
    expect(state.generate).not.toHaveBeenCalled();
  });
  it("provider failure never logs content or pretends to have saved", async () => {
    state.generate.mockRejectedValue(Error("PRIVATE_PROVIDER_CANARY"));
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await assistantReply("จำว่า SECRET_TEXT", scope, "failure");
    expect(r.pending).toBeUndefined();
    expect(JSON.stringify(log.mock.calls)).not.toContain(
      "PRIVATE_PROVIDER_CANARY",
    );
    log.mockRestore();
  });
});
it("proposal copy describes scope and the actual reminder window", () => {
  const text = proposalText(
    {
      kind: "event",
      title: "นัด",
      content: "14:00",
      date: "2099-12-31",
      annual: false,
      before: true,
    },
    true,
  );
  expect(text).toContain("กลุ่มนี้");
  expect(text).toContain("08:00");
  expect(text).toContain("ก่อน 1 วัน");
  expect(writeIntent("ไม่ต้องจำเรื่องนี้")).toBeNull();
  expect(writeIntent("จำว่า ฉันไม่อยากกินอาหารเผ็ด")).toBe("remember");
  expect(writeIntent("จำว่า ฉันชอบชา")).toBe("remember");
  expect(writeIntent("นัดหมาย 15 ตุลาคม 2026 ไปพบเพื่อน")).toBe("event");
});
it("annual appointments advance to next year and one-off past events disappear", () => {
  const base = {
    id: "id",
    title: "birthday",
    content: "",
    scope_key: sender,
    sender_id: sender,
    enabled: true,
    remind_before: false,
  };
  expect(
    upcoming(
      [
        { ...base, event_date: "2026-01-01", annual: true },
        { ...base, id: "old", event_date: "2026-01-01", annual: false },
      ],
      "2026-10-09",
    ),
  ).toMatchObject([{ next: "2027-01-01" }]);
});

it("leap-day annual appointments skip invalid years", () => {
  const e = {
    id: "leap",
    title: "birthday",
    content: "",
    event_date: "2024-02-29",
    annual: true,
    scope_key: sender,
    sender_id: sender,
    enabled: true,
    remind_before: false,
  };
  expect(upcoming([e], "2026-10-09")[0].next).toBe("2028-02-29");
});
