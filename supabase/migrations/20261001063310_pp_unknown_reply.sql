-- A plain-text fallback controlled by the existing authenticated admin.
-- Keep owner identity, RLS and server-only grants unchanged.
alter table pp.owner add column unknown_reply text not null default 'ยังไม่มีข้อมูลเรื่องนี้'
  check (length(unknown_reply) between 1 and 2000 and unknown_reply ~ '[^[:space:]]');
notify pgrst, 'reload schema';
