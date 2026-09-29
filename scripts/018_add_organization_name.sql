-- Separate an organizer's public venue name from their personal name.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS organization_name TEXT;

COMMENT ON COLUMN public.profiles.organization_name IS 'Public name of the organizer venue or organization';
