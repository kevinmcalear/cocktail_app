-- Non-alcoholic spirits and aperitifs: every bottle checked on its
-- producer's own page (or, where that page was blocked, a major retailer,
-- importer or Difford's), after 20261011167000. Step 3k of the bottle
-- catalog plan: https://claude.ai/artifact/Vu6seuSNtN42nKYb2nDCVR
--
--   * The core range of every alcohol-free spirit and aperitif brand in
--     our catalog or on The Whisky Exchange's list.
--   * On a copy of production (2026-10-09, with the loads before this
--     one applied): 51 new bottles, and 58 we had that get their label
--     name (10 renamed, the old name kept as an alias), style, ABV,
--     country, protected name and maker where they were missing or
--     wrong.
--   * Styles: Existing styles under Non-alcoholic Spirit: gin, whiskey,
--     rum, agave and botanical alternatives, aperitifs, bitter
--     aperitivi, amari, vermouths, amaretto and coffee liqueur
--     alternatives. Near-duplicate styles (Zero Proof Gin, N.A.
--     Bourbon...) fold into the main ones.
--   * Out of scope: alcohol-free beer, wine and cider, ready-to-drink
--     cans and single-serve cocktails (Ghia Le Spritz, the Phony
--     Negronis, Amaro Falso), functional and cannabis drinks (Aplós).
--   * Each producer gets an unclaimed maker page (makes: bottles), or a
--     page an earlier load made gains it, and each bottle names it.
--   * Every fact keeps the page it was checked on in item_sources. An
--     ABV read off another page isn't kept, and a review site isn't a
--     source.
--   * An independent second check of 100 random rows found 3 wrong
--     facts in 405 (0.7%). Every correction is taken: Sunny Arvo is its
--     own brand (not its distillery, Three Foxes); "<0.5%" products
--     carry no ABV rather than 0.5. The Pathfinder Hemp & Root is a
--     hemp-seed amaro, kept as Non-Alcoholic Amaro.
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
(0, $q$Non-alcoholic Spirit$q$, NULL);

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
($q$Abstinence$q$, $q$abstinence$q$, $q$https://abstinencespirits.com$q$, NULL, NULL),
($q$Adriatico$q$, $q$adriatico$q$, $q$https://www.amarettoadriatico.com$q$, $q$IT$q$, NULL),
($q$Almave$q$, $q$almave$q$, $q$https://www.almave.com$q$, $q$MX$q$, NULL),
($q$Amàrico$q$, $q$amarico$q$, NULL, $q$IT$q$, NULL),
($q$Botivo$q$, $q$botivo$q$, $q$https://botivodrinks.com$q$, $q$GB$q$, NULL),
($q$Brunswick Aces$q$, $q$brunswick.aces$q$, $q$https://brunswickaces.com$q$, $q$AU$q$, NULL),
($q$Caleño$q$, $q$caleno$q$, $q$https://calenodrinks.com$q$, NULL, NULL),
($q$Citadelle$q$, $q$citadelle$q$, $q$https://citadellegin.com$q$, $q$FR$q$, NULL),
($q$Crodino$q$, $q$crodino$q$, $q$https://www.crodino.com$q$, NULL, NULL),
($q$Crossip$q$, $q$crossip$q$, $q$https://crossipdrinks.com$q$, NULL, NULL),
($q$Cut Above$q$, $q$cut.above$q$, $q$https://drinkcutabove.com$q$, NULL, NULL),
($q$Everleaf$q$, $q$everleaf$q$, $q$https://everleafdrinks.com$q$, NULL, NULL),
($q$Feragaia$q$, $q$feragaia$q$, $q$https://www.feragaia.com$q$, $q$GB$q$, NULL),
($q$Figlia$q$, $q$figlia$q$, $q$https://drinkfiglia.com$q$, NULL, NULL),
($q$Four Pillars$q$, $q$four.pillars$q$, $q$https://www.fourpillarsgin.com$q$, NULL, NULL),
($q$Free Spirits$q$, $q$free.spirits$q$, $q$https://drinkfreespirits.com$q$, NULL, NULL),
($q$Ghia$q$, $q$ghia$q$, $q$https://drinkghia.com$q$, NULL, NULL),
($q$Giffard$q$, $q$giffard$q$, $q$https://www.giffard.com$q$, $q$FR$q$, NULL),
($q$Gnista$q$, $q$gnista$q$, $q$https://gnistaspirits.com$q$, NULL, NULL),
($q$Gordon's$q$, $q$gordon.s$q$, $q$https://www.thebar.com/en/brands/gordons$q$, NULL, NULL),
($q$Lucano$q$, $q$lucano$q$, $q$https://amarolucano.it$q$, $q$IT$q$, NULL),
($q$Lyre's$q$, $q$lyre.s$q$, $q$https://lyres.com$q$, NULL, NULL),
($q$Martini$q$, $q$martini$q$, $q$https://www.martini.com$q$, NULL, NULL),
($q$Monday$q$, $q$monday$q$, $q$https://drinkmonday.co$q$, NULL, NULL),
($q$New London Light$q$, $q$new.london.light$q$, $q$https://newlondonlight.com$q$, $q$GB$q$, NULL),
($q$Noki & Co.$q$, $q$noki.co$q$, $q$https://www.nokidrinks.com/$q$, $q$IE$q$, NULL),
($q$Pallini$q$, $q$pallini$q$, $q$https://www.pallini.com$q$, $q$IT$q$, NULL),
($q$Pentire$q$, $q$pentire$q$, $q$https://pentiredrinks.com$q$, NULL, NULL),
($q$Ritual Zero Proof$q$, $q$ritual.zero.proof$q$, $q$https://ritualzeroproof.com$q$, NULL, NULL),
($q$Roots Divino$q$, $q$roots.divino$q$, $q$https://finestroots.com$q$, $q$GR$q$, NULL),
($q$Sabatini$q$, $q$sabatini$q$, $q$https://www.sabatinigin.com$q$, $q$IT$q$, NULL),
($q$Sanbittèr$q$, $q$sanbitter$q$, $q$https://www.sanpellegrino.com$q$, NULL, NULL),
($q$Seedlip$q$, $q$seedlip$q$, $q$https://www.seedlipdrinks.com$q$, NULL, NULL),
($q$Sipsmith$q$, $q$sipsmith$q$, $q$https://sipsmith.com$q$, NULL, NULL),
($q$Smiling Wolf$q$, $q$smiling.wolf$q$, NULL, NULL, NULL),
($q$Spiritless$q$, $q$spiritless$q$, $q$https://spiritless.com$q$, $q$US$q$, NULL),
($q$Sunny Arvo$q$, $q$sunny.arvo$q$, NULL, $q$AU$q$, NULL),
($q$Tanqueray$q$, $q$tanqueray$q$, $q$https://www.tanqueray.com$q$, NULL, NULL),
($q$Tenneyson$q$, $q$tenneyson$q$, $q$https://shop.tenneyson.com$q$, NULL, NULL),
($q$The Pathfinder$q$, $q$the.pathfinder$q$, $q$https://drinkthepathfinder.com$q$, NULL, NULL),
($q$Three Spirit$q$, $q$three.spirit$q$, $q$https://threespiritdrinks.com$q$, NULL, NULL),
($q$Vault Aperitivo$q$, $q$vault.aperitivo$q$, $q$https://www.vaultaperitivo.com$q$, NULL, NULL),
($q$Wilfred's$q$, $q$wilfred.s$q$, $q$https://www.wilfredsdrinks.com/$q$, $q$GB$q$, NULL);

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
($q$Abstinence Blood Orange Aperitif$q$, NULL, $q$Non-Alcoholic Bitter$q$, $q$Abstinence$q$, NULL, NULL, NULL, $q$https://abstinencespirits.com/products/blood-orange-aperitif$q$, $q$producer$q$),
($q$Abstinence Cape Agave$q$, NULL, $q$Non-Alcoholic Agave Spirit$q$, $q$Abstinence$q$, NULL, NULL, NULL, $q$https://abstinencespirits.com/products/cape-agave$q$, $q$producer$q$),
($q$Abstinence Cape Citrus$q$, $q$Abstinence Cape Citrus$q$, $q$Non-alcoholic Botanical Spirit$q$, $q$Abstinence$q$, NULL, NULL, NULL, $q$https://abstinencespirits.com/products/cape-citrus$q$, $q$producer$q$),
($q$Abstinence Cape Floral$q$, NULL, $q$Non-alcoholic Gin$q$, $q$Abstinence$q$, NULL, NULL, NULL, $q$https://abstinencespirits.com/products/cape-floral$q$, $q$producer$q$),
($q$Abstinence Cape Malt$q$, NULL, $q$Non-Alcoholic Whiskey$q$, $q$Abstinence$q$, NULL, NULL, NULL, $q$https://abstinencespirits.com/products/cape-malt$q$, $q$producer$q$),
($q$Abstinence Cape Spice$q$, NULL, $q$N.A. Rum$q$, $q$Abstinence$q$, NULL, NULL, NULL, $q$https://abstinencespirits.com/products/cape-spice-new$q$, $q$producer$q$),
($q$Abstinence Lemon Aperitif$q$, NULL, $q$Non-Alcoholic Aperitif$q$, $q$Abstinence$q$, NULL, NULL, NULL, $q$https://abstinencespirits.com/products/lemon-aperitif$q$, $q$producer$q$),
($q$Adriatico Amaretto Zero$q$, $q$Adriatico Zero$q$, $q$Non-Alcoholic Amaretto$q$, $q$Adriatico$q$, 0.0, $q$IT$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/9537/adriatico-amaretto-zero$q$, $q$reference$q$),
($q$Almave Blanco$q$, $q$Almave Blanco$q$, $q$Non-Alcoholic Agave Spirit$q$, $q$Almave$q$, NULL, $q$MX$q$, NULL, $q$https://www.almave.com/products/blanco$q$, $q$producer$q$),
($q$Almave Humo$q$, $q$Almave Humo$q$, $q$Non-Alcoholic Agave Spirit$q$, $q$Almave$q$, NULL, $q$MX$q$, NULL, $q$https://www.almave.com/products/almave-humo$q$, $q$producer$q$),
($q$Almave Ámbar$q$, $q$Almave Ambar$q$, $q$Non-Alcoholic Agave Spirit$q$, $q$Almave$q$, NULL, $q$MX$q$, NULL, $q$https://www.almave.com/products/ambar$q$, $q$producer$q$),
($q$Amàrico Originale$q$, NULL, $q$Non-Alcoholic Amaro$q$, $q$Amàrico$q$, NULL, $q$IT$q$, NULL, $q$https://callmewine.com/en/aperitivo-americano-analcolico-amarico-50cl-P58411.htm$q$, $q$retailer$q$),
($q$Amàrico Rosso$q$, NULL, $q$Non-Alcoholic Amaro$q$, $q$Amàrico$q$, NULL, $q$IT$q$, NULL, $q$https://callmewine.com/en/aperitivo-americano-analcolico-rosso-amarico-50cl-P58412.htm$q$, $q$retailer$q$),
($q$Botivo$q$, NULL, $q$Non-Alcoholic Aperitif$q$, $q$Botivo$q$, NULL, $q$GB$q$, NULL, $q$https://botivodrinks.com/products/botivo$q$, $q$producer$q$),
($q$Brunswick Aces Diamonds Sapiir$q$, NULL, $q$Non-alcoholic Gin$q$, $q$Brunswick Aces$q$, 0.0, $q$AU$q$, NULL, $q$https://brunswickaces.com/products/brunswick-aces-diamonds-sapiir$q$, $q$producer$q$),
($q$Brunswick Aces Hearts Sapiir$q$, NULL, $q$Non-alcoholic Gin$q$, $q$Brunswick Aces$q$, 0.0, $q$AU$q$, NULL, $q$https://brunswickaces.com/products/brunswick-aces-hearts-sapiir$q$, $q$producer$q$),
($q$Brunswick Aces Joker Sapiir$q$, NULL, $q$Non-alcoholic Spirit$q$, $q$Brunswick Aces$q$, 0.0, NULL, NULL, $q$https://brunswickaces.com/products/joker-sapiir-0-abv$q$, $q$producer$q$),
($q$Brunswick Aces Spades Sapiir$q$, NULL, $q$Non-alcoholic Gin$q$, $q$Brunswick Aces$q$, 0.0, $q$AU$q$, NULL, $q$https://brunswickaces.com/products/brunswick-aces-spades-sapiir$q$, $q$producer$q$),
($q$Caleño Dark & Spicy$q$, NULL, $q$N.A. Rum$q$, $q$Caleño$q$, 0.0, NULL, NULL, $q$https://calenodrinks.com/product/dark-spicy/$q$, $q$producer$q$),
($q$Caleño Light & Zesty$q$, NULL, $q$Non-alcoholic Gin$q$, $q$Caleño$q$, 0.0, NULL, NULL, $q$https://calenodrinks.com/product/light-zesty/$q$, $q$producer$q$),
($q$Caleño Mango & Passion Fruit$q$, NULL, $q$N.A. Rum$q$, $q$Caleño$q$, NULL, NULL, NULL, $q$https://calenodrinks.com/product/mango-passion-fruit/$q$, $q$producer$q$),
($q$Caleño White Coconut$q$, NULL, $q$N.A. Rum$q$, $q$Caleño$q$, NULL, NULL, NULL, $q$https://calenodrinks.com/product/white-coconut/$q$, $q$producer$q$),
($q$Citadelle 0.0$q$, $q$Citadelle 0.0$q$, $q$Non-alcoholic Gin$q$, $q$Citadelle$q$, 0.0, $q$FR$q$, NULL, $q$https://citadellegin.com/en/gin/citadelle-0-0/$q$, $q$producer$q$),
($q$Crodino$q$, $q$Crodino$q$, $q$Non-Alcoholic Bitter$q$, $q$Crodino$q$, NULL, NULL, NULL, $q$https://www.crodino.com/the-original/$q$, $q$producer$q$),
($q$Crodino Rosso$q$, NULL, $q$Non-Alcoholic Bitter$q$, $q$Crodino$q$, NULL, NULL, NULL, $q$https://www.crodino.com/rosso/$q$, $q$producer$q$),
($q$Crossip Blazing Pineapple$q$, NULL, $q$Non-alcoholic Spirit$q$, $q$Crossip$q$, NULL, NULL, NULL, $q$https://crossipdrinks.com/products/blazing-pineapple$q$, $q$producer$q$),
($q$Crossip Dandy Smoke$q$, NULL, $q$Non-alcoholic Botanical Spirit$q$, $q$Crossip$q$, NULL, NULL, NULL, $q$https://crossipdrinks.com/products/dandy-smoke$q$, $q$producer$q$),
($q$Crossip Fresh Citrus$q$, NULL, $q$Non-alcoholic Botanical Spirit$q$, $q$Crossip$q$, NULL, NULL, NULL, $q$https://crossipdrinks.com/products/fresh-citrus$q$, $q$producer$q$),
($q$Crossip Pure Hibiscus$q$, NULL, $q$Non-Alcoholic Bitter$q$, $q$Crossip$q$, NULL, NULL, NULL, $q$https://crossipdrinks.com/products/pure-hibiscus$q$, $q$producer$q$),
($q$Crossip Rich Berry$q$, NULL, $q$Non-alcoholic Botanical Spirit$q$, $q$Crossip$q$, NULL, NULL, NULL, $q$https://crossipdrinks.com/products/rich-berry$q$, $q$producer$q$),
($q$Cut Above Zero Proof Agave Blanco Tequila$q$, NULL, $q$Non-Alcoholic Agave Spirit$q$, $q$Cut Above$q$, NULL, NULL, NULL, $q$https://drinkcutabove.com/products/cut-above-non-alcoholic-agave-blanco-tequila$q$, $q$producer$q$),
($q$Cut Above Zero Proof Gin$q$, NULL, $q$Non-alcoholic Gin$q$, $q$Cut Above$q$, NULL, NULL, NULL, $q$https://drinkcutabove.com/products/cut-above-non-alcoholic-gin$q$, $q$producer$q$),
($q$Cut Above Zero Proof Mezcal$q$, NULL, $q$Non-Alcoholic Agave Spirit$q$, $q$Cut Above$q$, NULL, NULL, NULL, $q$https://drinkcutabove.com/products/cut-above-non-alcoholic-mezcal$q$, $q$producer$q$),
($q$Cut Above Zero Proof Whiskey$q$, $q$Cut Above Whiskey$q$, $q$Non-Alcoholic Whiskey$q$, $q$Cut Above$q$, NULL, NULL, NULL, $q$https://drinkcutabove.com/products/cut-above-non-alcoholic-whiskey$q$, $q$producer$q$),
($q$Everleaf Forest$q$, $q$Everleaf Forest$q$, $q$Non-Alcoholic Aperitif$q$, $q$Everleaf$q$, 0.0, NULL, NULL, $q$https://everleafdrinks.com/products/everleaf-forest$q$, $q$producer$q$),
($q$Everleaf Marine$q$, $q$Everleaf Marine$q$, $q$Non-Alcoholic Aperitif$q$, $q$Everleaf$q$, 0.0, NULL, NULL, $q$https://everleafdrinks.com/products/everleaf-marine$q$, $q$producer$q$),
($q$Everleaf Mountain$q$, $q$Everleaf Mountain$q$, $q$Non-Alcoholic Aperitif$q$, $q$Everleaf$q$, 0.0, NULL, NULL, $q$https://everleafdrinks.com/products/everleaf-mountain$q$, $q$producer$q$),
($q$Feragaia$q$, $q$Feragaia$q$, $q$Non-alcoholic Botanical Spirit$q$, $q$Feragaia$q$, 0.0, $q$GB$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/8030/feragaia$q$, $q$reference$q$),
($q$Figlia 001. Fiore$q$, NULL, $q$Non-Alcoholic Aperitif$q$, $q$Figlia$q$, NULL, NULL, NULL, $q$https://drinkfiglia.com/products/001-fiore$q$, $q$producer$q$),
($q$Figlia 002. Sole$q$, NULL, $q$Non-Alcoholic Aperitif$q$, $q$Figlia$q$, NULL, NULL, NULL, $q$https://drinkfiglia.com/products/sole-non-alcoholic-aperitivo$q$, $q$producer$q$),
($q$Four Pillars Bandwagon Dry$q$, $q$Four Pillars Bandwagon Dry$q$, $q$Non-alcoholic Gin$q$, $q$Four Pillars$q$, NULL, NULL, NULL, $q$https://www.fourpillarsgin.com/products/bandwagon-dry$q$, $q$producer$q$),
($q$Four Pillars Bloody Bandwagon$q$, $q$Four Pillars Bloody Bandwagon$q$, $q$Non-alcoholic Gin$q$, $q$Four Pillars$q$, NULL, NULL, NULL, $q$https://www.fourpillarsgin.com/products/bloody-bandwagon$q$, $q$producer$q$),
($q$Free Spirits The Spirit of Aperitivo Milano$q$, NULL, $q$Non-Alcoholic Bitter$q$, $q$Free Spirits$q$, NULL, NULL, NULL, $q$https://drinkfreespirits.com/products/the-spirit-of-milano$q$, $q$producer$q$),
($q$Free Spirits The Spirit of Bourbon$q$, NULL, $q$Non-Alcoholic Whiskey$q$, $q$Free Spirits$q$, NULL, NULL, NULL, $q$https://drinkfreespirits.com/products/the-spirit-of-bourbon$q$, $q$producer$q$),
($q$Free Spirits The Spirit of Gin$q$, NULL, $q$Non-alcoholic Gin$q$, $q$Free Spirits$q$, NULL, NULL, NULL, $q$https://drinkfreespirits.com/products/the-spirit-of-gin$q$, $q$producer$q$),
($q$Free Spirits The Spirit of Tequila$q$, $q$Free Spirits The Spirit of Tequila$q$, $q$Non-Alcoholic Agave Spirit$q$, $q$Free Spirits$q$, NULL, NULL, NULL, $q$https://drinkfreespirits.com/products/the-spirit-of-tequila$q$, $q$producer$q$),
($q$Free Spirits The Spirit of Vermouth Rosso$q$, NULL, $q$Non-Alcoholic Vermouth$q$, $q$Free Spirits$q$, NULL, NULL, NULL, $q$https://drinkfreespirits.com/products/the-spirit-of-vermouth-rosso$q$, $q$producer$q$),
($q$Ghia Berry Apéritif$q$, NULL, $q$Non-Alcoholic Aperitif$q$, $q$Ghia$q$, NULL, NULL, NULL, $q$https://drinkghia.com/products/berry-aperitif$q$, $q$producer$q$),
($q$Ghia Original Apéritif$q$, $q$Ghia Original Apéritif$q$, $q$Non-Alcoholic Aperitif$q$, $q$Ghia$q$, NULL, NULL, NULL, $q$https://drinkghia.com/products/ghia$q$, $q$producer$q$),
($q$Giffard Elderflower Alcohol Free$q$, NULL, $q$Non-alcoholic Spirit$q$, $q$Giffard$q$, NULL, NULL, NULL, $q$https://www.giffard.com/en/giffard-alcohol-free/8391-349-giffard-fleur-de-sureau-sans-alcool-.html$q$, $q$producer$q$),
($q$Giffard Ginger Alcohol Free$q$, $q$Giffard Ginger Alcohol Free$q$, $q$Non-alcoholic Spirit$q$, $q$Giffard$q$, NULL, $q$FR$q$, NULL, $q$https://www.giffard.com/en/giffard-alcohol-free/8392-350-giffard-gingembre-sans-alcool.html$q$, $q$producer$q$),
($q$Giffard Grapefruit Alcohol Free$q$, NULL, $q$Non-alcoholic Spirit$q$, $q$Giffard$q$, NULL, NULL, NULL, $q$https://www.giffard.com/en/giffard-alcohol-free/8393-351-giffard-pamplemousse-sans-alcool.html$q$, $q$producer$q$),
($q$Giffard Pineapple Alcohol Free$q$, NULL, $q$Non-alcoholic Spirit$q$, $q$Giffard$q$, NULL, NULL, NULL, $q$https://www.giffard.com/en/giffard-alcohol-free/8390-348-giffard-sans-alcool-ananas.html$q$, $q$producer$q$),
($q$Giffard Spritz Alcohol Free$q$, NULL, $q$Non-Alcoholic Aperitif$q$, $q$Giffard$q$, NULL, NULL, NULL, $q$https://www.giffard.com/en/giffard-alcohol-free/8418-403-giffard-spritz-sans-alcool-.html$q$, $q$producer$q$),
($q$Giffard Triple Sec Alcohol Free$q$, NULL, $q$Non-alcoholic Spirit$q$, $q$Giffard$q$, NULL, NULL, NULL, $q$https://www.giffard.com/en/giffard-alcohol-free/8430-434-giffard-fleur-de-sureau-sans-alcool-.html$q$, $q$producer$q$),
($q$Gnista Barreled Oak$q$, $q$Gnista Barreled Oak$q$, $q$Non-Alcoholic Whiskey$q$, $q$Gnista$q$, NULL, NULL, NULL, $q$https://gnistaspirits.com/products/3766$q$, $q$producer$q$),
($q$Gnista Floral Wormwood$q$, NULL, $q$Non-Alcoholic Vermouth$q$, $q$Gnista$q$, NULL, NULL, NULL, $q$https://gnistaspirits.com/products/1374$q$, $q$producer$q$),
($q$Gnista Pink Ginista$q$, NULL, $q$Non-alcoholic Gin$q$, $q$Gnista$q$, NULL, NULL, NULL, $q$https://gnistaspirits.com/products/4072$q$, $q$producer$q$),
($q$Gordon's 0.0% Alcohol-Free Spirit$q$, $q$Gordon's 0.0 Alcohol Free Spirit$q$, $q$Non-alcoholic Gin$q$, $q$Gordon's$q$, 0.0, NULL, NULL, $q$https://www.thebar.com/en/products/gordons-00-alcohol-free-spirit-70cl$q$, $q$producer$q$),
($q$Lucano Amaro Zero°$q$, $q$Lucano Amaro Zero$q$, $q$Non-Alcoholic Amaro$q$, $q$Lucano$q$, NULL, $q$IT$q$, NULL, $q$https://amarolucano.it/en/lucano-amaro-zero$q$, $q$producer$q$),
($q$Lyre's Agave Blanco$q$, $q$Lyre's Agave Blanco$q$, $q$Non-Alcoholic Agave Spirit$q$, $q$Lyre's$q$, NULL, NULL, NULL, $q$https://lyres.com/products/agave-blanco-spirit-uk$q$, $q$producer$q$),
($q$Lyre's Amaretti$q$, $q$Lyre's Amaretti$q$, $q$Non-Alcoholic Amaretto$q$, $q$Lyre's$q$, NULL, NULL, NULL, $q$https://lyres.com/products/amaretti-uk$q$, $q$producer$q$),
($q$Lyre's American Malt$q$, $q$Lyre's American Malt$q$, $q$Non-Alcoholic Whiskey$q$, $q$Lyre's$q$, NULL, NULL, NULL, $q$https://lyres.com/products/american-malt-uk$q$, $q$producer$q$),
($q$Lyre's Apéritif Rosso$q$, $q$Lyre's Aperitif Rosso$q$, $q$Non-Alcoholic Rosso Aperitif$q$, $q$Lyre's$q$, NULL, NULL, NULL, $q$https://lyres.com/products/aperitif-rosso-uk$q$, $q$producer$q$),
($q$Lyre's Coffee Originale$q$, $q$Lyre's Coffee Originale$q$, $q$N.A. Coffee Liqueur$q$, $q$Lyre's$q$, NULL, NULL, NULL, $q$https://lyres.com/products/coffee-originale-uk$q$, $q$producer$q$),
($q$Lyre's Dark Cane$q$, $q$Lyre's Dark Cane Spirit$q$, $q$Non-Alcoholic Dark Cane Spirit$q$, $q$Lyre's$q$, NULL, NULL, NULL, $q$https://lyres.com/products/dark-cane-spirit-uk$q$, $q$producer$q$),
($q$Lyre's Dry London$q$, $q$Lyre's Dry London Spirit$q$, $q$Non-alcoholic Gin$q$, $q$Lyre's$q$, NULL, NULL, NULL, $q$https://lyres.com/products/dry-london-spirit-uk$q$, $q$producer$q$),
($q$Lyre's Italian Orange$q$, $q$Lyre's Italian Orange$q$, $q$Non-Alcoholic Bitter$q$, $q$Lyre's$q$, NULL, NULL, NULL, $q$https://lyres.com/products/italian-orange-uk$q$, $q$producer$q$),
($q$Lyre's Italian Spritz$q$, $q$Lyre's Italian Spritz$q$, $q$Non-Alcoholic Aperitif$q$, $q$Lyre's$q$, NULL, NULL, NULL, $q$https://lyres.com/products/italian-spritz-uk$q$, $q$producer$q$),
($q$Lyre's Orange Sec$q$, $q$Lyre's Orange Sec$q$, $q$Non-alcoholic Spirit$q$, $q$Lyre's$q$, NULL, NULL, NULL, $q$https://lyres.com/products/orange-sec-uk$q$, $q$producer$q$),
($q$Lyre's Pink London$q$, $q$Lyre's Pink London Spirit$q$, $q$Non-alcoholic Gin$q$, $q$Lyre's$q$, NULL, NULL, NULL, $q$https://lyres.com/products/pink-london-spirit-uk$q$, $q$producer$q$),
($q$Lyre's White Cane$q$, $q$Lyre's White Cane Spirit$q$, $q$N.A. Rum$q$, $q$Lyre's$q$, NULL, NULL, NULL, $q$https://lyres.com/products/white-cane-spirit-uk$q$, $q$producer$q$),
($q$Martini Floreale$q$, $q$Martini Floreale$q$, $q$Non-Alcoholic Aperitif$q$, $q$Martini$q$, 0.0, NULL, NULL, $q$https://www.martini.com/products/martini-floreale/$q$, $q$producer$q$),
($q$Martini Vibrante$q$, $q$Martini Vibrante$q$, $q$Non-Alcoholic Aperitif$q$, $q$Martini$q$, 0.5, NULL, NULL, $q$https://www.martini.com/products/martini-vibrante/$q$, $q$producer$q$),
($q$Monday Zero Alcohol Gin$q$, $q$Monday Zero Alcohol Gin$q$, $q$Non-alcoholic Gin$q$, $q$Monday$q$, NULL, NULL, NULL, $q$https://drinkmonday.co/products/zero-alcohol-gin$q$, $q$producer$q$),
($q$Monday Zero Alcohol Mezcal$q$, NULL, $q$Non-Alcoholic Agave Spirit$q$, $q$Monday$q$, NULL, NULL, NULL, $q$https://drinkmonday.co/products/zero-alcohol-mezcal$q$, $q$producer$q$),
($q$Monday Zero Alcohol Whiskey$q$, NULL, $q$Non-Alcoholic Whiskey$q$, $q$Monday$q$, NULL, NULL, NULL, $q$https://drinkmonday.co/products/zero-alcohol-whiskey$q$, $q$producer$q$),
($q$New London Light Aegean Sky$q$, NULL, $q$Non-Alcoholic Aperitif$q$, $q$New London Light$q$, 0.0, $q$GB$q$, NULL, $q$https://newlondonlight.com/product/aegean-sky/$q$, $q$producer$q$),
($q$New London Light First Light$q$, NULL, $q$Non-alcoholic Gin$q$, $q$New London Light$q$, 0.0, $q$GB$q$, NULL, $q$https://newlondonlight.com/product/first-light/$q$, $q$producer$q$),
($q$New London Light Midnight Sun$q$, NULL, $q$Non-Alcoholic Aperitif$q$, $q$New London Light$q$, 0.0, $q$GB$q$, NULL, $q$https://newlondonlight.com/product/midnight-sun/$q$, $q$producer$q$),
($q$Noki & Co. Juniper Pink Edition$q$, NULL, $q$Non-alcoholic Gin$q$, $q$Noki & Co.$q$, 0.0, $q$IE$q$, NULL, $q$https://www.nokidrinks.com/$q$, $q$producer$q$),
($q$Pallini Limonzero$q$, NULL, $q$Non-alcoholic Spirit$q$, $q$Pallini$q$, 0.0, $q$IT$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/11969/pallini-limonzero$q$, $q$reference$q$),
($q$Pentire Adrift$q$, $q$Pentire Adrift$q$, $q$Non-alcoholic Botanical Spirit$q$, $q$Pentire$q$, NULL, NULL, NULL, $q$https://pentiredrinks.com/products/pentire-adrift$q$, $q$producer$q$),
($q$Pentire Coastal Spritz$q$, $q$Pentire Coastal Spritz$q$, $q$Non-Alcoholic Aperitif$q$, $q$Pentire$q$, NULL, NULL, NULL, $q$https://pentiredrinks.com/products/pentire-coastal-spritz$q$, $q$producer$q$),
($q$Pentire Seaward$q$, $q$Pentire Seaward$q$, $q$Non-alcoholic Botanical Spirit$q$, $q$Pentire$q$, NULL, NULL, NULL, $q$https://pentiredrinks.com/products/pentire-seaward-alcohol-free-spirit$q$, $q$producer$q$),
($q$Ritual Zero Proof Agave Spirit Alternative$q$, NULL, $q$Non-Alcoholic Agave Spirit$q$, $q$Ritual Zero Proof$q$, NULL, NULL, NULL, $q$https://ritualzeroproof.com/products/ritual-agave-spirit-alternative$q$, $q$producer$q$),
($q$Ritual Zero Proof Aperitif Alternative$q$, $q$Ritual Zero Proof Aperitif Alternative$q$, $q$Non-Alcoholic Aperitif$q$, $q$Ritual Zero Proof$q$, NULL, NULL, NULL, $q$https://ritualzeroproof.com/products/ritual-aperitif-alternative$q$, $q$producer$q$),
($q$Ritual Zero Proof Gin Alternative$q$, $q$Ritual Zero Proof Gin Alternative$q$, $q$Non-alcoholic Gin$q$, $q$Ritual Zero Proof$q$, NULL, NULL, NULL, $q$https://ritualzeroproof.com/products/ritual-gin-alternative$q$, $q$producer$q$),
($q$Ritual Zero Proof Rum Alternative$q$, $q$Ritual Zero Proof Rum Alternative$q$, $q$N.A. Rum$q$, $q$Ritual Zero Proof$q$, NULL, NULL, NULL, $q$https://ritualzeroproof.com/products/ritual-rum-alternative$q$, $q$producer$q$),
($q$Ritual Zero Proof Whiskey Alternative$q$, $q$Ritual Zero Proof Whiskey Alternative$q$, $q$Non-Alcoholic Whiskey$q$, $q$Ritual Zero Proof$q$, NULL, NULL, NULL, $q$https://ritualzeroproof.com/products/ritual-whiskey-alternative$q$, $q$producer$q$),
($q$Roots Divino Bianco$q$, $q$Roots Divino Bianco$q$, $q$Non-Alcoholic Vermouth$q$, $q$Roots Divino$q$, 0.0, $q$GR$q$, NULL, $q$https://finestroots.com/roots-divino/$q$, $q$producer$q$),
($q$Roots Divino Rosso$q$, $q$Roots Divino Rosso$q$, $q$Non-Alcoholic Vermouth$q$, $q$Roots Divino$q$, 0.0, $q$GR$q$, NULL, $q$https://finestroots.com/roots-divino/$q$, $q$producer$q$),
($q$Sabatini 0.0$q$, $q$Sabatini 00$q$, $q$Non-alcoholic Gin$q$, $q$Sabatini$q$, NULL, $q$IT$q$, NULL, $q$https://www.sabatinigin.com/en/$q$, $q$producer$q$),
($q$Sanbittèr Rosso$q$, $q$Sanbittèr$q$, $q$Non-Alcoholic Bitter$q$, $q$Sanbittèr$q$, 0.0, NULL, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/7384/sanbitter-rosso$q$, $q$reference$q$),
($q$Seedlip Garden 108$q$, $q$Seedlip Garden 108$q$, $q$Non-alcoholic Botanical Spirit$q$, $q$Seedlip$q$, NULL, NULL, NULL, $q$https://www.seedlipdrinks.com/en-us/$q$, $q$producer$q$),
($q$Seedlip Grove 42$q$, $q$Seedlip Grove 42$q$, $q$Non-alcoholic Botanical Spirit$q$, $q$Seedlip$q$, NULL, NULL, NULL, $q$https://www.seedlipdrinks.com/en-us/$q$, $q$producer$q$),
($q$Seedlip Notas de Agave$q$, $q$Seedlip Notas De Agave$q$, $q$Non-Alcoholic Agave Spirit$q$, $q$Seedlip$q$, NULL, NULL, NULL, $q$https://www.seedlipdrinks.com/en-us/$q$, $q$producer$q$),
($q$Sipsmith FreeGlider$q$, $q$Sipsmith Freeglider$q$, $q$Non-alcoholic Gin$q$, $q$Sipsmith$q$, NULL, NULL, NULL, $q$https://sipsmith.com/product/freeglider-alcohol-free-spirit/$q$, $q$producer$q$),
($q$Smiling Wolf Functional Botanical$q$, $q$Smiling Wolf Functional Non Alc Gin$q$, $q$Non-alcoholic Gin$q$, $q$Smiling Wolf$q$, 0.5, NULL, NULL, $q$https://joinclubsoda.com/product/smiling-wolf-functional-gin/$q$, $q$retailer$q$),
($q$Spiritless Kentucky 74$q$, $q$Spiritless Kentucky 74$q$, $q$Non-Alcoholic Whiskey$q$, $q$Spiritless$q$, NULL, $q$US$q$, NULL, $q$https://spiritless.com/products/kentucky-74-non-alcoholic-bourbon$q$, $q$producer$q$),
($q$Spiritless Kentucky 74 Spiced$q$, NULL, $q$Non-Alcoholic Whiskey$q$, $q$Spiritless$q$, NULL, $q$US$q$, NULL, $q$https://spiritless.com/$q$, $q$producer$q$),
($q$Sunny Arvo Noperitivo Blood Orange Hibiscus$q$, NULL, $q$Non-Alcoholic Aperitif$q$, $q$Sunny Arvo$q$, NULL, $q$AU$q$, NULL, $q$https://threefoxes.com.au/products/sunny-arvo-noperitivo-blood-orange-hibiscus$q$, $q$producer$q$),
($q$Tanqueray 0.0%$q$, $q$Tanqueray 0.0%$q$, $q$Non-alcoholic Gin$q$, $q$Tanqueray$q$, 0.0, NULL, NULL, $q$https://www.tanqueray.com/en-gb/alcohol-free-spirits/tanqueray-00$q$, $q$producer$q$),
($q$Tanqueray Flor de Sevilla 0.0%$q$, NULL, $q$Non-alcoholic Gin$q$, $q$Tanqueray$q$, 0.0, NULL, NULL, $q$https://www.tanqueray.com/en-gb/alcohol-free-spirits/tanqueray-flor-de-sevilla-00$q$, $q$producer$q$),
($q$Tenneyson Black Ginger$q$, $q$Tenneyson Black Ginger$q$, $q$Non-alcoholic Spirit$q$, $q$Tenneyson$q$, NULL, NULL, NULL, $q$https://shop.tenneyson.com/products/tenneyson-black-ginger-1$q$, $q$producer$q$),
($q$The Pathfinder Hemp & Root$q$, $q$The Pathfinder Hemp & Root$q$, $q$Non-Alcoholic Amaro$q$, $q$The Pathfinder$q$, NULL, NULL, NULL, $q$https://drinkthepathfinder.com/products/pathfinder-hemp-root$q$, $q$producer$q$),
($q$Three Spirit Social Elixir$q$, $q$Three Spirit Social Elixir$q$, $q$Non-alcoholic Botanical Spirit$q$, $q$Three Spirit$q$, NULL, NULL, NULL, $q$https://threespiritdrinks.com/products/social-elixir$q$, $q$producer$q$),
($q$Vault Non-Alcoholic Aperitivo$q$, NULL, $q$Non-Alcoholic Bitter$q$, $q$Vault Aperitivo$q$, 0.0, NULL, NULL, $q$https://www.vaultaperitivo.com/product-page/non-alcoholic-aperitivo$q$, $q$producer$q$),
($q$Wilfred's Aperitif$q$, $q$Wilfred's Non-Alcoholic Aperitif$q$, $q$Non-Alcoholic Aperitif$q$, $q$Wilfred's$q$, 0.0, $q$GB$q$, NULL, $q$https://www.wilfredsdrinks.com/$q$, $q$producer$q$);

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
    WHEN b.style IN ($q$Non-alcoholic Spirit$q$) AND EXISTS (
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
