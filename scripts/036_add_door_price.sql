alter table public.events add column if not exists door_ticket_price numeric(10,2);

comment on column public.events.door_ticket_price is 'Precio por entrada para ventas en puerta';
