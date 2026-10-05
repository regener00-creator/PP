export default function Loading() {
  return <div className="admin-loading" role="status" aria-live="polite">
    <p>กำลังโหลดข้อมูล…</p>
    <div className="loading-heading" aria-hidden="true"/>
    <div className="loading-cards" aria-hidden="true">
      <div/><div/><div/><div/>
    </div>
    <div className="loading-panel" aria-hidden="true"/>
  </div>;
}
