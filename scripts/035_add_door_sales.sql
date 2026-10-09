CREATE TABLE IF NOT EXISTS public.door_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  buyer_name text,
  buyer_note text,
  payment_method text NOT NULL DEFAULT 'cash',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS door_sales_event_id_created_at_idx ON public.door_sales(event_id, created_at DESC);
ALTER TABLE public.door_sales ENABLE ROW LEVEL SECURITY;
