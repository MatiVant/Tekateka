-- Actualizar el constraint del campo status para incluir 'finished'
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_check;
ALTER TABLE events ADD CONSTRAINT events_status_check CHECK (status IN ('active', 'inactive', 'sold_out', 'finished'));

-- Función para archivar eventos pasados automáticamente
CREATE OR REPLACE FUNCTION archive_past_events()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE events
  SET status = 'finished'
  WHERE event_date < NOW()
  AND status != 'finished';
END;
$$;

-- Crear índice para mejorar consultas de eventos activos
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_active_date ON events(status, event_date) WHERE status IN ('active', 'inactive', 'sold_out');

-- Comentarios
COMMENT ON FUNCTION archive_past_events IS 'Marca como finalizados los eventos cuya fecha ya pasó';
