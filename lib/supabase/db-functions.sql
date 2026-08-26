-- Función para incrementar contador de promociones de manera segura
create or replace function increment_promotion_usage(id uuid)
returns void as $$
begin
  update promotion_codes
  set current_uses = current_uses + 1
  where promotion_codes.id = $1;
end;
$$ language plpgsql;
