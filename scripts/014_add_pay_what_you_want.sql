-- Agregar campo is_pay_what_you_want a la tabla events
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_pay_what_you_want BOOLEAN DEFAULT FALSE;

-- Actualizar eventos existentes que tengan precio 0 para marcarlos como gratuitos
UPDATE events SET is_pay_what_you_want = FALSE WHERE price = 0;
