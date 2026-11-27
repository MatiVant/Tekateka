-- 050: el organizador decide si las entradas gratis / "a la gorra" necesitan su aprobación.
-- Es idempotente y no cambia nada de lo existente: por defecto ningún evento pide aprobación.
-- No hace falta tocar el check de tickets.status: una solicitud pendiente usa el estado
-- 'pending' que ya existe (con payment_method = 'free').

alter table public.events
  add column if not exists requires_approval boolean not null default false;

comment on column public.events.requires_approval is
  'true = las entradas que salen en $0 (evento gratis, o a la gorra pagando $0) quedan pendientes hasta que el organizador las apruebe.';

-- Para que la API vea la columna enseguida.
notify pgrst, 'reload schema';
