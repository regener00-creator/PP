import Link from "next/link";
import { LoginForm } from "./form";
import { adminConfigured } from "@/lib/env";
export const dynamic = "force-dynamic";
export default function Login() {
  const ready = adminConfigured();
  return <main className="login-shell"><Link className="brand" href="/"><span className="mark">pp<span>•</span></span><span>PP / YOUR SPACE</span></Link><div className="login-card"><div className="eyebrow">JUST BETWEEN US</div><h1>พื้นที่ของคุณ<br/>กับ PP<span className="accent">.</span></h1><p>จัดการสิ่งที่อยากให้เพื่อนรู้<br/>และสิ่งที่อยากเก็บไว้กับตัวเอง</p>{ready ? <LoginForm/> : <div className="notice"><p>PP ยังรอการตั้งค่าฐานข้อมูลและบัญชีแอดมิน</p><Link className="button" href="/setup">ดูวิธีเริ่มต้น ↗</Link></div>}</div><p className="muted">สำหรับเจ้าของ PP เท่านั้น</p></main>;
}
