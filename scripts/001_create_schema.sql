-- Tabla de perfiles de usuario con roles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null check (role in ('visitor', 'organizer', 'ticketero')),
  created_at timestamp with time zone default now()
);

alter table public.profiles enable row level security;

-- Políticas para profiles
create policy "profiles_select_all"
  on public.profiles for select
  using (true);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- Tabla de eventos
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  event_date timestamp with time zone not null,
  venue text not null,
  price decimal(10,2) not null,
  total_tickets integer not null,
  available_tickets integer not null,
  image_url text,
  status text not null default 'active' check (status in ('active', 'inactive', 'sold_out')),
  created_at timestamp with time zone default now()
);

alter table public.events enable row level security;

-- Políticas para events
create policy "events_select_all"
  on public.events for select
  using (true);

create policy "events_insert_organizer"
  on public.events for insert
  with check (
    auth.uid() = organizer_id and
    exists (select 1 from public.profiles where id = auth.uid() and role = 'organizer')
  );

create policy "events_update_organizer"
  on public.events for update
  using (
    auth.uid() = organizer_id and
    exists (select 1 from public.profiles where id = auth.uid() and role = 'organizer')
  );

create policy "events_delete_organizer"
  on public.events for delete
  using (
    auth.uid() = organizer_id and
    exists (select 1 from public.profiles where id = auth.uid() and role = 'organizer')
  );

-- Tabla de tickets/entradas
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  buyer_name text not null,
  buyer_email text not null,
  qr_code text unique not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'used', 'cancelled')),
  purchased_at timestamp with time zone default now(),
  verified_at timestamp with time zone,
  verified_by uuid references public.profiles(id)
);

alter table public.tickets enable row level security;

-- Políticas para tickets
create policy "tickets_select_own_or_organizer_or_ticketero"
  on public.tickets for select
  using (
    auth.uid() = buyer_id or
    exists (
      select 1 from public.events e
      where e.id = tickets.event_id and e.organizer_id = auth.uid()
    ) or
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('organizer', 'ticketero')
    )
  );

create policy "tickets_insert_own"
  on public.tickets for insert
  with check (auth.uid() = buyer_id);

create policy "tickets_update_organizer_or_ticketero"
  on public.tickets for update
  using (
    exists (
      select 1 from public.events e
      where e.id = tickets.event_id and e.organizer_id = auth.uid()
    ) or
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('organizer', 'ticketero')
    )
  );

-- Índices para mejorar rendimiento
create index if not exists idx_events_organizer on public.events(organizer_id);
create index if not exists idx_events_date on public.events(event_date);
create index if not exists idx_tickets_event on public.tickets(event_id);
create index if not exists idx_tickets_buyer on public.tickets(buyer_id);
create index if not exists idx_tickets_qr on public.tickets(qr_code);
