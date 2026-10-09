-- A bar's own-ice credit is confirmed as it's made only on its own venue's
-- drinks (after 20261011152100). It also went through for the drink's origin
-- bar, which a person sets on their own home drink, so anyone could credit
-- "ice by" any bar and have it confirmed. A bar's page is credited for ice on
-- its own drinks only now; everyone else credits a maker, which its team
-- confirms.

CREATE OR REPLACE FUNCTION "private"."guard_item_maker_credit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_item public.items;
    v_profile public.profiles;
BEGIN
    SELECT * INTO v_item FROM public.items WHERE id = NEW.item_id;
    IF v_item.id IS NULL OR v_item.item_type <> 'cocktail' THEN
        RAISE EXCEPTION 'Credit a maker on a drink.' USING ERRCODE = 'check_violation';
    END IF;
    SELECT * INTO v_profile FROM public.profiles WHERE id = NEW.profile_id;
    -- The drink's own bar, cutting its own ice: confirmed as it's made.
    IF v_profile.kind = 'bar' AND NEW.makes = 'ice' AND v_item.bar_id IS NOT NULL AND v_profile.bar_id = v_item.bar_id THEN
        NEW.confirmed_at := COALESCE(NEW.confirmed_at, now());
        RETURN NEW;
    END IF;
    IF v_profile.kind IS DISTINCT FROM 'maker' OR NOT (NEW.makes = ANY (v_profile.makes)) THEN
        RAISE EXCEPTION 'That maker''s page doesn''t say it makes %.', NEW.makes USING ERRCODE = 'check_violation';
    END IF;
    -- Anyone else's credit waits for the maker to confirm it.
    IF TG_OP = 'INSERT' AND auth.uid() IS NOT NULL AND NOT private.is_app_admin() THEN
        NEW.confirmed_at := NULL;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION "private"."guard_item_maker_credit"() FROM PUBLIC, "anon", "authenticated";
