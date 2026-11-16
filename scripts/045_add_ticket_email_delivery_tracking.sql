-- Trazabilidad de emails de entradas confirmadas, agrupados por compra.
create table if not exists public.ticket_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  purchase_group_id uuid,
  event_id uuid not null references public.events(id) on delete cascade,
  buyer_email text not null,
  ticket_ids uuid[] not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  resend_id text,
  error_message text,
  attempts integer not null default 0,
  sent_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (purchase_group_id),
  unique (event_id, buyer_email, id)
);

create index if not exists ticket_email_deliveries_status_idx on public.ticket_email_deliveries(status);
create index if not exists ticket_email_deliveries_event_id_idx on public.ticket_email_deliveries(event_id);

alter table public.ticket_email_deliveries enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticket_email_deliveries' and policyname = 'ticket_email_deliveries_select_superadmin') then
    create policy "ticket_email_deliveries_select_superadmin" on public.ticket_email_deliveries for select using (exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticket_email_deliveries' and policyname = 'ticket_email_deliveries_update_superadmin') then
    create policy "ticket_email_deliveries_update_superadmin" on public.ticket_email_deliveries for update using (exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin'));
  end if;
end $$;
