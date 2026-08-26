-- Agregar campo para comprobante de pago en tickets
alter table public.tickets 
add column if not exists payment_receipt_url text,
add column if not exists payment_notes text;

-- Agregar campo para instrucciones de pago en eventos
alter table public.events
add column if not exists payment_instructions text default 'Por favor, realiza la transferencia bancaria y sube el comprobante. Te confirmaremos tu entrada una vez verificado el pago.';
