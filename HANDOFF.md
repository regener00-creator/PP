# สถานะส่งต่อ GitHub — 5 ตุลาคม 2026

โค้ดหลักย้ายขึ้น Private repository https://github.com/regener00-creator/PP แล้ว ใช้ branch main คู่มือเครื่องใหม่อยู่ใน NEXT-COMPUTER.md สถานะ “ยังไม่ commit/push” ในบันทึกด้านล่างเป็นประวัติก่อนย้าย ไม่ใช่สถานะปัจจุบัน เก็บ environment/credentials ไว้ภายนอก Git; ไม่เปลี่ยนฐานข้อมูลหรือ deployment ในขั้นตอนย้ายครั้งนี้

# PP — ทำงานต่อบนเครื่องใหม่

## ผู้ช่วยจัดการความจำ 3 อย่าง · 1 ตุลาคม 2026 เวลา 15:52 น. ไทย

สถานะนี้แทนคำอธิบายเดิมที่ AI อ่านเฉพาะตัวอย่างคำถาม

- หน้า ความทรงจำ → เพิ่มความจำ ใช้ชื่อและข้อมูลเป็นหลัก คำถามตัวอย่างไม่จำเป็น Gemini อ่านทุกก้อนที่ผ่านสิทธิ์/expiry ภายในเพดาน 128,000 UTF-8 bytes ไม่ตัดไว้ 40 ก้อนเดิม ตอบด้วยเนื้อหาที่เจ้าของบันทึกเท่านั้น ไม่ฝึกโมเดลใหม่หรืออ่านรูป/ไฟล์แนบ
- ก่อนบันทึก ตรวจ duplicate/related/conflict และให้เลือกแก้ก้อนเดิม/รวมข้อมูล/เก็บแยก การรวมเก็บข้อความและไฟล์ให้เจ้าของตรวจ มี receipt HMAC อายุ 10 นาทีผูก draft + catalog; SQL lock และตรวจ snapshot ซ้ำก่อน save/merge หากข้อมูลเปลี่ยนต้องตรวจใหม่ หาก AI ล้มเหลวต้องเลือกยืนยันบันทึกโดยยังไม่ได้ตรวจเอง
- ใต้รายการความจำเพิ่ม ความจำที่ต้องตรวจ พร้อมปุ่ม ตรวจความจำทั้งหมด สำหรับข้อมูลเดิม แสดงสูงสุด 40 คู่ที่ AI พบต่อการตรวจ และ 100 คู่ล่าสุดในคิว การตอบ exact/semantic ในกลุ่มและ DM ปฏิเสธข้อขัดกันที่ยังไม่แก้ ไม่มีการเลือกคำตอบโดยเดา; คิวผูก row revision การเปลี่ยนสีหรือเรียงการ์ดคงข้อขัดกันไว้
- ใช้ Gemini/Google WIF/environment เดิม การตรวจความจำใช้โควตาเดียวกับการจับคู่ 6 ครั้ง/นาที + 1,000/เดือน ค่า tokens มากขึ้นตามเนื้อหาที่ส่ง คง server-only ACL/RLS และ legacy private protections ไม่เปลี่ยน group learning scope/approval
- Migrations 20261001081525_pp_memory_assistant.sql และ 20261001084039_pp_memory_issue_layout.sql ใช้ใน NOOSOL WEBSITE schema pp แล้ว เพิ่มตาราง memory_issues และ helper server-only ไม่มี public/anon/authenticated access
- Production READY dpl_BYhwVU1zGm9VeF5PnKKRvaHoQstE / https://pp-5zofs0ve2-regener00-creators-projects.vercel.app; alias https://pp-theta-beryl.vercel.app
- ตรวจ full suite 346 tests / 22 files ผ่าน, typecheck/local build/Vercel build ผ่าน หลังปรับ cosmetic revision และ form retention ตรวจ DB 85 tests + memory/library/calendar actions 33 tests ผ่านซ้ำ
- Gemini จริงผ่าน 8/8 คำถามสมมติที่ใช้ title/content และไม่มี examples รวม น้ำท่วมป่ะ, รถเข้าได้ไหม, แยกบุคคล/เวลา/สถานที่ และ contradictory facts
- Browser Production: ตรวจ duplicate ของน้ำท่วมแล้วปิดร่างโดยไม่แก้ของจริง; เพิ่ม fixture หมดอายุไม่มี examples สำเร็จ; Gemini พบข้อขัดกันสีเขียว/แดง; ยืนยันเก็บแยกแล้วคิวแสดง 1 คู่; หน้ารวมแสดงข้อความทั้งสองครบก่อนยืนยัน ไม่ได้กดลบ/รวมผ่าน UI ทดสอบ atomic merge + stale guard ผ่าน SQL transaction แล้ว rollback
- พบและแก้ React form reset: คงวันหมดอายุแบบ controlled และไม่ reset ไฟล์แนบระหว่าง review/confirmation; CUA fill date ไม่ส่ง React change ต้องใช้ ArrowUp เพื่อทดสอบเหตุการณ์จริง ยืนยันวันหมดอายุคงเดิมและ confirm บันทึกสำเร็จ
- ล้าง fixtures QA-749 ทั้งสองพร้อม issue แล้ว SQL ยืนยัน 10 memories เดิม / 0 temporary records ไม่มีข้อความ LINE ส่งออกจากการทดสอบ จึงยังไม่ยืนยันการรับข้อความจริงใน LINE สำหรับรุ่นนี้
- ข้อจำกัด: AI อาจพลาดคู่ซ้ำ/ขัดกัน; 128 KB เกินแล้วหยุด ไม่ใช่ retrieval แบบ vector; ข้อขัดกันของ learned group suggestions ใช้หน้ารอตรวจกลุ่มเดิม ไม่ปะปน manual memory_issues; old saveMemory Server Action คงไว้รองรับ client รุ่นก่อน แต่ UI ใหม่ใช้ saveAssistedMemory ทั้งหมด
- Runtime latest deployment ไม่มี error/fatal ในช่วงตรวจ; Supabase advisors baseline INFO 16 server-only tables ไม่มี policy และ Auth leaked-password warning เดิมของโปรเจกต์ร่วม ไม่เปลี่ยน Auth
- ซอร์สสำรอง ../PP-source.zip อัปเดตแล้ว รวมสอง migration/โค้ด/ทดสอบใหม่ ไม่รวมกุญแจ build artifacts หรือ node_modules ไม่ commit/push งานสะสม

## AI ทั้งกลุ่มและแชตส่วนตัว · 1 ตุลาคม 2026 เวลา 14:40 น. ไทย

สถานะนี้แทนข้อจำกัด owner-only/exact-only ของแชตส่วนตัวในประวัติด้านล่าง

- สาเหตุคำถามน้ำท่วมไม่ตอบ: เส้นทาง DM เดิมค้น exact อย่างเดียว ไม่เรียก Gemini และละเว้นผู้ส่งที่ไม่ใช่เจ้าของ ขยาย `processDirectMessage` ให้ทุกบัญชีที่ไม่ถูกพักถาม shareable memories ได้ ไม่ต้องใส่ @ ส่วนกลุ่มที่เปิดใช้งานยังต้องเรียก `@pp` / `@น้องโจอา` หรือ mention จริง
- `semanticDirectMatch` ใช้การจับความหมายและโควตาเดียวกับกลุ่ม 6 ครั้ง/นาที + 1,000 ครั้ง/เดือนรวมทุกแชต Exact answer ไม่เรียก AI เพิ่มตัวอย่างภาษาไทย ไหม/มั้ย/ปะ/ป่ะ/หรือเปล่า และห้ามตีความสถานะน้ำท่วมที่บันทึกเป็นพยากรณ์อนาคต/พื้นที่อื่น
- Apply `20261001072625_pp_owner_semantic_matching.sql` แล้ว `20261001073157_pp_direct_semantic_chat.sql` บน NOOSOL WEBSITE แล้ว ไม่เพิ่ม env/cron/tables ฟังก์ชัน SECURITY INVOKER, empty search_path, service_role only ตัวแรกคงไว้รองรับ rolling deployment
- DM RPC ตรวจ event lease ที่ผูกกับ sender และสถานะ blocked ก่อนและหลัง AI; เจ้าของปัจจุบันยกเว้น blocked ส่วนบัญชีอื่นที่ถูกพักในกลุ่มใดจะไม่ได้รับคำตอบ ผู้ส่งไม่จำเป็นต้องเคยอยู่ในกลุ่ม ความจำ/ไฟล์ shareable ใช้ตอบ DM ได้ แต่ private เก่าคง owner-only, ไม่ส่ง AI และไม่เผยชื่อไฟล์/ลิงก์ให้เพื่อน ความจำจาก group learning ไม่ถูกนำมาใช้ใน DM
- ไม่เปลี่ยน group learning: ยังคงสรุปเฉพาะกลุ่มที่เปิด และรอตรวจ/อนุมัติ ไม่ได้ฝึกโมเดลจากทุกคำถาม การตอบใช้ข้อความที่เจ้าของบันทึกเท่านั้น
- Production READY `dpl_4DvWtEptypUwx5HKnmbLJW1DGrSy` / https://pp-fat6ccedo-regener00-creators-projects.vercel.app; alias https://pp-theta-beryl.vercel.app
- ตรวจ typecheck, 330 tests / 21 files และ Vercel production build ผ่าน ครอบคลุม actual sender, blocked, private/files, lease/duplicate, shared quota, stale revision และ ambiguous safeguards
- Gemini จริงผ่าน 8/8 ข้อผ่านหน้าแอดมิน รวม `น้ำท่วมป่ะ`, `น้ำท่วมไหม` → match และ `พรุ่งนี้เชียงใหม่จะน้ำท่วมไหม` → unknown ใช้ 8 calls ยอดเดือนนี้ 31/1000 ณ ทดสอบ ไม่มีข้อความ LINE ส่งออกหรือความจำสมมติถูกบันทึก ภาพหลักฐาน ../PP-flood-ai-check.png
- Production SQL smoke ใช้ owner และ synthetic nonowner ตรวจ direct claim → exact unknown → flood candidate → validated stored answer ผ่านแล้ว rollback ทั้งหมด ไม่เหลือ event ทดสอบ ไม่เรียก Gemini ใน transaction; ผล Gemini จริงเป็นการตรวจแยกข้างต้น
- Runtime deployment ล่าสุดไม่มี error/fatal ในช่วง 07:33–07:43Z; Supabase Advisors เหลือ baseline INFO 15 server-only tables กับ Auth leaked-password warning เดิมของโปรเจกต์ร่วม ไม่เปลี่ยน Auth ดู https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- ซอร์สสำรอง ../PP-source.zip ต้องรวมสอง migration ใหม่ ไม่รวม secrets/build artifacts ไม่ commit/push งานสะสมโดยพลการ

## ยกเลิกตัวเลือก Private · 1 ตุลาคม 2026 เวลา 14:20 น. ไทย

- ความจำและไฟล์ใหม่ใช้ shareable เสมอ เอา selector/ป้าย Private–Shareable และตัวนับส่วนตัวออกจากหน้าแอดมิน รวมข้อความบนหน้าแรก/คู่มือเริ่มต้น เพิ่มและแก้ไขข้อมูลได้โดยไม่เจอตัวกรองบังคับ Private
- Migration `20261001070842_pp_shareable_defaults.sql` ใช้บน NOOSOL WEBSITE แล้ว เปลี่ยน DEFAULT สองตารางเท่านั้น ก่อนทำตรวจพบ 10 memories + 1 file เป็น shareable ทั้งหมด ไม่มี private และไม่มีการแปลงแถวเดิม Storage bucket ยังคง public=false, RLS/ACL/legacy private SQL veto/file restrictions/owner DM authorization คงเดิม
- saveMemory เพิ่มใหม่บังคับ shareable; การแก้ไข memory/file ไม่รับการเปลี่ยน visibility; private payload จากฟอร์มเก่าให้รีเฟรชก่อน ไม่มีการเปลี่ยนข้อมูลเก่าให้เผยแพร่โดยเงียบ
- ยกเลิก isSensitive veto บนความจำที่เจ้าของกรอกเองและ semantic candidates เพื่อไม่บล็อกคำปกติ เช่น รหัสสินค้า โมเดลเลือกได้เฉพาะ ID ที่อนุมัติ SQL ตรวจสิทธิ์/expiry/revision ซ้ำก่อนคืนคำตอบ ไม่รู้ใช้ข้อความที่เจ้าของตั้งเอง ระบบเรียนรู้จากบทสนทนายังผ่านตัวกรองและรออนุมัติเหมือนเดิม; unknown เรื่องอ่อนไหวยังไม่แท็กเจ้าของ
- ตรวจ 303 tests / 21 files, typecheck และ Vercel production build ผ่าน ครอบคลุม default, stale forms, legacy protection, RLS, uploads, SQL, learning, exact/semantic routing ผ่าน mock ไม่ส่ง LINE และไม่เรียก Gemini จริงในงานนี้
- Production Ready `dpl_FmVyAZaPqiSzjFHAd2Q6Whzo4E6p` / https://pp-bxhcw3r58-regener00-creators-projects.vercel.app alias https://pp-theta-beryl.vercel.app
- Browser ตรวจหน้า dashboard, popup เพิ่มความจำ, ตัวเลือกโฟลเดอร์/รูปแนบ, หน้าคลังไฟล์และ popup แก้ไขไฟล์ ไม่มีตัวเลือก/ป้าย Private–Shareable, console error ไม่มี ไม่บันทึกข้อมูลทดสอบจริง ภาพ ../PP-memory-sharing.png
- Advisors คง INFO RLS no policy 15 ตารางซึ่งใช้เฉพาะ server และ WARN Auth เดิมของโปรเจกต์ร่วม ไม่ได้เปลี่ยนการตั้งค่า Auth: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- ส่วนประวัติด้านล่างอธิบาย behavior ของรุ่นก่อน ให้ยึดหัวข้อนี้สำหรับโหมดความจำปัจจุบัน

## ตั้งข้อความเมื่อไม่รู้คำตอบ · 1 ตุลาคม 2026

- เพิ่มช่องด้านบน `/admin/settings#unknown-reply` หัวข้อ ข้อความเมื่อไม่รู้คำตอบ เพิ่ม/ลบได้ 1–20 ชุด แต่ละชุดเขียนหลายบรรทัดได้ กดบันทึกแล้วสุ่มหนึ่งชุดต่อ unknown ทั้งกลุ่มและ owner DM การสุ่มมีโอกาสซ้ำ ไม่มี cache/query เพิ่มในเส้นทางตอบ ใช้ owner select เดิม
- เปลี่ยนข้อความเดิมสองบรรทัดเป็นค่าเริ่มต้น “ยังไม่มีข้อมูลเรื่องนี้” ใช้ migrations `20261001063310_pp_unknown_reply.sql` แล้ว `20261001063825_pp_unknown_reply_variants.sql` ซึ่งนำข้อความเดิมมาเป็นตัวเลือกแรกไม่เขียนทับ เก็บคอลัมน์ `pp.owner.unknown_replies` text[] not null 1–20 ชุด ชุดละ 1–2,000 ตัวอักษร ห้าม whitespace/null ผ่าน SQL validation function server-only คง RLS/grants/owner identity เดิม ส่วนคอลัมน์ unknown_reply เก็บชุดแรกไว้ให้เข้ากันกับ deployment ก่อนหน้า
- `saveUnknownReply` requireAdmin ก่อนตรวจค่า/เข้าฐานข้อมูล รับเฉพาะ getAll(unknown_replies) update id=1 ไม่รับ owner ID จากฟอร์ม ตรวจผล single ก่อนแจ้งสำเร็จ; unknownReplies() ให้รายการค่าที่ใช้ได้และ unknownReply() สุ่มด้วย Math.random เฉพาะ unknown ไม่แก้ refuse/handoff/ambiguous/known answers
- 143 tests / 5 files และ typecheck ผ่าน รวม bot→LINE payload แบบ mock สุ่มตัวเลือกแรก/ท้าย, owner DM ไม่ส่ง AI, privacy refusal, auth boundary, validation, multiline/multiple, forged owner fields, SQL constraints และ regression ฐานข้อมูลทั้งหมด
- Vercel build ผ่าน Production Ready `dpl_7sjbnR7BoWg6x46qpMB8FippCwfX` / https://pp-4zvtfg1gv-regener00-creators-projects.vercel.app; alias https://pp-theta-beryl.vercel.app
- Browser production เพิ่มชุดที่สองโดยใช้ข้อความเดิมซ้ำเพื่อคงผลตอบจริง บันทึกแล้ว SQL อ่านได้ 2 ชุด โหลดใหม่ยังอยู่ ทดสอบลบชุดซ้ำและบันทึกคืนเป็นค่าเริ่มต้น 1 ชุด ไม่มีข้อความทดสอบอื่นค้าง ไม่มี deployment error/fatal ระหว่างตรวจ หลักฐาน ../PP-unknown-replies.png; สำรอง ../PP-source.zip
- ไม่ส่ง LINE เพื่อทดสอบ ช่องตั้งค่าเป็นข้อความสำหรับส่งให้ผู้ถาม จึงไม่ใช้ตัวกรอง Private ของความจำมาบล็อกข้อความตั้งค่านี้ ไม่แก้ข้อความปฏิเสธหรือสิทธิ์ของความจำ
- Advisors เดิม: RLS ไม่มี policy 15 ตารางตาม server-only design และ Auth leaked-password warning ของโปรเจกต์ร่วม https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## เรียนรู้จากกลุ่มแบบรอตรวจ · 1 ตุลาคม 2026

- เพิ่ม `/admin/learning` แยกกลุ่ม แท็บรอตรวจ/อนุมัติ ค้นหา ข้อความอ้างอิง แก้ไข/อนุมัติ/ลบ หยุดจำรายคน และจำนวนรอบ/ค่า AI ไม่มีข้อความ LINE ออกระหว่างสรุป ไม่มี auto-approval
- Production Ready `dpl_4R7e54uiPHFZK3LhMnn1GQEcwNMv` / https://pp-8ol0671gi-regener00-creators-projects.vercel.app; alias https://pp-theta-beryl.vercel.app
- Apply migration `20261001054547_pp_group_learning.sql` แล้ว เพิ่ม 4 ตาราง RLS server-only และ RPC claim/finish/review/unsend/opt-in ใช้ learned answers ผ่าน retrieval เดิมที่ recheck กลุ่ม/สมาชิก/สถานะ/revision/Private veto ทุกครั้ง ไม่ข้ามกลุ่ม
- ผู้ใช้เลือก **กลุ่มโจอา** (`C308a4d0ce73367194a184c4d06ac8058`) เปิดผ่าน pp_set_learning_group เวลา 2026-10-01T06:11:27.903209Z (13:11 ไทย) รู้จักสมาชิก 6 คน อีกสองกลุ่ม learning_enabled=false
- รับเฉพาะ signed group text ใหม่หลัง opt-in ไม่มี DM/ไฟล์/รูป บันทึกไม่เกิน 500 ตัวอักษร, 100 ข้อความ/กลุ่ม/วัน, คิวรวม 5,000; กรองความอ่อนไหวก่อนเก็บและก่อนส่งโมเดล ส่งชื่อกับข้อความให้ Google โดยแทน LINE IDs ด้วย p0/p1; ร่างตรวจ attribution กับข้อความจริงใน DB
- Webhook ใช้ Next after เมื่อเก็บข้อความสำเร็จเพื่อสรุปไม่บล็อก reply และ maintenance เดิมช่วยประมวลผลวันละครั้ง ไม่เพิ่ม cron; reserve แบบ atomic หนึ่ง slot ทุก 6 ชั่วโมงไทยและสูงสุด 120/เดือนรวมทุกกลุ่ม แยกจาก ai_usage เดิม maxRetries=0, 20 วินาที, output 1,000 tokens; failure นับรอบด้วย แต่คิวลองใหม่ได้ใน slot ถัดไป
- Raw 7 วัน, pending 30 วัน, approved พร้อม evidence 90 วันจาก created_at; cleanup ประจำวัน ลบ unsend ทั้งร่าง/อนุมัติและมี tombstone กัน redelivery ส่วน opt-out รายคนลบข้อมูลเรียนรู้คนนั้น; ปิดกลุ่มลบ raw/pending และทำ approved ใช้ไม่ได้โดยไม่ลบทิ้ง
- 285 tests / 20 files, typecheck, local และ Vercel build ผ่าน รวม signed capture/auth/limits/sensitivity/untrusted model output/source verification/private veto/draft exclusion/group isolation/revocation/unsend/retention
- Production service_role transaction ทดสอบ capture→claim→finish เป็น pending→ยังไม่ตอบ→อนุมัติ→ตอบเฉพาะกลุ่ม→unsend→ไม่ฟื้นจาก redelivery แล้ว rollback ทุกแถวทดสอบ ไม่ส่ง LINE ไม่เรียกโมเดลใน transaction และไม่ใช้โควตาค้าง
- Browser ตรวจเมนู กลุ่มติ๊กเปิด จำนวนกลุ่ม 1 สมาชิก 6 ชื่อ แท็บ ค้นหา และปุ่มสรุปคิวว่างได้ข้อความ “ยังไม่มีข้อความใหม่ที่พร้อมสรุป” 0/120, $0; **ยังไม่มีข้อความใหม่จริงเข้าคิวขณะส่งมอบ จึงยังไม่ได้ยืนยัน Gemini สรุปบทสนทนาจริงของกลุ่มนี้** ห้ามอ้างว่าทดสอบจริงแล้ว
- พบ Database operation failed เมื่อเปิดหน้าครั้งแรก หลัง reload ใช้งานได้ตามอาการเดิม ยังไม่ได้แก้ cold connection; error log ไม่มีเพิ่มหลัง 06:11Z ระหว่างทดสอบ ปุ่มลองใหม่ของ error boundary อาจต้องรีโหลดเต็มหน้า
- Supabase Advisors: INFO RLS ไม่มี policy 15 ตารางตาม server-only design และคำเตือน Auth เดิม Leaked Password Protection Disabled ของโปรเจกต์ร่วม ไม่แก้ Auth งานนี้: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- ภาพหลักฐาน ../PP-group-learning.png; สำรอง ../PP-source.zip ไม่มี secrets ไม่ commit/push
- ข้อจำกัด: ยังใช้ semantic matcher เดิมซึ่งรับไม่เกิน 40 candidates ต่อกลุ่ม หากมากกว่านี้จะไม่ใช้ AI จับคู่และยังตอบ exact match ได้ ไม่มีการเรียนรู้ข้ามกลุ่มหรือปรับบุคลิกบอทอัตโนมัติ การกรองเนื้อหาเป็น heuristic ต้องตรวจร่างเสมอ

## ความจำใหม่เพิ่มต่อท้าย · 1 ตุลาคม 2026

- ใช้ migration 20261001052545_pp_memory_append.sql เปลี่ยน default sort_order เป็น sequence ที่เริ่มหลังลำดับสูงสุดและจำนวนรายการเดิม คงตำแหน่ง สี เนื้อหา และสิทธิ์เดิมทั้งหมด
- sequence CACHE 1 จัดสรรเลขแยกกันเมื่อเพิ่มพร้อมกัน และยังอยู่ท้ายหลัง RPC จัดเรียงที่ปรับลำดับเป็น 1..จำนวนรายการ ห้าม reset sequence ลงเมื่อจัดเรียงหรือลบ หากนำเข้าข้อมูลพร้อมกำหนด sort_order เองต้องเลื่อน sequence ให้มากกว่า max(sort_order) และ count(*) ด้วย
- อัปเดตฐานข้อมูล Production แล้ว เว็บเดิมใช้ default ใหม่นี้ทันที ไม่ต้อง deploy แอปใหม่
- 54 database tests และ typecheck ผ่าน ครอบคลุมฐานข้อมูลว่าง/ลำดับเดิมซ้ำ/ลำดับเว้นช่วง เพิ่มหลังจัดเรียง แก้ไข ลบ และสิทธิ์ anon/authenticated
- ตรวจจริงด้วย service_role เพิ่มแถวทดสอบแบบ transaction: ลำดับ 7 ต่อท้าย 6 รายการ แล้ว rollback ยืนยันไม่มีแถวทดสอบค้าง ไม่มีการส่ง LINE
- Advisors ไม่มีปัญหาใหม่: INFO RLS ไม่มี policy ตาม server-only เดิม และคำเตือน Auth เดิม https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## เปลี่ยนข้อความเมื่อยังไม่มีคำตอบ · 1 ตุลาคม 2026

- เปลี่ยน UNKNOWN ใน src/lib/policy.ts เป็นข้อความสองบรรทัดตามผู้ใช้:
  😅 อันนี้ยังไม่มีคำตอบ
  ✨ แต่ถ้าอยากรู้ว่าตอบอะไรได้บ้างพิมพ์ว่า คำสั่ง
- เปลี่ยนเฉพาะข้อความ fallback ไม่เปลี่ยน trigger หรือเพิ่มคำสั่งใหม่ ตรวจผล decide และ 57 tests ใน policy/bot/owner-chat ผ่าน Vercel build/typecheck ผ่าน ไม่ส่งข้อความ LINE เพื่อทดสอบ
- Production Ready dpl_51gwzNz1D7zMu4KVgKbBWXLJJhky / https://pp-2rszyv5bq-regener00-creators-projects.vercel.app; alias https://pp-theta-beryl.vercel.app

## ลากก้อนความจำได้ทันที · 1 ตุลาคม 2026

- ก้อนความจำหน้าใช้งานปกติรองรับกดค้างแล้วลากทั้งก้อน ไม่ต้องเข้าโหมดจัดเรียง/สี วางบนก้อนอื่นแล้วเรียงและบันทึกอัตโนมัติผ่าน saveMemoryLayout/RPC เดิม ไม่มี migration
- ใช้ useOptimistic แสดงลำดับใหม่ทันที ระหว่างบันทึกปิดการแก้ไขซ้อน หากบันทึกผิดพลาดคืนรายการจาก server และแสดงข้อความ ไม่บันทึกเมื่อปล่อยนอกก้อนหรือวางตำแหน่งเดิม ป้องกัน click ที่ตามหลังลากเปิด popup โดยยังคลิกครั้งเดียว/Enter เพื่อแก้ไขได้
- รองรับ Alt+ลูกศรซ้าย/ขวาเพื่อย้ายแบบคีย์บอร์ด ปุ่มจัดเรียง/สีและการบันทึกสีแบบเดิมยังอยู่ ลากในโหมดแก้สีเป็นร่างจนกดบันทึกเหมือนเดิม
- ลบข้อความ การตอบรับจาก LINE ไม่ยืนยันว่าผู้รับอ่านแล้ว · หากส่งไม่สำเร็จ PP จะไม่ส่งย้อนหลังในวันถัดไป ใต้การแจ้งเตือนล่าสุด
- Typecheck, 247 tests / 18 files, local และ Vercel production build ผ่าน
- Production Ready dpl_7VrzUvEjxQAg9CWHoD5i72aV5LQ1 / https://pp-ibyffrzo1-regener00-creators-projects.vercel.app; alias https://pp-theta-beryl.vercel.app
- ทดสอบลากจริงผ่าน cua.getTab(...).drag() บน Chrome 5: บ้านเปิดจากตำแหน่งแรกไปสองได้โดยไม่กดจัดเรียง ไม่มี dialog เปิดหลังปล่อยเมาส์ SQL อ่านกลับตรงกัน รีโหลดแล้วยังคงลำดับใหม่ ลากกลับคืนลำดับเดิมสำเร็จ คงสีเหลืองของ คำสั่งทั้งหมด และคลิกปกติหลังลากเปิดแก้ไขได้ ปิด dialog โดยไม่แก้เนื้อหา
- Browser ไม่พบ console warnings/errors และ runtime deployment ไม่มี error/fatal ในช่วงทดสอบ หลักฐาน ../PP-direct-drag.png; สำรอง ../PP-source.zip

## ก้อนความจำเตี้ยลง จัดเรียงและใส่สี · 1 ตุลาคม 2026

- ความจำสูงคงที่ 116px แทนสี่เหลี่ยมตามความกว้าง จอคอมยัง 10 ก้อนต่อแถว หน้าละ 20 ก้อน สูงสุด 2 แถว เฉพาะความจำ ไม่เปลี่ยนก้อนปฏิทิน
- ช่องค้นหาอยู่แถวเดียวกับ เพิ่มความจำ พร้อมปุ่ม จัดเรียง/สี ปรับตามขนาดจอ มือถือแคบจัดแถวใหม่เพื่อไม่ล้น
- โหมดจัดเรียงมีที่จับลาก ปุ่มเลื่อนก่อนหน้า/ถัดไปใช้ได้ด้วยคีย์บอร์ดและข้ามหน้า เลือก 4 สี เขียว เหลือง แดง ฟ้า กดสีเดิมล้างสี ปุ่มบันทึกสีและลำดับ/ยกเลิก ไม่เขียน DB จนกดบันทึก ปิดค้นหาและเพิ่มขณะกำลังจัดเรียงเพื่อไม่ทำข้อมูลร่างหาย
- migration 20261001043509_pp_memory_layout.sql เพิ่ม card_color แบบ nullable/constraint 4 สี กับ sort_order ใน pp.memories คงลำดับเดิมตอนย้าย schema รายการใหม่ขึ้นต้นรายการ pp_search_memories เรียงตามลำดับที่บันทึกและคงขอบเขตค้นหาสูงสุด 200
- pp_save_memory_layout รับเฉพาะ id/สีและบันทึกทั้งชุดเป็นธุรกรรมเดียว ตรวจแอดมินก่อน RPC ตรวจ UUID/สี/รายการซ้ำ/จำนวน/รายการที่ลบไปแล้ว ล็อกการเขียนเฉพาะตารางความจำขณะจัดเรียง รักษาตำแหน่งของรายการที่ถูกซ่อนจากคำค้น ไม่แก้เนื้อหา private/shareable หรือ updated_at; RPC security invoker อนุญาตเฉพาะ service_role; anon/authenticated ไม่มี EXECUTE
- ตรวจ Supabase Advisors: ไม่มีปัญหาใหม่ มี INFO RLS ไม่มี policy 11 ตารางตามการออกแบบ server-only และคำเตือนเดิม Leaked Password Protection Disabled ของโปรเจกต์ร่วม ไม่เปลี่ยน Auth; อ้างอิง https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Typecheck, 247 tests / 18 files, local และ Vercel build ผ่าน ครอบคลุม auth/ตรวจ payload/สีที่ไม่อนุญาต/รายการซ้ำ/รายการหาย/ธุรกรรม/ค้นหาบางรายการ/รักษาสิทธิ์ private
- Browser local fixture 41 รายการตรวจ 116px, 10x2, หน้า 3 เหลือ 1, ย้ายจากหน้าแรกไปหน้าสอง, เปลี่ยนสี, ยกเลิกคืนลำดับ/สี ไม่มี console errors ลบ fixture ก่อน build และ deploy; native drag handler ยังไม่ได้ทดสอบลากจริงผ่าน browser tool แต่ปุ่มเลื่อนที่ใช้ logic เดียวกันผ่าน
- Browser production ทดสอบเปลี่ยนสี/ลำดับ กดบันทึก SQL อ่านกลับและ reload ยืนยันคงอยู่ จากนั้นคืนค่าเดิมทั้งหมด ไม่มีการแก้เนื้อหาความจำ/ปฏิทินหรือส่ง LINE
- Production Ready dpl_AXvWjDJurUByHBVTZqdujZenXbix / https://pp-p3wg4oh97-regener00-creators-projects.vercel.app; alias https://pp-theta-beryl.vercel.app
- การโหลด admin ครั้งแรกพบ Database operation failed เหมือนอาการเดิม รีโหลดแล้วใช้งาน/บันทึกได้ งานนี้ไม่ได้แก้ปัญหาเชื่อมต่อฐานข้อมูลชั่วคราว
- ภาพหลักฐาน ../PP-memory-layout.png และ ../PP-memory-colours.png; ซอร์สสำรอง ../PP-source.zip

## อัปเดตเพื่อนในกลุ่ม · 1 ตุลาคม 2026

- แก้สาเหตุที่เพิ่มกลุ่มแล้วเห็นเฉพาะคนเคยเรียกบอท: webhook ที่ผ่านการตรวจลายเซ็นเพิ่มรหัสสมาชิกเมื่อส่งข้อความ/สติกเกอร์/รูป หรือมี memberJoined ในกลุ่มที่เปิดใช้งานแล้ว ไม่ต้อง mention บอท ไม่ตอบข้อความทั่วไป ไม่ส่งเข้า AI ไม่เก็บเนื้อหาดิบหรือเปลี่ยนสิทธิ์กลุ่ม
- discoverGroupFriends รับเฉพาะข้อมูลตัวตน ข้าม private chat/standby/บัญชีบอท และ upsert แบบไม่เขียนทับชื่อหรือสถานะ blocked เติมชื่อใหม่ด้วย LINE profile เป็นชุดละ 4 คน timeout 3 วินาที ใช้เงื่อนไขชื่อเดิมป้องกันเขียนทับการแก้ไขระหว่างโหลด รอให้ทั้งขั้นตอนตอบและเพิ่มเพื่อนจบก่อนตอบ webhook
- เพิ่มตัวเลือกกลุ่มและปุ่ม อัปเดตรายชื่อ ใน สิทธิ์/เพื่อน/ประวัติ ตรวจสิทธิ์แอดมินและกลุ่มที่เปิดใช้งาน อ่าน LINE member IDs แบบแบ่งหน้า/ป้องกัน cursor ซ้ำ ถ้าบัญชีไม่รองรับ (403) แสดงวิธีให้เพื่อนส่งข้อความหนึ่งครั้งและยังเติมชื่อสมาชิกที่รู้จักได้
- ทดสอบปุ่มบน production กับกลุ่ม ทดสอบบอท แล้ว LINE ตอบข้อจำกัด 403 จริง ไม่สามารถดึงสมาชิกทั้งกลุ่มในครั้งเดียวได้ ตามข้อกำหนด API เฉพาะ verified/premium: https://developers.line.biz/en/reference/messaging-api/#get-group-member-user-ids
- อ่าน DB ยืนยันปัจจุบันมีชื่อ P 3 P O (ฉัน) ในทั้งสองกลุ่ม ยังไม่มีสมาชิกคนอื่นส่งข้อความให้ตรวจ flow จริงหลัง deploy จึงไม่อ้างว่าซิงก์สมาชิกทั้งหมดแล้ว ขั้นต่อไปให้สมาชิกอื่นส่งข้อความหรือสติกเกอร์ใหม่ แล้วกดอัปเดตรายชื่อ
- Production Ready dpl_5f8JMGj9WpheReB3UhiX2kvspBba / https://pp-6r3prclke-regener00-creators-projects.vercel.app; alias https://pp-theta-beryl.vercel.app
- Typecheck, 237 tests / 17 files, local และ Vercel build ผ่าน ทดสอบ auth/ลายเซ็น/กลุ่มปิด/ข้อความทั่วไป/สมาชิกใหม่/รักษาชื่อและ blocked/LINE failure/แบ่งหน้า/403 และการรอ webhook ทั้งสองงาน ไม่มี schema migration ไม่ส่งข้อความ LINE ไม่แก้ความจำหรือปฏิทิน
- Browser production โหลดได้และแสดงข้อความข้อจำกัดตรงผล LINE ไม่พบ console warnings/errors หรือ deployment error/fatal logs ในช่วงตรวจ หลักฐาน ../PP-friends-refresh.png; อัปเดต ../PP-source.zip

## โฟลเดอร์ไฟล์แนบและชื่อเพื่อน · 1 ตุลาคม 2026

- AttachmentPicker ในความจำและปฏิทินเริ่มด้วยเลือกโฟลเดอร์งานก่อนแสดงไฟล์ พร้อมหมวดไม่จัดโฟลเดอร์ แสดงจำนวนไฟล์ที่ใช้ได้ในแต่ละโฟลเดอร์ เก็บการเลือกข้ามโฟลเดอร์และไฟล์แนบเดิม ใช้ hidden inputs ส่งรายการเลือกทั้งหมดครั้งเดียว สูงสุด 10 ไฟล์
- CalendarBoard/MemoryBoard รับ folders จากหน้า admin ที่อ่านพร้อม query เดิม รายการส่งกลุ่มยังกรองเฉพาะ Shareable ไม่มีการเปลี่ยนสิทธิ์ไฟล์
- FriendMentionSelect โหลดชื่อเมื่อเลือกกลุ่มโดยไม่ขวางการเปิดหน้า ชื่อเจ้าของ fallback จาก owner และใส่ (ฉัน) เปลี่ยนกลุ่มแล้วล้างคนที่เลือก สมาชิกที่ blocked ไม่อยู่ในรายการ เพื่อนที่ยังไม่รู้ชื่อเลือกใหม่ไม่ได้ มีโหลดชื่อซ้ำและลิงก์แก้ชื่อ
- loadFriendNames เป็น Server Action ที่ requireAdmin ตรวจ group ID และกลุ่ม enabled อ่านเฉพาะสมาชิกที่ไม่ blocked เติมชื่อที่ว่างครั้งละ 20 คน/พร้อมกัน 4 คนจาก LINE group member profile ตรวจ userId ตรงกันและ timeout 3 วินาทีต่อครั้ง ไม่เขียนทับชื่อเจ้าของตั้งไว้ ใช้เงื่อนไขชื่อเดิม/blocked/group ป้องกัน concurrent edits ไม่บันทึก token/รูปโปรไฟล์ และไม่ส่งข้อความ LINE
- หน้า สิทธิ์/เพื่อน/ประวัติ แสดงชื่อแทนรหัสยาว ยังแก้ชื่อเรียกได้ รายชื่อยังอาศัยเพื่อนที่เคยเรียกบอทในกลุ่ม ไม่ได้ดึงสมาชิกทุกคน
- ลบข้อความ ส่งช่วง 08:00–09:00 น. เวลาไทย ไม่ส่งย้อนหลังหลังช่วงนี้ ... ใต้ฟอร์มปฏิทินตามคำขอ เวลาและเงื่อนไขแจ้งเตือนคงเดิม
- Production Ready `dpl_2uA7onPDwJjvLjR1TCwsH9VdhHYR` / https://pp-lrbn6wgcy-regener00-creators-projects.vercel.app; alias https://pp-theta-beryl.vercel.app
- Typecheck, 219 tests / 16 files, local และ Vercel build ผ่าน เพิ่ม tests สำหรับ auth/disabled group/profile mismatch/LINE failure/รักษาชื่อที่ตั้งเองและ concurrent edits
- Browser local ตรวจ 12 ไฟล์/หลายโฟลเดอร์: ไม่แสดงไฟล์ก่อนเลือก, เก็บ 10 ไฟล์ข้ามโฟลเดอร์, ไฟล์ที่ 11 เลือกไม่ได้, เอาออกแล้วเลือกต่อได้, ไม่แสดง Private เมื่อส่งกลุ่ม, คง 2 ไฟล์แนบเดิมเมื่อแก้ความจำ, เปลี่ยนกลุ่มล้างผู้ถูกแท็กและกรอง blocked; ไม่มี console errors ลบ fixture ก่อน deploy
- Production ตรวจโฟลเดอร์ NOOSOL ตอบลูกค้า แล้วเห็น 1.jpg ยืนยันชื่อ P 3 P O (ฉัน) จาก LINE และ SQL อ่านกลับ display_name ของบัญชีเจ้าของในกลุ่มปลาจาระเม็ดนึ่งบ๊วยถูกต้อง ไม่มี schema migration และไม่แก้รายการปฏิทิน/ความจำหรือส่ง LINE
- หน้า admin ครั้งแรกหลัง deploy พบ Database operation failed เช่นที่เคยพบก่อนหน้า ปุ่ม reset ไม่ฟื้น แต่ reload หน้าแล้วใช้งานและตรวจฟอร์มได้ เหตุจาก log ยังไม่ระบุ query หรือต้นเหตุ งานนี้ไม่ได้แก้ระบบ retry ของฐานข้อมูล
- หลักฐานภาพ: ../PP-folder-attachments-friends.png; สำรองซอร์ส: ../PP-source.zip

## แบ่งหน้าการ์ดความจำและปฏิทิน · 1 ตุลาคม 2026

- รายการความจำและรายการทั้งหมดใช้ TilePages ร่วมกัน แสดงหน้าละ 20 ก้อน จอคอม 10 คอลัมน์ สูงสุด 2 แถว มีปุ่มก่อนหน้า/ถัดไปและเลขหน้าแยกกัน หน้าจอเล็กยังปรับเป็น 5/3 คอลัมน์
- รายการทั้งหมดเปลี่ยนเป็นก้อนสี่เหลี่ยม พร้อมชื่อ วันที่ สถานะการแจ้งเตือน และคลิกแก้ไขได้ เพิ่มเส้นคั่นก่อนหัวข้อ
- ค้นหาแล้วเริ่มหน้าแรก ลบจนหน้าสุดท้ายว่างแล้วกลับหน้าที่มีข้อมูล ปฏิทินรายเดือนยังแสดงกิจกรรมทั้งหมดที่ตรงคำค้น ไม่ถูกจำกัดด้วยหน้าการ์ด
- คงเพดานค้นหาความจำเดิม 200 ผลลัพธ์ และปฏิทิน 100 รายการ ไม่มี migration หรือเปลี่ยนข้อมูลจริง
- Production Ready `dpl_BDKUxuKY9DCweiEE89oK9eRZC85j` / https://pp-duf5jxrwo-regener00-creators-projects.vercel.app; alias https://pp-theta-beryl.vercel.app
- Typecheck, 209 tests / 14 files, local build และ Vercel build ผ่าน
- Browser fixture 41 รายการต่อส่วนยืนยัน 10 คอลัมน์ / 2 แถว, หน้า 2 จำนวน 20 ก้อน, หน้า 3 จำนวน 1 ก้อน, clamp หลังลดเหลือ 40, ค้นหา reset, แบ่งหน้าแยกกัน และเปิดฟอร์มแก้ไขถูกการ์ด ลบ fixture ก่อน build/deploy
- Browser production ยืนยันการ์ดจริง 1 ความจำ / 3 ปฏิทิน ปุ่มแบ่งหน้าทั้งสองส่วนและเส้นคั่นถูกต้อง ไม่พบ console errors ไม่บันทึกข้อมูลทดสอบหรือส่ง LINE

## เปิดแจ้งเตือนเมื่อบันทึกปฏิทิน · 1 ตุลาคม 2026

- เอาสวิตช์ เปิดส่งแจ้งเตือนอัตโนมัติตามรายการนี้ ออกจาก EventEditor และปรับคำอธิบายบนปฏิทินให้ตรงกัน
- saveCalendarEvent กำหนด enabled=true ฝั่ง server สำหรับ insert/update ทุกครั้ง ไม่พึ่ง checkbox ที่ถูกลบ ผู้ใช้ยังต้องเลือกวันเตือนและผู้รับ; ตรวจ owner LINE ID, กลุ่ม, เพื่อน, ไฟล์ และ requireAdmin เหมือนเดิม
- ไม่เปลี่ยนสถานะรายการเก่ายกชุด รายการที่เคยปิดจะเปิดเมื่อเจ้าของบันทึกรายการนั้นอีกครั้ง เวลาแจ้งเตือนเดิม 08:00–09:00 น.
- Production Ready `dpl_6UBMEMHrPqvx2uG2sjLnLWZocVS1` / https://pp-g3197uux2-regener00-creators-projects.vercel.app; alias https://pp-theta-beryl.vercel.app
- Typecheck, 209 tests และ Vercel build ผ่าน เพิ่ม 6 regression cases สำหรับการสร้าง/แก้ไขแบบไม่มี enabled field, วันที่ due, validation และ auth
- Browser production ยืนยันฟอร์มวันที่ 10 ต.ค. ไม่มีสวิตช์ เตือนวันนั้น/ส่งเจ้าของเลือกไว้ และปิดได้ ไม่บันทึกข้อมูลทดสอบหรือส่ง LINE จริง
- พบ Database operation failed ตอนโหลดแอดมินครั้งแรก อ่านฐานข้อมูลได้ปกติและ reload หน้าแล้วกลับมาใช้งานได้ ตรวจฟอร์มสำเร็จหลัง reload ไม่มีการเปลี่ยนฐานข้อมูลหรือเพิ่ม retry ในงานนี้

## แอปเดสก์ท็อปน้องโจอา · 1 ตุลาคม 2026

- เพิ่ม PWA manifest ชื่อ น้องโจอา, stable id /, start_url /admin, scope /, display standalone และไอคอน 180/192/512/maskable; title/applicationName/themeColor ใน root metadata
- หน้า public /install พร้อมขั้นตอน Chrome/Edge และปุ่มติดตั้งใน sidebar แอดมิน; provider เก็บ beforeinstallprompt ข้าม client navigation, เรียก native prompt จากการคลิกเท่านั้น มีคำแนะนำเมื่อไม่รองรับ/ยกเลิก/ผิดพลาด และตรวจ standalone/appinstalled
- ใช้ข้อมูลและสิทธิ์เดิม ต้องต่ออินเทอร์เน็ต ไม่มี service worker/offline cache, native bridge, credential หรือสิทธิ์ใหม่ การเปิด /admin ยังต้องล็อกอินเจ้าของ
- Production Ready `dpl_uxgBCG3s5ATwXjEwimNRVnaPPKwi` / https://pp-inromsa2a-regener00-creators-projects.vercel.app; alias https://pp-theta-beryl.vercel.app
- Typecheck, 203 tests, local/Vercel build ผ่าน; ตรวจ manifest/icons/health production และ unauthenticated /admin -> /login ผ่าน Browser ตรวจหน้าติดตั้ง/การขยายคู่มือ ไม่พบ browser/runtime errors
- เปิดหน้าติดตั้ง production ไว้ให้ผู้ใช้ ยังไม่ได้ยืนยันหน้าต่างติดตั้งของ Chrome/Edge หรือทดสอบเปิดจาก Windows Start จริง ไม่ได้สร้างข้อมูลหรือส่ง LINE

## ชื่อเรียก LINE น้องโจอา · 1 ตุลาคม 2026

- รองรับคำเรียกที่พิมพ์เอง `@น้องโจอา` และ `@pp` เมื่อ ALLOW_TEXT_TRIGGER=true โดยต้องเริ่มข้อความและเว้นวรรคก่อนคำถาม; LINE mention จริงตรวจด้วยตัวตนบัญชีเหมือนเดิม ไม่ผูกกับ display name
- ไม่รับชื่อที่ยาวต่อท้ายหรือ mention จริงของบัญชีอื่น; แชตส่วนตัวเจ้าของตัดคำเรียกใหม่ก่อนค้นหา Private ได้ สิทธิ์และการกรองข้อมูลเดิมทั้งหมด
- Production Ready `dpl_2aGWkYyitF5mNXuFtkQhyHxSU5uc` / https://pp-1wlezl3gf-regener00-creators-projects.vercel.app; alias https://pp-theta-beryl.vercel.app
- Typecheck, 203 tests และ Vercel build ผ่าน; health ตอบ status=ok และไม่พบ error/fatal logs หลัง deploy ยังไม่ได้ส่งข้อความทดสอบจริงใน LINE

## แนบ 10 ไฟล์และจัดแถวฟอร์มปฏิทิน · 1 ตุลาคม 2026

- ความจำและปฏิทินแนบได้สูงสุด 10 ไฟล์ รวมรูปกับเอกสาร; ขนาดต่อไฟล์ยัง 3 MB ใช้ MAX_ATTACHMENTS ร่วมกันใน picker/server และ migration `20261001014521_pp_ten_attachments.sql` ขยาย constraints ของสองตารางใน schema pp แล้ว
- LINE: 1–4 attachments ส่งแยกเหมือนเดิม; 5–10 ส่ง Flex carousel เดียวพร้อมคำตอบ ทุกไฟล์เรียงตาม attachment_ids รูป Shareable มีภาพตัวอย่าง ส่วน Private มีเฉพาะลิงก์ล็อกอินเจ้าของ ไม่มี public preview ไม่มีการส่ง push เพิ่มเพื่อตอบคำถาม
- ฟอร์มปฏิทิน: เรื่อง/วันที่/ทำซ้ำทุกปี, ข้อความ, ปุ่มวันเตือน/เส้นแบ่ง/แชตส่วนตัว, กลุ่ม/เพื่อน, ไฟล์แนบ ปุ่มสีน้ำตาลหมายถึงเลือกอยู่ ใช้ native checkbox ใต้ปุ่มและย่อแถวเมื่อจอแคบ
- Production Ready `dpl_BZ2MynTqzLMmYXZkMbc5XUnzaJAt` / https://pp-5joffe8jp-regener00-creators-projects.vercel.app; alias https://pp-theta-beryl.vercel.app
- Typecheck, 189 tests และ Vercel build ผ่าน; ทดสอบ PostgreSQL รับ 10 ปฏิเสธ 11 ทั้งสองตาราง ตรวจ production constraints <=10 validated=true ตรวจ browser ปุ่มเปิด/ปิด เลือกกลุ่ม วันที่ 10 ต.ค. และ counter 0/10 ในทั้งสองฟอร์ม ไม่มี browser/runtime errors ไม่บันทึกข้อมูลทดสอบและไม่ได้ส่ง LINE จริง
- ไม่แก้ sensitivity filter หรือวิธีเปิดรูป Private ตามคำสั่งยกเลิกงานก่อนหน้า


## ปฏิทินเพิ่มจากวันที่และเส้นคั่น · 1 ตุลาคม 2026

- เอาปุ่ม เพิ่มรายการ ออก; เพิ่ม hr ใต้ปฏิทินก่อน รายการความจำ พร้อมระยะห่างและเส้นสีเดียวกับธีม
- Production Ready dpl_CVHheDhcRmrEj1jmRP2abfkXTniw / https://pp-hky12yg4h-regener00-creators-projects.vercel.app; alias เดิม
- Typecheck และ Vercel build ผ่าน; browser เจ้าของตรวจพบเส้นคั่นและไม่พบปุ่ม เพิ่มรายการ คลิกวันที่ 10 ต.ค. เปิดฟอร์มพร้อมวันที่ 2026-10-10 ถูกต้อง ปิดโดยไม่บันทึก ไม่พบ browser errors
- ตรวจหน้า merged ของรอบก่อนบน browser จริงได้แล้ว: สถิติ ปฏิทิน รายการความจำ รายการทั้งหมด การแจ้งเตือนล่าสุด และโควตาล่างสุดเรียงถูกต้อง

## รวมหน้า ความทรงจำ · 30 กันยายน 2026

- /admin เปลี่ยนชื่อหน้าและเมนูเป็น ความทรงจำ ลบเมนูปฏิทิน; /admin/calendar redirect ไป /admin#calendar
- ลำดับ: สถิติ 4 ช่อง, ปฏิทิน, รายการความจำ, รายการทั้งหมดของปฏิทิน, การแจ้งเตือนล่าสุด ตามด้วย Gemini แบบพับและโควตา LINE ล่างสุด
- CalendarBoard รับ children เพื่อวาง MemoryBoard ระหว่างตารางวันกับ event list โดยยังใช้ state ปฏิทินและ dialog เดิม; ข้อมูลโหลดขนานรวมกลุ่ม/ไฟล์ครั้งเดียว requireAdmin ก่อนอ่านเหมือนเดิม
- ลบแถบคำอธิบาย เรียกด้วย @pp และหัวข้อปฏิทิน; หน้าใหม่ h1 ความทรงจำ แทนคำทักทาย
- Production Ready dpl_AEfAoQ1k5wLe7wGCzJ6XwMjJ6DCM / https://pp-4ddy1f2z9-regener00-creators-projects.vercel.app; alias https://pp-theta-beryl.vercel.app
- Typecheck, 181 tests และ local/Vercel build ผ่าน; review ลำดับ DOM, server/client children composition และ revalidatePath เดิม
- ยังตรวจ interaction/screenshot หลังล็อกอินรอบนี้ไม่ได้: Chrome 4 ไม่เชื่อมต่อแล้ว IAB ไป /admin ถูกส่งไป /login จึงไม่ได้เข้าถึงเนื้อหาที่ป้องกัน ไม่มีการแก้ข้อมูลจริงหรือส่ง LINE

## ลดข้อความในฟอร์มความจำ · 30 กันยายน 2026

- ลบข้อความช่วย 4 จุดที่ผู้ใช้ระบุออกจาก MemoryForm ร่วม ทั้งเพิ่มและแก้ไข: Private/แชตส่วนตัว, เงื่อนไขแท็ก LINE, พิมพ์ @ชื่อ และหนึ่งคำถามต่อบรรทัด
- เปลี่ยนเฉพาะข้อความ ไม่เปลี่ยนสิทธิ์ การบันทึก หรือพฤติกรรมบอท
- Production Ready dpl_23wgNWrof7UFmrDpn25yyxR4K6nB / https://pp-pqh204ovh-regener00-creators-projects.vercel.app; alias เดิม
- Typecheck และ Vercel build ผ่าน; ตรวจฟอร์มเพิ่ม/แก้ไขบนเว็บจริงแล้ว ข้อความทั้ง 4 หายไป ช่องกรอกและไฟล์แนบอยู่ครบ ไม่มีการบันทึกข้อมูลทดสอบ

## เลือกไฟล์แนบด้วยการ์ดรูป · 30 กันยายน 2026

- AttachmentPicker เปลี่ยนจาก select multiple เป็นการ์ด checkbox แสดงรูปตัวอย่างเต็มภาพ (object-fit contain), ชื่อ, สิทธิ์ และขนาด; เอกสารแสดงชนิดไฟล์แทนภาพ คลิกเลือก/ยกเลิก ไม่ต้องกด Ctrl และมีกรอบพร้อมคำว่า เลือกแล้ว กับตัวนับ 0–3
- สูงสุด 3 ไฟล์ใน UI และ validation ฝั่ง server เดิม; รองรับ keyboard/focus และ form reset หลัง action, ไฟล์ที่ถูกกรองออกจะไม่ถูกส่งไปกับฟอร์ม. ใช้ร่วมกันทั้งความจำและปฏิทิน
- รูปใช้ tokenless /api/files/:id ที่ตรวจ admin เหมือนเดิม ไม่เปลี่ยน visibility หรือเปิด public storage; lazy loading/async decoding และ fallback เมื่อโหลดภาพไม่สำเร็จ
- Production Ready dpl_GviuGF5JQ3koghndX4ou9d6fdC5e / https://pp-7nn5j6x2k-regener00-creators-projects.vercel.app; alias เดิม
- Typecheck, 181 tests, local/Vercel build ผ่าน; browser จริงแสดง 1.jpg 1080px และ Private 96 KB, เลือกแล้ว input attachment_ids เป็น ID ที่ถูกต้อง, Space ยกเลิกได้, จอแคบเป็น 2 คอลัมน์และไม่ล้น
- Browser ปฏิทินเลือก Private แล้วเปลี่ยนเป็นส่งเข้ากลุ่ม: การ์ดถูกซ่อน ตัวนับเป็น 0 และไม่มี checked input ส่งต่อ ไม่มีการบันทึกหรือส่ง LINE ในการตรวจ; console ไม่พบ errors

## ปรับความเร็วหน้าแอดมิน · 30 กันยายน 2026

- ใช้ /admin/layout.tsx ร่วมกัน คงเมนูระหว่างเปลี่ยนหน้า; loading.tsx แสดงสถานะทันที และ AdminNav ใช้ usePathname / useLinkStatus พร้อม prefetch เต็มหน้าเมื่อชี้หรือโฟกัสเมนู ไม่ใช้ shared cache สำหรับข้อมูลส่วนตัว
- แยก LINE quota และ SemanticStatus ด้วย Suspense ไม่ให้ข้อมูลรองขวางการแสดงปฏิทิน/ความจำ; การตรวจ quota ก่อนส่ง LINE ของจริงยังอ่านสดเหมือนเดิม
- Proxy เปลี่ยนจาก getUser เป็น getClaims เพื่อตรวจลายเซ็น/refresh ตาม Supabase SSR docs (https://supabase.com/docs/guides/auth/server-side/creating-a-client); ตรวจ public JWKS แล้วเป็น ES256. ทุก page/action/download ยัง requireAdmin ผ่าน getUser ตรวจผู้ใช้ปัจจุบัน โดย React cache รวม layout/page ภายใน render เดียวเท่านั้น
- หน้าต่างใช้ useLayoutEffect เปิดก่อน paint เอา backdrop blur และ global smooth scrolling ออก ลดเงาหน้าต่าง; คลิกพื้นหลังยังไม่ปิด ปุ่มปิดและ Esc ทำงาน
- ค้นหาความจำใช้ next/form และ Link เพื่อลด full document reload; input key ผูกคำค้นเพื่อล้างค่าให้ตรง URL
- Production Ready dpl_CedoFd4xxnMXUth1taRco1FSkyWR / https://pp-i988e78bb-regener00-creators-projects.vercel.app / alias เดิม
- Typecheck, 181 tests และ local/Vercel build ผ่าน รวม 9 tests ใหม่สำหรับ live owner authorization, revoked/wrong/missing user, configuration และ refresh cookie forwarding. ไม่มี mutation ข้อมูลจริงหรือข้อความ LINE ในการตรวจ
- Browser เวลา click ถึง heading visible (รวม overhead ของ automation, เป็นรอบ spot check ไม่ใช่ production percentile): ก่อนแก้ ความจำ 2518ms ปฏิทิน 1127ms สิทธิ์ 798ms; หลังแก้ 905ms/1024ms/975ms; รอบกลับหน้าที่โหลดไว้ ความจำ 84ms ปฏิทิน 111ms ส่วนสิทธิ์/ไฟล์ยังราว 1 วินาที จึงไม่รับประกันว่าทุกหน้าจะได้ 0.1 วินาที
- Browser ยืนยันค้นหา/ล้าง, modal เปิดปิด, backdrop ไม่ปิด, quota แสดง 0/300 และ nav active ถูกหน้า มี main/shell เดียว ไม่พบ console/deployment errors. HTTP ทั้ง 4 admin routes ที่ไม่ล็อกอิน 307 ไป /login, private no-store และไม่มีเนื้อหาที่ป้องกัน

## แยกหน้าจัดการและขยายหน้าต่าง · 30 กันยายน 2026

- /admin/settings รวมเจ้าของ กลุ่มและสิทธิ์ เพื่อน และการตอบล่าสุด ในชื่อ สิทธิ์/เพื่อน/ประวัติ พร้อมเมนูแยก; /admin เหลือความจำและสถานะ AI เอาปุ่ม ดูความจำ ออก
- หน้าใหม่ยัง requireAdmin ก่อนอ่านข้อมูลและ parallel queries; ฟอร์มเจ้าของ/สิทธิ์/เพื่อน revalidate ทั้ง admin layout เพื่อให้หน้าใหม่และปฏิทินแสดงข้อมูลล่าสุด
- หน้าต่างเพิ่ม/แก้ไขความจำและปฏิทินกว้างสูงสุด 1120px จาก 700px เพิ่มขนาดตัวอักษรและช่องกรอก รองรับจอเล็ก; ทุก dialog ไม่ปิดจากการคลิกพื้นหลัง ปิดด้วยปุ่ม ปิด หรือ Esc
- ย้าย LINE quota เป็นส่วนสุดท้ายของหน้าปฏิทินหลังประวัติการแจ้งเตือน
- Production Ready: dpl_Fycx8HMAPZaKEKhhXiCi5kCGaz1T / https://pp-1gq5tgl8f-regener00-creators-projects.vercel.app; alias https://pp-theta-beryl.vercel.app
- Typecheck, 172 tests, local/Vercel build ผ่าน; browser จริงยืนยันทั้งสองหน้าต่างกว้าง 1120px กรอกข้อมูลสมมติแล้วคลิกพื้นหลังข้อความยังอยู่ ปิดด้วย Esc/ปุ่มได้ ไม่มีการบันทึกข้อมูลทดสอบหรือส่ง LINE
- Browser ยืนยันหน้าใหม่มี 4 ส่วนและไม่มีความจำ; หน้าความจำไม่มีฟอร์มเจ้าของ/กลุ่ม/เพื่อน/ประวัติ; quota เป็น main last child; หน้าต่างและหน้าใหม่ไม่ล้นบนจอแคบ ตรวจ browser error และ deployment error logs ไม่พบรายการ
- HTTP /admin/settings ที่ไม่ล็อกอินได้ 307 ไป /login

## ปรับหน้าตาปฏิทินและเอาอีโมจิออก · 30 กันยายน 2026 19:35 น.

- เอาอีโมจิและไอคอนตัวอักษรตกแต่งออกจากหน้าเว็บ เมนู ปุ่ม การ์ด ไฟล์ ตัวอย่างข้อความ และสถานะ ใช้ข้อความบอกสิทธิ์/สถานะแทน ไม่แก้เนื้อหาที่ผู้ใช้บันทึกหรือข้อความตอบ LINE
- ช่องวันแสดงเลขอย่างเดียว ไม่มีกรอบปุ่มย่อยหรือเครื่องหมาย + ปุ่มโปร่งใสครอบพื้นที่วันทั้งหมด กดกลางช่องเปิดฟอร์มวันที่นั้น และปุ่มรายการเดิมแยกกดเพื่อแก้ไข
- เอาหัวข้อ MAKE ROOM FOR IMPORTANT DAYS และ ปฏิทินของฉัน ออก ซ่อนป้ายค้นหารายการด้วย aria-label แทน ย้ายข้อความข้อจำกัดไว้แถวเดียวกับปุ่ม เพิ่มรายการ และลดพื้นที่ว่างส่วนหัว
- Production dpl_6dbQU5VoHVghK9JovcuzWc5PqBAp (https://pp-6vaca3y16-regener00-creators-projects.vercel.app) Ready / alias เดิม
- Typecheck, 172 tests และ Vercel build ผ่าน; browser จริงยืนยัน 30 ช่องวันที่เป็นตัวเลขล้วน border=0, ข้อความและปุ่มอยู่แถวเดียวกัน, คลิกกลางวันที่ 10 เปิดวันที่ 2026-09-10, เปลี่ยนเดือนตุลาคมมีวันที่ 31 และไม่มี horizontal overflow บนจอแคบ

สถานะ ณ 30 กันยายน 2026 (เวลาไทย) เอกสารนี้สรุปสถานะสำหรับเจ้าของและ Codex บนเครื่องใหม่ อ่านร่วมกับ README.md, DEPLOYMENT.md และ GOOGLE-IDENTITY.md

## สำหรับเจ้าของ

1. คัดลอก PP-source.zip ไปเครื่องใหม่ผ่านแฟลชไดรฟ์หรือพื้นที่เก็บไฟล์ส่วนตัว แล้วแตก ZIP จะได้โฟลเดอร์ PP
2. เปิดแอปที่ใช้ Codex เข้าบัญชีเดิม แล้วเพิ่มโฟลเดอร์ PP เป็นโปรเจกต์ในเครื่อง เลือกโฟลเดอร์ที่มี package.json และเอกสารนี้
3. เริ่มแชตในโปรเจกต์ แล้วส่งข้อความ: “ทำต่อจากโปรเจกต์ PP เดิม อ่าน HANDOFF.md, README.md และ DEPLOYMENT.md ก่อน ตรวจความพร้อมของเครื่องใหม่ และเชื่อมกับ Vercel pp / Supabase NOOSOL WEBSITE เดิม โดยยังไม่เปลี่ยนระบบที่ใช้งานจริง”
4. หากต้องเข้าบริการจริง ให้ล็อกอิน Vercel / Supabase / Google / LINE ด้วยบัญชีเดิมตามที่ต้องใช้ และเชื่อมปลั๊กอินที่จำเป็นบนเครื่องใหม่

บอทที่ใช้งานอยู่รันบน Vercel และเก็บความจำใน Supabase จึงไม่ต้องเปิดเครื่องเก่านี้ค้างไว้ ถ้าต้องการเพียงเพิ่มหรือแก้ไขความจำ เปิด https://pp-theta-beryl.vercel.app/admin จากเครื่องใหม่ได้เลย

ZIP เป็นไฟล์ต้นฉบับปัจจุบันรวมส่วนที่ยังไม่ได้ commit ไม่ใช่ประวัติแชตหรือประวัติ Git ไม่มี .env.local, กุญแจลับ, node_modules, .next, .vercel หรือข้อมูลจริงจากฐานข้อมูล Git บนเครื่องเดิมยังไม่มี remote จึงยังไม่มี repo ออนไลน์ให้ clone

การซิงก์แชตกับการเข้าถึงไฟล์เป็นคนละส่วน อย่าอาศัยการเข้าบัญชีเดิมเพียงอย่างเดียวเพื่อย้ายไฟล์: [OpenAI — Projects and chats](https://learn.chatgpt.com/docs/projects#use-local-projects-for-folders-and-codebases)

## สถานะที่ทำเสร็จแล้ว

- PP เป็น LINE bot ตัวแทนของปีโป้ / ปป เรียกในกลุ่มด้วย mention จริงหรือข้อความ @pp / @PP
- ตอบจากความจำ Shareable ที่เจ้าของบันทึกและอนุญาต ใช้ Gemini ช่วยจับความหมายของคำถามในกลุ่ม แต่คำตอบส่งจากความจำเดิม ไม่ให้โมเดลแต่งคำตอบ
- Private ไม่ตอบในกลุ่ม แม้ผู้ถามเป็นเจ้าของ และไม่ส่งคำถามตัวอย่างหรือเนื้อหา Private ไปให้ Gemini
- เจ้าของถาม Private / Shareable ในแชตส่วนตัวกับ PP ได้โดยไม่ต้องใส่ @pp ตรวจตัวตนด้วย LINE user ID ที่ตั้งในแอดมิน ตรวจซ้ำพร้อม lease ในฐานข้อมูล ใช้คำถามตรงกับตัวอย่างที่บันทึก ไม่ใช้ AI ใน DM
- คนอื่นส่ง DM จะถูกละเว้น คำกล่าวอ้างว่าเป็นเจ้าของหรือ display name ไม่เปิดสิทธิ์
- คำถามสถานะปัจจุบัน เช่น “วันนี้อยู่บ้านไหม” ส่งต่อด้วย LINE mention จริง ไม่เดาจากความจำเก่า
- มี checkbox “แท็กเจ้าของพร้อมคำตอบ” ต่อความจำ ใช้ได้กับ Shareable ที่ผ่านสิทธิ์กลุ่ม ตรวจสมาชิกและ cooldown 5 นาที พิมพ์ @ชื่อ ในเนื้อหาอย่างเดียวไม่ใช่ mention จริง
- แอดมินธีม chocolate / cream ฟอนต์ Sarabun ใช้พื้นที่เต็มความกว้าง ความจำใหม่เริ่มต้นเป็น Shareable ตามคำขอเจ้าของ
- ทดสอบล่าสุด: TypeScript, 172 automated tests (รวม 47 PostgreSQL tests) และ Vercel build ผ่าน
- ทดสอบ SQL สิทธิ์ Private ด้วย transaction แล้ว rollback ผ่าน; หน้าแอดมินจริงโหลดได้แล้วหลัง refresh PostgREST schema cache
- ยังไม่ได้ยืนยันการถามและตอบ Private ใน LINE DM จริง ให้เจ้าของสร้าง Private แล้วส่งคำถามที่บันทึกไว้เอง ไม่ส่งข้อความทดสอบแทนเจ้าของโดยพลการ

## ความจำแบบการ์ด คลังไฟล์ และปฏิทิน · 30 กันยายน 2026

- หน้าแอดมินใช้การ์ดสี่เหลี่ยม 10 ช่องต่อแถวบน desktop (5/3 ช่องบนจอเล็ก) คลิกเพื่อแก้ไขในหน้าต่าง ค้นหาจากชื่อ คำถาม และคำตอบทั้งหมด แสดงผลสูงสุด 200 รายการ เอาคำว่า “เว้นว่างถ้าไม่หมดอายุ” ออกแล้ว
- /admin/files: สร้าง/แก้ชื่อ/ลบโฟลเดอร์ว่าง อัปโหลด/ย้าย/เปลี่ยนชื่อ/ลบไฟล์ จัดสิทธิ์ Private/Shareable และแนบความจำหรือปฏิทินได้สูงสุด 3 ไฟล์ เก็บใน Supabase Storage bucket pp-files แบบ private/server-only
- ขนาดสูงสุด 3 MB; JPG/PNG/WebP ย่อเป็น JPEG ไม่เกิน 1200px และ 1 MB สำหรับ LINE; PDF/DOCX/XLSX/PPTX/ZIP/TXT/CSV คงข้อมูลเดิม รูป Shareable ส่งเป็น image message เอกสารเป็นปุ่มดาวน์โหลด HMAC อายุ 24 ชั่วโมง ตรวจสิทธิ์ปัจจุบันทุกครั้ง
- Private attachments ส่งเป็นลิงก์ที่ต้องเข้าบัญชีแอดมินเจ้าของก่อนดาวน์โหลด ไม่ออกลิงก์ bearer และไม่ส่งภาพ inline Private เข้า LINE; การเปลี่ยนสิทธิ์ไม่ลบสำเนาที่เคยส่ง/ดาวน์โหลดแล้ว
- /admin/calendar: ปฏิทิน CRUD/ค้นหา ทำซ้ำทุกปี เตือนในวันนั้น/ก่อน 1 วัน เลือก owner DM และ/หรือกลุ่มที่อนุมัติ แท็กสมาชิกจริงและแนบไฟล์ได้ รายการใหม่ปิดการส่งไว้ก่อน ผู้ใช้ต้องเปิดเอง จำกัด 100 รายการ
- Vercel Cron เปิดแล้ว: /api/reminders เวลา 01:00 UTC (08:00–09:00 ไทยตามความคลาดเคลื่อน Hobby), /api/maintenance เวลา 19:00 UTC ไม่มีการส่งย้อนหลังวันถัดไป
- แสดง LINE quota จริง ตรวจจำนวนผู้รับกลุ่มก่อน push; โควตาที่อ่านได้ตอนทดสอบคือ 0/300 ตรวจ owner/group/ไฟล์ซ้ำก่อนส่ง ล็อกการส่งซ้ำในฐานข้อมูลและใช้ X-Line-Retry-Key พร้อม request body เดิมเมื่อ retry
- ข้อความสำหรับ retry อยู่ในตาราง server-only เก็บไม่เกินถึงรอบ cleanup หลังครบ 1 วัน (ปกติไม่เกินราว 48 ชม.) และลบทันทีเมื่อส่งสำเร็จ/ยกเลิก เก็บ metadata 90 วัน
- Production Ready: dpl_6iKvRGh9w8S7KvoQiHmD2TwBQga5; alias เดิม https://pp-theta-beryl.vercel.app
- Migration pp_library_calendar และ pp_detach_deleted_files ใช้จริงแล้ว; ทั้ง 11 ตาราง RLS on และ anon/authenticated ไม่มี SELECT; ตาราง public เดิม 4 ตารางคงอยู่ Storage bucket ไม่ public
- ตรวจ TypeScript/build ผ่าน; automated tests 172 ข้อ รวม PostgreSQL 47 ข้อ ผ่าน ตรวจ migration/claim/dedup/detach บนฐานข้อมูลจริงด้วย transaction แล้ว rollback
- Browser จริง: ค้นหา/เปิดแก้ไขความจำ, 10 คอลัมน์ที่ 1920px และจอเล็กไม่ล้น, สร้างโฟลเดอร์ “คู่มือ PP”, บันทึกรายการปฏิทินแบบ disabled ผ่าน แล้วลบเฉพาะรายการทดสอบออกด้วย connector
- HTTP จริง: หน้าคลัง/ปฏิทินและไฟล์ไม่มี token ส่งไป login; cron ไม่มีกุญแจได้ 401; มี CRON_SECRET แต่นอก 08–09 ได้ outsideWindow=true ไม่มีการส่ง LINE
- ข้อจำกัดการยืนยัน: อัปโหลดผ่าน browser automation ติดสิทธิ์ “Allow access to file URLs” ของ Chrome extension จึงยังไม่ได้อัปโหลดไฟล์จริงหรือทดสอบดาวน์โหลด/ส่งรูปจริงใน LINE ฟังก์ชันอัปโหลด/สิทธิ์/แปลงรูปผ่าน automated tests แล้ว ไม่ได้เปลี่ยนสิทธิ์ Chrome ให้ผู้ใช้
- ยังไม่มี calendar event หรือ reminder delivery จริง ไม่มีการตั้งวันเกิดพี่ฟิ้งหรือส่งข้อความทดสอบ คำขอส่ง LINE ด้วย push ทดสอบด้วย mock เท่านั้น
- Security advisor: INFO no-policy 11 ตารางเป็นการตั้งใจ server-only; WARN leaked-password protection เป็นค่าร่วมเดิม ไม่เปลี่ยนในงานนี้ ดู https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## เชื่อมกับทรัพยากรเดิม

| บริการ | เป้าหมายเดิม |
|---|---|
| Production | https://pp-theta-beryl.vercel.app |
| Admin | https://pp-theta-beryl.vercel.app/admin |
| Webhook | https://pp-theta-beryl.vercel.app/api/line/webhook |
| Vercel | project pp, scope regener00-creators-projects |
| Vercel IDs | prj_bzMPDuGQnEgjqSL3LGrPYqs2AI3c / team_pzOWcZ6fMt1PwZl00IIMZoo5 |
| Last deployed change | dpl_GviuGF5JQ3koghndX4ou9d6fdC5e — visual attachment cards |
| Supabase | NOOSOL WEBSITE / uyrwypfrvfhoryuvcujg / schema pp |
| LINE | OA PP / @814rsybp / channel 2011792389 / provider 2005583727 |
| Google | My First Project / project-c174b7fb-23ee-4a19-bcb / number 557018318250 |

Supabase เป็นโปรเจกต์ร่วมกับเว็บไซต์เดิม เปลี่ยนเฉพาะ schema pp ตามงานที่ได้รับอนุญาต ไม่สร้าง initial schema ซ้ำ ไม่ reset / seed production ไม่แตะข้อมูลหรือสิทธิ์ของเว็บไซต์เดิม

Production environment ถูกตั้งแล้วบน Vercel รายชื่อตัวแปรอยู่ใน README.md และ .env.example ไม่ต้องสร้างหรือหมุนกุญแจเพียงเพราะเปลี่ยนเครื่อง ไม่คัดลอก token หรือ browser session ลงเอกสาร/แชต/ZIP ถ้าต้องใช้ค่า local ให้เจ้าของใส่ผ่านช่องทางที่ปลอดภัยและไม่ commit

Gemini เชื่อมด้วย Workload Identity Federation เฉพาะ Vercel pp Production ตาม GOOGLE-IDENTITY.md ไม่ใช้ static Google API key เครื่องใหม่หรือ Preview ไม่ได้รับสิทธิ์ production นี้อัตโนมัติ อย่าขยาย IAM หรือเปลี่ยน billing เพื่อให้การทดสอบ local ผ่าน

## เตรียมเครื่องสำหรับ Codex ผู้รับงาน

1. อ่าน AGENTS.md; ใช้ Node.js 24.x ตาม package.json และ npm จาก Node
2. ติดตั้ง dependencies ด้วย npm ci ในโฟลเดอร์ PP
3. ตรวจด้วย npm run check (typecheck, tests, build) ก่อนปรับแก้ การทดสอบใช้ mocks และฐานข้อมูล PGlite ภายในเครื่อง ไม่ต้อง reset Supabase จริง
4. อ่านเอกสาร Next.js ที่ติดตั้งใน node_modules/next/dist/docs ก่อนเขียนโค้ดตาม AGENTS.md
5. สำหรับการเปิดหน้าแอดมินในเครื่อง ให้ตรวจ .env.example และ src/lib/env.ts ก่อนสร้าง .env.local; npm run dev เปิดระบบ local ส่วนการทดสอบ Gemini จริงต้องคำนึงถึงสิทธิ์ Production เท่านั้น
6. ถ้าจะ deploy หลังมีงานแก้ที่ได้รับอนุญาต ให้เข้าสู่ Vercel ด้วยบัญชีเดิมและระบุ project/scope เดิมอย่างชัดเจน คำสั่งที่ใช้สำเร็จบนเครื่องเดิมคือ npx vercel@60.1.3 deploy --prod --yes --project pp --scope regener00-creators-projects (Windows ใช้ npx.cmd)
7. ไม่ต้องย้าย LINE webhook หรือสร้าง LINE OA, Supabase หรือ Vercel project ใหม่เพียงเพื่อย้ายเครื่อง

ไฟล์อ้างอิงหลัก: src/lib/bot.ts (กลุ่ม), src/lib/owner-chat.ts (เจ้าของ DM), src/lib/line.ts (ข้อความ LINE), src/lib/semantic.ts และ google-model.ts (AI), src/components/admin-forms.tsx (ฟอร์ม), src/app/admin/actions.ts (บันทึก), supabase/migrations (สิทธิ์และ RPC), tests (การตรวจ)

เอกสารนี้บันทึกสถานะการทำงาน ไม่ใช่การมอบสิทธิ์ใหม่ให้แก้ระบบจริงหรือเพิ่มค่าใช้จ่าย งานบนเครื่องใหม่ให้ยึดคำสั่งผู้ใช้ในเซสชันนั้นและตรวจสถานะจริงก่อนเปลี่ยนแปลง


## Content Planner + workspace hub — 2 October 2026

Latest deployment: dpl_GbBsiwuSCrxcA5TiFYxY5pEiSKb2 (READY), https://pp-theta-beryl.vercel.app/workspace.

- One account, two entry cards: CONTENT PLANNER (/planner) and MEMORY (/admin). Shared files, distinct personal/content calendars. Mobile stacks the cards; desktop left/right.
- Planner includes brand/products/FAQ/cases/campaigns, Gemini or template ideas (five per generation), persistent generation history, draft caption/script/shot list, manual review/apply, work board and month/week calendar, attachments (10), metrics and overview. See README for use and boundaries.
- Migration 20261002024755_pp_content_planner.sql applied once to existing NOOSOL WEBSITE pp schema. All five new tables have RLS and no anon/authenticated table access; server-only actions require admin. No credentials or IAM changes.
- npm run check passed: 383 tests across 26 files, TypeScript, production build. Final CSS-only mobile spacing fix also passed Vercel build. PGlite tests cover real migration/functions, idempotency, recipients, stale revisions and file scope.
- Live browser verified AI ideas (five distinct storytelling formats on final run), template ideas, save/develop draft, schedule, status, manual metrics, overview, history, brand edit retention, shared files and workspace breakpoints. No actual LINE messages sent. No error/fatal runtime logs on tested functional deployment.
- Three actual Gemini requests consumed shared PP quota; token pairs input/output: 949/598, 1268/352, 1142/568. One template request used no AI. Do not refund actual usage. Cost estimate intentionally null, not fabricated.
- Daily content reminders use /api/content-reminders at 0 1 * * * (08:00–09:00 Thai Hobby precision). Scheduled posting time is a plan, not an exact-minute send or automatic social publishing. Recipients are explicit. Stable retry keys/leases and persisted payloads protect against duplicate pushes. No next-day catch-up.
- User explicitly chose to KEEP QA data after cleanup auto-review rejection. Do not remove these without a later request: brand PP QA Studio 20261002 (c2edce3c-5dc2-4473-9841-5bc4f1539a34), product 1dc6fc55-4e1e-463e-8b96-9b07f58a7b73, item df21321b-5138-4f8c-9a34-d87788cd5e11, four generations a30f988a-de7b-4da1-aafb-a0d486a89443 / 78b65ca9-b4bf-4aa8-b582-8facf5de128a / 1eeae90a-eed9-4b4f-8b44-ceac0f00b1c6 / 30b68dea-e35d-4521-a626-be5daabe812d. Test item is posted, notify_owner=false, group_id=null.
- Verification counts: 21 memories, 9 personal calendar events; planner 1 brand / 1 source / 1 item / 4 generations / 0 deliveries.
- Supabase advisory: server-only RLS tables have informational no-policy notices; existing shared Auth leaked-password warning remains unchanged. See prior remediation link.
- Screenshots in parent outputs: PP-workspace-desktop.png and PP-workspace.png. PP-source.zip refreshed without credentials, build outputs or dependencies. No git commit/push performed.


## UI update — 2 October 2026
Removed the idea generation history section and pagination from /planner at the user request. The page no longer queries or sends the history list. Existing saved generations and direct generation links remain intact. Removed helper copy pointing to the removed section. TypeScript and production build passed. Deployment dpl_3H6J8t3eUXvP39uoC4wds17FBVf8 READY.


## Reusable ideas + durable deduplication — 2 October 2026

- Production deployment dpl_7yCcnzzM3QPRz15nLT6F9jw2P43i. Expanded template engine to 56 structures / 6 storytelling formats; 48 usable without a real case. Stable concept keys + normalized title ledger scoped to brand, advisory transaction lock + unique constraints, legacy generation/work title backfill. Exact and stable-concept protection, not universal semantic deduplication.
- New migration 20261002051630_pp_reusable_ideas.sql applied to NOOSOL WEBSITE pp schema. New content_patterns / content_idea_seen tables and pp_finish_ideas RPC are server-only, RLS and no anon/authenticated grants; verified client cannot invoke completion RPC.
- Each future successful Gemini ideas request returns 5 ideas + 3 generic reusable patterns in one invocation. Stores raw ideas, accepted ideas, patterns, token counts; cap 200 unique patterns per brand. Free templates use enabled patterns, replacing subject/audience only. Missing/deleted/expired source dependencies disable reuse. User can pause/re-enable. This is template reuse, NOT model fine-tuning. Outputs consume additional tokens in the same Gemini request.
- No automatically paid fallback or retries on exhaustion. Shows fewer fresh ideas or an empty notice, never silently calls AI. Fixed generator engine initialization so template mode survives result URL remount/reload. Item persistence strips origin/pattern_id metadata. Completion failure handler cannot overwrite already completed generations.
- Validation: npm run check passed 400 tests / 27 files, typecheck + build; added one further multi-product format test (targeted pass, total 401). Production builds passed. Tests cover normalized duplicates, sequential batches/exhaustion, idempotency, brand isolation, manual titles, pattern dedup and ACLs. Real SQL uniqueness/advisory lock implements concurrency; no live concurrent stress load sent.
- Live UI: Gemini generated 5 ideas / 3 patterns, then two free batches of 5 with no repeated titles. Reload preserved template mode. Pause/re-enable and save-to-work succeeded. AI quota before114/after115, exactly one real request, input1807/output1258 tokens; do not refund. No LINE sends; content_deliveries=0. Tested deployment runtime logs no error/fatal.
- Additional QA records retained under existing user-approved PP QA Studio 20261002: generations c370bfdd-1817-4a75-9ade-7f33b94861b4 (AI), 533b2709-621d-4f7e-8c61-130c0b051a65 and 6392cb47-5f46-46f5-b0f1-36a004ab4474 (templates); item e2537c6c-9009-4506-9e10-a8b7cb3251b0, notify_owner=false/group_id=null. Three learned patterns active. Do not delete kept fixtures without user authorization.
- Existing 21 memories intact. Security advisor reports expected INFO server-only RLS/no-policies and unchanged shared Auth leaked-password WARN: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . No credentials, IAM, billing or shared public schema changes.
- README updated; source archive refreshed excluding secrets/build/dependencies. No git commit/push. Screenshot ../PP-reusable-ideas.png.


## Simple idea library — 2 October 2026
- /planner/work now defaults to a responsive flat grid of idea cards, for both active and archived items; removed the five-column workflow board and status filter. Shows 20 cards per page with search and brand filter. Calendar/list views and click-to-edit remain. Only calendar cards are draggable for date changes. No database changes or status rewrites.
- TypeScript passed; production build/deployment dpl_C5L2UK1395B2dtg9Gvu7wDUPaqXL READY. Live browser confirmed two existing archived ideas appear together, search filters to one, and card opens existing editor. No saved data changed or LINE messages sent.
- Screenshot ../PP-idea-library.png; source zip updated.


## Template generation emoji fix — 2 October 2026
- User reported generic failure on “คิดไอเดีย 5 แบบ”. Latest two template requests failed on topic with 🆓 at UTF-16 positions 74–75: topic.slice(0,75) produced a lone high surrogate, rejected by PostgreSQL JSON. Reproduced with a regression test against real PGlite migration/RPC before fixing.
- Replaced raw text slicing in all template topic/audience/title/hook/angle/CTA/FAQ boundaries with grapheme-aware UTF-16-length truncation via Intl.Segmenter. Preserves complete emoji and Thai marks within existing schema limits. No database/env/IAM changes. Added sanitized error-class/database-code logging without prompts or credentials.
- npm run check passed 403 tests across 27 files, TypeScript and production build. Deployment dpl_5NZVjgvXGhZfzrcebtKnXWBz155c READY and alias verified via inspect (deploy CLI exited1 after outputs but actual deployment completed; did not duplicate deploy).
- Failed original requests retained. No paid AI calls or LINE messages used to reproduce; browser verification uses owner's original NOOSOL brief in template mode.
- Live recovery succeeded with original NOOSOL brief: f10e5868-4c04-4c78-bcd9-d607d729b0f2, complete/template/5 ideas, no AI tokens. Result tab left open. Screenshot ../PP-template-emoji-fixed.png.


## Editable content goals and editor layout — 3 October 2026
- Production dpl_Gq56rEGa2zsn1khbAiQufAj4j9cv READY, pp-theta-beryl.vercel.app alias. Added server-only pp.content_goal_settings singleton via migration 20261003025523_pp_content_goals.sql, seeded five existing goals. Owner can add/rename/remove 1–30 shared goals through จัดการหัวข้อ. Stable IDs, unique trimmed labels, optional custom CTA and five free-template direction mappings. Revision compare-and-swap prevents stale overwrites; no anon/authenticated table grants. Old generation briefs/items remain snapshots. Deleted selected IDs require choosing a new goal before generation.
- Gemini receives current resolved goal label/direction/CTA. Free templates prioritize suitable formats (retaining variety and explicit format filters), append direction to angle and use configured/default CTA. Stable concept keys remain independent of goal, preserving deduplication. Custom names are not semantically interpreted by free engine; owner selects direction.
- Editor header matches dialog background; removed white footer block; copy Caption/archive/save share a single responsive action row. Save remains available on every editor tab; copy appears only on content tab.
- Validation: 412 tests/29 files passed, typecheck and local/production builds passed. Tests cover custom validation, rename/delete identity, objective-based output, stable dedup keys, auth gate, stale revisions, SQL ACLs. Live UI added/edited/removed an unsaved draft goal, then saved unchanged five goals; DB revision verified. No persistent QA goal, AI invocation, LINE send or content item mutation. Existing user-authored items viewed only. Header/dialog both rgb(247,245,243); three action button Y positions identical on desktop. Production error/fatal logs empty during verification.
- Screenshots: ../PP-content-goals.png and ../PP-editor-actions.png. Security advisors: expected INFO RLS/no policies for server-only table; existing shared-project Auth warning unchanged. Source archive refreshed without secrets/dependencies/build. No Git commit/push.


## Group learning retired — 5 October 2026
- User requested removal of เรียนรู้จากกลุ่ม. Removed navigation entry and learning board/styles/model prompt/schema. Old /admin/learning redirects to /admin after auth. Existing Server Action exports reject all requests after requireAdmin; inert captureLearningEvent/runLearning exports ensure no old internal callers can collect or invoke Google.
- Webhook now runs only normal replies and friend discovery; removed capture and after() learning tasks. Maintenance keeps pp_cleanup but no longer invokes learning. Manual-memory semantic matching, duplicate assistant and Content Planner remain enabled.
- Production pp.permissions: disabled learning_enabled and cleared learning_started_at for the single enabled group. Verified 21 manual memories and 0 learning suggestions before change. No table drops, no deletion of manual memories or group data; legacy retention cleanup remains. Historical DB learning helpers retained for migration/compatibility, with no UI or application entry point. Do not re-enable group flags.
- Replaced removed feature tests with retirement regressions for stale actions, webhook and maintenance; historical DB boundary tests remain.

Validation: typecheck, production build and 400 tests (30 files) passed. Production deployment dpl_9HQUohLkUBiv6p2HqSTtt3drwd3F is READY at https://pp-theta-beryl.vercel.app. Post-deploy database check: 0 learning-enabled groups; 21 manual memories retained. Browser reached the protected login page; authenticated visual verification was not possible in the current browser session. No live LINE message was sent.

## Multiple owner-written memory replies — 2026-10-05
- 1 primary content + 0–19 answer_variants; each 1–2000 characters, multiline retained. UI add/delete, count on card, search all alternatives, edit/merge preserve them. Variants are randomly selected, may repeat, and must be suitable for the same request. No new AI generation call.
- SQL migration 20261005112537_pp_memory_answer_variants.sql applied to NOOSOL WEBSITE / pp; reply selection occurs only after existing group/DM authorization, expiry, conflict and revision checks. Legacy clients preserve alternatives when key omitted. Reviews and retrieval include alternatives; existing prompt byte budgets still apply. All 21 existing memories retained; no production sample memory added, no LINE messages or live AI test calls.
- Validation: typecheck, build and 410 tests / 30 files passed. Local browser exercised add/remove with multiline-capable controls, no browser errors. Temporary preview route removed before deployment. Screenshot ../PP-memory-replies.png contains synthetic unsaved example only.
- Supabase advisors: expected server-only RLS/no-policy INFO notices; existing shared Auth leaked-password protection warning unchanged: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . New helper execute rights verified service_role only (anon/authenticated denied).

Production deployment dpl_6hgBxqbYkVaeiCR77Z3vcAzArz5t is READY and aliased to https://pp-theta-beryl.vercel.app. No error/fatal runtime logs at completion. Authenticated production UI and an actual LINE reply were not exercised; browser checks used the real components locally and synthetic data.


## Personal secretary on Cloud — 9 October 2026 (code ready, deployment blocked)

- Converted PP to น้องโจอา personal secretary: `/admin/chat`, private notebook per LINE sender, group notebooks scoped to the enabled group, explicit remember/event proposals, 15-minute confirmation, general Thai chat and upcoming appointments. Web owner can choose own/group scope; friends' private records are not shown in the owner's web account. Recent invoked exchanges (six model history turns) are scoped by group + sender; cleanup after 30 days. No passive group learning.
- Preserved original exact/semantic memory reply pipeline, owner handoff, variants, conflict/revision/expiry checks, files and old calendar. Unknown authorized questions may use conversational AI after old retrieval. Shared AI rate 6/min and monthly ceiling 1,000 remain; no credential/IAM/billing changes.
- New migration file `20261009065258_personal_secretary.sql` is LOCAL ONLY, NOT APPLIED. Adds pp.assistant_turns / assistant_notes / assistant_events / assistant_deliveries and SECURITY INVOKER RPCs, RLS + service_role-only rights. Atomic confirmations with stable receipts prevent retries confirming a newer draft; per-scope locks enforce 200-note/100-event caps. Reminder payload/retry key persistence, access recheck, stale-payload suppression and quota checks; only own DM/current group recipients; delivery remains 08:00–09:00 Thai time. Annual leap-day agenda uses next valid leap year.
- Content Planner UI/components/style/menu removed from code; old routes redirect after admin auth, stale action exports authenticate then reject, content cron removed, old reminder exports inert and endpoint 410. Historical tables/data/migration and offline DB/template tests retained. PRODUCTION STILL RUNS THE PREVIOUS VERSION until migration + deploy succeed.
- Validation: `npm run check` passed TypeScript, 434 tests / 32 files and production build. Includes real PGlite SQL validation for additive changes, untouched manual memory/public schema, cross-user/group isolation, grants, expired drafts, confirmation idempotency, reminder receipts and retention. Web action and bot orchestration tests verify auth/scope and legacy refusals. Added reminder quota/stale payload/permission tests. Temporary visual fixture removed before final build.
- Live visual verification incomplete: cloud browser reaches protected `/login`; no credentials were entered, no live LINE send or paid Gemini request was made. Local Playwright browser unavailable; its official Chromium download failed (invalid/truncated archive). No visual fixture was deployed.
- Supabase MCP `apply_migration` twice returned `Invalid or expired requestState`; read-only checks confirmed no new tables/history entry. The subsequent atomic SQL attempt (new migration + matching history receipt) returned `SQL execution was declined`. DO NOT retry production writes or switch to another DB write channel without the user's renewed approval. No production deployment attempted because required tables are absent.
- Pre/post verification: 21 original memories, fingerprint `858976cebfb4c8f2a39e27e758d2263e`; 9 calendar events, fingerprint `d908429003aa2483db38e60d7075b46e`; original content items retained (2), group learning flags all off. Existing expected RLS/no-policy INFO notices and shared Auth leaked-password WARN unchanged.
- Next step after approval: recheck migration history and absence/existence of new objects before applying ONLY the new migration once to NOOSOL WEBSITE `uyrwypfrvfhoryuvcujg`, schema pp. Never run old migrations, reset or seed production. Verify original fingerprints and client RPC/table ACLs, deploy tested source to Vercel `pp` / `prj_bzMPDuGQnEgjqSL3LGrPYqs2AI3c` / `team_pzOWcZ6fMt1PwZl00IIMZoo5`, inspect READY + existing alias and health/retired endpoint; browser auth/live LINE remain separate verification limits.

## Personal secretary deployed — 9 October 2026

- This entry supersedes the blocked status above. The user renewed authorization with “allow all เลย ทุกอย่าง ไม่ต้องร้องขอ”. Read-only checks first confirmed no new objects/history. Supabase apply_migration still returned an expired requestState, so the authorized atomic SQL transaction applied ONLY `20261009065258_personal_secretary.sql` and inserted its matching history entry (`20261009065258`, `personal_secretary`). Completed successfully once. Do not rerun it or old migrations.
- Existing NOOSOL WEBSITE project `uyrwypfrvfhoryuvcujg`, pp schema only. All four assistant tables have RLS, no anon/authenticated grants; all four RPCs are SECURITY INVOKER with service_role execute only. Owner access RPC verified true. No sample notebook, appointment, conversation or delivery rows were added.
- Original data verified unchanged after migration/deployment: 21 memories, fingerprint `858976cebfb4c8f2a39e27e758d2263e`; 9 calendar events, fingerprint `d908429003aa2483db38e60d7075b46e`; 2 content items retained; 3 enabled groups and 0 learning-enabled groups. Fingerprint formula is `md5(string_agg(row_to_json(row_alias)::text,'|' order by id))`; JSONB serialization yields a different digest and must not be compared to this baseline.
- Tested source commit `f3ba166e07267587a95886b5a6ccab56b6ff2152` is on GitHub main. Deployed this exact commit through the existing Vercel project `pp` / `prj_bzMPDuGQnEgjqSL3LGrPYqs2AI3c`, team `team_pzOWcZ6fMt1PwZl00IIMZoo5`. Production deployment `dpl_B2MfoXXD35PxLdsioN8tqWVoKomu` is READY and existing alias https://pp-theta-beryl.vercel.app points to it. No new project, environment, credentials, IAM or billing settings.
- Verification: pre-deployment `npm run check` passed TypeScript, 434 tests / 32 files and production build; Vercel production build passed. Live health 200/ok; retired content-reminders 410; manifest starts at /admin/chat. Cloud browser /admin/chat redirects unauthenticated requests to the updated secretary login; old /planner is also protected by login. No error/fatal logs for this deployment during verification.
- Live authenticated chat UI, paid Gemini conversation and actual LINE reminder/reply were not exercised: Cloud browser has no admin session. No credentials were entered and no real LINE message was sent. Daily secretary reminders remain 08:00–09:00 Thai time with the existing Hobby cron precision; appointment dates are supported, not exact-minute alarms. Documentation-only status update follows the deployed code commit on GitHub.

## Selected test group removed — 9 October 2026

- User explicitly chose ONLY “ทดสอบบอท” for bot departure and permanent group-data deletion (`C1f3fc9a298ed97a230bbb1b4145bbb15`). Initially disabled this group's permission to stop replies during removal. The other groups were not selected.
- Existing LINE token is a Vercel Secret and cannot be read back. Added narrowly scoped `scripts/leave-test-group.mjs`, invoked explicitly once inside the existing project's Production build environment after successful build; no key export, public operation endpoint or new auth grant. Deployment `dpl_EoXN4bwgkiJoVCR5ScApxVB3nnmH` completed the operation. LINE leave POST returned 404 and summary GET returned 404: bot was already absent from this known group. Did not claim a newly successful 200 leave or send a LINE chat message.
- An authorized transaction deleted this group's permission row and related records: 1 friend, 3 conversation bookkeeping rows, 3 calendar events and 1 reminder delivery. Also cleared any scoped assistant, old learning and content records; these were empty for this group. Post-checks: zero target-group rows in all relevant tables. No schema change or migration rerun.
- Transaction assertions verified preserved data: 21 manual memories fingerprint `858976cebfb4c8f2a39e27e758d2263e`; remaining 6 calendar events fingerprint `7386d20f4216640b38b5e6e459bd08e8`; other group permissions fingerprint `53621cd86e2334a075d2a1487eccdd72`; other friends fingerprint `0dc775d08ba07408bcf3d67188f238c5`. Remaining groups ปลาจาระเม็ดนึ่งบ๊วย and กลุ่มโจอา are enabled, with 11 total friends. กลุ่มโจอา's 189 retained learning messages were not touched. Fingerprints use the documented row_to_json / pipe delimiter formula.
- Validation: `npm run check` passed TypeScript, 443 tests / 33 files and production build. Nine new tests cover the fixed target, verified absence, already-left responses, non-success status handling, missing token, redirect-error configuration and sanitized errors. No paid Gemini invocation.
- Source commit `82b8d0d89f7e57855b361ca65ec8c6be86be80c7` on GitHub main. The script is NOT part of npm build or runtime routes. Do not rerun the one-off operation or restore deleted group data without a new user instruction. Follow-up production deployment `dpl_75d2EEWKzqSudn7VKJAWV8JvkCH6` is READY with the existing pp-theta-beryl.vercel.app alias and normal `npm run build` command, so future builds do not inherit the one-off command. Live health remains 200/ok.

## Secretary appointments in Memory calendar — 9 October 2026

- Pulled `origin/main` through `fa5d7fc` before starting. Confirmed secretary events now display alongside legacy calendar events on `/admin`, including existing saved appointments. Drafts remain excluded until confirmation.
- `assistantCalendar()` authenticates the admin, derives the owner identity from the database, checks each enabled group via the existing access RPC, and reads only those scopes. Friends' private DM notebooks never enter the web calendar. Assistant reminder history is merged into the existing latest-deliveries panel.
- Source-qualified display IDs prevent collisions. Secretary-event editor changes/deletes the original `assistant_events` row with both record ID and authorized scope predicates. Legacy rows keep their existing editor. No copied events, database migration, new cron, AI call, or changed LINE reminder recipient.
- Web confirmation (button or text), edits and deletions refresh both views. The calendar has an explicit refresh button for appointments confirmed in LINE while the browser is already open.
- Verification: `npm run check` passed, 456 tests across 35 files, production build clean. Includes authorization/IDOR, revoked-group writes, invalid dates, scope-aware query tests, PostgreSQL confirmation/idempotency and edits/deletion; existing reminder suites passed. Windows sandbox temp-file failures resolved by running the same checks outside the sandbox.
- Browser: real CalendarBoard/editor with temporary local synthetic fixtures verified correct dates, search and personal/group recipients, no console errors. Fixture removed before build/deploy. Production admin browser currently requires login; no auth bypass and no live LINE messages or production test records created.
- Production read-only baseline: 21 memories, 6 legacy calendar events, 1 secretary event (owner DM), 2 enabled groups. Preserve all of these records.
- Released source commit `68c5273` to Vercel Production: `dpl_2sc56om1ExXypcgmRjvHTNHXARN2`, READY, alias https://pp-theta-beryl.vercel.app. Manual CLI deploy; GitHub main updated separately. `/api/health` 200; unauthenticated `/admin` 307 to `/login`; temporary `/preview-assistant-calendar` 404. No production authenticated interaction or live LINE test was performed.

## Retire web secretary chat — 9 October 2026

- User chose LINE for all secretary conversations. Removed web-chat menu, header/editor links, chat component and dedicated styles. App root, sign-in default, sidebar logo, PWA start URL, workspace and retired planner links now lead to `/admin` (Memory/calendar). Existing `/admin/chat` bookmarks authenticate and redirect there.
- Old web chat actions are authenticated and inert: no AI calls, confirmations, cancellation or record deletion. All secretary data remains stored, and LINE assistant/bot/reminder code is unchanged.
- Calendar appointment management moved to `src/app/admin/assistant-calendar-actions.ts`. Its owner/group authorization helper is now server-only `src/lib/assistant-admin.ts`, independent of retired chat actions. Existing calendar integration and reminder behavior preserved.
- `npm run check`: 454 tests / 35 files passed and production build succeeded. Updated stale-action and entrypoint coverage plus existing LINE/assistant/calendar suites. No database migration or production data changes; no live LINE messages sent.
- Deployed source `dd61caf` to Production `dpl_ACMA6kVLYTP6UGKFuno127VE1U7a`, READY, alias https://pp-theta-beryl.vercel.app. Verified `/` 307 to `/admin`, manifest 200 with start_url `/admin`, health 200, and unauthenticated retired chat still redirects to login. No error/fatal runtime logs in the post-deploy check. Authenticated redirect covered locally; no production login bypass or live LINE test.

## LINE notebook management in Memory dashboard · 9 October 2026

- Added ความจำจาก LINE under the existing manual memory/review area on `/admin`. Cards show original chat label, local title/content/source search, chat filter, 20 per page (existing responsive 10-column grid), refresh, and a wide edit dialog. Existing confirmed notes appear without migration or copying. The overall memory count includes loaded LINE notes.
- Server loader reads only configured owner's DM and enabled groups passing `pp_assistant_allowed`; never other users' DM notebooks. Mutations require admin and fresh owner/group permission, bind id + server-derived scope + original updated_at, and update/delete the original `pp.assistant_notes` row. Scope/author cannot be moved from browser fields. Stale edits fail without overwriting; delete asks for confirmation. No AI or LINE send during management.
- No migration, credential changes, or production record writes were made for this feature. Actual production read showed one owner DM note. Retired web chat remains retired; manual memories, calendar and LINE behavior are preserved.
- `npm run check` passed: 468 tests / 37 files, typecheck and build. New coverage includes private notebook boundaries, revoked permission, stale editor protection, malformed payloads, actual PostgreSQL confirmation -> edit -> delete with other notebooks unchanged. Browser on local synthetic 24-note fixture verified pagination, filtering, search, editor and cancel-delete; fixture was removed before deployment. No live messages sent.
- Source feature commit `5be6da1` pushed with explicit user approval after auto-review requested confirmation for main branch. Current Production `dpl_CHWpxZy6yVrs7j1f4U9afbsKncbY` / https://pp-6pjtlsp9q-regener00-creators-projects.vercel.app, alias https://pp-theta-beryl.vercel.app. This supersedes first feature deployment dpl_DzfuFundrEg8qET4Q8NhfAbCyFdw.
- First authenticated request on the first deployment hit a generic database failure in the dashboard's existing result checks (not the new notes loader); exact cause was not established. Added safe diagnostic operation labels and provider error codes only to dbError, never record contents/query/keys. Current deployment authenticated dashboard, note editor open/close, search and refresh verified successfully; no error/fatal logs on current deployment during verification. Production edit/delete not exercised on real user records; mutations verified in local tests/Postgres instead.

## Single memory board and simpler header · 9 October 2026

- User requested LINE notes live in รายการความจำ itself and removal of the top memory/group counters. Removed separate LINE section/search/filter/paginator and both top stat cards. `MemoryBoard` now displays manual cards followed by permitted LINE notes, with one search and one 20-card pagination. LINE origin labels remain on cards; editors/actions still use their original tables and privacy scopes.
- Extracted `AssistantNoteEditor` from the removed standalone board; prefixed LINE selection/card IDs prevent collisions with manual UUIDs. Main search matches LINE title/content/source alongside the original server search for manual memories. Refresh is now อัปเดตความจำ. Existing manual color/order controls remain, with LINE cards disabled while arranging manual entries; no migration or data copying.
- Source e77acf4. npm run check passed 468 tests / 37 files plus typecheck and build.
- Production READY dpl_3sLvQhTBTy48Y7nadA2nr7kFJBTF / https://pp-7un3ukcwi-regener00-creators-projects.vercel.app, alias unchanged. Authenticated browser verified 5 combined cards (4 manual + 1 LINE), no top counters or separate LINE section, original LINE editor opens, shared search finds the LINE-only email card with no empty-manual false state. Cleared search afterward; no production data changed. No error/fatal runtime logs during this check.


## Dark theme and 30-card memory pages · 9 October 2026

- Applied owner-specified dark slate palette throughout app, forms, dialogs, calendar, library, settings, login/install and PWA viewport/manifest. Green accent uses dark text; existing four card colours use readable dark variants. Responsive grid stays 10/5/3 columns.
- Memory pagination now 30 cards (10 × 3 desktop); calendar list retains 20. Removed top list-count captions, calendar schedule intro, Gemini/quota disclosure and visible example-question field. Hidden aliases preserve existing examples on edit/merge/choosing an existing card; AI behavior and storage unchanged.
- Validation: typecheck, 468 tests / 37 files and production build passed. Temporary development fixture (35 synthetic memories, removed before build) verified 30 cards in 10 columns/3 rows, 5 on second page, dark memory/calendar dialogs and no overflow at 390px. No database writes, migrations, LINE sends or live AI calls.
- Source 9bde4e2 deployed READY as dpl_Dg2pCpSqamckoNpPP2PwZ7JSDgwW / https://pp-4j6abc2gj-regener00-creators-projects.vercel.app, production alias unchanged. Live authenticated verification confirmed exact dark tokens, removed sections, memory dialog without aliases textarea, dark file/settings panels, and successful navigation back to 5 existing cards.
- First cold dashboard request returned transient PostgREST PGRST303 in notes:permissions; full reload succeeded and subsequent files/settings/dashboard navigation succeeded. No credential or database changes made; provider-level cause not established, so do not claim a permanent fix. Screenshot saved outside repo as ../PP-dark-theme.jpg.


## Per-item calendar reminder times · 9 October 2026

- Added validated HH:mm reminder_time to both manual calendar events and assistant appointments (default 08:00 Thai). Calendar forms, cards and LINE agenda display the chosen time. New LINE proposals still default to 08:00 and direct the user to change reminder time in the calendar; appointment time written in content is not parsed into reminder_time.
- Due checks agree in TypeScript and SQL: never early, grace/retry <10 minutes, previous local date included for midnight, annual/leap dates and prior-day toggles respected. Both queues retain durable retry keys/payloads; SQL claims now enforce clock, five-minute leases, assistant payload revision and existing access/recipient checks. Worker loops bounded to 90 seconds each.
- Applied migrations 20261009130907 and 20261009130918 to shared NOOSOL WEBSITE, PP-only objects plus pg_cron/pg_net extensions. Scheduler credential generated within Vault, only hash exposed to service-role verification; dispatch function executable only by postgres. Cron created DISABLED pending deployment/probe; minute job invokes protected POST only when eligible unfinished work exists. Daily PP log cleanup scoped to its two new job IDs. No existing calendar/assistant events at migration time; no LINE test message sent.
- Local checks: 485 tests / 41 files, TypeScript and production build passed, including SQL claim/retry/idempotency, midnight/13:00/prior-day and auth/no-send probe. Scheduler extension behavior is stubbed in PGlite and must be checked on production. RLS/no browser privileges verified with production SQL.
- Source eb19345 pushed to main and deployed READY as dpl_5DRTxG8fqk6D2FRE7ZvzqpY2X8Ng / https://pp-89o9vep1u-regener00-creators-projects.vercel.app; production alias unchanged. Production Vault -> pg_net -> Vercel -> PostgREST authentication probe returned HTTP 200 with {ok:true,probe:true}, without invoking either sender.
- Enabled singleton scheduler and only pp-reminders-minute; confirmed its first automatic run succeeded at 2026-10-09 13:16:00 UTC in about 10 ms. No eligible events and no LINE messages sent. Error/fatal deployment logs empty during verification. Cron runs every minute; actual delivery depends on network/LINE and is not an exact-second guarantee.
- React review: labeled native time inputs, server-side validation/auth and default compatibility retained; no additional browser polling or dependencies. Live authenticated form inspection was unavailable because the prior Chrome connection disconnected and the available in-app browser required login; did not bypass authentication or create test user events. Persistence and form-action validation are covered by tests, but no live LINE delivery was exercised this turn.

## Admin responsiveness · 10 October 2026

- Removed the installed-app status sentence requested by the owner. Three sidebar destinations prefetch complete pages in the background, without custom polling, timers or persistent client storage.
- Replaced repeated owner/group/permission/notebook HTTP reads with one service-only SECURITY INVOKER snapshot RPC, shared only within the React server render. The SQL still calls pp_assistant_allowed for owner DM and enabled groups, excludes every other DM, and retains per-notebook 200-note/100-event limits. Original source records and write authorization are unchanged. Empty review lists no longer fetch/parse the full memory catalog.
- Calendar recipient/file validation reads run concurrently, but every result must pass before mutation. Calendar saves refresh the dashboard page; library edits refresh dashboard and files instead of the entire admin layout.
- Applied migration 20261010024025_pp_admin_notebook_snapshot. Production read verified service-role access with anonymous/authenticated execution denied; EXPLAIN ANALYZE returned 7.628 ms (database execution only). No user records changed and no LINE/AI calls. Advisors unchanged: service-only tables intentionally have deny-by-default RLS; existing leaked-password-protection notice remains outside scope.
- Validation: full TypeScript + 487 tests/42 files + production build passed; additional parallel-validation regression test passed (488 total tests now). Privacy regression moved to real PostgreSQL tests for group revocation, absent owner, other DM isolation, bounds and client-role denial. Live pre-change observations with browser automation overhead: files navigation 1702 ms, memory navigation 1191 ms, new-memory dialog 315 ms. These are individual samples, not benchmark guarantees.
- Source 81ff076 pushed to main and deployed READY as dpl_4RF8qXCmu1mGMg1UWMFGUe8bpf8r / https://pp-mqau2d36x-regener00-creators-projects.vercel.app. Production alias health returned 200/ok; login also returned 200; error/fatal logs empty during verification. Chrome disconnected after deployment, so authenticated post-change browser timings and installed-PWA screenshot were unavailable. Do not claim a measured end-user speed multiplier. No auth bypass, user data changes, LINE test sends or AI calls made.
