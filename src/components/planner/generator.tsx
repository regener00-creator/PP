"use client";
import { GoalManager } from "./goal-manager";
import { type GoalSettings } from "@/lib/planner-goals";
import Link from "next/link";
import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createPlannerGeneration,
  keepPlannerIdea,
  loadPlannerPatterns,
  setPlannerPatternEnabled,
} from "@/app/planner/actions";
import {
  channels,
  formats,
  sourceKinds,
  type Brand,
  type Source,
  type Generation,
  type Brief,
} from "@/lib/planner-types";
import { builtinPatterns, type LearnedPattern } from "@/lib/planner-templates";
import { PlannerHeading, Empty } from "./common";
export function IdeaGenerator({
  brands,
  sources,
  initial,
  aiEnabled,
  goalSettings,
}: {
  brands: Brand[];
  sources: Source[];
  initial: Generation | null;
  aiEnabled: boolean;
  goalSettings: GoalSettings;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState(goalSettings);
  const [manageGoals, setManageGoals] = useState(false);
  const [brief, setBrief] = useState<Brief>(
    initial?.request.brief || {
      topic: "",
      brand_id: brands[0]?.id || null,
      source_ids: [],
      audience: "",
      goal: goalSettings.goals[0].label,
      goal_id: goalSettings.goals[0].id,
      channel: "TikTok",
      pillar: "",
      format: "",
      variation: 0,
    },
  );
  const [engine, setEngine] = useState<"ai" | "template">(
      initial?.engine === "template" || !aiEnabled ? "template" : "ai",
    ),
    [result, setResult] = useState(initial),
    [notice, setNotice] = useState(""),
    [busy, start] = useTransition(),
    [saved, setSaved] = useState<Record<string, string>>({});
  const [patterns, setPatterns] = useState<LearnedPattern[]>([]);
  const [patternNotice, setPatternNotice] = useState("");
  useEffect(() => {
    let active = true;
    setPatterns([]);
    setPatternNotice("");
    loadPlannerPatterns(brief.brand_id)
      .then((p) => {
        if (active) setPatterns(p);
      })
      .catch(() => {
        if (active) setPatternNotice("โหลดโครงไม่สำเร็จ ลองรีเฟรชหน้า");
      });
    return () => {
      active = false;
    };
  }, [brief.brand_id, result?.id]);
  function togglePattern(pattern: LearnedPattern) {
    if (busy) return;
    start(async () => {
      try {
        const r = await setPlannerPatternEnabled(pattern.id, !pattern.enabled);
        setPatternNotice(r.message);
        if (r.ok)
          setPatterns((p) =>
            p.map((v) =>
              v.id === pattern.id ? { ...v, enabled: !v.enabled } : v,
            ),
          );
      } catch {
        setPatternNotice("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
      }
    });
  }
  const brand = brands.find((b) => b.id === brief.brand_id);
  const eligible = sources.filter((s) => s.brand_id === brief.brand_id);
  const change = <K extends keyof Brief>(key: K, value: Brief[K]) =>
    setBrief((v) => ({ ...v, [key]: value }));
  function generate(variant = false) {
    if (busy) return;
    const next = {
      ...brief,
      variation: variant ? brief.variation + 1 : brief.variation,
    };
    setBrief(next);
    setNotice("กำลังคิดไอเดียและบันทึกผล…");
    start(async () => {
      try {
        const r = await createPlannerGeneration(
          next,
          crypto.randomUUID(),
          engine,
        );
        setNotice(r.message);
        if (r.generation) {
          setResult(r.generation);
          router.replace(`/planner?generation=${r.generation.id}`, {
            scroll: false,
          });
        }
      } catch {
        setNotice("การเชื่อมต่อขัดข้อง กรุณาลองอีกครั้ง");
      }
    });
  }
  function keep(index: number, develop = false) {
    if (!result || busy) return;
    const key = `${result.id}:${index}`;
    if (saved[key]) {
      router.push(`/planner/work?item=${saved[key]}`);
      return;
    }
    start(async () => {
      try {
        const r = await keepPlannerIdea(result.id, index);
        setNotice(r.message);
        if (r.ok && r.id) {
          setSaved((s) => ({ ...s, [key]: r.id! }));
          if (develop) router.push(`/planner/work?item=${r.id}`);
        }
      } catch {
        setNotice("เก็บไอเดียไม่สำเร็จ ลองใหม่ได้");
      }
    });
  }
  return (
    <>
      {manageGoals && (
        <GoalManager
          settings={settings}
          onClose={() => setManageGoals(false)}
          onSaved={(next) => {
            const selected =
              next.goals.find((g) =>
                brief.goal_id ? g.id === brief.goal_id : g.label === brief.goal,
              ) || next.goals[0];
            setSettings(next);
            setBrief((v) => ({
              ...v,
              goal: selected.label,
              goal_id: selected.id,
            }));
            setManageGoals(false);
            setNotice("บันทึกหัวข้อแล้ว");
          }}
        />
      )}
      <PlannerHeading
        number="01"
        title="ไอเดียดี ๆ เริ่มจากตรงนี้"
        description="จากเรื่องที่อยากเล่า สู่คอนเทนต์ที่พร้อมลงมือทำ"
      >
        <Link className="button secondary" href="/planner/work">
          ดูงานของฉัน
        </Link>
      </PlannerHeading>
      <div className="planner-generator-layout">
        <section className="planner-panel">
          <div className="planner-panel-heading">
            <span className="planner-step">01</span>
            <div>
              <h2>วันนี้อยากเล่าเรื่องอะไร</h2>
              <p>เริ่มจากหัวข้อเดียว แล้วค่อยเติมรายละเอียด</p>
            </div>
          </div>
          <form
            className="planner-form"
            onSubmit={(e) => {
              e.preventDefault();
              generate();
            }}
          >
            <fieldset disabled={busy}>
              <label>
                หัวข้อที่อยากให้ช่วยคิด
                <textarea
                  required
                  minLength={2}
                  maxLength={1200}
                  rows={3}
                  value={brief.topic}
                  onChange={(e) => change("topic", e.target.value)}
                  placeholder="เช่น อยากแนะนำสินค้ารุ่นใหม่ให้คนเพิ่งรู้จักแบรนด์"
                />
              </label>
              <div className="planner-columns">
                <label>
                  แบรนด์
                  <select
                    value={brief.brand_id || ""}
                    onChange={(e) =>
                      setBrief((b) => ({
                        ...b,
                        brand_id: e.target.value || null,
                        source_ids: [],
                      }))
                    }
                  >
                    <option value="">ยังไม่ระบุแบรนด์</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  ช่องทาง
                  <select
                    value={brief.channel}
                    onChange={(e) =>
                      change("channel", e.target.value as Brief["channel"])
                    }
                  >
                    {channels.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <div>
                  <label>
                    อยากให้คอนเทนต์ช่วยอะไร
                    <select
                      value={
                        brief.goal_id ||
                        settings.goals.find((g) => g.label === brief.goal)
                          ?.id ||
                        "previous"
                      }
                      onChange={(e) => {
                        const goal = settings.goals.find(
                          (g) => g.id === e.target.value,
                        );
                        if (goal)
                          setBrief((v) => ({
                            ...v,
                            goal: goal.label,
                            goal_id: goal.id,
                          }));
                      }}
                    >
                      {!settings.goals.some((g) =>
                        brief.goal_id
                          ? g.id === brief.goal_id
                          : g.label === brief.goal,
                      ) && (
                        <option value={brief.goal_id || "previous"}>
                          {brief.goal} (หัวข้อเดิม)
                        </option>
                      )}
                      {settings.goals.map((goal) => (
                        <option key={goal.id} value={goal.id}>
                          {goal.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="secondary planner-manage-goals"
                    onClick={() => setManageGoals(true)}
                  >
                    จัดการหัวข้อ
                  </button>
                </div>
                <label>
                  คุยกับใคร
                  <input
                    value={brief.audience}
                    maxLength={1000}
                    onChange={(e) => change("audience", e.target.value)}
                    placeholder={
                      brand?.audience || "เช่น คนที่ยังไม่เคยใช้สินค้า"
                    }
                  />
                </label>
              </div>
              <details className="planner-details">
                <summary>กำหนดมุมเล่าและวัตถุดิบเพิ่มเติม</summary>
                <div className="planner-columns">
                  <label>
                    Pillar
                    <input
                      value={brief.pillar}
                      maxLength={160}
                      onChange={(e) => change("pillar", e.target.value)}
                      placeholder={brand?.pillars || "เช่น ให้ความรู้"}
                    />
                  </label>
                  <label>
                    รูปแบบการเล่า
                    <select
                      value={brief.format}
                      onChange={(e) => change("format", e.target.value)}
                    >
                      <option value="">ให้ช่วยเลือก</option>
                      {formats.map((f) => (
                        <option key={f}>{f}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="planner-hint">
                  เลือกข้อมูลที่ใช้คิดงาน ถ้าไม่เลือกจะใช้ข้อมูลทั้งหมดของแบรนด์
                </p>
                <div className="planner-source-picks">
                  {eligible.map((s) => (
                    <label key={s.id}>
                      <input
                        type="checkbox"
                        checked={brief.source_ids.includes(s.id)}
                        disabled={
                          !brief.source_ids.includes(s.id) &&
                          brief.source_ids.length >= 20
                        }
                        onChange={(e) =>
                          change(
                            "source_ids",
                            e.target.checked
                              ? [...brief.source_ids, s.id]
                              : brief.source_ids.filter((id) => id !== s.id),
                          )
                        }
                      />
                      <span>
                        <small>{sourceKinds[s.kind]}</small>
                        {s.title}
                      </span>
                    </label>
                  ))}
                  {!eligible.length && (
                    <Link href="/planner/brands">
                      เพิ่มสินค้า คำถาม หรือเคสจริงในข้อมูลแบรนด์
                    </Link>
                  )}
                </div>
              </details>
              <div
                className="planner-engine"
                role="group"
                aria-label="วิธีคิดไอเดีย"
              >
                <button
                  type="button"
                  className="secondary"
                  aria-pressed={engine === "ai"}
                  onClick={() => setEngine("ai")}
                  disabled={!aiEnabled}
                >
                  <strong>Gemini</strong>
                  <small>ช่วยคิดจากบริบทแบรนด์ · ใช้โควตา AI</small>
                </button>
                <button
                  type="button"
                  className="secondary"
                  aria-pressed={engine === "template"}
                  onClick={() => setEngine("template")}
                >
                  <strong>สูตรสำเร็จ</strong>
                  <small>โครงหลากหลาย + ต่อยอดจากคลัง · ไม่ใช้ AI</small>
                </button>
              </div>
            </fieldset>
            <button className="planner-generate" disabled={busy}>
              {busy ? "กำลังทำงาน…" : "คิดไอเดีย 5 แบบ"}
            </button>
            <p role="status" className="planner-hint">
              {notice}
            </p>
          </form>
        </section>
        <aside className="planner-inspiration">
          <span className="eyebrow">A LITTLE DIRECTION</span>
          <h2>
            เล่าเรื่องเดียว
            <br />
            ได้หลายมุม
          </h2>
          <div>
            <span>01</span>
            <p>
              เริ่มจากคำถาม
              <br />
              <strong>ลูกค้าสงสัยเรื่องอะไร</strong>
            </p>
          </div>
          <div>
            <span>02</span>
            <p>
              ให้เห็นของจริง
              <br />
              <strong>สาธิต เล่าเคส เปิดเบื้องหลัง</strong>
            </p>
          </div>
          <div>
            <span>03</span>
            <p>
              ชวนทำอะไรต่อ
              <br />
              <strong>บันทึก ถามเพิ่ม หรือทักหา</strong>
            </p>
          </div>
          <Link href="/planner/brands">เติมข้อมูลแบรนด์ให้ไอเดียตรงขึ้น →</Link>
        </aside>
      </div>
      <details className="planner-panel planner-pattern-library">
        <summary>
          คลังโครงสำหรับสูตรสำเร็จ · พื้นฐาน {builtinPatterns.length} แบบ · จาก
          Gemini {patterns.filter((p) => p.enabled).length} แบบ
        </summary>
        <p className="planner-hint">
          Gemini เก็บโครงใหม่พร้อมไอเดีย
          โหมดสูตรสำเร็จใช้โครงเหล่านี้โดยไม่เรียก AI เพิ่ม
          และข้ามหัวข้อที่เคยเสนอในแบรนด์นี้
        </p>
        <p role="status">{patternNotice}</p>
        {patterns.length === 0 ? (
          <p className="planner-hint">
            เมื่อใช้ Gemini สร้างไอเดีย โครงที่นำกลับมาใช้ได้จะมาอยู่ที่นี่
          </p>
        ) : (
          <div className="planner-source-grid">
            {patterns.map((p) => (
              <article className="planner-source-card" key={p.id}>
                <small>
                  {p.format} · {p.enabled ? "เปิดใช้" : "พักไว้"}
                </small>
                <h3>
                  {p.title
                    .replaceAll("{subject}", "[สินค้า / เรื่อง]")
                    .replaceAll("{audience}", "[กลุ่มลูกค้า]")}
                </h3>
                <p>
                  {p.angle
                    .replaceAll("{subject}", "[สินค้า / เรื่อง]")
                    .replaceAll("{audience}", "[กลุ่มลูกค้า]")}
                </p>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => togglePattern(p)}
                >
                  {p.enabled ? "พักโครงนี้" : "เปิดใช้โครงนี้"}
                </button>
              </article>
            ))}
          </div>
        )}
      </details>
      <section className="planner-results">
        <div className="planner-toolbar">
          <div>
            <span className="eyebrow">02 / PICK YOUR NEXT STORY</span>
            <h2>เลือกไอเดียที่อยากไปต่อ</h2>
          </div>
          {!!result?.result?.ideas?.length && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() => generate(true)}
            >
              ขอแนวอื่นอีก 5 แบบ
            </button>
          )}
        </div>
        {result?.result?.ideas?.length ? (
          <>
            <p className="planner-hint">
              {result.engine === "ai" ? "Gemini" : "สูตรสำเร็จ"} ·{" "}
              {result.request.brief.channel} · ตรวจรายละเอียดก่อนเผยแพร่
            </p>
            <p role="status" className="planner-hint">
              {result.result.notice}
              {result.result.learned_count
                ? " · เก็บโครงจาก Gemini เพิ่ม " +
                  result.result.learned_count +
                  " แบบ"
                : ""}
            </p>
            <div className="planner-idea-grid">
              {result.result.ideas.map((idea, index) => (
                <article
                  className="planner-idea-card"
                  key={`${result.id}:${index}`}
                >
                  <div className="planner-idea-meta">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <small>
                      {idea.format} · {idea.pillar}
                    </small>
                  </div>
                  {idea.origin && (
                    <small className="planner-hint">{idea.origin}</small>
                  )}
                  <h3>{idea.title}</h3>
                  <blockquote>{idea.hook}</blockquote>
                  <p>{idea.angle}</p>
                  <div className="planner-cta">
                    <small>ชวนทำต่อ</small>
                    {idea.cta}
                  </div>
                  <footer>
                    <button
                      disabled={busy}
                      className="secondary"
                      onClick={() => keep(index)}
                    >
                      {saved[`${result.id}:${index}`]
                        ? "เปิดไอเดียที่เก็บแล้ว"
                        : "เก็บไอเดีย"}
                    </button>
                    <button disabled={busy} onClick={() => keep(index, true)}>
                      พัฒนาต่อ
                    </button>
                  </footer>
                </article>
              ))}
            </div>
          </>
        ) : (
          <Empty title={result?.result?.notice || "ไอเดียชุดแรกกำลังรอคุณอยู่"}>
            <p>
              {result
                ? "เพิ่มวัตถุดิบ เปลี่ยนหัวข้อ หรือใช้ Gemini เพื่อคิดมุมใหม่"
                : "เล่าโจทย์ด้านบน แล้วเลือกวิธีคิดที่ต้องการ"}
            </p>
          </Empty>
        )}
      </section>
    </>
  );
}
