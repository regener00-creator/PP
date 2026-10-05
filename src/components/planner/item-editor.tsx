"use client";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveContentItem,
  deleteArchivedContent,
  createPlannerGeneration,
  moveContentItem,
} from "@/app/planner/actions";
import {
  AttachmentPicker,
  type LibraryFile,
  type LibraryFolder,
} from "@/components/attachment-picker";
import {
  emptyItem,
  statuses,
  statusLabels,
  channels,
  localPostingTime,
  postingInstant,
  type Brand,
  type ContentItem,
  type ItemData,
  type Generation,
} from "@/lib/planner-types";
import { PlannerDialog } from "./common";
export type EditorAssets = {
  brands: Brand[];
  files: LibraryFile[];
  folders: LibraryFolder[];
  groups: { group_id: string; label: string }[];
};
export function ItemEditor({
  item,
  startDate,
  assets,
  drafts = [],
  onClose,
}: {
  item?: ContentItem;
  startDate?: string;
  assets: EditorAssets;
  drafts?: Generation[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [id] = useState(() => item?.id || crypto.randomUUID()),
    [revision, setRevision] = useState(item?.updated_at || null),
    [data, setData] = useState<ItemData>(
      () =>
        item || {
          ...emptyItem(),
          brand_id: assets.brands[0]?.id || null,
          scheduled_at: startDate ? postingInstant(`${startDate}T10:00`) : null,
        },
    );
  const [tab, setTab] = useState("content"),
    [dirty, setDirty] = useState(false),
    [notice, setNotice] = useState(""),
    [busy, start] = useTransition(),
    [generated, setGenerated] = useState<Generation | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const change = <K extends keyof ItemData>(key: K, value: ItemData[K]) => {
    setDirty(true);
    setData((d) => ({ ...d, [key]: value }));
  };
  function close() {
    if (busy) return;
    if (dirty && !confirm("ยังมีการแก้ไขที่ไม่ได้บันทึก ต้องการปิดหรือไม่?"))
      return;
    onClose();
  }
  function currentData() {
    return {
      ...data,
      attachment_ids: new FormData(form.current!)
        .getAll("attachment_ids")
        .map(String),
    };
  }
  async function save() {
    const next = currentData();
    const r = await saveContentItem(next, id, revision);
    setNotice(r.message);
    if (r.ok) {
      setRevision(r.revision || null);
      setData(next);
      setDirty(false);
      router.refresh();
    }
    return r;
  }
  function submit() {
    start(async () => {
      try {
        await save();
      } catch {
        setNotice("การเชื่อมต่อขัดข้อง กรุณาลองใหม่");
      }
    });
  }
  function develop(engine: "ai" | "template") {
    start(async () => {
      try {
        const r = await save();
        if (!r.ok) return;
        setNotice("กำลังพัฒนาคอนเทนต์…");
        const result = await createPlannerGeneration(
          {
            topic: data.title,
            brand_id: data.brand_id,
            source_ids: [],
            audience: "",
            goal: "พัฒนาไอเดียเป็นชิ้นงานที่ใช้ได้จริง",
            channel: channels.includes(data.channel) ? data.channel : "อื่น ๆ",
            pillar: data.pillar,
            format: data.format,
            variation: 0,
          },
          crypto.randomUUID(),
          engine,
          id,
        );
        setNotice(result.message);
        if (result.generation) setGenerated(result.generation);
      } catch {
        setNotice("พัฒนาไม่สำเร็จ งานที่บันทึกไว้ยังอยู่");
      }
    });
  }
  const draft = generated?.result?.draft;
  return (
    <PlannerDialog
      title={revision ? "รายละเอียดชิ้นงาน" : "เพิ่มชิ้นงาน"}
      onClose={close}
    >
      <form
        ref={form}
        className="planner-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        onChange={() => setDirty(true)}
      >
        <fieldset disabled={busy}>
          <label>
            ชื่อชิ้นงาน
            <input
              required
              maxLength={160}
              value={data.title}
              onChange={(e) => change("title", e.target.value)}
              placeholder="เรื่องที่อยากเล่า"
            />
          </label>
          <div className="planner-columns three">
            <label>
              แบรนด์
              <select
                value={data.brand_id || ""}
                onChange={(e) => change("brand_id", e.target.value || null)}
              >
                <option value="">ไม่ระบุ</option>
                {assets.brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              สถานะ
              <select
                value={data.status}
                onChange={(e) =>
                  change("status", e.target.value as ItemData["status"])
                }
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {statusLabels[s]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              ช่องทาง
              <select
                value={data.channel}
                onChange={(e) => change("channel", e.target.value)}
              >
                {channels.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="planner-tabs editor-tabs">
            {[
              ["content", "เนื้อหา"],
              ["schedule", "กำหนดการ / LINE"],
              ["files", "รูปและไฟล์"],
              ["results", "ผลลัพธ์"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className="secondary"
                aria-pressed={tab === key}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <div hidden={tab !== "content"}>
            <div className="planner-columns">
              <label>
                Pillar
                <input
                  value={data.pillar}
                  maxLength={160}
                  onChange={(e) => change("pillar", e.target.value)}
                />
              </label>
              <label>
                รูปแบบการเล่า
                <input
                  value={data.format}
                  maxLength={160}
                  onChange={(e) => change("format", e.target.value)}
                />
              </label>
            </div>
            <label>
              Hook · ประโยคเปิด
              <textarea
                value={data.hook}
                maxLength={800}
                rows={2}
                onChange={(e) => change("hook", e.target.value)}
              />
            </label>
            <label>
              มุมเล่า
              <textarea
                value={data.angle}
                maxLength={1500}
                rows={3}
                onChange={(e) => change("angle", e.target.value)}
              />
            </label>
            <label>
              CTA · ชวนทำอะไรต่อ
              <input
                value={data.cta}
                maxLength={500}
                onChange={(e) => change("cta", e.target.value)}
              />
            </label>
            <div className="planner-ai-tools">
              <div>
                <strong>พัฒนาไอเดียเป็นชิ้นงาน</strong>
                <small>บันทึกงานก่อนคิดร่างใหม่ แล้วให้คุณเลือกนำมาใช้</small>
              </div>
              <button type="button" onClick={() => develop("ai")}>
                ให้ Gemini ช่วยเขียน
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => develop("template")}
              >
                ใช้โครงสำเร็จ
              </button>
            </div>
            {draft && (
              <section className="planner-draft-preview">
                <h3>ร่างใหม่พร้อมแล้ว</h3>
                {generated && (
                  <Link
                    href={`/planner/history/${generated.id}`}
                    target="_blank"
                  >
                    เปิดประวัติร่างนี้
                  </Link>
                )}
                <p>{draft.caption}</p>
                <details>
                  <summary>ดูสคริปต์และช็อตที่ต้องถ่าย</summary>
                  <pre>{draft.script}</pre>
                  <pre>{draft.shots}</pre>
                </details>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    if (
                      (data.caption || data.script) &&
                      !confirm(
                        "ใช้ร่างนี้แทน caption สคริปต์ และแนวทางภาพที่กำลังแก้ไขหรือไม่?",
                      )
                    )
                      return;
                    setData((d) => ({ ...d, ...draft }));
                    setDirty(true);
                    setGenerated(null);
                    setNotice("นำร่างมาใส่แล้ว กดบันทึกเมื่อแก้ไขเสร็จ");
                  }}
                >
                  นำร่างนี้มาใช้
                </button>
              </section>
            )}
            {drafts.length > 0 && (
              <details className="planner-details">
                <summary>ร่างที่เคยสร้าง ({drafts.length})</summary>
                {drafts.map((g) => (
                  <button
                    type="button"
                    className="secondary"
                    key={g.id}
                    onClick={() => setGenerated(g)}
                  >
                    เปิดร่าง{" "}
                    {new Date(g.created_at).toLocaleString("th-TH", {
                      timeZone: "Asia/Bangkok",
                    })}
                  </button>
                ))}
              </details>
            )}
            <label>
              Caption
              <textarea
                rows={6}
                maxLength={6000}
                value={data.caption}
                onChange={(e) => change("caption", e.target.value)}
              />
            </label>
            <div className="planner-columns">
              <label>
                สคริปต์
                <textarea
                  rows={7}
                  maxLength={6000}
                  value={data.script}
                  onChange={(e) => change("script", e.target.value)}
                />
              </label>
              <label>
                Shot list · ช็อตที่ต้องถ่าย
                <textarea
                  rows={7}
                  maxLength={6000}
                  value={data.shots}
                  onChange={(e) => change("shots", e.target.value)}
                />
              </label>
            </div>
            <label>
              แนวทางภาพ
              <textarea
                rows={3}
                maxLength={6000}
                value={data.visual}
                onChange={(e) => change("visual", e.target.value)}
              />
            </label>
            <label>
              Hashtag
              <input
                value={data.hashtags}
                maxLength={1000}
                onChange={(e) => change("hashtags", e.target.value)}
              />
            </label>
          </div>
          <div hidden={tab !== "schedule"}>
            <div className="planner-columns">
              <label>
                วันและเวลาโพสต์ (เวลาไทย)
                <input
                  type="datetime-local"
                  value={localPostingTime(data.scheduled_at)}
                  onChange={(e) => {
                    try {
                      change("scheduled_at", postingInstant(e.target.value));
                    } catch {
                      setNotice("วันที่ไม่ถูกต้อง");
                    }
                  }}
                />
              </label>
              <label>
                ผู้รับผิดชอบ
                <input
                  value={data.assignee}
                  maxLength={160}
                  onChange={(e) => change("assignee", e.target.value)}
                  placeholder="ชื่อคนที่ดูแลงานนี้"
                />
              </label>
            </div>
            <section className="planner-line-settings">
              <h3>แจ้งเตือนผ่าน LINE</h3>
              <p>
                แจ้งในรอบ 08:00–09:00 น. เวลาไทยของวันที่เลือก
                เวลาโพสต์ด้านบนใช้วางแผนงาน
              </p>
              <div className="planner-checks">
                <label>
                  <input
                    type="checkbox"
                    checked={data.remind_day}
                    onChange={(e) => change("remind_day", e.target.checked)}
                  />
                  เตือนในวันโพสต์
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={data.remind_before}
                    onChange={(e) => change("remind_before", e.target.checked)}
                  />
                  เตือนล่วงหน้า 1 วัน
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={data.notify_owner}
                    onChange={(e) => change("notify_owner", e.target.checked)}
                  />
                  ส่งแชตส่วนตัวของฉัน
                </label>
              </div>
              <label>
                ส่งเข้ากลุ่ม
                <select
                  value={data.group_id || ""}
                  onChange={(e) => change("group_id", e.target.value || null)}
                >
                  <option value="">ไม่ส่งเข้ากลุ่ม</option>
                  {assets.groups.map((g) => (
                    <option key={g.group_id} value={g.group_id}>
                      {g.label || `กลุ่ม ${g.group_id.slice(-6)}`}
                    </option>
                  ))}
                </select>
              </label>
              {data.group_id && (
                <p className="planner-hint">
                  สมาชิกกลุ่มจะเห็นชื่องาน ช่องทาง เวลาโพสต์ สถานะ และไฟล์ที่แนบ
                </p>
              )}
              <small>งานที่ลงแล้วหรือเก็บเข้าคลังจะไม่แจ้งเตือน</small>
            </section>
            <label>
              บันทึกสำหรับทีม
              <textarea
                value={data.notes}
                maxLength={6000}
                rows={4}
                onChange={(e) => change("notes", e.target.value)}
              />
            </label>
          </div>
          <div hidden={tab !== "files"}>
            <AttachmentPicker
              files={assets.files}
              folders={assets.folders}
              selected={data.attachment_ids}
              resetOnSubmit={false}
              disabled={busy}
            />
          </div>
          <div hidden={tab !== "results"}>
            <p>กรอกผลหลังโพสต์ เพื่อดูว่ารูปแบบไหนน่าทดลองต่อ</p>
            <label>
              ลิงก์โพสต์
              <input
                type="url"
                value={data.post_url}
                maxLength={2000}
                onChange={(e) => change("post_url", e.target.value)}
              />
            </label>
            <div className="planner-columns three">
              {(
                [
                  ["views", "ยอดดู"],
                  ["saves", "ยอดบันทึก"],
                  ["sales", "ยอดขาย (บาท)"],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    type="number"
                    min={0}
                    max={1e12}
                    step={key === "sales" ? "0.01" : "1"}
                    value={data[key] ?? ""}
                    onChange={(e) =>
                      change(
                        key,
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
                  />
                </label>
              ))}
            </div>
            <p className="planner-hint">
              เว้นว่างเมื่อยังไม่ทราบ ระบบจะแยกจากค่าศูนย์
            </p>
          </div>
        </fieldset>
        <p role="status" className="planner-editor-notice">
          {notice}
        </p>
        <div className="planner-editor-actions">
          <button
            type="button"
            className="secondary planner-copy-caption"
            disabled={busy}
            hidden={tab !== "content"}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  `${data.caption}\n\n${data.hashtags}`.trim(),
                );
                setNotice("คัดลอก caption แล้ว");
              } catch {
                setNotice(
                  "คัดลอกอัตโนมัติไม่ได้ เลือกข้อความในช่องเพื่อคัดลอกได้",
                );
              }
            }}
          >
            คัดลอก caption
          </button>
          <div className="planner-editor-save-actions">
            {item?.archived && revision && (
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => {
                  if (
                    !confirm(
                      "ลบชิ้นงานนี้ถาวรหรือไม่? ไม่สามารถกู้คืนผ่านโปรแกรมได้",
                    )
                  )
                    return;
                  start(async () => {
                    try {
                      const r = await deleteArchivedContent(id, revision);
                      setNotice(r.message);
                      if (r.ok) {
                        router.refresh();
                        onClose();
                      }
                    } catch {
                      setNotice("ลบไม่สำเร็จ กรุณาลองใหม่");
                    }
                  });
                }}
              >
                ลบถาวร
              </button>
            )}
            {revision && (
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => {
                  if (
                    !confirm(
                      item?.archived
                        ? "นำงานนี้กลับมาใช้งานหรือไม่?"
                        : "เก็บงานนี้เข้าคลังและหยุดแจ้งเตือนหรือไม่?",
                    )
                  )
                    return;
                  start(async () => {
                    try {
                      const r = await moveContentItem(id, revision, {
                        archived: !item?.archived,
                      });
                      setNotice(r.message);
                      if (r.ok) {
                        setDirty(false);
                        router.refresh();
                        onClose();
                      }
                    } catch {
                      setNotice("เปลี่ยนสถานะไม่ได้ กรุณาลองใหม่");
                    }
                  });
                }}
              >
                {item?.archived ? "นำกลับมาใช้" : "เก็บเข้าคลัง"}
              </button>
            )}
            <button disabled={busy}>
              {busy ? "กำลังทำงาน…" : "บันทึกชิ้นงาน"}
            </button>
          </div>
        </div>
      </form>
    </PlannerDialog>
  );
}
