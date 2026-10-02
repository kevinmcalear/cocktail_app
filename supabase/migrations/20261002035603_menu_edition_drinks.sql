-- A menu edition used to store drink names in a text array, separate from
-- the cocktails credited to that bar. A name on a menu is now a row in
-- profile_menu_edition_drinks pointing at that cocktail. Where the bar had
-- no cocktail by that name, this adds one (a name and, when it matches a
-- catalog classic, the classic it riffs). No spec is invented: measures
-- land only when a source publishes them.
--
-- get_menu_editions is what a profile page reads, signed out included. It
-- returns the drink's id and name only, and only for a profile the caller
-- can already see.

-- Seeded drinks don't queue automatic sketches (nobody to bill for them).
SET "app.image_worker" = 'on';

CREATE TABLE "public"."profile_menu_edition_drinks" (
    "edition_id" "uuid" NOT NULL REFERENCES "public"."profile_menu_editions"("id") ON DELETE CASCADE,
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "sort_order" integer NOT NULL CHECK ("sort_order" >= 0),
    CONSTRAINT "profile_menu_edition_drinks_pkey" PRIMARY KEY ("edition_id", "item_id"),
    CONSTRAINT "profile_menu_edition_drinks_order" UNIQUE ("edition_id", "sort_order")
);

-- The drink is a shared cocktail credited to the menu's bar, not a name,
-- not another bar's drink, and not the catalog classic itself.
CREATE FUNCTION "private"."guard_menu_edition_drink"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.items i
        JOIN public.profile_menu_editions e ON e.id = NEW.edition_id
        WHERE i.id = NEW.item_id
          AND i.item_type = 'cocktail'
          AND i.bar_id IS NULL
          AND i.origin_bar_profile_id = e.profile_id
    ) THEN
        RAISE EXCEPTION 'A menu drink is a cocktail of that bar.';
    END IF;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."guard_menu_edition_drink"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "guard_menu_edition_drink" BEFORE INSERT OR UPDATE OF "edition_id", "item_id"
    ON "public"."profile_menu_edition_drinks"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_menu_edition_drink"();

ALTER TABLE "public"."profile_menu_edition_drinks" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profile_menu_edition_drinks_select" ON "public"."profile_menu_edition_drinks" FOR SELECT TO "anon", "authenticated"
    USING (EXISTS (SELECT 1 FROM "public"."profile_menu_editions" "e" WHERE "e"."id" = "edition_id"));
CREATE POLICY "profile_menu_edition_drinks_admin_insert" ON "public"."profile_menu_edition_drinks" FOR INSERT TO "authenticated"
    WITH CHECK ("private"."is_app_admin"());
CREATE POLICY "profile_menu_edition_drinks_admin_update" ON "public"."profile_menu_edition_drinks" FOR UPDATE TO "authenticated"
    USING ("private"."is_app_admin"()) WITH CHECK ("private"."is_app_admin"());
CREATE POLICY "profile_menu_edition_drinks_admin_delete" ON "public"."profile_menu_edition_drinks" FOR DELETE TO "authenticated"
    USING ("private"."is_app_admin"());

REVOKE ALL ON "public"."profile_menu_edition_drinks" FROM PUBLIC, "anon", "authenticated";
GRANT SELECT ON "public"."profile_menu_edition_drinks" TO "anon";
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."profile_menu_edition_drinks" TO "authenticated";
GRANT ALL ON "public"."profile_menu_edition_drinks" TO "service_role";

-- --- Attach every listed name to a cocktail of that bar ---

CREATE TEMP TABLE "listed" (
    "edition_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer NOT NULL,
    "item_id" "uuid",
    PRIMARY KEY ("edition_id", "sort_order")
);

INSERT INTO "listed" ("edition_id", "profile_id", "name", "sort_order")
SELECT e.id, e.profile_id, btrim(n.name), n.ord::integer
FROM "public"."profile_menu_editions" e
CROSS JOIN LATERAL unnest(e.drinks) WITH ORDINALITY AS n(name, ord)
WHERE btrim(n.name) <> '';

-- Exact name first.
UPDATE "listed" l SET "item_id" = (
    SELECT i.id
    FROM "public"."items" i
    WHERE i.item_type = 'cocktail'
      AND i.bar_id IS NULL
      AND i.origin_bar_profile_id = l.profile_id
      AND lower(btrim(i.name)) = lower(l.name)
    ORDER BY i.created_at
    LIMIT 1
);

-- "The Cloud" and "Cloud" are the same drink when the bar has only one of them.
UPDATE "listed" l SET "item_id" = sub.id
FROM (
    SELECT l2.edition_id, l2.sort_order, match.id, match.n
    FROM "listed" l2
    CROSS JOIN LATERAL (
        SELECT (array_agg(i.id ORDER BY i.created_at))[1] AS id, count(*)::integer AS n
        FROM "public"."items" i
        WHERE i.item_type = 'cocktail'
          AND i.bar_id IS NULL
          AND i.origin_bar_profile_id = l2.profile_id
          AND regexp_replace(lower(btrim(i.name)), '^the ', '') = regexp_replace(lower(l2.name), '^the ', '')
    ) match
    WHERE l2.item_id IS NULL
) sub
WHERE l.edition_id = sub.edition_id AND l.sort_order = sub.sort_order AND sub.n = 1;

-- The rest become that bar's cocktail. A catalog classic of the same name is the riff.
INSERT INTO "public"."items" ("name", "item_type", "origin", "riff_of_id", "origin_bar_profile_id")
SELECT DISTINCT ON (l.profile_id, lower(l.name))
    l.name, 'cocktail',
    CASE WHEN c.id IS NULL THEN 'Original' ELSE 'Varient' END,
    c.id, l.profile_id
FROM "listed" l
LEFT JOIN "public"."items" c
    ON c.is_catalog AND c.item_type = 'cocktail' AND lower(btrim(c.name)) = lower(l.name)
WHERE l.item_id IS NULL
ORDER BY l.profile_id, lower(l.name), l.sort_order;

UPDATE "listed" l SET "item_id" = (
    SELECT i.id
    FROM "public"."items" i
    WHERE i.item_type = 'cocktail'
      AND i.bar_id IS NULL
      AND i.origin_bar_profile_id = l.profile_id
      AND lower(btrim(i.name)) = lower(l.name)
    ORDER BY i.created_at
    LIMIT 1
)
WHERE l.item_id IS NULL;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM listed WHERE item_id IS NULL) THEN
        RAISE EXCEPTION 'A menu still lists a drink that is not a cocktail of that bar.';
    END IF;
END $$;

INSERT INTO "public"."profile_menu_edition_drinks" ("edition_id", "item_id", "sort_order")
SELECT DISTINCT ON ("edition_id", "item_id") "edition_id", "item_id", "sort_order"
FROM "listed"
ORDER BY "edition_id", "item_id", "sort_order";

DROP TABLE "listed";

ALTER TABLE "public"."profile_menu_editions" DROP COLUMN "drinks";

-- Same visibility as the edition: public profiles for anyone, a private one
-- for its owner, its bar's members and app admins. Blocked people stay out.
CREATE FUNCTION "public"."get_menu_editions"("p_profile_id" "uuid")
    RETURNS TABLE(
        "id" "uuid",
        "name" "text",
        "year" smallint,
        "month" smallint,
        "theme" "text",
        "source_url" "text",
        "drinks" "jsonb"
    )
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT e.id, e.name, e.year, e.month, e.theme, e.source_url,
        COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name) ORDER BY d.sort_order)
            FROM public.profile_menu_edition_drinks d
            JOIN public.items i ON i.id = d.item_id AND i.moderated_at IS NULL
            WHERE d.edition_id = e.id
        ), '[]'::jsonb)
    FROM public.profile_menu_editions e
    WHERE e.profile_id = p_profile_id
      AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = p_profile_id
            AND (
                (
                    p.is_public AND p.moderated_at IS NULL
                    AND (
                        auth.uid() IS NULL
                        OR p.user_id IS NULL
                        OR p.user_id = auth.uid()
                        OR p.user_id NOT IN (SELECT private.blocked_user_ids())
                    )
                )
                OR (
                    auth.uid() IS NOT NULL
                    AND (
                        p.user_id = auth.uid()
                        OR p.bar_id IN (SELECT private.my_bar_ids(0))
                        OR private.is_app_admin()
                    )
                )
            )
      )
    ORDER BY e.year DESC, e.month DESC NULLS LAST, e.name
    LIMIT 200;
$$;

REVOKE ALL ON FUNCTION "public"."get_menu_editions"("p_profile_id" "uuid") FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_menu_editions"("p_profile_id" "uuid") TO "anon", "authenticated", "service_role";

RESET "app.image_worker";
