-- Agregar campo para link de Mercado Pago en eventos
ALTER TABLE events ADD COLUMN IF NOT EXISTS mercado_pago_link TEXT;

-- Comentario descriptivo
COMMENT ON COLUMN events.mercado_pago_link IS 'Link de pago de Mercado Pago para el evento';
