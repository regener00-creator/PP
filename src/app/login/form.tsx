"use client";
import { useActionState } from "react";
import { login } from "./actions";
export function LoginForm() {
  const [state, action, pending] = useActionState(login, { message: "" });
  return <form action={action} className="stack"><label>อีเมลแอดมิน<input name="email" type="email" autoComplete="username" required maxLength={254} placeholder="you@example.com" /></label><label>รหัสผ่าน<input name="password" type="password" autoComplete="current-password" required maxLength={256}/></label><button disabled={pending}>{pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่พื้นที่ของคุณ ↗"}</button><p role="status" className="form-status">{state.message}</p></form>;
}
