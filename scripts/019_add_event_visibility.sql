ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.events.is_public IS
  'Whether the event is listed on public home and organizer pages';
