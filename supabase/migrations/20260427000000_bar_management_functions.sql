-- RPC to add user by email
CREATE OR REPLACE FUNCTION public.add_user_to_bar_by_email(
    p_email TEXT,
    p_bar_id UUID,
    p_role_level INT
)
RETURNS public.user_bars
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_admin_role INT;
    v_new_user_bar public.user_bars;
BEGIN
    -- Check if the current user is an Admin (40) of this bar
    SELECT role_level INTO v_admin_role
    FROM public.user_bars
    WHERE bar_id = p_bar_id AND user_id = auth.uid();

    IF v_admin_role IS NULL OR v_admin_role < 40 THEN
        RAISE EXCEPTION 'You must be a bar Admin to add members.';
    END IF;

    -- Find the user by email
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = p_email;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User not found with that email.';
    END IF;

    -- Insert or update the user_bar record
    INSERT INTO public.user_bars (user_id, bar_id, role_level)
    VALUES (v_user_id, p_bar_id, p_role_level)
    ON CONFLICT (user_id, bar_id) 
    DO UPDATE SET role_level = EXCLUDED.role_level
    RETURNING * INTO v_new_user_bar;

    RETURN v_new_user_bar;
END;
$$;

-- RPC to update bar settings
CREATE OR REPLACE FUNCTION public.update_bar_settings(
    p_bar_id UUID,
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
    v_admin_role INT;
    v_updated_bar public.bars;
BEGIN
    -- Check if the current user is an Admin (40) of this bar
    SELECT role_level INTO v_admin_role
    FROM public.user_bars
    WHERE bar_id = p_bar_id AND user_id = auth.uid();

    IF v_admin_role IS NULL OR v_admin_role < 40 THEN
        RAISE EXCEPTION 'You must be a bar Admin to update bar settings.';
    END IF;

    UPDATE public.bars
    SET 
        name = p_name,
        default_visibility_level = p_visibility,
        default_generic_ingredient_level = p_generic,
        default_specific_brand_level = p_specific,
        default_measurement_level = p_measurement,
        default_prep_level = p_prep
    WHERE id = p_bar_id
    RETURNING * INTO v_updated_bar;

    RETURN v_updated_bar;
END;
$$;

-- RPC to assign item to bar
CREATE OR REPLACE FUNCTION public.assign_item_to_bar(
    p_item_id UUID,
    p_bar_id UUID
)
RETURNS public.items
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_role INT;
    v_updated_item public.items;
BEGIN
    -- Check if the current user is an Admin (40) of this bar
    SELECT role_level INTO v_admin_role
    FROM public.user_bars
    WHERE bar_id = p_bar_id AND user_id = auth.uid();

    IF v_admin_role IS NULL OR v_admin_role < 40 THEN
        RAISE EXCEPTION 'You must be a bar Admin to assign items to this bar.';
    END IF;

    UPDATE public.items
    SET bar_id = p_bar_id
    WHERE id = p_item_id
    RETURNING * INTO v_updated_item;

    RETURN v_updated_item;
END;
$$;

-- Notify pgrst
NOTIFY pgrst, 'reload schema';
