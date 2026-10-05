-- Expand only PP's attachment limits; preserve all existing files and permissions.
alter table pp.memories
  drop constraint memories_attachment_ids_check,
  add constraint memories_attachment_ids_check check (cardinality(attachment_ids) <= 10);

alter table pp.calendar_events
  drop constraint calendar_events_attachment_ids_check,
  add constraint calendar_events_attachment_ids_check check (cardinality(attachment_ids) <= 10);
