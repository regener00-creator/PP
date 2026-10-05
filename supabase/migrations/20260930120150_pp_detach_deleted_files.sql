-- Keep future memory answers and reminders usable after a file is removed.
create function pp.pp_detach_deleted_file() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  update pp.memories set attachment_ids=array_remove(attachment_ids,old.id),updated_at=now()
    where attachment_ids @> array[old.id];
  update pp.calendar_events set attachment_ids=array_remove(attachment_ids,old.id),updated_at=now()
    where attachment_ids @> array[old.id];
  return old;
end;
$$;
create trigger detach_deleted_file after delete on pp.files for each row execute function pp.pp_detach_deleted_file();
revoke all on function pp.pp_detach_deleted_file() from public,anon,authenticated;
grant execute on function pp.pp_detach_deleted_file() to service_role;
notify pgrst,'reload schema';
