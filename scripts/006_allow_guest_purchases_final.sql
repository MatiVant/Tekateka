-- Migración para permitir compras sin autenticación (usuarios invitados)

-- Paso 1: Hacer que buyer_id sea nullable
DO $$ 
BEGIN
  ALTER TABLE public.tickets ALTER COLUMN buyer_id DROP NOT NULL;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- Paso 2: Eliminar políticas antiguas si existen
DROP POLICY IF EXISTS "tickets_insert_own" ON public.tickets;
DROP POLICY IF EXISTS "tickets_insert_guest_or_authenticated" ON public.tickets;
DROP POLICY IF EXISTS "tickets_insert_policy" ON public.tickets;
DROP POLICY IF EXISTS "tickets_select_own_or_organizer_or_ticketero" ON public.tickets;
DROP POLICY IF EXISTS "tickets_select_guest_or_authenticated" ON public.tickets;
DROP POLICY IF EXISTS "tickets_select_policy" ON public.tickets;
DROP POLICY IF EXISTS "tickets_update_organizer_or_ticketero" ON public.tickets;
DROP POLICY IF EXISTS "tickets_update_policy" ON public.tickets;

-- Paso 3: Crear nuevas políticas para INSERT
CREATE POLICY "tickets_insert_guest_or_authenticated" ON public.tickets
  FOR INSERT
  TO public
  WITH CHECK (
    -- Caso 1: Usuario autenticado comprando para sí mismo
    (auth.uid() IS NOT NULL AND auth.uid() = buyer_id)
    OR
    -- Caso 2: Usuario invitado (sin autenticación) comprando sin buyer_id
    (auth.uid() IS NULL AND buyer_id IS NULL)
  );

-- Paso 4: Crear nuevas políticas para SELECT
CREATE POLICY "tickets_select_guest_or_authenticated" ON public.tickets
  FOR SELECT
  TO public
  USING (
    -- Usuario autenticado que compró el ticket
    (auth.uid() IS NOT NULL AND auth.uid() = buyer_id)
    OR
    -- Organizador del evento
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = tickets.event_id
      AND e.organizer_id = auth.uid()
    )
    OR
    -- Usuario con rol de organizador o ticketero
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('organizer', 'ticketero')
    )
  );

-- Paso 5: Crear nuevas políticas para UPDATE
CREATE POLICY "tickets_update_by_organizer_or_staff" ON public.tickets
  FOR UPDATE
  TO public
  USING (
    -- Organizador del evento puede actualizar
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = tickets.event_id
      AND e.organizer_id = auth.uid()
    )
    OR
    -- Usuario con rol de organizador o ticketero puede actualizar
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('organizer', 'ticketero')
    )
  );

-- Paso 6: Crear índice para búsqueda por email si no existe
CREATE INDEX IF NOT EXISTS idx_tickets_buyer_email ON public.tickets(buyer_email);

-- Comentario: Esta migración permite que usuarios no autenticados puedan comprar tickets
-- ingresando solo su email y nombre, sin necesidad de crear una cuenta.
