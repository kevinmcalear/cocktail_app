-- Cocktail garnishes: every bottle checked on its producer's own page (or,
-- where that page was blocked, a major retailer, importer or Difford's),
-- after 20261011170000. Step 3n of the bottle catalog plan:
-- https://claude.ai/artifact/Vu6seuSNtN42nKYb2nDCVR
--
--   * Packaged cocktail garnishes: cherries, olives and olive brine,
--     cocktail onions, rimming salts and sugars, candied ginger,
--     dried-fruit garnishes and packaged edible flowers.
--   * On a copy of production (2026-10-09, with the loads before this
--     one applied): 114 new bottles, and 10 we had that get their label
--     name (5 renamed, the old name kept as an alias), style, ABV,
--     country, protected name and maker where they were missing or
--     wrong.
--   * Styles: Maraschino, amarena and other cocktail cherries, green,
--     Castelvetrano and gordal olives, olive brine, cocktail onions,
--     chilli, flake, smoked and celery salt, sugar rims, candied
--     ginger, dried fruit and edible flowers. No new styles.
--   * Out of scope: fresh produce, garnish tools, syrups.
--   * Each producer gets an unclaimed maker page (makes: bottles), or a
--     page an earlier load made gains it, and each bottle names it.
--   * Every fact keeps the page it was checked on in item_sources. An
--     ABV read off another page isn't kept, and a review site isn't a
--     source.
--   * An independent second check of 100 random rows found 0 wrong
--     facts in 355 (0.0%). Every correction is taken: none needed. The
--     Cocktail Garnish's fruit, whose dried form came from our notes
--     rather than its page, is held back.
--
-- Matched by name key; rows that don't exist are skipped and a second run
-- changes nothing more. Venue ingredients, styles and house preps aren't
-- touched.


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
($q$Cocktail Garnish Co.$q$, $q$cocktail.garnish.co$q$, $q$https://cocktailgarnishco.com/$q$, $q$US$q$, NULL),
($q$Convenient Cocktail Co.$q$, $q$convenient.cocktail.co$q$, $q$https://www.convenientcocktail.com/$q$, NULL, NULL),
($q$Dirty Sue$q$, $q$dirty.sue$q$, $q$https://dirtysue.com/$q$, NULL, NULL),
($q$Fabbri$q$, $q$fabbri$q$, $q$https://www.fabbri1905.com/$q$, $q$IT$q$, NULL),
($q$Filthy$q$, $q$filthy$q$, $q$https://filthyfood.com/$q$, NULL, NULL),
($q$Garnish Game$q$, $q$garnish.game$q$, $q$https://www.garnishgame.com.au/$q$, $q$AU$q$, NULL),
($q$Griottines$q$, $q$griottines$q$, $q$https://www.distilleriespeureux.com/$q$, $q$FR$q$, NULL),
($q$Luxardo$q$, $q$luxardo$q$, $q$https://www.luxardo.it/$q$, $q$IT$q$, NULL),
($q$Maldon$q$, $q$maldon$q$, $q$https://maldonsalt.com/$q$, $q$GB$q$, NULL),
($q$Mario$q$, $q$mario$q$, $q$https://mariocamachofoods.com/$q$, $q$ES$q$, NULL),
($q$Mezzetta$q$, $q$mezzetta$q$, $q$https://www.mezzetta.com/$q$, $q$ES$q$, NULL),
($q$Perelló$q$, $q$perello$q$, NULL, $q$ES$q$, NULL),
($q$Preserved Peel$q$, $q$preserved.peel$q$, $q$https://preservedpeel.com/$q$, NULL, NULL),
($q$Speakeasy$q$, $q$speakeasy$q$, $q$https://www.speakeasygarnishes.com/$q$, NULL, NULL),
($q$Starlino$q$, $q$starlino$q$, $q$https://starlinocherries.com/$q$, NULL, NULL),
($q$Tajín$q$, $q$tajin$q$, $q$https://www.tajin.com/$q$, $q$MX$q$, NULL),
($q$The Cocktail Garnish$q$, $q$the.cocktail.garnish$q$, $q$https://www.thecocktailgarnish.com/$q$, $q$US$q$, NULL),
($q$Traverse City Whiskey Co.$q$, $q$traverse.city.whiskey.co$q$, $q$https://www.tcwhiskey.com/$q$, $q$US$q$, NULL),
($q$Woodford Reserve$q$, $q$woodford.reserve$q$, $q$https://www.woodfordreserve.com/$q$, NULL, NULL);

-- A page per producer, unclaimed, public. A handle someone already uses is
-- left alone (that producer's bottles then name no maker).
INSERT INTO public.profiles (kind, handle, display_name, website, country_code, makes, is_public)
SELECT 'maker', m.handle, m.name, m.website, m.country, ARRAY['bottles'], true
  FROM maker_in m
 WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.handle = m.handle)
   AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.kind = 'maker' AND lower(p.display_name) = lower(m.name));

CREATE FUNCTION pg_temp.maker(p_name text) RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT p.id FROM public.profiles p WHERE p.kind = 'maker' AND lower(p.display_name) = lower(p_name) LIMIT 1;
$$;

-- A maker page made by an earlier load that now makes bottles here too.
UPDATE public.profiles p SET makes = array_append(p.makes, 'bottles')
  FROM maker_in m
 WHERE p.id = pg_temp.maker(m.name) AND NOT ('bottles' = ANY (p.makes));

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
($q$Cocktail Garnish Co. Blood Orange Pink Salt Rimmer$q$, NULL, $q$Salt$q$, $q$Cocktail Garnish Co.$q$, NULL, $q$US$q$, NULL, $q$https://cocktailgarnishco.com/products/blood-orange-pink-salt-cocktail-rimmer$q$, $q$producer$q$),
($q$Cocktail Garnish Co. Coarse Sea Salt Rimmer$q$, NULL, $q$Salt$q$, $q$Cocktail Garnish Co.$q$, NULL, $q$US$q$, NULL, $q$https://cocktailgarnishco.com/products/coarse-sea-salt-rimmer-6oz-margarita-salt$q$, $q$producer$q$),
($q$Cocktail Garnish Co. Dried Apple Slices$q$, NULL, $q$Dried Fruit$q$, $q$Cocktail Garnish Co.$q$, NULL, $q$US$q$, NULL, $q$https://cocktailgarnishco.com/products/dried-apple-slices-cocktail-garnish$q$, $q$producer$q$),
($q$Cocktail Garnish Co. Dried Blood Orange Slices$q$, NULL, $q$Dried Fruit$q$, $q$Cocktail Garnish Co.$q$, NULL, $q$US$q$, NULL, $q$https://cocktailgarnishco.com/products/dried-blood-orange-slices-cocktail-garnish$q$, $q$producer$q$),
($q$Cocktail Garnish Co. Dried Grapefruit Slices$q$, NULL, $q$Dried Fruit$q$, $q$Cocktail Garnish Co.$q$, NULL, $q$US$q$, NULL, $q$https://cocktailgarnishco.com/products/dried-grapefruit-slices-cocktail-garnish$q$, $q$producer$q$),
($q$Cocktail Garnish Co. Dried Green Pear Slices$q$, NULL, $q$Dried Fruit$q$, $q$Cocktail Garnish Co.$q$, NULL, $q$US$q$, NULL, $q$https://cocktailgarnishco.com/products/dried-green-pear-slices-for-cocktail-garnishes-2oz-bag-premium-dehydrated-green-pear$q$, $q$producer$q$),
($q$Cocktail Garnish Co. Dried Hibiscus Flowers$q$, NULL, $q$Edible flower$q$, $q$Cocktail Garnish Co.$q$, NULL, $q$US$q$, NULL, $q$https://cocktailgarnishco.com/products/dried-hibiscus-flowers-cocktail-garnish$q$, $q$producer$q$),
($q$Cocktail Garnish Co. Dried Lemon Slices$q$, NULL, $q$Dried Fruit$q$, $q$Cocktail Garnish Co.$q$, NULL, $q$US$q$, NULL, $q$https://cocktailgarnishco.com/products/dried-lemon-slices-cocktail-garnish$q$, $q$producer$q$),
($q$Cocktail Garnish Co. Dried Lime Slices$q$, NULL, $q$Dried Fruit$q$, $q$Cocktail Garnish Co.$q$, NULL, $q$US$q$, NULL, $q$https://cocktailgarnishco.com/products/dried-lime-slices-cocktail-garnish$q$, $q$producer$q$),
($q$Cocktail Garnish Co. Dried Orange Slices$q$, NULL, $q$Dried Fruit$q$, $q$Cocktail Garnish Co.$q$, NULL, $q$US$q$, NULL, $q$https://cocktailgarnishco.com/products/dried-orange-slices-cocktail-garnish$q$, $q$producer$q$),
($q$Cocktail Garnish Co. Dried Pineapple Slices$q$, NULL, $q$Dried Fruit$q$, $q$Cocktail Garnish Co.$q$, NULL, $q$US$q$, NULL, $q$https://cocktailgarnishco.com/products/dried-pineapple-slices-cocktail-garnish$q$, $q$producer$q$),
($q$Cocktail Garnish Co. Dried Rose Petals$q$, NULL, $q$Edible flower$q$, $q$Cocktail Garnish Co.$q$, NULL, $q$US$q$, NULL, $q$https://cocktailgarnishco.com/products/dried-rose-petals-buds-cocktail-garnish$q$, $q$producer$q$),
($q$Cocktail Garnish Co. Real Candied Ginger Slices$q$, NULL, $q$Candied Ginger$q$, $q$Cocktail Garnish Co.$q$, NULL, $q$US$q$, NULL, $q$https://cocktailgarnishco.com/products/real-candied-ginger-slices-i-yellow$q$, $q$producer$q$),
($q$Cocktail Garnish Co. Rose Petal and Sugar Rimmer$q$, NULL, $q$Sugar Rim$q$, $q$Cocktail Garnish Co.$q$, NULL, $q$US$q$, NULL, $q$https://cocktailgarnishco.com/products/rose-petal-and-sugar-rimmer-6oz-margarita-and-cocktail-sugar$q$, $q$producer$q$),
($q$Cocktail Garnish Co. Strawberry Sugar Rimmer$q$, NULL, $q$Sugar Rim$q$, $q$Cocktail Garnish Co.$q$, NULL, $q$US$q$, NULL, $q$https://cocktailgarnishco.com/products/strawberry-sugar-for-rimming-6oz-margarita-sugar$q$, $q$producer$q$),
($q$Convenient Cocktail Co. Dehydrated Apple$q$, NULL, $q$Dried Fruit$q$, $q$Convenient Cocktail Co.$q$, NULL, NULL, NULL, $q$https://www.convenientcocktail.com/store$q$, $q$producer$q$),
($q$Convenient Cocktail Co. Dehydrated Grapefruit$q$, NULL, $q$Dried Fruit$q$, $q$Convenient Cocktail Co.$q$, NULL, NULL, NULL, $q$https://www.convenientcocktail.com/store$q$, $q$producer$q$),
($q$Convenient Cocktail Co. Dehydrated Lemon$q$, NULL, $q$Dried Fruit$q$, $q$Convenient Cocktail Co.$q$, NULL, NULL, NULL, $q$https://www.convenientcocktail.com/store$q$, $q$producer$q$),
($q$Convenient Cocktail Co. Dehydrated Lime$q$, NULL, $q$Dried Fruit$q$, $q$Convenient Cocktail Co.$q$, NULL, NULL, NULL, $q$https://www.convenientcocktail.com/store$q$, $q$producer$q$),
($q$Convenient Cocktail Co. Dehydrated Orange$q$, NULL, $q$Dried Fruit$q$, $q$Convenient Cocktail Co.$q$, NULL, NULL, NULL, $q$https://www.convenientcocktail.com/store$q$, $q$producer$q$),
($q$Convenient Cocktail Co. Dehydrated Pineapple Half-Moons$q$, NULL, $q$Dried Fruit$q$, $q$Convenient Cocktail Co.$q$, NULL, NULL, NULL, $q$https://www.convenientcocktail.com/store$q$, $q$producer$q$),
($q$Convenient Cocktail Co. Dehydrated Pineapple Quarter-Moons$q$, NULL, $q$Dried Fruit$q$, $q$Convenient Cocktail Co.$q$, NULL, NULL, NULL, $q$https://www.convenientcocktail.com/store$q$, $q$producer$q$),
($q$Convenient Cocktail Co. Dehydrated Scarlet Apple$q$, NULL, $q$Dried Fruit$q$, $q$Convenient Cocktail Co.$q$, NULL, NULL, NULL, $q$https://www.convenientcocktail.com/store$q$, $q$producer$q$),
($q$Convenient Cocktail Co. Dehydrated Scarlet Pineapple Full-Moons$q$, NULL, $q$Dried Fruit$q$, $q$Convenient Cocktail Co.$q$, NULL, NULL, NULL, $q$https://www.convenientcocktail.com/store$q$, $q$producer$q$),
($q$Convenient Cocktail Co. Dehydrated Scarlet Pineapple Half-Moons$q$, NULL, $q$Dried Fruit$q$, $q$Convenient Cocktail Co.$q$, NULL, NULL, NULL, $q$https://www.convenientcocktail.com/store$q$, $q$producer$q$),
($q$Convenient Cocktail Co. Dehydrated Scarlet Pineapple Quarter-Moons$q$, NULL, $q$Dried Fruit$q$, $q$Convenient Cocktail Co.$q$, NULL, NULL, NULL, $q$https://www.convenientcocktail.com/store$q$, $q$producer$q$),
($q$Dirty Sue Blue Cheese Stuffed Olives$q$, NULL, $q$Green Olive$q$, $q$Dirty Sue$q$, NULL, NULL, NULL, $q$https://dirtysue.com/collections/all$q$, $q$producer$q$),
($q$Dirty Sue Blue Hots$q$, NULL, $q$Green Olive$q$, $q$Dirty Sue$q$, NULL, NULL, NULL, $q$https://dirtysue.com/collections/all$q$, $q$producer$q$),
($q$Dirty Sue Cocktail Olives$q$, NULL, $q$Green Olive$q$, $q$Dirty Sue$q$, NULL, NULL, NULL, $q$https://dirtysue.com/products/pimento-stuffed-cocktail-olives-16oz$q$, $q$producer$q$),
($q$Dirty Sue Cowboy Olives$q$, NULL, $q$Green Olive$q$, $q$Dirty Sue$q$, NULL, NULL, NULL, $q$https://dirtysue.com/collections/all$q$, $q$producer$q$),
($q$Dirty Sue Garlic Stuffed Olives$q$, NULL, $q$Green Olive$q$, $q$Dirty Sue$q$, NULL, NULL, NULL, $q$https://dirtysue.com/collections/all$q$, $q$producer$q$),
($q$Dirty Sue Green Dots$q$, NULL, $q$Cocktail Onion$q$, $q$Dirty Sue$q$, NULL, NULL, NULL, $q$https://dirtysue.com/collections/all$q$, $q$producer$q$),
($q$Dirty Sue Jalapeño Stuffed Olives$q$, NULL, $q$Green Olive$q$, $q$Dirty Sue$q$, NULL, NULL, NULL, $q$https://dirtysue.com/collections/all$q$, $q$producer$q$),
($q$Dirty Sue Jumbo Cocktail Onions$q$, NULL, $q$Cocktail Onion$q$, $q$Dirty Sue$q$, NULL, NULL, NULL, $q$https://dirtysue.com/collections/all$q$, $q$producer$q$),
($q$Dirty Sue Pepperoncini Stuffed Olives$q$, NULL, $q$Green Olive$q$, $q$Dirty Sue$q$, NULL, NULL, NULL, $q$https://dirtysue.com/collections/all$q$, $q$producer$q$),
($q$Dirty Sue Premium Olive Juice$q$, $q$Dirty Sue Premium Olive Juice$q$, $q$Olive Brine$q$, $q$Dirty Sue$q$, NULL, NULL, NULL, $q$https://dirtysue.com/collections/all?page=2$q$, $q$producer$q$),
($q$Dirty Sue Whiskey Cherries$q$, NULL, $q$Cherry$q$, $q$Dirty Sue$q$, NULL, NULL, NULL, $q$https://dirtysue.com/collections/all$q$, $q$producer$q$),
($q$Fabbri Amarena Cherries$q$, $q$Fabbri Amarena Cherries$q$, $q$Amarena Cherry$q$, $q$Fabbri$q$, NULL, $q$IT$q$, NULL, $q$https://en.fabbri1905.com/consumers/all-products/?sg=6AC968C0GaHx6qkC7ny42TzR_hZbqJTmujcg6A3IXLWBQHSdtKdU&tag=17184$q$, $q$producer$q$),
($q$Fabbri Zenzero$q$, NULL, $q$Candied Ginger$q$, $q$Fabbri$q$, NULL, $q$IT$q$, NULL, $q$https://en.fabbri1905.com/consumers/zenzero-fabbri/$q$, $q$producer$q$),
($q$Filthy Black Cherries$q$, $q$Filthy Black Amarena Style Cherries$q$, $q$Amarena Cherry$q$, $q$Filthy$q$, NULL, NULL, NULL, $q$https://filthyfood.com/products/black-cherries$q$, $q$producer$q$),
($q$Filthy Blue Cheese Olives$q$, NULL, $q$Green Olive$q$, $q$Filthy$q$, NULL, NULL, NULL, $q$https://filthyfood.com/products/blue-cheese-olives$q$, $q$producer$q$),
($q$Filthy Cocktail Onions$q$, NULL, $q$Cocktail Onion$q$, $q$Filthy$q$, NULL, NULL, NULL, $q$https://filthyfood.com/products/cocktail-onions$q$, $q$producer$q$),
($q$Filthy Olive Brine$q$, $q$Filthy Olive Brine$q$, $q$Olive Brine$q$, $q$Filthy$q$, NULL, NULL, NULL, $q$https://filthyfood.com/products/olive-brine$q$, $q$producer$q$),
($q$Filthy Pepper$q$, NULL, $q$Green Olive$q$, $q$Filthy$q$, NULL, NULL, NULL, $q$https://filthyfood.com/products/filthy-pepper$q$, $q$producer$q$),
($q$Filthy Pickle$q$, NULL, $q$Green Olive$q$, $q$Filthy$q$, NULL, NULL, NULL, $q$https://filthyfood.com/products/filthy-pickle$q$, $q$producer$q$),
($q$Filthy Pimento Olives$q$, NULL, $q$Green Olive$q$, $q$Filthy$q$, NULL, NULL, NULL, $q$https://filthyfood.com/products/pimento-olives$q$, $q$producer$q$),
($q$Filthy Pitted Olives$q$, $q$Filthy Pitted Olive$q$, $q$Green Olive$q$, $q$Filthy$q$, NULL, NULL, NULL, $q$https://filthyfood.com/products/pitted-olives$q$, $q$producer$q$),
($q$Filthy Red Cherries$q$, NULL, $q$Maraschino Cherry$q$, $q$Filthy$q$, NULL, NULL, NULL, $q$https://filthyfood.com/products/red-cherries$q$, $q$producer$q$),
($q$Garnish Game Dehydrated Apple Rings$q$, NULL, $q$Dried Fruit$q$, $q$Garnish Game$q$, NULL, $q$AU$q$, NULL, $q$https://www.garnishgame.com.au/shop$q$, $q$producer$q$),
($q$Garnish Game Dehydrated Blood Orange Cocktail Garnishes$q$, NULL, $q$Dried Fruit$q$, $q$Garnish Game$q$, NULL, $q$AU$q$, NULL, $q$https://www.garnishgame.com.au/shop/p/dehydrated-blood-orange-cocktail-garnishes$q$, $q$producer$q$),
($q$Garnish Game Dehydrated Lemon Cocktail Garnishes$q$, NULL, $q$Dried Fruit$q$, $q$Garnish Game$q$, NULL, $q$AU$q$, NULL, $q$https://www.garnishgame.com.au/shop/p/dehydrated-lemon-cocktail-garnishes$q$, $q$producer$q$),
($q$Garnish Game Dehydrated Lime Cocktail Garnishes$q$, NULL, $q$Dried Fruit$q$, $q$Garnish Game$q$, NULL, $q$AU$q$, NULL, $q$https://www.garnishgame.com.au/shop/p/dehydrated-lime-cocktail-garnish$q$, $q$producer$q$),
($q$Garnish Game Dehydrated Orange Cocktail Garnishes$q$, NULL, $q$Dried Fruit$q$, $q$Garnish Game$q$, NULL, $q$AU$q$, NULL, $q$https://www.garnishgame.com.au/shop/p/dehydrated-orange-cocktail-garnishes$q$, $q$producer$q$),
($q$Garnish Game Dehydrated Pineapple Rings$q$, NULL, $q$Dried Fruit$q$, $q$Garnish Game$q$, NULL, $q$AU$q$, NULL, $q$https://www.garnishgame.com.au/shop$q$, $q$producer$q$),
($q$Garnish Game Dehydrated Pink Grapefruit Cocktail Garnishes$q$, NULL, $q$Dried Fruit$q$, $q$Garnish Game$q$, NULL, $q$AU$q$, NULL, $q$https://www.garnishgame.com.au/shop$q$, $q$producer$q$),
($q$Garnish Game Fancy Floral Sugar$q$, NULL, $q$Sugar Rim$q$, $q$Garnish Game$q$, NULL, $q$AU$q$, NULL, $q$https://www.garnishgame.com.au/shop/p/fancy-floral-cocktail-sugar-rim$q$, $q$producer$q$),
($q$Garnish Game Floral Cocktail Salt$q$, NULL, $q$Salt$q$, $q$Garnish Game$q$, NULL, $q$AU$q$, NULL, $q$https://www.garnishgame.com.au/shop$q$, $q$producer$q$),
($q$Garnish Game Freeze Dried Raspberry Crumble$q$, NULL, $q$Dried Fruit$q$, $q$Garnish Game$q$, NULL, $q$AU$q$, NULL, $q$https://www.garnishgame.com.au/shop/p/freeze-dried-raspberry-diced-crumble$q$, $q$producer$q$),
($q$Garnish Game Margarita Chilli Salt$q$, NULL, $q$Chilli Salt$q$, $q$Garnish Game$q$, NULL, $q$AU$q$, NULL, $q$https://www.garnishgame.com.au/shop/p/chilli-salt-margarita-cocktail-rim$q$, $q$producer$q$),
($q$Garnish Game Midnight Floral Confetti$q$, NULL, $q$Edible flower$q$, $q$Garnish Game$q$, NULL, $q$AU$q$, NULL, $q$https://www.garnishgame.com.au/shop/p/midnight-edible-dried-flowers-cocktail-confetti$q$, $q$producer$q$),
($q$Garnish Game Sunset Cocktail Confetti$q$, NULL, $q$Edible flower$q$, $q$Garnish Game$q$, NULL, $q$AU$q$, NULL, $q$https://www.garnishgame.com.au/shop$q$, $q$producer$q$),
($q$Garnish Game Zesty Citrus Cocktail Salt$q$, NULL, $q$Salt$q$, $q$Garnish Game$q$, NULL, $q$AU$q$, NULL, $q$https://www.garnishgame.com.au/shop$q$, $q$producer$q$),
($q$Garnish Game Zesty Citrus Sugar$q$, NULL, $q$Sugar Rim$q$, $q$Garnish Game$q$, NULL, $q$AU$q$, NULL, $q$https://www.garnishgame.com.au/shop$q$, $q$producer$q$),
($q$Griottines La Bleue$q$, NULL, $q$Cherry$q$, $q$Griottines$q$, 15, $q$FR$q$, NULL, $q$https://www.distilleriespeureux.com/griottines-la-bleue$q$, $q$producer$q$),
($q$Griottines Original$q$, NULL, $q$Cherry$q$, $q$Griottines$q$, 15, $q$FR$q$, NULL, $q$https://www.distilleriespeureux.com/griottinesr-original-35cl$q$, $q$producer$q$),
($q$Luxardo Original Maraschino Cherries$q$, $q$Luxardo Original Maraschino Cherries$q$, $q$Maraschino Cherry$q$, $q$Luxardo$q$, NULL, $q$IT$q$, NULL, $q$https://www.luxardo.it/liqueurs-and-distillates/original-maraschino-cherries/$q$, $q$producer$q$),
($q$Maldon Chilli Sea Salt Flakes$q$, NULL, $q$Chilli Salt$q$, $q$Maldon$q$, NULL, $q$GB$q$, NULL, $q$https://maldonsalt.com/our-salt/$q$, $q$producer$q$),
($q$Maldon Garlic Sea Salt Flakes$q$, NULL, $q$Flake Salt$q$, $q$Maldon$q$, NULL, $q$GB$q$, NULL, $q$https://maldonsalt.com/our-salt/$q$, $q$producer$q$),
($q$Maldon Himalayan Pink Salt$q$, NULL, $q$Salt$q$, $q$Maldon$q$, NULL, NULL, NULL, $q$https://maldonsalt.com/our-salt/$q$, $q$producer$q$),
($q$Maldon Kalahari Desert Salt$q$, NULL, $q$Salt$q$, $q$Maldon$q$, NULL, NULL, NULL, $q$https://maldonsalt.com/our-salt/$q$, $q$producer$q$),
($q$Maldon Pepper Sea Salt Flakes$q$, NULL, $q$Flake Salt$q$, $q$Maldon$q$, NULL, $q$GB$q$, NULL, $q$https://maldonsalt.com/our-salt/$q$, $q$producer$q$),
($q$Maldon Sea Salt Flakes$q$, $q$Maldon Sea Salt Flakes$q$, $q$Flake Salt$q$, $q$Maldon$q$, NULL, $q$GB$q$, NULL, $q$https://maldonsalt.com/us/product/sea-salt-flakes-250g/$q$, $q$producer$q$),
($q$Maldon Smoked Sea Salt Flakes$q$, NULL, $q$Smoked Salt$q$, $q$Maldon$q$, NULL, $q$GB$q$, NULL, $q$https://maldonsalt.com/us/$q$, $q$producer$q$),
($q$Mario Bleu Cheese Stuffed Olives$q$, NULL, $q$Green Olive$q$, $q$Mario$q$, NULL, NULL, NULL, $q$https://mariocamachofoods.com/index.php/product-category/authentic-olives-stuffed-whole-more-mario-foods/page/4/$q$, $q$producer$q$),
($q$Mario Castelvetrano Pitted Olives$q$, NULL, $q$Castelvetrano Olive$q$, $q$Mario$q$, NULL, NULL, NULL, $q$https://mariocamachofoods.com/index.php/product-category/authentic-olives-stuffed-whole-more-mario-foods/page/3/$q$, $q$producer$q$),
($q$Mario Castelvetrano Whole Olives$q$, NULL, $q$Castelvetrano Olive$q$, $q$Mario$q$, NULL, NULL, NULL, $q$https://mariocamachofoods.com/index.php/product-category/authentic-olives-stuffed-whole-more-mario-foods/page/4/$q$, $q$producer$q$),
($q$Mario Dirty Martini Mix Olive Juice$q$, NULL, $q$Olive Brine$q$, $q$Mario$q$, NULL, NULL, NULL, $q$https://mariocamachofoods.com/index.php/product/12-7oz-dirty-martini-mix-olive-juice-mario-cocktail-mixer/$q$, $q$producer$q$),
($q$Mario Garlic Stuffed Olives$q$, NULL, $q$Green Olive$q$, $q$Mario$q$, NULL, NULL, NULL, $q$https://mariocamachofoods.com/index.php/product-category/authentic-olives-stuffed-whole-more-mario-foods/page/4/$q$, $q$producer$q$),
($q$Mario Jalapeño Stuffed Olives$q$, NULL, $q$Green Olive$q$, $q$Mario$q$, NULL, NULL, NULL, $q$https://mariocamachofoods.com/index.php/product-category/authentic-olives-stuffed-whole-more-mario-foods/page/4/$q$, $q$producer$q$),
($q$Mario Maraschino Cherries with Stems$q$, NULL, $q$Maraschino Cherry$q$, $q$Mario$q$, NULL, NULL, NULL, $q$https://mariocamachofoods.com/index.php/product/10oz-maraschino-cherries-with-stems-mario-dessert-topping/$q$, $q$producer$q$),
($q$Mario Organic Pimiento Stuffed Olives$q$, NULL, $q$Green Olive$q$, $q$Mario$q$, NULL, NULL, NULL, $q$https://mariocamachofoods.com/index.php/product-category/authentic-olives-stuffed-whole-more-mario-foods/page/4/$q$, $q$producer$q$),
($q$Mario Pimiento Stuffed Spanish Manzanilla Olives$q$, $q$Mario Stuffed Manzanilla Olives$q$, $q$Green Olive$q$, $q$Mario$q$, NULL, $q$ES$q$, NULL, $q$https://mariocamachofoods.com/index.php/product/10oz-pimiento-stuffed-spanish-manzanilla-olives-mario-olives/$q$, $q$producer$q$),
($q$Mario Queen Pimiento Stuffed Spanish Olives$q$, NULL, $q$Green Olive$q$, $q$Mario$q$, NULL, NULL, NULL, $q$https://mariocamachofoods.com/index.php/product-category/authentic-olives-stuffed-whole-more-mario-foods/page/2/$q$, $q$producer$q$),
($q$Mario Reduced Sodium Pimiento Stuffed Olives$q$, NULL, $q$Green Olive$q$, $q$Mario$q$, NULL, NULL, NULL, $q$https://mariocamachofoods.com/index.php/product-category/authentic-olives-stuffed-whole-more-mario-foods/page/4/$q$, $q$producer$q$),
($q$Mezzetta Bleu Cheese Stuffed Olives$q$, NULL, $q$Green Olive$q$, $q$Mezzetta$q$, NULL, NULL, NULL, $q$https://www.mezzetta.com/products/bleu-cheese-stuffed-olives$q$, $q$producer$q$),
($q$Mezzetta Fancy Colossal Green Olives$q$, NULL, $q$Green Olive$q$, $q$Mezzetta$q$, NULL, NULL, NULL, $q$https://www.mezzetta.com/products/fancy-colossal-green-olives$q$, $q$producer$q$),
($q$Mezzetta Feta Cheese Stuffed Olives$q$, NULL, $q$Green Olive$q$, $q$Mezzetta$q$, NULL, NULL, NULL, $q$https://www.mezzetta.com/products/greek-style-feta-cheese-stuffed-olives$q$, $q$producer$q$),
($q$Mezzetta Garlic Stuffed Olives$q$, NULL, $q$Green Olive$q$, $q$Mezzetta$q$, NULL, NULL, NULL, $q$https://www.mezzetta.com/products/garlic-stuffed-olives$q$, $q$producer$q$),
($q$Mezzetta Imported Spanish Queen Martini Olives$q$, NULL, $q$Gordal Olive$q$, $q$Mezzetta$q$, NULL, $q$ES$q$, NULL, $q$https://www.mezzetta.com/products/spanish-queen-martini-olives-marinated-in-dry-vermouth$q$, $q$producer$q$),
($q$Mezzetta Jalapeño Stuffed Olives$q$, NULL, $q$Green Olive$q$, $q$Mezzetta$q$, NULL, NULL, NULL, $q$https://www.mezzetta.com/products/jalapea-o-stuffed-olives$q$, $q$producer$q$),
($q$Mezzetta Pitted Italian Castelvetrano Olives$q$, NULL, $q$Castelvetrano Olive$q$, $q$Mezzetta$q$, NULL, $q$IT$q$, NULL, $q$https://www.mezzetta.com/products/pitted-castelvetrano-italian-olives$q$, $q$producer$q$),
($q$Mezzetta Super Colossal Spanish Queen Olives Pimiento Stuffed$q$, NULL, $q$Gordal Olive$q$, $q$Mezzetta$q$, NULL, $q$ES$q$, NULL, $q$https://www.mezzetta.com/products/super-colossal-spanish-queen-olives-pimento-stuffed$q$, $q$producer$q$),
($q$Mezzetta Super Colossal Spanish Queen Whole Olives$q$, NULL, $q$Gordal Olive$q$, $q$Mezzetta$q$, NULL, $q$ES$q$, NULL, $q$https://www.mezzetta.com/pages/olives$q$, $q$producer$q$),
($q$Mezzetta Whole Italian Castelvetrano Olives$q$, NULL, $q$Castelvetrano Olive$q$, $q$Mezzetta$q$, NULL, $q$IT$q$, NULL, $q$https://www.mezzetta.com/products/whole-italian-castelvetrano-olives$q$, $q$producer$q$),
($q$Perelló Gordal Spicy Pitted Olives$q$, $q$Perello olive (gordal picante)$q$, $q$Gordal Olive$q$, $q$Perelló$q$, NULL, $q$ES$q$, NULL, $q$https://brindisa.com/products/perello-discovery-box$q$, $q$retailer$q$),
($q$Perelló Manzanilla Spicy Pitted Olives$q$, NULL, $q$Green Olive$q$, $q$Perelló$q$, NULL, $q$ES$q$, NULL, $q$https://brindisa.com/products/perello-discovery-box$q$, $q$retailer$q$),
($q$Preserved Peel Basil Sugar Rim$q$, NULL, $q$Sugar Rim$q$, $q$Preserved Peel$q$, NULL, NULL, NULL, $q$https://preservedpeel.com/collections/all$q$, $q$producer$q$),
($q$Preserved Peel Blue Sugar Rim$q$, NULL, $q$Sugar Rim$q$, $q$Preserved Peel$q$, NULL, NULL, NULL, $q$https://preservedpeel.com/collections/all$q$, $q$producer$q$),
($q$Preserved Peel Dried Apple Slices$q$, NULL, $q$Dried Fruit$q$, $q$Preserved Peel$q$, NULL, NULL, NULL, $q$https://preservedpeel.com/collections/premium-dehydrated-cocktail-garnishes-1$q$, $q$producer$q$),
($q$Preserved Peel Dried Blood-Orange Slices$q$, NULL, $q$Dried Fruit$q$, $q$Preserved Peel$q$, NULL, NULL, NULL, $q$https://preservedpeel.com/collections/premium-dehydrated-cocktail-garnishes-1$q$, $q$producer$q$),
($q$Preserved Peel Dried Dragon Fruit Slices$q$, NULL, $q$Dried Fruit$q$, $q$Preserved Peel$q$, NULL, NULL, NULL, $q$https://preservedpeel.com/collections/premium-dehydrated-cocktail-garnishes-1$q$, $q$producer$q$),
($q$Preserved Peel Dried Flower Mix Petal Sprinkles$q$, NULL, $q$Edible flower$q$, $q$Preserved Peel$q$, NULL, NULL, NULL, $q$https://preservedpeel.com/collections/all$q$, $q$producer$q$),
($q$Preserved Peel Dried Grapefruit Slices$q$, NULL, $q$Dried Fruit$q$, $q$Preserved Peel$q$, NULL, NULL, NULL, $q$https://preservedpeel.com/collections/premium-dehydrated-cocktail-garnishes-1$q$, $q$producer$q$),
($q$Preserved Peel Dried Lemon Slices$q$, NULL, $q$Dried Fruit$q$, $q$Preserved Peel$q$, NULL, NULL, NULL, $q$https://preservedpeel.com/collections/premium-dehydrated-cocktail-garnishes-1$q$, $q$producer$q$),
($q$Preserved Peel Dried Lime Slices$q$, NULL, $q$Dried Fruit$q$, $q$Preserved Peel$q$, NULL, NULL, NULL, $q$https://preservedpeel.com/collections/premium-dehydrated-cocktail-garnishes-1$q$, $q$producer$q$),
($q$Preserved Peel Dried Orange Slices$q$, NULL, $q$Dried Fruit$q$, $q$Preserved Peel$q$, NULL, NULL, NULL, $q$https://preservedpeel.com/collections/premium-dehydrated-cocktail-garnishes-1$q$, $q$producer$q$),
($q$Preserved Peel Dried Pears Slices$q$, NULL, $q$Dried Fruit$q$, $q$Preserved Peel$q$, NULL, NULL, NULL, $q$https://preservedpeel.com/collections/premium-dehydrated-cocktail-garnishes-1$q$, $q$producer$q$),
($q$Preserved Peel Strawberry Sugar Rim$q$, NULL, $q$Sugar Rim$q$, $q$Preserved Peel$q$, NULL, NULL, NULL, $q$https://preservedpeel.com/collections/all$q$, $q$producer$q$),
($q$Speakeasy Dehydrated Blood Orange Slices$q$, NULL, $q$Dried Fruit$q$, $q$Speakeasy$q$, NULL, NULL, NULL, $q$https://www.speakeasygarnishes.com/collections/all$q$, $q$producer$q$),
($q$Speakeasy Dehydrated Lemon Slices$q$, NULL, $q$Dried Fruit$q$, $q$Speakeasy$q$, NULL, NULL, NULL, $q$https://www.speakeasygarnishes.com/collections/all$q$, $q$producer$q$),
($q$Speakeasy Dehydrated Lime Slices$q$, NULL, $q$Dried Fruit$q$, $q$Speakeasy$q$, NULL, NULL, NULL, $q$https://www.speakeasygarnishes.com/collections/all$q$, $q$producer$q$),
($q$Speakeasy Dehydrated Orange Slices$q$, NULL, $q$Dried Fruit$q$, $q$Speakeasy$q$, NULL, NULL, NULL, $q$https://www.speakeasygarnishes.com/collections/all$q$, $q$producer$q$),
($q$Speakeasy Premium Dried Hibiscus Flower Garnishes$q$, NULL, $q$Edible flower$q$, $q$Speakeasy$q$, NULL, NULL, NULL, $q$https://www.speakeasygarnishes.com/collections/all$q$, $q$producer$q$),
($q$Speakeasy Premium Dried Lavender Garnishes$q$, NULL, $q$Edible flower$q$, $q$Speakeasy$q$, NULL, NULL, NULL, $q$https://www.speakeasygarnishes.com/collections/all$q$, $q$producer$q$),
($q$Speakeasy Premium Dried Rose Petal Garnishes$q$, NULL, $q$Edible flower$q$, $q$Speakeasy$q$, NULL, NULL, NULL, $q$https://www.speakeasygarnishes.com/collections/all$q$, $q$producer$q$),
($q$Starlino Maraschino Cherries$q$, NULL, $q$Maraschino Cherry$q$, $q$Starlino$q$, NULL, NULL, NULL, $q$https://starlinocherries.com/collections/all$q$, $q$producer$q$),
($q$Tajín Clásico Seasoning$q$, $q$Tajín Clásico$q$, $q$Chilli Salt$q$, $q$Tajín$q$, NULL, $q$MX$q$, NULL, $q$https://www.tajin.com/us/products/$q$, $q$producer$q$),
($q$Tajín Clásico Seasoning Reduced Sodium$q$, NULL, $q$Chilli Salt$q$, $q$Tajín$q$, NULL, $q$MX$q$, NULL, $q$https://www.tajin.com/us/products/$q$, $q$producer$q$),
($q$Tajín Clásico Seasoning Rimmer$q$, NULL, $q$Chilli Salt$q$, $q$Tajín$q$, NULL, $q$MX$q$, NULL, $q$https://www.tajin.com/us/products/$q$, $q$producer$q$),
($q$Tajín Habanero Seasoning$q$, NULL, $q$Chilli Salt$q$, $q$Tajín$q$, NULL, $q$MX$q$, NULL, $q$https://www.tajin.com/us/products/$q$, $q$producer$q$),
($q$Tajín Twist$q$, NULL, $q$Chilli Salt$q$, $q$Tajín$q$, NULL, $q$MX$q$, NULL, $q$https://www.tajin.com/us/products/$q$, $q$producer$q$),
($q$The Cocktail Garnish Stemmed English Lavender Sprigs$q$, NULL, $q$Edible flower$q$, $q$The Cocktail Garnish$q$, NULL, $q$US$q$, NULL, $q$https://www.thecocktailgarnish.com/products/stemmed-lavender$q$, $q$producer$q$),
($q$Traverse City Whiskey Co. Premium Cocktail Cherries$q$, NULL, $q$Cherry$q$, $q$Traverse City Whiskey Co.$q$, NULL, $q$US$q$, NULL, $q$https://www.tcwhiskey.com/our-products/premium-cocktail-cherries/$q$, $q$producer$q$),
($q$Woodford Reserve Bourbon Cherries$q$, NULL, $q$Cherry$q$, $q$Woodford Reserve$q$, NULL, NULL, NULL, $q$https://shop.woodfordreserve.com/bourbon-cherries/$q$, $q$producer$q$);

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
    WHEN b.style IN ($q$Cherry$q$, $q$Olive$q$, $q$Salt$q$) AND EXISTS (
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
