-- Expertise Engine: charts/diagrams a learner adds to a chapter section (kind 'visual').

alter table public.xe_extras drop constraint if exists xe_extras_kind_check;
alter table public.xe_extras add constraint xe_extras_kind_check
  check (kind in ('deeper', 'answer', 'practice', 'check', 'fixed', 'lecture', 'visual'));
