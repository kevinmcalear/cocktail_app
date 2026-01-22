-- 1. Create Storage Bucket 'drinks'
INSERT INTO storage.buckets (id, name, public)
VALUES ('drinks', 'drinks', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Set Storage Policies for 'drinks'

-- Allow public read access
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'drinks' );

-- Allow authenticated uploads
CREATE POLICY "Authenticated Uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'drinks' );

-- Allow authenticated updates
CREATE POLICY "Authenticated Updates"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'drinks' );

-- 3. Ensure 'images' table exists
CREATE TABLE IF NOT EXISTS public.images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    url TEXT NOT NULL,
    storage_path TEXT
);

-- 4. Enable RLS and Add Policies for 'images'
ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;

-- Allow read access for all users
DROP POLICY IF EXISTS "Enable read access for all users" ON public.images;
CREATE POLICY "Enable read access for all users" ON public.images FOR SELECT USING (true);

-- Allow insert for authenticated users
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.images;
CREATE POLICY "Enable insert for authenticated users" ON public.images FOR INSERT TO authenticated WITH CHECK (true);

-- (OPTIONAL) Allow insert for anon users (if your app allows guest uploads)
-- CREATE POLICY "Enable insert for anon users" ON public.images FOR INSERT TO anon WITH CHECK (true);


-- 5. Ensure 'cocktail_images' join table exists
CREATE TABLE IF NOT EXISTS public.cocktail_images (
    cocktail_id UUID REFERENCES public.cocktails(id) ON DELETE CASCADE,
    image_id UUID REFERENCES public.images(id) ON DELETE CASCADE,
    PRIMARY KEY (cocktail_id, image_id)
);

-- 6. Enable RLS and Add Policies for 'cocktail_images'
ALTER TABLE public.cocktail_images ENABLE ROW LEVEL SECURITY;

-- Allow read access for all users
DROP POLICY IF EXISTS "Enable read access for all users" ON public.cocktail_images;
CREATE POLICY "Enable read access for all users" ON public.cocktail_images FOR SELECT USING (true);

-- Allow insert for authenticated users
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.cocktail_images;
CREATE POLICY "Enable insert for authenticated users" ON public.cocktail_images FOR INSERT TO authenticated WITH CHECK (true);
