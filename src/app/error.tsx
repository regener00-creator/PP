"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="narrow"><h1>PP สะดุดนิดหนึ่ง</h1><p>เช็กการเชื่อมต่อและการตั้งค่าฐานข้อมูล แล้วลองอีกครั้ง</p><button onClick={reset}>ลองใหม่</button></main>;
}
