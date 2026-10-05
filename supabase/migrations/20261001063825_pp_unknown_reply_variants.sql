-- Preserve the configured reply as the first variant; the owner writes any extras.
create function pp.pp_valid_unknown_replies(p_values text[]) returns boolean
language sql immutable security invoker set search_path='' as $$
  select coalesce(array_ndims(p_values)=1 and cardinality(p_values) between 1 and 20
    and not exists(select 1 from unnest(p_values) v where v is null
      or length(v) not between 1 and 2000 or v !~ '[^[:space:]]'),false);
$$;
revoke all on function pp.pp_valid_unknown_replies(text[]) from public,anon,authenticated;
grant execute on function pp.pp_valid_unknown_replies(text[]) to service_role;
alter table pp.owner add column unknown_replies text[];
update pp.owner set unknown_replies=array[unknown_reply];
alter table pp.owner alter column unknown_replies set default array['ยังไม่มีข้อมูลเรื่องนี้'];
alter table pp.owner alter column unknown_replies set not null;
alter table pp.owner add constraint owner_unknown_replies_valid check(pp.pp_valid_unknown_replies(unknown_replies));
notify pgrst,'reload schema';
