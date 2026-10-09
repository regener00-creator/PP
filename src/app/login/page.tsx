import Link from "next/link";
import { LoginForm } from "./form";
import { adminConfigured } from "@/lib/env";
export const dynamic = "force-dynamic";
export default async function Login({searchParams}:{searchParams:Promise<{next?:string}>}) {
  const params=await searchParams;
  const next=typeof params.next === "string" && /^\/api\/files\/[0-9a-f-]{36}$/.test(params.next)?params.next:"";
  const ready = adminConfigured();
  return <main className="login-shell"><Link className="brand" href="/"><span className="mark">pp<span>•</span></span><span>PP / YOUR SPACE</span></Link><div className="login-card"><div className="eyebrow">JUST BETWEEN US</div><h1>พื้นที่ของคุณ<br/>กับน้องโจอา<span className="accent">.</span></h1><p>จำเรื่องสำคัญ ช่วยเตือนและนัดหมาย<br/>และเชื่อมต่อกับเพื่อนผ่าน LINE</p>{ready ? <LoginForm next={next}/> : <div className="notice"><p>PP ยังรอการตั้งค่าฐานข้อมูลและบัญชีแอดมิน</p><Link className="button" href="/setup">ดูวิธีเริ่มต้น</Link></div>}</div><p className="muted">สำหรับเจ้าของ PP เท่านั้น</p></main>;
}
