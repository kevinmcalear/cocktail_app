-- Venue branding: logo + theme colors
ALTER TABLE public.bars
    ADD COLUMN IF NOT EXISTS logo_url TEXT,
    ADD COLUMN IF NOT EXISTS primary_color TEXT,
    ADD COLUMN IF NOT EXISTS secondary_color TEXT;

CREATE OR REPLACE FUNCTION public.update_bar_settings(
    p_bar_id UUID,
    p_name TEXT,
    p_visibility INT,
    p_generic INT,
    p_specific INT,
    p_measurement INT,
    p_prep INT,
    p_logo_url TEXT DEFAULT NULL,
    p_primary_color TEXT DEFAULT NULL,
    p_secondary_color TEXT DEFAULT NULL
)
RETURNS public.bars
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_role INT;
    v_updated_bar public.bars;
BEGIN
    SELECT role_level INTO v_admin_role
    FROM public.user_bars
    WHERE bar_id = p_bar_id AND user_id = auth.uid();

    IF v_admin_role IS NULL OR v_admin_role < 35 THEN
        RAISE EXCEPTION 'You must be a bar Admin to update bar settings.';
    END IF;

    UPDATE public.bars
    SET
        name = p_name,
        default_visibility_level = p_visibility,
        default_generic_ingredient_level = p_generic,
        default_specific_brand_level = p_specific,
        default_measurement_level = p_measurement,
        default_prep_level = p_prep,
        logo_url = COALESCE(p_logo_url, logo_url),
        primary_color = p_primary_color,
        secondary_color = p_secondary_color
    WHERE id = p_bar_id
    RETURNING * INTO v_updated_bar;

    RETURN v_updated_bar;
END;
$$;

NOTIFY pgrst, 'reload schema';
