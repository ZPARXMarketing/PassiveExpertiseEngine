-- Expertise Engine: the subject > branch > course > chapter tree and its generated text.
-- New tables only, all prefixed xe_. Safe to run on the shared project.

create table if not exists public.xe_nodes (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.xe_nodes(id) on delete cascade,
  level text not null check (level in ('subject', 'branch', 'course', 'chapter')),
  title text not null check (char_length(title) between 1 and 200),
  summary text not null default '' check (char_length(summary) <= 2000),
  meta jsonb not null default '{}'::jsonb,
  position int not null default 0,
  created_at timestamptz not null default now(),
  check ((level = 'subject') = (parent_id is null))
);
comment on table public.xe_nodes is 'Expertise Engine: subject > branch > course > chapter tree, generated on demand.';
create index if not exists xe_nodes_parent_idx on public.xe_nodes (parent_id, position);

create table if not exists public.xe_lessons (
  node_id uuid primary key references public.xe_nodes(id) on delete cascade,
  body jsonb not null,
  model text,
  created_at timestamptz not null default now()
);
comment on table public.xe_lessons is 'Expertise Engine: generated chapter text, one row per chapter node.';

create table if not exists public.xe_completions (
  node_id uuid primary key references public.xe_nodes(id) on delete cascade,
  completed_at timestamptz not null default now()
);
comment on table public.xe_completions is 'Expertise Engine: chapters the learner marked as done.';

alter table public.xe_nodes enable row level security;
alter table public.xe_lessons enable row level security;
alter table public.xe_completions enable row level security;

-- Single-user app on the publishable key: read + append freely, delete only whole subjects.
create policy xe_nodes_read on public.xe_nodes for select to anon, authenticated using (true);
create policy xe_nodes_insert on public.xe_nodes for insert to anon, authenticated with check (true);
create policy xe_nodes_delete_subject on public.xe_nodes for delete to anon, authenticated using (level = 'subject');

create policy xe_lessons_read on public.xe_lessons for select to anon, authenticated using (true);
create policy xe_lessons_insert on public.xe_lessons for insert to anon, authenticated with check (true);

create policy xe_completions_read on public.xe_completions for select to anon, authenticated using (true);
create policy xe_completions_insert on public.xe_completions for insert to anon, authenticated with check (true);
create policy xe_completions_delete on public.xe_completions for delete to anon, authenticated using (true);

grant select, insert, delete on public.xe_nodes, public.xe_completions to anon, authenticated;
grant select, insert on public.xe_lessons to anon, authenticated;
