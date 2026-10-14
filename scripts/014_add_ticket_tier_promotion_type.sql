-- Define promociones estructurales en los tipos de entrada.
-- No depende del nombre visible del tipo ni de un código promocional.
alter table public.ticket_tiers
  add column if not exists promotion_type text not null default 'standard';

alter table public.ticket_tiers
  drop constraint if exists ticket_tiers_promotion_type_check;

alter table public.ticket_tiers
  add constraint ticket_tiers_promotion_type_check
  check (promotion_type in ('standard', '2x1'));
