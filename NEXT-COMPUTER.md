# PP — ทำงานต่อและสลับคอม

โค้ดหลัก: https://github.com/regener00-creator/PP
เว็บที่ใช้งานจริง: https://pp-theta-beryl.vercel.app

## เปิดครั้งแรกบนเครื่องใหม่

1. ติดตั้ง Git, Node.js รุ่น 24 และ Codex
2. เข้าสู่ GitHub ด้วยบัญชี regener00-creator เมื่อ Git ขอเข้าสู่ระบบ
3. ดาวน์โหลดโปรเจกต์ด้วยคำสั่งด้านล่าง หรือให้ Codex ทำให้ แล้วเปิดโฟลเดอร์ PP

```powershell
git clone https://github.com/regener00-creator/PP.git
cd PP
npm ci
```

ข้อความสำหรับส่งให้ Codex บนเครื่องใหม่:

> อ่าน NEXT-COMPUTER.md, AGENTS.md, README.md และส่วนสถานะล่าสุดใน HANDOFF.md แล้วเตรียมโปรเจกต์ PP นี้สำหรับพัฒนาต่อ ใช้ Vercel โปรเจกต์ pp และ Supabase เดิม ตรวจสถานะ Git และดึงโค้ดล่าสุดก่อนแก้ไข ห้ามสร้างฐานข้อมูลใหม่หรือรัน migrations เดิมซ้ำบน Production

## ก่อนเริ่มแก้ในแต่ละเครื่อง

ตรวจว่าไฟล์ในเครื่องมีงานค้างหรือไม่ ถ้ามีให้บันทึกงานนั้นก่อนดึงเวอร์ชันใหม่ ไม่ใช้ reset --hard หรือทิ้งงานเพื่อแก้ปัญหา

```powershell
git status
git pull --ff-only
```

## ก่อนย้ายไปอีกเครื่อง

ให้ Codex ตรวจการเปลี่ยนแปลงและกุญแจลับ ทดสอบตามส่วนที่แก้ แล้ว commit และ push ขึ้น GitHub ให้สำเร็จ การแก้ในเครื่องอย่างเดียวยังไม่ส่งไปอีกเครื่อง

> บันทึกงาน PP ครั้งนี้เป็น commit และ push ไป GitHub ตรวจว่าเครื่องกับ GitHub เป็นเวอร์ชันเดียวกัน เพื่อจะไปทำต่ออีกเครื่อง

เริ่มอีกเครื่องโดยให้ Codex ดึงงานล่าสุดก่อนทุกครั้ง หากแก้ไฟล์เดียวกันพร้อมกันสองเครื่อง ให้รวมการแก้ไขก่อน push ไม่ใช้ force push

## การตั้งค่าเพื่อเปิดเว็บในเครื่อง

- ใช้ .env.example เป็นแบบสำหรับ .env.local ค่าในตัวอย่างไม่ใช่กุญแจจริง
- .env.local และกุญแจ LINE/Supabase/Google ไม่อยู่ใน GitHub ต้องตั้งผ่านบริการเดิมอย่างปลอดภัย ไม่ส่งลงแชตหรือ commit
- npm run dev ใช้เปิดเว็บในเครื่องหลังตั้งค่าที่จำเป็นแล้ว
- npm run check ตรวจ TypeScript, tests และ production build
- Gemini ใช้ Vercel Production identity อยู่เดิม จึงไม่ได้ย้ายสิทธิ์ Gemini มาที่คอมใหม่อัตโนมัติ ให้ปิด AI ใน local จนกว่าจะตั้งสิทธิ์สำหรับ local โดยเฉพาะ

## อัปเดตเว็บจริง

การ push เก็บโค้ดบน GitHub ยังไม่ได้ตั้งให้ deploy อัตโนมัติ งานนี้คงวิธี deploy ไป Vercel โปรเจกต์เดิม ใช้บัญชี Vercel ที่มีสิทธิ์เข้าทีม regener00-creators-projects และตรวจ .vercel/project.json หลังเชื่อมก่อน deploy

```powershell
npx --yes vercel@60.1.3 link --yes --project pp --scope regener00-creators-projects
npx --yes vercel@60.1.3 deploy --prod --yes --project pp --scope regener00-creators-projects
```

ฐานข้อมูล ความจำ คอนเทนต์ ปฏิทิน และไฟล์แนบอยู่ใน Supabase เดิม ไม่รวมใน GitHub และไม่ต้องย้ายเมื่อเปลี่ยนคอม โปรเจกต์ NOOSOL WEBSITE ใช้ร่วมกับแอปอื่น: PP ใช้ schema pp เท่านั้น

## งาน Cloud ล่าสุด · 9 ตุลาคม 2026

โค้ดรุ่นเลขาส่วนตัว **ขึ้น Production แล้ว** ที่เว็บเดิม ผ่าน `npm run check` (434 tests / 32 files, TypeScript, production build) รุ่นโค้ด `f3ba166e07267587a95886b5a6ccab56b6ff2152`, deployment `dpl_B2MfoXXD35PxLdsioN8tqWVoKomu` สถานะ READY อ่านส่วน Personal secretary deployed ท้าย HANDOFF.md ก่อนทำต่อ

Migration ใหม่ `20261009065258_personal_secretary.sql` apply และบันทึก history แล้วครั้งเดียว หลังผู้ใช้อนุมัติใหม่ ใช้ Supabase และ Vercel โปรเจกต์เดิม ห้ามรัน migration นี้หรือ migrations เก่าซ้ำ หน้าเริ่มต้น `/admin/chat`; Content Planner ปิดแล้วและข้อมูลเก่ายังคงอยู่ ความทรงจำเดิม 21 รายการและปฏิทินเดิม 9 รายการตรวจ fingerprint แล้วตรงก่อนเปลี่ยน ระบบเตือนผ่าน LINE ใช้ช่วง 08:00–09:00 เวลาไทยตาม cron เดิม ไม่มีการทดสอบส่ง LINE หรือเรียก Gemini จริงในงานนี้

## สถานะที่นำขึ้น GitHub

- รวม Content Planner, Memory, LINE bot และการแก้ไขถึง 3 ตุลาคม 2026
- รุ่นเว็บที่ตรวจแล้ว: dpl_Gq56rEGa2zsn1khbAiQufAj4j9cv
- การตรวจล่าสุดก่อนย้าย: 412 tests ผ่าน พร้อม TypeScript และ production build
- งาน 5 ตุลาคม 2026 เปลี่ยนเฉพาะการเก็บโค้ด/คู่มือ ไม่เปลี่ยนพฤติกรรมเว็บ
- HANDOFF.md เป็นบันทึกตามเวลา มีข้อจำกัดเก่าอยู่ด้วย ให้ยึดรายการใหม่ล่าสุดและโค้ดปัจจุบัน
