-- Agregar campo payment_info a la tabla profiles para que los organizadores puedan configurar sus instrucciones de pago
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS payment_info TEXT;

-- Valor por defecto para organizadores existentes
UPDATE profiles 
SET payment_info = 'Por favor transferir a CBU: XXXX-XXXX-XXXX-XXXX. Alias: miempresa.pago'
WHERE role = 'organizer' AND payment_info IS NULL;
