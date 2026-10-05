import { quotaStatus } from "@/lib/reminders";

export function QuotaLoading() {
  return <div className="quota-strip" role="status">กำลังอ่านโควตา LINE…</div>;
}

// Stream this secondary information without delaying the calendar controls.
export async function LineQuota() {
  const quota = await quotaStatus();
  return <div className="quota-strip">โควตา LINE เดือนนี้: {quota ? `${quota.used.toLocaleString()} / ${quota.limit === null ? "ไม่จำกัดตามข้อมูล LINE" : quota.limit.toLocaleString()} ข้อความ` : "ยังอ่านโควตาไม่ได้"}
    <small>เฉพาะการส่งอัตโนมัติ · การตอบคำถามด้วย Reply API ไม่หักโควตานี้</small>
  </div>;
}
