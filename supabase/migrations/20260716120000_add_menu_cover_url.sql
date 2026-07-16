-- Single cover image for menus (mirrors bars.logo_url)
ALTER TABLE public.menus
    ADD COLUMN IF NOT EXISTS cover_url TEXT;

NOTIFY pgrst, 'reload schema';
