-- Who sees your page, the 15 Oct 2026 ladder (Kevin): Private < Names
-- ('locked') < Menu ('description') < Open. 'private' itself came in
-- 20261024100000. This migration puts it to work:
--
--   * Private: the bar's facts, hours, people and awards only. Its drinks
--     leave the public listing (so /d/ cards, link previews, menus, sketches),
--     Discover, every Best list and every score. Its own team and app admins
--     still see everything. Guests keep ranking its drinks in their own lists
--     and keep reading the names of drinks they ranked. Catalog classics
--     credited to a bar stay open, as before.
--   * Names and Private: bartenders keep name-only credit (drink + bar) on
--     their own profiles (get_profile_name_credits).
--   * Menu: a public spec line whose ingredient isn't shared or published in
--     its own right reads "House ingredient" (the #502 rule), not dropped.
--   * A claim now hands the page over at Menu, not Names.
--   * Only a bar whose claim was verified may pick Private, and a bar can
--     change its level at most once every 30 days (app admins and the service
--     role are not limited).

-- --- helpers ---

-- Bar profiles at Private whose page the caller doesn't run (their team and app admins see through it).
CREATE FUNCTION private.private_page_profile_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT p.id
  FROM public.profiles p
  WHERE p.kind = 'bar'
    AND p.page_visibility = 'private'
    AND (p.bar_id IS NULL OR p.bar_id NOT IN (SELECT private.my_bar_ids(0)))
    AND NOT EXISTS (SELECT 1 FROM private.app_admins aa WHERE aa.user_id = auth.uid());
$function$;

-- The venues behind those pages.
CREATE FUNCTION private.private_page_bar_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT p.bar_id FROM public.profiles p
  WHERE p.id IN (SELECT private.private_page_profile_ids()) AND p.bar_id IS NOT NULL;
$function$;

-- Whether a drink belongs to a Private page the caller doesn't run: a venue
-- drink of that bar, or a shared drink credited to it. Classics stay open.
CREATE FUNCTION private.is_private_page_drink(p_item_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.items i
    WHERE i.id = p_item_id
      AND NOT i.is_catalog
      AND (i.bar_id IN (SELECT private.private_page_bar_ids())
           OR (i.bar_id IS NULL AND i.created_by IS NULL AND i.origin_bar_profile_id IN (SELECT private.private_page_profile_ids())))
  );
$function$;

-- Whether a guest may rank a drink they can't otherwise see: one of a Private
-- bar's (unless moderated). Ranking an id shows nothing new.
CREATE FUNCTION private.can_rank_private_page_drink(p_item_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.items i
    LEFT JOIN public.bars vb ON vb.id = i.bar_id
    LEFT JOIN public.profiles op ON op.id = i.origin_bar_profile_id AND op.kind = 'bar'
    LEFT JOIN public.bars ob ON ob.id = op.bar_id
    WHERE i.id = p_item_id
      AND NOT i.is_catalog
      AND i.moderated_at IS NULL
      AND i.item_type = 'cocktail'
      AND (vb.page_visibility = 'private' OR (i.bar_id IS NULL AND i.created_by IS NULL AND ob.page_visibility = 'private'))
  );
$function$;

-- Whether the venue's page was handed over by an approved claim (verified).
CREATE FUNCTION public.bar_claim_verified(p_bar_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profile_claims c
    JOIN public.profiles p ON p.id = c.profile_id
    WHERE p.bar_id = p_bar_id AND p.kind = 'bar' AND c.status = 'approved'
  );
$function$;

REVOKE ALL ON FUNCTION private.private_page_profile_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.private_page_bar_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_private_page_drink(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_rank_private_page_drink(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.private_page_profile_ids() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.private_page_bar_ids() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_private_page_drink(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_rank_private_page_drink(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.bar_claim_verified(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bar_claim_verified(uuid) TO authenticated;

-- --- pages closed to the caller: Private counts wherever Names does ---
CREATE OR REPLACE FUNCTION private.page_closed_profile_ids(p_locked_only boolean)
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT p.id
  FROM public.profiles p
  WHERE p.kind = 'bar'
    AND (p.page_visibility IN ('private', 'locked') OR (NOT p_locked_only AND p.page_visibility <> 'open'))
    AND (p.bar_id IS NULL OR p.bar_id NOT IN (SELECT private.my_bar_ids(0)))
    AND NOT EXISTS (SELECT 1 FROM private.app_admins aa WHERE aa.user_id = auth.uid());
$function$;

-- --- the public listing: a Private page's drinks aren't listed at all ---
CREATE OR REPLACE VIEW private.published_listing WITH (security_invoker = false) AS
SELECT i.id,
    i.name,
    i.item_type,
    i.description,
    i.bar_id,
    i.glassware_id,
    i.ice_id,
    i.family_id,
    i.origin,
    i.abv,
    i.icon_key,
    i.icon_url,
    i.published_at,
    i.riff_of_id,
    i.creator_profile_id,
    i.origin_bar_profile_id,
    i.origin_year,
    i.credit_status,
        CASE
            WHEN eff.mode = 'spec'::item_publish_mode AND pg.page <> 'open'::bar_page_visibility THEN 'description'::item_publish_mode
            ELSE eff.mode
        END AS effective_mode,
    (pg.page = ANY (ARRAY['private'::bar_page_visibility, 'locked'::bar_page_visibility])) AS page_locked,
    i.created_by
   FROM items i
     LEFT JOIN bars bar ON bar.id = i.bar_id
     CROSS JOIN LATERAL ( SELECT COALESCE(i.publish_mode,
                CASE
                    WHEN i.bar_id IS NOT NULL THEN ( SELECT max(m.publish_mode) AS max
                       FROM menu_drinks md
                         JOIN menus m ON m.id = md.menu_id
                      WHERE md.item_id = i.id AND m.bar_id = i.bar_id AND m.publish_mode IS NOT NULL)
                    ELSE NULL::item_publish_mode
                END, bar.default_publish_mode,
                CASE
                    WHEN i.bar_id IS NULL AND i.created_by IS NULL AND (i.item_type = ANY (ARRAY['cocktail'::entity_type, 'beer'::entity_type, 'wine'::entity_type])) THEN 'description'::item_publish_mode
                    ELSE NULL::item_publish_mode
                END, 'private'::item_publish_mode) AS mode) eff
     CROSS JOIN LATERAL ( SELECT
                CASE
                    WHEN i.is_catalog THEN 'open'::bar_page_visibility
                    WHEN i.bar_id IS NOT NULL THEN bar.page_visibility
                    WHEN i.origin_bar_profile_id IS NOT NULL AND i.created_by IS NULL THEN COALESCE(( SELECT ob.page_visibility
                       FROM profiles op
                         JOIN bars ob ON ob.id = op.bar_id
                      WHERE op.id = i.origin_bar_profile_id), 'description'::bar_page_visibility)
                    ELSE 'open'::bar_page_visibility
                END AS page) pg
  WHERE eff.mode <> 'private'::item_publish_mode AND i.moderated_at IS NULL AND pg.page <> 'private'::bar_page_visibility AND
        CASE
            WHEN i.bar_id IS NOT NULL THEN (EXISTS ( SELECT 1
               FROM profiles p
              WHERE p.bar_id = i.bar_id AND p.is_public AND p.moderated_at IS NULL))
            WHEN i.created_by IS NOT NULL THEN (EXISTS ( SELECT 1
               FROM profiles p
              WHERE p.user_id = i.created_by AND p.is_public AND p.moderated_at IS NULL)) AND NOT (i.created_by IN ( SELECT b.blocked_id
               FROM user_blocks b
              WHERE b.blocker_id = auth.uid()
            UNION
             SELECT b.blocker_id
               FROM user_blocks b
              WHERE b.blocked_id = auth.uid()))
            ELSE true
        END;

-- --- ingredient names without amounts: house lines say so (#502's rule) ---
CREATE OR REPLACE FUNCTION public.public_drink_ingredients(p_item_ids uuid[])
RETURNS TABLE (item_id uuid, sort_order integer, name text, brand boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT r.recipe_item_id, r.sort_order,
         COALESCE(pi.name, 'House ingredient'),
         COALESCE(pi.ingredient_role IS NOT DISTINCT FROM 'product', false)
  FROM private.published_listing l
  JOIN public.recipes r ON r.recipe_item_id OPERATOR(pg_catalog.=) l.id
  LEFT JOIN public.items s ON s.id OPERATOR(pg_catalog.=) r.ingredient_item_id
  -- Named when shared, or published in its own right; otherwise a house line.
  LEFT JOIN public.items pi
    ON pi.id OPERATOR(pg_catalog.=) CASE
      WHEN l.bar_id IS NULL THEN r.ingredient_item_id
      ELSE COALESCE(r.parent_ingredient_id, s.generic_id, r.ingredient_item_id)
    END
   AND pi.moderated_at IS NULL
   AND ((pi.bar_id IS NULL AND pi.created_by IS NULL)
        OR EXISTS (SELECT 1 FROM private.published_listing pl WHERE pl.id OPERATOR(pg_catalog.=) pi.id))
  WHERE l.id OPERATOR(pg_catalog.=) ANY (p_item_ids[1:200])
    AND l.effective_mode OPERATOR(pg_catalog.<>) 'private'::public.item_publish_mode
    AND NOT l.page_locked
  ORDER BY r.recipe_item_id, r.sort_order, r.created_at;
$function$;

-- --- no scores for a Private page or its drinks ---
CREATE OR REPLACE FUNCTION public.get_venue_score(p_venue_profile_id uuid)
 RETURNS TABLE(score numeric, rankers integer, drinks integer, is_early boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT CASE WHEN s.rankers >= private.ranking_min_rankers() THEN s.score END,
         s.rankers, s.drinks, s.rankers < private.ranking_min_rankers()
  FROM private.venue_scores s
  JOIN public.profiles p ON p.id = s.venue_profile_id
  WHERE s.venue_profile_id = p_venue_profile_id AND p.kind = 'bar' AND p.is_public
    AND p.id NOT IN (SELECT private.private_page_profile_ids());
$function$;

CREATE OR REPLACE FUNCTION public.get_item_scores(p_item_ids uuid[])
 RETURNS TABLE(item_id uuid, score numeric, rankers integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT s.item_id, s.score, s.rankers
  FROM private.item_scores s
  WHERE s.item_id = ANY (p_item_ids[1:200])
    AND s.rankers >= private.ranking_min_rankers()
    AND NOT private.is_private_page_drink(s.item_id);
$function$;

CREATE OR REPLACE FUNCTION public.get_drink_rankings(p_ranked_as_item_id uuid, p_country_code text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_postcode text DEFAULT NULL::text, p_limit integer DEFAULT 20)
 RETURNS TABLE("position" bigint, venue_profile_id uuid, handle text, display_name text, locality text, city text, score numeric, rankers integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT row_number() OVER (ORDER BY v.score DESC, v.rankers DESC), p.id, p.handle, p.display_name,
         p.locality, p.city, v.score, v.rankers
  FROM private.venue_drink_scores v
  JOIN public.profiles p ON p.id = v.venue_profile_id
  WHERE v.ranked_as_item_id = p_ranked_as_item_id
    AND v.rankers >= private.ranking_min_rankers()
    AND p.is_public
    AND p.moderated_at IS NULL
    AND p.id NOT IN (SELECT private.private_page_profile_ids())
    AND (p_country_code IS NULL OR p.country_code = upper(p_country_code))
    AND (p_city IS NULL OR lower(p.city) = lower(p_city))
    AND (p_postcode IS NULL OR p.postcode = p_postcode)
  ORDER BY v.score DESC, v.rankers DESC
  LIMIT least(greatest(coalesce(p_limit, 20), 1), 100);
$function$;

CREATE OR REPLACE FUNCTION public.discover_drink_rankings(p_ranked_as_item_id uuid, p_latitude double precision DEFAULT NULL::double precision, p_longitude double precision DEFAULT NULL::double precision, p_radius_km double precision DEFAULT 10, p_country_code text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_limit integer DEFAULT 20)
 RETURNS TABLE("position" bigint, venue_profile_id uuid, handle text, display_name text, locality text, city text, latitude double precision, longitude double precision, distance_km double precision, score numeric, rankers integer, is_early boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  WITH rows AS MATERIALIZED (
    SELECT v.venue_profile_id, v.score, v.rankers, a.distance_km,
           v.rankers >= private.ranking_min_rankers() AS ranked
    FROM private.venue_drink_scores v
    JOIN private.bars_in_area(p_latitude, p_longitude, p_radius_km, p_country_code, p_city) a ON a.id = v.venue_profile_id
    WHERE v.ranked_as_item_id = p_ranked_as_item_id
      AND v.venue_profile_id NOT IN (SELECT private.private_page_profile_ids())
  ), numbered AS (
    SELECT r.*, row_number() OVER (
      PARTITION BY r.ranked
      ORDER BY CASE WHEN r.ranked THEN r.score END DESC NULLS LAST,
               CASE WHEN NOT r.ranked THEN b.loved END DESC,
               r.rankers DESC, b.relevance DESC, r.distance_km NULLS LAST, r.venue_profile_id
    ) AS n
    FROM rows r
    JOIN private.bar_relevance(ARRAY(SELECT rows.venue_profile_id FROM rows)) b ON b.id = r.venue_profile_id
  )
  SELECT CASE WHEN x.ranked THEN x.n END, p.id, p.handle, p.display_name, p.locality, p.city, p.latitude, p.longitude,
         x.distance_km, CASE WHEN x.ranked THEN x.score END, x.rankers, NOT x.ranked
  FROM numbered x
  JOIN public.profiles p ON p.id = x.venue_profile_id
  WHERE x.n <= least(greatest(coalesce(p_limit, 20), 1), 100)
  ORDER BY x.ranked DESC, x.n;
$function$;

CREATE OR REPLACE FUNCTION public.discover_top_bars(p_latitude double precision DEFAULT NULL::double precision, p_longitude double precision DEFAULT NULL::double precision, p_radius_km double precision DEFAULT 10, p_country_code text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_limit integer DEFAULT 20)
 RETURNS TABLE("position" bigint, venue_profile_id uuid, handle text, display_name text, locality text, city text, latitude double precision, longitude double precision, distance_km double precision, score numeric, rankers integer, drinks integer, is_early boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  WITH area AS MATERIALIZED (
    SELECT * FROM private.bars_in_area(p_latitude, p_longitude, p_radius_km, p_country_code, p_city)
  ), rows AS (
    SELECT a.id AS venue_profile_id, s.score, coalesce(s.rankers, 0) AS rankers, coalesce(s.drinks, 0) AS drinks,
           a.distance_km, coalesce(s.rankers, 0) >= private.ranking_min_rankers() AS ranked,
           r.loved, r.stale, r.relevance
    FROM area a
    JOIN private.bar_relevance(ARRAY(SELECT area.id FROM area)) r ON r.id = a.id
    -- A Private bar stays on the map, unscored.
    LEFT JOIN private.venue_scores s ON s.venue_profile_id = a.id AND a.id NOT IN (SELECT private.private_page_profile_ids())
  ), numbered AS (
    SELECT r.*, row_number() OVER (
      PARTITION BY r.ranked
      ORDER BY CASE WHEN r.ranked THEN r.score END DESC NULLS LAST,
               CASE WHEN NOT r.ranked THEN r.loved END DESC,
               r.rankers DESC, r.relevance DESC, r.distance_km NULLS LAST,
               lower(p.display_name), r.venue_profile_id
    ) AS n
    FROM rows r
    JOIN public.profiles p ON p.id = r.venue_profile_id
    -- Stale bars drop off, unless loved by the viewer or ranked there.
    WHERE r.ranked OR r.loved OR r.rankers > 0 OR NOT r.stale
  )
  SELECT CASE WHEN x.ranked THEN x.n END, p.id, p.handle, p.display_name, p.locality, p.city, p.latitude, p.longitude,
         x.distance_km, CASE WHEN x.ranked THEN x.score END, x.rankers, x.drinks, NOT x.ranked
  FROM numbered x
  JOIN public.profiles p ON p.id = x.venue_profile_id
  WHERE x.n <= least(greatest(coalesce(p_limit, 20), 1), 100)
  ORDER BY x.ranked DESC, x.n;
$function$;

CREATE OR REPLACE FUNCTION public.get_bar_top_drinks(p_profile_id uuid, p_limit integer DEFAULT 30)
 RETURNS TABLE("position" bigint, item_id uuid, name text, bar_id uuid, ranked_as_item_id uuid, ranked_as_name text, image_url text, image_is_generated boolean, score numeric, rankers integer, menu text, menu_from integer, menu_to integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  WITH bar AS (
    SELECT p.id, p.bar_id, p.is_closed,
           (SELECT e.id FROM public.profile_menu_editions e
             WHERE e.profile_id = p.id
             ORDER BY e.year DESC, e.month DESC NULLS LAST, e.name
             LIMIT 1) AS latest_edition_id
    FROM public.profiles p
    WHERE p.id = p_profile_id AND p.kind = 'bar' AND p.is_public AND p.moderated_at IS NULL
      AND p.id NOT IN (SELECT private.private_page_profile_ids())
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
    -- One per classic: the bar's own version before the catalog classic it made.
    SELECT DISTINCT ON (ranked_as_item_id) item_id, ranked_as_item_id
    FROM (
      SELECT i.id AS item_id, i.is_catalog, i.created_at,
             CASE WHEN i.riff_of_id IS NOT NULL AND (riff.is_catalog OR i.origin = 'Classic') THEN i.riff_of_id ELSE i.id END AS ranked_as_item_id
      FROM bar b
      JOIN public.items i
        ON i.item_type = 'cocktail'
       AND ((i.bar_id IS NULL AND i.created_by IS NULL AND i.origin_bar_profile_id = b.id)
            OR (b.bar_id IS NOT NULL AND i.bar_id = b.bar_id))
      LEFT JOIN public.items riff ON riff.id = i.riff_of_id
      WHERE private.is_listed_drink(i.id)
    ) u
    ORDER BY ranked_as_item_id, is_catalog, created_at, item_id
  ), candidates AS (
    SELECT s.item_id, s.ranked_as_item_id, s.score, s.rankers, s.ranked FROM shown s
    UNION ALL
    SELECT u.item_id, u.ranked_as_item_id, NULL, 0, false
    FROM unranked u
    WHERE u.item_id NOT IN (SELECT item_id FROM shown)
      AND u.ranked_as_item_id NOT IN (SELECT ranked_as_item_id FROM shown)
  ), tagged AS (
    SELECT c.*, i.name, i.bar_id,
           -- The drink's page is Locked to the caller (a venue drink's bar, or the
           -- bar a shared drink is credited to): no picture, as on published_items.
           (NOT i.is_catalog AND COALESCE(
               (SELECT vp.id FROM public.profiles vp WHERE vp.bar_id = i.bar_id AND vp.kind = 'bar' LIMIT 1),
               CASE WHEN i.bar_id IS NULL AND i.created_by IS NULL THEN i.origin_bar_profile_id END
           ) IN (SELECT private.page_closed_profile_ids(true))) IS TRUE AS page_locked,
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
         CASE WHEN o.page_locked THEN NULL ELSE img.url END, CASE WHEN o.page_locked THEN NULL ELSE img.is_generated END, CASE WHEN o.ranked THEN o.score END, o.rankers, o.menu, o.menu_from, o.menu_to
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
$function$;

-- --- Discover: a Private bar's drinks leave the facts (bars' page changes already mark them) ---
CREATE OR REPLACE FUNCTION private.refresh_discover_facts(p_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_count integer;
BEGIN
    DELETE FROM public.discover_drink_facts f
    WHERE (p_ids IS NULL OR f.item_id = ANY (p_ids))
      AND NOT EXISTS (
          SELECT 1 FROM public.items i JOIN public.profiles p ON p.id = i.origin_bar_profile_id AND p.kind = 'bar'
          LEFT JOIN public.bars ob ON ob.id = p.bar_id
          WHERE i.id = f.item_id AND i.item_type = 'cocktail' AND i.bar_id IS NULL
            AND coalesce(ob.page_visibility, 'description') <> 'private'
      );

    -- Set-wise, one rule at a time over every drink (the LATERALs keep each
    -- rule's patterns hot): Postgres caches 32 compiled patterns, and drink by
    -- drink the 45 rules would recompile every pattern on every row.
    INSERT INTO public.discover_drink_facts AS t ("item_id", "bar_profile_id", "name", "styles", "spirits", "notes", "haystack", "base_rank", "refreshed_at")
    WITH src AS MATERIALIZED (
        SELECT i.id, i.name, i.description, i.origin_bar_profile_id, rf.name AS riff_name,
               CASE WHEN (i.created_by IS NULL AND coalesce(ob.page_visibility, 'description') = 'open') OR ps.id IS NOT NULL THEN (
                   SELECT array_agg(n.name ORDER BY r.sort_order)
                   FROM public.recipes r JOIN public.items n ON n.id = r.ingredient_item_id
                   WHERE r.recipe_item_id = i.id
               ) END AS lines
        FROM public.items i
        JOIN public.profiles p ON p.id = i.origin_bar_profile_id AND p.kind = 'bar'
        LEFT JOIN public.bars ob ON ob.id = p.bar_id
        LEFT JOIN public.items rf ON rf.id = i.riff_of_id
        LEFT JOIN private.published_listing ps ON ps.id = i.id AND ps.effective_mode = 'spec'
        WHERE i.item_type = 'cocktail' AND i.bar_id IS NULL
          AND coalesce(ob.page_visibility, 'description') <> 'private'
          AND (p_ids IS NULL OR i.id = ANY (p_ids))
    ), folded AS MATERIALIZED (
        -- As lib/drinkStyles.ts: the folded name, description, classic, and lines joined by " | ".
        SELECT src.*,
               private.discover_fold_ws(src.name) AS n,
               private.discover_fold_ws(src.description) AS t,
               private.discover_fold_ws(src.riff_name) AS r,
               coalesce((SELECT string_agg(private.discover_fold_ws(x), ' | ' ORDER BY o) FROM unnest(src.lines) WITH ORDINALITY u(x, o)), '') AS i,
               coalesce(cardinality(src.lines), 0) > 0 AS has_lines
        FROM src
    ), d AS MATERIALIZED (
        -- The builds' ingredient tests (stylesOf's CITRUS, SWEET, LONG, BUBBLES, APERITIVO).
        SELECT f.*,
               f.i ~ '\y(lemon|lime|grapefruit|yuzu|citrus|sudachi|calamansi|verjus)\y(?! (twist|peel|zest|wheel|wedge|coin|leaf|oil))|\yacid\y' AS citrus,
               f.i ~ 'syrup|sugar|honey|agave nectar|orgeat|grenadine|cordial|liqueur|triple sec|cointreau|cura[cç]ao|maraschino|falernum|oleo' AS sweet,
               f.i ~ 'soda|\ytonic\y|ginger beer|ginger ale|\ycola\y|seltzer|sparkling water|lemonade|kombucha' AS long,
               f.i ~ 'champagne|prosecco|cava|cremant|sparkling wine|\ysekt\y|lambrusco|franciacorta|pet[- ]nat' AS bubbles,
               f.i ~ 'aperol|campari|aperitiv|select aperitivo|bitter|vermouth|lillet|cocchi|amaro|suze' AS aperitivo,
               f.i ~ 'espresso|coffee|cold brew' AS coffee,
               f.i ~ 'cream|milk' AS cream,
               f.i ~ 'soda' AS soda
        FROM folded f
    ), styled AS (
        -- stylesOf: by the classic it's a version of, its name, its description, or its build (only with lines).
        SELECT x.id, array_agg(s.id ORDER BY s.ord) AS styles
        FROM private.discover_style_rules s
        CROSS JOIN LATERAL (
            SELECT d.id FROM d
            WHERE (d.r <> '' AND d.r = ANY (s.classics))
               OR (s.name_re IS NOT NULL AND d.n ~ s.name_re)
               OR (s.text_re IS NOT NULL AND d.t ~ s.text_re)
               OR (s.riff_re IS NOT NULL AND d.t ~ s.riff_re)
               OR (d.has_lines AND CASE s.id
                      WHEN 'espresso-martini' THEN d.coffee
                      WHEN 'sour' THEN d.citrus AND d.sweet AND NOT d.long AND NOT d.bubbles AND NOT d.cream
                      WHEN 'highball' THEN d.long AND NOT d.bubbles
                      WHEN 'spritz' THEN d.bubbles OR (d.aperitivo AND d.soda)
                      ELSE false
                   END)
        ) x
        GROUP BY x.id
    ), spirited AS (
        -- spiritsOf: from the lines when any match, else the name and description.
        SELECT x.id,
               array_agg(s.id ORDER BY s.ord) FILTER (WHERE x.from_lines) AS from_lines,
               array_agg(s.id ORDER BY s.ord) FILTER (WHERE x.from_words) AS from_words
        FROM private.discover_spirit_rules s
        CROSS JOIN LATERAL (
            SELECT d.id, d.i ~ s.match_re AS from_lines, (d.n || ' | ' || d.t) ~ s.match_re AS from_words FROM d
        ) x
        GROUP BY x.id
    )
    SELECT d.id, d.origin_bar_profile_id, d.name,
           coalesce(st.styles, '{}'),
           coalesce(sp.from_lines, sp.from_words, '{}'),
           coalesce(fl.notes, '{}'),
           private.discover_fold_ws(concat_ws(' | ', d.name, d.riff_name, d.description, array_to_string(d.lines, ' | '))),
           (CASE WHEN run.is_current THEN 0 WHEN run.end_year IS NOT NULL THEN 2 ELSE 1 END) * 4
             + CASE WHEN hero.has THEN 0 ELSE 2 END
             + CASE WHEN d.name ~ '^[[:alpha:]]' THEN 0 ELSE 1 END,
           now()
    FROM d
    LEFT JOIN styled st ON st.id = d.id
    LEFT JOIN spirited sp ON sp.id = d.id
    LEFT JOIN LATERAL (
        SELECT true AS has FROM public.item_images ii WHERE ii.item_id = d.id AND ii.angle = 'hero' LIMIT 1
    ) hero ON true
    -- Its run on its own bar's menus first, as discover_drinks.
    LEFT JOIN LATERAL (
        SELECT r.end_year, r.is_current
        FROM public.menu_drink_runs r
        WHERE r.item_id = d.id
        ORDER BY (r.profile_id = d.origin_bar_profile_id) DESC, r.is_current DESC
        LIMIT 1
    ) run ON true
    LEFT JOIN LATERAL (
        SELECT array_remove(ARRAY[
            CASE WHEN f.sweet >= 0.4 THEN 'sweet' END,
            CASE WHEN f.sour >= 0.4 THEN 'sour' END,
            CASE WHEN f.bitter >= 0.4 THEN 'bitter' END,
            CASE WHEN f.botanical >= 0.4 THEN 'botanical' END,
            CASE WHEN f.herbal >= 0.4 THEN 'herbal' END,
            CASE WHEN f.fruity >= 0.4 THEN 'fruity' END,
            CASE WHEN f.spiced >= 0.4 THEN 'spiced' END,
            CASE WHEN f.spicy >= 0.4 THEN 'spicy' END,
            CASE WHEN f.smoky >= 0.4 THEN 'smoky' END,
            CASE WHEN f.savory >= 0.4 THEN 'savory' END,
            CASE WHEN f.creamy >= 0.4 THEN 'creamy' END
        ], NULL) AS notes
        FROM public.item_flavors f
        WHERE f.item_id = d.id AND f.coverage >= 0.5
    ) fl ON true
    ON CONFLICT ("item_id") DO UPDATE SET
        "bar_profile_id" = EXCLUDED."bar_profile_id",
        "name" = EXCLUDED."name",
        "styles" = EXCLUDED."styles",
        "spirits" = EXCLUDED."spirits",
        "notes" = EXCLUDED."notes",
        "haystack" = EXCLUDED."haystack",
        "base_rank" = EXCLUDED."base_rank",
        "refreshed_at" = EXCLUDED."refreshed_at";
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.discover_drinks(p_latitude double precision DEFAULT NULL::double precision, p_longitude double precision DEFAULT NULL::double precision, p_radius_km double precision DEFAULT 10, p_country_code text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_query text DEFAULT NULL::text, p_after uuid DEFAULT NULL::uuid, p_before uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 1000)
 RETURNS TABLE(id uuid, name text, description text, riff_of text, ingredients text[], image_url text, bar_profile_id uuid, menu_run smallint[], notes text[])
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE
    v_point boolean := p_latitude IS NOT NULL;
    v_radius double precision := least(greatest(coalesce(p_radius_km, 10), 0.1), 200);
    v_limit integer := least(greatest(coalesce(p_limit, 1000), 1), 1000);
    v_words text[];
    v_dlat double precision;
    v_dlng double precision;
BEGIN
    IF (p_latitude IS NULL) <> (p_longitude IS NULL) THEN
        RAISE EXCEPTION 'A point needs both a latitude and a longitude.' USING ERRCODE = '22023';
    END IF;
    IF v_point AND (p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180) THEN
        RAISE EXCEPTION 'That point is off the map.' USING ERRCODE = '22023';
    END IF;
    IF v_point THEN
        v_dlat := v_radius / 111.045;
        v_dlng := v_radius / (111.045 * greatest(cos(radians(p_latitude)), 0.01));
    END IF;
    SELECT array_agg(w) INTO v_words
    FROM regexp_split_to_table(public.discover_fold(p_query), '\s+') w
    WHERE w <> '';

    RETURN QUERY
    WITH bars AS (
        SELECT p.id, p.display_name
        FROM public.profiles p
        WHERE p.kind = 'bar' AND p.is_public AND NOT p.is_closed
          AND p.id NOT IN (SELECT private.private_page_profile_ids())
          AND (p_country_code IS NULL OR v_point OR p.country_code = upper(p_country_code))
          AND (p_city IS NULL OR v_point OR lower(p.city) = lower(p_city))
          AND (NOT v_point OR (
              p.latitude BETWEEN p_latitude - v_dlat AND p_latitude + v_dlat
              AND (
                  v_dlng >= 180
                  OR p.longitude BETWEEN p_longitude - v_dlng AND p_longitude + v_dlng
                  -- Across the antimeridian.
                  OR p.longitude >= p_longitude - v_dlng + 360
                  OR p.longitude <= p_longitude + v_dlng - 360
              )
              -- Haversine, as private.distance_km.
              AND 2 * 6371.0088 * asin(least(1, sqrt(
                  power(sin(radians(p.latitude - p_latitude) / 2), 2)
                  + cos(radians(p_latitude)) * cos(radians(p.latitude)) * power(sin(radians(p.longitude - p_longitude) / 2), 2)
              ))) <= v_radius
          ))
    ), drinks AS (
        SELECT i.id, i.name, i.description, i.riff_of_id, i.origin_bar_profile_id, b.display_name AS bar_name
        FROM public.items i
        JOIN bars b ON b.id = i.origin_bar_profile_id
        WHERE i.item_type = 'cocktail' AND i.bar_id IS NULL
          AND (p_after IS NULL OR i.id > p_after)
          AND (p_before IS NULL OR i.id < p_before)
    ), described AS (
        SELECT d.*, rf.name AS riff_name, ing.names
        FROM drinks d
        LEFT JOIN public.items rf ON rf.id = d.riff_of_id
        -- Ingredients through the role-masked recipe view, as the app read
        -- them. Ids first, then names by id: joining items inside the view's
        -- lateral planned a scan of every item per drink.
        LEFT JOIN LATERAL (
            SELECT array_agg(r.display_ingredient_id ORDER BY r.sort_order) AS ids
            FROM public.app_recipe_presentation r
            WHERE r.recipe_item_id = d.id AND r.display_ingredient_id IS NOT NULL
        ) rec ON true
        LEFT JOIN LATERAL (
            SELECT array_agg(n.name ORDER BY u.ord) AS names
            FROM unnest(rec.ids) WITH ORDINALITY u(id, ord)
            JOIN public.items n ON n.id = u.id
        ) ing ON true
        WHERE v_words IS NULL OR NOT EXISTS (
            SELECT 1 FROM unnest(v_words) w
            WHERE strpos(
                public.discover_fold(concat_ws(' | ', d.name, rf.name, d.description, array_to_string(ing.names, ' | '), d.bar_name)),
                w
            ) = 0
        )
        ORDER BY d.id
        LIMIT v_limit
    ), heroes AS MATERIALIZED (
        -- The hero: photos before sketches, then their saved order
        -- (lib/itemImages.ts orderedPictures). One read for the page: a
        -- lateral per drink scanned item_images each time.
        SELECT DISTINCT ON (ii.item_id) ii.item_id, im.url
        FROM public.item_images ii
        JOIN public.images im ON im.id = ii.image_id
        WHERE ii.item_id IN (SELECT x.id FROM described x) AND ii.angle = 'hero'
        ORDER BY ii.item_id, ii.is_generated, coalesce(ii.sort_order, 0)
    )
    SELECT x.id, x.name, x.description, x.riff_name, coalesce(x.names, '{}'), img.url, x.origin_bar_profile_id,
           CASE WHEN run.start_year IS NOT NULL THEN
               ARRAY[run.start_year, run.start_month, run.end_year, run.end_month, run.is_current::integer::smallint]
           END,
           coalesce(fl.notes, '{}')
    FROM described x
    LEFT JOIN heroes img ON img.item_id = x.id
    -- Its run on its own bar's menus first.
    LEFT JOIN LATERAL (
        SELECT r.start_year, r.start_month, r.end_year, r.end_month, r.is_current
        FROM public.menu_drink_runs r
        WHERE r.item_id = x.id
        ORDER BY (r.profile_id = x.origin_bar_profile_id) DESC, r.is_current DESC
        LIMIT 1
    ) run ON true
    LEFT JOIN LATERAL (
        SELECT array_remove(ARRAY[
            CASE WHEN f.sweet >= 0.4 THEN 'sweet' END,
            CASE WHEN f.sour >= 0.4 THEN 'sour' END,
            CASE WHEN f.bitter >= 0.4 THEN 'bitter' END,
            CASE WHEN f.botanical >= 0.4 THEN 'botanical' END,
            CASE WHEN f.herbal >= 0.4 THEN 'herbal' END,
            CASE WHEN f.fruity >= 0.4 THEN 'fruity' END,
            CASE WHEN f.spiced >= 0.4 THEN 'spiced' END,
            CASE WHEN f.spicy >= 0.4 THEN 'spicy' END,
            CASE WHEN f.smoky >= 0.4 THEN 'smoky' END,
            CASE WHEN f.savory >= 0.4 THEN 'savory' END,
            CASE WHEN f.creamy >= 0.4 THEN 'creamy' END
        ], NULL) AS notes
        FROM public.item_flavors f
        WHERE f.item_id = x.id AND f.coverage >= 0.5
    ) fl ON true
    ORDER BY x.id;
END;
$function$;

-- --- menus follow the level: none at Private ---
CREATE OR REPLACE FUNCTION public.get_menu_editions(p_profile_id uuid)
 RETURNS TABLE(id uuid, name text, year smallint, month smallint, end_year smallint, end_month smallint, is_current boolean, theme text, source_url text, drinks jsonb, from_venue boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
    WITH shown AS (
        SELECT p.id, p.kind, p.bar_id
        FROM public.profiles p
        WHERE p.id = p_profile_id
          -- A Private page's menus are its team's.
          AND p.id NOT IN (SELECT private.private_page_profile_ids())
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
    ), venue AS (
        -- A started menu's dates, in UTC. It ran up to the moment before ends_at.
        SELECT m.id, m.name, m.description, m.bar_id,
            m.ends_at IS NOT NULL AND m.ends_at <= now() AS ended,
            m.starts_at AT TIME ZONE 'UTC' AS started_on,
            (m.ends_at - interval '1 microsecond') AT TIME ZONE 'UTC' AS ended_on
        FROM public.menus m
        JOIN shown s ON s.kind = 'bar' AND s.bar_id IS NOT NULL AND m.bar_id = s.bar_id
        WHERE m.kind = 'menu'
          AND m.starts_at IS NOT NULL
          AND m.starts_at <= now()
    ), rows AS (
        SELECT e.id, e.name, e.year, e.month, e.end_year, e.end_month, e.is_current, e.theme, e.source_url,
            COALESCE((
                SELECT jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name) ORDER BY d.sort_order)
                FROM public.profile_menu_edition_drinks d
                JOIN public.items i ON i.id = d.item_id AND i.moderated_at IS NULL
                WHERE d.edition_id = e.id
            ), '[]'::jsonb) AS drinks,
            false AS from_venue
        FROM public.profile_menu_editions e
        JOIN shown s ON s.id = e.profile_id
        UNION ALL
        SELECT v.id, v.name,
            extract(year FROM v.started_on)::smallint,
            extract(month FROM v.started_on)::smallint,
            CASE WHEN v.ended THEN extract(year FROM v.ended_on)::smallint END,
            CASE WHEN v.ended THEN extract(month FROM v.ended_on)::smallint END,
            NOT v.ended,
            v.description,
            NULL::text,
            COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object('id', i.id, 'name', i.name, 'price', NULLIF(btrim(i.price), ''), 'section', ms.name)
                    ORDER BY ms.sort_order NULLS LAST, md.sort_order, md.id
                )
                FROM public.menu_drinks md
                JOIN public.items i ON i.id = md.item_id AND i.moderated_at IS NULL
                    AND (i.bar_id = v.bar_id OR (i.bar_id IS NULL AND i.created_by IS NULL))
                LEFT JOIN public.menu_sections ms ON ms.id = md.menu_section_id
                WHERE md.menu_id = v.id
            ), '[]'::jsonb),
            true
        FROM venue v
    )
    SELECT * FROM rows
    ORDER BY year DESC, month DESC NULLS LAST, name
    LIMIT 200;
$function$;

-- --- a claim hands the page over at Menu ---
CREATE OR REPLACE FUNCTION private.hand_over_claim(p_claim_id uuid, p_reviewer uuid)
 RETURNS profiles
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_claim public.profile_claims;
    v_profile public.profiles;
    v_bar_id uuid;
    v_visibility public.bar_page_visibility;
BEGIN
    SELECT * INTO v_claim FROM public.profile_claims WHERE id = p_claim_id AND status = 'pending' FOR UPDATE;
    IF v_claim.id IS NULL THEN
        RAISE EXCEPTION 'No pending claim with that id.';
    END IF;
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_claim.profile_id FOR UPDATE;
    IF v_profile.user_id IS NOT NULL OR v_profile.bar_id IS NOT NULL THEN
        RAISE EXCEPTION 'That profile has already been claimed.';
    END IF;

    IF v_profile.kind = 'person' THEN
        -- Made a profile (or was approved for another) after claiming this one.
        IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = v_claim.user_id) THEN
            RAISE EXCEPTION 'This person already has a profile. Merge them by hand, or turn the claim down.';
        END IF;
        UPDATE public.profiles SET user_id = v_claim.user_id, claimed_at = now()
        WHERE id = v_profile.id RETURNING * INTO v_profile;
    ELSE
        v_visibility := coalesce((v_claim.setup ->> 'page_visibility')::public.bar_page_visibility, 'description');
        v_bar_id := v_claim.bar_id;
        IF v_bar_id IS NULL THEN
            INSERT INTO public.bars (name, logo_url, page_visibility)
            VALUES (v_profile.display_name, v_profile.avatar_url, v_visibility)
            RETURNING id INTO v_bar_id;
            INSERT INTO public.user_bars (bar_id, user_id, role_level) VALUES (v_bar_id, v_claim.user_id, 40);
        ELSE
            IF EXISTS (SELECT 1 FROM public.profiles WHERE bar_id = v_bar_id) THEN
                RAISE EXCEPTION 'This bar already has a profile. Merge them by hand, or turn the claim down.';
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM public.user_bars ub
                WHERE ub.bar_id = v_bar_id AND ub.user_id = v_claim.user_id AND ub.role_level >= 40
                  AND NOT EXISTS (SELECT 1 FROM public.venue_roles vr WHERE vr.id = ub.venue_role_id AND vr.ends_at <= now())
            ) THEN
                RAISE EXCEPTION 'They''re no longer an Admin of the venue they chose. Turn the claim down so they can claim again.';
            END IF;
            UPDATE public.bars SET page_visibility = v_visibility WHERE id = v_bar_id;
        END IF;
        UPDATE public.profiles SET bar_id = v_bar_id, claimed_at = now()
        WHERE id = v_profile.id RETURNING * INTO v_profile;

        -- Settings kept on the claim. save_claim_setup checked them; if the
        -- page's rules moved on since, approving still goes through without them.
        IF v_claim.setup IS NOT NULL THEN
            BEGIN
                UPDATE public.profiles SET
                    hours = CASE WHEN v_claim.setup ? 'hours' THEN v_claim.setup -> 'hours' ELSE hours END,
                    timezone = CASE WHEN v_claim.setup ? 'timezone' THEN v_claim.setup ->> 'timezone' ELSE timezone END,
                    phone = CASE WHEN v_claim.setup ? 'phone' THEN v_claim.setup ->> 'phone' ELSE phone END,
                    website = CASE WHEN v_claim.setup ? 'website' THEN v_claim.setup ->> 'website' ELSE website END
                WHERE id = v_profile.id RETURNING * INTO v_profile;
            EXCEPTION WHEN check_violation THEN
                NULL;
            END;
        END IF;

        -- Invitees who said yes while the claim waited.
        INSERT INTO public.user_bars (user_id, bar_id, role_level)
        SELECT i.accepted_by, i.bar_id, i.role_level FROM public.bar_invites i
        WHERE i.bar_id = v_bar_id AND i.accepted_by IS NOT NULL
        ON CONFLICT (user_id, bar_id) DO NOTHING;
        DELETE FROM public.bar_invites WHERE bar_id = v_bar_id AND accepted_by IS NOT NULL;
    END IF;

    UPDATE public.profile_claims
    SET status = CASE WHEN id = p_claim_id THEN 'approved' ELSE 'rejected' END::public.claim_status,
        decline_reason = CASE WHEN id = p_claim_id THEN NULL ELSE 'Someone else claimed this page first.' END,
        reviewed_by = p_reviewer,
        reviewed_at = now()
    WHERE profile_id = v_claim.profile_id AND status = 'pending';

    RETURN v_profile;
END;
$function$;

-- --- Private needs a verified claim; one change every 30 days ---
ALTER TABLE public.bars ADD COLUMN page_visibility_changed_at timestamptz;
COMMENT ON COLUMN public.bars.page_visibility_changed_at IS 'When the venue last changed who sees its page itself; the next change waits 30 days. Set by private.guard_bar_page_visibility.';

CREATE OR REPLACE FUNCTION private.guard_bar_page_visibility()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_next timestamptz;
BEGIN
    IF auth.uid() IS NULL OR private.is_app_admin() THEN
        RETURN NEW;
    END IF;
    -- Only this trigger stamps the date.
    NEW.page_visibility_changed_at := OLD.page_visibility_changed_at;
    IF NEW.page_visibility IS NOT DISTINCT FROM OLD.page_visibility THEN
        RETURN NEW;
    END IF;
    IF NEW.id NOT IN (SELECT private.bars_with_capability('publish')) THEN
        RAISE EXCEPTION 'Changing who sees the bar''s page needs the publish permission.' USING ERRCODE = '42501';
    END IF;
    IF NEW.page_visibility = 'private' AND NOT public.bar_claim_verified(NEW.id) THEN
        RAISE EXCEPTION 'Private opens once your claim on this page is verified.' USING ERRCODE = '42501';
    END IF;
    v_next := OLD.page_visibility_changed_at + interval '30 days';
    IF v_next > now() THEN
        RAISE EXCEPTION 'You can change who sees your page once every 30 days. Next change from %.', to_char(v_next, 'FMDD Mon YYYY')
            USING ERRCODE = '23514';
    END IF;
    NEW.page_visibility_changed_at := now();
    RETURN NEW;
END;
$function$;

DROP TRIGGER guard_bar_page_visibility ON public.bars;
CREATE TRIGGER guard_bar_page_visibility BEFORE UPDATE OF page_visibility, page_visibility_changed_at ON public.bars
    FOR EACH ROW EXECUTE FUNCTION private.guard_bar_page_visibility();

-- --- guests keep ranking a Private bar's drinks, and keep their names ---
ALTER POLICY rank_entries_own ON public.rank_entries WITH CHECK (
    (user_id = (SELECT auth.uid()))
    AND (SELECT private.is_age_confirmed())
    AND ((item_id IN (SELECT items.id FROM public.items))
         OR (item_id IN (SELECT p.id FROM public.published_items p WHERE NOT p.is_reference))
         OR private.can_rank_private_page_drink(item_id))
    AND ((ranked_as_item_id IN (SELECT items.id FROM public.items))
         OR (ranked_as_item_id IN (SELECT p.id FROM public.published_items p WHERE NOT p.is_reference))
         OR private.can_rank_private_page_drink(ranked_as_item_id))
    AND ((venue_profile_id IS NULL)
         OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = rank_entries.venue_profile_id AND p.kind = 'bar'::public.profile_kind AND p.is_public))
);

-- The names of drinks in my own lists that I can't otherwise read (a Private bar's): the name, nothing more.
CREATE FUNCTION public.my_ranked_drink_names(p_item_ids uuid[])
RETURNS TABLE (item_id uuid, name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT i.id, i.name
  FROM public.items i
  WHERE i.id = ANY (p_item_ids[1:500])
    AND i.moderated_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.rank_entries e
      WHERE e.user_id = auth.uid() AND (e.item_id = i.id OR e.ranked_as_item_id = i.id)
    );
$function$;
REVOKE ALL ON FUNCTION public.my_ranked_drink_names(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_ranked_drink_names(uuid[]) TO authenticated;

-- --- name-only credit at Names and Private ---
-- A person's drinks at bars whose page is Names or Private: the drink's name
-- and the bar, nothing more (no picture, description or link to a spec).
-- ponytail: a venue drink counts when its own or its bar's default publish
-- mode isn't private; menu-level publish modes are ignored. Read the full
-- effective mode if a bar relies on them.
CREATE FUNCTION public.get_profile_name_credits(p_profile_id uuid)
RETURNS TABLE (item_id uuid, name text, bar_profile_id uuid, bar_handle text, bar_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT i.id, i.name, bp.id, bp.handle, bp.display_name
  FROM public.profiles person
  JOIN public.items i ON i.creator_profile_id = person.id
  JOIN public.profiles bp ON bp.kind = 'bar' AND bp.id = COALESCE(
      CASE WHEN i.bar_id IS NULL THEN i.origin_bar_profile_id END,
      (SELECT vp.id FROM public.profiles vp WHERE vp.bar_id = i.bar_id AND vp.kind = 'bar' LIMIT 1))
  JOIN public.bars b ON b.id = bp.bar_id
  WHERE person.id = p_profile_id
    AND person.kind = 'person' AND person.is_public AND person.moderated_at IS NULL
    AND (auth.uid() IS NULL OR person.user_id IS NULL OR person.user_id NOT IN (SELECT private.blocked_user_ids()))
    AND i.item_type = 'cocktail' AND i.moderated_at IS NULL AND NOT i.is_catalog
    AND bp.is_public AND bp.moderated_at IS NULL
    AND b.page_visibility IN ('private', 'locked')
    AND (i.bar_id IS NULL OR (i.bar_id = b.id AND COALESCE(i.publish_mode, b.default_publish_mode, 'private') <> 'private'))
  ORDER BY i.name
  LIMIT 200;
$function$;
REVOKE ALL ON FUNCTION public.get_profile_name_credits(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_name_credits(uuid) TO anon, authenticated;
