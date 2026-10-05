import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { logout } from "@/app/login/actions";
export const dynamic = "force-dynamic";
export default async function Workspace() {
  await requireAdmin();
  return (
    <main className="workspace-home">
      <header>
        <Link className="brand" href="/workspace">
          <span className="mark">
            pp<span>•</span>
          </span>
          <span>
            PP <small>YOUR SPACE</small>
          </span>
        </Link>
        <form action={logout}>
          <button className="secondary">ออกจากระบบ</button>
        </form>
      </header>
      <section className="workspace-welcome">
        <span className="eyebrow">A SPACE FOR EVERY PART OF YOUR DAY</span>
        <h1>วันนี้ อยากเริ่มตรงไหน</h1>
        <p>พื้นที่ทำงานและเรื่องราวของคุณ อยู่ด้วยกันที่นี่</p>
      </section>
      <div className="workspace-choices">
        <Link href="/planner" className="workspace-choice planner-choice">
          <span className="workspace-number">01 / CREATE & PLAN</span>
          <div className="workspace-art" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <h2>CONTENT PLANNER</h2>
          <p>
            คิดไอเดีย วางแผนคอนเทนต์
            <br />
            แล้วพางานไปถึงวันโพสต์
          </p>
          <span className="workspace-enter">
            เริ่มวางแผน <span aria-hidden="true">→</span>
          </span>
        </Link>
        <Link href="/admin" className="workspace-choice memory-choice">
          <span className="workspace-number">02 / REMEMBER & CONNECT</span>
          <div className="workspace-art memory-art" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <h2>MEMORY</h2>
          <p>
            เก็บความทรงจำ นัดหมาย
            <br />
            และให้ PP ช่วยตอบใน LINE
          </p>
          <span className="workspace-enter">
            เปิดความทรงจำ <span aria-hidden="true">→</span>
          </span>
        </Link>
      </div>
      <footer>บัญชีเดียว · คลังไฟล์เดียว · สลับพื้นที่ได้ทุกเมื่อ</footer>
    </main>
  );
}
