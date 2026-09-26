-- Drink field: every picture gets a small colour palette, so the drink page can
-- paint a colour field behind the hero (docs/design_system.md, "Drink field").
--
-- images.palette is [dominant, deep, light] as lowercase "#rrggbb" strings:
--   NULL = not computed yet, [] = computed, but the picture has no colour.
--
-- The image-palette edge function computes it. A trigger wakes the function
-- through pg_net whenever a row has no palette:
--   * on insert, so every way a picture arrives (app uploads, the Generate
--     button, the automatic sketch worker) gets a palette without app changes;
--   * when palette is set back to NULL, so `UPDATE images SET palette = NULL`
--     recomputes it. The function always writes a non-NULL value, so this
--     can't loop;
--   * when url changes: a BEFORE trigger clears the old picture's palette
--     first, so a palette always belongs to the row's current picture.
-- The trigger needs two Vault secrets; until they exist it does nothing, and
-- scripts/backfill-palettes.mjs fills the gaps.
--
-- Only the service role (the function) and database owners set palette.
-- Signed-in users can still insert images rows, but not with a palette.

CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";

ALTER TABLE "public"."images"
    ADD COLUMN "palette" jsonb,
    ADD CONSTRAINT "images_palette_hex_colours" CHECK (
        "palette" IS NULL OR (
            jsonb_typeof("palette") = 'array'
            AND jsonb_array_length("palette") <= 3
            AND NOT jsonb_path_exists("palette", '$[*] ? (@.type() != "string" || !(@ like_regex "^#[0-9a-f]{6}$"))')
        )
    );

COMMENT ON COLUMN "public"."images"."palette" IS
    'Drink field colours [dominant, deep, light] as "#rrggbb"; NULL = not computed, [] = no colour. Set only by the service role (the image-palette edge function); cleared when url changes; set it to NULL to recompute.';

-- Pokes image-palette for a picture with no palette. Never blocks the write: a
-- failed request just leaves the palette NULL for the backfill script.
CREATE FUNCTION "private"."request_image_palette"() RETURNS trigger
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_url text;
    v_secret text;
BEGIN
    SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'image_palette_url';
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'image_palette_secret';
    IF v_url IS NULL OR v_secret IS NULL THEN
        RETURN NULL;
    END IF;

    PERFORM net.http_post(
        url := v_url,
        body := jsonb_build_object('image_id', NEW.id),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-image-palette-secret', v_secret),
        timeout_milliseconds := 10000
    );
    RETURN NULL;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'request_image_palette: %', SQLERRM;
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION "private"."request_image_palette"() FROM PUBLIC;

-- Before every write:
--   1. Only the service role and database owners may set palette. A trigger,
--      not column grants: the table is granted to authenticated as a whole,
--      and a column REVOKE doesn't override that.
--   2. A new url means a new picture, so its old palette is cleared. The AFTER
--      trigger below then asks for a new one (it lists url too: column
--      triggers follow the UPDATE's SET list, not columns a BEFORE trigger
--      changed).
-- SECURITY INVOKER on purpose, so current_user is the caller's role.
CREATE FUNCTION "private"."guard_image_palette"() RETURNS trigger
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') AND (
        (TG_OP = 'INSERT' AND NEW.palette IS NOT NULL)
        OR (TG_OP = 'UPDATE' AND NEW.palette IS DISTINCT FROM OLD.palette)
    ) THEN
        RAISE EXCEPTION 'Only the server sets images.palette.' USING ERRCODE = '42501';
    END IF;

    IF TG_OP = 'UPDATE' AND NEW.url IS DISTINCT FROM OLD.url THEN
        NEW.palette := NULL;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION "private"."guard_image_palette"() FROM PUBLIC;

CREATE TRIGGER "images_guard_palette"
    BEFORE INSERT OR UPDATE ON "public"."images"
    FOR EACH ROW
    EXECUTE FUNCTION "private"."guard_image_palette"();

CREATE TRIGGER "images_request_palette"
    AFTER INSERT OR UPDATE OF "palette", "url" ON "public"."images"
    FOR EACH ROW
    WHEN (NEW."palette" IS NULL)
    EXECUTE FUNCTION "private"."request_image_palette"();
