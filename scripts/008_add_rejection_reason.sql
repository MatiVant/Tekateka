-- Agregar campo para el motivo de rechazo
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Crear índice para búsquedas por estado
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
