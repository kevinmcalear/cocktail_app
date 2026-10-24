-- Saison Aperitifs (Melbourne vermouth and amaro maker): the whole range from
-- its own shop, checked 23 Oct 2026 at https://saisonaperitifs.com.
--
--   * One maker name. The maker page and every bottle say "Saison Aperitifs";
--     the page was "Saison" and so were two bottles' labels. The page keeps
--     its handle (saison), so links to it still work, and gains its country.
--   * Four bottles we didn't have: Black Walnut Vermouth, Rabarbaro, Brae
--     Farm Radicchio Amaro (made with Brae restaurant) and the Amaro Tonic
--     tin (made with Mischief Brew). There is no style for a canned drink, so
--     the tin files under Italian spritz, the nearest one.
--   * Spring Rhubarb is on sale, so it shows in search again.
--   * "Saison Sweet Vermouth" (hidden, from Springrock Public Bar's
--     Victorian Negroni) is Saison Red, the brand's only sweet vermouth: it
--     merges into Red, and its name stays as an alias.
--   * Every bottle is from Victoria, Australia, and each fact keeps the
--     product page it was checked on in item_sources.
--
-- "Saison Bitter" (hidden, on Bar Spontana's menu) stays as it is: the menu
-- doesn't say whose it is, and the brand sells nothing by that name.
--
-- No RLS or grant changes. Running it again changes nothing more.

SET "app.image_worker" = 'on';
CREATE TEMP TABLE "flavor_jobs_before" AS SELECT * FROM "private"."item_flavor_jobs";

CREATE FUNCTION pg_temp.style(p_name text) RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT i.id FROM public.items i
     WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL AND i.ingredient_role = 'generic'
       AND public.ingredient_key(i.name) = public.ingredient_key(p_name)
     ORDER BY i.is_core DESC, i.created_at LIMIT 1;
$$;
CREATE FUNCTION pg_temp.shared(p_name text) RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT i.id FROM public.items i
     WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL AND i.ingredient_role = 'product'
       AND public.ingredient_key(i.name) = public.ingredient_key(p_name)
     ORDER BY i.created_at LIMIT 1;
$$;

-- --- The maker page ---
UPDATE public.profiles SET display_name = 'Saison Aperitifs', country_code = 'AU'
 WHERE kind = 'maker' AND handle = 'saison'
   AND (display_name IS DISTINCT FROM 'Saison Aperitifs' OR country_code IS DISTINCT FROM 'AU');

CREATE FUNCTION pg_temp.maker() RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT p.id FROM public.profiles p WHERE p.kind = 'maker' AND p.handle = 'saison';
$$;

-- --- The range ---
CREATE TEMP TABLE bottle_in (
    name text PRIMARY KEY, style text NOT NULL, abv numeric NOT NULL, url text NOT NULL, description text
);
INSERT INTO bottle_in VALUES
($q$Saison Red$q$, $q$Sweet Vermouth$q$, 16.5, $q$https://saisonaperitifs.com/products/red$q$, NULL),
($q$Saison Fallen Quinces$q$, $q$Vermouth$q$, 16, $q$https://saisonaperitifs.com/products/fallen-quinces$q$, NULL),
($q$Saison Spring Rhubarb$q$, $q$Vermouth$q$, 17.5, $q$https://saisonaperitifs.com/products/spring-rhubarb$q$, NULL),
($q$Saison White Flowers$q$, $q$Bianco Vermouth$q$, 17, $q$https://saisonaperitifs.com/products/summer-flowers$q$, NULL),
($q$Saison Artichoke Vin Amaro$q$, $q$Vino Amaro$q$, 20, $q$https://saisonaperitifs.com/products/artichoke-vin-amaro$q$, NULL),
($q$Saison Black Walnut Vermouth$q$, $q$Vermouth$q$, 17, $q$https://saisonaperitifs.com/products/black-walnut-vermouth$q$,
 $q$Vermouth of unripe Victorian walnuts and their leaves with cumquat, bay leaf and barley koji, bittered with Australian wormwood and aged up to 18 months in ex-whisky French oak.$q$),
($q$Saison Rabarbaro$q$, $q$Rabarbaro$q$, 22, $q$https://saisonaperitifs.com/products/rabarbaro$q$,
 $q$Summer release amaro of fresh and slowly dried rhubarb root with cacao husk, green coffee and saffron, bittered with wormwood and gentian and aged two years in ex-red wine French oak.$q$),
($q$Saison Brae Farm Radicchio Amaro$q$, $q$Vino Amaro$q$, 20, $q$https://saisonaperitifs.com/products/brae-farm-radicchio-amaro$q$,
 $q$Amaro made with Brae restaurant from heirloom radicchio grown on its farm, with roasted koji, magnolia, saffron and coriander seed on a Victorian moscato base, bittered with gentian.$q$),
($q$Saison Amaro Tonic$q$, $q$Italian Spritz$q$, 7, $q$https://saisonaperitifs.com/products/amaro-tonic-can$q$,
 $q$Canned spritz made with Mischief Brew: a blood orange amaro with marigold, cumquat and oregano on a moscato base, blended with its own tonic water.$q$);

-- New bottles.
INSERT INTO public.items (name, item_type, ingredient_role, hide_from_search, generic_id, brand_maker, maker_profile_id, abv, origin, origin_country, description)
SELECT b.name, 'ingredient', 'product', false, pg_temp.style(b.style), 'Saison Aperitifs', pg_temp.maker(), b.abv, 'Victoria, Australia', 'AU', b.description
  FROM bottle_in b
 WHERE pg_temp.shared(b.name) IS NULL AND pg_temp.style(b.style) IS NOT NULL;

-- Bottles we had: one maker name, in search, and what was missing.
UPDATE public.items i SET
    brand_maker = 'Saison Aperitifs',
    maker_profile_id = COALESCE(i.maker_profile_id, pg_temp.maker()),
    hide_from_search = false,
    abv = COALESCE(i.abv, b.abv),
    origin = COALESCE(NULLIF(btrim(i.origin), ''), 'Victoria, Australia'),
    origin_country = COALESCE(i.origin_country, 'AU')
  FROM bottle_in b
 WHERE i.id = pg_temp.shared(b.name)
   AND (i.brand_maker IS DISTINCT FROM 'Saison Aperitifs' OR i.maker_profile_id IS NULL OR i.hide_from_search
        OR i.abv IS NULL OR NULLIF(btrim(i.origin), '') IS NULL OR i.origin_country IS NULL);

-- The Victorian Negroni's "Saison sweet vermouth" is Red.
DO $$
DECLARE
    v_from uuid := (SELECT i.id FROM public.items i
                     WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL
                       AND public.ingredient_key(i.name) = public.ingredient_key('Saison Sweet Vermouth') LIMIT 1);
    v_into uuid := pg_temp.shared('Saison Red');
BEGIN
    IF v_from IS NOT NULL AND v_into IS NOT NULL AND v_from <> v_into THEN
        PERFORM private.merge_ingredient(v_from, v_into);
    END IF;
END;
$$;

-- Where each fact was checked.
INSERT INTO public.item_sources (item_id, field, url, kind, checked_on)
SELECT pg_temp.shared(b.name), f.field, b.url, 'producer', DATE '2026-10-23'
  FROM bottle_in b
 CROSS JOIN (VALUES ('exists'), ('name'), ('style'), ('maker'), ('abv'), ('origin')) AS f(field)
 WHERE pg_temp.shared(b.name) IS NOT NULL
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

DROP TABLE "bottle_in";
DROP FUNCTION pg_temp.style(text);
DROP FUNCTION pg_temp.shared(text);
DROP FUNCTION pg_temp.maker();
RESET "app.image_worker";
