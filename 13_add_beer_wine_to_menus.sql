ALTER TABLE public.menu_drinks 
ALTER COLUMN cocktail_id DROP NOT NULL;

ALTER TABLE public.menu_drinks 
ADD COLUMN IF NOT EXISTS beer_id UUID REFERENCES public.beers(id) ON DELETE CASCADE;

ALTER TABLE public.menu_drinks 
ADD COLUMN IF NOT EXISTS wine_id UUID REFERENCES public.wines(id) ON DELETE CASCADE;

-- Also update cocktail_id to have ON DELETE CASCADE so deleting a cocktail doesn't break the menu
ALTER TABLE public.menu_drinks 
DROP CONSTRAINT IF EXISTS menu_drinks_cocktail_id_fkey,
ADD CONSTRAINT menu_drinks_cocktail_id_fkey 
  FOREIGN KEY (cocktail_id) 
  REFERENCES public.cocktails(id) 
  ON DELETE CASCADE;

-- Notify PostgREST to reload its schema cache automatically
NOTIFY pgrst, 'reload schema';
