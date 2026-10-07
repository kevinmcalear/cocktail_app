-- When a menu was on, not just when it launched.
--
-- A drink that was on a bar's menu in 2023 isn't one to walk up and order in
-- 2026. Each edition now has an end as well as a start, and says when it's
-- the one on now, so the app can say "Mar 2024 to Jan 2025" or "On now
-- since Sep 2025" on the menu, on the drink and in search.
--
--   year, month          the start, as before (month null = only the year
--                        is known). Kept under their old names: old app
--                        builds read them from get_menu_editions, and the
--                        seed migrations that tests re-run write them.
--   end_year, end_month  when it came off. Null = still on, or not known.
--   is_current           on now. A current menu has no end.
--
-- The backfill below infers what the record already implies. Researched
-- menus (scripts/data/bar-history, loaded by scripts/bar-history.mjs) set
-- all three from their sources and overwrite the inferred ends.
--
--   menu_drink_runs      one row per drink on a menu: the bar, the latest
--                        menu it was on, and the run from its first menu's
--                        start to its last menu's end. Readable with the
--                        menus themselves (security invoker).
--   search_bar_drinks    search over every bar's drinks, current menus
--                        first. Search used to load the first 1,000 bar
--                        drinks by name and filter them on the phone; there
--                        are over 5,000 now, so most never matched.
--   menu_name_key        how a drink name on a menu matches a bar's drink,
--                        for research loads: case, punctuation, spaces and
--                        a leading "The" ignored ("Mr. Martinez" is "Mr
--                        Martinez").

ALTER TABLE "public"."profile_menu_editions"
    ADD COLUMN "end_year" smallint CHECK ("end_year" BETWEEN 1900 AND 2100),
    ADD COLUMN "end_month" smallint CHECK ("end_month" BETWEEN 1 AND 12),
    ADD COLUMN "is_current" boolean DEFAULT false NOT NULL,
    ADD CONSTRAINT "profile_menu_editions_end_month_has_year" CHECK ("end_month" IS NULL OR "end_year" IS NOT NULL),
    -- Month-less dates compare loosely: "2019 to 2019" is fine.
    ADD CONSTRAINT "profile_menu_editions_ends_after_start" CHECK (
        "end_year" IS NULL OR ("end_year", coalesce("end_month", 12)) >= ("year", coalesce("month", 1))
    ),
    ADD CONSTRAINT "profile_menu_editions_current_has_no_end" CHECK (NOT "is_current" OR "end_year" IS NULL);

COMMENT ON COLUMN "public"."profile_menu_editions"."year" IS 'The year the menu started.';
COMMENT ON COLUMN "public"."profile_menu_editions"."month" IS 'The month the menu started; null when only the year is known.';
COMMENT ON COLUMN "public"."profile_menu_editions"."end_year" IS 'The year the menu came off; null while it is on, or when nobody knows.';
COMMENT ON COLUMN "public"."profile_menu_editions"."is_current" IS 'The menu the bar is pouring now. A current menu has no end.';

-- --- Backfill: what the record already implies ---

-- A menu ran until the bar's next one started. "Next" means strictly later:
-- a menu known only by its year isn't later than one dated in that same
-- year, and menus that launched together (one per room) end together.
-- ponytail: a bar that runs a standing list beside seasonal ones gets its
-- standing list ended by the next seasonal one. The research files correct
-- that edition by edition.
UPDATE "public"."profile_menu_editions" e
SET "end_year" = n.year, "end_month" = n.month
FROM (
    SELECT DISTINCT ON (a.id) a.id, b.year, b.month
    FROM "public"."profile_menu_editions" a
    JOIN "public"."profile_menu_editions" b
      ON b.profile_id = a.profile_id
     AND (b.year > a.year OR (b.year = a.year AND a.month IS NOT NULL AND b.month > a.month))
    ORDER BY a.id, b.year, b.month NULLS FIRST
) n
WHERE e.id = n.id;

-- A closed bar's last menus came off when it closed, where that's known.
UPDATE "public"."profile_menu_editions" e
SET "end_year" = p.closed_year
FROM "public"."profiles" p
WHERE p.id = e.profile_id AND p.is_closed AND p.closed_year >= e.year AND e.end_year IS NULL;

-- An open bar's latest menu is on now when it started in the last year
-- (this was written in October 2026). Older ones keep an unknown end
-- rather than a guess either way.
UPDATE "public"."profile_menu_editions" e
SET "is_current" = true
FROM "public"."profiles" p
WHERE p.id = e.profile_id AND NOT p.is_closed
  AND e.end_year IS NULL
  AND (e.year > 2025 OR (e.year = 2025 AND e.month >= 10));

-- --- Matching names to drinks ---

-- Strips ASCII punctuation, symbols and spaces and the Unicode punctuation
-- blocks (Latin-1, General Punctuation, CJK), and keeps letters and digits
-- in every script, whatever the database's locale. A name that is nothing
-- but symbols ("-=+") keeps itself, so two such names never collide on ''.
CREATE FUNCTION "public"."menu_name_key"("p_name" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $$
    SELECT coalesce(
        nullif(regexp_replace(
            regexp_replace(lower(btrim(p_name)), '^the\s+', ''),
            '[\x01-\x2f\x3a-\x40\x5b-\x60\x7b-\x7f\u00a0-\u00bf\u2000-\u206f\u3000-\u303f\uff01-\uff0f]+', '', 'g'
        ), ''),
        lower(btrim(p_name))
    );
$$;

GRANT EXECUTE ON FUNCTION "public"."menu_name_key"("p_name" "text") TO "anon", "authenticated", "service_role";

-- Drink pages and search look menus up by drink.
CREATE INDEX "profile_menu_edition_drinks_item_idx" ON "public"."profile_menu_edition_drinks" ("item_id");

-- --- A drink's run on a bar's menus ---

CREATE VIEW "public"."menu_drink_runs" WITH ("security_invoker" = true) AS
SELECT
    d.item_id,
    e.profile_id,
    (array_agg(e.id ORDER BY e.is_current DESC, e.year DESC, e.month DESC NULLS LAST, e.name))[1] AS "edition_id",
    (array_agg(e.name ORDER BY e.is_current DESC, e.year DESC, e.month DESC NULLS LAST, e.name))[1] AS "edition_name",
    count(*)::integer AS "editions",
    (array_agg(e.year ORDER BY e.year, e.month NULLS FIRST))[1] AS "start_year",
    (array_agg(e.month ORDER BY e.year, e.month NULLS FIRST))[1] AS "start_month",
    -- The run ends with its last menu, unless one of them is on now or has no known end.
    CASE WHEN bool_and(e.end_year IS NOT NULL)
        THEN (array_agg(e.end_year ORDER BY e.end_year DESC, e.end_month DESC NULLS LAST))[1] END AS "end_year",
    CASE WHEN bool_and(e.end_year IS NOT NULL)
        THEN (array_agg(e.end_month ORDER BY e.end_year DESC, e.end_month DESC NULLS LAST))[1] END AS "end_month",
    bool_or(e.is_current) AS "is_current"
FROM "public"."profile_menu_edition_drinks" d
JOIN "public"."profile_menu_editions" e ON e.id = d.edition_id
GROUP BY d.item_id, e.profile_id;

REVOKE ALL ON "public"."menu_drink_runs" FROM PUBLIC, "anon", "authenticated";
GRANT SELECT ON "public"."menu_drink_runs" TO "anon", "authenticated", "service_role";

-- --- What a profile page reads ---

-- As in 20261002035603, plus the end and whether it's on now. year and month
-- stay the start.
DROP FUNCTION "public"."get_menu_editions"("p_profile_id" "uuid");

CREATE FUNCTION "public"."get_menu_editions"("p_profile_id" "uuid")
    RETURNS TABLE(
        "id" "uuid",
        "name" "text",
        "year" smallint,
        "month" smallint,
        "end_year" smallint,
        "end_month" smallint,
        "is_current" boolean,
        "theme" "text",
        "source_url" "text",
        "drinks" "jsonb"
    )
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT e.id, e.name, e.year, e.month, e.end_year, e.end_month, e.is_current, e.theme, e.source_url,
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

-- --- Search over every bar's drinks ---

-- What the reader can already read (security invoker: items, profiles and
-- menus keep their own policies), credited to a profile they can see, matched on the drink's name, description,
-- ingredients or the bar or bartender it's credited to. Drinks on a menu
-- now come first, then drinks no menu dates, then menus with no known end,
-- then past menus; within each, names that start with the query first.
CREATE FUNCTION "public"."search_bar_drinks"("p_query" "text", "p_limit" integer DEFAULT 48)
    RETURNS TABLE(
        "item_id" "uuid",
        "credit" "text",
        "edition_id" "uuid",
        "edition_name" "text",
        "start_year" smallint,
        "start_month" smallint,
        "end_year" smallint,
        "end_month" smallint,
        "is_current" boolean
    )
    LANGUAGE "sql" STABLE SECURITY INVOKER
    SET "search_path" TO ''
    AS $$
    WITH q AS (
        SELECT lower(btrim(p_query)) AS text,
               replace(replace(replace(lower(btrim(p_query)), '\', '\\'), '%', '\%'), '_', '\_') AS pat
    )
    SELECT i.id, coalesce(b.display_name, c.display_name),
           r.edition_id, r.edition_name, r.start_year, r.start_month, r.end_year, r.end_month, r.is_current
    FROM public.items i
    CROSS JOIN q
    LEFT JOIN public.profiles b ON b.id = i.origin_bar_profile_id
    LEFT JOIN public.profiles c ON c.id = i.creator_profile_id
    LEFT JOIN public.menu_drink_runs r ON r.item_id = i.id
    WHERE i.item_type = 'cocktail'
      AND i.bar_id IS NULL
      AND i.moderated_at IS NULL
      -- Credited to a bar or bartender the reader can see (a hidden profile's
      -- drinks stay out, as on Discover).
      AND (b.id IS NOT NULL OR c.id IS NOT NULL)
      AND q.text <> ''
      AND (
          lower(i.name) LIKE '%' || q.pat || '%'
          OR lower(i.description) LIKE '%' || q.pat || '%'
          OR lower(b.display_name) LIKE '%' || q.pat || '%'
          OR lower(c.display_name) LIKE '%' || q.pat || '%'
          OR EXISTS (
              SELECT 1 FROM public.recipes rc
              JOIN public.items ing ON ing.id = rc.ingredient_item_id
              WHERE rc.recipe_item_id = i.id AND lower(ing.name) LIKE '%' || q.pat || '%'
          )
      )
    ORDER BY
        CASE WHEN r.is_current THEN 0 WHEN r.item_id IS NULL THEN 1 WHEN r.end_year IS NULL THEN 2 ELSE 3 END,
        lower(i.name) LIKE q.pat || '%' DESC,
        i.name, i.id
    LIMIT least(greatest(coalesce(p_limit, 48), 1), 100);
$$;

REVOKE ALL ON FUNCTION "public"."search_bar_drinks"("p_query" "text", "p_limit" integer) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."search_bar_drinks"("p_query" "text", "p_limit" integer) TO "authenticated", "service_role";
