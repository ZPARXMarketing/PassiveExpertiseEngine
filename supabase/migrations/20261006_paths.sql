-- Expertise Engine: Paths. An ordered list of chapters (steps) aimed at one goal, made by hand
-- from the Library or drafted by the AI. Steps point at xe_nodes; done-ness is xe_completions.
-- steps: [{ "node_id": uuid, "note": "why this step", "minutes": 45 }]. Applied 2026-10-06.
create table if not exists public.xe_paths (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  goal text not null default '' check (char_length(goal) <= 4000),
  focus text not null default '' check (char_length(focus) <= 4000),
  due date,
  steps jsonb not null default '[]'::jsonb,
  color text not null default '#2affa3' check (color ~ '^#[0-9a-fA-F]{6}$'),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.xe_paths enable row level security;
create policy xe_paths_all on public.xe_paths for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on public.xe_paths to anon, authenticated;
