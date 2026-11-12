ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS cancellation_request_status text CHECK (cancellation_request_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS cancellation_request_reason text,
  ADD COLUMN IF NOT EXISTS cancellation_requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancellation_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancellation_reviewed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tickets_cancellation_request
  ON public.tickets(cancellation_request_status)
  WHERE cancellation_request_status = 'pending';
