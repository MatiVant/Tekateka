-- Prioridad editorial para ordenar eventos destacados.
alter table public.events
  add column if not exists priority integer not null default 0;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'events_priority_range') then
    alter table public.events add constraint events_priority_range check (priority between 0 and 2);
  end if;
end $$;

create index if not exists events_priority_date_idx on public.events (priority desc, event_date asc);
