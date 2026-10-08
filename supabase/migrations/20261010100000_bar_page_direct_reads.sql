-- A bar's page setting holds on direct reads too. Local stack only until
-- Kevin's OK.
--
-- 20261007130000 and 20261008050000 keep a non-open bar page's specs, methods
-- and notes from people outside the bar, and published_items drops a Locked
-- page's description, picture and maker. Signed-in readers can also read the
-- shared drinks credited to a bar straight from items, though, so these
-- still came through:
--   * on a Locked page: the description, maker, pictures and every other
--     column of the row (and get_bar_top_drinks returned the pictures);
--   * on any page that isn't open: the serve size and strength, dilution and
--     price, which come from or go with the spec.
--
-- What changes:
--   * items_select: a shared drink credited to a bar whose page is Locked is
--     readable by that bar's team and catalog admins only. Everyone else gets
--     its card from published_items (name and credits, as signed out), which
--     the app already falls back to: the drink page redirects to /d/<id>,
--     rankings fill hidden drinks from published_items, and the bar page's
--     Originals list does the same for a Locked page. Pictures, methods,
--     categories and notes read through items, so they follow.
--     The check is a hashed list of Locked pages, worked out once per
--     statement, not a function call per row.
--   * serve_ml, serve_abv, dilution_pct, price and price_minor of a drink
--     credited to a bar move to credited_drink_details, readable on the same
--     terms as its spec rows (the page is open, or the reader is on the
--     bar's team or a catalog admin). app_item_presentation reads them back,
--     so the drink page and editor still show them to those people.
--     Postgres can't hide a column on some rows, and column grants would
--     break every `select *` on items (see 20261008050000), so the values
--     move, as the notes did.
--   * get_bar_top_drinks drops the picture of a drink whose page is Locked.

-- --- Pages closed to the caller ---

-- Bar profiles whose page keeps the caller out: Locked ones, or with
-- p_locked_only false every page that isn't open (an unclaimed bar's is
-- 'description'). Not the caller's own bars, and none for catalog admins.
-- Security definer so a policy can use it whatever the caller sees of
-- profiles; callers use it as `x IN (SELECT ...)`, which Postgres hashes once
-- per statement.
CREATE FUNCTION "private"."page_closed_profile_ids"("p_locked_only" boolean) RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT p.id
  FROM public.profiles p
  WHERE p.kind = 'bar'
    AND (p.page_visibility = 'locked' OR (NOT p_locked_only AND p.page_visibility <> 'open'))
    AND (p.bar_id IS NULL OR p.bar_id NOT IN (SELECT private.my_bar_ids(0)))
    AND NOT EXISTS (SELECT 1 FROM private.app_admins aa WHERE aa.user_id = auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION "private"."page_closed_profile_ids"(boolean) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."page_closed_profile_ids"(boolean) TO "authenticated", "service_role";

-- --- items ---

-- As 20261008830000_home_items_private.sql; the shared branch now leaves out
-- drinks credited to a Locked page.
DROP POLICY "items_select" ON "public"."items";
CREATE POLICY "items_select" ON "public"."items" FOR SELECT TO "authenticated" USING (
CASE
    WHEN "bar_id" IS NOT NULL THEN
        "bar_id" IN (SELECT "private"."my_bar_ids"(35))
        OR ("bar_id" IN (SELECT "private"."my_bar_ids"(0))
            AND "private"."can_view_bar_item"("bar_id", "override_visibility_level"))
    WHEN "created_by" IS NULL THEN
        "origin_bar_profile_id" IS NULL
        OR "is_catalog"
        OR "origin_bar_profile_id" NOT IN (SELECT "private"."page_closed_profile_ids"(true))
    WHEN "item_type" <> ALL (ARRAY['cocktail'::"public"."entity_type", 'beer'::"public"."entity_type", 'wine'::"public"."entity_type"]) THEN
        "is_catalog"
        OR "created_by" = (SELECT "auth"."uid"())
        OR (SELECT "private"."is_app_admin"())
        OR "private"."can_see_home_item"("id")
    ELSE "created_by" = (SELECT "auth"."uid"())
        OR (SELECT "private"."is_app_admin"())
        OR ("publish_mode" = ANY (ARRAY['description'::"public"."item_publish_mode", 'spec'::"public"."item_publish_mode"])
            AND "moderated_at" IS NULL
            AND NOT ("created_by" IN (SELECT "private"."blocked_user_ids"()))
            AND EXISTS (
                SELECT 1 FROM "public"."profiles" "p"
                WHERE "p"."user_id" = "items"."created_by" AND "p"."is_public" AND "p"."moderated_at" IS NULL))
END);

-- --- Where the spec figures live ---

-- The FK is deferred so the insert trigger below can move a new drink's
-- figures before its row exists.
CREATE TABLE "public"."credited_drink_details" (
    "item_id" "uuid" PRIMARY KEY REFERENCES "public"."items" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
    "serve_ml" numeric,
    "serve_abv" numeric,
    "dilution_pct" numeric,
    "price" "text",
    "price_minor" integer
);

ALTER TABLE "public"."credited_drink_details" ENABLE ROW LEVEL SECURITY;

-- The drink is one the reader can see, and its page is open to them. Writes
-- only come through the items triggers.
CREATE POLICY "credited_drink_details_select" ON "public"."credited_drink_details" FOR SELECT TO "authenticated"
    USING (EXISTS (
        SELECT 1 FROM "public"."items" "i"
        WHERE "i"."id" = "credited_drink_details"."item_id"
          AND "i"."origin_bar_profile_id" NOT IN (SELECT "private"."page_closed_profile_ids"(false))));

REVOKE ALL ON TABLE "public"."credited_drink_details" FROM PUBLIC, "anon", "authenticated";
GRANT SELECT ON TABLE "public"."credited_drink_details" TO "authenticated";
GRANT ALL ON TABLE "public"."credited_drink_details" TO "service_role";

-- --- Keeping them there ---

-- The triggers' WHEN clauses spell out private.is_bar_credited_drink: they
-- run as the writer, who can't call it.
--
-- One column (TG_ARGV[0]) of a credited drink: whatever an insert or update
-- writes to it goes to credited_drink_details, and the row keeps NULL. Fires
-- per column (UPDATE OF), so an update that writes NULL clears the figure and
-- one that doesn't name the column leaves it alone.
CREATE FUNCTION "private"."keep_credited_drink_detail"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_value jsonb := to_jsonb(NEW) -> TG_ARGV[0];
BEGIN
    IF TG_OP = 'UPDATE' OR v_value <> 'null'::jsonb THEN
        EXECUTE format(
            'INSERT INTO public.credited_drink_details (item_id, %1$I)
             SELECT $1, r.%1$I FROM jsonb_populate_record(NULL::public.credited_drink_details, $2) r
             ON CONFLICT (item_id) DO UPDATE SET %1$I = EXCLUDED.%1$I',
            TG_ARGV[0])
        USING NEW.id, jsonb_build_object(TG_ARGV[0], v_value);
    END IF;
    NEW := jsonb_populate_record(NEW, jsonb_build_object(TG_ARGV[0], NULL));
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."keep_credited_drink_detail"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "keep_credited_serve_ml" BEFORE INSERT OR UPDATE OF "serve_ml" ON "public"."items"
    FOR EACH ROW WHEN (("new"."bar_id" IS NULL AND NOT "new"."is_catalog" AND "new"."created_by" IS NULL AND "new"."origin_bar_profile_id" IS NOT NULL))
    EXECUTE FUNCTION "private"."keep_credited_drink_detail"('serve_ml');
CREATE TRIGGER "keep_credited_serve_abv" BEFORE INSERT OR UPDATE OF "serve_abv" ON "public"."items"
    FOR EACH ROW WHEN (("new"."bar_id" IS NULL AND NOT "new"."is_catalog" AND "new"."created_by" IS NULL AND "new"."origin_bar_profile_id" IS NOT NULL))
    EXECUTE FUNCTION "private"."keep_credited_drink_detail"('serve_abv');
CREATE TRIGGER "keep_credited_dilution_pct" BEFORE INSERT OR UPDATE OF "dilution_pct" ON "public"."items"
    FOR EACH ROW WHEN (("new"."bar_id" IS NULL AND NOT "new"."is_catalog" AND "new"."created_by" IS NULL AND "new"."origin_bar_profile_id" IS NOT NULL))
    EXECUTE FUNCTION "private"."keep_credited_drink_detail"('dilution_pct');
CREATE TRIGGER "keep_credited_price" BEFORE INSERT OR UPDATE OF "price" ON "public"."items"
    FOR EACH ROW WHEN (("new"."bar_id" IS NULL AND NOT "new"."is_catalog" AND "new"."created_by" IS NULL AND "new"."origin_bar_profile_id" IS NOT NULL))
    EXECUTE FUNCTION "private"."keep_credited_drink_detail"('price');
CREATE TRIGGER "keep_credited_price_minor" BEFORE INSERT OR UPDATE OF "price_minor" ON "public"."items"
    FOR EACH ROW WHEN (("new"."bar_id" IS NULL AND NOT "new"."is_catalog" AND "new"."created_by" IS NULL AND "new"."origin_bar_profile_id" IS NOT NULL))
    EXECUTE FUNCTION "private"."keep_credited_drink_detail"('price_minor');

-- A drink that becomes credited to a bar has its figures written again, so
-- the triggers above move them; one that stops being credited gets them back
-- on the row (unless the same update set new ones).
CREATE FUNCTION "private"."move_credited_drink_details"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF private.is_bar_credited_drink(NEW.bar_id, NEW.is_catalog, NEW.created_by, NEW.origin_bar_profile_id) THEN
        UPDATE public.items
           SET serve_ml = serve_ml, serve_abv = serve_abv, dilution_pct = dilution_pct, price = price, price_minor = price_minor
         WHERE id = NEW.id;
    ELSE
        UPDATE public.items i
           SET serve_ml = COALESCE(i.serve_ml, d.serve_ml),
               serve_abv = COALESCE(i.serve_abv, d.serve_abv),
               dilution_pct = COALESCE(i.dilution_pct, d.dilution_pct),
               price = COALESCE(i.price, d.price),
               price_minor = COALESCE(i.price_minor, d.price_minor)
          FROM public.credited_drink_details d
         WHERE d.item_id = i.id AND i.id = NEW.id;
        DELETE FROM public.credited_drink_details WHERE item_id = NEW.id;
    END IF;
    RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."move_credited_drink_details"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "move_credited_drink_details" AFTER UPDATE OF "bar_id", "is_catalog", "created_by", "origin_bar_profile_id" ON "public"."items"
    FOR EACH ROW WHEN (
        ("old"."bar_id" IS NULL AND NOT "old"."is_catalog" AND "old"."created_by" IS NULL AND "old"."origin_bar_profile_id" IS NOT NULL)
        IS DISTINCT FROM ("new"."bar_id" IS NULL AND NOT "new"."is_catalog" AND "new"."created_by" IS NULL AND "new"."origin_bar_profile_id" IS NOT NULL))
    EXECUTE FUNCTION "private"."move_credited_drink_details"();

-- items_refresh_strength (20261001130000) recomputes the serve when a drink's
-- dilution changes, but on a credited drink the row's dilution stays NULL. Any
-- write to it recomputes instead.
CREATE FUNCTION "private"."refresh_credited_drink_strength"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    PERFORM private.refresh_drink_strength(NEW.id);
    RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."refresh_credited_drink_strength"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "refresh_credited_drink_strength" AFTER UPDATE OF "dilution_pct" ON "public"."items"
    FOR EACH ROW WHEN (("new"."bar_id" IS NULL AND NOT "new"."is_catalog" AND "new"."created_by" IS NULL AND "new"."origin_bar_profile_id" IS NOT NULL))
    EXECUTE FUNCTION "private"."refresh_credited_drink_strength"();

-- As 20261001130000, reading a credited drink's dilution from its new place.
CREATE OR REPLACE FUNCTION "private"."drink_dilution_pct"("p_item" "uuid") RETURNS numeric
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  WITH d AS (
    SELECT COALESCE(i.dilution_pct, (SELECT cd.dilution_pct FROM public.credited_drink_details cd WHERE cd.item_id = i.id)) AS dilution_pct,
           b.dilution_defaults, private.drink_method(i.id) AS method,
           EXISTS (
             SELECT 1 FROM public.recipes r JOIN public.items w ON w.id = r.ingredient_item_id
             WHERE r.recipe_item_id = i.id AND r.at_service IS NOT TRUE
               AND w.name ~* '^(filtered |still |chilled |cold |mineral |spring |tap )?water$'
           ) AS pre_diluted
    FROM public.items i LEFT JOIN public.bars b ON b.id = i.bar_id
    WHERE i.id = p_item
  )
  SELECT CASE
    WHEN dilution_pct IS NOT NULL THEN dilution_pct
    WHEN pre_diluted THEN 0
    ELSE COALESCE(
      (dilution_defaults ->> method)::numeric,
      CASE method WHEN 'stirred' THEN 20 WHEN 'shaken' THEN 25 WHEN 'built' THEN 10 ELSE 0 END)
  END FROM d;
$$;

-- As 20261008050000, with the dilution from its new place too.
CREATE OR REPLACE FUNCTION "private"."drink_snapshot"("p_item" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT jsonb_build_object(
    'lines', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'ingredient_item_id', r.ingredient_item_id,
        'name', ing.name,
        'amount', r.amount,
        'unit', r.unit,
        'note', r.preparation_notes,
        'optional', COALESCE(r.is_optional, false),
        'at_service', r.at_service) ORDER BY r.sort_order, r.created_at)
      FROM public.recipes r LEFT JOIN public.items ing ON ing.id = r.ingredient_item_id
      WHERE r.recipe_item_id = p_item), '[]'::jsonb),
    'methods', COALESCE((
      SELECT jsonb_agg(m.name ORDER BY im.sort_order)
      FROM public.item_methods im JOIN public.items m ON m.id = im.method_item_id
      WHERE im.item_id = p_item), '[]'::jsonb),
    'method_ids', COALESCE((
      SELECT jsonb_agg(im.method_item_id ORDER BY im.sort_order)
      FROM public.item_methods im WHERE im.item_id = p_item), '[]'::jsonb),
    'glass', (SELECT g.name FROM public.items i JOIN public.items g ON g.id = i.glassware_id WHERE i.id = p_item),
    'ice', (SELECT ic.name FROM public.items i JOIN public.items ic ON ic.id = i.ice_id WHERE i.id = p_item),
    'notes', (SELECT COALESCE(i.notes, n.notes) FROM public.items i LEFT JOIN public.credited_drink_notes n ON n.item_id = i.id WHERE i.id = p_item),
    'dilution_pct', (SELECT COALESCE(i.dilution_pct, cd.dilution_pct) FROM public.items i LEFT JOIN public.credited_drink_details cd ON cd.item_id = i.id WHERE i.id = p_item),
    'service_style', (SELECT i.service_style FROM public.items i WHERE i.id = p_item));
$$;

-- Move what's there now (the triggers above do the moving).
UPDATE "public"."items"
   SET "serve_ml" = "serve_ml", "serve_abv" = "serve_abv", "dilution_pct" = "dilution_pct", "price" = "price", "price_minor" = "price_minor"
 WHERE "private"."is_bar_credited_drink"("bar_id", "is_catalog", "created_by", "origin_bar_profile_id")
   AND ("serve_ml" IS NOT NULL OR "serve_abv" IS NOT NULL OR "dilution_pct" IS NOT NULL OR "price" IS NOT NULL OR "price_minor" IS NOT NULL);

-- --- Reading them back ---

-- As 20261008900000_ingredient_roles.sql; the five figures come from
-- credited_drink_details when the row has none. Security invoker, so its RLS
-- decides who gets them. Subqueries like notes, not a join, so the lists that
-- don't ask for these columns don't pay for them.
CREATE OR REPLACE VIEW "public"."app_item_presentation" WITH ("security_invoker" = true) AS
 SELECT c.id,
    c.name,
    c.item_type,
    c.description,
    c.created_at,
    c.glassware_id,
    c.family_id,
    c.ice_id,
    COALESCE(c.notes, (SELECT n.notes FROM public.credited_drink_notes n WHERE n.item_id = c.id)) AS notes,
    c.origin,
    COALESCE(c.price, (SELECT cd.price FROM public.credited_drink_details cd WHERE cd.item_id = c.id)) AS price,
    c.status,
    c.brand_maker,
    c.abv,
    c.bar_id,
    c.icon_key,
    c.icon_url,
    c.hide_from_search,
    c.origin_bar_profile_id,
    c.created_by,
    c.creator_profile_id,
    c.generic_id,
    c.service_style,
    c.density_g_ml,
    COALESCE(c.dilution_pct, (SELECT cd.dilution_pct FROM public.credited_drink_details cd WHERE cd.item_id = c.id)) AS dilution_pct,
    COALESCE(c.serve_ml, (SELECT cd.serve_ml FROM public.credited_drink_details cd WHERE cd.item_id = c.id)) AS serve_ml,
    COALESCE(c.serve_abv, (SELECT cd.serve_abv FROM public.credited_drink_details cd WHERE cd.item_id = c.id)) AS serve_abv,
    c.abv_source,
    c.capacity_ml,
    c.iced_capacity_ml,
    c.ice_per_serve_g,
    COALESCE(c.price_minor, (SELECT cd.price_minor FROM public.credited_drink_details cd WHERE cd.item_id = c.id)) AS price_minor,
    c.is_core,
    c.ingredient_role,
    c.made_from_id
   FROM public.items c
     LEFT JOIN public.bars b ON c.bar_id = b.id
     LEFT JOIN public.user_bars ub ON ub.bar_id = c.bar_id AND ub.user_id = auth.uid()
  WHERE c.bar_id IS NULL OR public.effective_bar_role(ub.role_level) >= COALESCE(c.override_visibility_level, b.default_visibility_level);

-- --- Bar pages: no picture behind a Locked page ---

-- As 20261008950000_drink_lineage.sql, with page_locked.
CREATE OR REPLACE FUNCTION "public"."get_bar_top_drinks"("p_profile_id" "uuid", "p_limit" integer DEFAULT 30)
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
$$;
