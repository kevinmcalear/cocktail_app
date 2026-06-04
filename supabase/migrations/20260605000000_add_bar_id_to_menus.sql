-- Migration to add bar_id to menus table
ALTER TABLE public.menus 
ADD COLUMN bar_id UUID REFERENCES public.bars(id) ON DELETE SET NULL;

-- Trigger PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
