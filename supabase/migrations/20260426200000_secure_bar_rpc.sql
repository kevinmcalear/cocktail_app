-- 1. Create the RPC function for atomic bar creation
CREATE OR REPLACE FUNCTION public.create_new_bar(
    p_name TEXT,
    p_visibility INT,
    p_generic INT,
    p_specific INT,
    p_measurement INT,
    p_prep INT
)
RETURNS public.bars
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_bar public.bars;
BEGIN
    -- Insert the new bar
    INSERT INTO public.bars (
        name,
        default_visibility_level,
        default_generic_ingredient_level,
        default_specific_brand_level,
        default_measurement_level,
        default_prep_level
    ) VALUES (
        p_name,
        p_visibility,
        p_generic,
        p_specific,
        p_measurement,
        p_prep
    ) RETURNING * INTO new_bar;

    -- Assign the creator as Admin (40)
    INSERT INTO public.user_bars (bar_id, user_id, role_level)
    VALUES (new_bar.id, auth.uid(), 40);

    RETURN new_bar;
END;
$$;

-- 2. Drop the old insecure policy that allowed anyone to insert into user_bars
DROP POLICY IF EXISTS "Users can insert their own bar roles or admins can add users" ON public.user_bars;

-- 3. Replace with a secure policy: Only Admins can INSERT others into user_bars
-- (The initial insert is handled by the RPC which bypasses RLS)
CREATE POLICY "Admins can insert user_bars" ON public.user_bars FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_bars ub WHERE ub.bar_id = bar_id AND ub.user_id = auth.uid() AND ub.role_level >= 35)
);

-- Note: We also drop the old insert policy on bars since the RPC handles it,
-- but leaving it doesn't hurt since the RPC is used by the client. 
-- However, for strict security, we should drop it:
DROP POLICY IF EXISTS "Users can create bars" ON public.bars;

-- Trigger schema cache reload for PostgREST
NOTIFY pgrst, 'reload schema';
