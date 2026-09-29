# PP · LINE group bot V0.1

ตัวแทนของปีโป้ในกลุ่มเพื่อนสนิท เรียกด้วยการ mention บัญชี **PP** จริงใน LINE ตอบจากความจำที่เจ้าของอนุญาต หรือแท็กเจ้าของเมื่อเป็นเรื่องนัดหมายที่ต้องตอบเอง

- เว็บไซต์: https://pp-theta-beryl.vercel.app
- แอดมิน: https://pp-theta-beryl.vercel.app/admin
- Webhook: https://pp-theta-beryl.vercel.app/api/line/webhook
- Vercel project: `pp` ใน `regener00-creators-projects`
- ฐานข้อมูล: **NOOSOL WEBSITE** (`uyrwypfrvfhoryuvcujg`) โดยข้อมูล PP อยู่ใน **schema `pp`** เท่านั้น
- สถานะการเชื่อมต่อและผลตรวจล่าสุด: [DEPLOYMENT.md](DEPLOYMENT.md)

## เริ่มใช้งาน deployment นี้

ตาราง PP ถูกสร้างแล้ว ไม่ต้องรัน initial migration ซ้ำบนฐานข้อมูลนี้ ขณะนี้แอดมินจะล็อกไว้จนใส่ค่าจำเป็นครบ

1. ใน [Vercel Environment Variables](https://vercel.com/regener00-creators-projects/pp/settings/environment-variables) เติมค่าที่ขาดในตารางด้านล่าง เลือก Production และเก็บกุญแจเป็น Secret
2. ใน [Supabase API keys](https://supabase.com/dashboard/project/uyrwypfrvfhoryuvcujg/settings/api-keys) ใช้ secret key ฝั่งเซิร์ฟเวอร์ แนะนำสร้าง key ชื่อ PP เพื่อแยกการเพิกถอนคีย์ได้ อย่าเปลี่ยนคีย์ที่เว็บไซต์เดิมใช้อยู่
3. ใน [Supabase Authentication](https://supabase.com/dashboard/project/uyrwypfrvfhoryuvcujg/auth/users) ใช้บัญชีของคุณที่มีอีเมล/รหัสผ่าน หรือเพิ่มบัญชีสำหรับคุณผ่าน Dashboard คัดลอก UUID มาเป็น `ADMIN_USER_ID` ไม่ใช่ LINE user ID
4. Redeploy PP หลังเพิ่ม environment variables
5. เข้าสู่ระบบ `/admin` ตั้งชื่อและ LINE user ID ของเจ้าของ
6. สร้าง memory พร้อมคำถามตัวอย่างและคำตอบ เริ่มต้นเป็น **private** ต้องเลือก shareable เองก่อนบอทนำไปใช้
7. ตั้งค่า LINE ตามหัวข้อถัดไป จากนั้นอนุมัติกลุ่มในแอดมิน

| ตัวแปร | จำเป็น | ที่มา/ความหมาย |
|---|---|---|
| `SUPABASE_URL` | ใช่ | URL ของ NOOSOL WEBSITE |
| `SUPABASE_PUBLISHABLE_KEY` | ใช่ | Publishable key หรือ legacy anon key ใช้กับ Auth |
| `SUPABASE_SECRET_KEY` | ใช่ | Secret key (`sb_secret_...`) หรือ legacy service_role key ใช้เฉพาะเซิร์ฟเวอร์ |
| `ADMIN_USER_ID` | ใช่ | UUID ของ Supabase Auth user ที่มีสิทธิ์แอดมินเพียงคนเดียว |
| `LINE_CHANNEL_SECRET` | ใช่ | Messaging API channel > Basic settings > Channel secret |
| `LINE_CHANNEL_ACCESS_TOKEN` | ใช่ | Messaging API channel > Channel access token |
| `OWNER_LINE_USER_ID` | ตัวเลือก | ค่าเริ่มต้นก่อนบันทึกเจ้าของในแอดมิน รูปแบบ `U` + hex 32 ตัว ค่าที่บันทึกในแอดมินมีลำดับเหนือกว่า |
| `ALLOW_TEXT_TRIGGER` | ตัวเลือก | `false` โดยปริยาย เปิด `true` เพื่อยอมรับการพิมพ์ `@pp คำถาม` โดยไม่เลือก mention |
| `CRON_SECRET` | ใช่สำหรับล้างประวัติ | สุ่มอย่างน้อย 32 ตัว ใช้ยืนยันงานล้างประวัติเก่า |

ทุกตัวเป็น server environment variable ห้ามตั้ง prefix `NEXT_PUBLIC_` ให้ secret key, channel secret, access token หรือ cron secret และไม่ต้องส่งกุญแจในแชต

## ตั้ง LINE Official Account

1. สร้าง/ใช้ Official Account ที่เปิด Messaging API แล้ว ตั้ง display name ว่า **PP**
2. เปิด **Allow bot to join group chats**
3. ใส่ Webhook URL ด้านบน เปิด **Use webhook** และ **Webhook redelivery** แล้วกด Verify
4. ปิดข้อความตอบกลับอัตโนมัติ/ข้อความทักทายของ Official Account หากไม่ต้องการให้ตอบซ้อนกับ PP
5. เชิญ PP เข้ากลุ่มที่เจ้าของอยู่ด้วย พิมพ์ `@` แล้วเลือกบัญชี **PP** จากรายการ LINE ไม่ใช่แค่พิมพ์ตัวหนังสือ
6. เรียก PP หนึ่งครั้ง กลุ่มจะถูกบันทึกเป็น **ยังไม่อนุมัติ** เข้า `/admin` > กลุ่มและสิทธิ์ แล้วเปิดกลุ่มนี้
7. ค่า owner LINE user ID ต้องอยู่ภายใต้ provider เดียวกับ Messaging API channel หาได้จาก LINE Developers Console ของเจ้าของ หรือจาก webhook ที่เชื่อถือได้ เป็นคนละค่ากับ Basic ID `@xxxx` และ display name

การ mention เจ้าของใช้ `textV2.substitution` จริง บอทตรวจสมาชิกกลุ่มก่อนแท็ก ถ้าตรวจไม่ได้จะไม่เดาว่าเจ้าของยังอยู่ในกลุ่ม ตาม [ข้อกำหนด LINE Text v2](https://developers.line.biz/en/reference/messaging-api/nojs/#text-message-v2)

## พฤติกรรมและขอบเขตของ V0.1

ใช้ **คำถามตัวอย่างที่อนุมัติแล้ว** แทนโมเดลสร้างคำตอบ จึงไม่ต้องมี API key ของ AI และไม่ส่ง memory ให้ผู้ให้บริการ AI อื่น

- ละช่องว่าง เครื่องหมาย `? ! , .` และตัวอักษรซ่อนบางชนิดก่อนเทียบคำถาม แล้วค้นตรงทั้งประโยค
- เพิ่มตัวอย่างหลายรูปประโยคได้ เช่น `ปีโป้ชอบกินอะไร` / `ปีโป้ชอบอาหารอะไร`
- ไม่ค้นบางคำแบบกว้าง ๆ ไม่ใช้ semantic search และไม่จำข้อความในกลุ่มอัตโนมัติ ถ้าพูดคนละสำนวนอาจยังไม่รู้
- คืนเฉพาะคำตอบ shareable ที่ยังไม่หมดอายุ หาก private มีคำถามเดียวกัน private จะมีสิทธิ์ยับยั้งก่อน
- หากพบหลาย memory ที่ตอบคำถามเดียวกัน จะขอไม่ตอบเพื่อหลีกเลี่ยงคำตอบขัดกัน
- เรื่องอ่อนไหวถูกปฏิเสธอย่างเป็นกันเอง ไม่บอกว่ามี private memory หรือไม่ และไม่แท็กเจ้าของ
- เรื่องชวน/นัด/ยืนยันที่ระบุเจ้าของและยังไม่มีคำตอบ จะพยายามแท็กเจ้าของ คำถามทั่วไปที่ไม่รู้จะตอบว่าไม่รู้
- ส่งได้สูงสุด 8 ครั้งต่อผู้ใช้ต่อกลุ่มใน 60 วินาที และแท็กเจ้าของไม่เกินหนึ่งครั้งต่อกลุ่มใน 5 นาที
- owner เป็นผู้ตัดสินใจเรื่อง shareable: ข้อมูลในคำตอบ shareable ถือว่าอนุญาตให้ทุกคนในกลุ่มที่เปิดใช้งานรู้ได้ คำกรองอ่อนไหวเป็นแนวป้องกันเพิ่ม ไม่ใช่ระบบเข้าใจความอ่อนไหวทุกภาษา
- private คือระดับสิทธิ์ในแอป ไม่ใช่ตู้นิรภัยสำหรับรหัสผ่าน ผู้ดูแลฐานข้อมูลและเซิร์ฟเวอร์ยังเข้าถึงได้ตามสิทธิ์

ตัวอย่างในหน้าแรกเป็นข้อมูลสมมติสำหรับอธิบาย ไม่ได้บันทึกเป็นข้อมูลจริงของเจ้าของ

## โครงสร้าง

```text
src/app/api/line/webhook/   ตรวจลายเซ็นดิบ รับ webhook และจัดการ redelivery
src/lib/bot.ts             กลุ่มที่อนุมัติ → สิทธิ์เพื่อน → dedupe → policy → LINE
src/lib/policy.ts          นโยบายตอบ/ปฏิเสธ/เรียกเจ้าของ
src/lib/line.ts            ตรวจ LINE event, mention และ HTTP client
src/lib/auth.ts            ตรวจบัญชีแอดมินกับ Supabase ทุกคำขอ
src/app/admin/             เว็บ CRUD memory, owner, permissions, friends, activity
supabase/migrations/      schema pp และฟังก์ชันฐานข้อมูล
tests/                    นโยบาย, LINE, webhook, admin, orchestration, PostgreSQL
```

ตารางใน schema `pp`: `owner`, `friends`, `memories`, `permissions`, `conversations`, `rate_limits`

`conversations` เก็บ event/group/sender/message ID, สถานะ, decision และเวลาที่ใช้กันตอบซ้ำ **ไม่เก็บข้อความดิบ คำตอบ หรือเนื้อหา private** งาน Vercel Cron ล้างข้อมูลเกิน 30 วันทุกวัน 19:00 UTC (02:00 เวลาไทย)

## ความเป็นส่วนตัวและการใช้ฐานข้อมูลร่วม

ตารางทั้งหมดเปิด RLS และถอนสิทธิ์ `anon`/`authenticated` ทั้ง schema, tables, functions เข้าผ่านเซิร์ฟเวอร์หลังตรวจ Auth UUID หรือ webhook signature เท่านั้น ฟังก์ชันใช้ `SECURITY INVOKER` ไม่มีฟังก์ชันเปิดสิทธิ์สูงแก่ผู้ใช้ทั่วไป

Schema `pp` แยกชื่อตารางและ query จากแอปเดิม แต่ยังใช้ compute/storage/Auth/backup ร่วมกัน กุญแจเซิร์ฟเวอร์ Supabase มีสิทธิ์กว้างทั้งโปรเจกต์ จึงไม่ใช่การแยกขอบเขตเท่าฐานข้อมูลใหม่ หากต้องการแยกความเสียหายเมื่อกุญแจรั่ว ให้ย้าย PP ไป Supabase project ของตัวเองในภายหลัง

การใช้ Auth ร่วมไม่ทำให้ผู้ใช้ NOOSOL เป็นแอดมิน PP: ทุกหน้าและทุก Server Action ตรวจว่า user ID ตรงกับ `ADMIN_USER_ID` ก่อนอ่านเขียนข้อมูล ไม่ต้องเปลี่ยนนโยบายสมัครสมาชิกของ NOOSOL

สำหรับโปรเจกต์ใหม่ให้เพิ่ม `pp` ใน Exposed schemas โดยรักษารายชื่อเดิมไว้ และใช้ grants ที่ migration นี้กำหนด อย่าให้ anon/authenticated เข้าถึง PP ตามตัวอย่างทั่วไปในเอกสาร ดู [Supabase custom schemas](https://supabase.com/docs/guides/api/using-custom-schemas) และ [API access controls](https://supabase.com/docs/guides/api/securing-your-api)

## รันในเครื่องและทดสอบ

ใช้ Node.js 24 LTS:

```sh
npm ci
# คัดลอก .env.example เป็น .env.local และเติมค่าของคุณ
npm run dev
```

```sh
npm run typecheck
npm test
npm run build
```

ชุดทดสอบฐานข้อมูลใช้ PostgreSQL ผ่าน PGlite และทดสอบ SQL จริงโดยไม่ต่อฐานข้อมูล production ไม่ต้องมีคีย์ใด ๆ สำหรับ `npm test` ตรวจทั้ง private canary, RLS, anonymous denial, group/friend permissions, duplicate events, leases, rate limits และ retention

ตรวจ production: `/api/health` เป็น liveness เท่านั้น ไม่ยืนยันว่า LINE/ฐานข้อมูลตั้งค่าครบ `/admin` ต้องเข้าสู่ระบบและ `/api/maintenance` ต้องมีกุญแจ

## Deployment และการดูแล

```sh
npx vercel@60.1.3 login
npx vercel@60.1.3 deploy --prod --project pp --scope regener00-creators-projects --yes
```

Vercel Function ใช้ Node และตั้ง region `sin1` ใกล้ Supabase Singapore, webhook มีเวลาไม่เกิน 60 วินาทีและทุก network call มี timeout งานถูก await ก่อนตอบ HTTP เพื่อให้ LINE redelivery รับช่วงเมื่อเกิดข้อผิดพลาด ไม่มีงานเบื้องหลังที่อาจถูกตัดหลังตอบ 200

- `webhookEventId` ใช้กันซ้ำในฐานข้อมูล Lease 90 วินาทีกันคำขอพร้อมกันและอนุญาตให้รับงานที่หลุดกลับมาทำใหม่ ลองสูงสุด 3 ครั้ง
- LINE reply token ใช้ได้ครั้งเดียว หากหมดอายุหรือส่งซ้ำ API ตอบ 400 จะบันทึก `expired` ไม่ส่ง push ตามหลัง
- ถ้า LINE ส่งสำเร็จแต่การบันทึกสถานะล้มเหลว การ retry อาจจบเป็น `expired` แม้ข้อความส่งไปแล้ว ตรวจ LINE ร่วมกับสถานะ
- แถว `failed` คือส่งไม่สำเร็จหรือสิทธิ์/การเชื่อมต่อผิด ให้ตรวจค่า environment และ LINE Console; เปิด redelivery มิฉะนั้น 503 จะไม่ถูกส่งใหม่
- ถ้า LINE redelivery มาช้ากว่าอายุ reply token อาจไม่ได้คำตอบ นี่เป็นระบบสำหรับกลุ่มขนาดเล็ก ไม่ใช่ระบบคิวที่รับประกันการส่งทุกข้อความ
- เปลี่ยน visibility/ลบ memory มีผลกับคำขอใหม่ทันที ไม่มี cache คำตอบ แต่ลบข้อความที่ส่งเข้า LINE ไปแล้วไม่ได้
- Server logs แสดงเฉพาะรหัสความผิดพลาดและจำนวน ไม่ dump webhook, secret หรือ memory
- ขณะนำระบบขึ้นจริงให้ลอง shareable, private, unknown invite, unknown general, กลุ่มที่ไม่ได้อนุมัติ และการถอด owner ออกจากกลุ่ม ด้วยข้อมูลทดสอบที่คุณอนุญาต

อ้างอิงการตรวจลายเซ็นและการรับ webhook: [LINE webhooks](https://developers.line.biz/en/docs/messaging-api/receiving-messages/) ส่วน Server Actions ตรวจสิทธิ์ทุกครั้งตาม [Next.js data security](https://nextjs.org/docs/app/guides/data-security)
