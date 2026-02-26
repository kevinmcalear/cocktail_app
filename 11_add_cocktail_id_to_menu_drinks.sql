ALTER TABLE public.menu_drinks 
ADD COLUMN IF NOT EXISTS cocktail_id UUID REFERENCES public.cocktails(id);

-- Notify PostgREST to reload its schema cache automatically
NOTIFY pgrst, 'reload schema';
