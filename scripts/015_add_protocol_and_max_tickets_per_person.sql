-- Agregar tipo "protocolo" a la tabla promotion_codes
alter table public.promotion_codes drop constraint if exists promotion_codes_promotion_type_check;
alter table public.promotion_codes add constraint promotion_codes_promotion_type_check 
  check (promotion_type in ('percentage', 'fixed', '2x1', 'protocol'));

-- Agregar campo max_tickets_per_person a la tabla events
alter table public.events add column if not exists max_tickets_per_person integer;

-- Comentarios para documentación
comment on column public.promotion_codes.promotion_type is 'Tipo de promoción: percentage (%), fixed ($), 2x1 (paga 1 lleva 2), protocol (entrada gratis)';
comment on column public.events.max_tickets_per_person is 'Cantidad máxima de entradas que una persona puede comprar. NULL = sin límite';
