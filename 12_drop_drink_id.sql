-- The drink_id column with its dual constraints is confusing PostgREST when we try to select cocktails. 
-- Since we migrated insertion logic to cocktail_id, we can safely drop drink_id.
ALTER TABLE public.menu_drinks DROP COLUMN IF EXISTS drink_id;

NOTIFY pgrst, 'reload schema';
