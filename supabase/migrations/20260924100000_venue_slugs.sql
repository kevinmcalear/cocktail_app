-- Venue staff links: each bar gets a short URL-safe slug for /v/<slug>, the
-- bar-branded sign-in page and installable web app (the bar's own name and
-- icon on staff home screens). Renaming a bar keeps its slug, so shared links
-- and installed apps keep working.

CREATE FUNCTION "private"."slugify"("p_text" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT trim(BOTH '-' FROM regexp_replace(
    regexp_replace(lower(coalesce(p_text, '')), '[''’]', '', 'g'),
    '[^a-z0-9]+', '-', 'g'
  ));
$$;

-- The slug for a bar name, with -2, -3, ... appended if another bar has it.
CREATE FUNCTION "private"."unique_bar_slug"("p_name" "text", "p_bar_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
DECLARE
    v_base TEXT := coalesce(nullif(private.slugify(p_name), ''), 'venue');
    v_slug TEXT := v_base;
    v_n INT := 1;
BEGIN
    WHILE EXISTS (SELECT 1 FROM public.bars WHERE slug = v_slug AND id <> p_bar_id) LOOP
        v_n := v_n + 1;
        v_slug := v_base || '-' || v_n;
    END LOOP;
    RETURN v_slug;
END;
$$;

ALTER TABLE "public"."bars" ADD COLUMN "slug" "text";

-- One row at a time, so each new slug is visible to the next uniqueness check.
DO $$
DECLARE
    v_bar record;
BEGIN
    FOR v_bar IN SELECT id, name FROM public.bars ORDER BY created_at LOOP
        UPDATE public.bars SET slug = private.unique_bar_slug(v_bar.name, v_bar.id) WHERE id = v_bar.id;
    END LOOP;
END;
$$;

ALTER TABLE "public"."bars" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "public"."bars" ADD CONSTRAINT "bars_slug_key" UNIQUE ("slug");
ALTER TABLE "public"."bars" ADD CONSTRAINT "bars_slug_format"
    CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- Runs as its owner: whoever inserts the bar may not be able to call the
-- private helpers, or (under RLS) see the other bars' slugs to avoid them.
CREATE FUNCTION "private"."set_bar_slug"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.slug IS NULL THEN
        NEW.slug := private.unique_bar_slug(NEW.name, NEW.id);
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "set_bar_slug" BEFORE INSERT ON "public"."bars"
    FOR EACH ROW EXECUTE FUNCTION "private"."set_bar_slug"();

-- A venue's public face for its staff link: name, logo and colours only, by
-- exact slug (no listing of venues). Signed-out visitors need it for the
-- branded sign-in page and the install manifest, so anon may call it.
CREATE FUNCTION "public"."get_venue_branding"("p_slug" "text")
    RETURNS TABLE("id" "uuid", "name" "text", "slug" "text", "logo_url" "text", "primary_color" "text", "secondary_color" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT b.id, b.name, b.slug, b.logo_url, b.primary_color, b.secondary_color
  FROM public.bars b
  WHERE b.slug = lower(p_slug);
$$;

REVOKE EXECUTE ON FUNCTION "private"."slugify"("p_text" "text") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."unique_bar_slug"("p_name" "text", "p_bar_id" "uuid") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."set_bar_slug"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."get_venue_branding"("p_slug" "text") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."get_venue_branding"("p_slug" "text") TO "anon", "authenticated", "service_role";
