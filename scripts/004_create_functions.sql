-- Función para decrementar tickets disponibles
create or replace function decrement_available_tickets(event_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.events
  set available_tickets = available_tickets - 1
  where id = event_id and available_tickets > 0;
  
  -- Actualizar estado a sold_out si no quedan tickets
  update public.events
  set status = 'sold_out'
  where id = event_id and available_tickets = 0;
end;
$$;
