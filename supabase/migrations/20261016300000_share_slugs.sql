-- Readable shared links (Kevin, 12 Oct: "Yes"). The boards ppl-preview-slack
-- and ppl-preview-imessage draw babyvom.it/d/penicillin and
-- babyvom.it/m/halloween-party. Until now a shared link was /d/<uuid> or
-- /m/<uuid>; those keep working forever.
--
-- What changes here, in plain words:
--   1. A published drink or a shared menu gets one readable name for its
--      link, a slug: the name in lower case with hyphens ("Bee's Knees" is
--      bees-knees). A second drink with a taken slug gets a short suffix from
--      its id (penicillin-0c2b).
--   2. A slug is stored once and never changes: renaming the drink or menu
--      keeps the old link working. It goes away only with the drink or menu.
--   3. Slugs live in their own table in the private schema, so nobody reads
--      or writes them directly. Two functions do:
--        share_slug(kind, id)    signed in: the slug for a drink or menu that
--                                is public right now, made on first ask.
--        share_target(kind, slug) anyone: the id behind a slug, only while
--                                that drink is published or that menu is
--                                shared (as published_items and shared_menu()
--                                decide, blocks included). A private,
--                                unpublished or unshared one reads as no
--                                match, the same as a slug nobody has.
--   4. Every drink published today and every shared menu get their slug now,
--      catalog classics first, so the Penicillin is /d/penicillin.
--
-- kind is 'd' for a drink (/d/...) and 'm' for a menu (/m/...).

-- --- Storage ---

CREATE TABLE "private"."share_slugs" (
    "kind" "text" NOT NULL CHECK ("kind" IN ('d', 'm')),
    -- Lower-case words joined by single hyphens, never shaped like a uuid
    -- (a uuid in a link is always read as the id).
    "slug" "text" NOT NULL CHECK (
        "slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
        AND length("slug") <= 100
        AND "slug" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ),
    "item_id" "uuid" UNIQUE REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "menu_id" "uuid" UNIQUE REFERENCES "public"."menus"("id") ON DELETE CASCADE,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    PRIMARY KEY ("kind", "slug"),
    CHECK (("kind" = 'd') = ("item_id" IS NOT NULL) AND ("kind" = 'm') = ("menu_id" IS NOT NULL))
);

ALTER TABLE "private"."share_slugs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "private"."share_slugs" FROM PUBLIC, "anon", "authenticated";
GRANT ALL ON TABLE "private"."share_slugs" TO "service_role";

-- --- Making a slug ---

-- "Bee's Knees" -> bees-knees, "Añejo Highball" -> anejo-highball,
-- "Gin & Tonic" -> gin-and-tonic. At most 60 characters, cut at a word.
-- A name with no Latin letters or digits falls back to "drink" or "menu".
CREATE FUNCTION "private"."share_slug_base"("p_name" "text", "p_kind" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $$
DECLARE
    s text := public.discover_fold(p_name);
BEGIN
    s := replace(replace(replace(replace(replace(replace(s, 'ß', 'ss'), 'æ', 'ae'), 'œ', 'oe'), 'ø', 'o'), 'ł', 'l'), 'đ', 'd');
    s := replace(s, '&', ' and ');
    s := regexp_replace(s, '[''’‘`]', '', 'g');
    s := btrim(regexp_replace(s, '[^a-z0-9]+', '-', 'g'), '-');
    IF length(s) > 60 THEN
        s := left(s, 61);
        s := CASE WHEN strpos(left(s, 60), '-') > 0 THEN regexp_replace(s, '-[^-]*$', '') ELSE left(s, 60) END;
        s := btrim(s, '-');
    END IF;
    IF s = '' THEN
        s := CASE p_kind WHEN 'm' THEN 'menu' ELSE 'drink' END;
    END IF;
    IF s ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        s := CASE p_kind WHEN 'm' THEN 'menu-' ELSE 'drink-' END || s;
    END IF;
    RETURN s;
END;
$$;

-- The first free one of: base, base-<4 of the id>, base-<6>, base-<8>, base-<whole id>.
CREATE FUNCTION "private"."next_share_slug"("p_kind" "text", "p_name" "text", "p_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
DECLARE
    v_base text := private.share_slug_base(p_name, p_kind);
    v_hex text := replace(p_id::text, '-', '');
    v_len int;
    v_slug text;
BEGIN
    FOREACH v_len IN ARRAY ARRAY[0, 4, 6, 8, 32] LOOP
        v_slug := CASE WHEN v_len = 0 THEN v_base ELSE v_base || '-' || left(v_hex, v_len) END;
        IF NOT EXISTS (SELECT 1 FROM private.share_slugs s WHERE s.kind = p_kind AND s.slug = v_slug) THEN
            RETURN v_slug;
        END IF;
    END LOOP;
    RETURN v_slug;
END;
$$;

-- Public to the caller right now: a drink in published_items (blocks
-- included), or a shared menu shared_menu() returns.
CREATE FUNCTION "private"."share_target_is_public"("p_kind" "text", "p_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT CASE p_kind
    WHEN 'd' THEN EXISTS (SELECT 1 FROM public.published_items pi WHERE pi.id = p_id AND NOT pi.is_reference)
    WHEN 'm' THEN public.shared_menu(p_id) IS NOT NULL
    ELSE false
  END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."share_slug_base"("text", "text") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."next_share_slug"("text", "text", "uuid") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."share_target_is_public"("text", "uuid") FROM PUBLIC, "anon", "authenticated";

-- --- What the app and the link previews call ---

-- The slug for a drink or menu the caller can see in public, made the first
-- time anyone asks. NULL for anything that isn't public: the app then shares
-- the /d/<id> link, as before.
CREATE FUNCTION "public"."share_slug"("p_kind" "text", "p_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" VOLATILE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_slug text;
    v_name text;
BEGIN
    IF p_kind NOT IN ('d', 'm') OR p_id IS NULL OR NOT private.share_target_is_public(p_kind, p_id) THEN
        RETURN NULL;
    END IF;
    v_name := CASE p_kind
        WHEN 'd' THEN (SELECT i.name FROM public.items i WHERE i.id = p_id)
        ELSE (SELECT m.name FROM public.menus m WHERE m.id = p_id)
    END;
    -- Twice at most: a second try only when someone else took the same slug a moment before.
    FOR attempt IN 1..2 LOOP
        SELECT s.slug INTO v_slug FROM private.share_slugs s
         WHERE s.kind = p_kind AND (s.item_id = p_id OR s.menu_id = p_id);
        IF v_slug IS NOT NULL THEN
            RETURN v_slug;
        END IF;
        BEGIN
            v_slug := private.next_share_slug(p_kind, v_name, p_id);
            INSERT INTO private.share_slugs ("kind", "slug", "item_id", "menu_id")
            VALUES (p_kind, v_slug, CASE WHEN p_kind = 'd' THEN p_id END, CASE WHEN p_kind = 'm' THEN p_id END);
            RETURN v_slug;
        EXCEPTION WHEN unique_violation THEN
            v_slug := NULL;
        END;
    END LOOP;
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION "public"."share_slug"("text", "uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."share_slug"("text", "uuid") TO "authenticated", "service_role";

-- The drink or menu behind a slug, for anyone, signed out too. NULL unless
-- it's public to the caller right now, so a slug says nothing about a drink
-- that's private or a menu that stopped being shared.
CREATE FUNCTION "public"."share_target"("p_kind" "text", "p_slug" "text") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT coalesce(s.item_id, s.menu_id)
  FROM private.share_slugs s
  WHERE s.kind = p_kind
    AND s.slug = lower(p_slug)
    AND private.share_target_is_public(s.kind, coalesce(s.item_id, s.menu_id));
$$;

REVOKE ALL ON FUNCTION "public"."share_target"("text", "text") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."share_target"("text", "text") TO "anon", "authenticated", "service_role";

-- --- Today's published drinks and shared menus ---
-- Catalog classics first so they get the plain names, then the oldest first.

DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT i.id, i.name
        FROM public.published_items pi
        JOIN public.items i ON i.id = pi.id
        WHERE NOT pi.is_reference
        ORDER BY i.is_catalog DESC, pi.published_at NULLS LAST, i.created_at, i.id
    LOOP
        INSERT INTO private.share_slugs ("kind", "slug", "item_id") VALUES ('d', private.next_share_slug('d', r.name, r.id), r.id);
    END LOOP;
    FOR r IN
        SELECT m.id, m.name
        FROM public.menus m
        WHERE m.shared_at IS NOT NULL AND public.shared_menu(m.id) IS NOT NULL
        ORDER BY m.shared_at, m.id
    LOOP
        INSERT INTO private.share_slugs ("kind", "slug", "menu_id") VALUES ('m', private.next_share_slug('m', r.name, r.id), r.id);
    END LOOP;
END;
$$;
