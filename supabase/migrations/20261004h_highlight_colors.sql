-- Expertise Engine: highlighter colours on saved highlights (xe_saved kind 'snippet').
alter table public.xe_saved add column if not exists color text not null default 'yellow'
  check (color in ('yellow', 'green', 'blue', 'pink'));

create policy xe_saved_update on public.xe_saved for update to anon, authenticated using (true) with check (true);
grant update (color) on public.xe_saved to anon, authenticated;
