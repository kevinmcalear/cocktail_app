-- DRAFT (schema proposal, docs/schema_proposal.md section 1). Local stack only.
--
-- Venue identity: everything a venue sets so the app looks like theirs while
-- that venue is active. Lives on bars, next to the logo and colours it already
-- has, so every existing read of a bar picks it up and bars' policies (members
-- read, admins write) cover it unchanged.
--
--   primary_color       the accent (unchanged column; see the design system)
--   accent_light_color  the accent for light mode, always >= 4.5:1 on the light
--                       ground. Worked out here whenever the accent changes,
--                       and a hand-picked value must pass the same check.
--   ground_tint         optional tint for the dark ground
--   display_face        one of the three curated faces
--   short_name          home-screen name for the staff web app (iOS cuts off
--                       at about 12 characters)
--   icon_url            home-screen icon

CREATE TYPE "public"."venue_display_face" AS ENUM (
    'instrument_serif',
    'fraunces',
    'bricolage_grotesque'
);

-- --- WCAG contrast helpers ---

-- Relative luminance of a #rrggbb colour.
CREATE FUNCTION "private"."hex_luminance"("p_hex" "text") RETURNS double precision
    LANGUAGE "sql" IMMUTABLE STRICT
    SET "search_path" TO ''
    AS $$
  SELECT 0.2126 * lin[1] + 0.7152 * lin[2] + 0.0722 * lin[3]
  FROM (
    SELECT array_agg(
      CASE WHEN c <= 0.03928 THEN c / 12.92 ELSE power((c + 0.055) / 1.055, 2.4) END
      ORDER BY i
    ) AS lin
    FROM (
      SELECT i, ('x' || substr(p_hex, 2 * i, 2))::bit(8)::int / 255.0 AS c
      FROM generate_series(1, 3) AS i
    ) channels
  ) l;
$$;

CREATE FUNCTION "private"."contrast_ratio"("p_a" "text", "p_b" "text") RETURNS double precision
    LANGUAGE "sql" IMMUTABLE STRICT
    SET "search_path" TO ''
    AS $$
  SELECT (greatest(la, lb) + 0.05) / (least(la, lb) + 0.05)
  FROM (SELECT private.hex_luminance(p_a) AS la, private.hex_luminance(p_b) AS lb) l;
$$;

-- The colour darkened in 2% steps until it reaches 4.5:1 on the ground. Keeps
-- the hue, so a too-light rust becomes a deeper rust, not a different colour.
CREATE FUNCTION "private"."accessible_shade"("p_hex" "text", "p_ground" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE STRICT
    SET "search_path" TO ''
    AS $$
DECLARE
    v_factor NUMERIC := 1;
    v_out TEXT := lower(p_hex);
BEGIN
    WHILE private.contrast_ratio(v_out, p_ground) < 4.5 AND v_factor > 0 LOOP
        v_factor := v_factor - 0.02;
        SELECT '#' || string_agg(
            lpad(to_hex(round(('x' || substr(p_hex, 2 * i, 2))::bit(8)::int * v_factor)::int), 2, '0'),
            '' ORDER BY i
        ) INTO v_out
        FROM generate_series(1, 3) AS i;
    END LOOP;
    RETURN v_out;
END;
$$;

-- The light-mode ground from docs/design_system.md.
CREATE FUNCTION "private"."light_ground"() RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$ SELECT '#f6f3ee' $$;

-- --- Columns ---

ALTER TABLE "public"."bars"
    ADD COLUMN "accent_light_color" "text",
    ADD COLUMN "ground_tint" "text",
    ADD COLUMN "display_face" "public"."venue_display_face" DEFAULT 'instrument_serif' NOT NULL,
    ADD COLUMN "short_name" "text",
    ADD COLUMN "icon_url" "text";

ALTER TABLE "public"."bars"
    ADD CONSTRAINT "bars_accent_light_color_check" CHECK (
        "accent_light_color" IS NULL
        OR ("accent_light_color" ~ '^#[0-9A-Fa-f]{6}$'
            AND "private"."contrast_ratio"("accent_light_color", "private"."light_ground"()) >= 4.5)
    ),
    ADD CONSTRAINT "bars_ground_tint_check" CHECK ("ground_tint" IS NULL OR "ground_tint" ~ '^#[0-9A-Fa-f]{6}$'),
    ADD CONSTRAINT "bars_short_name_check" CHECK ("short_name" IS NULL OR char_length("short_name") BETWEEN 1 AND 12);

-- Fills accent_light_color from the accent unless the caller set one. Runs on
-- the existing update_bar_settings() path too, so nothing in the app changes.
CREATE FUNCTION "private"."set_accent_light_color"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.accent_light_color IS NULL
       OR (TG_OP = 'UPDATE'
           AND NEW.primary_color IS DISTINCT FROM OLD.primary_color
           AND NEW.accent_light_color IS NOT DISTINCT FROM OLD.accent_light_color) THEN
        NEW.accent_light_color := CASE
            WHEN NEW.primary_color ~ '^#[0-9A-Fa-f]{6}$'
            THEN private.accessible_shade(NEW.primary_color, private.light_ground())
        END;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "set_accent_light_color" BEFORE INSERT OR UPDATE OF "primary_color", "accent_light_color" ON "public"."bars"
    FOR EACH ROW EXECUTE FUNCTION "private"."set_accent_light_color"();

-- Existing accents get their light-mode shade now.
UPDATE "public"."bars"
SET "accent_light_color" = "private"."accessible_shade"("primary_color", "private"."light_ground"())
WHERE "primary_color" ~ '^#[0-9A-Fa-f]{6}$';

-- --- Staff link branding ---

-- Same lookup as before (exact slug, no listing), now with the rest of the
-- identity the branded sign-in page and install manifest need.
DROP FUNCTION "public"."get_venue_branding"("p_slug" "text");
CREATE FUNCTION "public"."get_venue_branding"("p_slug" "text")
    RETURNS TABLE(
        "id" "uuid", "name" "text", "slug" "text", "logo_url" "text",
        "primary_color" "text", "secondary_color" "text", "accent_light_color" "text",
        "ground_tint" "text", "display_face" "public"."venue_display_face",
        "short_name" "text", "icon_url" "text"
    )
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT b.id, b.name, b.slug, b.logo_url, b.primary_color, b.secondary_color, b.accent_light_color,
         b.ground_tint, b.display_face, b.short_name, b.icon_url
  FROM public.bars b
  WHERE b.slug = lower(p_slug);
$$;

REVOKE EXECUTE ON FUNCTION "public"."get_venue_branding"("p_slug" "text") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."get_venue_branding"("p_slug" "text") TO "anon", "authenticated", "service_role";

-- New private functions default to EXECUTE for PUBLIC. The contrast helpers
-- run inside a CHECK constraint and a trigger for whoever writes a bar.
REVOKE EXECUTE ON FUNCTION "private"."hex_luminance"("p_hex" "text") FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "private"."contrast_ratio"("p_a" "text", "p_b" "text") FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "private"."accessible_shade"("p_hex" "text", "p_ground" "text") FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "private"."light_ground"() FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "private"."set_accent_light_color"() FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "private"."hex_luminance"("p_hex" "text") TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "private"."contrast_ratio"("p_a" "text", "p_b" "text") TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "private"."accessible_shade"("p_hex" "text", "p_ground" "text") TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "private"."light_ground"() TO "authenticated", "service_role";
