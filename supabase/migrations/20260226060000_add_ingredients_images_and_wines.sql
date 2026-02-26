-- Create the wines table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.wines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    price TEXT,
    status TEXT DEFAULT 'Current',
    image TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Note: The `beers` table already exists, but we need to ensure it has an `image` column
ALTER TABLE IF EXISTS public.beers ADD COLUMN IF NOT EXISTS image TEXT;

-- Create the ingredient_images join table
CREATE TABLE IF NOT EXISTS public.ingredient_images (
    ingredient_id UUID REFERENCES public.ingredients(id) ON DELETE CASCADE,
    image_id UUID REFERENCES public.images(id) ON DELETE CASCADE,
    PRIMARY KEY (ingredient_id, image_id)
);

-- Set up Row Level Security (RLS) for the new tables
ALTER TABLE public.wines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredient_images ENABLE ROW LEVEL SECURITY;

-- Allow read access to all users
CREATE POLICY "Allow public read access to wines" ON public.wines FOR SELECT USING (true);
CREATE POLICY "Allow public read access to ingredient_images" ON public.ingredient_images FOR SELECT USING (true);

-- Enable realtime
alter publication supabase_realtime add table public.wines;
alter publication supabase_realtime add table public.ingredient_images;
