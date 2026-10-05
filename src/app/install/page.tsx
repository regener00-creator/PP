import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { InstallAppButton } from "@/components/install-app";

export const metadata: Metadata = { title: "ติดตั้งน้องโจอาบนคอม" };

export default function InstallPage() {
  return <main className="desktop-install-page">
    <Link className="install-back" href="/admin">กลับไปความทรงจำ</Link>
    <section className="desktop-install-card">
      <Image src="/icons/app-192.png" alt="" width={88} height={88} priority className="desktop-app-icon"/>
      <p className="eyebrow">YOUR SPACE, ON DESKTOP</p>
      <h1>น้องโจอา บนคอมของคุณ</h1>
      <p className="install-intro">เปิดจากไอคอน ใช้งานในหน้าต่างแยก<br/>ความทรงจำและปฏิทินชุดเดิม อยู่ครบเหมือนบนเว็บ</p>
      <InstallAppButton showHelpLink={false}/>
      <p className="install-online-note">ใช้งานผ่านอินเทอร์เน็ต · อัปเดตพร้อมกับเว็บ</p>
      <div className="install-steps">
        <article><span>01</span><h2>ติดตั้งครั้งเดียว</h2><p>เปิดหน้านี้ใน Chrome หรือ Edge แล้วกดติดตั้งบนคอม</p></article>
        <article><span>02</span><h2>เปิดจากไอคอน</h2><p>ค้นหา “น้องโจอา” ในเมนู Start แล้วเปิดแอป</p></article>
        <article><span>03</span><h2>ปักหมุดไว้ใกล้มือ</h2><p>คลิกขวาที่ไอคอนแอปบน Taskbar แล้วเลือกปักหมุด</p></article>
      </div>
      <details className="install-manual">
        <summary>ถ้าปุ่มไม่เปิดหน้าต่างติดตั้ง</summary>
        <p>เปิดหน้านี้ใน Chrome หรือ Edge แบบปกติ แล้วกดไอคอนติดตั้งแอปด้านขวาของแถบที่อยู่</p>
        <p>ใน Edge สามารถใช้เมนู ตั้งค่าและอื่น ๆ → เครื่องมือเพิ่มเติม → แอป → ติดตั้งไซต์นี้เป็นแอป</p>
        <p>ถ้าติดตั้งไว้แล้ว ให้เปิด “น้องโจอา” จากเมนู Start ได้เลย</p>
      </details>
      <Link className="install-web-link" href="/admin">ใช้งานบนเว็บต่อ</Link>
    </section>
  </main>;
}
