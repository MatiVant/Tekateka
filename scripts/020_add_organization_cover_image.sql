ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organization_cover_image_url text;

COMMENT ON COLUMN public.profiles.organization_cover_image_url IS
  'Public cover image URL for an organizer organization page';
