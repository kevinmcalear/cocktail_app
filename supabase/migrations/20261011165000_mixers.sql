-- Mixers: every bottle checked on its producer's own page (or, where that
-- page was blocked, a major retailer, importer or Difford's), after
-- 20261011164000. Step 3h of the bottle catalog plan:
-- https://claude.ai/artifact/Vu6seuSNtN42nKYb2nDCVR
--
--   * The core range of every tonic, soda and ginger beer brand in our
--     catalog or on The Whisky Exchange's soft-drinks list.
--   * On a copy of production (2026-10-09, with the loads before this
--     one applied): 384 new bottles, and 91 we had that get their label
--     name (35 renamed, the old name kept as an alias), style, ABV,
--     country, protected name and maker where they were missing or
--     wrong.
--   * Styles: Tonic (plain, light, flavoured, elderflower), soda water,
--     hop water, ginger beer, ginger ale, cola, lemon-lime, grapefruit,
--     orange, yuzu and pineapple sodas, bitter lemon, lemonade, cream
--     soda, root beer, chinotto and energy drinks.
--   * Out of scope: syrups (the next PR), juices, non-alcoholic
--     spirits, anything with alcohol.
--   * Each producer gets an unclaimed maker page (makes: bottles), or a
--     page an earlier load made gains it, and each bottle names it.
--   * Every fact keeps the page it was checked on in item_sources. An
--     ABV read off another page isn't kept, and a review site isn't a
--     source.
--   * An independent second check of 100 random rows found 2 wrong
--     facts in 328 (0.6%). Every correction is taken: Fever-Tree's
--     white grape soda is now "White Grape & Apricot Soda" (the old
--     name's row is dropped); the catalog's plain "Fever-Tree Sicilian
--     Lemonade" isn't the Refreshingly Light bottle.
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
INSERT INTO style_in VALUES
(0, $q$Mixer$q$, NULL);

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
($q$7UP$q$, $q$7up$q$, $q$https://www.7up.co.uk$q$, NULL, NULL),
($q$BG Reynolds$q$, $q$bg.reynolds$q$, $q$https://www.bgreynolds.com$q$, NULL, NULL),
($q$Badoit$q$, $q$badoit$q$, $q$https://www.badoit.fr$q$, $q$FR$q$, NULL),
($q$Barq's$q$, $q$barq.s$q$, $q$https://www.coca-cola.com/us/en/brands$q$, NULL, NULL),
($q$Barritt's$q$, $q$barritt.s$q$, $q$https://www.barrittsmixers.com$q$, NULL, NULL),
($q$Belvoir Farm$q$, $q$belvoir.farm$q$, $q$https://belvoirfarm.co.uk$q$, NULL, NULL),
($q$Boylan$q$, $q$boylan$q$, $q$https://www.boylanbottling.com$q$, NULL, NULL),
($q$Bruce Cost$q$, $q$bruce.cost$q$, $q$https://www.brucecostgingerale.com$q$, NULL, NULL),
($q$Bundaberg$q$, $q$bundaberg$q$, $q$https://www.bundaberg.com$q$, NULL, NULL),
($q$Canada Dry$q$, $q$canada.dry$q$, $q$https://canadadry.ca$q$, NULL, NULL),
($q$Capi$q$, $q$capi$q$, $q$https://www.capi.com.au$q$, $q$AU$q$, NULL),
($q$Club-Mate$q$, $q$club.mate$q$, $q$https://www.club-mate.de$q$, NULL, NULL),
($q$Coca-Cola$q$, $q$coca.cola$q$, $q$https://www.coca-cola.com/us/en/brands$q$, NULL, NULL),
($q$Cock'n Bull$q$, $q$cock.n.bull$q$, $q$http://cocknbull.us$q$, NULL, NULL),
($q$Coco López$q$, $q$coco.lopez$q$, $q$https://www.cocolopez.com$q$, NULL, NULL),
($q$Double Dutch$q$, $q$double.dutch$q$, $q$https://doubledutchdrinks.com$q$, NULL, NULL),
($q$East Imperial$q$, $q$east.imperial$q$, $q$https://eastimperial.co.nz$q$, $q$NZ$q$, NULL),
($q$Fanta$q$, $q$fanta$q$, $q$https://www.coca-cola.com/us/en/brands$q$, NULL, NULL),
($q$Fentimans$q$, $q$fentimans$q$, $q$https://www.fentimans.com$q$, NULL, NULL),
($q$Fever-Tree$q$, $q$fever.tree$q$, $q$https://fever-tree.com$q$, NULL, NULL),
($q$Franklin & Sons$q$, $q$franklin.sons$q$, $q$https://franklinandsons.com$q$, $q$GB$q$, NULL),
($q$Fresca$q$, $q$fresca$q$, $q$https://www.coca-cola.com/us/en/brands/fresca-sparking-soda$q$, NULL, NULL),
($q$Gerolsteiner$q$, $q$gerolsteiner$q$, $q$https://www.gerolsteiner.de/en/$q$, $q$DE$q$, NULL),
($q$Goslings$q$, $q$goslings$q$, $q$https://goslings.com$q$, NULL, NULL),
($q$Idyll Drinks$q$, $q$idyll.drinks$q$, $q$https://www.idylldrinks.com$q$, $q$GB$q$, NULL),
($q$Jarritos$q$, $q$jarritos$q$, $q$https://www.jarritos.com$q$, NULL, NULL),
($q$Karma Drinks$q$, $q$karma.drinks$q$, $q$https://www.karmadrinks.co.uk$q$, NULL, NULL),
($q$Le Tribute$q$, $q$le.tribute$q$, $q$https://www.letribute.com$q$, NULL, NULL),
($q$London Essence Co.$q$, $q$london.essence.co$q$, $q$https://www.londonessenceco.com$q$, NULL, NULL),
($q$Lurisia$q$, $q$lurisia$q$, $q$https://www.coca-cola.com/it/it/brands/Lurisia$q$, NULL, NULL),
($q$Mezzanine Makers$q$, $q$mezzanine.makers$q$, $q$https://www.mezzaninemakers.jp$q$, $q$HK$q$, NULL),
($q$Old Jamaica$q$, $q$old.jamaica$q$, $q$https://oldjamaicagingerbeer.com$q$, NULL, NULL),
($q$Orangina$q$, $q$orangina$q$, $q$https://www.orangina.com$q$, NULL, NULL),
($q$Paulaner$q$, $q$paulaner$q$, $q$https://www.paulaner.com$q$, $q$DE$q$, NULL),
($q$Pepsi$q$, $q$pepsi$q$, $q$https://www.pepsi.com$q$, NULL, NULL),
($q$Polar$q$, $q$polar$q$, $q$https://polarbeverages.com$q$, $q$US$q$, NULL),
($q$Q Mixers$q$, $q$q.mixers$q$, $q$https://qmixers.com$q$, NULL, NULL),
($q$Red Bull$q$, $q$red.bull$q$, $q$https://www.redbull.com$q$, NULL, NULL),
($q$Reed's$q$, $q$reed.s$q$, $q$https://www.drinkreeds.com$q$, NULL, NULL),
($q$Regatta$q$, $q$regatta$q$, $q$https://regattacraftmixers.com$q$, NULL, NULL),
($q$Sanpellegrino$q$, $q$sanpellegrino$q$, $q$https://www.sanpellegrino.com$q$, NULL, NULL),
($q$Schweppes$q$, $q$schweppes$q$, $q$https://schweppes.com.au$q$, $q$GB$q$, NULL),
($q$Seagram's$q$, $q$seagram.s$q$, $q$https://www.coca-cola.com/us/en/brands/seagrams$q$, NULL, NULL),
($q$Solo$q$, $q$solo$q$, $q$https://thirstcrusher.com.au$q$, $q$AU$q$, NULL),
($q$Something & Nothing$q$, $q$something.nothing$q$, $q$https://somethingandnothing.co$q$, NULL, NULL),
($q$Sprite$q$, $q$sprite$q$, $q$https://www.coca-cola.com/us/en/brands/sprite$q$, NULL, NULL),
($q$Squirt$q$, $q$squirt$q$, $q$https://www.squirtsoda.com$q$, NULL, NULL),
($q$StrangeLove$q$, $q$strangelove$q$, $q$https://strangelove.com.au$q$, NULL, NULL),
($q$Thomas Henry$q$, $q$thomas.henry$q$, $q$https://www.thomas-henry.de$q$, NULL, NULL),
($q$Three Cents$q$, $q$three.cents$q$, $q$https://threecents.com$q$, $q$GR$q$, NULL),
($q$Ting$q$, $q$ting$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/4481/ting-grapefruit-soda$q$, $q$GB$q$, NULL),
($q$Vichy Catalan$q$, $q$vichy.catalan$q$, $q$https://www.vichycatalan.com$q$, $q$ES$q$, NULL),
($q$Vikos$q$, $q$vikos$q$, $q$https://www.vikos.com$q$, $q$GR$q$, NULL),
($q$Virgil's$q$, $q$virgil.s$q$, $q$https://www.drinkreeds.com$q$, NULL, NULL),
($q$Zingi Bear$q$, $q$zingi.bear$q$, $q$https://www.zingibear.com$q$, $q$GB$q$, NULL),
($q$bottlegreen$q$, $q$bottlegreen$q$, $q$https://www.bottlegreendrinks.com$q$, NULL, NULL);

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
($q$7UP Pink Lemonade Zero Sugar$q$, NULL, $q$Lemonade$q$, $q$7UP$q$, NULL, NULL, NULL, $q$https://www.7up.co.uk/products/7up-pink-lemonade-zero-sugar$q$, $q$producer$q$),
($q$7UP The Original$q$, NULL, $q$Lemon-lime Soda$q$, $q$7UP$q$, NULL, NULL, NULL, $q$https://www.7up.co.uk/products/7up-original$q$, $q$producer$q$),
($q$7UP Zero Sugar$q$, NULL, $q$Lemon-lime Soda$q$, $q$7UP$q$, NULL, NULL, NULL, $q$https://www.7up.co.uk/products/7up-zero-sugar$q$, $q$producer$q$),
($q$BG Reynolds Hurricane Mix$q$, NULL, $q$Mixer$q$, $q$BG Reynolds$q$, NULL, NULL, NULL, $q$https://www.bgreynolds.com/products/hurricane-mix$q$, $q$producer$q$),
($q$BG Reynolds Mai Tai Cocktail Mix$q$, NULL, $q$Mixer$q$, $q$BG Reynolds$q$, NULL, NULL, NULL, $q$https://www.bgreynolds.com/products/mai-tai$q$, $q$producer$q$),
($q$BG Reynolds Zombie Punch Cocktail Mix$q$, NULL, $q$Mixer$q$, $q$BG Reynolds$q$, NULL, NULL, NULL, $q$https://www.bgreynolds.com/products/zombie-punch$q$, $q$producer$q$),
($q$Badoit Aromatisée Citron$q$, NULL, $q$Soda Water$q$, $q$Badoit$q$, NULL, $q$FR$q$, NULL, $q$https://www.badoit.fr/nos-produits/badoit-aromatisee.html$q$, $q$producer$q$),
($q$Badoit Aromatisée Citron Vert$q$, NULL, $q$Soda Water$q$, $q$Badoit$q$, NULL, $q$FR$q$, NULL, $q$https://www.badoit.fr/nos-produits/badoit-aromatisee.html$q$, $q$producer$q$),
($q$Badoit Rouge Intensément Pétillante$q$, NULL, $q$Soda Water$q$, $q$Badoit$q$, NULL, $q$FR$q$, NULL, $q$https://www.badoit.fr/nos-produits/eau-petillante-badoit-intense.html$q$, $q$producer$q$),
($q$Badoit Verte Finement Pétillante$q$, $q$Badoit Sparkling Mineral Water$q$, $q$Soda Water$q$, $q$Badoit$q$, NULL, $q$FR$q$, NULL, $q$https://www.badoit.fr/nos-produits/eau-finement-petillante-badoit.html$q$, $q$producer$q$),
($q$Barq's Creme Soda French Vanilla$q$, NULL, $q$Cream Soda$q$, $q$Barq's$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/us/en/brands/barq-s$q$, $q$producer$q$),
($q$Barq's Red Creme Soda$q$, NULL, $q$Cream Soda$q$, $q$Barq's$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/us/en/brands/barq-s$q$, $q$producer$q$),
($q$Barq's Root Beer$q$, $q$Barq's Root Beer$q$, $q$Root Beer$q$, $q$Barq's$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/us/en/brands/barq-s$q$, $q$producer$q$),
($q$Barq's Zero Sugar Root Beer$q$, NULL, $q$Root Beer$q$, $q$Barq's$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/us/en/brands/barq-s$q$, $q$producer$q$),
($q$Barritt's Club Soda$q$, NULL, $q$Soda Water$q$, $q$Barritt's$q$, NULL, NULL, NULL, $q$https://www.barrittsmixers.com/products/barritt-s-original-club-soda$q$, $q$producer$q$),
($q$Barritt's Original Ginger Beer$q$, $q$Barritt's Ginger Beer$q$, $q$Ginger Beer$q$, $q$Barritt's$q$, NULL, NULL, NULL, $q$https://www.barrittsmixers.com/products/barritt-s-original-ginger-beer$q$, $q$producer$q$),
($q$Barritt's Sparkling Grapefruit$q$, NULL, $q$Grapefruit Soda$q$, $q$Barritt's$q$, NULL, NULL, NULL, $q$https://www.barrittsmixers.com/products/barritts-sparkling-grapefruit$q$, $q$producer$q$),
($q$Barritt's Sugar Free Ginger Beer$q$, NULL, $q$Ginger Beer$q$, $q$Barritt's$q$, NULL, NULL, NULL, $q$https://www.barrittsmixers.com/products/barritts-original-ginger-beer-sugar-free$q$, $q$producer$q$),
($q$Barritt's Tonic Water$q$, NULL, $q$Tonic Water$q$, $q$Barritt's$q$, NULL, NULL, NULL, $q$https://www.barrittsmixers.com/products/barritts-tonic-water$q$, $q$producer$q$),
($q$Belvoir Farm Freshly Squeezed Lemonade$q$, NULL, $q$Lemonade$q$, $q$Belvoir Farm$q$, NULL, NULL, NULL, $q$https://belvoirfarm.co.uk/drink/freshly-squeezed-lemonade/$q$, $q$producer$q$),
($q$Belvoir Farm Ginger Beer$q$, NULL, $q$Ginger Beer$q$, $q$Belvoir Farm$q$, NULL, NULL, NULL, $q$https://belvoirfarm.co.uk/drink/ginger-beer/$q$, $q$producer$q$),
($q$Belvoir Farm Organic Ginger Beer$q$, NULL, $q$Ginger Beer$q$, $q$Belvoir Farm$q$, NULL, NULL, NULL, $q$https://belvoirfarm.co.uk/drink/organic-ginger-beer/$q$, $q$producer$q$),
($q$Belvoir Farm Organic Sparkling Elderflower$q$, NULL, $q$Mixer$q$, $q$Belvoir Farm$q$, NULL, NULL, NULL, $q$https://belvoirfarm.co.uk/drink/organic-sparkling-elderflower/$q$, $q$producer$q$),
($q$Belvoir Farm Raspberry Lemonade$q$, NULL, $q$Lemonade$q$, $q$Belvoir Farm$q$, NULL, NULL, NULL, $q$https://belvoirfarm.co.uk/drink/raspberry-lemonade/$q$, $q$producer$q$),
($q$Belvoir Farm Sparkling Elderflower$q$, NULL, $q$Mixer$q$, $q$Belvoir Farm$q$, NULL, NULL, NULL, $q$https://belvoirfarm.co.uk/drink/sparkling-elderflower/$q$, $q$producer$q$),
($q$Belvoir Farm Sparkling Elderflower & Rose$q$, NULL, $q$Mixer$q$, $q$Belvoir Farm$q$, NULL, NULL, NULL, $q$https://belvoirfarm.co.uk/drink/sparkling-elderflower-rose/$q$, $q$producer$q$),
($q$Boylan Black Cherry$q$, NULL, $q$Mixer$q$, $q$Boylan$q$, NULL, NULL, NULL, $q$https://www.boylanbottling.com/products/black-cherry$q$, $q$producer$q$),
($q$Boylan Cane Cola$q$, NULL, $q$Cola$q$, $q$Boylan$q$, NULL, NULL, NULL, $q$https://www.boylanbottling.com/products/cane-soda$q$, $q$producer$q$),
($q$Boylan Classic Seltzer$q$, NULL, $q$Soda Water$q$, $q$Boylan$q$, NULL, NULL, NULL, $q$https://www.boylanbottling.com/products/classic-seltzer$q$, $q$producer$q$),
($q$Boylan Club Soda$q$, NULL, $q$Soda Water$q$, $q$Boylan$q$, NULL, NULL, NULL, $q$https://www.boylanbottling.com/products/club-soda$q$, $q$producer$q$),
($q$Boylan Creamy Red Birch Beer$q$, NULL, $q$Root Beer$q$, $q$Boylan$q$, NULL, NULL, NULL, $q$https://www.boylanbottling.com/products/creamy-red-birch-beer$q$, $q$producer$q$),
($q$Boylan Creme Soda$q$, NULL, $q$Cream Soda$q$, $q$Boylan$q$, NULL, NULL, NULL, $q$https://www.boylanbottling.com/products/creme-soda$q$, $q$producer$q$),
($q$Boylan Diet Black Cherry$q$, NULL, $q$Mixer$q$, $q$Boylan$q$, NULL, NULL, NULL, $q$https://www.boylanbottling.com/products/diet-black-cherry$q$, $q$producer$q$),
($q$Boylan Diet Cane Cola$q$, NULL, $q$Cola$q$, $q$Boylan$q$, NULL, NULL, NULL, $q$https://www.boylanbottling.com/products/diet-cane-cola$q$, $q$producer$q$),
($q$Boylan Diet Creme Soda$q$, NULL, $q$Cream Soda$q$, $q$Boylan$q$, NULL, NULL, NULL, $q$https://www.boylanbottling.com/products/diet-creme-soda$q$, $q$producer$q$),
($q$Boylan Diet Root Beer$q$, NULL, $q$Root Beer$q$, $q$Boylan$q$, NULL, NULL, NULL, $q$https://www.boylanbottling.com/products/diet-root-beer$q$, $q$producer$q$),
($q$Boylan Dr. Boylan$q$, NULL, $q$Mixer$q$, $q$Boylan$q$, NULL, NULL, NULL, $q$https://www.boylanbottling.com/products/dr-boylan$q$, $q$producer$q$),
($q$Boylan Ginger Ale$q$, $q$Boylan Bottleworks Ginger Ale$q$, $q$Ginger Ale$q$, $q$Boylan$q$, NULL, NULL, NULL, $q$https://www.boylanbottling.com/products/ginger-ale$q$, $q$producer$q$),
($q$Boylan Ginger Beer$q$, NULL, $q$Ginger Beer$q$, $q$Boylan$q$, NULL, NULL, NULL, $q$https://www.boylanbottling.com/products/ginger-beer$q$, $q$producer$q$),
($q$Boylan Grape$q$, NULL, $q$Mixer$q$, $q$Boylan$q$, NULL, NULL, NULL, $q$https://www.boylanbottling.com/products/grape-soda$q$, $q$producer$q$),
($q$Boylan Lemon Lime$q$, NULL, $q$Lemon-lime Soda$q$, $q$Boylan$q$, NULL, NULL, NULL, $q$https://www.boylanbottling.com/products/lemon-lime$q$, $q$producer$q$),
($q$Boylan Lemon Seltzer$q$, NULL, $q$Soda Water$q$, $q$Boylan$q$, NULL, NULL, NULL, $q$https://www.boylanbottling.com/products/lemon-seltzer$q$, $q$producer$q$),
($q$Boylan Lime Seltzer$q$, NULL, $q$Soda Water$q$, $q$Boylan$q$, NULL, NULL, NULL, $q$https://www.boylanbottling.com/products/lime-seltzer$q$, $q$producer$q$),
($q$Boylan Orange$q$, NULL, $q$Orange Soda$q$, $q$Boylan$q$, NULL, NULL, NULL, $q$https://www.boylanbottling.com/products/orange-soda$q$, $q$producer$q$),
($q$Boylan Original Birch Beer$q$, NULL, $q$Root Beer$q$, $q$Boylan$q$, NULL, NULL, NULL, $q$https://www.boylanbottling.com/products/original-birch-beer$q$, $q$producer$q$),
($q$Boylan Raspberry Seltzer$q$, NULL, $q$Soda Water$q$, $q$Boylan$q$, NULL, NULL, NULL, $q$https://www.boylanbottling.com/products/raspberry-seltzer$q$, $q$producer$q$),
($q$Boylan Root Beer$q$, NULL, $q$Root Beer$q$, $q$Boylan$q$, NULL, NULL, NULL, $q$https://www.boylanbottling.com/products/root-beer$q$, $q$producer$q$),
($q$Boylan Shirley Temple$q$, NULL, $q$Mixer$q$, $q$Boylan$q$, NULL, NULL, NULL, $q$https://www.boylanbottling.com/products/shirley-temple$q$, $q$producer$q$),
($q$Boylan Sparkling Lemonade$q$, NULL, $q$Lemonade$q$, $q$Boylan$q$, NULL, NULL, NULL, $q$https://www.boylanbottling.com/products/sparkling-lemonade$q$, $q$producer$q$),
($q$Boylan Tonic Water$q$, NULL, $q$Tonic Water$q$, $q$Boylan$q$, NULL, NULL, NULL, $q$https://www.boylanbottling.com/products/tonic-water$q$, $q$producer$q$),
($q$Bruce Cost 66 Calories Ginger Ale$q$, NULL, $q$Ginger Ale$q$, $q$Bruce Cost$q$, NULL, NULL, NULL, $q$https://www.brucecostgingerale.com/products/bruce-cost-ginger-ale-66-calories$q$, $q$producer$q$),
($q$Bruce Cost Blood Orange with Meyer Lemon Ginger Ale$q$, NULL, $q$Ginger Ale$q$, $q$Bruce Cost$q$, NULL, NULL, NULL, $q$https://www.brucecostgingerale.com/products/bruce-cost-ginger-ale-blood-orange-with-meyer-lemon$q$, $q$producer$q$),
($q$Bruce Cost Jasmine Tea Ginger Ale$q$, NULL, $q$Ginger Ale$q$, $q$Bruce Cost$q$, NULL, NULL, NULL, $q$https://www.brucecostgingerale.com/products/bruce-cost-ginger-ale-jasmine-tea$q$, $q$producer$q$),
($q$Bruce Cost Original Ginger Ale$q$, $q$Bruce Cost Ginger Ale$q$, $q$Ginger Ale$q$, $q$Bruce Cost$q$, NULL, NULL, NULL, $q$https://www.brucecostgingerale.com/products/bruce-cost-ginger-ale-original$q$, $q$producer$q$),
($q$Bruce Cost Passion Fruit with Turmeric Ginger Ale$q$, NULL, $q$Ginger Ale$q$, $q$Bruce Cost$q$, NULL, NULL, NULL, $q$https://www.brucecostgingerale.com/products/bruce-cost-ginger-ale-passion-fruit-with-turmeric$q$, $q$producer$q$),
($q$Bruce Cost Pomegranate with Hibiscus Ginger Ale$q$, NULL, $q$Ginger Ale$q$, $q$Bruce Cost$q$, NULL, NULL, NULL, $q$https://www.brucecostgingerale.com/products/bruce-cost-ginger-ale-pomegranate-with-hibiscus$q$, $q$producer$q$),
($q$Bruce Cost Yuzu Ginger Ale$q$, NULL, $q$Ginger Ale$q$, $q$Bruce Cost$q$, NULL, NULL, NULL, $q$https://www.brucecostgingerale.com/products/bruce-cost-ginger-ale-yuzu$q$, $q$producer$q$),
($q$Bundaberg Blood Orange$q$, NULL, $q$Orange Soda$q$, $q$Bundaberg$q$, NULL, NULL, NULL, $q$https://www.bundaberg.com/brew/blood-orange/$q$, $q$producer$q$),
($q$Bundaberg Burgundee Creaming Soda$q$, NULL, $q$Cream Soda$q$, $q$Bundaberg$q$, NULL, NULL, NULL, $q$https://www.bundaberg.com/brew/burgundee-creaming-soda/$q$, $q$producer$q$),
($q$Bundaberg Dekopon Mandarin$q$, NULL, $q$Orange Soda$q$, $q$Bundaberg$q$, NULL, NULL, NULL, $q$https://www.bundaberg.com/brew/dekopon-mandarin/$q$, $q$producer$q$),
($q$Bundaberg Diet Ginger Beer$q$, NULL, $q$Ginger Beer$q$, $q$Bundaberg$q$, NULL, NULL, NULL, $q$https://www.bundaberg.com/brew/ginger-beer/$q$, $q$producer$q$),
($q$Bundaberg Diet Lemon Lime & Bitters$q$, NULL, $q$Mixer$q$, $q$Bundaberg$q$, NULL, NULL, NULL, $q$https://www.bundaberg.com/brew/lemon-lime-bitters/$q$, $q$producer$q$),
($q$Bundaberg Ginger Beer$q$, $q$Bundaberg Ginger Beer$q$, $q$Ginger Beer$q$, $q$Bundaberg$q$, NULL, NULL, NULL, $q$https://www.bundaberg.com/brew/ginger-beer/$q$, $q$producer$q$),
($q$Bundaberg Guava$q$, NULL, $q$Mixer$q$, $q$Bundaberg$q$, NULL, NULL, NULL, $q$https://www.bundaberg.com/brew/guava/$q$, $q$producer$q$),
($q$Bundaberg Lemon Lime & Bitters$q$, $q$Bundaberg Lemon Lime and Bitters$q$, $q$Mixer$q$, $q$Bundaberg$q$, NULL, NULL, NULL, $q$https://www.bundaberg.com/brew/lemon-lime-bitters/$q$, $q$producer$q$),
($q$Bundaberg Passionfruit$q$, NULL, $q$Mixer$q$, $q$Bundaberg$q$, NULL, NULL, NULL, $q$https://www.bundaberg.com/brew/passionfruit/$q$, $q$producer$q$),
($q$Bundaberg Peach$q$, NULL, $q$Mixer$q$, $q$Bundaberg$q$, NULL, NULL, NULL, $q$https://www.bundaberg.com/brew/peach/$q$, $q$producer$q$),
($q$Bundaberg Pineapple & Coconut$q$, NULL, $q$Pineapple Soda$q$, $q$Bundaberg$q$, NULL, NULL, NULL, $q$https://www.bundaberg.com/brew/pineapple-and-coconut/$q$, $q$producer$q$),
($q$Bundaberg Pink Grapefruit$q$, NULL, $q$Grapefruit Soda$q$, $q$Bundaberg$q$, NULL, NULL, NULL, $q$https://www.bundaberg.com/brew/pink-grapefruit/$q$, $q$producer$q$),
($q$Bundaberg Refreshingly Light Apple + Lychee$q$, NULL, $q$Mixer$q$, $q$Bundaberg$q$, NULL, NULL, NULL, $q$https://www.bundaberg.com/refreshingly-light/apple-lychee/$q$, $q$producer$q$),
($q$Bundaberg Refreshingly Light Lemon + Watermelon$q$, NULL, $q$Mixer$q$, $q$Bundaberg$q$, NULL, NULL, NULL, $q$https://www.bundaberg.com/refreshingly-light/lemon-watermelon/$q$, $q$producer$q$),
($q$Bundaberg Refreshingly Light Raspberry + Pomegranate$q$, NULL, $q$Mixer$q$, $q$Bundaberg$q$, NULL, NULL, NULL, $q$https://www.bundaberg.com/refreshingly-light/raspberry-pomegranate/$q$, $q$producer$q$),
($q$Bundaberg Root Beer$q$, $q$Bundaberg Root Beer$q$, $q$Root Beer$q$, $q$Bundaberg$q$, NULL, NULL, NULL, $q$https://www.bundaberg.com/en-us/brew/root-beer/$q$, $q$producer$q$),
($q$Bundaberg Sarsaparilla$q$, $q$Bundaberg Sarsaparilla$q$, $q$Root Beer$q$, $q$Bundaberg$q$, NULL, NULL, NULL, $q$https://www.bundaberg.com/brew/sarsaparilla/$q$, $q$producer$q$),
($q$Bundaberg Traditional Lemonade$q$, $q$Bundaberg Traditional Lemonade$q$, $q$Lemonade$q$, $q$Bundaberg$q$, NULL, NULL, NULL, $q$https://www.bundaberg.com/brew/traditional-lemonade/$q$, $q$producer$q$),
($q$Bundaberg Tropical Mango$q$, NULL, $q$Mixer$q$, $q$Bundaberg$q$, NULL, NULL, NULL, $q$https://www.bundaberg.com/brew/tropical-mango/$q$, $q$producer$q$),
($q$Canada Dry Black Cherry Ginger Ale$q$, NULL, $q$Ginger Ale$q$, $q$Canada Dry$q$, NULL, NULL, NULL, $q$https://canadadry.ca/product/#craft-soda$q$, $q$producer$q$),
($q$Canada Dry Club Soda$q$, $q$Canada Dry Club Soda$q$, $q$Soda Water$q$, $q$Canada Dry$q$, NULL, NULL, NULL, $q$https://canadadry.ca/product/#club-soda$q$, $q$producer$q$),
($q$Canada Dry Diet Ginger Ale$q$, NULL, $q$Ginger Ale$q$, $q$Canada Dry$q$, NULL, NULL, NULL, $q$https://canadadry.ca/product/#ginger-ale$q$, $q$producer$q$),
($q$Canada Dry Ginger Ale$q$, $q$Canada Dry Ginger Ale$q$, $q$Ginger Ale$q$, $q$Canada Dry$q$, NULL, NULL, NULL, $q$https://canadadry.ca/product/#ginger-ale$q$, $q$producer$q$),
($q$Canada Dry Ginger Ale Zero Sugar$q$, NULL, $q$Ginger Ale$q$, $q$Canada Dry$q$, NULL, NULL, NULL, $q$https://canadadry.ca/product/#ginger-ale$q$, $q$producer$q$),
($q$Canada Dry Ginger Beer$q$, NULL, $q$Ginger Beer$q$, $q$Canada Dry$q$, NULL, NULL, NULL, $q$https://canadadry.ca/product/#ginger-beer$q$, $q$producer$q$),
($q$Canada Dry Peach Mango Ginger Ale$q$, NULL, $q$Ginger Ale$q$, $q$Canada Dry$q$, NULL, NULL, NULL, $q$https://canadadry.ca/product/#craft-soda$q$, $q$producer$q$),
($q$Canada Dry Tonic Water$q$, NULL, $q$Tonic Water$q$, $q$Canada Dry$q$, NULL, NULL, NULL, $q$https://canadadry.ca/product/#tonic-water$q$, $q$producer$q$),
($q$Canada Dry Tonic Water Zero Sugar$q$, NULL, $q$Light Tonic Water$q$, $q$Canada Dry$q$, NULL, NULL, NULL, $q$https://canadadry.ca/product/#tonic-water$q$, $q$producer$q$),
($q$Capi Blood Orange$q$, NULL, $q$Orange Soda$q$, $q$Capi$q$, NULL, $q$AU$q$, NULL, $q$https://www.capi.com.au/products/blood-orange$q$, $q$producer$q$),
($q$Capi Charred Pineapple$q$, NULL, $q$Pineapple Soda$q$, $q$Capi$q$, NULL, $q$AU$q$, NULL, $q$https://www.capi.com.au/products/charred-pineapple$q$, $q$producer$q$),
($q$Capi Cola$q$, NULL, $q$Cola$q$, $q$Capi$q$, NULL, $q$AU$q$, NULL, $q$https://www.capi.com.au/products/cola$q$, $q$producer$q$),
($q$Capi Cranberry$q$, NULL, $q$Mixer$q$, $q$Capi$q$, NULL, $q$AU$q$, NULL, $q$https://www.capi.com.au/products/cranberry$q$, $q$producer$q$),
($q$Capi Dry Ginger Ale$q$, NULL, $q$Ginger Ale$q$, $q$Capi$q$, NULL, $q$AU$q$, NULL, $q$https://www.capi.com.au/products/dry-ginger-ale$q$, $q$producer$q$),
($q$Capi Dry Tonic$q$, $q$Capi Dry Tonic Water$q$, $q$Tonic Water$q$, $q$Capi$q$, NULL, $q$AU$q$, NULL, $q$https://www.capi.com.au/products/dry-tonic$q$, $q$producer$q$),
($q$Capi Grapefruit$q$, NULL, $q$Grapefruit Soda$q$, $q$Capi$q$, NULL, $q$AU$q$, NULL, $q$https://www.capi.com.au/products/grapefruit$q$, $q$producer$q$),
($q$Capi Lemon$q$, NULL, $q$Mixer$q$, $q$Capi$q$, NULL, $q$AU$q$, NULL, $q$https://www.capi.com.au/products/lemon$q$, $q$producer$q$),
($q$Capi Lemonade$q$, NULL, $q$Lemonade$q$, $q$Capi$q$, NULL, $q$AU$q$, NULL, $q$https://www.capi.com.au/products/lemonade$q$, $q$producer$q$),
($q$Capi Low Sugar Grapefruit$q$, NULL, $q$Grapefruit Soda$q$, $q$Capi$q$, NULL, $q$AU$q$, NULL, $q$https://www.capi.com.au/products/low-sugar-grapefruit$q$, $q$producer$q$),
($q$Capi Soda$q$, $q$Capi Soda Water$q$, $q$Soda Water$q$, $q$Capi$q$, NULL, $q$AU$q$, NULL, $q$https://www.capi.com.au/products/soda$q$, $q$producer$q$),
($q$Capi Sparkling Mineral Water$q$, NULL, $q$Soda Water$q$, $q$Capi$q$, NULL, $q$AU$q$, NULL, $q$https://www.capi.com.au/products/sparkling-mineral-water$q$, $q$producer$q$),
($q$Capi Spicy Ginger Beer$q$, $q$Capi Ginger Beer$q$, $q$Ginger Beer$q$, $q$Capi$q$, NULL, $q$AU$q$, NULL, $q$https://www.capi.com.au/products/spicy-ginger-beer$q$, $q$producer$q$),
($q$Capi Tonic$q$, NULL, $q$Tonic Water$q$, $q$Capi$q$, NULL, $q$AU$q$, NULL, $q$https://www.capi.com.au/products/tonic$q$, $q$producer$q$),
($q$Capi Yuzu$q$, NULL, $q$Yuzu Soda$q$, $q$Capi$q$, NULL, $q$AU$q$, NULL, $q$https://www.capi.com.au/products/yuzu$q$, $q$producer$q$),
($q$Club-Mate$q$, $q$Club-Mate$q$, $q$Mixer$q$, $q$Club-Mate$q$, NULL, NULL, NULL, $q$https://www.club-mate.de/produkte/#club-mate$q$, $q$producer$q$),
($q$Club-Mate Cola$q$, NULL, $q$Cola$q$, $q$Club-Mate$q$, NULL, NULL, NULL, $q$https://www.club-mate.de/produkte/$q$, $q$producer$q$),
($q$Club-Mate Granat$q$, NULL, $q$Mixer$q$, $q$Club-Mate$q$, NULL, NULL, NULL, $q$https://www.club-mate.de/produkte/$q$, $q$producer$q$),
($q$Club-Mate Zero$q$, NULL, $q$Mixer$q$, $q$Club-Mate$q$, NULL, NULL, NULL, $q$https://www.club-mate.de/produkte/$q$, $q$producer$q$),
($q$Coca-Cola Caffeine Free$q$, NULL, $q$Cola$q$, $q$Coca-Cola$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/us/en/brands/coca-cola/products/original$q$, $q$producer$q$),
($q$Coca-Cola Cherry$q$, NULL, $q$Cola$q$, $q$Coca-Cola$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/us/en/brands/coca-cola/products/original$q$, $q$producer$q$),
($q$Coca-Cola Mexico$q$, $q$Mexican Coca-Cola$q$, $q$Cola$q$, $q$Coca-Cola$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/us/en/brands/coca-cola/products/original$q$, $q$producer$q$),
($q$Coca-Cola Original$q$, $q$Coca-Cola$q$, $q$Cola$q$, $q$Coca-Cola$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/us/en/brands/coca-cola/products/original$q$, $q$producer$q$),
($q$Coca-Cola Vanilla$q$, NULL, $q$Cola$q$, $q$Coca-Cola$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/us/en/brands/coca-cola/products/original$q$, $q$producer$q$),
($q$Coca-Cola Zero Sugar$q$, $q$Coca-Cola Zero Sugar$q$, $q$Cola$q$, $q$Coca-Cola$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/us/en/brands/coca-cola/products/zero$q$, $q$producer$q$),
($q$Diet Coke$q$, $q$Diet Coke$q$, $q$Cola$q$, $q$Coca-Cola$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/us/en/brands/diet-coke$q$, $q$producer$q$),
($q$Cock'n Bull Bitter Lemon$q$, NULL, $q$Bitter Lemon$q$, $q$Cock'n Bull$q$, NULL, NULL, NULL, $q$http://cocknbull.us/cockn-bull-products/#bitter-lemon$q$, $q$producer$q$),
($q$Cock'n Bull Bitter Orange$q$, NULL, $q$Orange Soda$q$, $q$Cock'n Bull$q$, NULL, NULL, NULL, $q$http://cocknbull.us/cockn-bull-products/#bitter-orange$q$, $q$producer$q$),
($q$Cock'n Bull Cherry Ginger Beer$q$, NULL, $q$Ginger Beer$q$, $q$Cock'n Bull$q$, NULL, NULL, NULL, $q$http://cocknbull.us/cockn-bull-products/#cherry-ginger-beer$q$, $q$producer$q$),
($q$Cock'n Bull Diet Ginger Beer$q$, NULL, $q$Ginger Beer$q$, $q$Cock'n Bull$q$, NULL, NULL, NULL, $q$http://cocknbull.us/cockn-bull-products/#diet-ginger-beer$q$, $q$producer$q$),
($q$Cock'n Bull Original Ginger Beer$q$, $q$Cock 'n Bull Ginger Beer$q$, $q$Ginger Beer$q$, $q$Cock'n Bull$q$, NULL, NULL, NULL, $q$http://cocknbull.us/cockn-bull-products/#original-ginger-beer$q$, $q$producer$q$),
($q$Coco López Piña Colada Mix$q$, NULL, $q$Mixer$q$, $q$Coco López$q$, NULL, NULL, NULL, $q$https://www.cocolopez.com/products$q$, $q$producer$q$),
($q$Double Dutch Cranberry & Ginger Tonic Water$q$, NULL, $q$Flavoured Tonic Water$q$, $q$Double Dutch$q$, NULL, NULL, NULL, $q$https://doubledutchdrinks.com/products/cranberry-ginger-tonic-water$q$, $q$producer$q$),
($q$Double Dutch Cucumber & Watermelon Soda$q$, NULL, $q$Mixer$q$, $q$Double Dutch$q$, NULL, NULL, NULL, $q$https://doubledutchdrinks.com/products/cucumber-watermelon-soda$q$, $q$producer$q$),
($q$Double Dutch Elderflower Tonic Water$q$, NULL, $q$Elderflower Tonic$q$, $q$Double Dutch$q$, NULL, NULL, NULL, $q$https://doubledutchdrinks.com/products/elderflower-tonic-water$q$, $q$producer$q$),
($q$Double Dutch Ginger Ale$q$, NULL, $q$Ginger Ale$q$, $q$Double Dutch$q$, NULL, NULL, NULL, $q$https://doubledutchdrinks.com/products/ginger-ale$q$, $q$producer$q$),
($q$Double Dutch Ginger Beer$q$, NULL, $q$Ginger Beer$q$, $q$Double Dutch$q$, NULL, NULL, NULL, $q$https://doubledutchdrinks.com/products/ginger-beer$q$, $q$producer$q$),
($q$Double Dutch Indian Tonic Water$q$, $q$Double Dutch Indian Tonic Water$q$, $q$Tonic Water$q$, $q$Double Dutch$q$, NULL, NULL, NULL, $q$https://doubledutchdrinks.com/products/indian-tonic-water$q$, $q$producer$q$),
($q$Double Dutch Pink Grapefruit Soda$q$, NULL, $q$Grapefruit Soda$q$, $q$Double Dutch$q$, NULL, NULL, NULL, $q$https://doubledutchdrinks.com/products/pink-grapefruit-soda$q$, $q$producer$q$),
($q$Double Dutch Pomegranate & Basil Soda$q$, NULL, $q$Mixer$q$, $q$Double Dutch$q$, NULL, NULL, NULL, $q$https://doubledutchdrinks.com/products/pomegranate-basil-soda$q$, $q$producer$q$),
($q$Double Dutch Refreshing Lemonade$q$, NULL, $q$Lemonade$q$, $q$Double Dutch$q$, NULL, NULL, NULL, $q$https://doubledutchdrinks.com/products/refreshing-lemonade$q$, $q$producer$q$),
($q$Double Dutch Skinny Tonic Water$q$, NULL, $q$Light Tonic Water$q$, $q$Double Dutch$q$, NULL, NULL, NULL, $q$https://doubledutchdrinks.com/products/skinny-tonic-water$q$, $q$producer$q$),
($q$Double Dutch Soda Water$q$, NULL, $q$Soda Water$q$, $q$Double Dutch$q$, NULL, NULL, NULL, $q$https://doubledutchdrinks.com/products/soda-water$q$, $q$producer$q$),
($q$Double Dutch Sun & Sea Tonic Water$q$, NULL, $q$Flavoured Tonic Water$q$, $q$Double Dutch$q$, NULL, NULL, NULL, $q$https://doubledutchdrinks.com/products/sun-sea-tonic-water$q$, $q$producer$q$),
($q$East Imperial Botanic Tonic$q$, NULL, $q$Flavoured Tonic Water$q$, $q$East Imperial$q$, NULL, NULL, NULL, $q$https://eastimperial.co.nz/products/botanic-tonic$q$, $q$producer$q$),
($q$East Imperial Dry Ginger Ale$q$, NULL, $q$Ginger Ale$q$, $q$East Imperial$q$, NULL, $q$NZ$q$, NULL, $q$https://eastimperial.co.nz/products/dry-ginger-ale$q$, $q$producer$q$),
($q$East Imperial Ginger Beer$q$, $q$East Imperial Ginger Beer$q$, $q$Ginger Beer$q$, $q$East Imperial$q$, NULL, $q$NZ$q$, NULL, $q$https://eastimperial.co.nz/products/ginger-beer$q$, $q$producer$q$),
($q$East Imperial Grapefruit Soda$q$, $q$East Imperial Grapefruit Soda$q$, $q$Grapefruit Soda$q$, $q$East Imperial$q$, NULL, $q$NZ$q$, NULL, $q$https://eastimperial.co.nz/products/grapefruit-soda$q$, $q$producer$q$),
($q$East Imperial Grapefruit Tonic$q$, NULL, $q$Flavoured Tonic Water$q$, $q$East Imperial$q$, NULL, $q$NZ$q$, NULL, $q$https://eastimperial.co.nz/products/grapefruit-tonic$q$, $q$producer$q$),
($q$East Imperial Light Tonic Water$q$, NULL, $q$Light Tonic Water$q$, $q$East Imperial$q$, NULL, $q$NZ$q$, NULL, $q$https://eastimperial.co.nz/products/light-tonic-water$q$, $q$producer$q$),
($q$East Imperial New Zealand Tonic$q$, NULL, $q$Flavoured Tonic Water$q$, $q$East Imperial$q$, NULL, $q$NZ$q$, NULL, $q$https://eastimperial.co.nz/products/new-zealand-tonic$q$, $q$producer$q$),
($q$East Imperial Old World Tonic$q$, NULL, $q$Tonic Water$q$, $q$East Imperial$q$, NULL, NULL, NULL, $q$https://eastimperial.co.nz/products/old-world-tonic$q$, $q$producer$q$),
($q$East Imperial Rhubarb Tonic$q$, NULL, $q$Flavoured Tonic Water$q$, $q$East Imperial$q$, NULL, $q$NZ$q$, NULL, $q$https://eastimperial.co.nz/products/rhubarb-tonic$q$, $q$producer$q$),
($q$East Imperial Soda Water$q$, NULL, $q$Soda Water$q$, $q$East Imperial$q$, NULL, $q$NZ$q$, NULL, $q$https://eastimperial.co.nz/products/soda-water$q$, $q$producer$q$),
($q$East Imperial Tonic Water$q$, $q$East Imperial Tonic Water$q$, $q$Tonic Water$q$, $q$East Imperial$q$, NULL, $q$NZ$q$, NULL, $q$https://eastimperial.co.nz/products/tonic-water$q$, $q$producer$q$),
($q$East Imperial Yuzu Lemonade$q$, NULL, $q$Lemonade$q$, $q$East Imperial$q$, NULL, $q$NZ$q$, NULL, $q$https://eastimperial.co.nz/products/yuzu-lemonade$q$, $q$producer$q$),
($q$East Imperial Yuzu Tonic$q$, $q$East Imperial Yuzu Tonic Water$q$, $q$Flavoured Tonic Water$q$, $q$East Imperial$q$, NULL, $q$NZ$q$, NULL, $q$https://eastimperial.co.nz/products/yuzu-tonic$q$, $q$producer$q$),
($q$Fanta Berry$q$, NULL, $q$Mixer$q$, $q$Fanta$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/us/en/brands/fanta/products$q$, $q$producer$q$),
($q$Fanta Grape$q$, NULL, $q$Mixer$q$, $q$Fanta$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/us/en/brands/fanta/products$q$, $q$producer$q$),
($q$Fanta Orange$q$, $q$Fanta Orange$q$, $q$Orange Soda$q$, $q$Fanta$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/us/en/brands/fanta/products$q$, $q$producer$q$),
($q$Fanta Orange Mexico$q$, NULL, $q$Orange Soda$q$, $q$Fanta$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/us/en/brands/fanta/products$q$, $q$producer$q$),
($q$Fanta Pineapple$q$, NULL, $q$Pineapple Soda$q$, $q$Fanta$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/us/en/brands/fanta/products$q$, $q$producer$q$),
($q$Fanta Strawberry$q$, NULL, $q$Mixer$q$, $q$Fanta$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/us/en/brands/fanta/products$q$, $q$producer$q$),
($q$Fanta Zero Sugar Orange$q$, NULL, $q$Orange Soda$q$, $q$Fanta$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/us/en/brands/fanta/products$q$, $q$producer$q$),
($q$Fentimans Cherry Cola$q$, NULL, $q$Cola$q$, $q$Fentimans$q$, NULL, NULL, NULL, $q$https://www.fentimans.com/products/cherry-cola$q$, $q$producer$q$),
($q$Fentimans Connoisseurs Tonic Water$q$, NULL, $q$Tonic Water$q$, $q$Fentimans$q$, NULL, NULL, NULL, $q$https://www.fentimans.com/products/connoisseurs-tonic-water$q$, $q$producer$q$),
($q$Fentimans Curiosity Cola$q$, $q$Fentimans Curiosity Cola$q$, $q$Cola$q$, $q$Fentimans$q$, NULL, NULL, NULL, $q$https://www.fentimans.com/products/curiosity-cola$q$, $q$producer$q$),
($q$Fentimans Dandelion & Burdock$q$, NULL, $q$Mixer$q$, $q$Fentimans$q$, NULL, NULL, NULL, $q$https://www.fentimans.com/products/dandelion-burdock$q$, $q$producer$q$),
($q$Fentimans Dry Tonic$q$, NULL, $q$Tonic Water$q$, $q$Fentimans$q$, NULL, NULL, NULL, $q$https://www.fentimans.com/products/dry-tonic$q$, $q$producer$q$),
($q$Fentimans Elderflower & Rose Tonic$q$, NULL, $q$Elderflower Tonic$q$, $q$Fentimans$q$, NULL, NULL, NULL, $q$https://www.fentimans.com/products/elderflower-and-rose-tonic$q$, $q$producer$q$),
($q$Fentimans Elderflower Tonic Water$q$, NULL, $q$Elderflower Tonic$q$, $q$Fentimans$q$, NULL, NULL, NULL, $q$https://www.fentimans.com/products/elderflower-tonic-water$q$, $q$producer$q$),
($q$Fentimans English Apple$q$, NULL, $q$Mixer$q$, $q$Fentimans$q$, NULL, NULL, NULL, $q$https://www.fentimans.com/products/english-apple$q$, $q$producer$q$),
($q$Fentimans Gently Sparkling Elderflower$q$, NULL, $q$Mixer$q$, $q$Fentimans$q$, NULL, NULL, NULL, $q$https://www.fentimans.com/products/gently-sparkling-elderflower$q$, $q$producer$q$),
($q$Fentimans Ginger Ale$q$, NULL, $q$Ginger Ale$q$, $q$Fentimans$q$, NULL, NULL, NULL, $q$https://www.fentimans.com/products/ginger-ale$q$, $q$producer$q$),
($q$Fentimans Ginger Beer$q$, $q$Fentimans Ginger Beer$q$, $q$Ginger Beer$q$, $q$Fentimans$q$, NULL, NULL, NULL, $q$https://www.fentimans.com/products/ginger-beer$q$, $q$producer$q$),
($q$Fentimans Ginger Beer & Muddled Lime$q$, NULL, $q$Ginger Beer$q$, $q$Fentimans$q$, NULL, NULL, NULL, $q$https://www.fentimans.com/products/ginger-beer-muddled-lime$q$, $q$producer$q$),
($q$Fentimans Mandarin & Seville Orange Jigger$q$, NULL, $q$Orange Soda$q$, $q$Fentimans$q$, NULL, NULL, NULL, $q$https://www.fentimans.com/products/mandarin-seville-orange-jigger$q$, $q$producer$q$),
($q$Fentimans Naturally Light Tonic Water$q$, NULL, $q$Light Tonic Water$q$, $q$Fentimans$q$, NULL, NULL, NULL, $q$https://www.fentimans.com/products/naturally-light-tonic-water$q$, $q$producer$q$),
($q$Fentimans Orange Blossom$q$, NULL, $q$Mixer$q$, $q$Fentimans$q$, NULL, NULL, NULL, $q$https://www.fentimans.com/products/orange-blossom$q$, $q$producer$q$),
($q$Fentimans Oriental Yuzu Tonic$q$, NULL, $q$Flavoured Tonic Water$q$, $q$Fentimans$q$, NULL, NULL, NULL, $q$https://www.fentimans.com/products/oriental-yuzu-tonic-water$q$, $q$producer$q$),
($q$Fentimans Pink Ginger$q$, NULL, $q$Ginger Beer$q$, $q$Fentimans$q$, NULL, NULL, NULL, $q$https://www.fentimans.com/products/pink-ginger$q$, $q$producer$q$),
($q$Fentimans Pink Grapefruit Tonic Water$q$, NULL, $q$Flavoured Tonic Water$q$, $q$Fentimans$q$, NULL, NULL, NULL, $q$https://www.fentimans.com/products/pink-grapefruit-tonic-water$q$, $q$producer$q$),
($q$Fentimans Pink Rhubarb Tonic Water$q$, NULL, $q$Flavoured Tonic Water$q$, $q$Fentimans$q$, NULL, NULL, NULL, $q$https://www.fentimans.com/products/pink-rhubarb-tonic-water$q$, $q$producer$q$),
($q$Fentimans Premium Indian Tonic Water$q$, NULL, $q$Tonic Water$q$, $q$Fentimans$q$, NULL, NULL, NULL, $q$https://www.fentimans.com/products/premium-indian-tonic-water$q$, $q$producer$q$),
($q$Fentimans Raspberry Lemonade$q$, NULL, $q$Lemonade$q$, $q$Fentimans$q$, NULL, NULL, NULL, $q$https://www.fentimans.com/products/raspberry-lemonade$q$, $q$producer$q$),
($q$Fentimans Rhubarb Lemonade$q$, NULL, $q$Lemonade$q$, $q$Fentimans$q$, NULL, NULL, NULL, $q$https://www.fentimans.com/products/rhubarb-lemonade$q$, $q$producer$q$),
($q$Fentimans Rose Lemonade$q$, NULL, $q$Lemonade$q$, $q$Fentimans$q$, NULL, NULL, NULL, $q$https://www.fentimans.com/products/rose-lemonade$q$, $q$producer$q$),
($q$Fentimans Soda Water$q$, NULL, $q$Soda Water$q$, $q$Fentimans$q$, NULL, NULL, NULL, $q$https://www.fentimans.com/products/soda-water$q$, $q$producer$q$),
($q$Fentimans Tonic Water$q$, $q$Fentimans Botanical Tonic Water$q$, $q$Tonic Water$q$, $q$Fentimans$q$, NULL, NULL, NULL, $q$https://www.fentimans.com/products/tonic-water$q$, $q$producer$q$),
($q$Fentimans Valencian Orange Tonic Water$q$, NULL, $q$Flavoured Tonic Water$q$, $q$Fentimans$q$, NULL, NULL, NULL, $q$https://www.fentimans.com/products/valencian-orange-tonic-water$q$, $q$producer$q$),
($q$Fentimans Victorian Lemonade$q$, $q$Fentimans Victorian Lemonade$q$, $q$Lemonade$q$, $q$Fentimans$q$, NULL, NULL, NULL, $q$https://www.fentimans.com/products/victorian-lemonade$q$, $q$producer$q$),
($q$Fever-Tree Blood Orange Ginger Beer$q$, NULL, $q$Ginger Beer$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-gb/products/blood-orange-ginger-beer$q$, $q$producer$q$),
($q$Fever-Tree Classic Bloody Mary Mix$q$, NULL, $q$Mixer$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-us/products/classic-bloody-mary-mix$q$, $q$producer$q$),
($q$Fever-Tree Distillers Cola$q$, $q$Fever-Tree Distillers Cola$q$, $q$Cola$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-us/products/distillers-cola$q$, $q$producer$q$),
($q$Fever-Tree Elderflower Tonic Water$q$, $q$Fever-Tree Elderflower Tonic Water$q$, $q$Elderflower Tonic$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-gb/products/elderflower-tonic$q$, $q$producer$q$),
($q$Fever-Tree Italian Blood Orange Soda$q$, NULL, $q$Orange Soda$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-gb/products/italian-blood-orange-soda-water$q$, $q$producer$q$),
($q$Fever-Tree Mediterranean Tonic Water$q$, $q$Fever-Tree Mediterranean Tonic Water$q$, $q$Flavoured Tonic Water$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-gb/products/mediterranean-tonic$q$, $q$producer$q$),
($q$Fever-Tree Mexican Lime Soda$q$, NULL, $q$Mixer$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-gb/products/mexican-lime-soda-water$q$, $q$producer$q$),
($q$Fever-Tree Mojito Mixer$q$, NULL, $q$Mixer$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-gb/products/mojito-mixer$q$, $q$producer$q$),
($q$Fever-Tree Passion Fruit Martini Mixer$q$, NULL, $q$Mixer$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-gb/products/passion-fruit-martini-mixer$q$, $q$producer$q$),
($q$Fever-Tree Pineapple Ginger Beer$q$, NULL, $q$Ginger Beer$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-us/products/pineapple-ginger-beer$q$, $q$producer$q$),
($q$Fever-Tree Pink Grapefruit Soda$q$, NULL, $q$Grapefruit Soda$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-gb/products/pink-grapefruit-soda$q$, $q$producer$q$),
($q$Fever-Tree Premium Club Soda$q$, $q$Fever-Tree Club Soda$q$, $q$Soda Water$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-us/products/premium-club-soda$q$, $q$producer$q$),
($q$Fever-Tree Premium Ginger Ale$q$, $q$Fever-Tree Ginger Ale$q$, $q$Ginger Ale$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-gb/products/ginger-ale$q$, $q$producer$q$),
($q$Fever-Tree Premium Ginger Beer$q$, $q$Fever-Tree Ginger Beer$q$, $q$Ginger Beer$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-gb/products/ginger-beer$q$, $q$producer$q$),
($q$Fever-Tree Premium Indian Tonic Water$q$, $q$Fever-Tree Premium Indian Tonic Water$q$, $q$Tonic Water$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-gb/products/premium-indian-tonic-water$q$, $q$producer$q$),
($q$Fever-Tree Premium Lemonade$q$, NULL, $q$Lemonade$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-gb/products/premium-lemonade$q$, $q$producer$q$),
($q$Fever-Tree Premium Soda Water$q$, NULL, $q$Soda Water$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-gb/products/premium-soda-water$q$, $q$producer$q$),
($q$Fever-Tree Raspberry & Orange Blossom Soda$q$, $q$Fever-Tree Raspberry + Orange Blossom Soda$q$, $q$Mixer$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-gb/products/raspberry-orange-blossom-soda-water$q$, $q$producer$q$),
($q$Fever-Tree Raspberry Mojito Mixer$q$, NULL, $q$Mixer$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-gb/products/raspberry-mojito-mixer$q$, $q$producer$q$),
($q$Fever-Tree Refreshingly Light Aromatic Tonic Water$q$, NULL, $q$Light Tonic Water$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-gb/products/light-aromatic-tonic$q$, $q$producer$q$),
($q$Fever-Tree Refreshingly Light Cucumber Tonic Water$q$, NULL, $q$Light Tonic Water$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-gb/products/light-cucumber-tonic-water$q$, $q$producer$q$),
($q$Fever-Tree Refreshingly Light Elderflower Tonic Water$q$, NULL, $q$Light Tonic Water$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-gb/products/light-elderflower-tonic$q$, $q$producer$q$),
($q$Fever-Tree Refreshingly Light Ginger Ale$q$, NULL, $q$Ginger Ale$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-gb/products/light-ginger-ale$q$, $q$producer$q$),
($q$Fever-Tree Refreshingly Light Ginger Beer$q$, NULL, $q$Ginger Beer$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-gb/products/light-ginger-beer$q$, $q$producer$q$),
($q$Fever-Tree Refreshingly Light Indian Tonic Water$q$, $q$Fever-Tree Refreshingly Light Tonic Water$q$, $q$Light Tonic Water$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-gb/products/light-premium-indian-tonic-water$q$, $q$producer$q$),
($q$Fever-Tree Refreshingly Light Lemon Tonic Water$q$, $q$Fever-Tree Lemon Tonic$q$, $q$Light Tonic Water$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-gb/products/light-lemon-tonic$q$, $q$producer$q$),
($q$Fever-Tree Refreshingly Light Madagascan Cola$q$, NULL, $q$Cola$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-gb/products/refreshingly-light-madagascan-cola$q$, $q$producer$q$),
($q$Fever-Tree Refreshingly Light Mediterranean Tonic Water$q$, NULL, $q$Light Tonic Water$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-gb/products/light-mediterranean-tonic$q$, $q$producer$q$),
($q$Fever-Tree Refreshingly Light Premium Lemonade$q$, NULL, $q$Lemonade$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-gb/products/refreshingly-light-premium-lemonade$q$, $q$producer$q$),
($q$Fever-Tree Refreshingly Light Rhubarb & Raspberry Tonic Water$q$, NULL, $q$Light Tonic Water$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-gb/products/light-rhubarb-raspberry-tonic$q$, $q$producer$q$),
($q$Fever-Tree Refreshingly Light Sicilian Lemonade$q$, NULL, $q$Lemonade$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-gb/products/light-sicilian-lemonade$q$, $q$producer$q$),
($q$Fever-Tree Refreshingly Light Spanish Clementine Tonic Water$q$, NULL, $q$Light Tonic Water$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-gb/products/light-spanish-clementine-tonic$q$, $q$producer$q$),
($q$Fever-Tree Refreshingly Light Spiced Orange Ginger Ale$q$, NULL, $q$Ginger Ale$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-gb/products/light-spiced-orange-ginger-ale$q$, $q$producer$q$),
($q$Fever-Tree Sparkling Cucumber$q$, NULL, $q$Mixer$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-us/range/sparkling$q$, $q$producer$q$),
($q$Fever-Tree Sparkling English Elderflower$q$, NULL, $q$Mixer$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-gb/products/sparkling-english-elderflower$q$, $q$producer$q$),
($q$Fever-Tree Sparkling Ginger Beer$q$, NULL, $q$Ginger Beer$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-gb/products/sparkling-ginger-beer$q$, $q$producer$q$),
($q$Fever-Tree Sparkling Lime & Yuzu$q$, $q$Fever-Tree Lime & Yuzu Soda$q$, $q$Yuzu Soda$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-us/products/sparkling-lime-yuzu$q$, $q$producer$q$),
($q$Fever-Tree Sparkling Mexican Lime$q$, NULL, $q$Mixer$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-gb/products/sparkling-mexican-lime$q$, $q$producer$q$),
($q$Fever-Tree Sparkling Pink Grapefruit$q$, $q$Fever-Tree Sparkling Pink Grapefruit$q$, $q$Grapefruit Soda$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-us/products/sparkling-pink-grapefruit$q$, $q$producer$q$),
($q$Fever-Tree Sparkling Raspberry Lemonade$q$, NULL, $q$Lemonade$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-gb/products/raspberry-lemonade$q$, $q$producer$q$),
($q$Fever-Tree Sparkling Sicilian Lemonade$q$, NULL, $q$Lemonade$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-us/products/sparkling-sicilian-lemonade$q$, $q$producer$q$),
($q$Fever-Tree Spiced Orange Ginger Ale$q$, NULL, $q$Ginger Ale$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-gb/products/spiced-orange-ginger-ale$q$, $q$producer$q$),
($q$Fever-Tree White Grape & Apricot Soda$q$, NULL, $q$Mixer$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-gb/products/white-grape-apricot-soda-water$q$, $q$producer$q$),
($q$Franklin & Sons 1886 Club Soda$q$, NULL, $q$Soda Water$q$, $q$Franklin & Sons$q$, NULL, $q$GB$q$, NULL, $q$https://franklinandsons.com/product/soda-water/$q$, $q$producer$q$),
($q$Franklin & Sons Brewed Ginger Beer$q$, NULL, $q$Ginger Beer$q$, $q$Franklin & Sons$q$, NULL, $q$GB$q$, NULL, $q$https://franklinandsons.com/product/brewed-ginger-beer-tonic/$q$, $q$producer$q$),
($q$Franklin & Sons Elderflower & Cucumber Tonic Water$q$, NULL, $q$Elderflower Tonic$q$, $q$Franklin & Sons$q$, NULL, $q$GB$q$, NULL, $q$https://franklinandsons.com/product/elderflower-cucumber-tonic-water/$q$, $q$producer$q$),
($q$Franklin & Sons Original Ginger Ale$q$, NULL, $q$Ginger Ale$q$, $q$Franklin & Sons$q$, NULL, $q$GB$q$, NULL, $q$https://franklinandsons.com/product/original-ginger-ale/$q$, $q$producer$q$),
($q$Franklin & Sons Premium Indian Tonic Water$q$, NULL, $q$Tonic Water$q$, $q$Franklin & Sons$q$, NULL, $q$GB$q$, NULL, $q$https://franklinandsons.com/product/premium-indian-tonic-water/$q$, $q$producer$q$),
($q$Franklin & Sons Premium Light Tonic Water$q$, NULL, $q$Light Tonic Water$q$, $q$Franklin & Sons$q$, NULL, $q$GB$q$, NULL, $q$https://franklinandsons.com/product/premium-light-tonic-water/$q$, $q$producer$q$),
($q$Franklin & Sons Rosemary & Black Olive Tonic Water$q$, NULL, $q$Flavoured Tonic Water$q$, $q$Franklin & Sons$q$, NULL, $q$GB$q$, NULL, $q$https://franklinandsons.com/product/rosemary-black-olive-tonic-water/$q$, $q$producer$q$),
($q$Franklin & Sons Sicilian Lemon Tonic Water$q$, NULL, $q$Flavoured Tonic Water$q$, $q$Franklin & Sons$q$, NULL, $q$GB$q$, NULL, $q$https://franklinandsons.com/product/sicilian-lemon-tonic-water/$q$, $q$producer$q$),
($q$Franklin & Sons Sparkling Guava & Lime$q$, NULL, $q$Mixer$q$, $q$Franklin & Sons$q$, NULL, $q$GB$q$, NULL, $q$https://franklinandsons.com/product/guava-lime-soda/$q$, $q$producer$q$),
($q$Franklin & Sons Sparkling Pineapple & Almond$q$, NULL, $q$Pineapple Soda$q$, $q$Franklin & Sons$q$, NULL, $q$GB$q$, NULL, $q$https://franklinandsons.com/product/pineapple-soda/$q$, $q$producer$q$),
($q$Franklin & Sons Sparkling Pink Grapefruit$q$, NULL, $q$Grapefruit Soda$q$, $q$Franklin & Sons$q$, NULL, $q$GB$q$, NULL, $q$https://franklinandsons.com/product/pink-grapefruit-soda/$q$, $q$producer$q$),
($q$Fresca Black Cherry Citrus$q$, NULL, $q$Mixer$q$, $q$Fresca$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/us/en/brands/fresca-sparking-soda$q$, $q$producer$q$),
($q$Fresca Grapefruit Citrus$q$, NULL, $q$Grapefruit Soda$q$, $q$Fresca$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/us/en/brands/fresca-sparking-soda$q$, $q$producer$q$),
($q$Fresca Peach Citrus$q$, NULL, $q$Mixer$q$, $q$Fresca$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/us/en/brands/fresca-sparking-soda$q$, $q$producer$q$),
($q$Fresca Prebiotic Soda$q$, NULL, $q$Mixer$q$, $q$Fresca$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/us/en/brands/fresca-sparking-soda$q$, $q$producer$q$),
($q$Gerolsteiner Medium$q$, NULL, $q$Soda Water$q$, $q$Gerolsteiner$q$, NULL, $q$DE$q$, NULL, $q$https://www.gerolsteiner.de/en/$q$, $q$producer$q$),
($q$Gerolsteiner Sparkling Mineral Water$q$, $q$Gerolsteiner Sparkling Mineral Water$q$, $q$Soda Water$q$, $q$Gerolsteiner$q$, NULL, $q$DE$q$, NULL, $q$https://gerolsteiner.de/en/products/usa$q$, $q$producer$q$),
($q$Goslings Diet Stormy Ginger Beer$q$, NULL, $q$Ginger Beer$q$, $q$Goslings$q$, NULL, NULL, NULL, $q$https://goslings.com/newProduct/goslings-diet-stormy-ginger-beer/$q$, $q$producer$q$),
($q$Goslings Stormy Ginger Beer$q$, $q$Gosling's Stormy Ginger Beer$q$, $q$Ginger Beer$q$, $q$Goslings$q$, NULL, NULL, NULL, $q$https://goslings.com/newProduct/goslings-stormy-ginger-beer/$q$, $q$producer$q$),
($q$Goslings Stormy Peach Ginger Beer$q$, NULL, $q$Ginger Beer$q$, $q$Goslings$q$, NULL, NULL, NULL, $q$https://goslings.com/newProduct/goslings-stormy-peach-ginger-beer/$q$, $q$producer$q$),
($q$Idyll Pine Forest Soda$q$, NULL, $q$Mixer$q$, $q$Idyll Drinks$q$, NULL, $q$GB$q$, NULL, $q$https://www.delli.market/products/idyll-drinks-pine-forest-soda$q$, $q$retailer$q$),
($q$Idyll Wild Apple Botanical Soda$q$, NULL, $q$Mixer$q$, $q$Idyll Drinks$q$, NULL, $q$GB$q$, NULL, $q$https://www.delli.market/products/idyll-drinks-wild-apple-botanical-soda$q$, $q$retailer$q$),
($q$Idyll Wild Gooseberry & Rooibos Soda$q$, NULL, $q$Mixer$q$, $q$Idyll Drinks$q$, NULL, $q$GB$q$, NULL, $q$https://www.delli.market/products/idyll-drinks-wild-gooseberry-rooibos-soda$q$, $q$retailer$q$),
($q$Idyll Wild Rhubarb & Meadowsweet Soda$q$, NULL, $q$Mixer$q$, $q$Idyll Drinks$q$, NULL, $q$GB$q$, NULL, $q$https://www.delli.market/products/idyll-drinks-wild-rhubarb-meadowsweet-soda$q$, $q$retailer$q$),
($q$Jarritos Fruit Punch$q$, NULL, $q$Mixer$q$, $q$Jarritos$q$, NULL, NULL, NULL, $q$https://jarritos.com/flavor/fruitpunch/$q$, $q$producer$q$),
($q$Jarritos Grapefruit$q$, $q$Jarritos Grapefruit Soda$q$, $q$Grapefruit Soda$q$, $q$Jarritos$q$, NULL, NULL, NULL, $q$https://jarritos.com/flavor/grapefruit/$q$, $q$producer$q$),
($q$Jarritos Guava$q$, $q$Jarritos Guava$q$, $q$Mixer$q$, $q$Jarritos$q$, NULL, NULL, NULL, $q$https://jarritos.com/flavor/guava/$q$, $q$producer$q$),
($q$Jarritos Lime$q$, $q$Jarritos Lime$q$, $q$Lemon-lime Soda$q$, $q$Jarritos$q$, NULL, NULL, NULL, $q$https://jarritos.com/flavor/lime/$q$, $q$producer$q$),
($q$Jarritos Mandarin$q$, NULL, $q$Orange Soda$q$, $q$Jarritos$q$, NULL, NULL, NULL, $q$https://jarritos.com/flavor/mandarin/$q$, $q$producer$q$),
($q$Jarritos Mandarin Zero$q$, NULL, $q$Orange Soda$q$, $q$Jarritos$q$, NULL, NULL, NULL, $q$https://jarritos.com/flavor/mandarin-zero/$q$, $q$producer$q$),
($q$Jarritos Mango$q$, NULL, $q$Mixer$q$, $q$Jarritos$q$, NULL, NULL, NULL, $q$https://jarritos.com/flavor/mango/$q$, $q$producer$q$),
($q$Jarritos Mexican Cola$q$, $q$Jarritos Mexican Cola$q$, $q$Cola$q$, $q$Jarritos$q$, NULL, NULL, NULL, $q$https://jarritos.com/flavor/mexican-cola/$q$, $q$producer$q$),
($q$Jarritos Passion Fruit$q$, NULL, $q$Mixer$q$, $q$Jarritos$q$, NULL, NULL, NULL, $q$https://jarritos.com/flavor/passion-fruit/$q$, $q$producer$q$),
($q$Jarritos Pineapple$q$, $q$Jarritos Pineapple Soda$q$, $q$Pineapple Soda$q$, $q$Jarritos$q$, NULL, NULL, NULL, $q$https://jarritos.com/flavor/pineapple/$q$, $q$producer$q$),
($q$Jarritos Strawberry$q$, NULL, $q$Mixer$q$, $q$Jarritos$q$, NULL, NULL, NULL, $q$https://jarritos.com/flavor/strawberry/$q$, $q$producer$q$),
($q$Jarritos Tamarind$q$, NULL, $q$Mixer$q$, $q$Jarritos$q$, NULL, NULL, NULL, $q$https://jarritos.com/flavor/tamarind/$q$, $q$producer$q$),
($q$Jarritos Watermelon$q$, NULL, $q$Mixer$q$, $q$Jarritos$q$, NULL, NULL, NULL, $q$https://jarritos.com/flavor/watermelon/$q$, $q$producer$q$),
($q$Karma Cherry Lee Cherry Soda$q$, NULL, $q$Mixer$q$, $q$Karma Drinks$q$, NULL, NULL, NULL, $q$https://www.amnestyshop.org.uk/products/karma-drinks/karma-drinks-organic-cherry-lee-cherry-soda---250ml/$q$, $q$retailer$q$),
($q$Karma Cola$q$, $q$Karma Cola$q$, $q$Cola$q$, $q$Karma Drinks$q$, NULL, NULL, NULL, $q$https://www.amnestyshop.org.uk/products/karma-drinks/karma-cola-original---250ml/$q$, $q$retailer$q$),
($q$Karma Cola Sugar Free$q$, NULL, $q$Cola$q$, $q$Karma Drinks$q$, NULL, NULL, NULL, $q$https://www.amnestyshop.org.uk/products/karma-drinks/karma-cola-sugar-free---250ml/$q$, $q$retailer$q$),
($q$Karma Gingerella Ginger Ale$q$, NULL, $q$Ginger Ale$q$, $q$Karma Drinks$q$, NULL, NULL, NULL, $q$https://www.amnestyshop.org.uk/products/karma-drinks/karma-drinks-gingerella-ginger-ale---250ml/$q$, $q$retailer$q$),
($q$Karma Lemony Lemonade$q$, NULL, $q$Lemonade$q$, $q$Karma Drinks$q$, NULL, NULL, NULL, $q$https://www.amnestyshop.org.uk/products/karma-drinks/fairtrade-lemony-lemonade---250ml/$q$, $q$retailer$q$),
($q$Karma Razza Raspberry Lemonade$q$, NULL, $q$Lemonade$q$, $q$Karma Drinks$q$, NULL, NULL, NULL, $q$https://www.amnestyshop.org.uk/products/karma-drinks/karma-drinks-razza-raspberry-lemonade---250ml/$q$, $q$retailer$q$),
($q$Karma Tropikool Mango & Passion Fruit Soda$q$, NULL, $q$Mixer$q$, $q$Karma Drinks$q$, NULL, NULL, NULL, $q$https://www.amnestyshop.org.uk/products/karma-drinks/karma-drinks-organic-tropikool-mango---passion-fruit-soda---250ml/$q$, $q$retailer$q$),
($q$Le Tribute Ginger Ale$q$, NULL, $q$Ginger Ale$q$, $q$Le Tribute$q$, NULL, NULL, NULL, $q$https://www.vinetur.com/2025120994058/le-tribute-lanza-en-barcelona-una-gama-de-mixers-artesanales-para-cocteles-con-botella-cuadrada-y-agua-de-manantial.html$q$, $q$reference$q$),
($q$Le Tribute Ginger Beer$q$, NULL, $q$Ginger Beer$q$, $q$Le Tribute$q$, NULL, NULL, NULL, $q$https://www.vinetur.com/2025120994058/le-tribute-lanza-en-barcelona-una-gama-de-mixers-artesanales-para-cocteles-con-botella-cuadrada-y-agua-de-manantial.html$q$, $q$reference$q$),
($q$Le Tribute Lemonade$q$, NULL, $q$Lemonade$q$, $q$Le Tribute$q$, NULL, NULL, NULL, $q$https://www.vinetur.com/2025120994058/le-tribute-lanza-en-barcelona-una-gama-de-mixers-artesanales-para-cocteles-con-botella-cuadrada-y-agua-de-manantial.html$q$, $q$reference$q$),
($q$Le Tribute Olive Lemonade$q$, NULL, $q$Lemonade$q$, $q$Le Tribute$q$, NULL, NULL, NULL, $q$https://www.vinetur.com/2025120994058/le-tribute-lanza-en-barcelona-una-gama-de-mixers-artesanales-para-cocteles-con-botella-cuadrada-y-agua-de-manantial.html$q$, $q$reference$q$),
($q$Le Tribute Pink Grapefruit$q$, NULL, $q$Grapefruit Soda$q$, $q$Le Tribute$q$, NULL, NULL, NULL, $q$https://www.vinetur.com/2025120994058/le-tribute-lanza-en-barcelona-una-gama-de-mixers-artesanales-para-cocteles-con-botella-cuadrada-y-agua-de-manantial.html$q$, $q$reference$q$),
($q$Le Tribute Soda Water$q$, NULL, $q$Soda Water$q$, $q$Le Tribute$q$, NULL, NULL, NULL, $q$https://www.vinetur.com/2025120994058/le-tribute-lanza-en-barcelona-una-gama-de-mixers-artesanales-para-cocteles-con-botella-cuadrada-y-agua-de-manantial.html$q$, $q$reference$q$),
($q$Le Tribute Tonic Water$q$, NULL, $q$Tonic Water$q$, $q$Le Tribute$q$, NULL, NULL, NULL, $q$https://www.vinetur.com/2025120994058/le-tribute-lanza-en-barcelona-una-gama-de-mixers-artesanales-para-cocteles-con-botella-cuadrada-y-agua-de-manantial.html$q$, $q$reference$q$),
($q$Le Tribute Tonic Water Zero$q$, NULL, $q$Light Tonic Water$q$, $q$Le Tribute$q$, NULL, NULL, NULL, $q$https://www.vinetur.com/2025120994058/le-tribute-lanza-en-barcelona-una-gama-de-mixers-artesanales-para-cocteles-con-botella-cuadrada-y-agua-de-manantial.html$q$, $q$reference$q$),
($q$London Essence Aromatic Orange & Fig Crafted Soda$q$, NULL, $q$Orange Soda$q$, $q$London Essence Co.$q$, NULL, NULL, NULL, $q$https://www.londonessenceco.com/drinks/sodas-lemonade/aromatic-orange-fig/$q$, $q$producer$q$),
($q$London Essence Blood Orange & Elderflower Tonic Water$q$, NULL, $q$Flavoured Tonic Water$q$, $q$London Essence Co.$q$, NULL, NULL, NULL, $q$https://www.londonessenceco.com/drinks/tonics/blood-orange-elderflower/$q$, $q$producer$q$),
($q$London Essence Crafted Lemonade$q$, NULL, $q$Lemonade$q$, $q$London Essence Co.$q$, NULL, NULL, NULL, $q$https://www.londonessenceco.com/drinks/sodas-lemonade/crafted-lemonade/$q$, $q$producer$q$),
($q$London Essence Delicate Ginger Ale$q$, NULL, $q$Ginger Ale$q$, $q$London Essence Co.$q$, NULL, NULL, NULL, $q$https://www.londonessenceco.com/drinks/gingers/delicate-ginger-ale/$q$, $q$producer$q$),
($q$London Essence Grapefruit & Rosemary Tonic Water$q$, NULL, $q$Flavoured Tonic Water$q$, $q$London Essence Co.$q$, NULL, NULL, NULL, $q$https://www.londonessenceco.com/drinks/tonics/grapefruit-rosemary/$q$, $q$producer$q$),
($q$London Essence Original Indian Tonic Water$q$, $q$London Essence Original Indian Tonic Water$q$, $q$Tonic Water$q$, $q$London Essence Co.$q$, NULL, NULL, NULL, $q$https://www.londonessenceco.com/drinks/tonics/original-indian/$q$, $q$producer$q$),
($q$London Essence Pink Grapefruit Crafted Soda$q$, NULL, $q$Grapefruit Soda$q$, $q$London Essence Co.$q$, NULL, NULL, NULL, $q$https://www.londonessenceco.com/drinks/sodas-lemonade/pink-grapefruit/$q$, $q$producer$q$),
($q$London Essence Raspberry & Rose Crafted Soda$q$, NULL, $q$Mixer$q$, $q$London Essence Co.$q$, NULL, NULL, NULL, $q$https://www.londonessenceco.com/drinks/sodas-lemonade/raspberry-rose/$q$, $q$producer$q$),
($q$London Essence Roasted Pineapple Crafted Soda$q$, NULL, $q$Pineapple Soda$q$, $q$London Essence Co.$q$, NULL, NULL, NULL, $q$https://www.londonessenceco.com/drinks/sodas-lemonade/roasted-pineapple/$q$, $q$producer$q$),
($q$London Essence White Peach & Jasmine Crafted Soda$q$, $q$London Essence White Peach & Jasmine Soda$q$, $q$Mixer$q$, $q$London Essence Co.$q$, NULL, NULL, NULL, $q$https://www.londonessenceco.com/drinks/sodas-lemonade/white-peach-jasmine/$q$, $q$producer$q$),
($q$Lurisia Il Nostro Chinotto$q$, $q$Lurisia Chinotto$q$, $q$Chinotto$q$, $q$Lurisia$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/it/it/brands/Lurisia/bibite$q$, $q$producer$q$),
($q$Lurisia La Nostra Acqua Tonica$q$, NULL, $q$Tonic Water$q$, $q$Lurisia$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/it/it/brands/Lurisia/bibite$q$, $q$producer$q$),
($q$Lurisia La Nostra Aranciata$q$, NULL, $q$Orange Soda$q$, $q$Lurisia$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/it/it/brands/Lurisia/bibite$q$, $q$producer$q$),
($q$Lurisia La Nostra Aranciata Amara$q$, NULL, $q$Orange Soda$q$, $q$Lurisia$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/it/it/brands/Lurisia/bibite$q$, $q$producer$q$),
($q$Lurisia La Nostra Aranciata Rossa$q$, NULL, $q$Orange Soda$q$, $q$Lurisia$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/it/it/brands/Lurisia/bibite$q$, $q$producer$q$),
($q$Lurisia La Nostra Gazzosa$q$, NULL, $q$Lemon-lime Soda$q$, $q$Lurisia$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/it/it/brands/Lurisia/bibite$q$, $q$producer$q$),
($q$Lurisia La Nostra Limonata$q$, NULL, $q$Lemonade$q$, $q$Lurisia$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/it/it/brands/Lurisia/bibite$q$, $q$producer$q$),
($q$Mezzanine Makers Dragon Well Tea Tonic$q$, NULL, $q$Flavoured Tonic Water$q$, $q$Mezzanine Makers$q$, NULL, $q$HK$q$, NULL, $q$https://www.mezzaninemakers.jp/products/dragon-well-tea-tonic$q$, $q$producer$q$),
($q$Mezzanine Makers Extra Herbal Tonic$q$, $q$Mezzanine Makers Extra-Herbal Tonic$q$, $q$Tonic Water$q$, $q$Mezzanine Makers$q$, NULL, $q$HK$q$, NULL, $q$https://www.mezzaninemakers.jp/products/extra-herbal-tonic$q$, $q$producer$q$),
($q$Mezzanine Makers Herbal Tonic Water$q$, NULL, $q$Tonic Water$q$, $q$Mezzanine Makers$q$, NULL, $q$HK$q$, NULL, $q$https://www.mezzaninemakers.jp/products/herbal-tonic$q$, $q$producer$q$),
($q$Mezzanine Makers Jasmine Tonic Water$q$, NULL, $q$Flavoured Tonic Water$q$, $q$Mezzanine Makers$q$, NULL, $q$HK$q$, NULL, $q$https://www.mezzaninemakers.jp/products/jasmine-tonic$q$, $q$producer$q$),
($q$Mezzanine Makers Salted Lime Tonic$q$, NULL, $q$Flavoured Tonic Water$q$, $q$Mezzanine Makers$q$, NULL, $q$HK$q$, NULL, $q$https://www.mezzaninemakers.jp/products/salted-lime-tonic$q$, $q$producer$q$),
($q$Mezzanine Makers Spicy Ginger Soda$q$, NULL, $q$Mixer$q$, $q$Mezzanine Makers$q$, NULL, $q$HK$q$, NULL, $q$https://www.mezzaninemakers.jp/products/spicy-ginger-soda$q$, $q$producer$q$),
($q$Old Jamaica Extra Fiery Ginger Beer$q$, NULL, $q$Ginger Beer$q$, $q$Old Jamaica$q$, NULL, NULL, NULL, $q$https://oldjamaicagingerbeer.com/$q$, $q$producer$q$),
($q$Old Jamaica Ginger Beer$q$, $q$Old Jamaica Ginger Beer$q$, $q$Ginger Beer$q$, $q$Old Jamaica$q$, NULL, NULL, NULL, $q$https://oldjamaicagingerbeer.com/$q$, $q$producer$q$),
($q$Old Jamaica Light Ginger Beer$q$, NULL, $q$Ginger Beer$q$, $q$Old Jamaica$q$, NULL, NULL, NULL, $q$https://oldjamaicagingerbeer.com/$q$, $q$producer$q$),
($q$Orangina Original$q$, $q$Orangina$q$, $q$Orange Soda$q$, $q$Orangina$q$, NULL, NULL, NULL, $q$https://www.rohlik.cz/1293593-orangina-regular-lemonade$q$, $q$retailer$q$),
($q$Orangina Zero Sugar$q$, NULL, $q$Orange Soda$q$, $q$Orangina$q$, NULL, NULL, NULL, $q$https://www.costco.ca/p/-/orangina-zero-sugar-sparkling-citrus-beverage-cans-330-ml-x-24-pack/4000400131$q$, $q$retailer$q$),
($q$Paulaner Limo Orange$q$, NULL, $q$Orange Soda$q$, $q$Paulaner$q$, NULL, $q$DE$q$, NULL, $q$https://www.paulaner.com/$q$, $q$producer$q$),
($q$Paulaner Limo Zitrone$q$, NULL, $q$Lemonade$q$, $q$Paulaner$q$, NULL, $q$DE$q$, NULL, $q$https://www.paulaner.com/$q$, $q$producer$q$),
($q$Paulaner Spezi$q$, NULL, $q$Cola$q$, $q$Paulaner$q$, NULL, $q$DE$q$, NULL, $q$https://www.paulaner.com/$q$, $q$producer$q$),
($q$Paulaner Spezi Zero$q$, NULL, $q$Cola$q$, $q$Paulaner$q$, NULL, $q$DE$q$, NULL, $q$https://www.paulaner.com/$q$, $q$producer$q$),
($q$Pepsi$q$, $q$Pepsi$q$, $q$Cola$q$, $q$Pepsi$q$, NULL, NULL, NULL, $q$https://www.pepsico.com/brands/pepsi$q$, $q$producer$q$),
($q$Polar Bitter Lemon$q$, NULL, $q$Bitter Lemon$q$, $q$Polar$q$, NULL, $q$US$q$, NULL, $q$https://polarmixers.com/sours/$q$, $q$producer$q$),
($q$Polar Club Soda$q$, NULL, $q$Soda Water$q$, $q$Polar$q$, NULL, $q$US$q$, NULL, $q$https://polarmixers.com/Club-Soda/$q$, $q$producer$q$),
($q$Polar Club Soda with Lemon$q$, NULL, $q$Soda Water$q$, $q$Polar$q$, NULL, $q$US$q$, NULL, $q$https://polarmixers.com/Club-Soda/$q$, $q$producer$q$),
($q$Polar Club Soda with Lime$q$, NULL, $q$Soda Water$q$, $q$Polar$q$, NULL, $q$US$q$, NULL, $q$https://polarmixers.com/Club-Soda/$q$, $q$producer$q$),
($q$Polar Diet Ginger Ale$q$, NULL, $q$Ginger Ale$q$, $q$Polar$q$, NULL, $q$US$q$, NULL, $q$https://polarmixers.com/ginger-ale/$q$, $q$producer$q$),
($q$Polar Diet Half & Half$q$, NULL, $q$Mixer$q$, $q$Polar$q$, NULL, $q$US$q$, NULL, $q$https://polarmixers.com/sours/$q$, $q$producer$q$),
($q$Polar Diet Tonic Water$q$, NULL, $q$Light Tonic Water$q$, $q$Polar$q$, NULL, $q$US$q$, NULL, $q$https://polarmixers.com/tonic-water/$q$, $q$producer$q$),
($q$Polar Diet Tonic Water with Lime$q$, NULL, $q$Light Tonic Water$q$, $q$Polar$q$, NULL, $q$US$q$, NULL, $q$https://polarmixers.com/tonic-water/$q$, $q$producer$q$),
($q$Polar Ginger Ale$q$, NULL, $q$Ginger Ale$q$, $q$Polar$q$, NULL, $q$US$q$, NULL, $q$https://polarmixers.com/ginger-ale/$q$, $q$producer$q$),
($q$Polar Ginger Ale with Green Tea$q$, NULL, $q$Ginger Ale$q$, $q$Polar$q$, NULL, $q$US$q$, NULL, $q$https://polarmixers.com/ginger-ale/$q$, $q$producer$q$),
($q$Polar Golden Ginger Ale$q$, NULL, $q$Ginger Ale$q$, $q$Polar$q$, NULL, $q$US$q$, NULL, $q$https://polarmixers.com/ginger-ale/$q$, $q$producer$q$),
($q$Polar Half & Half$q$, NULL, $q$Mixer$q$, $q$Polar$q$, NULL, $q$US$q$, NULL, $q$https://polarmixers.com/sours/$q$, $q$producer$q$),
($q$Polar Seltzer Original$q$, $q$Polar Seltzer$q$, $q$Soda Water$q$, $q$Polar$q$, NULL, $q$US$q$, NULL, $q$https://polarseltzer.com/seltzers/$q$, $q$producer$q$),
($q$Polar Tonic Water$q$, NULL, $q$Tonic Water$q$, $q$Polar$q$, NULL, $q$US$q$, NULL, $q$https://polarmixers.com/tonic-water/$q$, $q$producer$q$),
($q$Polar Tonic Water with Lime$q$, NULL, $q$Flavoured Tonic Water$q$, $q$Polar$q$, NULL, $q$US$q$, NULL, $q$https://polarmixers.com/tonic-water/$q$, $q$producer$q$),
($q$Polar Vichy Water$q$, NULL, $q$Soda Water$q$, $q$Polar$q$, NULL, $q$US$q$, NULL, $q$https://polarmixers.com/Club-Soda/$q$, $q$producer$q$),
($q$Q Mixers Bloody Mary Mix$q$, NULL, $q$Mixer$q$, $q$Q Mixers$q$, NULL, NULL, NULL, $q$https://qmixers.com/our-mixers/$q$, $q$producer$q$),
($q$Q Mixers Club Soda$q$, $q$Q Mixers Club Soda$q$, $q$Soda Water$q$, $q$Q Mixers$q$, NULL, NULL, NULL, $q$https://qmixers.com/our-mixers/$q$, $q$producer$q$),
($q$Q Mixers Cranberry Pomegranate Spritz$q$, NULL, $q$Mixer$q$, $q$Q Mixers$q$, NULL, NULL, NULL, $q$https://qmixers.com/our-mixers/$q$, $q$producer$q$),
($q$Q Mixers Elderflower Tonic Water$q$, NULL, $q$Elderflower Tonic$q$, $q$Q Mixers$q$, NULL, NULL, NULL, $q$https://qmixers.com/our-mixers/$q$, $q$producer$q$),
($q$Q Mixers Ginger Ale$q$, $q$Q Mixers Spectacular Ginger Ale$q$, $q$Ginger Ale$q$, $q$Q Mixers$q$, NULL, NULL, NULL, $q$https://qmixers.com/our-mixers/$q$, $q$producer$q$),
($q$Q Mixers Ginger Beer$q$, $q$Q Mixers Ginger Beer$q$, $q$Ginger Beer$q$, $q$Q Mixers$q$, NULL, NULL, NULL, $q$https://qmixers.com/our-mixers/$q$, $q$producer$q$),
($q$Q Mixers Hibiscus Ginger Beer$q$, NULL, $q$Ginger Beer$q$, $q$Q Mixers$q$, NULL, NULL, NULL, $q$https://qmixers.com/our-mixers/$q$, $q$producer$q$),
($q$Q Mixers Light Ginger Beer$q$, NULL, $q$Ginger Beer$q$, $q$Q Mixers$q$, NULL, NULL, NULL, $q$https://qmixers.com/our-mixers/$q$, $q$producer$q$),
($q$Q Mixers Light Tonic Water$q$, NULL, $q$Light Tonic Water$q$, $q$Q Mixers$q$, NULL, NULL, NULL, $q$https://qmixers.com/our-mixers/$q$, $q$producer$q$),
($q$Q Mixers Sparkling Grapefruit$q$, $q$Q Mixers Grapefruit Soda$q$, $q$Grapefruit Soda$q$, $q$Q Mixers$q$, NULL, NULL, NULL, $q$https://qmixers.com/our-mixers/$q$, $q$producer$q$),
($q$Q Mixers Tonic Water$q$, $q$Q Mixers Spectacular Tonic Water$q$, $q$Tonic Water$q$, $q$Q Mixers$q$, NULL, NULL, NULL, $q$https://qmixers.com/our-mixers/$q$, $q$producer$q$),
($q$Q Mixers Tonic Water with Lime$q$, NULL, $q$Flavoured Tonic Water$q$, $q$Q Mixers$q$, NULL, NULL, NULL, $q$https://qmixers.com/our-mixers/$q$, $q$producer$q$),
($q$Q Mixers Tropical Ginger Beer$q$, NULL, $q$Ginger Beer$q$, $q$Q Mixers$q$, NULL, NULL, NULL, $q$https://qmixers.com/our-mixers/$q$, $q$producer$q$),
($q$Red Bull Amber Edition$q$, NULL, $q$Energy Drink$q$, $q$Red Bull$q$, NULL, NULL, NULL, $q$https://www.redbull.com/us-en/energydrink$q$, $q$producer$q$),
($q$Red Bull Apple Edition$q$, NULL, $q$Energy Drink$q$, $q$Red Bull$q$, NULL, NULL, NULL, $q$https://www.redbull.com/us-en/energydrink$q$, $q$producer$q$),
($q$Red Bull Coconut Edition$q$, NULL, $q$Energy Drink$q$, $q$Red Bull$q$, NULL, NULL, NULL, $q$https://www.redbull.com/us-en/energydrink$q$, $q$producer$q$),
($q$Red Bull Energy Drink$q$, $q$Red Bull Energy Drink$q$, $q$Energy Drink$q$, $q$Red Bull$q$, NULL, NULL, NULL, $q$https://www.redbull.com/us-en/energydrink$q$, $q$producer$q$),
($q$Red Bull Iced Edition$q$, NULL, $q$Energy Drink$q$, $q$Red Bull$q$, NULL, NULL, NULL, $q$https://www.redbull.com/us-en/energydrink$q$, $q$producer$q$),
($q$Red Bull Iced Edition Sugarfree$q$, NULL, $q$Energy Drink$q$, $q$Red Bull$q$, NULL, NULL, NULL, $q$https://www.redbull.com/us-en/energydrink$q$, $q$producer$q$),
($q$Red Bull Peach Edition$q$, NULL, $q$Energy Drink$q$, $q$Red Bull$q$, NULL, NULL, NULL, $q$https://www.redbull.com/us-en/energydrink$q$, $q$producer$q$),
($q$Red Bull Peach Edition Sugarfree$q$, NULL, $q$Energy Drink$q$, $q$Red Bull$q$, NULL, NULL, NULL, $q$https://www.redbull.com/us-en/energydrink$q$, $q$producer$q$),
($q$Red Bull Pink Edition$q$, NULL, $q$Energy Drink$q$, $q$Red Bull$q$, NULL, NULL, NULL, $q$https://www.redbull.com/us-en/energydrink$q$, $q$producer$q$),
($q$Red Bull Pink Edition Sugarfree$q$, NULL, $q$Energy Drink$q$, $q$Red Bull$q$, NULL, NULL, NULL, $q$https://www.redbull.com/us-en/energydrink$q$, $q$producer$q$),
($q$Red Bull Red Edition$q$, NULL, $q$Energy Drink$q$, $q$Red Bull$q$, NULL, NULL, NULL, $q$https://www.redbull.com/us-en/energydrink$q$, $q$producer$q$),
($q$Red Bull Sea Blue Edition$q$, NULL, $q$Energy Drink$q$, $q$Red Bull$q$, NULL, NULL, NULL, $q$https://www.redbull.com/us-en/energydrink$q$, $q$producer$q$),
($q$Red Bull Sea Blue Edition Sugarfree$q$, NULL, $q$Energy Drink$q$, $q$Red Bull$q$, NULL, NULL, NULL, $q$https://www.redbull.com/us-en/energydrink$q$, $q$producer$q$),
($q$Red Bull Sugarfree$q$, NULL, $q$Energy Drink$q$, $q$Red Bull$q$, NULL, NULL, NULL, $q$https://www.redbull.com/us-en/energydrink$q$, $q$producer$q$),
($q$Red Bull Yellow Edition$q$, NULL, $q$Energy Drink$q$, $q$Red Bull$q$, NULL, NULL, NULL, $q$https://www.redbull.com/us-en/energydrink$q$, $q$producer$q$),
($q$Red Bull Zero$q$, NULL, $q$Energy Drink$q$, $q$Red Bull$q$, NULL, NULL, NULL, $q$https://www.redbull.com/us-en/energydrink$q$, $q$producer$q$),
($q$Reed's Blackberry Ginger Ale$q$, NULL, $q$Ginger Ale$q$, $q$Reed's$q$, NULL, NULL, NULL, $q$https://www.drinkreeds.com/products/reeds-blackberry-ginger-ale-24-pack$q$, $q$producer$q$),
($q$Reed's Extra Ginger Beer$q$, $q$Reed's Extra Ginger Beer$q$, $q$Ginger Beer$q$, $q$Reed's$q$, NULL, NULL, NULL, $q$https://www.drinkreeds.com/products/reeds-extra-ginger-beer-24-pack-glass$q$, $q$producer$q$),
($q$Reed's Original Ginger Beer$q$, NULL, $q$Ginger Beer$q$, $q$Reed's$q$, NULL, NULL, NULL, $q$https://www.drinkreeds.com/products/reeds-original-ginger-beer-24-pack$q$, $q$producer$q$),
($q$Reed's Premium Ginger Beer$q$, NULL, $q$Ginger Beer$q$, $q$Reed's$q$, NULL, NULL, NULL, $q$https://www.drinkreeds.com/products/reeds-premium-ginger-beer$q$, $q$producer$q$),
($q$Reed's Real Ginger Ale$q$, NULL, $q$Ginger Ale$q$, $q$Reed's$q$, NULL, NULL, NULL, $q$https://www.drinkreeds.com/products/reeds-real-ginger-ale-24-pack$q$, $q$producer$q$),
($q$Reed's Strongest Ginger Beer$q$, NULL, $q$Ginger Beer$q$, $q$Reed's$q$, NULL, NULL, NULL, $q$https://www.drinkreeds.com/products/reeds-strongest-ginger-beer-24-pack-glass$q$, $q$producer$q$),
($q$Reed's Zero Sugar Extra Ginger Beer$q$, NULL, $q$Ginger Beer$q$, $q$Reed's$q$, NULL, NULL, NULL, $q$https://www.drinkreeds.com/products/reeds-zero-sugar-extra-ginger-beer-24-pack-glass$q$, $q$producer$q$),
($q$Reed's Zero Sugar Ginger Ale$q$, NULL, $q$Ginger Ale$q$, $q$Reed's$q$, NULL, NULL, NULL, $q$https://www.drinkreeds.com/products/reeds-zero-sugar-ginger-ale-24-pack$q$, $q$producer$q$),
($q$Regatta Classic Bermuda Stone Ginger Beer$q$, $q$Regatta Craft Ginger Beer$q$, $q$Ginger Beer$q$, $q$Regatta$q$, NULL, NULL, NULL, $q$https://regattacraftmixers.com/products/classic-bermuda-stone-ginger-beer$q$, $q$producer$q$),
($q$Regatta Dry Citrus Tonic$q$, NULL, $q$Tonic Water$q$, $q$Regatta$q$, NULL, NULL, NULL, $q$https://regattacraftmixers.com/products/dry-citrus-tonic-1$q$, $q$producer$q$),
($q$Regatta Light Ginger Beer$q$, NULL, $q$Ginger Beer$q$, $q$Regatta$q$, NULL, NULL, NULL, $q$https://regattacraftmixers.com/products/light-ginger-beer$q$, $q$producer$q$),
($q$Regatta Pacific Sea Salt Club Soda$q$, NULL, $q$Soda Water$q$, $q$Regatta$q$, NULL, NULL, NULL, $q$https://regattacraftmixers.com/products/pacific-sea-salt-club-soda$q$, $q$producer$q$),
($q$Regatta Royal Oak Ginger Ale$q$, NULL, $q$Ginger Ale$q$, $q$Regatta$q$, NULL, NULL, NULL, $q$https://regattacraftmixers.com/products/royal-oak-ginger-ale-1$q$, $q$producer$q$),
($q$Regatta Sparkling Sea Salt Grapefruit Refresher$q$, NULL, $q$Grapefruit Soda$q$, $q$Regatta$q$, NULL, NULL, NULL, $q$https://regattacraftmixers.com/products/grapefruit-glass-bottle$q$, $q$producer$q$),
($q$Sanpellegrino Aranciata Rossa$q$, $q$Sanpellegrino Aranciata Rossa$q$, $q$Orange Soda$q$, $q$Sanpellegrino$q$, NULL, NULL, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/7799/san-pellegrino-aranciata-rossa$q$, $q$reference$q$),
($q$Sanpellegrino Limonata$q$, $q$Sanpellegrino Limonata$q$, $q$Lemonade$q$, $q$Sanpellegrino$q$, NULL, NULL, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/7944/san-pellegrino-limonata$q$, $q$reference$q$),
($q$Sanpellegrino Melograno & Arancia$q$, NULL, $q$Orange Soda$q$, $q$Sanpellegrino$q$, NULL, NULL, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/7550/san-pellegrino-pomegranate-and-orange$q$, $q$reference$q$),
($q$Schweppes Agrum Blood Orange Flavour$q$, NULL, $q$Orange Soda$q$, $q$Schweppes$q$, NULL, NULL, NULL, $q$https://schweppes.com.au/classic-mixers$q$, $q$producer$q$),
($q$Schweppes Agrum Citrus Blend Flavour Zero Sugar$q$, NULL, $q$Mixer$q$, $q$Schweppes$q$, NULL, NULL, NULL, $q$https://schweppes.com.au/classic-mixers$q$, $q$producer$q$),
($q$Schweppes Bitter Lemon$q$, $q$Schweppes Bitter Lemon$q$, $q$Bitter Lemon$q$, $q$Schweppes$q$, NULL, NULL, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/5812/schweppes-bitter-lemon$q$, $q$reference$q$),
($q$Schweppes Dry Ginger Ale$q$, $q$Schweppes Ginger Ale$q$, $q$Ginger Ale$q$, $q$Schweppes$q$, NULL, NULL, NULL, $q$https://schweppes.com.au/classic-mixers$q$, $q$producer$q$),
($q$Schweppes Dry Ginger Ale Zero Sugar$q$, NULL, $q$Ginger Ale$q$, $q$Schweppes$q$, NULL, NULL, NULL, $q$https://schweppes.com.au/classic-mixers$q$, $q$producer$q$),
($q$Schweppes Ginger Beer$q$, $q$Schweppes Ginger Beer$q$, $q$Ginger Beer$q$, $q$Schweppes$q$, NULL, NULL, NULL, $q$https://schweppes.com.au/classic-mixers$q$, $q$producer$q$),
($q$Schweppes Indian Tonic Water$q$, $q$Schweppes Indian Tonic Water$q$, $q$Tonic Water$q$, $q$Schweppes$q$, NULL, $q$GB$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/3294/schweppes-indian-tonic-water$q$, $q$reference$q$),
($q$Schweppes Lemon Lime and Bitters$q$, NULL, $q$Mixer$q$, $q$Schweppes$q$, NULL, NULL, NULL, $q$https://schweppes.com.au/classic-mixers$q$, $q$producer$q$),
($q$Schweppes Lemon Lime and Bitters Flavour Zero Sugar$q$, NULL, $q$Mixer$q$, $q$Schweppes$q$, NULL, NULL, NULL, $q$https://schweppes.com.au/classic-mixers$q$, $q$producer$q$),
($q$Schweppes Lemonade$q$, $q$Schweppes Lemonade$q$, $q$Lemonade$q$, $q$Schweppes$q$, NULL, NULL, NULL, $q$https://schweppes.com.au/classic-soft-drinks$q$, $q$producer$q$),
($q$Schweppes Lemonade Zero Sugar$q$, NULL, $q$Lemonade$q$, $q$Schweppes$q$, NULL, NULL, NULL, $q$https://schweppes.com.au/classic-soft-drinks$q$, $q$producer$q$),
($q$Schweppes Soda Water$q$, $q$Schweppes Soda Water$q$, $q$Soda Water$q$, $q$Schweppes$q$, NULL, NULL, NULL, $q$https://schweppes.com.au/classic-mixers$q$, $q$producer$q$),
($q$Schweppes Tonic Water$q$, NULL, $q$Tonic Water$q$, $q$Schweppes$q$, NULL, NULL, NULL, $q$https://schweppes.com.au/classic-mixers$q$, $q$producer$q$),
($q$Schweppes Tonic Water Zero Sugar$q$, NULL, $q$Light Tonic Water$q$, $q$Schweppes$q$, NULL, NULL, NULL, $q$https://schweppes.com.au/classic-mixers$q$, $q$producer$q$),
($q$Seagram's Club Soda$q$, NULL, $q$Soda Water$q$, $q$Seagram's$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/us/en/brands/seagrams$q$, $q$producer$q$),
($q$Seagram's Ginger Ale$q$, $q$Seagram's Ginger Ale$q$, $q$Ginger Ale$q$, $q$Seagram's$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/us/en/brands/seagrams$q$, $q$producer$q$),
($q$Seagram's Seltzer Water$q$, NULL, $q$Soda Water$q$, $q$Seagram's$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/us/en/brands/seagrams$q$, $q$producer$q$),
($q$Seagram's Tonic Water$q$, NULL, $q$Tonic Water$q$, $q$Seagram's$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/us/en/brands/seagrams$q$, $q$producer$q$),
($q$Seagram's Zero Sugar Ginger Ale$q$, NULL, $q$Ginger Ale$q$, $q$Seagram's$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/us/en/brands/seagrams$q$, $q$producer$q$),
($q$Solo Lemon & Orange$q$, NULL, $q$Lemonade$q$, $q$Solo$q$, NULL, $q$AU$q$, NULL, $q$https://thirstcrusher.com.au/$q$, $q$producer$q$),
($q$Solo Lemon Mango Zero Sugar$q$, NULL, $q$Lemonade$q$, $q$Solo$q$, NULL, $q$AU$q$, NULL, $q$https://thirstcrusher.com.au/$q$, $q$producer$q$),
($q$Solo Lemon Orange Zero Sugar$q$, NULL, $q$Lemonade$q$, $q$Solo$q$, NULL, $q$AU$q$, NULL, $q$https://thirstcrusher.com.au/$q$, $q$producer$q$),
($q$Solo Lemon Raspberry Zero Sugar$q$, NULL, $q$Lemonade$q$, $q$Solo$q$, NULL, $q$AU$q$, NULL, $q$https://thirstcrusher.com.au/$q$, $q$producer$q$),
($q$Solo Lime Zero Sugar$q$, NULL, $q$Lemon-lime Soda$q$, $q$Solo$q$, NULL, $q$AU$q$, NULL, $q$https://thirstcrusher.com.au/$q$, $q$producer$q$),
($q$Solo Original Lemon$q$, $q$Solo Lemon Soft Drink$q$, $q$Lemonade$q$, $q$Solo$q$, NULL, $q$AU$q$, NULL, $q$https://thirstcrusher.com.au/$q$, $q$producer$q$),
($q$Solo Original Lemon Zero Sugar$q$, NULL, $q$Lemonade$q$, $q$Solo$q$, NULL, $q$AU$q$, NULL, $q$https://thirstcrusher.com.au/$q$, $q$producer$q$),
($q$Something & Nothing Cucumber$q$, NULL, $q$Mixer$q$, $q$Something & Nothing$q$, NULL, NULL, NULL, $q$https://somethingandnothing.co/products/cucumber-soda$q$, $q$producer$q$),
($q$Something & Nothing Ginger & Lime$q$, NULL, $q$Mixer$q$, $q$Something & Nothing$q$, NULL, NULL, NULL, $q$https://somethingandnothing.co/products/ginger-lime-soda$q$, $q$producer$q$),
($q$Something & Nothing Hibiscus & Rose$q$, NULL, $q$Mixer$q$, $q$Something & Nothing$q$, NULL, NULL, NULL, $q$https://somethingandnothing.co/products/hibiscus-rose-soda$q$, $q$producer$q$),
($q$Something & Nothing Mango & Thai Basil$q$, NULL, $q$Mixer$q$, $q$Something & Nothing$q$, NULL, NULL, NULL, $q$https://somethingandnothing.co/products/mango-thai-basil-soda$q$, $q$producer$q$),
($q$Something & Nothing Orange & Mandarin$q$, NULL, $q$Orange Soda$q$, $q$Something & Nothing$q$, NULL, NULL, NULL, $q$https://somethingandnothing.co/products/orange-mandarin$q$, $q$producer$q$),
($q$Something & Nothing Pineapple & Pink Grapefruit$q$, NULL, $q$Grapefruit Soda$q$, $q$Something & Nothing$q$, NULL, NULL, NULL, $q$https://somethingandnothing.co/products/pineapple-pink-grapefruit-soda$q$, $q$producer$q$),
($q$Something & Nothing Yuzu$q$, NULL, $q$Yuzu Soda$q$, $q$Something & Nothing$q$, NULL, NULL, NULL, $q$https://somethingandnothing.co/products/yuzu-soda$q$, $q$producer$q$),
($q$Sprite$q$, $q$Sprite$q$, $q$Lemon-lime Soda$q$, $q$Sprite$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/us/en/brands/sprite/products$q$, $q$producer$q$),
($q$Sprite Cherry$q$, NULL, $q$Lemon-lime Soda$q$, $q$Sprite$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/us/en/brands/sprite/products$q$, $q$producer$q$),
($q$Sprite Lymonade$q$, NULL, $q$Lemonade$q$, $q$Sprite$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/us/en/brands/sprite/products$q$, $q$producer$q$),
($q$Sprite Mexico$q$, NULL, $q$Lemon-lime Soda$q$, $q$Sprite$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/us/en/brands/sprite/products$q$, $q$producer$q$),
($q$Sprite Tropical Mix$q$, NULL, $q$Lemon-lime Soda$q$, $q$Sprite$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/us/en/brands/sprite/products$q$, $q$producer$q$),
($q$Sprite Zero Sugar$q$, NULL, $q$Lemon-lime Soda$q$, $q$Sprite$q$, NULL, NULL, NULL, $q$https://www.coca-cola.com/us/en/brands/sprite/products$q$, $q$producer$q$),
($q$Squirt Original$q$, NULL, $q$Grapefruit Soda$q$, $q$Squirt$q$, NULL, NULL, NULL, $q$https://www.squirtsoda.com/$q$, $q$producer$q$),
($q$Squirt Ruby Red$q$, NULL, $q$Grapefruit Soda$q$, $q$Squirt$q$, NULL, NULL, NULL, $q$https://www.squirtsoda.com/$q$, $q$producer$q$),
($q$Squirt Zero Sugar$q$, NULL, $q$Grapefruit Soda$q$, $q$Squirt$q$, NULL, NULL, NULL, $q$https://www.squirtsoda.com/$q$, $q$producer$q$),
($q$StrangeLove Cloudy Pear Lo-Cal Soda$q$, NULL, $q$Mixer$q$, $q$StrangeLove$q$, NULL, NULL, NULL, $q$https://strangelove.com.au/products/sparkling-pear-soda$q$, $q$producer$q$),
($q$StrangeLove Coastal Tonic$q$, NULL, $q$Flavoured Tonic Water$q$, $q$StrangeLove$q$, NULL, NULL, NULL, $q$https://strangelove.com.au/products/540ml-glass-coastal-tonic-12-pack$q$, $q$producer$q$),
($q$StrangeLove Dirty Tonic Water$q$, NULL, $q$Tonic Water$q$, $q$StrangeLove$q$, NULL, NULL, NULL, $q$https://strangelove.com.au/products/dirty-tonic$q$, $q$producer$q$),
($q$StrangeLove Distiller's Tonic$q$, NULL, $q$Tonic Water$q$, $q$StrangeLove$q$, NULL, NULL, NULL, $q$https://strangelove.com.au/products/strangelove-distillers-tonic-180ml-6x4-pack$q$, $q$producer$q$),
($q$StrangeLove Double Ginger Beer Lo-Cal Soda$q$, $q$StrangeLove Lo-Cal Ginger Beer$q$, $q$Ginger Beer$q$, $q$StrangeLove$q$, NULL, NULL, NULL, $q$https://strangelove.com.au/products/ginger-beer$q$, $q$producer$q$),
($q$StrangeLove Fancy Lemonade$q$, NULL, $q$Lemonade$q$, $q$StrangeLove$q$, NULL, NULL, NULL, $q$https://strangelove.com.au/products/fancy-lemonade-180ml$q$, $q$producer$q$),
($q$StrangeLove Holy Grapefruit Lo-Cal Soda$q$, NULL, $q$Grapefruit Soda$q$, $q$StrangeLove$q$, NULL, NULL, NULL, $q$https://strangelove.com.au/products/holy-grapefruit-soda$q$, $q$producer$q$),
($q$StrangeLove Hot Ginger Beer$q$, NULL, $q$Ginger Beer$q$, $q$StrangeLove$q$, NULL, NULL, NULL, $q$https://strangelove.com.au/products/hot-ginger-beer$q$, $q$producer$q$),
($q$StrangeLove Lemon Squash Lo-Cal Soda$q$, NULL, $q$Lemonade$q$, $q$StrangeLove$q$, NULL, NULL, NULL, $q$https://strangelove.com.au/products/lemon-squash-300ml-1$q$, $q$producer$q$),
($q$StrangeLove Light Tonic$q$, NULL, $q$Light Tonic Water$q$, $q$StrangeLove$q$, NULL, NULL, NULL, $q$https://strangelove.com.au/products/540ml-glass-light-tonic-12-pack$q$, $q$producer$q$),
($q$StrangeLove Lime & Jalapeño Lo-Cal Soda$q$, NULL, $q$Mixer$q$, $q$StrangeLove$q$, NULL, NULL, NULL, $q$https://strangelove.com.au/products/strangelove-lo-cal-lime-jalapeno-soda$q$, $q$producer$q$),
($q$StrangeLove Passionfruit Lo-Cal Soda$q$, NULL, $q$Mixer$q$, $q$StrangeLove$q$, NULL, NULL, NULL, $q$https://strangelove.com.au/products/passionfruit-lo-cal-soda-300ml-x-24$q$, $q$producer$q$),
($q$StrangeLove Salted Grapefruit$q$, NULL, $q$Grapefruit Soda$q$, $q$StrangeLove$q$, NULL, NULL, NULL, $q$https://strangelove.com.au/products/540ml-glass-salted-grapefruit-12-pack$q$, $q$producer$q$),
($q$StrangeLove Sparkling Mineral Water$q$, NULL, $q$Soda Water$q$, $q$StrangeLove$q$, NULL, NULL, NULL, $q$https://strangelove.com.au/products/sparkling-mineral-water$q$, $q$producer$q$),
($q$StrangeLove Spiced Pineapple$q$, NULL, $q$Pineapple Soda$q$, $q$StrangeLove$q$, NULL, NULL, NULL, $q$https://strangelove.com.au/products/strangelove-spiced-pineapple-540ml-x-12-pack$q$, $q$producer$q$),
($q$StrangeLove Tonic No. 8$q$, NULL, $q$Tonic Water$q$, $q$StrangeLove$q$, NULL, NULL, NULL, $q$https://strangelove.com.au/products/540ml-glass-tonic-no-8-12-pack$q$, $q$producer$q$),
($q$StrangeLove Very Mandarin Lo-Cal Soda$q$, NULL, $q$Orange Soda$q$, $q$StrangeLove$q$, NULL, NULL, NULL, $q$https://strangelove.com.au/products/mandarin-soda$q$, $q$producer$q$),
($q$StrangeLove Yuzu From Japan Lo-Cal Soda$q$, NULL, $q$Yuzu Soda$q$, $q$StrangeLove$q$, NULL, NULL, NULL, $q$https://strangelove.com.au/products/yuzu-soda$q$, $q$producer$q$),
($q$Thomas Henry Bitter Lemon$q$, $q$Thomas Henry Bitter Lemon$q$, $q$Bitter Lemon$q$, $q$Thomas Henry$q$, NULL, NULL, NULL, $q$https://www.thomas-henry.de/produkte/bitter-lemon-2/$q$, $q$producer$q$),
($q$Thomas Henry Botanical Tonic$q$, NULL, $q$Tonic Water$q$, $q$Thomas Henry$q$, NULL, NULL, NULL, $q$https://www.thomas-henry.de/produkte/botanical-tonic/$q$, $q$producer$q$),
($q$Thomas Henry Cherry Blossom Tonic$q$, NULL, $q$Flavoured Tonic Water$q$, $q$Thomas Henry$q$, NULL, NULL, NULL, $q$https://www.thomas-henry.de/produkte/cherry-blossom-tonic/$q$, $q$producer$q$),
($q$Thomas Henry Ginger Ale$q$, NULL, $q$Ginger Ale$q$, $q$Thomas Henry$q$, NULL, NULL, NULL, $q$https://www.thomas-henry.de/produkte/ginger-ale/$q$, $q$producer$q$),
($q$Thomas Henry Mystic Mango$q$, NULL, $q$Mixer$q$, $q$Thomas Henry$q$, NULL, NULL, NULL, $q$https://www.thomas-henry.de/produkte/mystic-mango/$q$, $q$producer$q$),
($q$Thomas Henry Pink Grapefruit$q$, $q$Thomas Henry Pink Grapefruit Soda$q$, $q$Grapefruit Soda$q$, $q$Thomas Henry$q$, NULL, NULL, NULL, $q$https://www.thomas-henry.de/produkte/pink-grapefruit/$q$, $q$producer$q$),
($q$Thomas Henry Pink Grapefruit Zero$q$, NULL, $q$Grapefruit Soda$q$, $q$Thomas Henry$q$, NULL, NULL, NULL, $q$https://www.thomas-henry.de/produkte/pink-grapefruit-zero/$q$, $q$producer$q$),
($q$Thomas Henry Soda Water$q$, NULL, $q$Soda Water$q$, $q$Thomas Henry$q$, NULL, NULL, NULL, $q$https://www.thomas-henry.de/produkte/soda-water/$q$, $q$producer$q$),
($q$Thomas Henry Spicy Ginger Beer$q$, $q$Thomas Henry Ginger Beer$q$, $q$Ginger Beer$q$, $q$Thomas Henry$q$, NULL, NULL, NULL, $q$https://www.thomas-henry.de/produkte/spicy-ginger-beer/$q$, $q$producer$q$),
($q$Thomas Henry Spicy Ginger Beer Zero$q$, NULL, $q$Ginger Beer$q$, $q$Thomas Henry$q$, NULL, NULL, NULL, $q$https://www.thomas-henry.de/produkte/spicy-ginger-beer-zero/$q$, $q$producer$q$),
($q$Thomas Henry Tonic Water$q$, $q$Thomas Henry Tonic Water$q$, $q$Tonic Water$q$, $q$Thomas Henry$q$, NULL, NULL, NULL, $q$https://www.thomas-henry.de/produkte/tonic-water/$q$, $q$producer$q$),
($q$Thomas Henry Tonic Water Zero$q$, NULL, $q$Light Tonic Water$q$, $q$Thomas Henry$q$, NULL, NULL, NULL, $q$https://www.thomas-henry.de/produkte/tonic-water-zero/$q$, $q$producer$q$),
($q$Thomas Henry Wild Berry$q$, NULL, $q$Mixer$q$, $q$Thomas Henry$q$, NULL, NULL, NULL, $q$https://www.thomas-henry.de/produkte/wild-berry/$q$, $q$producer$q$),
($q$Three Cents Aegean Tonic$q$, $q$Three Cents Aegean$q$, $q$Tonic Water$q$, $q$Three Cents$q$, NULL, $q$GR$q$, NULL, $q$https://threecents.com/drinks/aegean-tonic/$q$, $q$producer$q$),
($q$Three Cents Cherry Soda$q$, NULL, $q$Mixer$q$, $q$Three Cents$q$, NULL, $q$GR$q$, NULL, $q$https://threecents.com/drinks/cherry-soda/$q$, $q$producer$q$),
($q$Three Cents Dry Tonic$q$, NULL, $q$Tonic Water$q$, $q$Three Cents$q$, NULL, $q$GR$q$, NULL, $q$https://threecents.com/drinks/dry-tonic/$q$, $q$producer$q$),
($q$Three Cents Fig Leaf Soda$q$, NULL, $q$Mixer$q$, $q$Three Cents$q$, NULL, $q$GR$q$, NULL, $q$https://threecents.com/drinks/fig-leaf-soda/$q$, $q$producer$q$),
($q$Three Cents Ginger Ale$q$, NULL, $q$Ginger Ale$q$, $q$Three Cents$q$, NULL, $q$GR$q$, NULL, $q$https://threecents.com/drinks/ginger-ale/$q$, $q$producer$q$),
($q$Three Cents Ginger Beer$q$, NULL, $q$Ginger Beer$q$, $q$Three Cents$q$, NULL, $q$GR$q$, NULL, $q$https://threecents.com/drinks/ginger-beer/$q$, $q$producer$q$),
($q$Three Cents Lemon Tonic$q$, NULL, $q$Flavoured Tonic Water$q$, $q$Three Cents$q$, NULL, $q$GR$q$, NULL, $q$https://threecents.com/drinks/lemon-tonic/$q$, $q$producer$q$),
($q$Three Cents Mandarin & Bergamot Soda$q$, NULL, $q$Mixer$q$, $q$Three Cents$q$, NULL, $q$GR$q$, NULL, $q$https://threecents.com/drinks/mandarin-bergamot/$q$, $q$producer$q$),
($q$Three Cents Pickle Soda$q$, NULL, $q$Mixer$q$, $q$Three Cents$q$, NULL, $q$GR$q$, NULL, $q$https://threecents.com/drinks/pickle-soda/$q$, $q$producer$q$),
($q$Three Cents Pineapple Soda$q$, NULL, $q$Pineapple Soda$q$, $q$Three Cents$q$, NULL, $q$GR$q$, NULL, $q$https://threecents.com/drinks/pineapple-soda/$q$, $q$producer$q$),
($q$Three Cents Pink Grapefruit Soda$q$, $q$Three Cents Pink Grapefruit Soda$q$, $q$Grapefruit Soda$q$, $q$Three Cents$q$, NULL, $q$GR$q$, NULL, $q$https://threecents.com/drinks/pink-grapefruit-soda/$q$, $q$producer$q$),
($q$Three Cents Pink Grapefruit Soda Zero Sugar$q$, NULL, $q$Grapefruit Soda$q$, $q$Three Cents$q$, NULL, $q$GR$q$, NULL, $q$https://threecents.com/zero_drinks/pink-grapefruit-soda/$q$, $q$producer$q$),
($q$Three Cents Sparkling Lemonade$q$, NULL, $q$Lemonade$q$, $q$Three Cents$q$, NULL, $q$GR$q$, NULL, $q$https://threecents.com/drinks/sparkling-lemonade/$q$, $q$producer$q$),
($q$Three Cents Tonic Water$q$, NULL, $q$Tonic Water$q$, $q$Three Cents$q$, NULL, $q$GR$q$, NULL, $q$https://threecents.com/drinks/tonic-water/$q$, $q$producer$q$),
($q$Three Cents Tonic Water Zero Sugar$q$, NULL, $q$Light Tonic Water$q$, $q$Three Cents$q$, NULL, $q$GR$q$, NULL, $q$https://threecents.com/zero_drinks/tonic-water-zero-sugar/$q$, $q$producer$q$),
($q$Three Cents Two Cents Plain$q$, $q$Three Cents Soda$q$, $q$Soda Water$q$, $q$Three Cents$q$, NULL, $q$GR$q$, NULL, $q$https://threecents.com/drinks/two-cents-plain/$q$, $q$producer$q$),
($q$Ting Grapefruit Soda$q$, $q$Ting Grapefruit Soda$q$, $q$Grapefruit Soda$q$, $q$Ting$q$, NULL, $q$GB$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/4481/ting-grapefruit-soda$q$, $q$reference$q$),
($q$Vichy Catalan$q$, $q$Vichy Catalan$q$, $q$Soda Water$q$, $q$Vichy Catalan$q$, NULL, $q$ES$q$, NULL, $q$https://www.vichycatalan.com/nuestras-marcas/vichy-catalan/$q$, $q$producer$q$),
($q$Vichy Catalan Premium Tonic Water$q$, NULL, $q$Tonic Water$q$, $q$Vichy Catalan$q$, NULL, $q$ES$q$, NULL, $q$https://www.vichycatalan.com/nuestras-marcas/vichy-catalan/$q$, $q$producer$q$),
($q$Vikos Cola Classic$q$, NULL, $q$Cola$q$, $q$Vikos$q$, NULL, $q$GR$q$, NULL, $q$https://www.vikos.com/bikos-cola$q$, $q$producer$q$),
($q$Vikos Lemonada$q$, NULL, $q$Lemonade$q$, $q$Vikos$q$, NULL, $q$GR$q$, NULL, $q$https://www.vikos.com/anapsiktika$q$, $q$producer$q$),
($q$Vikos Pink Grapefruit$q$, NULL, $q$Grapefruit Soda$q$, $q$Vikos$q$, NULL, $q$GR$q$, NULL, $q$https://www.vikos.com/mixers$q$, $q$producer$q$),
($q$Vikos Portokalada$q$, NULL, $q$Orange Soda$q$, $q$Vikos$q$, NULL, $q$GR$q$, NULL, $q$https://www.vikos.com/anapsiktika$q$, $q$producer$q$),
($q$Vikos Soda$q$, NULL, $q$Soda Water$q$, $q$Vikos$q$, NULL, $q$GR$q$, NULL, $q$https://www.vikos.com/mixers$q$, $q$producer$q$),
($q$Vikos Tonic$q$, NULL, $q$Tonic Water$q$, $q$Vikos$q$, NULL, $q$GR$q$, NULL, $q$https://www.vikos.com/mixers$q$, $q$producer$q$),
($q$Virgil's Black Cherry Soda$q$, NULL, $q$Mixer$q$, $q$Virgil's$q$, NULL, NULL, NULL, $q$https://www.drinkreeds.com/products/virgils-black-cherry-24-pack-glass$q$, $q$producer$q$),
($q$Virgil's Handcrafted Cola$q$, NULL, $q$Cola$q$, $q$Virgil's$q$, NULL, NULL, NULL, $q$https://www.drinkreeds.com/products/virgils-handcrafted-cola-cans$q$, $q$producer$q$),
($q$Virgil's Orange Cream Soda$q$, NULL, $q$Cream Soda$q$, $q$Virgil's$q$, NULL, NULL, NULL, $q$https://www.drinkreeds.com/products/virgils-orange-cream-24-pack-glass$q$, $q$producer$q$),
($q$Virgil's Root Beer$q$, NULL, $q$Root Beer$q$, $q$Virgil's$q$, NULL, NULL, NULL, $q$https://www.drinkreeds.com/products/virgils-root-beer-24-pack-glass$q$, $q$producer$q$),
($q$Virgil's Vanilla Cream Soda$q$, NULL, $q$Cream Soda$q$, $q$Virgil's$q$, NULL, NULL, NULL, $q$https://www.drinkreeds.com/products/virgils-cream-soda-24-pack-glass$q$, $q$producer$q$),
($q$Virgil's Zero Sugar Root Beer$q$, NULL, $q$Root Beer$q$, $q$Virgil's$q$, NULL, NULL, NULL, $q$https://www.drinkreeds.com/products/copy-of-virgils-zero-sugar-root-beer-24-pack$q$, $q$producer$q$),
($q$Zingi Bear Organic Ginger Switchel$q$, NULL, $q$Ginger Beer$q$, $q$Zingi Bear$q$, NULL, $q$GB$q$, NULL, $q$https://www.zingibear.com/switchel$q$, $q$producer$q$),
($q$bottlegreen Elderflower & Elderberry Sparkling Pressé$q$, NULL, $q$Mixer$q$, $q$bottlegreen$q$, NULL, NULL, NULL, $q$https://www.bottlegreendrinks.com/products/elderflower-elderberry-presse$q$, $q$producer$q$),
($q$bottlegreen Elderflower Sparkling Pressé$q$, NULL, $q$Mixer$q$, $q$bottlegreen$q$, NULL, NULL, NULL, $q$https://www.bottlegreendrinks.com/products/elderflower-presse$q$, $q$producer$q$),
($q$bottlegreen Lime & Mint Sparkling Pressé$q$, NULL, $q$Mixer$q$, $q$bottlegreen$q$, NULL, NULL, NULL, $q$https://www.bottlegreendrinks.com/products/lime-mint-presse$q$, $q$producer$q$),
($q$bottlegreen Pink Grapefruit Sparkling Pressé$q$, NULL, $q$Grapefruit Soda$q$, $q$bottlegreen$q$, NULL, NULL, NULL, $q$https://www.bottlegreendrinks.com/products/pink-grapefruit-presse$q$, $q$producer$q$),
($q$bottlegreen Pomegranate & Elderflower Sparkling Pressé$q$, NULL, $q$Mixer$q$, $q$bottlegreen$q$, NULL, NULL, NULL, $q$https://www.bottlegreendrinks.com/products/pomegranate-elderflower-presse$q$, $q$producer$q$);

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
    WHEN b.style IN ($q$Mixer$q$) AND EXISTS (
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
