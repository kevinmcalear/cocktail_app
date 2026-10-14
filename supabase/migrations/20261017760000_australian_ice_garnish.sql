-- Australian ice and garnish makers, and their garnishes: every maker and
-- product checked on the maker's own page. Step 6c of the bottle catalog
-- plan: https://claude.ai/artifact/Vu6seuSNtN42nKYb2nDCVR
--
--   * 16 makers: clear and cocktail ice makers (The Ice Guys, Van Winkle
--     Ice Co. in Melbourne; Bare Bones Ice Co., Mammoth Ice, Clear Ice
--     Supply) and garnish makers and growers (Garnish Game, White Possum,
--     Aquafab, Cocktail Candy, edible-flower growers, Mount Zero, Wild
--     Hibiscus). Each gets an unclaimed maker page saying what it makes
--     (ice or garnish) and the cities its own site says it delivers to; a
--     page an earlier load made gains them. Businesses that only resell
--     others' ice or garnish are suppliers, in a later step.
--   * 21 garnish products those makers name as products (dehydrated citrus
--     wheels, maraschino cherries, edible flowers, rim salts and sugars),
--     each under the maker's page and the page it was checked on. Category
--     names on a site ("Dehydrated Citrus") and ice products aren't loaded.
--   * An independent check of every maker and product found 1 wrong fact
--     in 124 (0.8%): a duplicate cherry listing, dropped. Brand names follow
--     the makers' own titles.
--
-- Matched by name key; a second run changes nothing more.


CREATE TEMP TABLE maker_in (name text PRIMARY KEY, handle text NOT NULL, website text, country text, city text, makes text[] NOT NULL, serves text[] NOT NULL);
INSERT INTO maker_in VALUES
($q$Aquafab$q$, $q$aquafab$q$, NULL, $q$AU$q$, NULL, ARRAY[$q$garnish$q$]::text[], '{}'::text[]),
($q$Bare Bones Ice Co.$q$, $q$bare.bones.ice.co$q$, $q$https://barebonesice.co$q$, $q$AU$q$, NULL, ARRAY[$q$ice$q$]::text[], '{}'::text[]),
($q$Clear Ice Supply$q$, $q$clear.ice.supply$q$, $q$https://clearicesupply.com$q$, $q$AU$q$, NULL, ARRAY[$q$ice$q$]::text[], ARRAY[$q$Brisbane$q$, $q$Gold Coast$q$, $q$Sunshine Coast$q$, $q$Byron Bay$q$]::text[]),
($q$Cocktail Candy$q$, $q$cocktail.candy$q$, $q$https://cocktailcandy.com.au$q$, $q$AU$q$, NULL, ARRAY[$q$garnish$q$]::text[], '{}'::text[]),
($q$Flowerdale Farm$q$, $q$flowerdale.farm$q$, $q$https://flowerdalefarm.com.au$q$, $q$AU$q$, NULL, ARRAY[$q$garnish$q$]::text[], '{}'::text[]),
($q$Foraged Flavour Edible Flowers$q$, $q$foraged.flavour.edible.flowers$q$, $q$https://foragedflavour.com.au$q$, $q$AU$q$, NULL, ARRAY[$q$garnish$q$]::text[], '{}'::text[]),
($q$Garnish Game$q$, $q$garnish.game$q$, $q$https://www.garnishgame.com.au$q$, NULL, NULL, ARRAY[$q$garnish$q$]::text[], '{}'::text[]),
($q$Mammoth Ice$q$, $q$mammoth.ice$q$, $q$https://www.mammothice.com.au$q$, $q$AU$q$, NULL, ARRAY[$q$ice$q$]::text[], '{}'::text[]),
($q$Mount Zero Olives$q$, $q$mount.zero.olives$q$, $q$https://mountzeroolives.com.au$q$, $q$AU$q$, NULL, ARRAY[$q$garnish$q$]::text[], '{}'::text[]),
($q$Peel & Tonic$q$, $q$peel.tonic$q$, NULL, $q$AU$q$, NULL, ARRAY[$q$garnish$q$]::text[], '{}'::text[]),
($q$Petite Ingredient$q$, $q$petite.ingredient$q$, $q$https://petiteingredient.com.au$q$, $q$AU$q$, NULL, ARRAY[$q$garnish$q$]::text[], '{}'::text[]),
($q$Pretty Produce$q$, $q$pretty.produce$q$, $q$https://www.prettyproduce.com.au$q$, $q$AU$q$, NULL, ARRAY[$q$garnish$q$]::text[], '{}'::text[]),
($q$The Ice Guys$q$, $q$the.ice.guys$q$, $q$https://theiceguys.com.au$q$, $q$AU$q$, NULL, ARRAY[$q$ice$q$]::text[], ARRAY[$q$Melbourne$q$]::text[]),
($q$Van Winkle Ice Co.$q$, $q$van.winkle.ice.co$q$, $q$https://www.vanwinkleice.com$q$, $q$AU$q$, NULL, ARRAY[$q$ice$q$]::text[], ARRAY[$q$Yarra Valley$q$, $q$Melbourne$q$]::text[]),
($q$White Possum$q$, $q$white.possum$q$, $q$https://whitepossum.com.au$q$, $q$AU$q$, NULL, ARRAY[$q$garnish$q$]::text[], '{}'::text[]),
($q$Wild Hibiscus Flower Company$q$, $q$wild.hibiscus.flower.company$q$, $q$https://www.bushtuckershop.com$q$, $q$AU$q$, NULL, ARRAY[$q$garnish$q$]::text[], '{}'::text[]);

-- A page per maker, unclaimed, public. A handle someone already uses is left alone.
INSERT INTO public.profiles (kind, handle, display_name, website, country_code, city, makes, serves, is_public)
SELECT 'maker', m.handle, m.name, m.website, m.country, m.city, m.makes, m.serves, true
  FROM maker_in m
 WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.handle = m.handle)
   AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.kind = 'maker' AND lower(p.display_name) = lower(m.name));

-- A maker page an earlier load made gains what this one says it makes, and the cities it serves.
UPDATE public.profiles p SET
    makes = ARRAY(SELECT DISTINCT unnest(p.makes || m.makes) ORDER BY 1),
    serves = CASE WHEN cardinality(p.serves) = 0 THEN m.serves ELSE p.serves END
  FROM maker_in m
 WHERE p.kind = 'maker' AND lower(p.display_name) = lower(m.name)
   AND (NOT (m.makes <@ p.makes) OR (cardinality(p.serves) = 0 AND cardinality(m.serves) > 0));

DROP TABLE maker_in;


SET "app.image_worker" = 'on';
CREATE TEMP TABLE "flavor_jobs_before" AS SELECT * FROM "private"."item_flavor_jobs";

CREATE FUNCTION pg_temp.shared(p_name text) RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT public.resolve_ingredient(p_name);
$$;
CREATE FUNCTION pg_temp.style(p_name text) RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT i.id FROM public.items i
     WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL AND i.ingredient_role = 'generic'
       AND public.ingredient_key(i.name) = public.ingredient_key(p_name)
     ORDER BY i.is_core DESC, i.created_at LIMIT 1;
$$;
-- Whether p_id sits under p_style (up to four levels down).
CREATE FUNCTION pg_temp.under(p_id uuid, p_style uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
    WITH RECURSIVE up AS (
        SELECT i.generic_id AS id, 1 AS d FROM public.items i WHERE i.id = p_id
        UNION ALL
        SELECT i.generic_id, up.d + 1 FROM up JOIN public.items i ON i.id = up.id WHERE up.d < 4
    )
    SELECT p_style IS NOT NULL AND EXISTS (SELECT 1 FROM up WHERE up.id = p_style);
$$;

-- ---------------------------------------------------------------------------
-- Styles
-- ---------------------------------------------------------------------------

-- The styles bottles file under here, and the style each is a kind of. Made
-- when missing; one that exists stays where it is.
CREATE TEMP TABLE style_in (ord int PRIMARY KEY, name text NOT NULL, kind_of text);
INSERT INTO style_in VALUES
(0, $q$Dried Fruit$q$, NULL),
(1, $q$Maraschino Cherry$q$, NULL),
(2, $q$Edible flower$q$, NULL),
(3, $q$Chilli Salt$q$, NULL),
(4, $q$Flake Salt$q$, NULL),
(5, $q$Salt$q$, NULL),
(6, $q$Sugar Rim$q$, NULL);

CREATE TEMP TABLE "made_now" ("id" uuid PRIMARY KEY);
DO $$
DECLARE s record; v uuid;
BEGIN
    FOR s IN SELECT * FROM style_in ORDER BY ord LOOP
        IF pg_temp.style(s.name) IS NULL AND pg_temp.shared(s.name) IS NULL THEN
            INSERT INTO public.items (name, item_type, ingredient_role, hide_from_search)
            VALUES (s.name, 'ingredient', 'generic', false) RETURNING id INTO v;
            INSERT INTO made_now VALUES (v);
            -- A new name can pick up a core suffix as its kind; set it as meant.
            UPDATE public.items SET generic_id = pg_temp.style(s.kind_of)
             WHERE id = v AND generic_id IS DISTINCT FROM pg_temp.style(s.kind_of);
        END IF;
    END LOOP;
END $$;

-- Place styles a bottle already filed under keeps, when the check gives only
-- the catch-all style.
CREATE TEMP TABLE place_in (name text PRIMARY KEY);

-- ---------------------------------------------------------------------------
-- Maker pages
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE maker_in (name text PRIMARY KEY, handle text NOT NULL, website text, country text, part_of text);
INSERT INTO maker_in VALUES
($q$Foraged Flavour Edible Flowers$q$, $q$foraged.flavour.edible.flowers$q$, NULL, NULL, NULL),
($q$Garnish Game$q$, $q$garnish.game$q$, NULL, NULL, NULL),
($q$Mount Zero Olives$q$, $q$mount.zero.olives$q$, NULL, NULL, NULL),
($q$Petite Ingredient$q$, $q$petite.ingredient$q$, NULL, NULL, NULL),
($q$White Possum$q$, $q$white.possum$q$, NULL, NULL, NULL),
($q$Wild Hibiscus Flower Company$q$, $q$wild.hibiscus.flower.company$q$, NULL, NULL, NULL);

-- A page per producer, unclaimed, public. A handle someone already uses is
-- left alone (that producer's bottles then name no maker).
INSERT INTO public.profiles (kind, handle, display_name, website, country_code, makes, is_public)
SELECT 'maker', m.handle, m.name, m.website, m.country, ARRAY[$q$garnish$q$], true
  FROM maker_in m
 WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.handle = m.handle)
   AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.kind = 'maker' AND lower(p.display_name) = lower(m.name));

CREATE FUNCTION pg_temp.maker(p_name text) RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT p.id FROM public.profiles p WHERE p.kind = 'maker' AND lower(p.display_name) = lower(p_name) LIMIT 1;
$$;

-- A maker page made by an earlier load that now makes bottles here too.
UPDATE public.profiles p SET makes = array_append(p.makes, $q$garnish$q$)
  FROM maker_in m
 WHERE p.id = pg_temp.maker(m.name) AND NOT ($q$garnish$q$ = ANY (p.makes));

UPDATE public.profiles p SET part_of_profile_id = pg_temp.maker(m.part_of)
  FROM maker_in m
 WHERE p.id = pg_temp.maker(m.name) AND m.part_of IS NOT NULL AND pg_temp.maker(m.part_of) IS NOT NULL
   AND p.part_of_profile_id IS DISTINCT FROM pg_temp.maker(m.part_of);

-- ---------------------------------------------------------------------------
-- Bottles
-- ---------------------------------------------------------------------------

-- catalog_name: the row we already have for this bottle, when there is one.
CREATE TEMP TABLE bottle_in (
    label_name text NOT NULL, catalog_name text, style text NOT NULL, producer text NOT NULL,
    abv numeric, country text, gi text, url text NOT NULL, kind text NOT NULL
);
INSERT INTO bottle_in VALUES
($q$Foraged Flavour Dried Edible Flowers$q$, NULL, $q$Edible flower$q$, $q$Foraged Flavour Edible Flowers$q$, NULL, NULL, NULL, $q$https://foragedflavour.com.au/$q$, $q$producer$q$),
($q$Foraged Flavour Fresh Edible Flowers$q$, NULL, $q$Edible flower$q$, $q$Foraged Flavour Edible Flowers$q$, NULL, NULL, NULL, $q$https://foragedflavour.com.au/$q$, $q$producer$q$),
($q$Garnish Game Dehydrated Blood Orange Wheels$q$, NULL, $q$Dried Fruit$q$, $q$Garnish Game$q$, NULL, NULL, NULL, $q$https://www.garnishgame.com.au/wholesale-dehydrated-cocktail-garnishes$q$, $q$producer$q$),
($q$Garnish Game Dehydrated Lemon Wheels$q$, NULL, $q$Dried Fruit$q$, $q$Garnish Game$q$, NULL, NULL, NULL, $q$https://www.garnishgame.com.au/wholesale-dehydrated-cocktail-garnishes$q$, $q$producer$q$),
($q$Garnish Game Dehydrated Lime Wheels$q$, NULL, $q$Dried Fruit$q$, $q$Garnish Game$q$, NULL, NULL, NULL, $q$https://www.garnishgame.com.au/wholesale-dehydrated-cocktail-garnishes$q$, $q$producer$q$),
($q$Garnish Game Dehydrated Orange Wheels$q$, NULL, $q$Dried Fruit$q$, $q$Garnish Game$q$, NULL, NULL, NULL, $q$https://www.garnishgame.com.au/wholesale-dehydrated-cocktail-garnishes$q$, $q$producer$q$),
($q$Garnish Game Fancy Floral Flavoured Sugar$q$, NULL, $q$Sugar Rim$q$, $q$Garnish Game$q$, NULL, NULL, NULL, $q$https://www.garnishgame.com.au/wholesale-dehydrated-cocktail-garnishes$q$, $q$producer$q$),
($q$Garnish Game Freeze Dried Raspberry Crumble$q$, NULL, $q$Dried Fruit$q$, $q$Garnish Game$q$, NULL, NULL, NULL, $q$https://www.garnishgame.com.au/wholesale-dehydrated-cocktail-garnishes$q$, $q$producer$q$),
($q$Garnish Game Margarita Chilli Salt Rim$q$, NULL, $q$Chilli Salt$q$, $q$Garnish Game$q$, NULL, NULL, NULL, $q$https://www.garnishgame.com.au/wholesale-dehydrated-cocktail-garnishes$q$, $q$producer$q$),
($q$Mount Zero Pink Lake Salt$q$, NULL, $q$Salt$q$, $q$Mount Zero Olives$q$, NULL, NULL, NULL, $q$https://mountzeroolives.com.au/$q$, $q$producer$q$),
($q$Petite Ingredient Australian Calendula$q$, NULL, $q$Edible flower$q$, $q$Petite Ingredient$q$, NULL, NULL, NULL, $q$https://petiteingredient.com.au/$q$, $q$producer$q$),
($q$Petite Ingredient Cornflower Blue$q$, NULL, $q$Edible flower$q$, $q$Petite Ingredient$q$, NULL, NULL, NULL, $q$https://petiteingredient.com.au/$q$, $q$producer$q$),
($q$Petite Ingredient Crystallised Violets$q$, NULL, $q$Edible flower$q$, $q$Petite Ingredient$q$, NULL, NULL, NULL, $q$https://petiteingredient.com.au/$q$, $q$producer$q$),
($q$Petite Ingredient Elderflower$q$, NULL, $q$Edible flower$q$, $q$Petite Ingredient$q$, NULL, NULL, NULL, $q$https://petiteingredient.com.au/$q$, $q$producer$q$),
($q$Petite Ingredient Miniature Rose Petals$q$, NULL, $q$Edible flower$q$, $q$Petite Ingredient$q$, NULL, NULL, NULL, $q$https://petiteingredient.com.au/$q$, $q$producer$q$),
($q$Petite Ingredient Safflower$q$, NULL, $q$Edible flower$q$, $q$Petite Ingredient$q$, NULL, NULL, NULL, $q$https://petiteingredient.com.au/$q$, $q$producer$q$),
($q$Petite Ingredient Snap Dragon$q$, NULL, $q$Edible flower$q$, $q$Petite Ingredient$q$, NULL, NULL, NULL, $q$https://petiteingredient.com.au/$q$, $q$producer$q$),
($q$White Possum Maraschino Cherries$q$, NULL, $q$Maraschino Cherry$q$, $q$White Possum$q$, NULL, NULL, NULL, $q$https://whitepossum.com.au/$q$, $q$producer$q$),
($q$Wild Hibiscus Flowers in Rose Syrup$q$, NULL, $q$Edible flower$q$, $q$Wild Hibiscus Flower Company$q$, NULL, NULL, NULL, $q$https://www.bushtuckershop.com/collections/flowers-in-syrup$q$, $q$producer$q$),
($q$Wild Hibiscus Flowers in Syrup$q$, NULL, $q$Edible flower$q$, $q$Wild Hibiscus Flower Company$q$, NULL, NULL, NULL, $q$https://www.bushtuckershop.com/collections/flowers-in-syrup$q$, $q$producer$q$),
($q$Wild Hibiscus Pyramid Salt Flakes$q$, NULL, $q$Flake Salt$q$, $q$Wild Hibiscus Flower Company$q$, NULL, NULL, NULL, $q$https://www.bushtuckershop.com/collections/flowers-in-syrup$q$, $q$producer$q$),
($q$Wild Hibiscus Whole Dried Butterfly Pea Flowers$q$, NULL, $q$Edible flower$q$, $q$Wild Hibiscus Flower Company$q$, NULL, NULL, NULL, $q$https://www.bushtuckershop.com/collections/flowers-in-syrup$q$, $q$producer$q$);

-- Which row each bottle is: the catalog's row (by its name or an alias), else
-- one already called by the label name. A style or a house prep by that name
-- isn't a bottle, so it's left alone. Two checks that land on one row keep the
-- producer's own page.
CREATE TEMP TABLE bottle_row AS
SELECT DISTINCT ON (COALESCE(x.id::text, public.ingredient_key(x.label_name))) x.*
  FROM (SELECT b.*, COALESCE(pg_temp.shared(b.catalog_name), pg_temp.shared(b.label_name)) AS id FROM bottle_in b) x
 ORDER BY COALESCE(x.id::text, public.ingredient_key(x.label_name)), (x.kind = 'producer') DESC, (x.abv IS NOT NULL) DESC,
          length(x.label_name) DESC, x.label_name;
DELETE FROM bottle_row b USING public.items i
 WHERE i.id = b.id AND (i.ingredient_role IN ('generic', 'prep') OR i.is_core OR i.bar_id IS NOT NULL);

-- New bottles.
WITH ins AS (
    INSERT INTO public.items (name, item_type, ingredient_role, hide_from_search, generic_id, brand_maker, abv, origin_country, gi, maker_profile_id)
    SELECT DISTINCT ON (public.ingredient_key(b.label_name))
           b.label_name, 'ingredient', 'product', false, pg_temp.style(b.style), b.producer, b.abv, b.country, b.gi, pg_temp.maker(b.producer)
      FROM bottle_row b
     WHERE b.id IS NULL AND pg_temp.style(b.style) IS NOT NULL
    RETURNING id, name
)
UPDATE bottle_row r SET id = ins.id FROM ins WHERE r.id IS NULL AND public.ingredient_key(r.label_name) = public.ingredient_key(ins.name);

-- The style each bottle we had files under: the checked one, unless the row
-- already sits under it (a narrower style) or under a place style and the
-- check gave only the catch-all.
ALTER TABLE bottle_row ADD COLUMN style_id uuid;
UPDATE bottle_row b SET style_id = CASE
    WHEN pg_temp.under(b.id, pg_temp.style(b.style)) THEN (SELECT i.generic_id FROM public.items i WHERE i.id = b.id)
    WHEN b.style IN ($q$Salt$q$) AND EXISTS (
         SELECT 1 FROM public.items i JOIN public.items g ON g.id = i.generic_id JOIN place_in p ON public.ingredient_key(p.name) = public.ingredient_key(g.name)
          WHERE i.id = b.id) THEN (SELECT i.generic_id FROM public.items i WHERE i.id = b.id)
    ELSE pg_temp.style(b.style) END
 WHERE b.id IS NOT NULL;

-- Bottles we had: a bottle, its checked style, and what was missing.
UPDATE public.items i SET
    ingredient_role = 'product',
    made_from_id = NULL,
    generic_id = b.style_id,
    brand_maker = COALESCE(NULLIF(btrim(i.brand_maker), ''), b.producer),
    abv = COALESCE(i.abv, b.abv),
    origin_country = COALESCE(i.origin_country, b.country),
    gi = COALESCE(i.gi, b.gi),
    maker_profile_id = COALESCE(i.maker_profile_id, pg_temp.maker(b.producer))
  FROM bottle_row b
 WHERE i.id = b.id AND b.style_id IS NOT NULL
   AND (i.ingredient_role IS DISTINCT FROM 'product' OR i.made_from_id IS NOT NULL
        OR i.generic_id IS DISTINCT FROM b.style_id
        OR (i.abv IS NULL AND b.abv IS NOT NULL) OR (i.origin_country IS NULL AND b.country IS NOT NULL)
        OR (i.gi IS NULL AND b.gi IS NOT NULL) OR (i.maker_profile_id IS NULL AND pg_temp.maker(b.producer) IS NOT NULL)
        OR NULLIF(btrim(i.brand_maker), '') IS NULL);

-- The label name, brand first; the old name stays an alias. Skipped when
-- another shared row already has it.
SET "app.ingredient_merge" = 'on';
CREATE TEMP TABLE "renamed" AS
SELECT DISTINCT ON (b.id) b.id, i.name AS old_name, b.label_name AS new_name
  FROM bottle_row b JOIN public.items i ON i.id = b.id
 WHERE public.ingredient_key(i.name) <> public.ingredient_key(b.label_name)
   AND NOT EXISTS (
       SELECT 1 FROM public.items o
        WHERE o.item_type = 'ingredient' AND o.bar_id IS NULL AND o.id <> b.id
          AND public.ingredient_key(o.name) = public.ingredient_key(b.label_name));
UPDATE public.items i SET name = r.new_name FROM renamed r WHERE i.id = r.id;
DELETE FROM public.ingredient_aliases a USING renamed r WHERE a.key = public.ingredient_key(r.new_name);
INSERT INTO public.ingredient_aliases (key, item_id)
SELECT public.ingredient_key(r.old_name), r.id FROM renamed r
ON CONFLICT (key) DO UPDATE SET item_id = EXCLUDED.item_id;
RESET "app.ingredient_merge";

-- Where each fact was checked.
INSERT INTO public.item_sources (item_id, field, url, kind, checked_on)
SELECT DISTINCT b.id, f.field, b.url, b.kind, DATE '2026-10-09'
  FROM bottle_row b
 CROSS JOIN LATERAL (VALUES ('exists', true), ('name', true), ('style', true), ('maker', true),
                            ('abv', b.abv IS NOT NULL), ('origin', b.country IS NOT NULL), ('gi', b.gi IS NOT NULL)) AS f(field, has)
 WHERE b.id IS NOT NULL AND f.has
ON CONFLICT ON CONSTRAINT "item_sources_one_per_page" DO NOTHING;

-- --- Put the flavour job queue back ---
DELETE FROM "private"."item_flavor_jobs" j
WHERE NOT EXISTS (SELECT 1 FROM "flavor_jobs_before" o WHERE o.item_id = j.item_id);
UPDATE "private"."item_flavor_jobs" j SET
    "status" = o.status, "revision" = o.revision, "attempts" = o.attempts, "run_after" = o.run_after,
    "lease_until" = o.lease_until, "last_error" = o.last_error, "updated_at" = o.updated_at
FROM "flavor_jobs_before" o
WHERE j.item_id = o.item_id AND j.revision <> o.revision;
DROP TABLE "flavor_jobs_before";

DROP TABLE "style_in", "made_now", "place_in", "maker_in", "bottle_in", "bottle_row", "renamed";
DROP FUNCTION pg_temp.shared(text);
DROP FUNCTION pg_temp.style(text);
DROP FUNCTION pg_temp.under(uuid, uuid);
DROP FUNCTION pg_temp.maker(text);
RESET "app.image_worker";
