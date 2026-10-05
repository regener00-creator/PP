# PP — สถานะส่งมอบ (ล่าสุด 1 ตุลาคม 2026)

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

## AI จับความหมายทุกแชตที่รองรับ · 1 ตุลาคม 2026 เวลา 14:40 น. ไทย

- แก้เส้นทางแชตส่วนตัวที่เคยค้น exact อย่างเดียว ให้เจ้าของและเพื่อนถามแล้วใช้ Gemini จับคู่ shareable memory เมื่อคำถามไม่ตรงตัวอย่างได้ เช่น `น้ำท่วมป่ะ` / `น้ำท่วมไหม` ตรงกับ `มีน้ำท่วมไหม` คำตอบที่บันทึกไว้คือ “แห้งแล้วจ้า ไม่ต้องกั้นกระสอบทรายอีกต่อไป”
- DM พิมพ์ถามได้เลย กลุ่มที่เปิดใช้งานยังเรียก `@pp` / `@น้องโจอา` ผู้ส่ง DM ที่ถูกพักในรายชื่อกลุ่มใดไม่ได้รับคำตอบ ยกเว้นเจ้าของ ไม่บังคับว่าผู้ทัก DM ต้องเคยอยู่ในกลุ่ม ไม่เผย private เก่าหรือความจำที่เรียนรู้เฉพาะกลุ่มออกมาให้คนอื่น
- ใช้โควตา 6 ครั้ง/นาทีและ 1,000 ครั้ง/เดือนร่วมทุกกลุ่มและ DM คำถาม exact ไม่ใช้ AI การเรียนรู้บทสนทนาและร่างรออนุมัติยังแยกตามเดิม ไม่มี env/cron ใหม่
- ใช้ migrations `20261001072625_pp_owner_semantic_matching.sql` และ `20261001073157_pp_direct_semantic_chat.sql` แล้ว ทั้งหมด server-only พร้อม sender/lease/blocked/visibility/expiry/revision checks
- Production READY `dpl_4DvWtEptypUwx5HKnmbLJW1DGrSy` / https://pp-fat6ccedo-regener00-creators-projects.vercel.app; alias https://pp-theta-beryl.vercel.app
- Typecheck, 330 tests / 21 files และ production build ผ่าน Gemini จริงผ่าน 8/8 ข้อ รวมคำถามน้ำท่วมสองสำนวนและการปฏิเสธพยากรณ์พื้นที่อื่น ยอดหลังทดสอบ 31/1000 ไม่มี LINE test messages และไม่มีข้อมูลสมมติค้าง
- Production SQL smoke ใช้ owner + nonowner ผ่าน direct claim/candidates/validated answer แล้ว rollback ทั้งหมด การทดสอบโมเดลจริงแยกจาก transaction ภาพ ../PP-flood-ai-check.png; ซอร์ส ../PP-source.zip
- Runtime ไม่พบ error/fatal ใน deployment ล่าสุดช่วง 07:33–07:43Z; Supabase Advisors คง baseline INFO 15 server-only tables และ Auth leaked-password warning เดิม รายละเอียดใน HANDOFF
- หัวข้อนี้แทนข้อจำกัด owner-only/exact-only ของแชตส่วนตัวในประวัติรุ่นก่อนด้านล่าง ยังไม่ได้ยืนยันข้อความตอบจริงใน LINE หลังอัปเดต ผู้ใช้ลองส่งคำถามใหม่ได้

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

## แก้ข้อความเมื่อไม่รู้คำตอบได้เอง · 1 ตุลาคม 2026

- เพิ่มช่องใน https://pp-theta-beryl.vercel.app/admin/settings#unknown-reply เพิ่ม/ลบข้อความเองได้ 1–20 ชุด แต่ละชุดหลายบรรทัด ไม่เกิน 2,000 ตัวอักษร กดบันทึกแล้วบอทสุ่มหนึ่งชุดเมื่อ unknown ทั้งกลุ่มและ owner DM ค่าเริ่มต้นใหม่ “ยังไม่มีข้อมูลเรื่องนี้”
- Migrations `20261001063310_pp_unknown_reply.sql` และ `20261001063825_pp_unknown_reply_variants.sql` apply แล้ว เก็บ `pp.owner.unknown_replies` โดยย้ายข้อความที่ตั้งไว้เดิมเป็นชุดแรก รักษาสิทธิ์และ owner LINE user ID/ข้อมูลความจำเดิม
- Production Ready `dpl_7sjbnR7BoWg6x46qpMB8FippCwfX` / https://pp-4zvtfg1gv-regener00-creators-projects.vercel.app
- 143 tests / 5 files, typecheck และ Vercel build ผ่าน ไม่ส่งข้อความ LINE ทดสอบ คำตอบจากความจำ/การปฏิเสธ/แท็กเจ้าของทำงานเดิม
- Browser production เพิ่ม/บันทึก 2 ชุด SQL อ่านกลับตรงกัน โหลดใหม่คงอยู่ ทดสอบลบชุดซ้ำแล้วคืนค่าเริ่มต้น 1 ชุด ไม่มีข้อความอื่นค้างหรือ deployment error/fatal ระหว่างตรวจ ภาพ ../PP-unknown-replies.png; ซอร์ส ../PP-source.zip

## เรียนรู้จากกลุ่ม · 1 ตุลาคม 2026 เวลา 13:11 น. ไทย

- เว็บ https://pp-theta-beryl.vercel.app/admin/learning พร้อมใช้งาน เพิ่มเมนู เรียนรู้จากกลุ่ม มีร่างพร้อมต้นทางให้เจ้าของตรวจ แก้ไข อนุมัติ หรือลบ ใช้ความจำที่อนุมัติเฉพาะกลุ่มต้นทาง
- Production Ready `dpl_4R7e54uiPHFZK3LhMnn1GQEcwNMv` / https://pp-8ol0671gi-regener00-creators-projects.vercel.app
- Migration `20261001054547_pp_group_learning.sql` ใช้แล้ว เปิดเฉพาะ กลุ่มโจอา (สมาชิกที่รู้จัก 6 คน) ตั้งแต่ 13:11 น. อีกสองกลุ่มยังปิด ต้องเป็นข้อความใหม่หลังเปิด ไม่อ่านย้อนหลัง
- จำกัดการสรุป 4 รอบ/วัน และ 120 รอบ/เดือนรวมทุกกลุ่ม แยกจากการจับคู่คำถาม ใช้ Google Gemini เดิม ไม่มี environment variables/cron เพิ่ม ไม่ส่ง LINE ระหว่างสรุป
- ตรวจ 285 tests / 20 files, typecheck, local/Vercel build และ production SQL transaction ผ่าน ไม่มีข้อมูลทดสอบค้าง ทดสอบหน้าเว็บและปุ่มสรุปคิวว่างแล้ว 0/120, $0 ยังรอข้อความใหม่จริงเพื่อยืนยัน Gemini สรุปในกลุ่มนี้
- หน้าแรกหลัง deploy พบ Database operation failed ตามอาการเชื่อมต่อชั่วคราวเดิม รีโหลดแล้วใช้งานได้ ไม่มี error เพิ่มหลัง 06:11Z ในช่วงตรวจ ไม่อ้างว่าแก้ cold connection แล้ว
- ตารางใหม่ RLS/ACL ปิด anon/authenticated; Advisors มี INFO server-only 15 ตารางและคำเตือน Auth เดิม ไม่มีการเปลี่ยน Auth ของโปรเจกต์ร่วม รายละเอียดคำเตือน: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- ภาพหลักฐาน ../PP-group-learning.png รายละเอียดเงื่อนไขและระยะเก็บข้อมูลใน README/HANDOFF สำรอง ../PP-source.zip

## ความจำใหม่เพิ่มต่อท้าย · 1 ตุลาคม 2026

- Production ใช้ migration 20261001052545_pp_memory_append.sql แล้ว ความจำใหม่ใช้ลำดับท้ายอัตโนมัติ คงลำดับและสีที่จัดไว้ ไม่แก้แอปหรือ deploy ใหม่
- 54 database tests และ typecheck ผ่าน ตรวจการเพิ่มจริงด้วย service_role ใน transaction ได้ลำดับ 7 ต่อท้าย 6 รายการ แล้ว rollback ไม่มีแถวทดสอบค้าง
- Supabase Advisors ไม่มีปัญหาใหม่ คง INFO RLS ไม่มี policy ของตาราง server-only และคำเตือน Auth เดิม https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

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

- Production Ready `dpl_BZ2MynTqzLMmYXZkMbc5XUnzaJAt` / https://pp-5joffe8jp-regener00-creators-projects.vercel.app; alias เดิม
- Migration `20261001014521_pp_ten_attachments.sql` ใช้กับ NOOSOL WEBSITE แล้ว ขยายเฉพาะ pp.memories / pp.calendar_events เป็น 10 ไฟล์ ตรวจ constraint จริง validated=true ไม่มีการเปลี่ยนสิทธิ์หรือข้อมูลเดิม
- UI/server ใช้ MAX_ATTACHMENTS=10; LINE ใช้ข้อความเดี่ยวเมื่อมีไฟล์ <=4 และ Flex carousel เมื่อ 5–10 เพื่อเหลือช่องให้คำตอบหรือแท็กเจ้าของใน [ข้อจำกัด 5 messages ต่อ request](https://developers.line.biz/en/reference/messaging-api/#send-reply-message) โดยไม่ส่ง push เพิ่ม รูป Private ยังเป็นลิงก์ล็อกอิน
- เพิ่มรายการในปฏิทินเรียง 5 แถวตามผู้ใช้: เรื่อง/วันที่/ทำซ้ำทุกปี, ข้อความ, วันเตือน/เส้นแบ่ง/แชตส่วนตัว, กลุ่ม/เพื่อน, ไฟล์แนบ
- ผ่าน typecheck, 189 tests และ Vercel production build; browser เจ้าของตรวจ toggle on/off, วันที่, group dropdown, attachment selection และ memory counter=0/10 ไม่พบ horizontal overflow, browser errors หรือ runtime errors ไม่มีการบันทึกข้อมูลทดสอบหรือส่งข้อความ LINE ในรอบนี้
- Screenshot: `../PP-calendar-rows-ten-files.png`
- Supabase advisor ไม่มี schema warning ใหม่: 11 INFO RLS enabled/no policy เป็นการปิด direct client ตามแบบเดิม; warning leaked-password protection เดิมเป็นค่า Auth ร่วมของโปรเจกต์ ไม่เปลี่ยนในงานนี้ ([รายละเอียด](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection))


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

## ถาม Private เฉพาะเจ้าของในแชตส่วนตัว LINE · 30 กันยายน 2026

- ผู้ใช้เลือกชัดเจนให้ตอบ Private เฉพาะแชตส่วนตัวกับ PP; การถามในกลุ่มยังใช้ private veto ทุกคนรวมเจ้าของ
- รับ source.type=user แยกจากกลุ่มและตรวจ user ID กับ owner ที่บันทึกในแอดมิน; ไม่ใช้ display name, คำกล่าวอ้างในข้อความ หรือ env fallback เพื่อเปิดสิทธิ์ Private
- `pp_claim_owner_event` ตรวจ owner และสร้าง lease ของ source_type=user; `pp_owner_answer` ตรวจ owner ปัจจุบัน + active lease + sender + event ก่อนค้นคำถามตรง aliases จากความจำ Private/Shareable ที่ไม่หมดอายุและไม่กำกวม
- DM ไม่ต้องใส่ @pp และไม่เรียก AI จึงใช้คำถามที่บันทึกไว้เท่านั้น; ตอบผ่าน reply token ของ DM ไม่มี push หรือ mention ข้ามเข้ากลุ่ม
- ใช้ตาราง conversations และ cleanup 30 วันเดิม เก็บเพียง metadata; admin แสดง “แชตส่วนตัวเจ้าของ” และคำแนะนำใหม่ในฟอร์ม
- Typecheck, 136 automated tests รวม 39 PostgreSQL tests และ Vercel build ผ่าน; production `dpl_5iqBP7LgLHFmyKuDpLPnLjL5zVUf` Ready / alias เดิม
- ทดสอบ SQL จริงด้วย private canary ใน transaction แล้ว rollback ทั้งหมด: เจ้าของใน DM ผ่าน, คนอื่น/กลุ่ม/lease ปิดแล้วถูกปฏิเสธ
- หน้าแอดมินหลัง deploy อ่าน schema ไม่สำเร็จหนึ่งครั้ง; ตรวจคอลัมน์/สิทธิ์ SQL แล้วสั่ง `NOTIFY pgrst, 'reload schema'` ตาม [Supabase](https://supabase.com/docs/guides/troubleshooting/refresh-postgrest-schema) และหน้าแอดมินกลับมาโหลดปกติพร้อมคำอธิบายใหม่
- ยังไม่ได้ทดสอบรับคำถามและตอบ Private ใน LINE จริง ต้องให้ผู้ใช้สร้าง Private และส่งคำถามใหม่ใน DM
- Advisors มี INFO no-policy ของตาราง server-only เจ็ดตารางและ WARN leaked-password protection เดิม ไม่มีการเปลี่ยนสิทธิ์ Auth ร่วม ([รายละเอียด](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection))

## หน้าแอดมินเต็มความกว้างและค่าเริ่มต้น Shareable · 30 กันยายน 2026

- ยกเลิกเพดานความกว้าง 1400px ของ dashboard ให้เต็มคอลัมน์ข้าง sidebar; responsive breakpoints เดิมยังทำงาน
- ฟอร์มความจำใหม่เลือก Shareable เป็นค่าเริ่มต้นตามคำขอเจ้าของ; ฟอร์มแก้ไขอ่าน visibility ของรายการนั้น และไม่ได้เปลี่ยนความจำที่บันทึกแล้ว
- เพิ่มคำอธิบายใต้ตัวเลือกว่ารายการ Private ดู/แก้ไขในแอดมินได้ แต่ไม่ใช้ตอบใน LINE
- Typecheck และ Vercel build ผ่าน; production `dpl_H9CVFUW6jMW2kAh4rqUTAiP1uC2P` Ready / alias เดิม
- ตรวจแอดมินจริงที่ viewport 2401px: dashboard ขยายถึงขอบขวาของ layout, max-width=none, ไม่มี horizontal overflow, ฟอร์มใหม่ value=shareable

## ตั้งแท็กเจ้าของในแต่ละความจำ · 30 กันยายน 2026

- เพิ่ม checkbox “แท็กเจ้าของพร้อมคำตอบ” ในฟอร์มเพิ่ม/แก้ไขความจำ และข้อความสถานะในการ์ด; พิมพ์ @display name ใน content ยังคงเป็นข้อความธรรมดา
- เพิ่ม `pp.memories.mention_owner` default false; exact/semantic RPC คืนค่าเฉพาะคำตอบ Shareable ที่ผ่าน privacy/permission/expiry/ambiguity/revision checks เดิม ไม่ส่ง flag หรือคำตอบให้โมเดล
- บอทส่งคำตอบพร้อม LINE textV2 user mention เมื่อเปิดตัวเลือก; ใช้ owner user ID, ตรวจสมาชิกกลุ่ม, allow_owner_mention และ cooldown ห้านาทีร่วมกับ handoff; ถ้าแท็กไม่ได้ยังตอบข้อความที่อนุมัติ
- Escape braces ในคำตอบสำหรับ textV2 เพื่อไม่ตีความข้อความในความจำเป็น substitution
- Typecheck, 115 application tests, 31 PostgreSQL tests และ Vercel build ผ่าน; production `dpl_BFFmcA5NDmmJgxRB1Ds9BWhXXJx9` Ready / alias เดิม
- ตรวจหน้าแอดมินจริงและบันทึกผ่าน Server Action: ความจำ “ทดสอบ” คำตอบ “มาตอบ”, Shareable, mention_owner=true; ตัด @ชื่อธรรมดาออกเพื่อไม่ซ้ำชื่อ LINE จริง
- SQL จริงยืนยันคืนคำตอบพร้อม flag; ผู้ใช้ต้องส่งข้อความใหม่เพื่อยืนยัน mention ของความจำใน LINE จริง ไม่มีการส่ง push หรือเล่น reply token เก่า
- Advisors: เจ็ด INFO RLS ไม่มี policy ตั้งใจใช้ server-only/no anon grants; WARN leaked-password protection เดิมของ Auth ร่วม ไม่เปลี่ยนค่าระดับโปรเจกต์ ([รายละเอียด](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection))

## แก้ไม่แท็กเมื่อเจ้าของทดสอบเอง · 30 กันยายน 2026

- เหตุการณ์ handoff ล่าสุดส่งจาก LINE user ID เดียวกับ owner จึงถูกเงื่อนไข `ownerId !== sender` กัน mention ไว้ ทั้งที่เปิดสิทธิ์แท็กและไม่มี cooldown ค้างอยู่; runtime logs ไม่พบ warning/error ในสองชั่วโมงที่ตรวจ
- อนุญาตให้ owner ถามและได้รับ mention ตัวเอง โดยยังตรวจสมาชิกกลุ่ม, สิทธิ์, private veto, cooldown ห้านาที และห้าม mention บัญชี bot
- Typecheck และ 104 automated tests ผ่าน รวมการส่ง textV2 พร้อม owner user ID เมื่อ sender เป็น owner, cooldown และการกัน bot account
- Vercel build ผ่าน; production `dpl_2r37cPjgpAeHoVj8LgQwUa1PMrHg` Ready และ alias เดิมอัปเดตแล้ว
- การตรวจใน LINE จริงต้องให้ผู้ใช้ส่งข้อความใหม่; ไม่ใช้ reply token เก่าหรือส่ง push ทดสอบเข้ากลุ่ม

## แท็กเจ้าของเมื่อถามว่าอยู่บ้านไหม · 30 กันยายน 2026

- เพิ่ม handoff สำหรับ “วันนี้อยู่บ้านไหม”, “ปปอยู่บ้านมั้ย” และสำนวนใกล้กัน แม้ละชื่อเจ้าของ โดยจับคำถามทั้งหมดเพื่อไม่แท็กแทนคำถามถึงคนอื่น
- ตรวจสิทธิ์และ private veto เดิมก่อน handoff; ไม่ตอบสถานะปัจจุบันจากความจำเก่า และไม่เรียก AI สำหรับคำถามแบบนี้
- ใช้ LINE textV2 mention จริงตามระบบเดิม: เจ้าของต้องเป็นสมาชิกกลุ่ม, เปิด allow_owner_mention และไม่เกินหนึ่งครั้งต่อกลุ่มในห้านาที (อัปเดตถัดมาอนุญาตให้แท็กแม้ผู้ถามเป็นเจ้าของเอง)
- Typecheck, 101 automated tests และ local build ผ่าน รวมกรณีแท็กจริง, ไม่ส่งต่อคำถามถึงคนอื่น, private veto และไม่เรียก AI; ยังไม่ทดสอบส่ง mention ในกลุ่มจริงรอบนี้
- Production deployment: `dpl_BxQNdD4hveQytsqhytWjDmdAH9Xh`

## คำถามร้านอาหารภาษาพูด · 30 กันยายน 2026

- ผู้ใช้รายงาน `@pp หิวข้าวมีร้านแนะนำไหม` ไม่ได้คำตอบ ทั้งที่มี Shareable เรื่องร้านอาหารหนึ่งรายการและยังไม่หมดอายุ
- ตรวจ 24 ชั่วโมง: unknown 4, answer 2, ทุกเหตุการณ์ replied; AI usage 8/1000; ไม่พบ warning/error ใน runtime logs ตามช่วงที่ค้น
- ปรับคำสั่ง AI ให้แยกคำถามทั่วไปออกจากข้อมูลเฉพาะบุคคล ไม่บังคับมีชื่อคนทุกคำถาม และใช้บริบท “หิวข้าว” ระบุหมวดร้านอาหารได้ ยังคงตรวจสถานที่/ข้อจำกัดและแยกประเภทคำถาม
- เพิ่มชุดทดสอบสมมติในแอดมินเป็น 5 ข้อ ครอบคลุมประโยคที่รายงานและคำถามร้านซ่อมรถ ไม่แก้ความจำของเจ้าของ
- Typecheck, automated tests 93 ข้อ และ local/Vercel build ผ่าน; deployment `dpl_ApUdR3wBdZJkZqGycvJMWoYLFXzC` Ready / Production
- ผู้ใช้ทดสอบ LINE จริงหลัง deploy ด้วยประโยคเดิมและยืนยันได้รับคำตอบร้าน “ไก่ย่างดีดี นครนายก” พร้อมลิงก์ที่บันทึกไว้ โดยไม่ได้เพิ่ม alias หรือแก้ความจำ ยืนยันกรณีที่รายงานผ่าน end-to-end
- ชุดสมมติ 5 ข้อในแอดมินยังไม่ได้กดรันจริงรอบนี้ เพราะ Chrome ที่เปิดแอดมินหยุดเชื่อมต่อ; ไม่สับสนกับ automated tests 93 ข้อที่ผ่าน

## ธีมเดียวกับ PEPOS

- เปลี่ยนสีทุกหน้าเป็น chocolate `#4F4038` / cream `#F7F5F3` และฟอนต์ Sarabun อ้างอิง `noosol-pos/public/styles.css`
- Deployment `dpl_D1cKSQxqFnnpgDQvpoAkMWWnwQFP` Ready / Production; alias เดิม
- Build/TypeScript ผ่าน ตรวจหน้า login จริงแล้วฟอนต์โหลดสำเร็จ สีพื้นหลังและปุ่มตรงกับ POS และไม่มี horizontal overflow
- หน้า admin ใช้ global stylesheet เดียวกัน; รอบนี้ไม่ได้ล็อกอินเพื่อดูข้อมูล admin

## อัปเดต Gemini · เชื่อมและทดสอบจริง 29 กันยายน 2026

- Production: `dpl_7Ai6p191vXZxdxGt7kCLEHNNBnS1`, alias เดิม `https://pp-theta-beryl.vercel.app`
- เพิ่ม semantic selector ผ่าน Gemini 3.5 Flash-Lite; ส่งเฉพาะคำถามและตัวอย่าง Shareable ไม่ส่งคำตอบหรือ private ให้ Google
- เพิ่ม SQL ตรวจ visibility/expiry/permissions/revision ซ้ำหลัง model เลือก ID; ไม่เชื่อข้อความคำตอบที่ model แต่ง
- จำกัด 1000 AI calls/เดือนเวลาไทยแบบ atomic รวมทุกกลุ่ม พร้อมเพดาน payload/output/timeout และไม่มี retry
- เพิ่มสถานะ ยอดใช้ และปุ่มทดสอบใน `/admin#ai`; ทดสอบกับ Google จริงผ่าน 3/3: “ปปชอบกินอะไร” ตรงกับ “ปีโป้ชอบรับประทานอะไร”, คำถามมื้อปัจจุบันและคนอื่นคืน unknown
- Migration ใหม่บน NOOSOL WEBSITE: `20260929121726_pp_semantic_matching`; มี 7 ตาราง PP; public เดิมยังครบ 4 ตาราง
- Typecheck, 93 automated tests และ production build ผ่าน ทั้ง local และ Vercel
- Supabase security advisor: INFO RLS enabled/no policy 7 ตาราง PP เป็นความตั้งใจให้ server-only; อีก WARN เป็น Auth leaked-password protection ของบัญชีร่วม ไม่ได้แก้ตั้งค่าส่วนกลาง ดู [แนวทาง Supabase](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
- เปิด AI ผ่าน Vercel Workload Identity หลังได้รับอนุญาตและผ่านการทดสอบจริง; pool/provider จำกัด team ID, project ID และ production; service account มีเพียง predict/use พร้อมสิทธิ์สวมบัญชีของ exact subject ดู [GOOGLE-IDENTITY.md](GOOGLE-IDENTITY.md)
- ไม่มี Google key ถาวร ไม่มีการเติมเงินหรืออัปเกรด Billing; API key policy เดิมไม่ได้ถูกลดความปลอดภัย
- เครดิต Developer Program Aug/Sep รับเข้า Billing แล้วอย่างละ ฿329; account ยัง Free Trial การเรียกโมเดลจริงสำเร็จ แต่ยังไม่ยืนยันว่ารายการเรียกแต่ละครั้งถูกหักจากเครดิตก้อนไหนเพราะรายงาน Billing อาจล่าช้า
- การทดสอบสมมติใช้ 4 slots (ครั้งแรกไม่สำเร็จขณะเพิ่งตั้งสิทธิ์ และ 3 ข้อที่ผ่าน); ไม่มีการส่งข้อความ LINE หรือเพิ่มความจำจริงระหว่างทดสอบ
- ยังไม่มี memory จริงของเจ้าของ; ไม่ seed ข้อมูลส่วนตัวจากตัวอย่างสมมติ

ส่วนด้านล่างเป็นประวัติการติดตั้ง LINE/Supabase ก่อนเพิ่ม Gemini

## เสร็จแล้ว

- เว็บ production: https://pp-theta-beryl.vercel.app
- Vercel: โปรเจกต์ `pp`, ทีม `regener00-creators-projects`, Next.js 16.3.6 / Node 24
- Deployment ล่าสุด: `CSM1FjWL7jDyMDpBT6o47FpuFr9U` สถานะ Ready / Production พร้อมคำเรียกแบบพิมพ์ตรง ๆ
- ฐานข้อมูลใช้ NOOSOL WEBSITE ตามที่ผู้ใช้เลือก (`uyrwypfrvfhoryuvcujg`) แยกไว้ใน schema `pp`
- สร้างตาราง PP ครบ 6 ตาราง; ตาราง `public` เดิมยังมี 4 ตาราง ไม่ได้แก้เนื้อหาหรือสิทธิ์ของตารางเดิม
- Migration history และไฟล์ในโปรเจกต์ตรงกัน: `20260929034158_pp_initial`, `20260929035036_pp_expose_api`
- Exposed schemas: `public, graphql_public, pp` โดยเพิ่มเฉพาะ `pp` หลังได้รับอนุญาต
- ตั้ง Vercel Production environment แล้ว: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `ADMIN_USER_ID`, `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `CRON_SECRET`, `ALLOW_TEXT_TRIGGER=true`
- เปิดคำเรียกแบบพิมพ์ `@pp คำถาม` / `@PP คำถาม` เพื่อรองรับ LINE บนเครื่องของผู้ใช้ที่ไม่แสดงตัวเลือกแท็กบอท ยังต้องอนุมัติกลุ่ม และยังรองรับ mention จริงตามเดิม; ทดสอบชุด LINE 7 ข้อผ่าน
- ผู้ใช้สร้างบัญชีแอดมิน Supabase Auth แล้ว อีเมลยืนยันแล้ว และตั้ง ADMIN_USER_ID ตรงบัญชีที่ผู้ใช้เลือกเฉพาะ Production; ผู้ใช้ล็อกอินสำเร็จและตรวจหน้าแอดมินโหลดข้อมูลจริงแล้ว
- สร้าง LINE Official Account ชื่อ PP สำเร็จ เบสิค ID `@814rsybp`; เปิด Messaging API แล้ว ผู้ให้บริการ PP (`2005583727`), แชนแนล `2011792389`
- เปิด Use webhook, Webhook redelivery และอนุญาตเข้ากลุ่มแล้ว; ปิด Auto-reply messages และ Greeting messages
- บันทึก LINE user ID ของเจ้าของจากแชนแนลเดียวกันผ่านหน้าแอดมินแล้ว และตรวจยืนยันว่าค่าในฐานข้อมูลตรงกัน
- รับคำเรียกจากกลุ่มจริงแล้ว และเปิดสิทธิ์ตอบ/แท็กเจ้าของเฉพาะกลุ่ม “ปลาจาระเม็ดนึ่งบ๊วย” ตามที่ผู้ใช้เลือก
- ทดสอบ `@pp ทดสอบ` ในกลุ่มจริงหลังเปิดสิทธิ์สำเร็จ: ผู้ใช้ยืนยันได้รับข้อความ UNKNOWN และฐานข้อมูลบันทึก `status=replied`, `decision=unknown` เวลา 2026-09-29 18:31:43 Asia/Bangkok
- สร้าง Supabase secret key ชื่อ `pp_bot` และเก็บใน Vercel เป็น Secret เฉพาะ Production ตามที่ผู้ใช้ยืนยัน ไม่บันทึกค่ากุญแจลงซอร์สหรือเอกสาร
- สร้าง Git repository ในเครื่อง พร้อมซอร์ส, lockfile, migration, tests และ GitHub Actions สำหรับตรวจงาน ไม่มี remote GitHub ที่สร้างหรือ push

## ขั้นตอนทดสอบในกลุ่มจริง

ค่าระบบที่จำเป็นใน Vercel ตั้งครบแล้ว กลุ่ม “ปลาจาระเม็ดนึ่งบ๊วย” เปิดใช้งานและรับ-ตอบข้อความจริงสำเร็จแล้ว เหลือเพิ่มความจำจริงที่ผู้ใช้ต้องการให้ PP ตอบ สำหรับกลุ่มใหม่ใช้ขั้นตอนต่อไปนี้:

1. เชิญ PP (`@814rsybp`) เข้ากลุ่มที่เจ้าของอยู่ด้วย
2. พิมพ์ `@pp ทดสอบ` ตรง ๆ ได้ หรือพิมพ์ `@` แล้วเลือก PP จากรายชื่อสมาชิก ตามด้วยคำถามหนึ่งครั้ง เพื่อให้กลุ่มปรากฏในหน้าแอดมิน
3. เปิดสิทธิ์ตอบสำหรับกลุ่มนั้นใน `/admin` → กลุ่มและสิทธิ์
4. เพิ่มความจำจริงที่เจ้าของต้องการให้ตอบ เลือก Shareable และกำหนดตัวอย่างคำถาม
5. ทดสอบคำตอบจาก Shareable, การปฏิเสธเรื่องส่วนตัว และการแท็กเจ้าของเมื่อไม่รู้เรื่องที่เจ้าของควรตอบ

ณ การตรวจล่าสุด มีกลุ่มที่อนุมัติแล้วหนึ่งกลุ่ม ยังไม่มีความจำ ไม่มี memory ของเจ้าของถูกเดาหรือ seed เข้าไป การเพิ่มความจำและอนุมัติกลุ่มไม่ต้อง Redeploy

ตั้ง LINE webhook แล้วเป็น:

```text
https://pp-theta-beryl.vercel.app/api/line/webhook
```

รายละเอียดการดูแลระบบอยู่ใน [README.md](README.md)

## หลักฐานทดสอบ

- Automated tests **60 ผ่าน**: policy, LINE signature/mention, webhook HTTP, admin authorization, bot orchestration และ PostgreSQL ผ่าน PGlite
- TypeScript typecheck ผ่าน
- Production build บนเครื่องและ Vercel ผ่าน
- บน Supabase จริง: ทดสอบ shareable คืนคำตอบ, private คืนเฉพาะ refusal และกลุ่มที่ไม่มีสิทธิ์ถูกปฏิเสธ การทดสอบอยู่ใน transaction ที่ rollback แล้ว ไม่มีข้อมูลทดสอบเหลือ
- บน Supabase จริง: ทั้ง 6 ตารางเปิด RLS, `anon` และ `authenticated` ไม่มี schema usage, `service_role` มี usage
- หลัง expose schema ทดสอบ Data API ด้วย publishable key ได้ HTTP 401 / `42501 permission denied for schema pp` ตามที่ต้องการ
- Supabase security advisor มีเฉพาะ INFO “RLS Enabled No Policy” 6 รายการสำหรับ PP: ตั้งใจปิดการเข้าถึงตรงทั้งหมดและใช้ server-only service role ไม่มีการเพิ่ม policy อนุญาตผู้ใช้ทั่วไป
- Browser: หน้าแรกแสดงผล, มือถือ 390px ไม่มี horizontal overflow, `/admin` พาไป setup เมื่อยังไม่มีบัญชี, หน้า login อธิบายค่าที่ยังขาด ไม่พบ browser errors ในการตรวจ
- HTTP ก่อนใส่ค่าตั้งค่าครบ: `/` และ `/api/health` 200; `/admin` 307 ไป setup; `/login` 200; `/api/maintenance` ที่ไม่มีกุญแจ 401; webhook 503 “Not configured” ตามคาด ทุกเส้นทางมี nosniff และ frame DENY; ผลหลังตั้งค่าครบระบุด้านล่าง
- ตรวจ Vercel production error logs ย้อนหลัง 15 นาทีหลัง deploy: ไม่พบรายการ error ไม่มีการตั้งระบบแจ้งเตือนหรือ log drain เพิ่มในงานนี้

## ขอบเขตที่ยังไม่ยืนยัน

ล็อกอินผ่านบัญชีแอดมินจริง โหลดข้อมูล และบันทึกเจ้าของผ่านหน้าเว็บสำเร็จแล้ว รับข้อความเรียกจากกลุ่มจริงและส่งคำตอบ UNKNOWN สำเร็จหลังอนุมัติ ยังไม่ได้ทดสอบ CRUD ของความจำผ่านหน้าเว็บจริงหรือส่ง mention เจ้าของในกลุ่มจริง (ทดสอบระดับอัตโนมัติแล้ว)

หลังตั้ง ADMIN_USER_ID: หน้า `/login` HTTP 200 แสดงแบบฟอร์มอีเมล/รหัสผ่าน; `/admin` ที่ไม่ได้ล็อกอิน HTTP 307 ไป `/login` ตามที่ต้องการ

หลังเชื่อม LINE: กด Verify ใน LINE Developers ได้ Success ยืนยันว่า LINE ส่ง Webhook ที่ลงลายเซ็นถึง production ได้; คำขอที่ไม่มีลายเซ็นถูกปฏิเสธ HTTP 401 / Invalid signature ตามที่ต้องการ `/api/health` ยังคงเป็น liveness probe เท่านั้น

หลัง Redeploy พร้อม Supabase secret key ทดสอบ `/api/maintenance` ด้วย CRON_SECRET แล้วได้ HTTP 200 / `{ "ok": true }` ยืนยันว่าเซิร์ฟเวอร์ production เชื่อมฐานข้อมูลและเรียก `pp_cleanup` ได้จริง

ข้อมูล PP แยกตารางจาก NOOSOL แต่ยังใช้ทรัพยากร Auth, โควตา, backup และขอบเขตคีย์เซิร์ฟเวอร์ร่วมกันตามที่แจ้งก่อนเลือกใช้ร่วม

กุญแจใน `.env.local` ไม่อยู่ใน Git, ซอร์ส ZIP หรือไฟล์ที่ Vercel deploy เป็นซอร์ส


## Content Planner

ใช้ migration 20261002024755_pp_content_planner.sql ก่อน deploy แอปที่มี /planner เพิ่มตาราง content_brands, content_sources, content_generations, content_items, content_deliveries พร้อม RLS/ACL/indexes และ RPC claim แบบ idempotent

Cron เพิ่ม /api/content-reminders schedule 0 1 * * * (UTC) ใช้ CRON_SECRET เดิม อย่าเรียก route นี้เพื่อ smoke test เมื่อมีรายการถึงกำหนด เพราะส่ง LINE จริง ทดสอบ auth ด้วย request ไม่มีกุญแจต้องได้ 401 และทดสอบ sender ด้วย mocks

Vercel Hobby ปัจจุบันรองรับ 100 jobs/project ความถี่ต่ำสุดวันละครั้งและ precision รายชั่วโมง: https://vercel.com/docs/cron-jobs/usage-and-pricing

ไม่มี environment variable หรือผู้ให้บริการ AI ใหม่ การ roll back แอปยังคงข้อมูล Content Planner ในฐานข้อมูลไว้ได้ โดยไม่แก้ข้อมูล MEMORY
