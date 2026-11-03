CREATE TABLE IF NOT EXISTS public.event_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('ticket', 'door_sale')),
  source_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'reviewed' CHECK (status IN ('reviewed', 'modified', 'cancelled')),
  observation text,
  action_reason text,
  adjusted_quantity integer CHECK (adjusted_quantity IS NULL OR adjusted_quantity > 0),
  adjusted_unit_price numeric(12,2) CHECK (adjusted_unit_price IS NULL OR adjusted_unit_price >= 0),
  adjusted_amount numeric(12,2) CHECK (adjusted_amount IS NULL OR adjusted_amount >= 0),
  adjusted_buyer_name text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS event_reconciliations_event_id_idx ON public.event_reconciliations(event_id);
ALTER TABLE public.event_reconciliations ENABLE ROW LEVEL SECURITY;
