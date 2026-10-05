"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loadContentItem, moveContentItem } from "@/app/planner/actions";
import {
  thaiDay,
  statusLabels,
  localPostingTime,
  postingInstant,
  type ContentItem,
  type ContentSummary,
  type Generation,
  type Source,
} from "@/lib/planner-types";
import { PlannerHeading, PlannerDialog, Empty } from "./common";
import { ItemEditor, type EditorAssets } from "./item-editor";
function dateLabel(date: string | null) {
  return date
    ? new Date(date).toLocaleString("th-TH", {
        timeZone: "Asia/Bangkok",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "ยังไม่กำหนดวัน";
}
function ExistingEditor({
  id,
  assets,
  onClose,
}: {
  id: string;
  assets: EditorAssets;
  onClose: () => void;
}) {
  const [loaded, setLoaded] = useState<{
      item: ContentItem;
      drafts: Generation[];
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    loadContentItem(id)
      .then((r) => {
        if (!cancelled) {
          if (r) setLoaded(r);
          else setError("ไม่พบชิ้นงานนี้");
        }
      })
      .catch(() => {
        if (!cancelled) setError("โหลดชิ้นงานไม่สำเร็จ ลองปิดแล้วเปิดใหม่");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);
  return loaded ? (
    <ItemEditor {...loaded} assets={assets} onClose={onClose} />
  ) : (
    <PlannerDialog title="รายละเอียดชิ้นงาน" onClose={onClose}>
      <p role="status">{error || "กำลังโหลดชิ้นงาน…"}</p>
    </PlannerDialog>
  );
}
export function WorkPlanner({
  items,
  assets,
  initialItem,
  campaigns,
}: {
  items: ContentSummary[];
  assets: EditorAssets;
  initialItem?: string;
  campaigns: Source[];
}) {
  const router = useRouter();
  const [view, setView] = useState("ideas"),
    [query, setQuery] = useState(""),
    [brand, setBrand] = useState(""),
    [archived, setArchived] = useState(false),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState(initialItem || ""),
    [startDate, setStartDate] = useState<string | undefined>(),
    [notice, setNotice] = useState(""),
    [busy, start] = useTransition();
  const [cursor, setCursor] = useState(() => thaiDay().slice(0, 7) + "-01");
  const shown = items.filter(
    (i) =>
      i.archived === archived &&
      (!brand || i.brand_id === brand) &&
      (i.title + " " + i.assignee).toLowerCase().includes(query.toLowerCase()),
  );
  const editing = items.find((i) => i.id === selected);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(shown.length / 20)));
  function open(id: string) {
    setSelected(id);
    setStartDate(undefined);
    router.replace(`/planner/work?item=${id}`, { scroll: false });
  }
  function add(date?: string) {
    setSelected("new");
    setStartDate(date);
  }
  function move(id: string, patch: Parameters<typeof moveContentItem>[2]) {
    const item = items.find((i) => i.id === id);
    if (!item || busy) return;
    start(async () => {
      try {
        const r = await moveContentItem(id, item.updated_at, patch);
        setNotice(r.message);
        router.refresh();
      } catch {
        setNotice("ย้ายไม่สำเร็จ กรุณาลองใหม่");
      }
    });
  }
  function card(item: ContentSummary) {
    return (
      <button
        className={`planner-work-card ${view === "ideas" ? "planner-library-card" : `status-${item.status}`}`}
        draggable={!busy && !archived && (view === "month" || view === "week")}
        key={item.id}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", item.id);
        }}
        onClick={() => open(item.id)}
      >
        <span className="planner-work-channel">
          {item.channel} {item.pillar && `· ${item.pillar}`}
        </span>
        <strong>{item.title}</strong>
        <span>{dateLabel(item.scheduled_at)}</span>
        {item.assignee && <small>{item.assignee}</small>}
      </button>
    );
  }
  function drop(
    e: React.DragEvent,
    patch: (item: ContentSummary) => Parameters<typeof moveContentItem>[2],
  ) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    const item = shown.find((i) => i.id === id);
    if (item) move(id, patch(item));
  }
  const base = new Date(`${cursor}T00:00:00Z`);
  const startDay =
    view === "week"
      ? new Date(base.getTime() - ((base.getUTCDay() + 6) % 7) * 86400000)
      : new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
  const offset = view === "week" ? 0 : (startDay.getUTCDay() + 6) % 7;
  const days =
    view === "week"
      ? 7
      : new Date(
          Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0),
        ).getUTCDate();
  const dates = Array.from(
    { length: view === "week" ? 7 : Math.ceil((offset + days) / 7) * 7 },
    (_, i) =>
      i < offset || i >= offset + days
        ? null
        : new Date(startDay.getTime() + (i - offset) * 86400000)
            .toISOString()
            .slice(0, 10),
  );
  function shift(n: number) {
    setCursor(
      view === "week"
        ? new Date(base.getTime() + n * 7 * 86400000).toISOString().slice(0, 10)
        : new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + n, 1))
            .toISOString()
            .slice(0, 10),
    );
  }
  return (
    <>
      <PlannerHeading
        number="02"
        title="งานและปฏิทิน"
        description="ทุกไอเดีย มีทางไปถึงวันโพสต์"
      >
        <button onClick={() => add()}>เพิ่มชิ้นงาน</button>
      </PlannerHeading>
      <div className="planner-toolbar">
        <div className="planner-tabs">
          {[
            ["ideas", "ก้อนไอเดีย"],
            ["month", "เดือน"],
            ["week", "สัปดาห์"],
            ["list", "รายการ"],
          ].map(([key, label]) => (
            <button
              key={key}
              className="secondary"
              aria-pressed={view === key}
              onClick={() => setView(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="planner-archive-toggle">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          งานที่เก็บเข้าคลัง
        </label>
      </div>
      <div className="planner-filters">
        <input
          aria-label="ค้นหาชิ้นงาน"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="ค้นหาชื่องานหรือผู้รับผิดชอบ…"
        />
        <select
          aria-label="กรองแบรนด์"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
        >
          <option value="">ทุกแบรนด์</option>
          {assets.brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <p role="status" className="planner-hint">
        {busy
          ? "กำลังบันทึกตำแหน่ง…"
          : notice ||
            `${shown.length} ไอเดีย · ${view === "month" || view === "week" ? "ลากการ์ดเพื่อเปลี่ยนวันโพสต์ได้" : "คลิกก้อนไอเดียเพื่อเปิดรายละเอียด"}`}
      </p>
      {view === "ideas" && (
        <div className="planner-library-grid" aria-label="ไอเดียที่บันทึกไว้">
          {shown.slice((currentPage - 1) * 20, currentPage * 20).map(card)}
        </div>
      )}
      {(view === "month" || view === "week") && (
        <>
          <div className="planner-calendar-toolbar">
            <div>
              <button
                className="secondary"
                aria-label="ช่วงก่อนหน้า"
                onClick={() => shift(-1)}
              >
                ‹
              </button>
              <h2>
                {view === "week"
                  ? `${startDay.toLocaleDateString("th-TH", { timeZone: "UTC", day: "numeric", month: "short" })} – ${new Date(startDay.getTime() + 6 * 86400000).toLocaleDateString("th-TH", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" })}`
                  : base.toLocaleDateString("th-TH", {
                      timeZone: "UTC",
                      month: "long",
                      year: "numeric",
                    })}
              </h2>
              <button
                className="secondary"
                aria-label="ช่วงถัดไป"
                onClick={() => shift(1)}
              >
                ›
              </button>
            </div>
            <button className="secondary" onClick={() => setCursor(thaiDay())}>
              วันนี้
            </button>
          </div>
          <div className="planner-calendar-grid">
            {["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."].map((d) => (
              <div className="planner-day-heading" key={d}>
                {d}
              </div>
            ))}
            {dates.map((d, i) => (
              <div
                className={`planner-calendar-day ${d === thaiDay() ? "today" : ""} ${!d ? "blank" : ""}`}
                key={d || `blank${i}`}
                onDragOver={(e) => {
                  if (d) e.preventDefault();
                }}
                onDrop={(e) => {
                  if (d)
                    drop(e, (item) => ({
                      scheduled_at: postingInstant(
                        `${d}T${localPostingTime(item.scheduled_at).slice(11) || "10:00"}`,
                      ),
                    }));
                }}
              >
                {d && (
                  <>
                    <button
                      className="planner-day-number"
                      onClick={() => add(d)}
                      aria-label={`เพิ่มงานวันที่ ${d}`}
                    >
                      {Number(d.slice(-2))}
                    </button>
                    {campaigns
                      .filter(
                        (c) =>
                          (!brand || c.brand_id === brand) &&
                          c.start_date &&
                          c.start_date <= d &&
                          (c.end_date || c.start_date) >= d,
                      )
                      .map((c) => (
                        <Link
                          className="planner-campaign-chip"
                          href="/planner/brands"
                          key={c.id}
                        >
                          {c.title}
                        </Link>
                      ))}
                    {shown
                      .filter(
                        (item) =>
                          item.scheduled_at &&
                          thaiDay(new Date(item.scheduled_at)) === d,
                      )
                      .map(card)}
                  </>
                )}
              </div>
            ))}
          </div>
          <section className="planner-unscheduled">
            <h3>
              ยังไม่กำหนดวัน{" "}
              <small>{shown.filter((i) => !i.scheduled_at).length}</small>
            </h3>
            <div>{shown.filter((i) => !i.scheduled_at).map(card)}</div>
          </section>
        </>
      )}
      {view === "list" && (
        <>
          <div className="planner-work-list">
            {shown.slice((currentPage - 1) * 20, currentPage * 20).map((i) => (
              <button
                className="planner-list-row"
                key={i.id}
                onClick={() => open(i.id)}
              >
                <div>
                  <strong>{i.title}</strong>
                  <small>
                    {i.channel} · {i.assignee || "ยังไม่ระบุผู้รับผิดชอบ"}
                  </small>
                </div>
                <span className={`planner-status status-${i.status}`}>
                  {statusLabels[i.status]}
                </span>
                <span>{dateLabel(i.scheduled_at)}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {(view === "ideas" || view === "list") && (
        <>
          {!shown.length && (
            <Empty title="ยังไม่มีชิ้นงานในมุมมองนี้">
              <p>เพิ่มงานเอง หรือเก็บไอเดียจากหน้าช่วยคิดคอนเทนต์</p>
            </Empty>
          )}
          <div className="planner-pagination">
            <button
              className="secondary"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              ก่อนหน้า
            </button>
            <span>
              {currentPage} / {Math.max(1, Math.ceil(shown.length / 20))}
            </span>
            <button
              className="secondary"
              disabled={currentPage * 20 >= shown.length}
              onClick={() => setPage(currentPage + 1)}
            >
              ถัดไป
            </button>
          </div>
        </>
      )}
      {selected === "new" ? (
        <ItemEditor
          key="new"
          startDate={startDate}
          assets={assets}
          onClose={() => {
            setSelected("");
            router.refresh();
          }}
        />
      ) : editing ? (
        <ExistingEditor
          key={selected}
          id={selected}
          assets={assets}
          onClose={() => {
            setSelected("");
            router.replace("/planner/work", { scroll: false });
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
