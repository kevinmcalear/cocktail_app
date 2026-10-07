-- DRAFT. Local stack only; needs Kevin's OK before production.
--
-- A bar's drinks by how people rank them: the Rankings tab on a bar's public
-- page, and the Top drinks row on Discover's bar card. Works signed out.
--
-- One row per list ranked at the bar (private.venue_drink_scores: a drink's
-- score there, from people who confirmed their age, staff left out). A row
-- stands for the drink most people ranked in that list there, the bar's own
-- version before the classic. Like every other shared ranking, a score and
-- position show only once private.ranking_min_rankers() people have ranked
-- it; before that a row says only how many people have.
--
-- After those: the bar's drinks nobody has ranked yet (its signatures, and
-- its own drinks it has published), current menu first, so a bar with few
-- rankings still has something to rank.
--
-- Publish levels: a row only ever names a drink anyone may see by name.
-- Shared drinks (catalog classics and bars' signatures, as get_menu_editions
-- already shows them) and drinks published at 'description' or 'spec'.
-- Never a private drink, a moderated one, or one from someone the caller has
-- blocked. Only names, pictures, scores and counts leave; never a spec, and
-- never who ranked what.
--
-- menu: 'current' when the drink is on one of the bar's live menus or its
-- latest menu edition (unless the bar has closed), 'past' when it was on an
-- older one, NULL when no menu lists it. menu_from and menu_to: the first and
-- last year a menu listed it ("Past · 2024 to 2025").

-- Whether anyone may see this drink's name: published_items' rules for one
-- drink, without building the whole view.
CREATE FUNCTION "private"."is_listed_drink"("p_item_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.items i
    WHERE i.id = p_item_id
      AND i.moderated_at IS NULL
      AND CASE
        WHEN i.bar_id IS NOT NULL THEN
          private.effective_publish_mode(i.id) <> 'private'
          AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.bar_id = i.bar_id AND p.is_public AND p.moderated_at IS NULL)
        WHEN i.created_by IS NOT NULL THEN
          private.effective_publish_mode(i.id) <> 'private'
          AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = i.created_by AND p.is_public AND p.moderated_at IS NULL)
          AND i.created_by NOT IN (SELECT private.blocked_user_ids())
        ELSE true
      END
  );
$$;

CREATE FUNCTION "public"."get_bar_top_drinks"("p_profile_id" "uuid", "p_limit" integer DEFAULT 30)
    RETURNS TABLE(
        "position" bigint,
        "item_id" "uuid",
        "name" "text",
        "bar_id" "uuid",
        "ranked_as_item_id" "uuid",
        "ranked_as_name" "text",
        "image_url" "text",
        "image_is_generated" boolean,
        "score" numeric,
        "rankers" integer,
        "menu" "text",
        "menu_from" integer,
        "menu_to" integer
    )
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  WITH bar AS (
    SELECT p.id, p.bar_id, p.is_closed,
           (SELECT e.id FROM public.profile_menu_editions e
             WHERE e.profile_id = p.id
             ORDER BY e.year DESC, e.month DESC NULLS LAST, e.name
             LIMIT 1) AS latest_edition_id
    FROM public.profiles p
    WHERE p.id = p_profile_id AND p.kind = 'bar' AND p.is_public AND p.moderated_at IS NULL
  ), scored AS (
    SELECT v.ranked_as_item_id, v.rankers, v.score, v.rankers >= private.ranking_min_rankers() AS ranked
    FROM private.venue_drink_scores v
    JOIN bar b ON b.id = v.venue_profile_id
  ), shown AS (
    SELECT pick.item_id, s.ranked_as_item_id, s.rankers, s.score, s.ranked
    FROM scored s
    CROSS JOIN LATERAL (
      SELECT e.item_id
      FROM public.rank_entries e
      JOIN public.items i ON i.id = e.item_id
      WHERE e.venue_profile_id = p_profile_id
        AND e.ranked_as_item_id = s.ranked_as_item_id
        AND private.is_listed_drink(e.item_id)
      GROUP BY e.item_id, i.is_catalog
      ORDER BY i.is_catalog, count(DISTINCT e.user_id) DESC, e.item_id
      LIMIT 1
    ) pick
  ), unranked AS (
    SELECT i.id AS item_id,
           CASE WHEN i.riff_of_id IS NOT NULL AND (riff.is_catalog OR i.origin = 'Classic') THEN i.riff_of_id ELSE i.id END AS ranked_as_item_id
    FROM bar b
    JOIN public.items i
      ON i.item_type = 'cocktail'
     AND ((i.bar_id IS NULL AND i.created_by IS NULL AND i.origin_bar_profile_id = b.id)
          OR (b.bar_id IS NOT NULL AND i.bar_id = b.bar_id))
    LEFT JOIN public.items riff ON riff.id = i.riff_of_id
    WHERE private.is_listed_drink(i.id)
  ), candidates AS (
    SELECT s.item_id, s.ranked_as_item_id, s.score, s.rankers, s.ranked FROM shown s
    UNION ALL
    SELECT u.item_id, u.ranked_as_item_id, NULL, 0, false
    FROM unranked u
    WHERE u.item_id NOT IN (SELECT item_id FROM shown)
      AND u.ranked_as_item_id NOT IN (SELECT ranked_as_item_id FROM shown)
  ), tagged AS (
    SELECT c.*, i.name, i.bar_id,
           CASE WHEN ra.id <> i.id AND private.is_listed_drink(ra.id) THEN ra.name END AS ranked_as_name,
           CASE
             WHEN NOT b.is_closed AND (
               EXISTS (SELECT 1 FROM public.menu_drinks md JOIN public.menus m ON m.id = md.menu_id
                        WHERE md.item_id = c.item_id AND m.bar_id = b.bar_id AND m.is_active)
               OR EXISTS (SELECT 1 FROM public.profile_menu_edition_drinks d
                           WHERE d.item_id = c.item_id AND d.edition_id = b.latest_edition_id)
             ) THEN 'current'
             WHEN EXISTS (SELECT 1 FROM public.menu_drinks md JOIN public.menus m ON m.id = md.menu_id
                           WHERE md.item_id = c.item_id AND m.bar_id = b.bar_id AND m.ends_at <= now())
               OR EXISTS (SELECT 1 FROM public.profile_menu_edition_drinks d
                           JOIN public.profile_menu_editions e ON e.id = d.edition_id
                           WHERE d.item_id = c.item_id AND e.profile_id = b.id)
             THEN 'past'
           END AS menu,
           years.menu_from, years.menu_to
    FROM candidates c
    CROSS JOIN bar b
    JOIN public.items i ON i.id = c.item_id
    JOIN public.items ra ON ra.id = c.ranked_as_item_id
    CROSS JOIN LATERAL (
      SELECT min(y)::integer AS menu_from, max(y)::integer AS menu_to
      FROM (
        SELECT e.year::integer AS y
        FROM public.profile_menu_edition_drinks d
        JOIN public.profile_menu_editions e ON e.id = d.edition_id
        WHERE d.item_id = c.item_id AND e.profile_id = b.id
        UNION ALL
        SELECT extract(year FROM x)::integer
        FROM public.menu_drinks md
        JOIN public.menus m ON m.id = md.menu_id
        CROSS JOIN LATERAL (VALUES (m.starts_at), (m.ends_at)) AS t(x)
        WHERE md.item_id = c.item_id AND m.bar_id = b.bar_id AND (m.is_active OR m.ends_at <= now()) AND x IS NOT NULL AND x <= now()
      ) listed
    ) years
  ), ordered AS (
    SELECT t.*,
           row_number() OVER (
             ORDER BY t.ranked DESC, CASE WHEN t.ranked THEN t.score END DESC NULLS LAST, t.rankers DESC,
                      t.menu = 'current' DESC NULLS LAST, t.menu = 'past' DESC NULLS LAST, t.name, t.item_id
           ) AS n
    FROM tagged t
  )
  SELECT CASE WHEN o.ranked THEN o.n END, o.item_id, o.name, o.bar_id, o.ranked_as_item_id, o.ranked_as_name,
         img.url, img.is_generated, CASE WHEN o.ranked THEN o.score END, o.rankers, o.menu, o.menu_from, o.menu_to
  FROM ordered o
  LEFT JOIN LATERAL (
    SELECT im.url, ii.is_generated
    FROM public.item_images ii JOIN public.images im ON im.id = ii.image_id
    WHERE ii.item_id = o.item_id
    ORDER BY (ii.angle = 'hero') DESC, ii.sort_order NULLS LAST, ii.created_at
    LIMIT 1
  ) img ON true
  WHERE o.n <= least(greatest(coalesce(p_limit, 30), 1), 100)
  ORDER BY o.n;
$$;

REVOKE EXECUTE ON FUNCTION "private"."is_listed_drink"("uuid") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."get_bar_top_drinks"("uuid", integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."get_bar_top_drinks"("uuid", integer) TO "anon", "authenticated", "service_role";
