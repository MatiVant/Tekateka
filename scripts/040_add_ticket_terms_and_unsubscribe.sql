-- Registra la aceptación de términos y permite gestionar bajas de comunicaciones promocionales.
alter table public.tickets
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists terms_accepted_at timestamp with time zone,
  add column if not exists terms_version text;

create index if not exists idx_tickets_marketing_consent
  on public.tickets(marketing_consent)
  where marketing_consent = true;

create table if not exists public.marketing_unsubscribes (
  email text primary key,
  unsubscribed_at timestamp with time zone not null default now()
);

alter table public.marketing_unsubscribes enable row level security;

comment on table public.marketing_unsubscribes is 'Emails que solicitaron no recibir comunicaciones promocionales';
