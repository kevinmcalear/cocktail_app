-- Drop bars.accent_text, the hand pick for button text on the venue accent
-- ('cream' or 'ink'). The venue colour system (#1008) made button text
-- automatic: buttons use whichever ink reads better on the accent, and the
-- app no longer reads or writes this column.
--
--   * Drops the column and its check constraint (bars_accent_text_check).
--   * guard_bar_brand: the same brand list as 20261101200000, without
--     accent_text.

ALTER TABLE "public"."bars" DROP CONSTRAINT IF EXISTS "bars_accent_text_check";
ALTER TABLE "public"."bars" DROP COLUMN "accent_text";

CREATE OR REPLACE FUNCTION "private"."guard_bar_brand"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_brand text[] := ARRAY['logo_url', 'primary_color', 'secondary_color', 'accent_light_color', 'display_face',
                            'ground_tint', 'short_name', 'icon_url', 'icon_background'];
BEGIN
    IF auth.uid() IS NULL OR private.is_app_admin() THEN
        RETURN NEW;
    END IF;
    IF (to_jsonb(NEW) - v_brand) IS DISTINCT FROM (to_jsonb(OLD) - v_brand)
       AND NEW.id NOT IN (SELECT private.my_bar_ids(40)) THEN
        RAISE EXCEPTION 'Only an Admin can change the venue''s settings.';
    END IF;
    IF EXISTS (SELECT 1 FROM unnest(v_brand) AS k WHERE to_jsonb(NEW) -> k IS DISTINCT FROM to_jsonb(OLD) -> k)
       AND NEW.id NOT IN (SELECT private.bars_with_capability('brand')) THEN
        RAISE EXCEPTION 'Changing the venue''s brand needs the edit brand permission.';
    END IF;
    RETURN NEW;
END;
$$;
