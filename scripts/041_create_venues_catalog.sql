-- Catálogo único de espacios.
-- Mantiene events.venue durante la transición para no romper eventos existentes.

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text generated always as (lower(trim(name))) stored,
  cover_image_url text,
  address text,
  location_url text,
  active boolean not null default true,
  created_at timestamp with time zone not null default now()
);

create unique index if not exists venues_normalized_name_key
  on public.venues (normalized_name);

alter table public.venues enable row level security;

drop policy if exists "venues_select_all" on public.venues;
create policy "venues_select_all"
  on public.venues for select
  using (true);

drop policy if exists "venues_insert_organizer" on public.venues;
create policy "venues_insert_organizer"
  on public.venues for insert
  with check (
    auth.uid() is not null
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('organizer', 'superadmin')
    )
  );

drop policy if exists "venues_update_organizer" on public.venues;
create policy "venues_update_organizer"
  on public.venues for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('organizer', 'superadmin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('organizer', 'superadmin')
    )
  );

alter table public.events
  add column if not exists venue_id uuid references public.venues(id) on delete set null;

create index if not exists events_venue_id_idx on public.events (venue_id);

-- Carga inicial: un espacio por cada nombre existente, ignorando diferencias
-- de mayúsculas y espacios laterales.
insert into public.venues (name)
select min(trim(venue))
from public.events
where nullif(trim(venue), '') is not null
group by lower(trim(venue))
on conflict (normalized_name) do nothing;

-- Vincula los eventos históricos al catálogo.
update public.events as events
set venue_id = venues.id
from public.venues as venues
where events.venue_id is null
  and nullif(trim(events.venue), '') is not null
  and venues.normalized_name = lower(trim(events.venue));

comment on table public.venues is 'Catálogo único de espacios donde se realizan eventos.';
comment on column public.events.venue_id is 'Espacio normalizado del catálogo public.venues.';
comment on column public.events.venue is 'Texto histórico conservado durante la migración del catálogo de espacios.';
