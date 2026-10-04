-- Expertise Engine: study tools. Everything generated around a chapter (go-deeper
-- sub-lessons, answers, practice sets, fact-checks, corrected versions) plus synced prefs.

create table if not exists public.xe_extras (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references public.xe_nodes(id) on delete cascade,
  kind text not null check (kind in ('deeper', 'answer', 'practice', 'check', 'fixed')),
  key text not null default '' check (char_length(key) <= 1000),
  body jsonb not null,
  model text,
  created_at timestamptz not null default now()
);
comment on table public.xe_extras is 'Expertise Engine: study-tool output hung off a chapter, newest row per (kind, key) wins.';
create index if not exists xe_extras_node_idx on public.xe_extras (node_id, created_at);

create table if not exists public.xe_prefs (
  key text primary key check (char_length(key) <= 100),
  value jsonb not null,
  updated_at timestamptz not null default now()
);
comment on table public.xe_prefs is 'Expertise Engine: app preferences synced across devices.';

alter table public.xe_extras enable row level security;
alter table public.xe_prefs enable row level security;

create policy xe_extras_read on public.xe_extras for select to anon, authenticated using (true);
create policy xe_extras_insert on public.xe_extras for insert to anon, authenticated with check (true);
create policy xe_extras_delete on public.xe_extras for delete to anon, authenticated using (true);

create policy xe_prefs_read on public.xe_prefs for select to anon, authenticated using (true);
create policy xe_prefs_insert on public.xe_prefs for insert to anon, authenticated with check (true);
create policy xe_prefs_update on public.xe_prefs for update to anon, authenticated using (true) with check (true);

grant select, insert, delete on public.xe_extras to anon, authenticated;
grant select, insert, update on public.xe_prefs to anon, authenticated;
