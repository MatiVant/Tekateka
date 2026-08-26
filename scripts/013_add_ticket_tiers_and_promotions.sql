-- Tabla de tipos de entradas (tiers) con precios dinámicos por fecha
create table if not exists public.ticket_tiers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  description text,
  base_price decimal(10,2) not null,
  quantity integer not null,
  available_quantity integer not null,
  tier_order integer not null,
  created_at timestamp with time zone default now()
);

-- Tabla de precios dinámicos por fecha para cada tier
create table if not exists public.tier_price_dates (
  id uuid primary key default gen_random_uuid(),
  tier_id uuid not null references public.ticket_tiers(id) on delete cascade,
  price decimal(10,2) not null,
  valid_from date not null,
  valid_until date not null,
  created_at timestamp with time zone default now()
);

-- Tabla de códigos de promoción
create table if not exists public.promotion_codes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  code text not null,
  promotion_type text not null check (promotion_type in ('percentage', 'fixed', '2x1')),
  discount_value decimal(10,2) not null,
  description text,
  category text,
  max_uses integer,
  current_uses integer default 0,
  valid_from date not null,
  valid_until date not null,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  unique(event_id, code)
);

-- Tabla para registrar el uso de promociones en tickets
create table if not exists public.ticket_promotions (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  promotion_code_id uuid not null references public.promotion_codes(id),
  discount_amount decimal(10,2) not null,
  original_price decimal(10,2) not null,
  final_price decimal(10,2) not null,
  created_at timestamp with time zone default now()
);

-- Agregar columnas a tabla tickets para referencia de tier y promoción
alter table public.tickets add column if not exists tier_id uuid references public.ticket_tiers(id);
alter table public.tickets add column if not exists promotion_code_id uuid references public.promotion_codes(id);
alter table public.tickets add column if not exists final_price decimal(10,2);

-- Habilitar RLS
alter table public.ticket_tiers enable row level security;
alter table public.tier_price_dates enable row level security;
alter table public.promotion_codes enable row level security;
alter table public.ticket_promotions enable row level security;

-- Políticas RLS para ticket_tiers
create policy "ticket_tiers_select_all"
  on public.ticket_tiers for select
  using (true);

create policy "ticket_tiers_insert_organizer"
  on public.ticket_tiers for insert
  with check (
    exists (
      select 1 from public.events e
      where e.id = ticket_tiers.event_id and e.organizer_id = auth.uid()
    )
  );

create policy "ticket_tiers_update_organizer"
  on public.ticket_tiers for update
  using (
    exists (
      select 1 from public.events e
      where e.id = ticket_tiers.event_id and e.organizer_id = auth.uid()
    )
  );

create policy "ticket_tiers_delete_organizer"
  on public.ticket_tiers for delete
  using (
    exists (
      select 1 from public.events e
      where e.id = ticket_tiers.event_id and e.organizer_id = auth.uid()
    )
  );

-- Políticas RLS para tier_price_dates
create policy "tier_price_dates_select_all"
  on public.tier_price_dates for select
  using (true);

create policy "tier_price_dates_insert_organizer"
  on public.tier_price_dates for insert
  with check (
    exists (
      select 1 from public.ticket_tiers tt
      join public.events e on tt.event_id = e.id
      where tt.id = tier_price_dates.tier_id and e.organizer_id = auth.uid()
    )
  );

create policy "tier_price_dates_update_organizer"
  on public.tier_price_dates for update
  using (
    exists (
      select 1 from public.ticket_tiers tt
      join public.events e on tt.event_id = e.id
      where tt.id = tier_price_dates.tier_id and e.organizer_id = auth.uid()
    )
  );

-- Políticas RLS para promotion_codes
create policy "promotion_codes_select_organizer"
  on public.promotion_codes for select
  using (
    exists (
      select 1 from public.events e
      where e.id = promotion_codes.event_id and e.organizer_id = auth.uid()
    )
  );

create policy "promotion_codes_insert_organizer"
  on public.promotion_codes for insert
  with check (
    exists (
      select 1 from public.events e
      where e.id = promotion_codes.event_id and e.organizer_id = auth.uid()
    )
  );

create policy "promotion_codes_update_organizer"
  on public.promotion_codes for update
  using (
    exists (
      select 1 from public.events e
      where e.id = promotion_codes.event_id and e.organizer_id = auth.uid()
    )
  );

-- Políticas RLS para ticket_promotions
create policy "ticket_promotions_select_own_or_organizer"
  on public.ticket_promotions for select
  using (
    exists (
      select 1 from public.tickets t
      where t.id = ticket_promotions.ticket_id and (
        t.buyer_id = auth.uid() or
        exists (
          select 1 from public.events e
          where e.id = t.event_id and e.organizer_id = auth.uid()
        )
      )
    )
  );

-- Índices para mejorar rendimiento
create index if not exists idx_ticket_tiers_event on public.ticket_tiers(event_id);
create index if not exists idx_tier_price_dates_tier on public.tier_price_dates(tier_id);
create index if not exists idx_promotion_codes_event on public.promotion_codes(event_id);
create index if not exists idx_promotion_codes_code on public.promotion_codes(code);
create index if not exists idx_ticket_promotions_ticket on public.ticket_promotions(ticket_id);
create index if not exists idx_tickets_tier on public.tickets(tier_id);
