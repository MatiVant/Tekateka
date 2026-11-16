-- Comisión configurable de TekaTeka y consultas de compradores.
-- platform_settings ya existe desde 038 como key/value; reutilizamos esa estructura.
create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (key, value)
values ('platform_fee_percent', '{"percent": 8, "starts_at": null}'::jsonb)
on conflict (key) do nothing;

-- Primera activación: mañana. Si ya se configuró una fecha, no la pisa.
update public.platform_settings
set value = value || jsonb_build_object('starts_at', (current_date + 1)::text), updated_at = now()
where key = 'platform_fee_percent' and (not (value ? 'starts_at') or value->>'starts_at' is null);

alter table public.venues
  add column if not exists platform_fee_percent numeric(5,2) check (platform_fee_percent is null or (platform_fee_percent >= 0 and platform_fee_percent <= 100));

alter table public.tickets
  add column if not exists platform_fee_percent numeric(5,2) not null default 0,
  add column if not exists platform_fee_amount numeric(12,2) not null default 0;

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  buyer_name text,
  buyer_email text not null,
  event_id uuid references public.events(id) on delete set null,
  ticket_id uuid references public.tickets(id) on delete set null,
  category text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  created_at timestamptz not null default now()
);

create index if not exists support_requests_created_at_idx on public.support_requests(created_at desc);
create index if not exists support_requests_status_idx on public.support_requests(status);

alter table public.platform_settings enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'platform_settings' and policyname = 'platform_settings_select_authenticated') then
    create policy "platform_settings_select_authenticated" on public.platform_settings for select using (auth.uid() is not null);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'platform_settings' and policyname = 'platform_settings_update_superadmin') then
    create policy "platform_settings_update_superadmin" on public.platform_settings for update using (exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin'));
  end if;
end $$;

alter table public.support_requests enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'support_requests' and policyname = 'support_requests_insert_public') then
    create policy "support_requests_insert_public" on public.support_requests for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'support_requests' and policyname = 'support_requests_select_superadmin') then
    create policy "support_requests_select_superadmin" on public.support_requests for select using (exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'support_requests' and policyname = 'support_requests_update_superadmin') then
    create policy "support_requests_update_superadmin" on public.support_requests for update using (exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin'));
  end if;
end $$;
