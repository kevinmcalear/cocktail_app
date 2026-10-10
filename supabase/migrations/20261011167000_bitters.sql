-- Cocktail bitters: every bottle checked on its producer's own page (or,
-- where that page was blocked, a major retailer, importer or Difford's),
-- after 20261011166000. Step 3j of the bottle catalog plan:
-- https://claude.ai/artifact/Vu6seuSNtN42nKYb2nDCVR
--
--   * The core dash-bitters range of every bitters house we could read.
--   * On a copy of production (2026-10-09, with the loads before this
--     one applied): 66 new bottles, and 43 we had that get their label
--     name (8 renamed, the old name kept as an alias), style, ABV,
--     country, protected name and maker where they were missing or
--     wrong.
--   * Styles: The most specific existing bitters style (aromatic,
--     Creole, orange, celery, chocolate, grapefruit, cherry, smoky,
--     habanero...), N.A. Bitters for alcohol-free ones.
--   * Out of scope: potable bitters (the vermouth load), shrubs, kits.
--   * Each producer gets an unclaimed maker page (makes: bottles), or a
--     page an earlier load made gains it, and each bottle names it.
--   * Every fact keeps the page it was checked on in item_sources. An
--     ABV read off another page isn't kept, and a review site isn't a
--     source.
--   * An independent second check of 100 random rows found 1 wrong
--     facts in 476 (0.2%). Every correction is taken: Bittered Sling
--     Moondog is Smoky Bitters; Bitter End Chesapeake Bay is Bay Leaf
--     Bitters; Scrappy's Fire Tincture is Habanero Bitters. Regans' and
--     most of Bittermens stay out: their pages couldn't be read.
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
(0, $q$Bitters$q$, NULL);

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
($q$Amargo Chuncho$q$, $q$amargo.chuncho$q$, $q$https://amargochuncho.com$q$, $q$PE$q$, NULL),
($q$Angostura$q$, $q$angostura$q$, $q$https://angosturabitters.com$q$, $q$TT$q$, NULL),
($q$Bitter End$q$, $q$bitter.end$q$, $q$https://www.bitterendbitters.com$q$, $q$US$q$, NULL),
($q$Bittercube$q$, $q$bittercube$q$, $q$https://bittercube.com$q$, $q$US$q$, NULL),
($q$Bittered Sling$q$, $q$bittered.sling$q$, $q$https://www.bitteredsling.com$q$, $q$CA$q$, NULL),
($q$Bittermens$q$, $q$bittermens$q$, $q$https://www.sazerac.com$q$, $q$US$q$, NULL),
($q$Bob's Bitters$q$, $q$bob.s.bitters$q$, $q$https://www.bobsbitters.com$q$, $q$GB$q$, NULL),
($q$Difford's$q$, $q$difford.s$q$, NULL, $q$GB$q$, NULL),
($q$Dillon's$q$, $q$dillon.s$q$, $q$https://www.dillons.ca$q$, $q$CA$q$, NULL),
($q$Fee Brothers$q$, $q$fee.brothers$q$, $q$https://www.feebrothers.com$q$, $q$US$q$, NULL),
($q$Ms. Betters$q$, $q$ms.betters$q$, $q$http://www.msbetters.com$q$, $q$CA$q$, NULL),
($q$Peychaud's$q$, $q$peychaud.s$q$, $q$https://www.sazerac.com$q$, $q$US$q$, NULL),
($q$Scrappy's$q$, $q$scrappy.s$q$, $q$https://www.scrappysbitters.com$q$, $q$US$q$, NULL),
($q$The Bitter Truth$q$, $q$the.bitter.truth$q$, $q$https://the-bitter-truth.com$q$, $q$DE$q$, NULL),
($q$Woodford Reserve$q$, $q$woodford.reserve$q$, $q$https://www.woodfordreserve.com$q$, $q$US$q$, NULL);

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
($q$Amargo Chuncho$q$, NULL, $q$Aromatic Bitters$q$, $q$Amargo Chuncho$q$, NULL, $q$PE$q$, NULL, $q$https://amargochuncho.com/about/$q$, $q$producer$q$),
($q$Angostura Aromatic Bitters$q$, $q$Angostura Bitters$q$, $q$Aromatic Bitters$q$, $q$Angostura$q$, NULL, $q$TT$q$, NULL, $q$https://angosturabitters.com/portfolio/aromatic-bitters/$q$, $q$producer$q$),
($q$Angostura Cocoa Bitters$q$, $q$Angostura Cocoa Bitters$q$, $q$Chocolate Bitters$q$, $q$Angostura$q$, NULL, $q$TT$q$, NULL, $q$https://angosturabitters.com/portfolio/cocoa-bitters/$q$, $q$producer$q$),
($q$Angostura Orange Bitters$q$, $q$Angostura Orange Bitters$q$, $q$Orange Bitters$q$, $q$Angostura$q$, NULL, $q$TT$q$, NULL, $q$https://angosturabitters.com/portfolio/orange-bitters/$q$, $q$producer$q$),
($q$Bitter End Chesapeake Bay Bitters$q$, NULL, $q$Bay Leaf Bitters$q$, $q$Bitter End$q$, 45, $q$US$q$, NULL, $q$https://www.bitterendbitters.com/shop-bitters/p/chesapeake-bay-bitters$q$, $q$producer$q$),
($q$Bitter End Curry Bitters$q$, NULL, $q$Spiced Bitters$q$, $q$Bitter End$q$, 45, $q$US$q$, NULL, $q$https://www.bitterendbitters.com/shop-bitters/p/curry-bitters$q$, $q$producer$q$),
($q$Bitter End Jamaican Jerk Bitters$q$, NULL, $q$Jerk Bitters$q$, $q$Bitter End$q$, 45, $q$US$q$, NULL, $q$https://www.bitterendbitters.com/shop-bitters/p/jamaican-jerk-bitters$q$, $q$producer$q$),
($q$Bitter End Memphis Barbeque Bitters$q$, $q$The Bitter End Memphis Barbeque Bitters$q$, $q$Barbecue Bitters$q$, $q$Bitter End$q$, 45, $q$US$q$, NULL, $q$https://www.bitterendbitters.com/shop-bitters/p/memphis-barbeque-bitters$q$, $q$producer$q$),
($q$Bitter End Mexican Mole Bitters$q$, NULL, $q$Mole Negro Bitters$q$, $q$Bitter End$q$, 45, $q$US$q$, NULL, $q$https://www.bitterendbitters.com/shop-bitters/p/mexican-mole$q$, $q$producer$q$),
($q$Bitter End Moroccan Bitters$q$, NULL, $q$Spiced Bitters$q$, $q$Bitter End$q$, 45, $q$US$q$, NULL, $q$https://www.bitterendbitters.com/shop-bitters/p/moroccan$q$, $q$producer$q$),
($q$Bitter End Thai Bitters$q$, NULL, $q$Thai Bitters$q$, $q$Bitter End$q$, 45, $q$US$q$, NULL, $q$https://www.bitterendbitters.com/shop-bitters/p/thai-bitters$q$, $q$producer$q$),
($q$Bitter End Togarashi Bitters$q$, NULL, $q$Spicy Bitters$q$, $q$Bitter End$q$, 45, $q$US$q$, NULL, $q$https://www.bitterendbitters.com/shop-bitters/p/togarashi-bitters$q$, $q$producer$q$),
($q$Bittercube All Day Aromatic Bitters$q$, NULL, $q$Aromatic Bitters$q$, $q$Bittercube$q$, NULL, $q$US$q$, NULL, $q$https://bittercube.com/shop/products/all-day-aromatic-bitters$q$, $q$producer$q$),
($q$Bittercube All Day Spicy Bitters$q$, NULL, $q$Spicy Bitters$q$, $q$Bittercube$q$, NULL, $q$US$q$, NULL, $q$https://bittercube.com/shop/products/all-day-spicy-bitters$q$, $q$producer$q$),
($q$Bittercube Blackstrap Bitters$q$, NULL, $q$Aromatic Bitters$q$, $q$Bittercube$q$, NULL, $q$US$q$, NULL, $q$https://bittercube.com/shop/products/blackstrap$q$, $q$producer$q$),
($q$Bittercube Bolivar Bitters$q$, NULL, $q$Aromatic Bitters$q$, $q$Bittercube$q$, NULL, $q$US$q$, NULL, $q$https://bittercube.com/shop/products/bolivar$q$, $q$producer$q$),
($q$Bittercube Cherry Bark Vanilla Bitters$q$, $q$Bittercube Cherry Bark Vanilla Bitters$q$, $q$Cherry-Vanilla Bitters$q$, $q$Bittercube$q$, NULL, $q$US$q$, NULL, $q$https://bittercube.com/shop/products/cherry-bark-vanilla$q$, $q$producer$q$),
($q$Bittercube Chipotle Cacao Bitters$q$, NULL, $q$Chocolate Chili Bitters$q$, $q$Bittercube$q$, NULL, $q$US$q$, NULL, $q$https://bittercube.com/shop/products/chipotlecacao$q$, $q$producer$q$),
($q$Bittercube Functional Aromatic Bitters$q$, NULL, $q$N.A. Bitters$q$, $q$Bittercube$q$, 0, $q$US$q$, NULL, $q$https://bittercube.com/shop/bitters$q$, $q$producer$q$),
($q$Bittercube Functional Citrus Bitters$q$, NULL, $q$N.A. Bitters$q$, $q$Bittercube$q$, 0, $q$US$q$, NULL, $q$https://bittercube.com/shop/bitters$q$, $q$producer$q$),
($q$Bittercube Ginger Allspice Bitters$q$, NULL, $q$Spicy Ginger Bitters$q$, $q$Bittercube$q$, NULL, $q$US$q$, NULL, $q$https://bittercube.com/shop/products/ginger-allspice$q$, $q$producer$q$),
($q$Bittercube Grapefruit Hibiscus Bitters$q$, NULL, $q$Grapefruit Bitters$q$, $q$Bittercube$q$, NULL, $q$US$q$, NULL, $q$https://bittercube.com/shop/products/grapefruit-hibiscus$q$, $q$producer$q$),
($q$Bittercube Orange Bitters$q$, $q$Bittercube Orange Bitters$q$, $q$Orange Bitters$q$, $q$Bittercube$q$, NULL, $q$US$q$, NULL, $q$https://bittercube.com/shop/products/orange$q$, $q$producer$q$),
($q$Bittercube Root Beer Bitters$q$, NULL, $q$Root Beer Bitters$q$, $q$Bittercube$q$, NULL, $q$US$q$, NULL, $q$https://bittercube.com/shop/products/root-beer$q$, $q$producer$q$),
($q$Bittercube Trinity Bitters$q$, NULL, $q$Aromatic Bitters$q$, $q$Bittercube$q$, NULL, $q$US$q$, NULL, $q$https://bittercube.com/shop/products/trinity$q$, $q$producer$q$),
($q$Bittered Sling Arabica Coffee Bitters$q$, NULL, $q$Coffee Bitters$q$, $q$Bittered Sling$q$, NULL, $q$CA$q$, NULL, $q$https://www.bitteredsling.com/flavours/arabica-coffee/$q$, $q$producer$q$),
($q$Bittered Sling Autumn Bog Cranberry Bitters$q$, NULL, $q$Cranberry Bitters$q$, $q$Bittered Sling$q$, NULL, $q$CA$q$, NULL, $q$https://www.bitteredsling.com/flavours/autumn-bog-cranberry/$q$, $q$producer$q$),
($q$Bittered Sling Cascade Celery Bitters$q$, NULL, $q$Celery Bitters$q$, $q$Bittered Sling$q$, NULL, $q$CA$q$, NULL, $q$https://www.bitteredsling.com/flavours/cascade-celery/$q$, $q$producer$q$),
($q$Bittered Sling Clingstone Peach Bitters$q$, NULL, $q$Peach Bitters$q$, $q$Bittered Sling$q$, NULL, $q$CA$q$, NULL, $q$https://www.bitteredsling.com/flavours/clingstone-peach/$q$, $q$producer$q$),
($q$Bittered Sling Grapefruit & Hops Bitters$q$, NULL, $q$Grapefruit Bitters$q$, $q$Bittered Sling$q$, NULL, $q$CA$q$, NULL, $q$https://www.bitteredsling.com/flavours/grapefruit-hops/$q$, $q$producer$q$),
($q$Bittered Sling Kensington Aromatic Bitters$q$, NULL, $q$Aromatic Bitters$q$, $q$Bittered Sling$q$, NULL, $q$CA$q$, NULL, $q$https://www.bitteredsling.com/flavours/kensington-aromatic/$q$, $q$producer$q$),
($q$Bittered Sling Lem-Marrakech Bitters$q$, NULL, $q$Lemon Bitters$q$, $q$Bittered Sling$q$, NULL, $q$CA$q$, NULL, $q$https://www.bitteredsling.com/flavours/lem-marrakech/$q$, $q$producer$q$),
($q$Bittered Sling Malagasy Chocolate Bitters$q$, NULL, $q$Chocolate Bitters$q$, $q$Bittered Sling$q$, NULL, $q$CA$q$, NULL, $q$https://www.bitteredsling.com/flavours/malagasy-chocolate/$q$, $q$producer$q$),
($q$Bittered Sling Moondog Latin Bitters$q$, $q$Bittered Sling Moondog Bitters$q$, $q$Smoky Bitters$q$, $q$Bittered Sling$q$, NULL, $q$CA$q$, NULL, $q$https://www.bitteredsling.com/flavours/moondog-latin/$q$, $q$producer$q$),
($q$Bittered Sling Plum & Rootbeer Bitters$q$, NULL, $q$Plum Bitters$q$, $q$Bittered Sling$q$, NULL, $q$CA$q$, NULL, $q$https://www.bitteredsling.com/flavours/plum-rootbeer/$q$, $q$producer$q$),
($q$Bittered Sling Suius Cherry Bitters$q$, NULL, $q$Cherry Bitters$q$, $q$Bittered Sling$q$, NULL, $q$CA$q$, NULL, $q$https://www.bitteredsling.com/flavours/suius-cherry/$q$, $q$producer$q$),
($q$Bittered Sling Western Haskap Bitters$q$, NULL, $q$Bitters$q$, $q$Bittered Sling$q$, NULL, $q$CA$q$, NULL, $q$https://www.bitteredsling.com/flavours/western-haskap/$q$, $q$producer$q$),
($q$Bittered Sling Zingiber Crabapple Bitters$q$, NULL, $q$Apple Bitters$q$, $q$Bittered Sling$q$, NULL, $q$CA$q$, NULL, $q$https://www.bitteredsling.com/flavours/zingiber-crabapple/$q$, $q$producer$q$),
($q$Bittermens Xocolatl Mole Bitters$q$, $q$Bittermens Xocolatl Mole Bitters$q$, $q$Mole Negro Bitters$q$, $q$Bittermens$q$, 53, $q$US$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/2288/bittermens-xocolatl-mole-bitters$q$, $q$reference$q$),
($q$Bob's Abbotts Bitters$q$, NULL, $q$Aromatic Bitters$q$, $q$Bob's Bitters$q$, NULL, $q$GB$q$, NULL, $q$https://www.bobsbitters.com/products/bobs-abbotts-bitters$q$, $q$producer$q$),
($q$Bob's Cardamon Bitters$q$, NULL, $q$Cardamom Bitters$q$, $q$Bob's Bitters$q$, NULL, $q$GB$q$, NULL, $q$https://www.bobsbitters.com/products/bobs-cardamon-bitters$q$, $q$producer$q$),
($q$Bob's Chocolate Bitters$q$, $q$Bob's Bitters Chocolate$q$, $q$Chocolate Bitters$q$, $q$Bob's Bitters$q$, NULL, $q$GB$q$, NULL, $q$https://www.bobsbitters.com/products/bobs-chocolate-bitters$q$, $q$producer$q$),
($q$Bob's Coriander Bitters$q$, $q$Bob's Bitters Coriander$q$, $q$Coriander Bitters$q$, $q$Bob's Bitters$q$, NULL, $q$GB$q$, NULL, $q$https://www.bobsbitters.com/products/bobs-coriander-bitters$q$, $q$producer$q$),
($q$Bob's Ginger Bitters$q$, NULL, $q$Spicy Ginger Bitters$q$, $q$Bob's Bitters$q$, NULL, $q$GB$q$, NULL, $q$https://www.bobsbitters.com/products/bobs-ginger-bitters$q$, $q$producer$q$),
($q$Bob's Ginseng #2 Bitters$q$, NULL, $q$Bitters$q$, $q$Bob's Bitters$q$, NULL, $q$GB$q$, NULL, $q$https://www.bobsbitters.com/products/bobs-ginseng-bitters$q$, $q$producer$q$),
($q$Bob's Grapefruit Bitters$q$, $q$Bob's Bitters Grapefruit$q$, $q$Grapefruit Bitters$q$, $q$Bob's Bitters$q$, NULL, $q$GB$q$, NULL, $q$https://www.bobsbitters.com/products/bobs-grapefruit-bitters$q$, $q$producer$q$),
($q$Bob's Lavender Bitters$q$, NULL, $q$Lavender Bitters$q$, $q$Bob's Bitters$q$, NULL, $q$GB$q$, NULL, $q$https://www.bobsbitters.com/products/bobs-lavender-bitters$q$, $q$producer$q$),
($q$Bob's Liquorice Bitters$q$, NULL, $q$Liquorice Bitters$q$, $q$Bob's Bitters$q$, NULL, $q$GB$q$, NULL, $q$https://www.bobsbitters.com/products/bobs-liquorice-bitters$q$, $q$producer$q$),
($q$Bob's Orange & Mandarin Bitters$q$, NULL, $q$Mandarin Bitters$q$, $q$Bob's Bitters$q$, NULL, $q$GB$q$, NULL, $q$https://www.bobsbitters.com/products/bobs-orange-and-mandarin-bitters$q$, $q$producer$q$),
($q$Bob's Peppermint Bitters$q$, NULL, $q$Peppermint Bitters$q$, $q$Bob's Bitters$q$, NULL, $q$GB$q$, NULL, $q$https://www.bobsbitters.com/products/bobs-peppermint-bitters$q$, $q$producer$q$),
($q$Bob's Tonka #2 Bitters$q$, NULL, $q$Tonka Bitters$q$, $q$Bob's Bitters$q$, NULL, $q$GB$q$, NULL, $q$https://www.bobsbitters.com/products/bobs-tonka-bitters$q$, $q$producer$q$),
($q$Bob's Vanilla Bitters$q$, NULL, $q$Vanilla Bitters$q$, $q$Bob's Bitters$q$, NULL, $q$GB$q$, NULL, $q$https://www.bobsbitters.com/products/bobs-vanilla-bitters$q$, $q$producer$q$),
($q$Difford's Daiquiri Bitters$q$, NULL, $q$Bitters$q$, $q$Difford's$q$, 35, $q$GB$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/3134/diffords-daiquiri-bitters$q$, $q$reference$q$),
($q$Difford's Margarita Bitters$q$, NULL, $q$Margarita Bitters$q$, $q$Difford's$q$, 33.5, $q$GB$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/2705/diffords-margarita-bitters$q$, $q$reference$q$),
($q$Dillon's Aromatic Bitters$q$, NULL, $q$Aromatic Bitters$q$, $q$Dillon's$q$, NULL, $q$CA$q$, NULL, $q$https://shop.dillons.ca/aromatic-bitters.html$q$, $q$producer$q$),
($q$Dillon's Black Currant Bitters$q$, NULL, $q$Bitters$q$, $q$Dillon's$q$, NULL, $q$CA$q$, NULL, $q$https://shop.dillons.ca/black-currant-bitters.html$q$, $q$producer$q$),
($q$Dillon's Cranberry Bitters$q$, NULL, $q$Cranberry Bitters$q$, $q$Dillon's$q$, NULL, $q$CA$q$, NULL, $q$https://shop.dillons.ca/cranberry-bitters.html$q$, $q$producer$q$),
($q$Dillon's Ginger Bitters$q$, NULL, $q$Spicy Ginger Bitters$q$, $q$Dillon's$q$, NULL, $q$CA$q$, NULL, $q$https://shop.dillons.ca/ginger-bitters.html$q$, $q$producer$q$),
($q$Dillon's Lemon Bitters$q$, NULL, $q$Lemon Bitters$q$, $q$Dillon's$q$, NULL, $q$CA$q$, NULL, $q$https://shop.dillons.ca/bitters-lemon-bitters.html$q$, $q$producer$q$),
($q$Dillon's Lime Bitters$q$, NULL, $q$Lime Bitters$q$, $q$Dillon's$q$, NULL, $q$CA$q$, NULL, $q$https://shop.dillons.ca/bitters-lime-bitters.html$q$, $q$producer$q$),
($q$Dillon's Orange Bitters$q$, NULL, $q$Orange Bitters$q$, $q$Dillon's$q$, NULL, $q$CA$q$, NULL, $q$https://shop.dillons.ca/orange-bitters.html$q$, $q$producer$q$),
($q$Dillon's Pear Bitters$q$, NULL, $q$Pear Bitters$q$, $q$Dillon's$q$, NULL, $q$CA$q$, NULL, $q$https://shop.dillons.ca/bitters-pear-bitters.html$q$, $q$producer$q$),
($q$Dillon's Rhubarb Bitters$q$, NULL, $q$Rhubarb Bitters$q$, $q$Dillon's$q$, NULL, $q$CA$q$, NULL, $q$https://shop.dillons.ca/rhubarb-bitters.html$q$, $q$producer$q$),
($q$Fee Brothers Aztec Chocolate Bitters$q$, $q$Fee Brothers Aztec Chocolate Bitters$q$, $q$Chocolate Bitters$q$, $q$Fee Brothers$q$, NULL, $q$US$q$, NULL, $q$https://www.feebrothers.com/product/aztec-chocolate-bitters/$q$, $q$producer$q$),
($q$Fee Brothers Black Walnut Bitters$q$, $q$Fee Brothers Black Walnut Bitters$q$, $q$Black Walnut Bitters$q$, $q$Fee Brothers$q$, NULL, $q$US$q$, NULL, $q$https://www.feebrothers.com/product/black-walnut-bitters/$q$, $q$producer$q$),
($q$Fee Brothers Cardamom Bitters$q$, $q$Fee Brothers Cardamom Bitters$q$, $q$Cardamom Bitters$q$, $q$Fee Brothers$q$, NULL, $q$US$q$, NULL, $q$https://www.feebrothers.com/product/cardamom-bitters/$q$, $q$producer$q$),
($q$Fee Brothers Celery Bitters$q$, $q$Fee Brothers Celery Bitters$q$, $q$Celery Bitters$q$, $q$Fee Brothers$q$, NULL, $q$US$q$, NULL, $q$https://www.feebrothers.com/product/celery-bitters/$q$, $q$producer$q$),
($q$Fee Brothers Cherry Bitters$q$, $q$Fee Brothers Cherry Bitters$q$, $q$Cherry Bitters$q$, $q$Fee Brothers$q$, NULL, $q$US$q$, NULL, $q$https://www.feebrothers.com/product/cherry-bitters/$q$, $q$producer$q$),
($q$Fee Brothers Gin Barrel-Aged Orange Bitters$q$, $q$Fee Brothers Gin Barrel-Aged Orange Bitters$q$, $q$Orange Bitters$q$, $q$Fee Brothers$q$, NULL, $q$US$q$, NULL, $q$https://www.feebrothers.com/product/gin-barrel-aged-orange-bitters/$q$, $q$producer$q$),
($q$Fee Brothers Grapefruit Bitters$q$, $q$Fee Brothers Grapefruit Bitters$q$, $q$Grapefruit Bitters$q$, $q$Fee Brothers$q$, NULL, $q$US$q$, NULL, $q$https://www.feebrothers.com/product/grapefruit-bitters/$q$, $q$producer$q$),
($q$Fee Brothers Lemon Bitters$q$, NULL, $q$Lemon Bitters$q$, $q$Fee Brothers$q$, NULL, $q$US$q$, NULL, $q$https://www.feebrothers.com/product/lemon-bitters/$q$, $q$producer$q$),
($q$Fee Brothers Lime Bitters$q$, NULL, $q$Lime Bitters$q$, $q$Fee Brothers$q$, NULL, $q$US$q$, NULL, $q$https://www.feebrothers.com/product/lime-bitters/$q$, $q$producer$q$),
($q$Fee Brothers Mint Bitters$q$, NULL, $q$Mint Bitters$q$, $q$Fee Brothers$q$, NULL, $q$US$q$, NULL, $q$https://www.feebrothers.com/product/mint-bitters/$q$, $q$producer$q$),
($q$Fee Brothers Old Fashion Aromatic Bitters$q$, $q$Fee Brothers Old Fashion Aromatic Bitters$q$, $q$Aromatic Bitters$q$, $q$Fee Brothers$q$, NULL, $q$US$q$, NULL, $q$https://www.feebrothers.com/product/old-fashion-aromatic-bitters/$q$, $q$producer$q$),
($q$Fee Brothers Peach Bitters$q$, $q$Fee Brothers Peach Bitters$q$, $q$Peach Bitters$q$, $q$Fee Brothers$q$, NULL, $q$US$q$, NULL, $q$https://www.feebrothers.com/product/peach-bitters/$q$, $q$producer$q$),
($q$Fee Brothers Rhubarb Bitters$q$, $q$Fee Brothers Rhubarb Bitters$q$, $q$Rhubarb Bitters$q$, $q$Fee Brothers$q$, NULL, $q$US$q$, NULL, $q$https://www.feebrothers.com/product/rhubarb-bitters/$q$, $q$producer$q$),
($q$Fee Brothers West Indian Orange Bitters$q$, $q$Fee Brothers West Indian Orange Bitters$q$, $q$Orange Bitters$q$, $q$Fee Brothers$q$, NULL, $q$US$q$, NULL, $q$https://www.feebrothers.com/product/west-indian-orange-bitters/$q$, $q$producer$q$),
($q$Fee Brothers Whiskey Barrel-Aged Bitters$q$, $q$Fee Brothers Whiskey Barrel-Aged Bitters$q$, $q$Barrel-Aged Bitters$q$, $q$Fee Brothers$q$, NULL, $q$US$q$, NULL, $q$https://www.feebrothers.com/product/whiskey-barrel-aged-bitters/$q$, $q$producer$q$),
($q$Ms. Betters Lime Leaf Bitters$q$, NULL, $q$Lime Bitters$q$, $q$Ms. Betters$q$, NULL, $q$CA$q$, NULL, $q$http://www.msbetters.com/en/products/bitters/single-botanicals/lime-leaf$q$, $q$producer$q$),
($q$Ms. Betters Orange Tree Bitters$q$, NULL, $q$Orange Bitters$q$, $q$Ms. Betters$q$, NULL, $q$CA$q$, NULL, $q$http://www.msbetters.com/en/products/bitters/blends/orange-tree$q$, $q$producer$q$),
($q$Ms. Betters Pineapple Star Anise Bitters$q$, NULL, $q$Bitters$q$, $q$Ms. Betters$q$, NULL, $q$CA$q$, NULL, $q$http://www.msbetters.com/en/products/bitters/blends/pineapple-star-anise$q$, $q$producer$q$),
($q$Peychaud's Aromatic Cocktail Bitters$q$, $q$Peychaud's Aromatic Cocktail Bitters$q$, $q$Creole Bitters$q$, $q$Peychaud's$q$, 35, $q$US$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/201/peychauds-bitters$q$, $q$reference$q$),
($q$Scrappy's Aromatic Bitters$q$, $q$Scrappy's Aromatic Bitters$q$, $q$Aromatic Bitters$q$, $q$Scrappy's$q$, 46.6, $q$US$q$, NULL, $q$https://www.scrappysbitters.com/bitters/aromatic-bitters$q$, $q$producer$q$),
($q$Scrappy's Black Lemon Bitters$q$, $q$Scrappy's Black Lemon Bitters$q$, $q$Black Lemon Bitters$q$, $q$Scrappy's$q$, 49, $q$US$q$, NULL, $q$https://www.scrappysbitters.com/bitters/black-lemon-bitters$q$, $q$producer$q$),
($q$Scrappy's Cardamom Bitters$q$, $q$Scrappy's Cardamom Bitters$q$, $q$Cardamom Bitters$q$, $q$Scrappy's$q$, 52, $q$US$q$, NULL, $q$https://www.scrappysbitters.com/bitters/cardamom$q$, $q$producer$q$),
($q$Scrappy's Celery Bitters$q$, $q$Scrappy's Celery Bitters$q$, $q$Celery Bitters$q$, $q$Scrappy's$q$, 51, $q$US$q$, NULL, $q$https://www.scrappysbitters.com/bitters/celery-bitters$q$, $q$producer$q$),
($q$Scrappy's Chocolate Bitters$q$, $q$Scrappy's Chocolate Bitters$q$, $q$Chocolate Bitters$q$, $q$Scrappy's$q$, 47.6, $q$US$q$, NULL, $q$https://www.scrappysbitters.com/bitters/chocolate-bitters$q$, $q$producer$q$),
($q$Scrappy's Fire Tincture$q$, NULL, $q$Habanero Bitters$q$, $q$Scrappy's$q$, 44.3, $q$US$q$, NULL, $q$https://www.scrappysbitters.com/bitters/firewater-bitters$q$, $q$producer$q$),
($q$Scrappy's Grapefruit Bitters$q$, $q$Scrappy's Grapefruit Bitters$q$, $q$Grapefruit Bitters$q$, $q$Scrappy's$q$, 45, $q$US$q$, NULL, $q$https://www.scrappysbitters.com/bitters/grapefruit$q$, $q$producer$q$),
($q$Scrappy's Lavender Bitters$q$, $q$Scrappy's Lavender Bitters$q$, $q$Lavender Bitters$q$, $q$Scrappy's$q$, 50.8, $q$US$q$, NULL, $q$https://www.scrappysbitters.com/bitters/lavender$q$, $q$producer$q$),
($q$Scrappy's Lime Bitters$q$, NULL, $q$Lime Bitters$q$, $q$Scrappy's$q$, 49.1, $q$US$q$, NULL, $q$https://www.scrappysbitters.com/bitters/lime-bitters$q$, $q$producer$q$),
($q$Scrappy's Orange Bitters$q$, $q$Scrappy's Orange Bitters$q$, $q$Orange Bitters$q$, $q$Scrappy's$q$, 43.9, $q$US$q$, NULL, $q$https://www.scrappysbitters.com/bitters/orange$q$, $q$producer$q$),
($q$Scrappy's Orleans Bitters$q$, NULL, $q$Creole Bitters$q$, $q$Scrappy's$q$, 47, $q$US$q$, NULL, $q$https://www.scrappysbitters.com/bitters/orleans-bitters$q$, $q$producer$q$),
($q$The Bitter Truth Black Cherry Bitters$q$, NULL, $q$Cherry Bitters$q$, $q$The Bitter Truth$q$, 44, $q$DE$q$, NULL, $q$https://the-bitter-truth.com/bitters/black-cherry-bitters/$q$, $q$producer$q$),
($q$The Bitter Truth Bogart's Bitters$q$, NULL, $q$Aromatic Bitters$q$, $q$The Bitter Truth$q$, 42.1, $q$DE$q$, NULL, $q$https://the-bitter-truth.com/bitters/bogarts-bokers-bitters/$q$, $q$producer$q$),
($q$The Bitter Truth Chocolate Bitters$q$, $q$The Bitter Truth Chocolate Bitters$q$, $q$Chocolate Bitters$q$, $q$The Bitter Truth$q$, 44, $q$DE$q$, NULL, $q$https://the-bitter-truth.com/bitters/chocolate-bitters/$q$, $q$producer$q$),
($q$The Bitter Truth Creole Bitters$q$, $q$The Bitter Truth Creole Bitters$q$, $q$Creole Bitters$q$, $q$The Bitter Truth$q$, 39, $q$DE$q$, NULL, $q$https://the-bitter-truth.com/bitters/creole-bitters/$q$, $q$producer$q$),
($q$The Bitter Truth Cucumber Bitters$q$, $q$The Bitter Truth Cucumber Bitters$q$, $q$Cucumber Bitters$q$, $q$The Bitter Truth$q$, 39, $q$DE$q$, NULL, $q$https://the-bitter-truth.com/bitters/cucumber-bitters/$q$, $q$producer$q$),
($q$The Bitter Truth Grapefruit Bitters$q$, $q$The Bitter Truth Grapefruit Bitters$q$, $q$Grapefruit Bitters$q$, $q$The Bitter Truth$q$, 44, $q$DE$q$, NULL, $q$https://the-bitter-truth.com/bitters/grapefruit-bitters/$q$, $q$producer$q$),
($q$The Bitter Truth Hazy Hops Bitters$q$, NULL, $q$Bitters$q$, $q$The Bitter Truth$q$, 44, $q$DE$q$, NULL, $q$https://the-bitter-truth.com/bitters/hazy-hops-bitters/$q$, $q$producer$q$),
($q$The Bitter Truth Jerry Thomas' Own Decanter Bitters$q$, $q$The Bitter Truth Jerry Thomas' Own Decanter Bitters$q$, $q$Aromatic Bitters$q$, $q$The Bitter Truth$q$, 30, $q$DE$q$, NULL, $q$https://the-bitter-truth.com/bitters/jerry-thomas/$q$, $q$producer$q$),
($q$The Bitter Truth Lemon Bitters$q$, $q$The Bitter Truth Lemon Bitters$q$, $q$Lemon Bitters$q$, $q$The Bitter Truth$q$, 39, $q$DE$q$, NULL, $q$https://the-bitter-truth.com/bitters/lemon-bitters/$q$, $q$producer$q$),
($q$The Bitter Truth Old Time Aromatic Bitters$q$, $q$The Bitter Truth Aromatic Bitters$q$, $q$Aromatic Bitters$q$, $q$The Bitter Truth$q$, 39, $q$DE$q$, NULL, $q$https://the-bitter-truth.com/bitters/old-time-aromatic-bitters/$q$, $q$producer$q$),
($q$The Bitter Truth Olive Bitters$q$, NULL, $q$Olive Bitters$q$, $q$The Bitter Truth$q$, 39, $q$DE$q$, NULL, $q$https://the-bitter-truth.com/bitters/olive-bitters/$q$, $q$producer$q$),
($q$The Bitter Truth Orange Bitters$q$, $q$The Bitter Truth Orange Bitters$q$, $q$Orange Bitters$q$, $q$The Bitter Truth$q$, 39, $q$DE$q$, NULL, $q$https://the-bitter-truth.com/bitters/orange-bitters/$q$, $q$producer$q$),
($q$The Bitter Truth Original Celery Bitters$q$, $q$The Bitter Truth Celery Bitters$q$, $q$Celery Bitters$q$, $q$The Bitter Truth$q$, 44, $q$DE$q$, NULL, $q$https://the-bitter-truth.com/bitters/original-celery-bitters/$q$, $q$producer$q$),
($q$The Bitter Truth Peach Bitters$q$, NULL, $q$Peach Bitters$q$, $q$The Bitter Truth$q$, 39, $q$DE$q$, NULL, $q$https://the-bitter-truth.com/bitters/peach-bitters/$q$, $q$producer$q$),
($q$Woodford Reserve Chocolate Bitters$q$, $q$Woodford Reserve Chocolate Bitters$q$, $q$Chocolate Bitters$q$, $q$Woodford Reserve$q$, NULL, $q$US$q$, NULL, $q$https://shop.woodfordreserve.com/chocolate-bitters/$q$, $q$producer$q$),
($q$Woodford Reserve Orange Bitters$q$, $q$Woodford Reserve Orange Bitters$q$, $q$Orange Bitters$q$, $q$Woodford Reserve$q$, 44, $q$US$q$, NULL, $q$https://shop.woodfordreserve.com/orange-bitters/$q$, $q$producer$q$),
($q$Woodford Reserve Peach Bitters$q$, NULL, $q$Peach Bitters$q$, $q$Woodford Reserve$q$, 50, $q$US$q$, NULL, $q$https://shop.woodfordreserve.com/peach-bitters/$q$, $q$producer$q$);

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
    WHEN b.style IN ($q$Bitters$q$) AND EXISTS (
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
