-- 049: Nombre por entrada (attendee_name).
-- Cada entrada puede llevar el nombre de quien la va a usar, distinto del comprador.
-- Lo carga o cambia el dueño de la entrada (con cuenta) desde "Mis entradas".
-- Si queda vacío, la entrada sigue saliendo a nombre del comprador (buyer_name).
--
-- Solo agrega una columna nueva y opcional: no borra ni cambia datos, no toca
-- permisos (RLS) y se puede correr más de una vez sin problema.

alter table public.tickets
  add column if not exists attendee_name text;

alter table public.tickets
  drop constraint if exists tickets_attendee_name_length;

alter table public.tickets
  add constraint tickets_attendee_name_length
  check (attendee_name is null or char_length(attendee_name) <= 80);

comment on column public.tickets.attendee_name is
  'Nombre de la persona que usa la entrada (opcional). Si es null se usa buyer_name.';
