-- Evita enviar más de una notificación preliminar por compra.
-- Ejecutar en Supabase antes de desplegar el código que usa esta tabla.
create table if not exists public.purchase_notifications (
  id uuid primary key default gen_random_uuid(),
  purchase_group_id uuid not null,
  event_id uuid not null references public.events(id) on delete cascade,
  notification_type text not null,
  recipient_email text not null,
  status text not null default 'sending' check (status in ('sending', 'sent')),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (purchase_group_id, notification_type)
);

create index if not exists purchase_notifications_event_id_idx
  on public.purchase_notifications(event_id);

alter table public.purchase_notifications enable row level security;
