-- A bar's unit (Kevin, 1 Nov 2026): bars.spec_unit is the unit everyone at
-- the bar reads specs in and starts new recipe lines in (ml, oz, cl or g,
-- the Units setting's choices; specs read cl as ml). A person's own Units
-- setting, on their device, wins over it; with none, they follow their bar,
-- and with no bar, ml.
--
--   * bars.spec_unit, ml unless set. Each bar starts on the unit most of its
--     drinks' poured lines are written in, ml, oz or cl (ties go to ml; grams
--     are for solids, so they never decide it), which is what the invited
--     units step guessed from its recipes until now; that guess goes, and the
--     app reads this column instead.
--   * Who reads and sets it: the bars policies as they are. Its people read
--     it (bars_select, any current member); only its Admins change it
--     (guard_bar_brand lets the brand permission change the brand columns
--     alone, so anything else, this included, needs a current Admin).
--     Signed-out visitors and other bars' people read nothing.
--   * update_bar_settings (the venue settings page's Save) takes it as
--     p_spec_unit; left out, the bar's unit stays as it is, so an app from
--     before this saves as it did.

ALTER TABLE "public"."bars"
    ADD COLUMN "spec_unit" "text" DEFAULT 'ml' NOT NULL,
    ADD CONSTRAINT "bars_spec_unit_check" CHECK ("spec_unit" IN ('ml', 'oz', 'cl', 'g'));

COMMENT ON COLUMN "public"."bars"."spec_unit" IS 'The unit everyone at the bar reads specs and starts new recipe lines in (ml, oz, cl or g), unless they pick their own. Only its Admins change it.';

-- Each bar starts on the unit its drinks are mostly written in.
UPDATE "public"."bars" b
   SET "spec_unit" = m."unit"
  FROM (
    SELECT DISTINCT ON (i."bar_id") i."bar_id", r."unit"
      FROM "public"."recipes" r
      JOIN "public"."items" i ON i."id" = r."recipe_item_id"
     WHERE i."bar_id" IS NOT NULL
       AND i."item_type" = 'cocktail'
       AND r."unit" IN ('ml', 'oz', 'cl')
     GROUP BY i."bar_id", r."unit"
     ORDER BY i."bar_id", count(*) DESC, (r."unit" = 'ml') DESC, r."unit"
  ) m
 WHERE m."bar_id" = b."id"
   AND m."unit" <> b."spec_unit";

-- --- The venue settings page's Save ---

DROP FUNCTION "public"."update_bar_settings"("uuid", "text", integer, integer, integer, integer, integer, "text", "text", "text");

CREATE FUNCTION "public"."update_bar_settings"("p_bar_id" "uuid", "p_name" "text", "p_visibility" integer, "p_generic" integer, "p_specific" integer, "p_measurement" integer, "p_prep" integer, "p_logo_url" "text" DEFAULT NULL::"text", "p_primary_color" "text" DEFAULT NULL::"text", "p_secondary_color" "text" DEFAULT NULL::"text", "p_spec_unit" "text" DEFAULT NULL::"text") RETURNS "public"."bars"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_updated_bar public.bars;
BEGIN
    IF p_bar_id IS NULL OR p_bar_id NOT IN (SELECT private.my_bar_ids(40)) THEN
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
        secondary_color = p_secondary_color,
        spec_unit = COALESCE(p_spec_unit, spec_unit)
    WHERE id = p_bar_id
    RETURNING * INTO v_updated_bar;

    RETURN v_updated_bar;
END;
$$;

REVOKE ALL ON FUNCTION "public"."update_bar_settings"("uuid", "text", integer, integer, integer, integer, integer, "text", "text", "text", "text") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."update_bar_settings"("uuid", "text", integer, integer, integer, integer, integer, "text", "text", "text", "text") TO "authenticated", "service_role";
