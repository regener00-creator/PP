# Current blocker — 28 October 2026

Google AI probe on the existing Vercel production identity returned HTTP 403 with a billing-related error. The secretary chat is NOT fixed yet. See the final section of HANDOFF.md. Source diagnostics are saved in branch `fix/transient-database-read-recovery`; production still uses `dpl_BDCBcftbDvjXWMKt7eUtiey9u9Lc`. Diagnostic deployment `dpl_H8NjM8h4DwDRz1bTwagjz67u3QbC` is intentionally ERROR and must not be promoted. Check the existing Google Cloud project's Billing account, then rerun the probe and tests before publishing. Never upgrade billing/prepay automatically. No migration is needed.

# PP — ทำงานต่อและสลับคอม

โค้ดหลัก: https://github.com/regener00-creator/PP
เว็บที่ใช้งานจริง: https://pp-theta-beryl.vercel.app

## จุดเริ่มต้นล่าสุด · 28 ตุลาคม 2026

สถานะส่วนนี้แทนรายละเอียดเก่าด้านล่างที่ระบุหน้าแชตเว็บและ cron รายวัน

- Production เดิมใช้โค้ดแก้ปัญหาอ่านฐานข้อมูลชั่วคราว `ffafc4b0617dd45171b161f859ac5e005bba8cef` จาก branch `fix/transient-database-read-recovery`; [Draft PR #1](https://github.com/regener00-creator/PP/pull/1) ยังไม่รวมเข้า `main` ซึ่งอยู่ที่ `75b7255` ณ วันที่ตรวจ จึงห้ามใช้ main รุ่นเก่าทับ Production โดยไม่ตรวจความต่าง
- Deployment `dpl_BDCBcftbDvjXWMKt7eUtiey9u9Lc` สถานะ READY บน Vercel `pp` เดิม; Supabase `NOOSOL WEBSITE` / `uyrwypfrvfhoryuvcujg` ยัง ACTIVE_HEALTHY ใช้ schema `pp` เท่านั้น
- ก่อนเริ่มงานให้ตรวจ `git status`, `git fetch origin` และสถานะ PR ถ้า PR #1 ยังไม่ merge ให้ทำงานต่อจาก branch นี้แล้ว `git pull --ff-only` หาก merge แล้วให้ใช้ main ล่าสุดที่รวมการแก้นี้ ห้ามทิ้งงานค้างในเครื่อง
- เลขา **จำ–ถาม–เตือน–นัดหมาย–คุยทั่วไปผ่าน LINE**; เว็บเริ่มที่ `/admin` สำหรับความจำและปฏิทิน หน้าแชตเว็บเลิกใช้แล้ว Content Planner ยังปิดอยู่
- ตั้งเวลาเตือนได้ต่อรายการ (ค่าเริ่มต้น 08:00 เวลาไทย) Supabase Cron ตรวจทุกนาที ไม่ใช่ cron รายวันเดิม เวลาที่เขียนในเนื้อหานัด LINE ยังไม่เปลี่ยนเวลาเตือนอัตโนมัติ
- Migration history ตรวจแล้วถึง `20261010024025_pp_admin_notebook_snapshot` รวม personal secretary และ minute scheduler ที่ใช้แล้ว ห้ามรันซ้ำ ห้ามสร้างโปรเจกต์ใหม่หรือคืนข้อมูลกลุ่มทดสอบที่ลบไป
- ตรวจหลังล็อกอินวันที่ 28 ต.ค. ผ่านแล้ว: ความจำ/ไฟล์/ตั้งค่า, รีโหลด dashboard, ค้นหาความจำ และฟอร์มเวลาเตือน (แก้เฉพาะร่างแล้วปิด ไม่บันทึกข้อมูลจริง) ไม่พบ browser error หรือ Vercel error/fatal ในช่วงที่ตรวจ
- งานค้าง: ทดสอบเส้นทาง LINE/Gemini และการรับเตือนจริงโดยกำหนดผู้รับและข้อมูลทดสอบก่อนส่งข้อความ; PR #1 ยังเป็น Draft และยังไม่ merge การตรวจหน้าหลังล็อกอินเสร็จแล้ว ไม่ต้องขอให้ผู้ใช้ล็อกอินใหม่โดยอัตโนมัติหาก session ยังใช้ได้
- ผลตรวจวันที่ 28 ต.ค. และข้อจำกัดการทดสอบอยู่ท้าย `HANDOFF.md`

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

โค้ดรุ่นเลขาส่วนตัว **ขึ้น Production แล้ว** ที่เว็บเดิม ผ่าน `npm run check` (443 tests / 33 files, TypeScript, production build) รุ่นโค้ด `82b8d0d89f7e57855b361ca65ec8c6be86be80c7`, deployment `dpl_75d2EEWKzqSudn7VKJAWV8JvkCH6` สถานะ READY อ่านรายการล่าสุดท้าย HANDOFF.md ก่อนทำต่อ

Migration ใหม่ `20261009065258_personal_secretary.sql` apply และบันทึก history แล้วครั้งเดียว หลังผู้ใช้อนุมัติใหม่ ใช้ Supabase และ Vercel โปรเจกต์เดิม ห้ามรัน migration นี้หรือ migrations เก่าซ้ำ หน้าเริ่มต้น `/admin/chat`; Content Planner ปิดแล้วและข้อมูลเก่ายังคงอยู่ ความทรงจำเดิม 21 รายการและปฏิทินเดิม 9 รายการตรวจ fingerprint แล้วตรงก่อนเปลี่ยน ระบบเตือนผ่าน LINE ใช้ช่วง 08:00–09:00 เวลาไทยตาม cron เดิม ไม่มีการทดสอบส่ง LINE หรือเรียก Gemini จริงในงานนี้

ต่อมาผู้ใช้สั่งลบเฉพาะกลุ่ม “ทดสอบบอท” ตรวจ LINE แล้วบอตไม่อยู่ในกลุ่ม และลบข้อมูลกลุ่มสำเร็จ รวมเพื่อน 1 ราย ประวัติ 3 รายการ นัดหมาย 3 รายการ และบันทึกการเตือน 1 รายการ ความทรงจำเดิม 21 รายการยังตรงทุกแถว อีกสองกลุ่มและนัดหมายที่เหลือ 6 รายการไม่เปลี่ยน ห้ามคืนข้อมูลกลุ่มนี้หรือรันคำสั่งออกจากกลุ่มซ้ำโดยอัตโนมัติ `scripts/leave-test-group.mjs` ต้องเรียกเองอย่างชัดเจนเท่านั้น ไม่ได้เป็นส่วนของ npm build หรือ public route

## สถานะที่นำขึ้น GitHub

- รวม Content Planner, Memory, LINE bot และการแก้ไขถึง 3 ตุลาคม 2026
- รุ่นเว็บที่ตรวจแล้ว: dpl_Gq56rEGa2zsn1khbAiQufAj4j9cv
- การตรวจล่าสุดก่อนย้าย: 412 tests ผ่าน พร้อม TypeScript และ production build
- งาน 5 ตุลาคม 2026 เปลี่ยนเฉพาะการเก็บโค้ด/คู่มือ ไม่เปลี่ยนพฤติกรรมเว็บ
- HANDOFF.md เป็นบันทึกตามเวลา มีข้อจำกัดเก่าอยู่ด้วย ให้ยึดรายการใหม่ล่าสุดและโค้ดปัจจุบัน
