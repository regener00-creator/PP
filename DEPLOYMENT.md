# PP — สถานะส่งมอบ 29 กันยายน 2026

## เสร็จแล้ว

- เว็บ production: https://pp-theta-beryl.vercel.app
- Vercel: โปรเจกต์ `pp`, ทีม `regener00-creators-projects`, Next.js 16.3.6 / Node 24
- Deployment ล่าสุด: `dpl_17BD4JUq1jCcibLHMSELjhyNtiHA` สถานะ READY / Production
- ฐานข้อมูลใช้ NOOSOL WEBSITE ตามที่ผู้ใช้เลือก (`uyrwypfrvfhoryuvcujg`) แยกไว้ใน schema `pp`
- สร้างตาราง PP ครบ 6 ตาราง; ตาราง `public` เดิมยังมี 4 ตาราง ไม่ได้แก้เนื้อหาหรือสิทธิ์ของตารางเดิม
- Migration history และไฟล์ในโปรเจกต์ตรงกัน: `20260929034158_pp_initial`, `20260929035036_pp_expose_api`
- Exposed schemas: `public, graphql_public, pp` โดยเพิ่มเฉพาะ `pp` หลังได้รับอนุญาต
- ตั้ง Vercel Production environment แล้ว: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `CRON_SECRET`, `ALLOW_TEXT_TRIGGER=false`
- สร้าง Git repository ในเครื่อง พร้อมซอร์ส, lockfile, migration, tests และ GitHub Actions สำหรับตรวจงาน ไม่มี remote GitHub ที่สร้างหรือ push

## ยังต้องใส่ก่อนเปิดบอท

ใน [Vercel → PP → Environment Variables](https://vercel.com/regener00-creators-projects/pp/settings/environment-variables) ใส่:

1. `SUPABASE_SECRET_KEY` — จาก [API keys ของ NOOSOL WEBSITE](https://supabase.com/dashboard/project/uyrwypfrvfhoryuvcujg/settings/api-keys) ใช้ server secret key และเก็บเป็น Secret
2. `ADMIN_USER_ID` — UUID ของบัญชี Supabase Auth ที่คุณจะใช้ล็อกอินจาก [Authentication → Users](https://supabase.com/dashboard/project/uyrwypfrvfhoryuvcujg/auth/users)
3. `LINE_CHANNEL_SECRET` — จาก LINE Messaging API channel
4. `LINE_CHANNEL_ACCESS_TOKEN` — จาก LINE Messaging API channel

จากนั้น Redeploy, เข้าหน้า `/admin`, ใส่ LINE user ID ของคุณ และเพิ่มความจำ/อนุมัติกลุ่ม ไม่มี memory ของเจ้าของถูกเดาหรือ seed เข้าไป

ตั้ง LINE webhook เป็น:

```text
https://pp-theta-beryl.vercel.app/api/line/webhook
```

เปิด Use webhook, Webhook redelivery และ Allow bot to join group chats ตั้งชื่อบัญชี PP แล้วเชิญเข้ากลุ่มที่คุณอยู่ด้วย รายละเอียดอยู่ใน [README.md](README.md)

## หลักฐานทดสอบ

- Automated tests **60 ผ่าน**: policy, LINE signature/mention, webhook HTTP, admin authorization, bot orchestration และ PostgreSQL ผ่าน PGlite
- TypeScript typecheck ผ่าน
- Production build บนเครื่องและ Vercel ผ่าน
- บน Supabase จริง: ทดสอบ shareable คืนคำตอบ, private คืนเฉพาะ refusal และกลุ่มที่ไม่มีสิทธิ์ถูกปฏิเสธ การทดสอบอยู่ใน transaction ที่ rollback แล้ว ไม่มีข้อมูลทดสอบเหลือ
- บน Supabase จริง: ทั้ง 6 ตารางเปิด RLS, `anon` และ `authenticated` ไม่มี schema usage, `service_role` มี usage
- หลัง expose schema ทดสอบ Data API ด้วย publishable key ได้ HTTP 401 / `42501 permission denied for schema pp` ตามที่ต้องการ
- Supabase security advisor มีเฉพาะ INFO “RLS Enabled No Policy” 6 รายการสำหรับ PP: ตั้งใจปิดการเข้าถึงตรงทั้งหมดและใช้ server-only service role ไม่มีการเพิ่ม policy อนุญาตผู้ใช้ทั่วไป
- Browser: หน้าแรกแสดงผล, มือถือ 390px ไม่มี horizontal overflow, `/admin` พาไป setup เมื่อยังไม่มีบัญชี, หน้า login อธิบายค่าที่ยังขาด ไม่พบ browser errors ในการตรวจ
- HTTP บน production: `/` และ `/api/health` 200; `/admin` 307 ไป setup; `/login` 200; `/api/maintenance` ที่ไม่มีกุญแจ 401; webhook 503 “Not configured” เพราะรอ LINE secret ตามคาด ทุกเส้นทางมี nosniff และ frame DENY
- ตรวจ Vercel production error logs ย้อนหลัง 15 นาทีหลัง deploy: ไม่พบรายการ error ไม่มีการตั้งระบบแจ้งเตือนหรือ log drain เพิ่มในงานนี้

## ขอบเขตที่ยังไม่ยืนยัน

ยังไม่ได้ทดสอบล็อกอิน/CRUD ผ่านบัญชีแอดมินจริง หรือส่งข้อความ/mention เข้ากลุ่ม LINE จริง เพราะยังไม่มีค่าตั้งค่าด้านบน เว็บไซต์ออนไลน์ไม่ได้แปลว่าบอทเริ่มตอบได้แล้ว

`/api/health` เป็น liveness probe เท่านั้น การเชื่อม LINE ที่ยังไม่ตั้งค่าจะตอบ 503; งานบำรุงรักษาจะยังทำงานไม่ได้จนใส่ Supabase secret key แล้ว

ข้อมูล PP แยกตารางจาก NOOSOL แต่ยังใช้ทรัพยากร Auth, โควตา, backup และขอบเขตคีย์เซิร์ฟเวอร์ร่วมกันตามที่แจ้งก่อนเลือกใช้ร่วม

กุญแจใน `.env.local` ไม่อยู่ใน Git, ซอร์ส ZIP หรือไฟล์ที่ Vercel deploy เป็นซอร์ส
