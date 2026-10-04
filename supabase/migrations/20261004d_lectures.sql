-- Expertise Engine: recorded lectures. Script + metadata live in xe_extras (kind 'lecture');
-- the MP3 lives in the public storage bucket xe-lectures so any device can play/download it.

alter table public.xe_extras drop constraint if exists xe_extras_kind_check;
alter table public.xe_extras add constraint xe_extras_kind_check
  check (kind in ('deeper', 'answer', 'practice', 'check', 'fixed', 'lecture'));
create index if not exists xe_extras_kind_idx on public.xe_extras (kind, created_at);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('xe-lectures', 'xe-lectures', true, 52428800, array['audio/mpeg'])
on conflict (id) do nothing;

create policy xe_lectures_insert on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'xe-lectures');
create policy xe_lectures_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'xe-lectures');
