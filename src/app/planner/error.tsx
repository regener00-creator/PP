"use client";
export default function PlannerError({ reset }: { reset: () => void }) {
  return (
    <section className="planner-empty">
      <h1>โหลดข้อมูลไม่สำเร็จ</h1>
      <p>ลองอีกครั้งได้ ข้อมูลที่บันทึกไว้ยังอยู่</p>
      <button onClick={reset}>ลองใหม่</button>
    </section>
  );
}
