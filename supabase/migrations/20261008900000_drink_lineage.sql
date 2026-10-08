-- The cocktail family tree: where every catalog classic comes from.
--
--   drink_styles            the historic styles the classics descend from
--                           (Punch, Sling, the bittered sling of 1806, Sour,
--                           Daisy, Highball, Tiki...), each with its own
--                           parent style, a year and a family. Not drinks:
--                           nobody ranks a "Sour", so they aren't items.
--   items.lineage_parent_id the catalog classic this classic descends from
--                           (Gold Rush for the Penicillin). Catalog only.
--   items.lineage_style_id  or the style it descends from directly (Sour for
--                           the Whiskey Sour). At most one of the two.
--   items.lineage_family    which of the eight families it belongs to.
--   items.lineage_note      what changed from its parent, in a line.
--   items.origin_year_approx  the year is "c. 1880", not exact.
--
-- Why not riff_of_id: riff_of_id means "a bar's version of this classic",
-- and rankings, bar pages and Discover read it that way (a Vesper with
-- riff_of_id = Martini would be ranked as a Martini, also in apps still on
-- older code). Lineage between classics is its own link, so the old meaning
-- stays true everywhere. A drink's whole line is riff_of_id up to its
-- classic, then lineage_parent_id up to the first classic, then the styles.
--
-- get_bar_top_drinks: a classic first made at a bar (the Penicillin at Milk &
-- Honey) now credits that bar, so it is listed on the bar's page. When the bar
-- also has its own version linked to the classic, the page shows the bar's
-- one, not both.

CREATE TABLE "public"."drink_styles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "key" "text" NOT NULL UNIQUE CHECK ("key" ~ '^[a-z0-9-]{2,40}$'),
    "name" "text" NOT NULL CHECK (char_length(btrim("name")) BETWEEN 1 AND 80),
    "family" "text" NOT NULL CHECK ("family" IN ('trunk', 'oldfashioned', 'martini', 'negroni', 'sour', 'sidecar', 'highball', 'tiki', 'flip')),
    "parent_style_id" "uuid" REFERENCES "public"."drink_styles"("id") ON DELETE SET NULL CHECK ("parent_style_id" <> "id"),
    "year" smallint CHECK ("year" BETWEEN 1500 AND 2100),
    "year_approx" boolean DEFAULT false NOT NULL,
    "summary" "text" CHECK (char_length("summary") <= 300),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."drink_styles" ENABLE ROW LEVEL SECURITY;
-- Reference data: everyone reads, only SQL and the service role write.
CREATE POLICY "drink_styles_select" ON "public"."drink_styles" FOR SELECT TO "anon", "authenticated" USING (true);
GRANT SELECT ON "public"."drink_styles" TO "anon", "authenticated";

ALTER TABLE "public"."items"
    ADD COLUMN "lineage_parent_id" "uuid" REFERENCES "public"."items"("id") ON DELETE SET NULL,
    ADD COLUMN "lineage_style_id" "uuid" REFERENCES "public"."drink_styles"("id") ON DELETE SET NULL,
    ADD COLUMN "lineage_family" "text" CHECK ("lineage_family" IN ('oldfashioned', 'martini', 'negroni', 'sour', 'sidecar', 'highball', 'tiki', 'flip')),
    ADD COLUMN "lineage_note" "text" CHECK (char_length("lineage_note") <= 300),
    ADD COLUMN "origin_year_approx" boolean DEFAULT false NOT NULL,
    ADD CONSTRAINT "items_lineage_not_self" CHECK ("lineage_parent_id" <> "id"),
    ADD CONSTRAINT "items_lineage_one_parent" CHECK ("lineage_parent_id" IS NULL OR "lineage_style_id" IS NULL),
    ADD CONSTRAINT "items_lineage_catalog_only" CHECK (
        "is_catalog" OR ("lineage_parent_id" IS NULL AND "lineage_style_id" IS NULL AND "lineage_family" IS NULL)
    );

CREATE INDEX "items_lineage_parent_id_idx" ON "public"."items" ("lineage_parent_id") WHERE "lineage_parent_id" IS NOT NULL;
CREATE INDEX "items_lineage_style_id_idx" ON "public"."items" ("lineage_style_id") WHERE "lineage_style_id" IS NOT NULL;

-- Lineage is catalog curation: the same people who can change is_catalog.
CREATE FUNCTION "private"."guard_item_lineage"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF auth.uid() IS NULL OR private.is_app_admin() THEN
        RETURN NEW;
    END IF;
    IF NEW.lineage_parent_id IS DISTINCT FROM OLD.lineage_parent_id
       OR NEW.lineage_style_id IS DISTINCT FROM OLD.lineage_style_id
       OR NEW.lineage_family IS DISTINCT FROM OLD.lineage_family
       OR NEW.lineage_note IS DISTINCT FROM OLD.lineage_note THEN
        RAISE EXCEPTION 'Only catalog admins can change the family tree.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "guard_item_lineage" BEFORE UPDATE OF "lineage_parent_id", "lineage_style_id", "lineage_family", "lineage_note" ON "public"."items"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_item_lineage"();

REVOKE EXECUTE ON FUNCTION "private"."guard_item_lineage"() FROM PUBLIC, "anon", "authenticated";

-- --- Bar pages: one row per classic ---

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
