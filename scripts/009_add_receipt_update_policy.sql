-- Agregar política para permitir que usuarios actualicen sus propios tickets con comprobantes
-- Esto permite que usuarios invitados (sin buyer_id) puedan subir comprobantes

DROP POLICY IF EXISTS tickets_update_receipt ON tickets;

CREATE POLICY tickets_update_receipt ON tickets
  FOR UPDATE
  TO public
  USING (
    -- Permite actualizar si es el comprador autenticado
    (auth.uid() IS NOT NULL AND buyer_id = auth.uid())
    OR
    -- Permite actualizar si es un organizador del evento
    (EXISTS (
      SELECT 1 FROM events e 
      WHERE e.id = tickets.event_id 
      AND e.organizer_id = auth.uid()
    ))
    OR
    -- Permite actualizar si es ticketero
    (EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('organizer', 'ticketero')
    ))
  )
  WITH CHECK (
    -- Mismo check que USING
    (auth.uid() IS NOT NULL AND buyer_id = auth.uid())
    OR
    (EXISTS (
      SELECT 1 FROM events e 
      WHERE e.id = tickets.event_id 
      AND e.organizer_id = auth.uid()
    ))
    OR
    (EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('organizer', 'ticketero')
    ))
  );
