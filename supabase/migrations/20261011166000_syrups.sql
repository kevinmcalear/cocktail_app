-- Syrups, cordials and sour mixes: every bottle checked on its producer's
-- own page (or, where that page was blocked, a major retailer, importer or
-- Difford's), after 20261011165000. Step 3i of the bottle catalog plan:
-- https://claude.ai/artifact/Vu6seuSNtN42nKYb2nDCVR
--
--   * The cocktail syrups, cordials and sour mixes of every brand in
--     our catalog or on The Whisky Exchange's soft-drinks list (up to
--     25 a house for the big ranges: Monin, Giffard, 1883).
--   * On a copy of production (2026-10-09, with the loads before this
--     one applied): 195 new bottles, and 38 we had that get their label
--     name (10 renamed, the old name kept as an alias), style, ABV,
--     country, protected name and maker where they were missing or
--     wrong.
--   * Styles: Bottles file under the house preps recipes already use
--     (Orgeat, Grenadine, Simple, Demerara and Rich Simple Syrup,
--     Passion Fruit, Ginger, Cinnamon, Vanilla Syrup, Lime and
--     Elderflower Cordial...), or Syrup for other flavours. No new
--     styles.
--   * Out of scope: alcoholic falernum (a liqueur), coffee and tea
--     concentrates, juices.
--   * Each producer gets an unclaimed maker page (makes: bottles), or a
--     page an earlier load made gains it, and each bottle names it.
--   * Every fact keeps the page it was checked on in item_sources. An
--     ABV read off another page isn't kept, and a review site isn't a
--     source.
--   * An independent second check of 100 random rows found 1 wrong
--     facts in 363 (0.3%). Every correction is taken: Nin Jiom Pei Pa
--     Koa (a herbal cough remedy) stays out. Small Hand Foods Orgeat
--     contains a little brandy with no ABV stated; it stays as Orgeat.
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
     WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL AND i.ingredient_role IN ('generic', 'prep')
       AND public.ingredient_key(i.name) = public.ingredient_key(p_name)
     ORDER BY (i.ingredient_role = 'generic') DESC, i.is_core DESC, i.created_at LIMIT 1;
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
(0, $q$Syrup$q$, NULL);

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
($q$1883 Maison Routin$q$, $q$1883.maison.routin$q$, $q$https://www.1883.com$q$, $q$FR$q$, NULL),
($q$BG Reynolds$q$, $q$bg.reynolds$q$, $q$https://www.bgreynolds.com$q$, NULL, NULL),
($q$Belvoir Farm$q$, $q$belvoir.farm$q$, $q$https://belvoirfarm.co.uk$q$, NULL, NULL),
($q$Bristol Syrup Company$q$, $q$bristol.syrup.company$q$, $q$https://www.bristolsyrupcompany.com$q$, $q$GB$q$, NULL),
($q$Chtaura$q$, $q$chtaura$q$, $q$https://www.chtaura.com$q$, $q$LB$q$, NULL),
($q$Coco López$q$, $q$coco.lopez$q$, $q$https://www.cocolopez.com$q$, NULL, NULL),
($q$Fever-Tree$q$, $q$fever.tree$q$, $q$https://fever-tree.com$q$, NULL, NULL),
($q$Giffard$q$, $q$giffard$q$, $q$https://www.giffard.com$q$, $q$FR$q$, NULL),
($q$Jack Rudy Cocktail Co.$q$, $q$jack.rudy.cocktail.co$q$, $q$https://jackrudycocktailco.com$q$, $q$US$q$, NULL),
($q$Liber & Co$q$, $q$liber.co$q$, $q$https://www.liberandcompany.com$q$, NULL, NULL),
($q$Monin$q$, $q$monin$q$, $q$https://monin.us$q$, NULL, NULL),
($q$Paragon$q$, $q$paragon$q$, $q$https://paragoncordial.com$q$, NULL, NULL),
($q$Polar$q$, $q$polar$q$, $q$https://polarbeverages.com$q$, $q$US$q$, NULL),
($q$Q Mixers$q$, $q$q.mixers$q$, $q$https://qmixers.com$q$, NULL, NULL),
($q$Reàl$q$, $q$real$q$, $q$https://www.realingredients.com$q$, NULL, NULL),
($q$Ribena$q$, $q$ribena$q$, $q$https://ribena.co.uk$q$, NULL, NULL),
($q$Rose's$q$, $q$rose.s$q$, NULL, NULL, NULL),
($q$Schweppes$q$, $q$schweppes$q$, $q$https://schweppes.com.au$q$, NULL, NULL),
($q$Small Hand Foods$q$, $q$small.hand.foods$q$, $q$https://smallhandfoods.com$q$, NULL, NULL),
($q$Sūpāsawā$q$, $q$supasawa$q$, $q$https://www.supasawa.com$q$, $q$BE$q$, NULL),
($q$William Fox$q$, $q$william.fox$q$, $q$https://www.williamfoxuk.com$q$, $q$GB$q$, NULL),
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
($q$1883 Almond Syrup$q$, $q$1883 Maison Routin Almond Orgeat Syrup$q$, $q$Orgeat$q$, $q$1883 Maison Routin$q$, NULL, $q$FR$q$, NULL, $q$https://www.1883.com/en/product/1883-almond-syrup/$q$, $q$producer$q$),
($q$1883 Blood Orange Syrup$q$, NULL, $q$Syrup$q$, $q$1883 Maison Routin$q$, NULL, $q$FR$q$, NULL, $q$https://www.1883.com/en/product/1883-blood-orange-syrup/$q$, $q$producer$q$),
($q$1883 Cane Sugar Syrup$q$, NULL, $q$Cane Syrup$q$, $q$1883 Maison Routin$q$, NULL, $q$FR$q$, NULL, $q$https://www.1883.com/en/product/1883-cane-sugar-syrup/$q$, $q$producer$q$),
($q$1883 Cinnamon Syrup$q$, NULL, $q$Cinnamon Syrup$q$, $q$1883 Maison Routin$q$, NULL, $q$FR$q$, NULL, $q$https://www.1883.com/en/product/1883-cinnamon-syrup/$q$, $q$producer$q$),
($q$1883 Coconut Syrup$q$, NULL, $q$Coconut Syrup$q$, $q$1883 Maison Routin$q$, NULL, $q$FR$q$, NULL, $q$https://www.1883.com/en/product/1883-coconut-syrup/$q$, $q$producer$q$),
($q$1883 Cucumber Syrup$q$, NULL, $q$Syrup$q$, $q$1883 Maison Routin$q$, NULL, $q$FR$q$, NULL, $q$https://www.1883.com/en/product/1883-cucumber-syrup/$q$, $q$producer$q$),
($q$1883 Curacao Syrup$q$, NULL, $q$Syrup$q$, $q$1883 Maison Routin$q$, NULL, $q$FR$q$, NULL, $q$https://www.1883.com/en/product/1883-curacao-syrup/$q$, $q$producer$q$),
($q$1883 Elderflower Syrup$q$, NULL, $q$Syrup$q$, $q$1883 Maison Routin$q$, NULL, $q$FR$q$, NULL, $q$https://www.1883.com/en/product/1883-elderflower-syrup/$q$, $q$producer$q$),
($q$1883 Falernum Syrup$q$, NULL, $q$Falernum$q$, $q$1883 Maison Routin$q$, NULL, $q$FR$q$, NULL, $q$https://www.1883.com/en/product/1883-falernum-syrup/$q$, $q$producer$q$),
($q$1883 Ginger Syrup$q$, NULL, $q$Ginger Syrup$q$, $q$1883 Maison Routin$q$, NULL, $q$FR$q$, NULL, $q$https://www.1883.com/en/product/1883-ginger-syrup/$q$, $q$producer$q$),
($q$1883 Honey Syrup$q$, NULL, $q$Honey Syrup$q$, $q$1883 Maison Routin$q$, NULL, $q$FR$q$, NULL, $q$https://www.1883.com/en/product/1883-honey-syrup/$q$, $q$producer$q$),
($q$1883 Lavender Syrup$q$, NULL, $q$Syrup$q$, $q$1883 Maison Routin$q$, NULL, $q$FR$q$, NULL, $q$https://www.1883.com/en/product/1883-lavender-syrup/$q$, $q$producer$q$),
($q$1883 Lime Cordial$q$, NULL, $q$Lime Cordial$q$, $q$1883 Maison Routin$q$, NULL, $q$FR$q$, NULL, $q$https://www.1883.com/en/product/1883-lime-cordial/$q$, $q$producer$q$),
($q$1883 Organic Agave Syrup$q$, NULL, $q$Agave Syrup$q$, $q$1883 Maison Routin$q$, NULL, $q$FR$q$, NULL, $q$https://www.1883.com/en/product/1883-organic-agave-syrup/$q$, $q$producer$q$),
($q$1883 Passion Fruit Syrup$q$, NULL, $q$Passion Fruit Syrup$q$, $q$1883 Maison Routin$q$, NULL, $q$FR$q$, NULL, $q$https://www.1883.com/en/product/1883-passion-fruit-syrup/$q$, $q$producer$q$),
($q$1883 Pineapple Syrup$q$, NULL, $q$Pineapple Syrup$q$, $q$1883 Maison Routin$q$, NULL, $q$FR$q$, NULL, $q$https://www.1883.com/en/product/1883-pineapple-syrup/$q$, $q$producer$q$),
($q$1883 Pink Grapefruit Syrup$q$, NULL, $q$Syrup$q$, $q$1883 Maison Routin$q$, NULL, $q$FR$q$, NULL, $q$https://www.1883.com/en/product/1883-pink-grapefruit-syrup/$q$, $q$producer$q$),
($q$1883 Pomegranate Syrup$q$, NULL, $q$Syrup$q$, $q$1883 Maison Routin$q$, NULL, $q$FR$q$, NULL, $q$https://www.1883.com/en/product/1883-pomegranate-syrup/$q$, $q$producer$q$),
($q$1883 Raspberry Syrup$q$, NULL, $q$Raspberry Syrup$q$, $q$1883 Maison Routin$q$, NULL, $q$FR$q$, NULL, $q$https://www.1883.com/en/product/1883-raspberry-syrup/$q$, $q$producer$q$),
($q$1883 Rose Syrup$q$, NULL, $q$Syrup$q$, $q$1883 Maison Routin$q$, NULL, $q$FR$q$, NULL, $q$https://www.1883.com/en/product/1883-rose-syrup/$q$, $q$producer$q$),
($q$1883 Strawberry Syrup$q$, NULL, $q$Syrup$q$, $q$1883 Maison Routin$q$, NULL, $q$FR$q$, NULL, $q$https://www.1883.com/en/product/1883-strawberry-syrup/$q$, $q$producer$q$),
($q$1883 Tonic Syrup$q$, NULL, $q$Tonic Syrup$q$, $q$1883 Maison Routin$q$, NULL, $q$FR$q$, NULL, $q$https://www.1883.com/en/product/1883-tonic-syrup/$q$, $q$producer$q$),
($q$1883 Triple Sec Syrup$q$, NULL, $q$Syrup$q$, $q$1883 Maison Routin$q$, NULL, $q$FR$q$, NULL, $q$https://www.1883.com/en/product/1883-triple-sec-syrup/$q$, $q$producer$q$),
($q$1883 Vanilla Syrup$q$, $q$1883 Maison Routin Vanilla Syrup$q$, $q$Vanilla Syrup$q$, $q$1883 Maison Routin$q$, NULL, $q$FR$q$, NULL, $q$https://www.1883.com/en/product/1883-vanilla-syrup/$q$, $q$producer$q$),
($q$1883 Violet Syrup$q$, NULL, $q$Syrup$q$, $q$1883 Maison Routin$q$, NULL, $q$FR$q$, NULL, $q$https://www.1883.com/en/product/1883-violet-syrup/$q$, $q$producer$q$),
($q$BG Reynolds Cinnamon Cocktail Syrup$q$, NULL, $q$Cinnamon Syrup$q$, $q$BG Reynolds$q$, NULL, NULL, NULL, $q$https://www.bgreynolds.com/products/cinnamon$q$, $q$producer$q$),
($q$BG Reynolds Falernum Tropical Cocktail Syrup$q$, NULL, $q$Falernum$q$, $q$BG Reynolds$q$, NULL, NULL, NULL, $q$https://www.bgreynolds.com/products/falernum$q$, $q$producer$q$),
($q$BG Reynolds Honey Mix$q$, NULL, $q$Honey Syrup$q$, $q$BG Reynolds$q$, NULL, NULL, NULL, $q$https://www.bgreynolds.com/products/orange-blossom-honey-mix$q$, $q$producer$q$),
($q$BG Reynolds Lush Grenadine Cocktail Syrup$q$, NULL, $q$Grenadine$q$, $q$BG Reynolds$q$, NULL, NULL, NULL, $q$https://www.bgreynolds.com/products/lush-grenadine-tropical-syrup$q$, $q$producer$q$),
($q$BG Reynolds Original Orgeat Cocktail Syrup$q$, $q$BG Reynolds Orgeat Syrup$q$, $q$Orgeat$q$, $q$BG Reynolds$q$, NULL, NULL, NULL, $q$https://www.bgreynolds.com/products/original-orgeat-tropical-syrup$q$, $q$producer$q$),
($q$BG Reynolds Paradise Blend Cocktail Syrup$q$, $q$BG Reynolds Don's Mix$q$, $q$Syrup$q$, $q$BG Reynolds$q$, NULL, NULL, NULL, $q$https://www.bgreynolds.com/products/paradise-blend-750ml$q$, $q$producer$q$),
($q$BG Reynolds Passion Fruit Tropical Cocktail Syrup$q$, $q$BG Reynolds Passion Fruit Syrup$q$, $q$Passion Fruit Syrup$q$, $q$BG Reynolds$q$, NULL, NULL, NULL, $q$https://www.bgreynolds.com/products/passion-fruit-tropical-cocktail-syrup$q$, $q$producer$q$),
($q$BG Reynolds Rich Demerara Cocktail Syrup$q$, NULL, $q$Demerara Syrup$q$, $q$BG Reynolds$q$, NULL, NULL, NULL, $q$https://www.bgreynolds.com/products/rich-demerara$q$, $q$producer$q$),
($q$Belvoir Farm 100% Natural Blackcurrant Cordial$q$, NULL, $q$Cordial$q$, $q$Belvoir Farm$q$, NULL, NULL, NULL, $q$https://belvoirfarm.co.uk/drink/100-natural-blackcurrant-cordial/$q$, $q$producer$q$),
($q$Belvoir Farm Blueberry and Blackcurrant Cordial$q$, NULL, $q$Cordial$q$, $q$Belvoir Farm$q$, NULL, NULL, NULL, $q$https://belvoirfarm.co.uk/drink/blueberry-and-blackcurrant-cordial/$q$, $q$producer$q$),
($q$Belvoir Farm Elderflower Cordial$q$, $q$Belvoir Farm Elderflower Cordial$q$, $q$Elderflower Cordial$q$, $q$Belvoir Farm$q$, NULL, NULL, NULL, $q$https://belvoirfarm.co.uk/drink/elderflower-cordial/$q$, $q$producer$q$),
($q$Belvoir Farm Elderflower and Rose Cordial$q$, NULL, $q$Elderflower Cordial$q$, $q$Belvoir Farm$q$, NULL, NULL, NULL, $q$https://belvoirfarm.co.uk/drink/elderflower-and-rose-cordial/$q$, $q$producer$q$),
($q$Belvoir Farm Ginger Cordial$q$, NULL, $q$Cordial$q$, $q$Belvoir Farm$q$, NULL, NULL, NULL, $q$https://belvoirfarm.co.uk/drink/ginger-cordial/$q$, $q$producer$q$),
($q$Belvoir Farm Honey, Lemon and Ginger Cordial$q$, NULL, $q$Cordial$q$, $q$Belvoir Farm$q$, NULL, NULL, NULL, $q$https://belvoirfarm.co.uk/drink/honey-lemon-and-ginger-cordial/$q$, $q$producer$q$),
($q$Belvoir Farm Lime Cordial$q$, NULL, $q$Lime Cordial$q$, $q$Belvoir Farm$q$, NULL, NULL, NULL, $q$https://belvoirfarm.co.uk/drink/lime-cordial/$q$, $q$producer$q$),
($q$Belvoir Farm No Added Sugar Cherries & Berries Cordial$q$, NULL, $q$Cordial$q$, $q$Belvoir Farm$q$, NULL, NULL, NULL, $q$https://belvoirfarm.co.uk/drink/no-added-sugar-cherries-berries-cordial/$q$, $q$producer$q$),
($q$Belvoir Farm No Added Sugar Peach & White Grape Cordial$q$, NULL, $q$Cordial$q$, $q$Belvoir Farm$q$, NULL, NULL, NULL, $q$https://belvoirfarm.co.uk/drink/no-added-sugar-peach-white-grape-cordial/$q$, $q$producer$q$),
($q$Belvoir Farm No Added Sugar Sicilian Lemon and Lime Cordial$q$, NULL, $q$Cordial$q$, $q$Belvoir Farm$q$, NULL, NULL, NULL, $q$https://belvoirfarm.co.uk/drink/no-added-sugar-sicilian-lemon-and-lime-cordial/$q$, $q$producer$q$),
($q$Belvoir Farm Organic Elderflower Cordial$q$, NULL, $q$Elderflower Cordial$q$, $q$Belvoir Farm$q$, NULL, NULL, NULL, $q$https://belvoirfarm.co.uk/drink/organic-elderflower-cordial/$q$, $q$producer$q$),
($q$Belvoir Farm Organic Ginger Cordial$q$, NULL, $q$Cordial$q$, $q$Belvoir Farm$q$, NULL, NULL, NULL, $q$https://belvoirfarm.co.uk/drink/organic-ginger-cordial/$q$, $q$producer$q$),
($q$Belvoir Farm Organic Lime and Mandarin Cordial$q$, NULL, $q$Cordial$q$, $q$Belvoir Farm$q$, NULL, NULL, NULL, $q$https://belvoirfarm.co.uk/drink/organic-lime-and-mandarin-cordial/$q$, $q$producer$q$),
($q$Belvoir Farm Raspberry and Lemon Cordial$q$, NULL, $q$Cordial$q$, $q$Belvoir Farm$q$, NULL, NULL, NULL, $q$https://belvoirfarm.co.uk/drink/raspberry-and-lemon-cordial/$q$, $q$producer$q$),
($q$Belvoir Farm Rhubarb and Apple Cordial$q$, NULL, $q$Cordial$q$, $q$Belvoir Farm$q$, NULL, NULL, NULL, $q$https://belvoirfarm.co.uk/drink/rhubarb-and-apple-cordial/$q$, $q$producer$q$),
($q$Bristol Syrup Company No.1 Simple Syrup 1:1$q$, NULL, $q$Simple Syrup$q$, $q$Bristol Syrup Company$q$, NULL, $q$GB$q$, NULL, $q$https://www.bristolsyrupcompany.com/simple-syrup1$q$, $q$producer$q$),
($q$Bristol Syrup Company No.10 Coconut$q$, NULL, $q$Coconut Syrup$q$, $q$Bristol Syrup Company$q$, NULL, $q$GB$q$, NULL, $q$https://www.bristolsyrupcompany.com/coconut$q$, $q$producer$q$),
($q$Bristol Syrup Company No.11 Pineapple & Coconut$q$, NULL, $q$Syrup$q$, $q$Bristol Syrup Company$q$, NULL, $q$GB$q$, NULL, $q$https://www.bristolsyrupcompany.com/pineappleandcoconut$q$, $q$producer$q$),
($q$Bristol Syrup Company No.13 Raspberry Shrub$q$, NULL, $q$Syrup$q$, $q$Bristol Syrup Company$q$, NULL, $q$GB$q$, NULL, $q$https://www.bristolsyrupcompany.com/raspberry-shrub$q$, $q$producer$q$),
($q$Bristol Syrup Company No.14 Cherry & Vanilla$q$, NULL, $q$Syrup$q$, $q$Bristol Syrup Company$q$, NULL, $q$GB$q$, NULL, $q$https://www.bristolsyrupcompany.com/cherryandvanilla$q$, $q$producer$q$),
($q$Bristol Syrup Company No.15 Vanilla$q$, NULL, $q$Vanilla Syrup$q$, $q$Bristol Syrup Company$q$, NULL, $q$GB$q$, NULL, $q$https://www.bristolsyrupcompany.com/no15-vanilla$q$, $q$producer$q$),
($q$Bristol Syrup Company No.16 Strawberry Shrub$q$, NULL, $q$Syrup$q$, $q$Bristol Syrup Company$q$, NULL, $q$GB$q$, NULL, $q$https://www.bristolsyrupcompany.com/no16-strawberry-shrub$q$, $q$producer$q$),
($q$Bristol Syrup Company No.17 Watermelon$q$, NULL, $q$Syrup$q$, $q$Bristol Syrup Company$q$, NULL, $q$GB$q$, NULL, $q$https://www.bristolsyrupcompany.com/no17-watermelon$q$, $q$producer$q$),
($q$Bristol Syrup Company No.18 Lime Sherbet$q$, NULL, $q$Syrup$q$, $q$Bristol Syrup Company$q$, NULL, $q$GB$q$, NULL, $q$https://www.bristolsyrupcompany.com/no18-limesherbet$q$, $q$producer$q$),
($q$Bristol Syrup Company No.19 Disco Grenadine$q$, NULL, $q$Grenadine$q$, $q$Bristol Syrup Company$q$, NULL, $q$GB$q$, NULL, $q$https://www.bristolsyrupcompany.com/no19-disco-grenadine$q$, $q$producer$q$),
($q$Bristol Syrup Company No.2 Simple Syrup 2:1$q$, NULL, $q$Rich Simple Syrup$q$, $q$Bristol Syrup Company$q$, NULL, $q$GB$q$, NULL, $q$https://www.bristolsyrupcompany.com/simple-syrup-2$q$, $q$producer$q$),
($q$Bristol Syrup Company No.20 Grapefruit Sherbet$q$, NULL, $q$Syrup$q$, $q$Bristol Syrup Company$q$, NULL, $q$GB$q$, NULL, $q$https://www.bristolsyrupcompany.com/no20-grapefruit-sherbet$q$, $q$producer$q$),
($q$Bristol Syrup Company No.21 Ginger$q$, NULL, $q$Ginger Syrup$q$, $q$Bristol Syrup Company$q$, NULL, $q$GB$q$, NULL, $q$https://www.bristolsyrupcompany.com/no21-ginger$q$, $q$producer$q$),
($q$Bristol Syrup Company No.23 Yuzu Sherbet$q$, NULL, $q$Syrup$q$, $q$Bristol Syrup Company$q$, NULL, $q$GB$q$, NULL, $q$https://www.bristolsyrupcompany.com/no23-yuzu-sherbet$q$, $q$producer$q$),
($q$Bristol Syrup Company No.24 Disco Blue$q$, NULL, $q$Syrup$q$, $q$Bristol Syrup Company$q$, NULL, $q$GB$q$, NULL, $q$https://www.bristolsyrupcompany.com/no24-disco-blue$q$, $q$producer$q$),
($q$Bristol Syrup Company No.27 Nogave$q$, NULL, $q$Syrup$q$, $q$Bristol Syrup Company$q$, NULL, $q$GB$q$, NULL, $q$https://www.bristolsyrupcompany.com/no27-nogave$q$, $q$producer$q$),
($q$Bristol Syrup Company No.29 Green Chilli$q$, NULL, $q$Syrup$q$, $q$Bristol Syrup Company$q$, NULL, $q$GB$q$, NULL, $q$https://www.bristolsyrupcompany.com/no29-greenchilli$q$, $q$producer$q$),
($q$Bristol Syrup Company No.3 Demerara$q$, NULL, $q$Demerara Syrup$q$, $q$Bristol Syrup Company$q$, NULL, $q$GB$q$, NULL, $q$https://www.bristolsyrupcompany.com/demerara$q$, $q$producer$q$),
($q$Bristol Syrup Company No.30 Blood Orange Sherbet$q$, NULL, $q$Syrup$q$, $q$Bristol Syrup Company$q$, NULL, $q$GB$q$, NULL, $q$https://www.bristolsyrupcompany.com/no30-blood-orange-sherbet$q$, $q$producer$q$),
($q$Bristol Syrup Company No.32 Lychee$q$, NULL, $q$Syrup$q$, $q$Bristol Syrup Company$q$, NULL, $q$GB$q$, NULL, $q$https://www.bristolsyrupcompany.com/no32-lychee$q$, $q$producer$q$),
($q$Bristol Syrup Company No.4 Raspberry$q$, NULL, $q$Raspberry Syrup$q$, $q$Bristol Syrup Company$q$, NULL, $q$GB$q$, NULL, $q$https://www.bristolsyrupcompany.com/raspberry$q$, $q$producer$q$),
($q$Bristol Syrup Company No.5 Passionfruit$q$, NULL, $q$Passion Fruit Syrup$q$, $q$Bristol Syrup Company$q$, NULL, $q$GB$q$, NULL, $q$https://www.bristolsyrupcompany.com/passion-fruit$q$, $q$producer$q$),
($q$Bristol Syrup Company No.7 Orgeat$q$, NULL, $q$Orgeat$q$, $q$Bristol Syrup Company$q$, NULL, $q$GB$q$, NULL, $q$https://www.bristolsyrupcompany.com/orgeat$q$, $q$producer$q$),
($q$Bristol Syrup Company No.8 Elderflower$q$, NULL, $q$Syrup$q$, $q$Bristol Syrup Company$q$, NULL, $q$GB$q$, NULL, $q$https://www.bristolsyrupcompany.com/elderflower$q$, $q$producer$q$),
($q$Bristol Syrup Company No.9 Falernum$q$, NULL, $q$Falernum$q$, $q$Bristol Syrup Company$q$, NULL, $q$GB$q$, NULL, $q$https://www.bristolsyrupcompany.com/falernum$q$, $q$producer$q$),
($q$Chtaura Black Mulberry Syrup$q$, NULL, $q$Syrup$q$, $q$Chtaura$q$, NULL, $q$LB$q$, NULL, $q$https://www.chtaura.com/chtaura-products/blackberry-syrup$q$, $q$producer$q$),
($q$Chtaura Jallab Syrup$q$, NULL, $q$Syrup$q$, $q$Chtaura$q$, NULL, $q$LB$q$, NULL, $q$https://www.chtaura.com/chtaura-products/jallab-syrup$q$, $q$producer$q$),
($q$Chtaura Rose Syrup$q$, NULL, $q$Syrup$q$, $q$Chtaura$q$, NULL, $q$LB$q$, NULL, $q$https://www.chtaura.com/chtaura-products/rose-syrup$q$, $q$producer$q$),
($q$Chtaura Strawberry Syrup$q$, NULL, $q$Syrup$q$, $q$Chtaura$q$, NULL, $q$LB$q$, NULL, $q$https://www.chtaura.com/chtaura-products/strawberry-syrup$q$, $q$producer$q$),
($q$Chtaura Tamarind Syrup$q$, NULL, $q$Syrup$q$, $q$Chtaura$q$, NULL, $q$LB$q$, NULL, $q$https://www.chtaura.com/chtaura-products/tamerhindi-syrup$q$, $q$producer$q$),
($q$Coco López Cream of Coconut$q$, NULL, $q$Cream of Coconut$q$, $q$Coco López$q$, NULL, NULL, NULL, $q$https://www.cocolopez.com/products$q$, $q$producer$q$),
($q$Fever-Tree Light Margarita Mixer$q$, NULL, $q$Sour Mix$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-us/products/light-margarita-mixer$q$, $q$producer$q$),
($q$Fever-Tree Margarita Mixer$q$, NULL, $q$Sour Mix$q$, $q$Fever-Tree$q$, NULL, NULL, NULL, $q$https://fever-tree.com/en-gb/products/margarita-mixer$q$, $q$producer$q$),
($q$Giffard Agave Syrup$q$, NULL, $q$Agave Syrup$q$, $q$Giffard$q$, NULL, $q$FR$q$, NULL, $q$https://www.giffard.com/en/specialties/517-406-agave-syrup.html$q$, $q$producer$q$),
($q$Giffard Blackberry Syrup$q$, NULL, $q$Syrup$q$, $q$Giffard$q$, NULL, $q$FR$q$, NULL, $q$https://www.giffard.com/en/fruits-and-plants-syrups/514-175-blackberry-syrup.html$q$, $q$producer$q$),
($q$Giffard Brown Sugar Cane Syrup$q$, NULL, $q$Cane Syrup$q$, $q$Giffard$q$, NULL, $q$FR$q$, NULL, $q$https://www.giffard.com/en/fruits-and-plants-syrups/1671-431-brown-sugar-cane-syrup.html$q$, $q$producer$q$),
($q$Giffard Cinnamon Syrup$q$, NULL, $q$Cinnamon Syrup$q$, $q$Giffard$q$, NULL, $q$FR$q$, NULL, $q$https://www.giffard.com/en/confectionery-nuts-and-spices/437-149-cinnamon-syrup.html$q$, $q$producer$q$),
($q$Giffard Coconut Syrup$q$, NULL, $q$Coconut Syrup$q$, $q$Giffard$q$, NULL, $q$FR$q$, NULL, $q$https://www.giffard.com/en/fruits-and-plants-syrups/463-177-coconut-syrup.html$q$, $q$producer$q$),
($q$Giffard Egg White Syrup$q$, NULL, $q$Syrup$q$, $q$Giffard$q$, NULL, $q$FR$q$, NULL, $q$https://www.giffard.com/en/specialties/481-137-giffard-egg-white-syrup.html$q$, $q$producer$q$),
($q$Giffard Elderflower Syrup$q$, NULL, $q$Syrup$q$, $q$Giffard$q$, NULL, $q$FR$q$, NULL, $q$https://www.giffard.com/en/fruits-and-plants-syrups/503-158-elderflower-syrup.html$q$, $q$producer$q$),
($q$Giffard Falernum Syrup$q$, NULL, $q$Falernum$q$, $q$Giffard$q$, NULL, $q$FR$q$, NULL, $q$https://www.giffard.com/en/specialties/6436-200-falernum-syrup.html$q$, $q$producer$q$),
($q$Giffard Ginger Syrup$q$, NULL, $q$Ginger Syrup$q$, $q$Giffard$q$, NULL, $q$FR$q$, NULL, $q$https://www.giffard.com/en/confectionery-nuts-and-spices/452-201-ginger-syrup.html$q$, $q$producer$q$),
($q$Giffard Grenadine Syrup$q$, $q$Giffard Grenadine Syrup$q$, $q$Grenadine$q$, $q$Giffard$q$, NULL, $q$FR$q$, NULL, $q$https://www.giffard.com/en/fruits-and-plants-syrups/454-165-grenadine-syrup.html$q$, $q$producer$q$),
($q$Giffard Gum Syrup$q$, NULL, $q$Gomme Syrup$q$, $q$Giffard$q$, NULL, $q$FR$q$, NULL, $q$https://www.giffard.com/en/fruits-and-plants-syrups/453-162-gum-syrup.html$q$, $q$producer$q$),
($q$Giffard Hibiscus Syrup$q$, NULL, $q$Syrup$q$, $q$Giffard$q$, NULL, $q$FR$q$, NULL, $q$https://www.giffard.com/en/fruits-and-plants-syrups/5742-166-hibiscus-syrup.html$q$, $q$producer$q$),
($q$Giffard Honey Syrup$q$, NULL, $q$Honey Syrup$q$, $q$Giffard$q$, NULL, $q$FR$q$, NULL, $q$https://www.giffard.com/en/confectionery-nuts-and-spices/461-204-honey-syrup.html$q$, $q$producer$q$),
($q$Giffard Lychee Syrup$q$, NULL, $q$Syrup$q$, $q$Giffard$q$, NULL, $q$FR$q$, NULL, $q$https://www.giffard.com/en/fruits-and-plants-syrups/519-169-lychee-syrup.html$q$, $q$producer$q$),
($q$Giffard Mango Syrup$q$, NULL, $q$Syrup$q$, $q$Giffard$q$, NULL, $q$FR$q$, NULL, $q$https://www.giffard.com/en/fruits-and-plants-syrups/455-170-mango-syrup.html$q$, $q$producer$q$),
($q$Giffard Orgeat Syrup$q$, $q$Giffard Orgeat Syrup$q$, $q$Orgeat$q$, $q$Giffard$q$, NULL, $q$FR$q$, NULL, $q$https://www.giffard.com/en/confectionery-nuts-and-spices/390-179-orgeat-syrup.html$q$, $q$producer$q$),
($q$Giffard Passion Fruit Syrup$q$, $q$Giffard Passion Fruit Syrup$q$, $q$Passion Fruit Syrup$q$, $q$Giffard$q$, NULL, $q$FR$q$, NULL, $q$https://www.giffard.com/en/fruits-and-plants-syrups/468-161-passion-fruit-syrup.html$q$, $q$producer$q$),
($q$Giffard Peach Syrup$q$, NULL, $q$Syrup$q$, $q$Giffard$q$, NULL, $q$FR$q$, NULL, $q$https://www.giffard.com/en/fruits-and-plants-syrups/469-182-peach-syrup.html$q$, $q$producer$q$),
($q$Giffard Pineapple Syrup$q$, NULL, $q$Pineapple Syrup$q$, $q$Giffard$q$, NULL, $q$FR$q$, NULL, $q$https://www.giffard.com/en/fruits-and-plants-syrups/433-144-pineapple-syrup.html$q$, $q$producer$q$),
($q$Giffard Pink Grapefruit Syrup$q$, NULL, $q$Syrup$q$, $q$Giffard$q$, NULL, $q$FR$q$, NULL, $q$https://www.giffard.com/en/fruits-and-plants-syrups/467-180-pink-grapefruit-syrup.html$q$, $q$producer$q$),
($q$Giffard Raspberry Syrup$q$, NULL, $q$Raspberry Syrup$q$, $q$Giffard$q$, NULL, $q$FR$q$, NULL, $q$https://www.giffard.com/en/fruits-and-plants-syrups/450-160-raspberry-syrup.html$q$, $q$producer$q$),
($q$Giffard Strawberry Syrup$q$, NULL, $q$Syrup$q$, $q$Giffard$q$, NULL, $q$FR$q$, NULL, $q$https://www.giffard.com/en/fruits-and-plants-syrups/449-159-strawberry-syrup.html$q$, $q$producer$q$),
($q$Giffard Sugar Cane Syrup$q$, $q$Giffard Sugar Cane Syrup$q$, $q$Cane Syrup$q$, $q$Giffard$q$, NULL, $q$FR$q$, NULL, $q$https://www.giffard.com/en/fruits-and-plants-syrups/474-220-white-sugar-cane-syrup.html$q$, $q$producer$q$),
($q$Giffard Vanilla Syrup$q$, NULL, $q$Vanilla Syrup$q$, $q$Giffard$q$, NULL, $q$FR$q$, NULL, $q$https://www.giffard.com/en/confectionery-nuts-and-spices/475-219-vanilla-syrup.html$q$, $q$producer$q$),
($q$Giffard White Peach Syrup$q$, NULL, $q$Syrup$q$, $q$Giffard$q$, NULL, $q$FR$q$, NULL, $q$https://www.giffard.com/en/fruits-and-plants-syrups/7821-183-white-peach-syrup.html$q$, $q$producer$q$),
($q$Jack Rudy Classic Tonic Syrup$q$, NULL, $q$Tonic Syrup$q$, $q$Jack Rudy Cocktail Co.$q$, NULL, $q$US$q$, NULL, $q$https://alambika.ca/products/jack-rudy-classic-tonic-syrup-473ml$q$, $q$retailer$q$),
($q$Jack Rudy Demerara Syrup$q$, NULL, $q$Demerara Syrup$q$, $q$Jack Rudy Cocktail Co.$q$, NULL, $q$US$q$, NULL, $q$https://alambika.ca/products/jack-rudy-demerara-syrup-236ml$q$, $q$retailer$q$),
($q$Jack Rudy Elderflower Tonic$q$, NULL, $q$Tonic Syrup$q$, $q$Jack Rudy Cocktail Co.$q$, NULL, $q$US$q$, NULL, $q$https://alambika.ca/products/jack-rudy-elderflower-tonic-473ml$q$, $q$retailer$q$),
($q$Liber & Co Almond Orgeat Syrup$q$, $q$Liber & Co Almond Orgeat Syrup$q$, $q$Orgeat$q$, $q$Liber & Co$q$, NULL, NULL, NULL, $q$https://www.skurnik.com/producer/liber-syrups/$q$, $q$retailer$q$),
($q$Liber & Co Blood Orange Cordial$q$, NULL, $q$Cordial$q$, $q$Liber & Co$q$, NULL, NULL, NULL, $q$https://www.skurnik.com/sku/blood-orange-cordial-750ml-liber-co-strapped/$q$, $q$retailer$q$),
($q$Liber & Co Cinnamon Syrup$q$, NULL, $q$Cinnamon Syrup$q$, $q$Liber & Co$q$, NULL, NULL, NULL, $q$https://www.skurnik.com/sku/cinnamon-syrup-750ml-liber-co-strapped/$q$, $q$retailer$q$),
($q$Liber & Co Classic Gum Syrup$q$, NULL, $q$Gomme Syrup$q$, $q$Liber & Co$q$, NULL, NULL, NULL, $q$https://www.skurnik.com/sku/classic-gum-syrup-750ml-liber-co-strapped/$q$, $q$retailer$q$),
($q$Liber & Co Demerara Gum Syrup$q$, NULL, $q$Demerara Syrup$q$, $q$Liber & Co$q$, NULL, NULL, NULL, $q$https://www.skurnik.com/sku/demerara-gum-syrup-750ml-liber-co-strapped/$q$, $q$retailer$q$),
($q$Liber & Co Fiery Ginger Syrup$q$, $q$Liber & Co Fiery Ginger Syrup$q$, $q$Ginger Syrup$q$, $q$Liber & Co$q$, NULL, NULL, NULL, $q$https://www.skurnik.com/sku/fiery-ginger-syrup-750ml-liber-co-strapped/$q$, $q$retailer$q$),
($q$Liber & Co Japanese Yuzu Syrup$q$, NULL, $q$Syrup$q$, $q$Liber & Co$q$, NULL, NULL, NULL, $q$https://www.skurnik.com/sku/japanese-yuzu-syrup-750ml-liber-co-strapped/$q$, $q$retailer$q$),
($q$Liber & Co Pacific Strawberry Syrup$q$, NULL, $q$Syrup$q$, $q$Liber & Co$q$, NULL, NULL, NULL, $q$https://www.skurnik.com/sku/pacific-strawberry-syrup-750ml-liber-co-strapped/$q$, $q$retailer$q$),
($q$Liber & Co Pineapple Gum Syrup$q$, $q$Liber & Co Pineapple Gum Syrup$q$, $q$Pineapple Syrup$q$, $q$Liber & Co$q$, NULL, NULL, NULL, $q$https://www.skurnik.com/sku/pineapple-gum-syrup-750ml-liber-co-strapped/$q$, $q$retailer$q$),
($q$Liber & Co Real Grenadine$q$, $q$Liber & Co Real Grenadine$q$, $q$Grenadine$q$, $q$Liber & Co$q$, NULL, NULL, NULL, $q$https://www.skurnik.com/sku/real-grenadine-750ml-liber-co-strapped/$q$, $q$retailer$q$),
($q$Liber & Co Rio Red Grapefruit Cordial$q$, NULL, $q$Cordial$q$, $q$Liber & Co$q$, NULL, NULL, NULL, $q$https://www.skurnik.com/sku/rio-red-grapefruit-cordial-750ml-liber-co-strapped/$q$, $q$retailer$q$),
($q$Liber & Co Toasted Coconut Syrup$q$, NULL, $q$Coconut Syrup$q$, $q$Liber & Co$q$, NULL, NULL, NULL, $q$https://www.skurnik.com/sku/toasted-coconut-syrup-750ml-liber-co-strapped/$q$, $q$retailer$q$),
($q$Liber & Co Tropical Passionfruit Syrup$q$, $q$Liber & Co Passion Fruit Syrup$q$, $q$Passion Fruit Syrup$q$, $q$Liber & Co$q$, NULL, NULL, NULL, $q$https://www.skurnik.com/sku/tropical-passionfruit-syrup-750ml-liber-co-strapped/$q$, $q$retailer$q$),
($q$Liber & Co Yakima Valley Peach Syrup$q$, NULL, $q$Syrup$q$, $q$Liber & Co$q$, NULL, NULL, NULL, $q$https://www.skurnik.com/sku/yakima-valley-peach-syrup-750ml-liber-co-strapped/$q$, $q$retailer$q$),
($q$Monin Almond (Orgeat) Syrup$q$, $q$Monin Orgeat Syrup$q$, $q$Orgeat$q$, $q$Monin$q$, NULL, NULL, NULL, $q$https://monin.us/products/almond-syrup$q$, $q$producer$q$),
($q$Monin Blackberry Syrup$q$, NULL, $q$Syrup$q$, $q$Monin$q$, NULL, NULL, NULL, $q$https://monin.us/products/blackberry-syrup$q$, $q$producer$q$),
($q$Monin Blood Orange Syrup$q$, NULL, $q$Syrup$q$, $q$Monin$q$, NULL, NULL, NULL, $q$https://monin.us/products/blood-orange-syrup$q$, $q$producer$q$),
($q$Monin Blue Curacao Syrup$q$, NULL, $q$Syrup$q$, $q$Monin$q$, NULL, NULL, NULL, $q$https://monin.us/products/blue-curacao-syrup$q$, $q$producer$q$),
($q$Monin Cinnamon Syrup$q$, $q$Monin Cinnamon Syrup$q$, $q$Cinnamon Syrup$q$, $q$Monin$q$, NULL, NULL, NULL, $q$https://monin.us/products/cinnamon-syrup$q$, $q$producer$q$),
($q$Monin Coconut Syrup$q$, $q$Monin Coconut Syrup$q$, $q$Coconut Syrup$q$, $q$Monin$q$, NULL, NULL, NULL, $q$https://monin.us/products/coconut-syrup$q$, $q$producer$q$),
($q$Monin Cucumber Syrup$q$, NULL, $q$Syrup$q$, $q$Monin$q$, NULL, NULL, NULL, $q$https://monin.us/products/cucumber-syrup$q$, $q$producer$q$),
($q$Monin Elderflower Syrup$q$, $q$Monin Elderflower Syrup$q$, $q$Syrup$q$, $q$Monin$q$, NULL, NULL, NULL, $q$https://monin.us/products/elderflower-syrup$q$, $q$producer$q$),
($q$Monin Ginger Syrup$q$, $q$Monin Ginger Syrup$q$, $q$Ginger Syrup$q$, $q$Monin$q$, NULL, NULL, NULL, $q$https://monin.us/products/ginger-syrup$q$, $q$producer$q$),
($q$Monin Grenadine Syrup$q$, $q$Monin Grenadine Syrup$q$, $q$Grenadine$q$, $q$Monin$q$, NULL, NULL, NULL, $q$https://monin.us/products/grenadine-syrup$q$, $q$producer$q$),
($q$Monin Hibiscus Syrup$q$, NULL, $q$Syrup$q$, $q$Monin$q$, NULL, NULL, NULL, $q$https://monin.us/products/hibiscus-syrup$q$, $q$producer$q$),
($q$Monin Honey Syrup$q$, NULL, $q$Honey Syrup$q$, $q$Monin$q$, NULL, NULL, NULL, $q$https://monin.us/products/honey-syrup$q$, $q$producer$q$),
($q$Monin Lavender Syrup$q$, NULL, $q$Syrup$q$, $q$Monin$q$, NULL, NULL, NULL, $q$https://monin.us/products/lavender-syrup$q$, $q$producer$q$),
($q$Monin Lychee Syrup$q$, NULL, $q$Syrup$q$, $q$Monin$q$, NULL, NULL, NULL, $q$https://monin.us/products/lychee-syrup$q$, $q$producer$q$),
($q$Monin Mango Syrup$q$, NULL, $q$Syrup$q$, $q$Monin$q$, NULL, NULL, NULL, $q$https://monin.us/products/mango-syrup$q$, $q$producer$q$),
($q$Monin Passion Fruit Syrup$q$, $q$Monin Passion Fruit Syrup$q$, $q$Passion Fruit Syrup$q$, $q$Monin$q$, NULL, NULL, NULL, $q$https://monin.us/products/passion-fruit-syrup$q$, $q$producer$q$),
($q$Monin Peach Syrup$q$, NULL, $q$Syrup$q$, $q$Monin$q$, NULL, NULL, NULL, $q$https://monin.us/products/peach-syrup$q$, $q$producer$q$),
($q$Monin Pineapple Syrup$q$, NULL, $q$Pineapple Syrup$q$, $q$Monin$q$, NULL, NULL, NULL, $q$https://monin.us/products/pineapple-syrup$q$, $q$producer$q$),
($q$Monin Pure Cane Syrup$q$, $q$Monin Pure Cane Syrup$q$, $q$Cane Syrup$q$, $q$Monin$q$, NULL, NULL, NULL, $q$https://monin.us/products/pure-cane-syrup$q$, $q$producer$q$),
($q$Monin Raspberry Syrup$q$, $q$Monin Raspberry Syrup$q$, $q$Raspberry Syrup$q$, $q$Monin$q$, NULL, NULL, NULL, $q$https://monin.us/products/raspberry-syrup$q$, $q$producer$q$),
($q$Monin Rose Syrup$q$, NULL, $q$Syrup$q$, $q$Monin$q$, NULL, NULL, NULL, $q$https://monin.us/products/rose-syrup$q$, $q$producer$q$),
($q$Monin Ruby Red Grapefruit Syrup$q$, NULL, $q$Syrup$q$, $q$Monin$q$, NULL, NULL, NULL, $q$https://monin.us/products/ruby-red-grapefruit-syrup$q$, $q$producer$q$),
($q$Monin Strawberry Syrup$q$, NULL, $q$Syrup$q$, $q$Monin$q$, NULL, NULL, NULL, $q$https://monin.us/products/strawberry-syrup$q$, $q$producer$q$),
($q$Monin Vanilla Syrup$q$, $q$Monin Vanilla Syrup$q$, $q$Vanilla Syrup$q$, $q$Monin$q$, NULL, NULL, NULL, $q$https://monin.us/products/vanilla-syrup$q$, $q$producer$q$),
($q$Monin Watermelon Syrup$q$, NULL, $q$Syrup$q$, $q$Monin$q$, NULL, NULL, NULL, $q$https://monin.us/products/watermelon-syrup$q$, $q$producer$q$),
($q$Paragon Labdanum Cordial$q$, NULL, $q$Cordial$q$, $q$Paragon$q$, NULL, NULL, NULL, $q$https://paragoncordial.com$q$, $q$producer$q$),
($q$Paragon Palo Santo Cordial$q$, NULL, $q$Cordial$q$, $q$Paragon$q$, NULL, NULL, NULL, $q$https://paragoncordial.com$q$, $q$producer$q$),
($q$Paragon Rue Berry Cordial$q$, NULL, $q$Cordial$q$, $q$Paragon$q$, NULL, NULL, NULL, $q$https://paragoncordial.com$q$, $q$producer$q$),
($q$Paragon Timur Berry Cordial$q$, $q$Paragon Timur Berry Cordial$q$, $q$Cordial$q$, $q$Paragon$q$, NULL, NULL, NULL, $q$https://paragoncordial.com/$q$, $q$producer$q$),
($q$Paragon Vetiver Cordial$q$, $q$Paragon Vetiver Cordial$q$, $q$Cordial$q$, $q$Paragon$q$, NULL, NULL, NULL, $q$https://paragoncordial.com$q$, $q$producer$q$),
($q$Paragon White Penja Pepper Cordial$q$, NULL, $q$Cordial$q$, $q$Paragon$q$, NULL, NULL, NULL, $q$https://paragoncordial.com$q$, $q$producer$q$),
($q$Polar Sour Lemon$q$, NULL, $q$Sour Mix$q$, $q$Polar$q$, NULL, $q$US$q$, NULL, $q$https://polarmixers.com/sours/$q$, $q$producer$q$),
($q$Polar Tom Collins$q$, NULL, $q$Sour Mix$q$, $q$Polar$q$, NULL, $q$US$q$, NULL, $q$https://polarmixers.com/sours/$q$, $q$producer$q$),
($q$Q Mixers Margarita Mix$q$, NULL, $q$Sour Mix$q$, $q$Q Mixers$q$, NULL, NULL, NULL, $q$https://qmixers.com/our-mixers/$q$, $q$producer$q$),
($q$Q Mixers Sparkling Light Margarita$q$, NULL, $q$Sour Mix$q$, $q$Q Mixers$q$, NULL, NULL, NULL, $q$https://qmixers.com/our-mixers/$q$, $q$producer$q$),
($q$Q Mixers Spicy Grapefruit Margarita Mix$q$, NULL, $q$Sour Mix$q$, $q$Q Mixers$q$, NULL, NULL, NULL, $q$https://qmixers.com/our-mixers/$q$, $q$producer$q$),
($q$Q Mixers Spicy Mango Margarita Mix$q$, NULL, $q$Sour Mix$q$, $q$Q Mixers$q$, NULL, NULL, NULL, $q$https://qmixers.com/our-mixers/$q$, $q$producer$q$),
($q$Agave Reàl$q$, NULL, $q$Agave Syrup$q$, $q$Reàl$q$, NULL, NULL, NULL, $q$https://www.realingredients.com/products/$q$, $q$producer$q$),
($q$Banana Reàl$q$, NULL, $q$Syrup$q$, $q$Reàl$q$, NULL, NULL, NULL, $q$https://www.realingredients.com/products/$q$, $q$producer$q$),
($q$Black Cherry Reàl$q$, NULL, $q$Syrup$q$, $q$Reàl$q$, NULL, NULL, NULL, $q$https://www.realingredients.com/products/$q$, $q$producer$q$),
($q$Blackberry Reàl$q$, NULL, $q$Syrup$q$, $q$Reàl$q$, NULL, NULL, NULL, $q$https://www.realingredients.com/products/$q$, $q$producer$q$),
($q$Blueberry Reàl$q$, NULL, $q$Syrup$q$, $q$Reàl$q$, NULL, NULL, NULL, $q$https://www.realingredients.com/products/$q$, $q$producer$q$),
($q$Coco Reàl$q$, NULL, $q$Cream of Coconut$q$, $q$Reàl$q$, NULL, NULL, NULL, $q$https://www.realingredients.com/products/$q$, $q$producer$q$),
($q$Crisp Apple Reàl$q$, NULL, $q$Syrup$q$, $q$Reàl$q$, NULL, NULL, NULL, $q$https://www.realingredients.com/products/$q$, $q$producer$q$),
($q$Dragon Reàl$q$, NULL, $q$Syrup$q$, $q$Reàl$q$, NULL, NULL, NULL, $q$https://www.realingredients.com/products/$q$, $q$producer$q$),
($q$Fig Reàl$q$, NULL, $q$Syrup$q$, $q$Reàl$q$, NULL, NULL, NULL, $q$https://www.realingredients.com/products/$q$, $q$producer$q$),
($q$Ginger Reàl$q$, NULL, $q$Ginger Syrup$q$, $q$Reàl$q$, NULL, NULL, NULL, $q$https://www.realingredients.com/products/$q$, $q$producer$q$),
($q$Gourmet Pepper Reàl$q$, NULL, $q$Syrup$q$, $q$Reàl$q$, NULL, NULL, NULL, $q$https://www.realingredients.com/products/$q$, $q$producer$q$),
($q$Guava Reàl$q$, NULL, $q$Syrup$q$, $q$Reàl$q$, NULL, NULL, NULL, $q$https://www.realingredients.com/products/$q$, $q$producer$q$),
($q$Juicy Pear Reàl$q$, NULL, $q$Syrup$q$, $q$Reàl$q$, NULL, NULL, NULL, $q$https://www.realingredients.com/products/$q$, $q$producer$q$),
($q$Kiwi Reàl$q$, NULL, $q$Syrup$q$, $q$Reàl$q$, NULL, NULL, NULL, $q$https://www.realingredients.com/products/$q$, $q$producer$q$),
($q$Lychee Reàl$q$, NULL, $q$Syrup$q$, $q$Reàl$q$, NULL, NULL, NULL, $q$https://www.realingredients.com/products/$q$, $q$producer$q$),
($q$Mango Reàl$q$, NULL, $q$Syrup$q$, $q$Reàl$q$, NULL, NULL, NULL, $q$https://www.realingredients.com/products/$q$, $q$producer$q$),
($q$Passion Reàl$q$, NULL, $q$Passion Fruit Syrup$q$, $q$Reàl$q$, NULL, NULL, NULL, $q$https://www.realingredients.com/products/$q$, $q$producer$q$),
($q$Peach Reàl$q$, NULL, $q$Syrup$q$, $q$Reàl$q$, NULL, NULL, NULL, $q$https://www.realingredients.com/products/$q$, $q$producer$q$),
($q$Piña Reàl$q$, NULL, $q$Pineapple Syrup$q$, $q$Reàl$q$, NULL, NULL, NULL, $q$https://www.realingredients.com/products/$q$, $q$producer$q$),
($q$Prickly Reàl$q$, NULL, $q$Syrup$q$, $q$Reàl$q$, NULL, NULL, NULL, $q$https://www.realingredients.com/products/$q$, $q$producer$q$),
($q$Raspberry Reàl$q$, NULL, $q$Raspberry Syrup$q$, $q$Reàl$q$, NULL, NULL, NULL, $q$https://www.realingredients.com/products/$q$, $q$producer$q$),
($q$Strawberry Reàl$q$, NULL, $q$Syrup$q$, $q$Reàl$q$, NULL, NULL, NULL, $q$https://www.realingredients.com/products/$q$, $q$producer$q$),
($q$Vanilla Reàl$q$, NULL, $q$Vanilla Syrup$q$, $q$Reàl$q$, NULL, NULL, NULL, $q$https://www.realingredients.com/products/$q$, $q$producer$q$),
($q$Watermelon Reàl$q$, NULL, $q$Syrup$q$, $q$Reàl$q$, NULL, NULL, NULL, $q$https://www.realingredients.com/products/$q$, $q$producer$q$),
($q$Yuzu Reàl$q$, NULL, $q$Syrup$q$, $q$Reàl$q$, NULL, NULL, NULL, $q$https://www.realingredients.com/products/$q$, $q$producer$q$),
($q$Ribena Blackcurrant Squash$q$, $q$Ribena Blackcurrant$q$, $q$Cordial$q$, $q$Ribena$q$, NULL, NULL, NULL, $q$https://ribena.co.uk/sitemap/$q$, $q$producer$q$),
($q$Rose's Grenadine$q$, $q$Rose's Grenadine$q$, $q$Grenadine$q$, $q$Rose's$q$, NULL, NULL, NULL, $q$https://www.webstaurantstore.com/roses-1-liter-grenadine-syrup-case/115ROSEGREN.html$q$, $q$retailer$q$),
($q$Rose's Lime Cordial$q$, $q$Rose's Lime Cordial$q$, $q$Lime Cordial$q$, $q$Rose's$q$, NULL, NULL, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/6929/roses-sweetened-lime-juice-cordial$q$, $q$reference$q$),
($q$Schweppes Classic Lime Juice Cordial$q$, NULL, $q$Lime Cordial$q$, $q$Schweppes$q$, NULL, NULL, NULL, $q$https://schweppes.com.au/classic-cordial$q$, $q$producer$q$),
($q$Schweppes Classic Raspberry Cordial$q$, NULL, $q$Cordial$q$, $q$Schweppes$q$, NULL, NULL, NULL, $q$https://schweppes.com.au/classic-cordial$q$, $q$producer$q$),
($q$Small Hand Foods Ginger Syrup$q$, NULL, $q$Ginger Syrup$q$, $q$Small Hand Foods$q$, NULL, NULL, NULL, $q$https://smallhandfoods.com/syrups$q$, $q$producer$q$),
($q$Small Hand Foods Grenadine$q$, NULL, $q$Grenadine$q$, $q$Small Hand Foods$q$, NULL, NULL, NULL, $q$https://smallhandfoods.com/syrups$q$, $q$producer$q$),
($q$Small Hand Foods Gum Syrup$q$, $q$Small Hand Foods Gum Syrup$q$, $q$Gomme Syrup$q$, $q$Small Hand Foods$q$, NULL, NULL, NULL, $q$https://smallhandfoods.com/syrups$q$, $q$producer$q$),
($q$Small Hand Foods Orgeat$q$, $q$Small Hand Foods Orgeat$q$, $q$Orgeat$q$, $q$Small Hand Foods$q$, NULL, NULL, NULL, $q$https://smallhandfoods.com/syrups$q$, $q$producer$q$),
($q$Small Hand Foods Passion Fruit Syrup$q$, NULL, $q$Passion Fruit Syrup$q$, $q$Small Hand Foods$q$, NULL, NULL, NULL, $q$https://smallhandfoods.com/syrups$q$, $q$producer$q$),
($q$Small Hand Foods Pineapple Gum Syrup$q$, $q$Small Hand Foods Pineapple Gum Syrup$q$, $q$Pineapple Syrup$q$, $q$Small Hand Foods$q$, NULL, NULL, NULL, $q$https://smallhandfoods.com/syrups$q$, $q$producer$q$),
($q$Small Hand Foods Raspberry Gum Syrup$q$, $q$Small Hand Foods Raspberry Gum Syrup$q$, $q$Raspberry Syrup$q$, $q$Small Hand Foods$q$, NULL, NULL, NULL, $q$https://smallhandfoods.com/syrups$q$, $q$producer$q$),
($q$Small Hand Foods Tonic$q$, NULL, $q$Tonic Syrup$q$, $q$Small Hand Foods$q$, NULL, NULL, NULL, $q$https://smallhandfoods.com/syrups$q$, $q$producer$q$),
($q$Sūpāsawā Cocktail Mixer$q$, $q$Sūpāsawā$q$, $q$Sour Mixer$q$, $q$Sūpāsawā$q$, NULL, $q$BE$q$, NULL, $q$https://www.supasawa.com/$q$, $q$producer$q$),
($q$William Fox Blackberry Syrup$q$, NULL, $q$Syrup$q$, $q$William Fox$q$, NULL, $q$GB$q$, NULL, $q$https://www.williamfoxuk.com/post/full-flavour-list$q$, $q$producer$q$),
($q$William Fox Chilli Syrup$q$, NULL, $q$Syrup$q$, $q$William Fox$q$, NULL, $q$GB$q$, NULL, $q$https://www.williamfoxuk.com/post/full-flavour-list$q$, $q$producer$q$),
($q$William Fox Cinnamon Syrup$q$, NULL, $q$Cinnamon Syrup$q$, $q$William Fox$q$, NULL, $q$GB$q$, NULL, $q$https://www.williamfoxuk.com/post/full-flavour-list$q$, $q$producer$q$),
($q$William Fox Citric Burst Sweet and Sour Mix$q$, NULL, $q$Sour Mix$q$, $q$William Fox$q$, NULL, $q$GB$q$, NULL, $q$https://www.williamfoxuk.com/product-page/citric-burst-sweet-and-sour-mix$q$, $q$producer$q$),
($q$William Fox Coconut Syrup$q$, NULL, $q$Coconut Syrup$q$, $q$William Fox$q$, NULL, $q$GB$q$, NULL, $q$https://www.williamfoxuk.com/post/full-flavour-list$q$, $q$producer$q$),
($q$William Fox Elderflower Syrup$q$, NULL, $q$Syrup$q$, $q$William Fox$q$, NULL, $q$GB$q$, NULL, $q$https://www.williamfoxuk.com/post/full-flavour-list$q$, $q$producer$q$),
($q$William Fox Eucalyptus Syrup$q$, NULL, $q$Syrup$q$, $q$William Fox$q$, NULL, $q$GB$q$, NULL, $q$https://www.williamfoxuk.com/post/full-flavour-list$q$, $q$producer$q$),
($q$William Fox Ginger Syrup$q$, NULL, $q$Ginger Syrup$q$, $q$William Fox$q$, NULL, $q$GB$q$, NULL, $q$https://www.williamfoxuk.com/post/full-flavour-list$q$, $q$producer$q$),
($q$William Fox Gomme Syrup$q$, NULL, $q$Gomme Syrup$q$, $q$William Fox$q$, NULL, $q$GB$q$, NULL, $q$https://www.williamfoxuk.com/post/full-flavour-list$q$, $q$producer$q$),
($q$William Fox Grenadine Syrup$q$, NULL, $q$Grenadine$q$, $q$William Fox$q$, NULL, $q$GB$q$, NULL, $q$https://www.williamfoxuk.com/post/full-flavour-list$q$, $q$producer$q$),
($q$William Fox Hibiscus Syrup$q$, NULL, $q$Syrup$q$, $q$William Fox$q$, NULL, $q$GB$q$, NULL, $q$https://www.williamfoxuk.com/post/full-flavour-list$q$, $q$producer$q$),
($q$William Fox Lavender Syrup$q$, NULL, $q$Syrup$q$, $q$William Fox$q$, NULL, $q$GB$q$, NULL, $q$https://www.williamfoxuk.com/post/full-flavour-list$q$, $q$producer$q$),
($q$William Fox Mango Syrup$q$, NULL, $q$Syrup$q$, $q$William Fox$q$, NULL, $q$GB$q$, NULL, $q$https://www.williamfoxuk.com/post/full-flavour-list$q$, $q$producer$q$),
($q$William Fox Orgeat Syrup$q$, NULL, $q$Orgeat$q$, $q$William Fox$q$, NULL, $q$GB$q$, NULL, $q$https://www.williamfoxuk.com/product-page/orgeat-syrup$q$, $q$producer$q$),
($q$William Fox Passion Fruit Syrup$q$, NULL, $q$Passion Fruit Syrup$q$, $q$William Fox$q$, NULL, $q$GB$q$, NULL, $q$https://www.williamfoxuk.com/post/full-flavour-list$q$, $q$producer$q$),
($q$William Fox Peach Syrup$q$, NULL, $q$Syrup$q$, $q$William Fox$q$, NULL, $q$GB$q$, NULL, $q$https://www.williamfoxuk.com/post/full-flavour-list$q$, $q$producer$q$),
($q$William Fox Pineapple Syrup$q$, NULL, $q$Pineapple Syrup$q$, $q$William Fox$q$, NULL, $q$GB$q$, NULL, $q$https://www.williamfoxuk.com/post/full-flavour-list$q$, $q$producer$q$),
($q$William Fox Pomegranate Syrup$q$, NULL, $q$Syrup$q$, $q$William Fox$q$, NULL, $q$GB$q$, NULL, $q$https://www.williamfoxuk.com/post/full-flavour-list$q$, $q$producer$q$),
($q$William Fox Raspberry Syrup$q$, NULL, $q$Raspberry Syrup$q$, $q$William Fox$q$, NULL, $q$GB$q$, NULL, $q$https://www.williamfoxuk.com/post/full-flavour-list$q$, $q$producer$q$),
($q$William Fox Rhubarb Syrup$q$, NULL, $q$Syrup$q$, $q$William Fox$q$, NULL, $q$GB$q$, NULL, $q$https://www.williamfoxuk.com/post/full-flavour-list$q$, $q$producer$q$),
($q$William Fox Rose Syrup$q$, NULL, $q$Syrup$q$, $q$William Fox$q$, NULL, $q$GB$q$, NULL, $q$https://www.williamfoxuk.com/post/full-flavour-list$q$, $q$producer$q$),
($q$William Fox Strawberry Syrup$q$, NULL, $q$Syrup$q$, $q$William Fox$q$, NULL, $q$GB$q$, NULL, $q$https://www.williamfoxuk.com/post/full-flavour-list$q$, $q$producer$q$),
($q$William Fox Thyme Syrup$q$, NULL, $q$Syrup$q$, $q$William Fox$q$, NULL, $q$GB$q$, NULL, $q$https://www.williamfoxuk.com/post/full-flavour-list$q$, $q$producer$q$),
($q$William Fox Vanilla Syrup$q$, NULL, $q$Vanilla Syrup$q$, $q$William Fox$q$, NULL, $q$GB$q$, NULL, $q$https://www.williamfoxuk.com/post/full-flavour-list$q$, $q$producer$q$),
($q$William Fox Watermelon Syrup$q$, NULL, $q$Syrup$q$, $q$William Fox$q$, NULL, $q$GB$q$, NULL, $q$https://www.williamfoxuk.com/post/full-flavour-list$q$, $q$producer$q$),
($q$bottlegreen Elderflower & Elderberry Cordial$q$, NULL, $q$Elderflower Cordial$q$, $q$bottlegreen$q$, NULL, NULL, NULL, $q$https://www.bottlegreendrinks.com/products/elderflower-elderberry-cordial$q$, $q$producer$q$),
($q$bottlegreen Elderflower Cordial$q$, $q$Bottle Green Elderflower Cordial$q$, $q$Elderflower Cordial$q$, $q$bottlegreen$q$, NULL, NULL, NULL, $q$https://www.bottlegreendrinks.com/products/elderflower-cordial$q$, $q$producer$q$),
($q$bottlegreen Ginger & Lemongrass Cordial$q$, NULL, $q$Cordial$q$, $q$bottlegreen$q$, NULL, NULL, NULL, $q$https://www.bottlegreendrinks.com/products/ginger-lemongrass-cordial$q$, $q$producer$q$),
($q$bottlegreen Lime & Mint Cordial$q$, NULL, $q$Cordial$q$, $q$bottlegreen$q$, NULL, NULL, NULL, $q$https://www.bottlegreendrinks.com/products/lime-mint-cordial$q$, $q$producer$q$),
($q$bottlegreen Mango & Passionfruit Cordial$q$, NULL, $q$Cordial$q$, $q$bottlegreen$q$, NULL, NULL, NULL, $q$https://www.bottlegreendrinks.com/products/mango-passionfruit-cordial$q$, $q$producer$q$),
($q$bottlegreen Pink Grapefruit Cordial$q$, NULL, $q$Cordial$q$, $q$bottlegreen$q$, NULL, NULL, NULL, $q$https://www.bottlegreendrinks.com/products/pink-grapefruit-cordial$q$, $q$producer$q$),
($q$bottlegreen Pomegranate & Elderflower Cordial$q$, NULL, $q$Elderflower Cordial$q$, $q$bottlegreen$q$, NULL, NULL, NULL, $q$https://www.bottlegreendrinks.com/products/pomegranate-elderflower-cordial$q$, $q$producer$q$),
($q$bottlegreen Raspberry Cordial$q$, NULL, $q$Cordial$q$, $q$bottlegreen$q$, NULL, NULL, NULL, $q$https://www.bottlegreendrinks.com/products/raspberry-cordial$q$, $q$producer$q$),
($q$bottlegreen Rose & Wild Elderflower Cordial$q$, NULL, $q$Elderflower Cordial$q$, $q$bottlegreen$q$, NULL, NULL, NULL, $q$https://www.bottlegreendrinks.com/products/rose-elderflower-cordial$q$, $q$producer$q$);

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
    WHEN b.style IN ($q$Syrup$q$) AND EXISTS (
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
