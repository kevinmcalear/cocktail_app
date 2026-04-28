-- RPC to get bar members
CREATE OR REPLACE FUNCTION public.get_bar_members(p_bar_id UUID)
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    role_level INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_role INT;
BEGIN
    -- Check if the current user has access to this bar
    SELECT ub.role_level INTO v_user_role
    FROM public.user_bars ub
    WHERE ub.bar_id = p_bar_id AND ub.user_id = auth.uid();

    IF v_user_role IS NULL THEN
        RAISE EXCEPTION 'You do not have access to view this bar members.';
    END IF;

    RETURN QUERY
    SELECT 
        ub.user_id,
        au.email::TEXT,
        ub.role_level
    FROM public.user_bars ub
    JOIN auth.users au ON ub.user_id = au.id
    WHERE ub.bar_id = p_bar_id;
END;
$$;

-- Notify pgrst
NOTIFY pgrst, 'reload schema';
