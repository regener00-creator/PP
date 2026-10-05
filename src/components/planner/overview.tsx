"use client";
import Link from "next/link";
import { useState } from "react";
import {
  performanceSummary,
  thaiDay,
  statusLabels,
  type Brand,
  type ContentSummary,
  type Source,
} from "@/lib/planner-types";
import { PlannerHeading, Empty } from "./common";
type Delivery = {
  id: string;
  status: string;
  reason: string | null;
  updated_at: string;
  item_id: string;
  target: string;
};
export function PlannerOverview({
  items,
  brands,
  sources,
  deliveries,
}: {
  items: ContentSummary[];
  brands: Brand[];
  sources: Source[];
  deliveries: Delivery[];
}) {
  const [brand, setBrand] = useState(""),
    [month, setMonth] = useState(() => thaiDay().slice(0, 7));
  const active = items.filter(
    (i) => !i.archived && (!brand || i.brand_id === brand),
  );
  const selected = active.filter((i) =>
    (i.scheduled_at
      ? thaiDay(new Date(i.scheduled_at))
      : thaiDay(new Date(i.created_at))
    ).startsWith(month),
  );
  const today = thaiDay(),
    weekEnd = new Date(Date.parse(`${today}T00:00:00Z`) + 6 * 86400000)
      .toISOString()
      .slice(0, 10);
  const due = active
    .filter(
      (i) =>
        i.status !== "posted" &&
        i.scheduled_at &&
        thaiDay(new Date(i.scheduled_at)) <= weekEnd,
    )
    .sort((a, b) => Date.parse(a.scheduled_at!) - Date.parse(b.scheduled_at!));
  const overdue = due.filter((i) => thaiDay(new Date(i.scheduled_at!)) < today);
  const campaigns = sources
    .filter(
      (s) =>
        s.kind === "campaign" &&
        (!brand || s.brand_id === brand) &&
        s.start_date &&
        (!s.end_date || s.end_date >= today),
    )
    .sort((a, b) => a.start_date!.localeCompare(b.start_date!));
  const pillars = selected.reduce((m, i) => {
    const key = i.pillar || "ยังไม่ระบุ";
    m.set(key, (m.get(key) || 0) + 1);
    return m;
  }, new Map<string, number>());
  const stats = performanceSummary(selected);
  return (
    <>
      <PlannerHeading
        number="05"
        title="ภาพรวมและผลลัพธ์"
        description="มองงานที่กำลังจะมาถึง แล้วเรียนรู้จากงานที่ลงไปแล้ว"
      />
      <div className="planner-filters">
        <label>
          เดือน
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value || thaiDay().slice(0, 7))}
          />
        </label>
        <label>
          แบรนด์
          <select value={brand} onChange={(e) => setBrand(e.target.value)}>
            <option value="">ทุกแบรนด์</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="planner-stat-grid">
        {[
          ["งานในเดือนนี้", selected.length],
          ["ลงแล้ว", selected.filter((i) => i.status === "posted").length],
          [
            "กำลังทำ / รอตรวจ",
            selected.filter((i) => ["making", "review"].includes(i.status))
              .length,
          ],
          ["เลยกำหนด", overdue.length],
        ].map(([label, n]) => (
          <article key={label}>
            <small>{label}</small>
            <strong>{n}</strong>
          </article>
        ))}
      </div>
      <div className="planner-columns">
        <section className="planner-panel">
          <h2>งานที่ต้องดูแลใน 7 วันนี้</h2>
          {due.length ? (
            due.slice(0, 20).map((i) => (
              <Link
                className="planner-upcoming"
                href={`/planner/work?item=${i.id}`}
                key={i.id}
              >
                <div>
                  <strong>{i.title}</strong>
                  <small>
                    {new Date(i.scheduled_at!).toLocaleString("th-TH", {
                      timeZone: "Asia/Bangkok",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · {i.channel}
                  </small>
                </div>
                <span
                  className={
                    thaiDay(new Date(i.scheduled_at!)) < today
                      ? "planner-overdue"
                      : ""
                  }
                >
                  {thaiDay(new Date(i.scheduled_at!)) < today
                    ? "เลยกำหนด"
                    : statusLabels[i.status]}
                </span>
              </Link>
            ))
          ) : (
            <p>ยังไม่มีงานถึงกำหนดในช่วงนี้</p>
          )}
          <Link href="/planner/work">เปิดงานและปฏิทิน →</Link>
        </section>
        <section className="planner-panel">
          <h2>แคมเปญที่กำลังมา</h2>
          {campaigns.length ? (
            campaigns.slice(0, 8).map((s) => (
              <Link
                href="/planner/brands"
                className="planner-upcoming"
                key={s.id}
              >
                <div>
                  <strong>{s.title}</strong>
                  <small>
                    {s.start_date} {s.end_date && `— ${s.end_date}`}
                  </small>
                </div>
              </Link>
            ))
          ) : (
            <p>เพิ่มเทศกาลและแคมเปญในข้อมูลแบรนด์ได้</p>
          )}
        </section>
      </div>
      <div className="planner-columns">
        <section className="planner-panel">
          <h2>สัดส่วน Pillar</h2>
          <p className="planner-hint">
            นับงานที่กำหนดวันในเดือนนี้ · งานยังไม่กำหนดวันนับตามเดือนที่สร้าง
          </p>
          {[...pillars].map(([name, n]) => (
            <div className="planner-bar-row" key={name}>
              <div>
                <span>{name}</span>
                <small>
                  {n} ชิ้น · {Math.round((n / selected.length) * 100)}%
                </small>
              </div>
              <div className="planner-bar-track">
                <span style={{ width: `${(n / selected.length) * 100}%` }} />
              </div>
            </div>
          ))}
          {!selected.length && <p>จะเห็นสัดส่วนเมื่อเริ่มเพิ่มงาน</p>}
        </section>
        <section className="planner-panel">
          <h2>รูปแบบที่ได้ผล</h2>
          <p className="planner-hint">
            อัตราบันทึก = ยอดบันทึก ÷ ยอดดู · ใช้เฉพาะชิ้นที่กรอกครบทั้งสองค่า
          </p>
          {stats.length ? (
            <div className="planner-performance">
              <div>
                <strong>รูปแบบ</strong>
                <strong>ชิ้นที่วัดผล</strong>
                <strong>อัตราบันทึก</strong>
              </div>
              {stats.map((s) => (
                <div key={s.format}>
                  <span>{s.format}</span>
                  <span>
                    {s.measured} / {s.count}
                  </span>
                  <span>
                    {s.saveRate === null ? "—" : `${s.saveRate.toFixed(2)}%`}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p>
              เปลี่ยนงานเป็น “ลงแล้ว” และกรอกยอดดู /
              ยอดบันทึกเพื่อเริ่มเปรียบเทียบ
            </p>
          )}
          <small>
            ตัวเลขเป็นแนวทางทดลองต่อ ควรเทียบช่องทางและจำนวนชิ้นงานร่วมด้วย
          </small>
        </section>
      </div>
      <section className="planner-panel">
        <h2>ผลลัพธ์รายชิ้น</h2>
        {selected.filter((i) => i.status === "posted").length ? (
          <div className="planner-results-table">
            <div>
              <strong>ชิ้นงาน</strong>
              <strong>ยอดดู</strong>
              <strong>ยอดบันทึก</strong>
              <strong>ยอดขาย (บาท)</strong>
            </div>
            {selected
              .filter((i) => i.status === "posted")
              .map((i) => (
                <Link key={i.id} href={`/planner/work?item=${i.id}`}>
                  <span>
                    {i.title}
                    <small>
                      {i.channel} · {i.format}
                    </small>
                  </span>
                  <span>{i.views?.toLocaleString() ?? "—"}</span>
                  <span>{i.saves?.toLocaleString() ?? "—"}</span>
                  <span>{i.sales?.toLocaleString() ?? "—"}</span>
                </Link>
              ))}
          </div>
        ) : (
          <Empty title="งานที่ลงแล้วจะอยู่ตรงนี้">
            <p>เปิดรายละเอียดชิ้นงาน แล้วกรอกผลในแท็บ “ผลลัพธ์”</p>
          </Empty>
        )}
      </section>
      <section className="planner-panel">
        <h2>การแจ้ง LINE ล่าสุด</h2>
        {deliveries.length ? (
          deliveries.map((d) => (
            <div className="planner-upcoming" key={d.id}>
              <div>
                <strong>
                  {items.find((i) => i.id === d.item_id)?.title || "ชิ้นงาน"}
                </strong>
                <small>
                  {d.target.startsWith("C") ? "ส่งเข้ากลุ่ม" : "แชตเจ้าของ"} ·{" "}
                  {new Date(d.updated_at).toLocaleString("th-TH", {
                    timeZone: "Asia/Bangkok",
                  })}
                </small>
              </div>
              <span>
                {d.status === "sent"
                  ? "LINE รับข้อความแล้ว"
                  : d.status === "failed"
                    ? "ส่งไม่สำเร็จ"
                    : d.status === "skipped"
                      ? "ข้ามการส่ง"
                      : "กำลังส่ง"}
                {d.reason && d.status !== "sent" && (
                  <small>
                    {(
                      {
                        quota_exhausted: "โควตาไม่พอ",
                        quota_unavailable: "ตรวจโควตาไม่ได้",
                        changed: "ข้อมูลเปลี่ยนแล้ว",
                        group_disabled: "กลุ่มปิดใช้งาน",
                        delivery_error: "ติดต่อ LINE ไม่สำเร็จ",
                        line_rejected: "LINE ปฏิเสธข้อความ",
                      } as Record<string, string>
                    )[d.reason] || "ตรวจรายละเอียดงานและการเชื่อมต่อ"}
                  </small>
                )}
              </span>
            </div>
          ))
        ) : (
          <p>เมื่อถึงวันแจ้งเตือน ผลการส่งจะปรากฏที่นี่</p>
        )}
      </section>
    </>
  );
}
