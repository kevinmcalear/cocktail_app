-- 1. Create a SECURITY DEFINER function to bypass RLS and get the user's bars
CREATE OR REPLACE FUNCTION public.get_my_bars()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT bar_id FROM public.user_bars WHERE user_id = auth.uid();
$$;

-- 2. Drop the overly restrictive old policy
DROP POLICY IF EXISTS "Users can view their bar roles" ON public.user_bars;

-- 3. Create the new policy that allows you to see all members of any bar you belong to
CREATE POLICY "Bar members can view other members" 
ON public.user_bars 
FOR SELECT 
USING (
    bar_id IN (SELECT public.get_my_bars())
);

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
