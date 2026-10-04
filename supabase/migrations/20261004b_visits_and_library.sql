-- Expertise Engine: visit trail (colours explored paths, restores where you left off)
-- and the Library (saved courses, chapters and highlighted snippets).

create table if not exists public.xe_visits (
  node_id uuid primary key references public.xe_nodes(id) on delete cascade,
  visited_at timestamptz not null default now()
);
comment on table public.xe_visits is 'Expertise Engine: last time each node was opened.';
create index if not exists xe_visits_recent_idx on public.xe_visits (visited_at desc);

create table if not exists public.xe_saved (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references public.xe_nodes(id) on delete cascade,
  kind text not null check (kind in ('node', 'snippet')),
  text text not null default '' check (char_length(text) <= 4000),
  created_at timestamptz not null default now()
);
comment on table public.xe_saved is 'Expertise Engine: Library items — a saved node, or a text snippet from a chapter.';
create unique index if not exists xe_saved_one_per_node on public.xe_saved (node_id) where kind = 'node';

alter table public.xe_visits enable row level security;
alter table public.xe_saved enable row level security;

create policy xe_visits_read on public.xe_visits for select to anon, authenticated using (true);
create policy xe_visits_insert on public.xe_visits for insert to anon, authenticated with check (true);
create policy xe_visits_update on public.xe_visits for update to anon, authenticated using (true) with check (true);

create policy xe_saved_read on public.xe_saved for select to anon, authenticated using (true);
create policy xe_saved_insert on public.xe_saved for insert to anon, authenticated with check (true);
create policy xe_saved_delete on public.xe_saved for delete to anon, authenticated using (true);

grant select, insert, update on public.xe_visits to anon, authenticated;
grant select, insert, delete on public.xe_saved to anon, authenticated;
