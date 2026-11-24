-- 047: Propuestas de espacios por organizadores + escritura de venues solo superadmin.
-- Idempotente y no destructivo: los espacios existentes quedan 'approved' y activos.
-- La app escribe venues siempre con service role desde server actions.

alter table public.venues add column if not exists status text not null default 'approved';
alter table public.venues add column if not exists proposed_by uuid references public.profiles(id) on delete set null;
alter table public.venues add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.venues add column if not exists reviewed_at timestamp with time zone;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'venues_status_check') then
    alter table public.venues
      add constraint venues_status_check check (status in ('pending', 'approved', 'rejected'));
  end if;
end $$;

create index if not exists venues_pending_idx on public.venues (created_at) where status = 'pending';
create index if not exists venues_proposed_by_idx on public.venues (proposed_by);

comment on column public.venues.status is 'pending = propuesto por un organizador; approved = visible en el catálogo; rejected = rechazado.';
comment on column public.venues.proposed_by is 'Organizador que propuso el espacio (null si lo creó el superadmin).';

-- Antes cualquier organizador podía insertar o modificar cualquier espacio desde el navegador.
-- Ahora solo el superadmin (o el service role, que ignora RLS).
drop policy if exists "venues_insert_organizer" on public.venues;
drop policy if exists "venues_update_organizer" on public.venues;
drop policy if exists "venues_insert_superadmin" on public.venues;
drop policy if exists "venues_update_superadmin" on public.venues;

create policy "venues_insert_superadmin"
  on public.venues for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin')
  );

create policy "venues_update_superadmin"
  on public.venues for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin')
  );
