-- A menu cover's credit: who took the photo (Miss-cover-credit). Typed as
-- "Photo by" under the cover in the editor; shown as "Photo: <name>" on the
-- cover. Empty: no line. Read and written with the menu, under its own
-- policies.

ALTER TABLE "public"."menus" ADD COLUMN "cover_credit" "text";
ALTER TABLE "public"."menus" ADD CONSTRAINT "menus_cover_credit_check"
    CHECK ("cover_credit" IS NULL OR char_length("cover_credit") BETWEEN 1 AND 80);
COMMENT ON COLUMN "public"."menus"."cover_credit" IS
    'Who took the cover photo, as typed ("Jess Rowe", "@niki_mir on Unsplash"). Shown as Photo: <credit>; null for none.';

-- A credit belongs to its photo: a new cover (from any app version) drops the
-- old credit unless the same update sets one, and a credit-only change counts
-- as an edit (updated_at), like the cover. Named to sort before
-- menus_edited_at: BEFORE triggers fire in name order.
CREATE FUNCTION "private"."menu_cover_credit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.cover_url IS DISTINCT FROM OLD.cover_url AND NEW.cover_credit IS NOT DISTINCT FROM OLD.cover_credit THEN
        NEW.cover_credit := NULL;
    END IF;
    IF NEW.cover_credit IS DISTINCT FROM OLD.cover_credit THEN
        NEW.updated_at := now();
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "menus_cover_credit" BEFORE UPDATE OF "cover_url", "cover_credit" ON "public"."menus"
    FOR EACH ROW EXECUTE FUNCTION "private"."menu_cover_credit"();
