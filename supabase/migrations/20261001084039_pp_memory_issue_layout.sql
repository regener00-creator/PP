-- Cosmetic card changes must not dismiss a reviewed conflict.
create function pp.pp_keep_issue_revision_on_layout() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if (to_jsonb(old)-array['card_color','sort_order','updated_at']) =
    (to_jsonb(new)-array['card_color','sort_order','updated_at']) then
  update pp.memory_issues set left_revision=md5(row_to_json(new)::text)
   where left_id=new.id and left_revision=md5(row_to_json(old)::text);
  update pp.memory_issues set right_revision=md5(row_to_json(new)::text)
   where right_id=new.id and right_revision=md5(row_to_json(old)::text);
 end if;
 return new;
end;
$$;
revoke all on function pp.pp_keep_issue_revision_on_layout() from public,anon,authenticated;
grant execute on function pp.pp_keep_issue_revision_on_layout() to service_role;
create trigger keep_issue_revision_on_layout after update on pp.memories
for each row execute function pp.pp_keep_issue_revision_on_layout();
