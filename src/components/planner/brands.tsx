"use client";
import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  savePlannerBrand,
  savePlannerSource,
  deletePlannerSource,
  deleteUnusedBrand,
} from "@/app/planner/actions";
import {
  sourceKinds,
  initialPlannerState,
  type Brand,
  type Source,
} from "@/lib/planner-types";
import { PlannerDialog, PlannerHeading, Empty } from "./common";
function BrandForm({ brand }: { brand?: Brand }) {
  const [id] = useState(() => brand?.id || crypto.randomUUID());
  const [state, action, pending] = useActionState(
    savePlannerBrand,
    initialPlannerState,
  );
  const [, startAction] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startAction(() => action(data));
      }}
      className="planner-form"
    >
      <input type="hidden" name="id" value={id} />
      <input
        type="hidden"
        name="revision"
        value={state.revision || brand?.updated_at || ""}
      />
      <fieldset disabled={pending}>
        <label>
          ชื่อแบรนด์
          <input
            name="name"
            defaultValue={brand?.name}
            required
            maxLength={160}
            placeholder="ชื่อแบรนด์หรือธุรกิจของคุณ"
          />
        </label>
        <label>
          แบรนด์ทำอะไร และมีจุดเด่นอะไร
          <textarea
            name="description"
            defaultValue={brand?.description}
            maxLength={6000}
            rows={4}
          />
        </label>
        <div className="planner-columns">
          <label>
            กลุ่มลูกค้า
            <textarea
              name="audience"
              defaultValue={brand?.audience}
              rows={4}
              maxLength={6000}
            />
          </label>
          <label>
            น้ำเสียงของแบรนด์
            <textarea
              name="tone"
              defaultValue={brand?.tone}
              rows={4}
              maxLength={6000}
              placeholder="เช่น คุยง่าย สุภาพ อธิบายแบบเพื่อน"
            />
          </label>
          <label>
            เสาหลักคอนเทนต์ (Pillar)
            <textarea
              name="pillars"
              defaultValue={brand?.pillars}
              rows={4}
              maxLength={6000}
              placeholder="เช่น ให้ความรู้ / สินค้า / เรื่องลูกค้า / เบื้องหลัง"
            />
          </label>
          <label>
            เรื่องหรือคำที่ต้องหลีกเลี่ยง
            <textarea
              name="avoid"
              defaultValue={brand?.avoid}
              rows={4}
              maxLength={6000}
            />
          </label>
        </div>
      </fieldset>
      <div className="planner-form-footer">
        <p role="status">{state.message}</p>
        <button disabled={pending}>
          {pending ? "กำลังบันทึก…" : "บันทึกแบรนด์"}
        </button>
      </div>
    </form>
  );
}
function SourceForm({
  source,
  brandId,
  kind,
}: {
  source?: Source;
  brandId: string;
  kind: keyof typeof sourceKinds;
}) {
  const [id] = useState(() => source?.id || crypto.randomUUID());
  const [state, action, pending] = useActionState(
    savePlannerSource,
    initialPlannerState,
  );
  const [, startAction] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startAction(() => action(data));
      }}
      className="planner-form"
    >
      <input type="hidden" name="id" value={id} />
      <input
        type="hidden"
        name="revision"
        value={state.revision || source?.updated_at || ""}
      />
      <input type="hidden" name="brand_id" value={brandId} />
      <input type="hidden" name="kind" value={kind} />
      <fieldset disabled={pending}>
        <label>
          ชื่อ / หัวข้อ
          <input
            name="title"
            required
            maxLength={160}
            defaultValue={source?.title}
          />
        </label>
        <label>
          {kind === "product"
            ? "รายละเอียดที่ยืนยันแล้ว เช่น SKU ราคา วัสดุ จุดเด่น"
            : kind === "question"
              ? "คำถามจริง และคำตอบที่แบรนด์ใช้"
              : kind === "case"
                ? "โจทย์ลูกค้า สิ่งที่ทำ และผลลัพธ์จริง"
                : "รายละเอียดแคมเปญและเงื่อนไข"}
          <textarea
            name="content"
            required
            rows={9}
            maxLength={6000}
            defaultValue={source?.content}
          />
        </label>
        {kind === "campaign" && (
          <div className="planner-columns">
            <label>
              วันเริ่ม
              <input
                type="date"
                name="start_date"
                defaultValue={source?.start_date || ""}
              />
            </label>
            <label>
              วันสิ้นสุด
              <input
                type="date"
                name="end_date"
                defaultValue={source?.end_date || ""}
              />
            </label>
          </div>
        )}
      </fieldset>
      <div className="planner-form-footer">
        <p role="status">{state.message}</p>
        <button disabled={pending}>
          {pending ? "กำลังบันทึก…" : "บันทึกข้อมูล"}
        </button>
      </div>
    </form>
  );
}
export function BrandWorkspace({
  brands,
  sources,
}: {
  brands: Brand[];
  sources: Source[];
}) {
  const router = useRouter();
  const [brandId, setBrandId] = useState(brands[0]?.id || "");
  const brand = brands.find((b) => b.id === brandId) || brands[0];
  const [kind, setKind] = useState<keyof typeof sourceKinds>("product"),
    [editing, setEditing] = useState<
      "brand-new" | "brand" | "source-new" | Source | null
    >(null),
    [query, setQuery] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, start] = useTransition();
  const shown = sources.filter(
    (s) =>
      s.brand_id === brand?.id &&
      s.kind === kind &&
      (s.title + s.content).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PlannerHeading
        number="03"
        title="ข้อมูลแบรนด์"
        description="ยิ่งรู้จักแบรนด์ ไอเดียก็ยิ่งตรงใจ"
      >
        <button onClick={() => setEditing("brand-new")}>เพิ่มแบรนด์</button>
      </PlannerHeading>
      {brands.length ? (
        <>
          <div className="planner-brand-bar">
            <label>
              กำลังทำงานให้
              <select
                value={brand?.id}
                onChange={(e) => setBrandId(e.target.value)}
              >
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="secondary" onClick={() => setEditing("brand")}>
              แก้ไขข้อมูลแบรนด์
            </button>
            <button className="planner-text-button" disabled={busy} onClick={()=>{if(!brand||!confirm(`ลบแบรนด์ “${brand.name}” ถาวรหรือไม่? ต้องไม่มีวัตถุดิบหรือชิ้นงานผูกอยู่`))return;start(async()=>{try{const r=await deleteUnusedBrand(brand.id,brand.updated_at);setNotice(r.message);router.refresh();}catch{setNotice("ลบแบรนด์ไม่ได้ กรุณาลองใหม่");}});}}>ลบแบรนด์</button>
          </div>
          <section className="planner-brand-summary">
            <div>
              <small>ABOUT THE BRAND</small>
              <h2>{brand?.name}</h2>
              <p>
                {brand?.description ||
                  "เพิ่มเรื่องราวและจุดเด่นของแบรนด์ เพื่อให้ AI รู้จักคุณมากขึ้น"}
              </p>
            </div>
            <div>
              <small>กลุ่มลูกค้า</small>
              <p>{brand?.audience || "ยังไม่ระบุ"}</p>
              <small>น้ำเสียง</small>
              <p>{brand?.tone || "ยังไม่ระบุ"}</p>
            </div>
          </section>
          <div className="planner-toolbar">
            <div className="planner-tabs" aria-label="ประเภทข้อมูล">
              {Object.entries(sourceKinds).map(([k, label]) => (
                <button
                  className="secondary"
                  aria-pressed={kind === k}
                  key={k}
                  onClick={() => {
                    setKind(k as typeof kind);
                    setQuery("");
                  }}
                >
                  {label}
                  <small>
                    {
                      sources.filter(
                        (s) => s.brand_id === brand?.id && s.kind === k,
                      ).length
                    }
                  </small>
                </button>
              ))}
            </div>
          </div>
          <div className="planner-toolbar">
            <input
              aria-label="ค้นหาวัตถุดิบ"
              placeholder="ค้นหาชื่อหรือรายละเอียด…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button onClick={() => setEditing("source-new")}>
              เพิ่ม{sourceKinds[kind]}
            </button>
          </div>
          <div className="planner-source-grid">
            {shown.map((s) => (
              <article className="planner-source-card" key={s.id}>
                <small>{sourceKinds[s.kind]}</small>
                <h3>{s.title}</h3>
                <p>{s.content}</p>
                {s.start_date && (
                  <small>
                    {s.start_date} — {s.end_date || "ไม่ระบุวันสิ้นสุด"}
                  </small>
                )}
                <footer>
                  <button className="secondary" onClick={() => setEditing(s)}>
                    แก้ไข
                  </button>
                  <button
                    className="planner-text-button"
                    disabled={busy}
                    onClick={() => {
                      if (!confirm(`ลบข้อมูล “${s.title}” หรือไม่?`)) return;
                      start(async () => {
                        try {
                          const r = await deletePlannerSource(
                            s.id,
                            s.updated_at,
                          );
                          setNotice(r.message);
                          router.refresh();
                        } catch {
                          setNotice("ลบไม่ได้ ลองใหม่อีกครั้ง");
                        }
                      });
                    }}
                  >
                    ลบ
                  </button>
                </footer>
              </article>
            ))}
          </div>
          {!shown.length && (
            <Empty title={`ยังไม่มี${sourceKinds[kind]}`}>
              <p>เพิ่มข้อมูลจริงไว้เป็นวัตถุดิบให้ไอเดียรอบถัดไป</p>
            </Empty>
          )}
          <p role="status">{notice}</p>
        </>
      ) : (
        <Empty title="เริ่มจากแบรนด์ของคุณ">
          <p>
            เพิ่มชื่อแบรนด์ ลูกค้า และน้ำเสียงที่อยากใช้
            แล้วค่อยเติมสินค้าและเรื่องราว
          </p>
          <button onClick={() => setEditing("brand-new")}>
            เพิ่มแบรนด์แรก
          </button>
        </Empty>
      )}
      {editing && (
        <PlannerDialog
          title={
            editing === "brand-new"
              ? "เพิ่มแบรนด์"
              : editing === "brand"
                ? "แก้ไขข้อมูลแบรนด์"
                : typeof editing === "object"
                  ? "แก้ไขข้อมูล"
                  : "เพิ่มข้อมูล"
          }
          onClose={() => {
            setEditing(null);
            router.refresh();
          }}
        >
          {editing === "brand-new" || editing === "brand" ? (
            <BrandForm brand={editing === "brand" ? brand : undefined} />
          ) : (
            brand && (
              <SourceForm
                brandId={brand.id}
                kind={typeof editing === "object" ? editing.kind : kind}
                source={typeof editing === "object" ? editing : undefined}
              />
            )
          )}
        </PlannerDialog>
      )}
    </>
  );
}
