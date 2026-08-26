-- Agregar campos para control de organizadores
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS organizer_status text DEFAULT 'pending' 
  CHECK (organizer_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'free' 
  CHECK (subscription_status IN ('free', 'active', 'inactive')),
ADD COLUMN IF NOT EXISTS subscription_expires_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS events_created_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Actualizar el check constraint del rol para incluir superadmin
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('visitor', 'organizer', 'ticketero', 'superadmin'));

-- Agregar comentarios explicativos
COMMENT ON COLUMN public.profiles.organizer_status IS 'Estado de aprobación del organizador: pending (pendiente), approved (aprobado), rejected (rechazado)';
COMMENT ON COLUMN public.profiles.subscription_status IS 'Estado de suscripción: free (1 evento gratis), active (suscripción pagada), inactive (sin suscripción)';
COMMENT ON COLUMN public.profiles.events_created_count IS 'Contador de eventos creados por el organizador';

-- Función para actualizar el contador de eventos
CREATE OR REPLACE FUNCTION increment_event_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET events_created_count = events_created_count + 1
  WHERE id = NEW.organizer_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar automáticamente el contador
DROP TRIGGER IF EXISTS update_event_count ON public.events;
CREATE TRIGGER update_event_count
  AFTER INSERT ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION increment_event_count();

-- Política para que superadmins puedan ver y editar todos los perfiles
CREATE POLICY "superadmin_all_profiles"
  ON public.profiles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

-- Actualizar política de inserción de eventos para verificar límites
DROP POLICY IF EXISTS events_insert_organizer ON public.events;
CREATE POLICY "events_insert_organizer"
  ON public.events FOR INSERT
  WITH CHECK (
    auth.uid() = organizer_id AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() 
        AND role = 'organizer'
        AND organizer_status = 'approved'
        AND (
          subscription_status = 'active' OR
          (subscription_status = 'free' AND events_created_count < 1)
        )
    )
  );
