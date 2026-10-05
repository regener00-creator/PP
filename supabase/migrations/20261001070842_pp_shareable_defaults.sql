-- New owner-authored content is available for group replies. Do not republish old rows.
alter table pp.memories alter column visibility set default 'shareable';
alter table pp.files alter column visibility set default 'shareable';
-- Keep existing visibility constraints, RLS and private storage bucket unchanged.
notify pgrst, 'reload schema';
