-- Expertise Engine: named, coloured highlighter buckets. xe_saved.color now holds a bucket key;
-- the four original colours are seeded as buckets with the same keys, so old highlights keep working.
create table if not exists public.xe_buckets (
  key text primary key check (char_length(key) between 1 and 40),
  name text not null check (char_length(name) between 1 and 60),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  position double precision not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
insert into public.xe_buckets (key, name, color, position) values
  ('yellow', 'Yellow', '#ffd60a', 1), ('green', 'Green', '#2affa3', 2),
  ('blue', 'Blue', '#4cc9ff', 3), ('pink', 'Pink', '#ff5caa', 4)
on conflict (key) do nothing;
alter table public.xe_buckets enable row level security;
create policy xe_buckets_all on public.xe_buckets for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on public.xe_buckets to anon, authenticated;
alter table public.xe_saved drop constraint if exists xe_saved_color_check;
