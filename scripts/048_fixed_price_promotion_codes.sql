-- 048: Códigos de entrada de PRECIO FIJO ('fixed_price').
-- Un código de este tipo hace que la entrada cueste exactamente promotion_codes.discount_value
-- (en pesos), sin importar el precio normal del tipo de entrada.
--
-- No borra ni modifica datos: solo amplía los valores permitidos de promotion_type.
-- Los códigos existentes (percentage, fixed, 2x1, protocol) siguen igual.
-- Es idempotente: se puede correr más de una vez.
-- (Supabase puede mostrar un aviso "destructivo" por los DROP CONSTRAINT: es solo
-- reemplazar la regla de validación por una más amplia.)

alter table public.promotion_codes
  drop constraint if exists promotion_codes_promotion_type_check;

alter table public.promotion_codes
  add constraint promotion_codes_promotion_type_check
  check (promotion_type in ('percentage', 'fixed', '2x1', 'protocol', 'fixed_price'));

-- Un precio fijo tiene que ser mayor a 0 (para entrada gratis existe el tipo 'protocol').
alter table public.promotion_codes
  drop constraint if exists promotion_codes_fixed_price_positive;

alter table public.promotion_codes
  add constraint promotion_codes_fixed_price_positive
  check (promotion_type <> 'fixed_price' or discount_value > 0);

comment on column public.promotion_codes.promotion_type is
  'Tipo de código: percentage (% de descuento), fixed ($ de descuento), 2x1, protocol (gratis), fixed_price (la entrada cuesta exactamente discount_value $)';
comment on column public.promotion_codes.discount_value is
  'Valor del código: % para percentage, $ de descuento para fixed, PRECIO FINAL en $ para fixed_price';
