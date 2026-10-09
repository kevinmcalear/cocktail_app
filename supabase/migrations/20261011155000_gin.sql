-- Gin: every bottle checked on its producer's own page (or, where that page
-- was blocked, a major retailer, importer or Difford's), after 20261011154000.
-- Step 3b of the bottle catalog plan: https://claude.ai/artifact/Vu6seuSNtN42nKYb2nDCVR
--
--   * 262 checked bottles from 115 producers: the core range of every gin
--     house in our catalog or on BC Liquor's list. On a copy of production
--     (2026-10-09): 116 new bottles, and 133 we had that get their label
--     name (51 renamed, the old name kept as an alias), style, ABV, country
--     and maker where they were missing or wrong.
--   * Styles: London Dry Gin only when the label says so, Old Tom, Navy
--     Strength (57% or more), Aged Gin (barrel-rested), Pink Gin, Flavoured
--     Gin, and Gin for the rest. A bottle already under a place style
--     (Japanese Gin, Spanish Gin) keeps it when the check gives only Gin.
--     Sloe gins and other gin liqueurs stay out, as does Gordon's Premium
--     Pink, now sold as a 35% spirit drink.
--   * Each producer gets an unclaimed maker page (makes: bottles), and each
--     bottle names it.
--   * Every fact keeps the page it was checked on in item_sources. An ABV
--     read off a different page than the bottle's source isn't kept.
--   * An independent second check of 100 random rows found 2 wrong facts in
--     469 (0.4%), both style calls (Citadelle Rouge and Conniption Kinship
--     are Flavoured Gin); both are taken.
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
(0, $q$Gin$q$, NULL),
(1, $q$London Dry Gin$q$, $q$Gin$q$),
(2, $q$Old Tom Gin$q$, $q$Gin$q$),
(3, $q$Navy Strength Gin$q$, $q$Gin$q$),
(4, $q$Aged Gin$q$, $q$Gin$q$),
(5, $q$Flavoured Gin$q$, $q$Gin$q$),
(6, $q$Pink Gin$q$, $q$Flavoured Gin$q$);

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
INSERT INTO place_in VALUES
($q$Amalfi Coast Gin$q$),
($q$Balinese Dry Gin$q$),
($q$Barrel-Aged Canadian Gin$q$),
($q$French Gin$q$),
($q$Islay Gin$q$),
($q$Italian Gin$q$),
($q$Japanese Gin$q$),
($q$Mexican Gin$q$),
($q$Scottish Gin$q$),
($q$Spanish Gin$q$),
($q$Speyside Gin$q$),
($q$Wild-Foraged Himalayan Juniper Gin$q$);

-- ---------------------------------------------------------------------------
-- Maker pages
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE maker_in (name text PRIMARY KEY, handle text NOT NULL, website text, country text, part_of text);
INSERT INTO maker_in VALUES
($q$Ableforth's$q$, $q$ableforth.s$q$, $q$https://bathtubgin.com$q$, NULL, NULL),
($q$Anaë$q$, $q$anae$q$, $q$https://www.groupebollinger.fr$q$, NULL, NULL),
($q$Archie Rose Distilling Co.$q$, $q$archie.rose.distilling.co$q$, $q$https://archierose.com.au$q$, NULL, NULL),
($q$Aviation Gin$q$, $q$aviation.gin$q$, $q$https://www.aviationgin.com$q$, NULL, NULL),
($q$Barr Hill$q$, $q$barr.hill$q$, $q$https://www.barrhill.com$q$, NULL, NULL),
($q$Bermondsey Distillery$q$, $q$bermondsey.distillery$q$, $q$https://bermondseydistillery.com$q$, $q$GB$q$, NULL),
($q$Bluecoat$q$, $q$bluecoat$q$, $q$https://www.philadelphiadistilling.com/$q$, $q$US$q$, NULL),
($q$Bombay Sapphire$q$, $q$bombay.sapphire$q$, $q$https://www.bombaysapphire.com$q$, NULL, NULL),
($q$Boodles$q$, $q$boodles$q$, $q$https://boodlesgin.com$q$, NULL, NULL),
($q$Brockmans$q$, $q$brockmans$q$, $q$https://www.brockmansgin.com$q$, NULL, NULL),
($q$Broker's Gin$q$, $q$broker.s.gin$q$, $q$https://brokersgin.com$q$, NULL, NULL),
($q$Brooklyn Gin$q$, $q$brooklyn.gin$q$, $q$https://www.brooklyngin.com$q$, NULL, NULL),
($q$Bulldog$q$, $q$bulldog$q$, $q$https://www.bulldoggin.com$q$, NULL, NULL),
($q$Cadenhead's$q$, $q$cadenhead.s$q$, $q$https://www.cadenhead.scot$q$, NULL, NULL),
($q$Canaïma$q$, $q$canaima$q$, $q$https://canaimagin.com$q$, NULL, NULL),
($q$Caorunn$q$, $q$caorunn$q$, $q$https://www.caorunngin.com$q$, NULL, NULL),
($q$Cape Byron Distillery$q$, $q$cape.byron.distillery$q$, $q$https://capebyrondistillery.com$q$, NULL, NULL),
($q$Christian Drouin$q$, $q$christian.drouin$q$, $q$https://www.le-gin-drouin.com$q$, NULL, NULL),
($q$Citadelle$q$, $q$citadelle$q$, $q$https://citadellegin.com$q$, $q$FR$q$, NULL),
($q$Condesa Gin$q$, $q$condesa.gin$q$, $q$https://www.condesagin.com$q$, NULL, NULL),
($q$Copperpenny Distilling Co.$q$, $q$copperpenny.distilling.co$q$, $q$https://copperpennydistilling.com$q$, NULL, NULL),
($q$Cotswolds Distillery$q$, $q$cotswolds.distillery$q$, $q$https://www.cotswoldsdistillery.com$q$, NULL, NULL),
($q$Dillon's Small Batch Distillers$q$, $q$dillon.s.small.batch.distiller$q$, $q$https://www.dillons.ca$q$, NULL, NULL),
($q$Dingle Distillery$q$, $q$dingle.distillery$q$, $q$https://dingledistillery.ie$q$, NULL, NULL),
($q$Drumshanbo$q$, $q$drumshanbo$q$, $q$https://www.thesheddistillery.com/$q$, $q$IE$q$, NULL),
($q$Durham Distillery$q$, $q$durham.distillery$q$, $q$https://conniptiongin.com$q$, NULL, NULL),
($q$Echlinville Distillery$q$, $q$echlinville.distillery$q$, $q$https://echlinville.com/$q$, NULL, NULL),
($q$Elephant Gin$q$, $q$elephant.gin$q$, $q$https://elephant-gin.com$q$, NULL, NULL),
($q$Empress 1908$q$, $q$empress.1908$q$, $q$https://empressgin.com$q$, NULL, NULL),
($q$Etsu$q$, $q$etsu$q$, $q$https://etsugin.com$q$, NULL, NULL),
($q$Fords Gin$q$, $q$fords.gin$q$, $q$https://www.fordsgin.com$q$, NULL, NULL),
($q$Four Pillars$q$, $q$four.pillars$q$, $q$https://fourpillarsgin.com$q$, NULL, NULL),
($q$Foxdenton Estate$q$, $q$foxdenton.estate$q$, $q$https://foxdentonestate.co.uk$q$, NULL, NULL),
($q$Furneaux Distillery$q$, $q$furneaux.distillery$q$, $q$https://www.furneauxdistillery.com.au$q$, NULL, NULL),
($q$G'Vine$q$, $q$g.vine$q$, $q$https://www.g-vine.com/$q$, $q$FR$q$, NULL),
($q$Gin Mare$q$, $q$gin.mare$q$, $q$https://www.ginmare.com$q$, $q$ES$q$, NULL),
($q$Ginebra San Miguel$q$, $q$ginebra.san.miguel$q$, $q$https://www.ginebrasanmiguel.com$q$, NULL, NULL),
($q$Glendalough Distillery$q$, $q$glendalough.distillery$q$, $q$https://www.glendaloughdistillery.com$q$, $q$IE$q$, NULL),
($q$Gordon's$q$, $q$gordon.s$q$, $q$https://www.gordonsgin.com$q$, NULL, NULL),
($q$Greenall's$q$, $q$greenall.s$q$, $q$https://www.greenallsgin.com$q$, $q$GB$q$, NULL),
($q$Griffo Distillery$q$, $q$griffo.distillery$q$, $q$https://griffodistillery.com$q$, $q$US$q$, NULL),
($q$Hammer & Son$q$, $q$hammer.son$q$, NULL, $q$GB$q$, NULL),
($q$Hayman's$q$, $q$hayman.s$q$, $q$https://www.haymansgin.com$q$, $q$GB$q$, NULL),
($q$Hendrick's$q$, $q$hendrick.s$q$, $q$https://www.hendricksgin.com$q$, $q$GB$q$, NULL),
($q$Hensol Castle Distillery$q$, $q$hensol.castle.distillery$q$, $q$https://www.hensolcastledistillery.com$q$, $q$GB$q$, NULL),
($q$Hotaling & Co.$q$, $q$hotaling.co$q$, $q$https://www.hotalingandco.com$q$, $q$US$q$, NULL),
($q$Husk Distillers$q$, $q$husk.distillers$q$, $q$https://www.huskdistillers.com$q$, $q$AU$q$, NULL),
($q$Iron Balls$q$, $q$iron.balls$q$, NULL, $q$TH$q$, NULL),
($q$Isle of Harris Distillers$q$, $q$isle.of.harris.distillers$q$, $q$https://www.harrisdistillery.com$q$, $q$GB$q$, NULL),
($q$J. Rieger & Co.$q$, $q$j.rieger.co$q$, $q$https://www.jriegerco.com$q$, $q$US$q$, NULL),
($q$Jaisalmer$q$, $q$jaisalmer$q$, NULL, $q$IN$q$, NULL),
($q$KOVAL$q$, $q$koval$q$, $q$https://www.koval-distillery.com$q$, $q$US$q$, NULL),
($q$Katún$q$, $q$katun$q$, NULL, $q$MX$q$, NULL),
($q$Komasa Jyozo$q$, $q$komasa.jyozo$q$, NULL, $q$JP$q$, NULL),
($q$La Insoportable Cervecería y Destilería$q$, $q$la.insoportable.cerveceria.y.d$q$, $q$https://skurnik.com/producer/armonico-gin$q$, NULL, NULL),
($q$Le Tribute$q$, $q$le.tribute$q$, NULL, $q$ES$q$, NULL),
($q$Leopold Bros.$q$, $q$leopold.bros$q$, $q$https://www.leopoldbros.com$q$, $q$US$q$, NULL),
($q$Long Table Distillery$q$, $q$long.table.distillery$q$, NULL, $q$CA$q$, NULL),
($q$Malfy$q$, $q$malfy$q$, $q$https://www.malfygin.com$q$, $q$IT$q$, NULL),
($q$Manly Spirits Co.$q$, $q$manly.spirits.co$q$, $q$https://manlyspirits.com.au$q$, $q$AU$q$, NULL),
($q$Martin Miller's$q$, $q$martin.miller.s$q$, $q$https://martinmillersgin.com$q$, $q$GB$q$, NULL),
($q$Matsui$q$, $q$matsui$q$, NULL, $q$JP$q$, NULL),
($q$Moletto$q$, $q$moletto$q$, NULL, $q$IT$q$, NULL),
($q$Monkey 47$q$, $q$monkey.47$q$, $q$https://monkey47.com$q$, $q$DE$q$, NULL),
($q$Moorland Spirit Co.$q$, $q$moorland.spirit.co$q$, $q$https://www.hepplespirits.com$q$, $q$GB$q$, NULL),
($q$Nao Spirits$q$, $q$nao.spirits$q$, NULL, $q$IN$q$, NULL),
($q$Never Never Distilling Co.$q$, $q$never.never.distilling.co$q$, $q$https://neverneverdistilling.com.au$q$, $q$AU$q$, NULL),
($q$Neversink Spirits$q$, $q$neversink.spirits$q$, NULL, $q$US$q$, NULL),
($q$New York Distilling Company$q$, $q$new.york.distilling.company$q$, $q$https://www.nydistilling.com$q$, $q$US$q$, NULL),
($q$Nikka$q$, $q$nikka$q$, $q$https://nikka.com/en/$q$, $q$JP$q$, NULL),
($q$No.3 Gin$q$, $q$no.3.gin$q$, $q$https://no3gin.com/$q$, NULL, NULL),
($q$Nolet's$q$, $q$nolet.s$q$, $q$https://noletsgin.com/$q$, $q$NL$q$, NULL),
($q$Nordés$q$, $q$nordes$q$, $q$https://nordesgin.com/$q$, $q$ES$q$, NULL),
($q$Opihr$q$, $q$opihr$q$, $q$https://opihr.com/$q$, $q$GB$q$, NULL),
($q$Oxley$q$, $q$oxley$q$, $q$https://www.oxleygin.com/$q$, $q$GB$q$, NULL),
($q$Patient Wolf$q$, $q$patient.wolf$q$, $q$https://www.patientwolfgin.com/$q$, $q$AU$q$, NULL),
($q$Peter in Florence$q$, $q$peter.in.florence$q$, $q$https://www.peterinflorence.com/$q$, $q$IT$q$, NULL),
($q$Plymouth Gin$q$, $q$plymouth.gin$q$, $q$https://www.plymouthgin.com/$q$, $q$GB$q$, NULL),
($q$Poor Toms$q$, $q$poor.toms$q$, $q$https://www.poortoms.com/$q$, $q$AU$q$, NULL),
($q$Porter's Gin$q$, $q$porter.s.gin$q$, $q$https://portersgin.co.uk/$q$, $q$GB$q$, NULL),
($q$Portobello Road Gin$q$, $q$portobello.road.gin$q$, $q$https://www.portobelloroadgin.com/$q$, $q$GB$q$, NULL),
($q$Procera$q$, $q$procera$q$, NULL, $q$KE$q$, NULL),
($q$Príncipe de los Apóstoles$q$, $q$principe.de.los.apostoles$q$, NULL, NULL, NULL),
($q$Puerto de Indias$q$, $q$puerto.de.indias$q$, $q$https://ginpuertodeindias.com/en/$q$, $q$ES$q$, NULL),
($q$Ransom$q$, $q$ransom$q$, $q$https://www.ransomspirits.com/$q$, $q$US$q$, NULL),
($q$Reisetbauer$q$, $q$reisetbauer$q$, $q$https://www.bluegin.cc/$q$, $q$AT$q$, NULL),
($q$Renais$q$, $q$renais$q$, $q$https://renais.co.uk/$q$, NULL, NULL),
($q$Roku$q$, $q$roku$q$, $q$https://house.suntory.com/roku-gin$q$, $q$JP$q$, NULL),
($q$Sabatini Gin$q$, $q$sabatini.gin$q$, $q$https://www.sabatinigin.com/$q$, NULL, NULL),
($q$Saigon Baigur$q$, $q$saigon.baigur$q$, $q$https://www.saigonbaigur.com/$q$, $q$VN$q$, NULL),
($q$Sakurao Distillery$q$, $q$sakurao.distillery$q$, NULL, $q$JP$q$, NULL),
($q$Saneha$q$, $q$saneha$q$, NULL, $q$TH$q$, NULL),
($q$Sapling$q$, $q$sapling$q$, $q$https://www.saplingspirits.com/$q$, $q$GB$q$, NULL),
($q$Seagram's$q$, $q$seagram.s$q$, $q$https://www.seagramsgin.com/$q$, $q$US$q$, NULL),
($q$Sheringham Distillery$q$, $q$sheringham.distillery$q$, $q$https://sheringhamdistillery.com/$q$, $q$CA$q$, NULL),
($q$Silent Pool$q$, $q$silent.pool$q$, $q$https://silentpooldistillers.com/$q$, $q$GB$q$, NULL),
($q$Sipsmith$q$, $q$sipsmith$q$, $q$https://sipsmith.com/$q$, $q$GB$q$, NULL),
($q$Sorgin$q$, $q$sorgin$q$, $q$https://sorgin.fr/$q$, $q$FR$q$, NULL),
($q$Spring44$q$, $q$spring44$q$, $q$https://www.spring44.com/$q$, NULL, NULL),
($q$St. George Spirits$q$, $q$st.george.spirits$q$, $q$https://stgeorgespirits.com/$q$, $q$US$q$, NULL),
($q$Stranger & Sons$q$, $q$stranger.sons$q$, $q$https://www.strangerandsons.com/$q$, $q$IN$q$, NULL),
($q$Stray Dog$q$, $q$stray.dog$q$, $q$https://www.skurnik.com/producer/stray-dog/$q$, $q$GR$q$, NULL),
($q$Tanqueray$q$, $q$tanqueray$q$, $q$https://www.tanqueray.com/$q$, NULL, NULL),
($q$Tarquin's$q$, $q$tarquin.s$q$, $q$https://tarquinsgin.com/$q$, $q$GB$q$, NULL),
($q$Tassoni$q$, $q$tassoni$q$, $q$https://www.tassoni.it/$q$, $q$IT$q$, NULL),
($q$The Boatyard Distillery$q$, $q$the.boatyard.distillery$q$, $q$https://www.boatyarddistillery.com$q$, NULL, NULL),
($q$The Botanist$q$, $q$the.botanist$q$, $q$https://www.thebotanist.com$q$, NULL, NULL),
($q$The Gardener$q$, $q$the.gardener$q$, NULL, $q$FR$q$, NULL),
($q$The Kyoto Distillery$q$, $q$the.kyoto.distillery$q$, $q$https://www.kinobigin.com$q$, $q$JP$q$, NULL),
($q$The Melbourne Gin Company$q$, $q$the.melbourne.gin.company$q$, $q$https://melbournegincompany.com$q$, $q$AU$q$, NULL),
($q$The West Winds Gin$q$, $q$the.west.winds.gin$q$, NULL, $q$AU$q$, NULL),
($q$Uncle Val's$q$, $q$uncle.val.s$q$, $q$https://www.unclevalsgin.com/$q$, $q$US$q$, NULL),
($q$Ungava$q$, $q$ungava$q$, NULL, $q$CA$q$, NULL),
($q$Whitley Neill$q$, $q$whitley.neill$q$, $q$https://whitleyneill.com/$q$, NULL, NULL),
($q$Xoriguer$q$, $q$xoriguer$q$, $q$https://xoriguer.es/$q$, $q$ES$q$, NULL);

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
($q$Ableforth's Bathtub Gin$q$, $q$Bathtub Gin$q$, $q$Gin$q$, $q$Ableforth's$q$, NULL, NULL, NULL, $q$https://bathtubgin.com/$q$, $q$producer$q$),
($q$Ableforth's Bathtub Gin Navy Strength$q$, $q$Ableforth's Bathtub Navy Strength Gin$q$, $q$Navy Strength Gin$q$, $q$Ableforth's$q$, 57, NULL, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/6112/ableforths-bathtub-gin-navy-strength$q$, $q$reference$q$),
($q$Ableforth's Bathtub Old Tom Gin$q$, $q$Ableforth's Bathtub Old Tom Gin$q$, $q$Old Tom Gin$q$, $q$Ableforth's$q$, NULL, NULL, NULL, $q$https://bathtubgin.com/$q$, $q$producer$q$),
($q$Anaë Gin$q$, NULL, $q$Gin$q$, $q$Anaë$q$, 43, NULL, NULL, $q$https://www.whisky.fr/en/anae.html$q$, $q$retailer$q$),
($q$Archie Rose Bone Dry Gin$q$, $q$Archie Rose Bone Dry Gin$q$, $q$Gin$q$, $q$Archie Rose Distilling Co.$q$, 44, NULL, NULL, $q$https://archierose.com.au/shop/product/bone-dry-gin$q$, $q$producer$q$),
($q$Archie Rose Signature Dry Gin$q$, $q$Archie Rose Signature Dry Gin$q$, $q$Gin$q$, $q$Archie Rose Distilling Co.$q$, 40, NULL, NULL, $q$https://archierose.com.au/shop/product/signature-dry-gin$q$, $q$producer$q$),
($q$Archie Rose Straight Dry Gin$q$, $q$Archie Rose 'Straight Dry' Gin$q$, $q$Gin$q$, $q$Archie Rose Distilling Co.$q$, NULL, NULL, NULL, $q$https://archierose.com.au/shop/product/straight-dry-gin$q$, $q$producer$q$),
($q$Aviation American Gin$q$, $q$Aviation American Gin$q$, $q$Gin$q$, $q$Aviation Gin$q$, 42, NULL, NULL, $q$https://www.aviationgin.com/$q$, $q$producer$q$),
($q$Barr Hill Gin$q$, $q$Barr Hill Gin$q$, $q$Gin$q$, $q$Barr Hill$q$, 45, NULL, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/7951/barr-hill-gin$q$, $q$reference$q$),
($q$Barr Hill Tom Cat Gin$q$, $q$Barr Hill Tom Cat Gin$q$, $q$Old Tom Gin$q$, $q$Barr Hill$q$, 43, NULL, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/6786/barr-hill-reserve-tom-cat-gin$q$, $q$reference$q$),
($q$Jensen's Bermondsey London Dry Gin$q$, $q$Jensen's Bermondsey Dry Gin$q$, $q$London Dry Gin$q$, $q$Bermondsey Distillery$q$, 43, $q$GB$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/279/jensens-bermondsey-gin$q$, $q$reference$q$),
($q$Jensen's London Distilled Old Tom Gin$q$, $q$Jensen's Old Tom Gin$q$, $q$Old Tom Gin$q$, $q$Bermondsey Distillery$q$, 43, $q$GB$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/280/jensens-old-tom-gin$q$, $q$reference$q$),
($q$Bluecoat American Dry Gin$q$, $q$Bluecoat American Dry Gin$q$, $q$Gin$q$, $q$Bluecoat$q$, 47, $q$US$q$, NULL, $q$https://sites.salsify.com/bdf90657-7017-4b79-9030-f3fd0c5c46cc/b87f44b2-7640-4efc-bdbd-712f508dd1f9/product/418-0246/Bluecoat-American-Dry-Gin/$q$, $q$producer$q$),
($q$Bluecoat Barrel Finished Gin$q$, NULL, $q$Aged Gin$q$, $q$Bluecoat$q$, NULL, $q$US$q$, NULL, $q$https://bluecoatgin.com/bluecoatbarrelfinishedgin$q$, $q$producer$q$),
($q$Bluecoat Elderflower Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Bluecoat$q$, NULL, $q$US$q$, NULL, $q$https://www.philadelphiadistilling.com/bluecoat-elderflower-gin$q$, $q$producer$q$),
($q$Bombay Bramble$q$, $q$Bombay Bramble$q$, $q$Flavoured Gin$q$, $q$Bombay Sapphire$q$, 37.5, NULL, NULL, $q$https://shop.bombaysapphire.com/products/bombay-bramble-gin-1l$q$, $q$producer$q$),
($q$Bombay Citron Pressé$q$, NULL, $q$Flavoured Gin$q$, $q$Bombay Sapphire$q$, 37.5, NULL, NULL, $q$https://shop.bombaysapphire.com/products/bombay-citron-presse-gin$q$, $q$producer$q$),
($q$Bombay London Dry Gin$q$, $q$Bombay Dry Gin$q$, $q$London Dry Gin$q$, $q$Bombay Sapphire$q$, NULL, NULL, NULL, $q$https://www.bombaysapphire.com/products/bombay-dry-gin/$q$, $q$producer$q$),
($q$Bombay Sapphire Gin$q$, $q$Bombay Sapphire Gin$q$, $q$London Dry Gin$q$, $q$Bombay Sapphire$q$, 40, NULL, NULL, $q$https://shop.bombaysapphire.com/products/bombay-sapphire$q$, $q$producer$q$),
($q$Bombay Sapphire Premier Cru Murcian Lemon$q$, $q$Bombay Sapphire Premier Cru Murcian Lemon Gin$q$, $q$Gin$q$, $q$Bombay Sapphire$q$, NULL, NULL, NULL, $q$https://www.bombaysapphire.com/products/premier-cru-murcian-lemon/$q$, $q$producer$q$),
($q$Bombay Sapphire Premier Cru Tuscan Juniper$q$, NULL, $q$Gin$q$, $q$Bombay Sapphire$q$, 47, NULL, NULL, $q$https://shop.bombaysapphire.com/products/bombay-sapphire-premier-cru-tuscan-juniper$q$, $q$producer$q$),
($q$Boodles British Gin$q$, $q$Boodles London Dry Gin$q$, $q$London Dry Gin$q$, $q$Boodles$q$, 45.2, NULL, NULL, $q$https://boodlesgin.com/bulletin/original-london-dry/$q$, $q$producer$q$),
($q$Boodles Rhubarb & Strawberry Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Boodles$q$, NULL, NULL, NULL, $q$https://boodlesgin.com/bulletin/introducing-rhubarb-strawberry/$q$, $q$producer$q$),
($q$Brockmans Agave Cut$q$, NULL, $q$Gin$q$, $q$Brockmans$q$, NULL, NULL, NULL, $q$https://www.brockmansgin.com/brockmans-agave-cut-gin/$q$, $q$producer$q$),
($q$Brockmans Intensely Smooth Gin$q$, $q$Brockmans Gin$q$, $q$Gin$q$, $q$Brockmans$q$, 40, NULL, NULL, $q$https://www.brockmansgin.com/brockmans-intensely-smooth-gin/$q$, $q$producer$q$),
($q$Brockmans Orange Kiss Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Brockmans$q$, NULL, NULL, NULL, $q$https://www.brockmansgin.com/brockmans-orange-kiss-gin/$q$, $q$producer$q$),
($q$Broker's London Dry Gin$q$, $q$Broker's London Dry Gin$q$, $q$London Dry Gin$q$, $q$Broker's Gin$q$, 47, NULL, NULL, $q$https://brokersgin.com/london-dry-gin/$q$, $q$producer$q$),
($q$Brooklyn Gin$q$, $q$Brooklyn Gin$q$, $q$Gin$q$, $q$Brooklyn Gin$q$, 40, NULL, NULL, $q$https://www.brooklyngin.com/products/brooklyn-gin/$q$, $q$producer$q$),
($q$Bulldog Bold Black London Dry Gin$q$, NULL, $q$London Dry Gin$q$, $q$Bulldog$q$, NULL, NULL, NULL, $q$https://www.bulldoggin.com/bold-black/$q$, $q$producer$q$),
($q$Bulldog London Dry Gin$q$, $q$Bulldog London Dry Gin$q$, $q$London Dry Gin$q$, $q$Bulldog$q$, NULL, NULL, NULL, $q$https://www.bulldoggin.com/london-dry-gin/$q$, $q$producer$q$),
($q$Cadenhead's Old Raj Gin 46%$q$, NULL, $q$Gin$q$, $q$Cadenhead's$q$, 46, NULL, NULL, $q$https://www.cadenhead.scot/our-spirits/cadenheads-gin/$q$, $q$producer$q$),
($q$Cadenhead's Old Raj Gin 55%$q$, NULL, $q$Gin$q$, $q$Cadenhead's$q$, 55, NULL, NULL, $q$https://www.cadenhead.scot/our-spirits/cadenheads-gin/$q$, $q$producer$q$),
($q$Canaïma Gin$q$, $q$Canaïma Gin$q$, $q$Gin$q$, $q$Canaïma$q$, NULL, NULL, NULL, $q$https://canaimagin.com/en/$q$, $q$producer$q$),
($q$Caorunn Blood Orange$q$, NULL, $q$Flavoured Gin$q$, $q$Caorunn$q$, NULL, NULL, NULL, $q$https://www.caorunngin.com/our-gins/40-blood-orange$q$, $q$producer$q$),
($q$Caorunn Cask Aged Gin$q$, NULL, $q$Aged Gin$q$, $q$Caorunn$q$, NULL, NULL, NULL, $q$https://www.caorunngin.com/our-gins/42-caorunn-cask-aged$q$, $q$producer$q$),
($q$Caorunn Gin$q$, $q$Caorunn Gin$q$, $q$Gin$q$, $q$Caorunn$q$, NULL, NULL, NULL, $q$https://www.caorunngin.com/our-gins/13-caorunn-gin$q$, $q$producer$q$),
($q$Caorunn Highland Strength$q$, NULL, $q$Gin$q$, $q$Caorunn$q$, 54, NULL, NULL, $q$https://www.caorunngin.com/our-gins$q$, $q$producer$q$),
($q$Caorunn Scottish Raspberry$q$, NULL, $q$Flavoured Gin$q$, $q$Caorunn$q$, NULL, NULL, NULL, $q$https://www.caorunngin.com/our-gins/14-scottish-raspberry$q$, $q$producer$q$),
($q$Brookie's Byron Dry Gin$q$, $q$Brookie's Gin$q$, $q$Gin$q$, $q$Cape Byron Distillery$q$, 43, NULL, NULL, $q$https://capebyrondistillery.com/products/brookies-byron-dry-gin$q$, $q$producer$q$),
($q$Brookie's Shirl the Pearl Cumquat Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Cape Byron Distillery$q$, 37.7, NULL, NULL, $q$https://capebyrondistillery.com/products/brookies-shirl-the-pearl-cumquat-gin$q$, $q$producer$q$),
($q$Christian Drouin Gin Carmina$q$, NULL, $q$Gin$q$, $q$Christian Drouin$q$, NULL, NULL, NULL, $q$https://www.le-gin-drouin.com/fr/gin-carmina$q$, $q$producer$q$),
($q$Christian Drouin Gin Pira$q$, NULL, $q$Gin$q$, $q$Christian Drouin$q$, NULL, NULL, NULL, $q$https://www.le-gin-drouin.com/fr/gin-pira$q$, $q$producer$q$),
($q$Le Gin de Christian Drouin$q$, $q$Christian Drouin Apple Gin$q$, $q$Gin$q$, $q$Christian Drouin$q$, NULL, NULL, NULL, $q$https://www.le-gin-drouin.com/fr/gin-christian-drouin$q$, $q$producer$q$),
($q$Le Gin de Christian Drouin Calvados Cask Finish$q$, NULL, $q$Aged Gin$q$, $q$Christian Drouin$q$, NULL, NULL, NULL, $q$https://www.le-gin-drouin.com/fr/gin-christian-drouin$q$, $q$producer$q$),
($q$Citadelle Jardin d'Été Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Citadelle$q$, NULL, $q$FR$q$, NULL, $q$https://citadellegin.com/gin/jardin-dete/$q$, $q$producer$q$),
($q$Citadelle No Mistake Old Tom$q$, NULL, $q$Old Tom Gin$q$, $q$Citadelle$q$, NULL, NULL, NULL, $q$https://citadellegin.com/gin/no-mistake-old-tom/$q$, $q$producer$q$),
($q$Citadelle Original$q$, $q$Citadelle Gin$q$, $q$Gin$q$, $q$Citadelle$q$, NULL, NULL, NULL, $q$https://citadellegin.com/gin/citadelle-original/$q$, $q$producer$q$),
($q$Citadelle Rouge Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Citadelle$q$, NULL, $q$FR$q$, NULL, $q$https://citadellegin.com/gin/rouge-copy-copy/$q$, $q$producer$q$),
($q$Condesa Clásica Gin$q$, $q$Condesa Clásica Gin$q$, $q$Gin$q$, $q$Condesa Gin$q$, NULL, NULL, NULL, $q$https://www.condesagin.com/en/home/$q$, $q$producer$q$),
($q$Condesa Prickly Pear & Orange Blossom Gin$q$, $q$Condesa Prickly Pear & Orange Blossom Gin$q$, $q$Flavoured Gin$q$, $q$Condesa Gin$q$, NULL, NULL, NULL, $q$https://www.condesagin.com/en/home/$q$, $q$producer$q$),
($q$Copperpenny Ember Smoked Gin$q$, NULL, $q$Gin$q$, $q$Copperpenny Distilling Co.$q$, NULL, NULL, NULL, $q$https://copperpennydistilling.com/product/ember-smoked-gin/$q$, $q$producer$q$),
($q$Copperpenny Gin No. 005$q$, NULL, $q$Gin$q$, $q$Copperpenny Distilling Co.$q$, NULL, NULL, NULL, $q$https://copperpennydistilling.com/product/copperpenny-gin-005/$q$, $q$producer$q$),
($q$Copperpenny Lost Horizon Rare Tea Gin$q$, NULL, $q$Gin$q$, $q$Copperpenny Distilling Co.$q$, NULL, NULL, NULL, $q$https://copperpennydistilling.com/product/lost-horizon-rare-tea-gin/$q$, $q$producer$q$),
($q$Copperpenny No. 006 Oyster Shell Gin$q$, $q$Copperpenny Oyster Shell Gin$q$, $q$Gin$q$, $q$Copperpenny Distilling Co.$q$, NULL, NULL, NULL, $q$https://copperpennydistilling.com/product/no-006-oyster-shell-gin$q$, $q$producer$q$),
($q$Cotswolds Dry Gin$q$, $q$Cotswolds Dry Gin$q$, $q$Gin$q$, $q$Cotswolds Distillery$q$, 46, NULL, NULL, $q$https://www.cotswoldsdistillery.com/products/cotswolds-dry-gin$q$, $q$producer$q$),
($q$Cotswolds Hedgerow Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Cotswolds Distillery$q$, 40.6, NULL, NULL, $q$https://www.cotswoldsdistillery.com/products/cotswolds-hedgerow-gin-1$q$, $q$producer$q$),
($q$Cotswolds Old Tom Gin$q$, NULL, $q$Old Tom Gin$q$, $q$Cotswolds Distillery$q$, 42, NULL, NULL, $q$https://www.cotswoldsdistillery.com/products/copy-of-old-tom-gin$q$, $q$producer$q$),
($q$Cotswolds Wildflower No.1 Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Cotswolds Distillery$q$, 41.7, NULL, NULL, $q$https://www.cotswoldsdistillery.com/products/no-1-wildflower-gin$q$, $q$producer$q$),
($q$Cotswolds Wildflower No.2 Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Cotswolds Distillery$q$, 41.7, NULL, NULL, $q$https://www.cotswoldsdistillery.com/products/no-2-wildflower-gin$q$, $q$producer$q$),
($q$Cotswolds Wildflower No.3 Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Cotswolds Distillery$q$, 41.7, NULL, NULL, $q$https://www.cotswoldsdistillery.com/products/no-3-wildflower-gin$q$, $q$producer$q$),
($q$Dillon's Cranberry Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Dillon's Small Batch Distillers$q$, NULL, NULL, NULL, $q$https://shop.dillons.ca/cranberry-gin-750ml.html$q$, $q$producer$q$),
($q$Dillon's Dry Gin 7$q$, NULL, $q$Gin$q$, $q$Dillon's Small Batch Distillers$q$, NULL, NULL, NULL, $q$https://shop.dillons.ca/dry-gin-7.html$q$, $q$producer$q$),
($q$Dillon's Unfiltered Gin 22$q$, NULL, $q$Gin$q$, $q$Dillon's Small Batch Distillers$q$, NULL, NULL, NULL, $q$https://shop.dillons.ca/unfiltered-gin-22.html$q$, $q$producer$q$),
($q$Dingle Gin$q$, $q$Dingle Gin$q$, $q$London Dry Gin$q$, $q$Dingle Distillery$q$, NULL, NULL, NULL, $q$https://dingledistillery.ie/our-spirits/gin/dingle-gin/$q$, $q$producer$q$),
($q$Dingle Gin Orange & Sea Salt$q$, NULL, $q$Flavoured Gin$q$, $q$Dingle Distillery$q$, NULL, NULL, NULL, $q$https://dingledistillery.ie/our-spirits/gin/dingle-gin-orange-sea-salt/$q$, $q$producer$q$),
($q$Drumshanbo Gunpowder Irish Gin$q$, $q$Drumshanbo Gunpowder Irish Gin$q$, $q$Gin$q$, $q$Drumshanbo$q$, 43, $q$IE$q$, NULL, $q$https://www.thesheddistillery.com/our-creations/drumshanbo-gunpowder-irish-gin/$q$, $q$producer$q$),
($q$Drumshanbo Gunpowder Irish Gin with California Orange Citrus$q$, NULL, $q$Flavoured Gin$q$, $q$Drumshanbo$q$, NULL, $q$IE$q$, NULL, $q$https://www.thesheddistillery.com/our-creations/drumshanbo-gunpowder-irish-gin-with-california-orange-citrus/$q$, $q$producer$q$),
($q$Conniption American Dry Gin$q$, NULL, $q$Gin$q$, $q$Durham Distillery$q$, NULL, NULL, NULL, $q$https://conniptiongin.com/products/conniption-american-dry-gin$q$, $q$producer$q$),
($q$Conniption Barrel Aged Gin$q$, NULL, $q$Aged Gin$q$, $q$Durham Distillery$q$, NULL, NULL, NULL, $q$https://conniptiongin.com/products/conniption-barrel-aged-gin$q$, $q$producer$q$),
($q$Conniption Kinship Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Durham Distillery$q$, NULL, NULL, NULL, $q$https://conniptiongin.com/products/conniption-kinship-gin$q$, $q$producer$q$),
($q$Conniption Navy Strength Gin$q$, $q$Conniption Navy Strength Gin$q$, $q$Navy Strength Gin$q$, $q$Durham Distillery$q$, 57, NULL, NULL, $q$https://conniptiongin.com/products/conniption-navy-strength-gin$q$, $q$producer$q$),
($q$Weavers Irish Gin$q$, $q$Weavers Gin$q$, $q$Gin$q$, $q$Echlinville Distillery$q$, 42.5, NULL, NULL, $q$https://echlinville.com/shop/echlinville-distillery-shop/gin/weavers-dry-gin/$q$, $q$producer$q$),
($q$Elephant London Dry Gin$q$, $q$Elephant London Dry Gin$q$, $q$London Dry Gin$q$, $q$Elephant Gin$q$, 45, NULL, NULL, $q$https://elephant-gin.com/products/elephant-london-dry-0-5l$q$, $q$producer$q$),
($q$Elephant Orange Cocoa Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Elephant Gin$q$, 40, NULL, NULL, $q$https://elephant-gin.com/products/elephant-orange-cocoa-gin$q$, $q$producer$q$),
($q$Elephant Strength Gin$q$, NULL, $q$Navy Strength Gin$q$, $q$Elephant Gin$q$, 57, NULL, NULL, $q$https://elephant-gin.com/products/elephant-strength-gin-0-5l$q$, $q$producer$q$),
($q$Empress 1908 Cucumber Lemon Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Empress 1908$q$, NULL, NULL, NULL, $q$https://empressgin.com/spirit/cucumber-lemon-gin/$q$, $q$producer$q$),
($q$Empress 1908 Elderflower Rose Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Empress 1908$q$, NULL, NULL, NULL, $q$https://empressgin.com/spirit/elderflower-rose-gin/$q$, $q$producer$q$),
($q$Empress 1908 Original Gin$q$, NULL, $q$Gin$q$, $q$Empress 1908$q$, NULL, NULL, NULL, $q$https://empressgin.com/spirit/original-gin/$q$, $q$producer$q$),
($q$Etsu Double Orange$q$, NULL, $q$Flavoured Gin$q$, $q$Etsu$q$, NULL, NULL, NULL, $q$https://etsugin.com/gins-japonais/etsu-double-orange/$q$, $q$producer$q$),
($q$Etsu Double Yuzu$q$, NULL, $q$Flavoured Gin$q$, $q$Etsu$q$, NULL, NULL, NULL, $q$https://etsugin.com/gins-japonais/etsu-double-yuzu/$q$, $q$producer$q$),
($q$Etsu Gin The Original$q$, $q$Etsu Gin$q$, $q$Gin$q$, $q$Etsu$q$, NULL, NULL, NULL, $q$https://etsugin.com/gins-japonais/etsu-the-original/$q$, $q$producer$q$),
($q$Etsu Pacific Ocean Water$q$, NULL, $q$Gin$q$, $q$Etsu$q$, NULL, NULL, NULL, $q$https://etsugin.com/gins-japonais/etsu-pacific-ocean-water/$q$, $q$producer$q$),
($q$Fords Gin$q$, $q$Ford's London Dry Gin$q$, $q$London Dry Gin$q$, $q$Fords Gin$q$, 45, NULL, NULL, $q$https://www.fordsgin.com/explore$q$, $q$producer$q$),
($q$Four Pillars Bloody Shiraz Gin$q$, $q$Four Pillars Bloody Shiraz Gin$q$, $q$Flavoured Gin$q$, $q$Four Pillars$q$, NULL, NULL, NULL, $q$https://fourpillarsgin.com/products/bloody-shiraz-gin$q$, $q$producer$q$),
($q$Four Pillars Fresh Yuzu Gin$q$, $q$Four Pillars Fresh Yuzu Gin$q$, $q$Flavoured Gin$q$, $q$Four Pillars$q$, NULL, NULL, NULL, $q$https://fourpillarsgin.com/products/fresh-yuzu-gin$q$, $q$producer$q$),
($q$Four Pillars Modern Australian Gin$q$, NULL, $q$Gin$q$, $q$Four Pillars$q$, NULL, NULL, NULL, $q$https://fourpillarsgin.com/products/modern-australian-gin$q$, $q$producer$q$),
($q$Four Pillars Navy Strength Gin$q$, $q$Four Pillars Navy Strength Gin$q$, $q$Navy Strength Gin$q$, $q$Four Pillars$q$, NULL, NULL, NULL, $q$https://fourpillarsgin.com/products/navy-strength-gin$q$, $q$producer$q$),
($q$Four Pillars Spiced Negroni Gin$q$, $q$Four Pillars Spiced Negroni Gin$q$, $q$Gin$q$, $q$Four Pillars$q$, NULL, NULL, NULL, $q$https://fourpillarsgin.com/products/spiced-negroni-gin$q$, $q$producer$q$),
($q$Foxdenton 48$q$, NULL, $q$London Dry Gin$q$, $q$Foxdenton Estate$q$, 48, NULL, NULL, $q$https://foxdentonestate.co.uk/shop/foxdenton48$q$, $q$producer$q$),
($q$Foxdenton English Garden Gin$q$, NULL, $q$Gin$q$, $q$Foxdenton Estate$q$, 40, NULL, NULL, $q$https://foxdentonestate.co.uk/shop/english-garden-gin$q$, $q$producer$q$),
($q$Foxdenton Pink Gin$q$, NULL, $q$Pink Gin$q$, $q$Foxdenton Estate$q$, 40, NULL, NULL, $q$https://foxdentonestate.co.uk/shop/pink-gin$q$, $q$producer$q$),
($q$Furneaux Distillery Untamed Gin$q$, $q$Furneaux Untamed Gin$q$, $q$Gin$q$, $q$Furneaux Distillery$q$, NULL, NULL, NULL, $q$https://www.furneauxdistillery.com.au/shop/p/untamed-gin-700ml$q$, $q$producer$q$),
($q$G'Vine Nouaison Gin$q$, $q$Nouaison Gin$q$, $q$Gin$q$, $q$G'Vine$q$, NULL, $q$FR$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/spirits/gin-and-juniper-spirits/BWS000890/gvine-nouaison$q$, $q$reference$q$),
($q$Gin Mare$q$, $q$Gin Mare$q$, $q$Gin$q$, $q$Gin Mare$q$, 42.7, $q$ES$q$, NULL, $q$https://www.ginmare.com/product/$q$, $q$producer$q$),
($q$Gin Mare Capri$q$, NULL, $q$Gin$q$, $q$Gin Mare$q$, 42.7, $q$ES$q$, NULL, $q$https://www.ginmare.com/product/#CAPRI$q$, $q$producer$q$),
($q$Ginebra San Miguel$q$, $q$Ginebra San Miguel$q$, $q$Gin$q$, $q$Ginebra San Miguel$q$, NULL, NULL, NULL, $q$https://www.ginebrasanmiguel.com/our-brands-red$q$, $q$producer$q$),
($q$Glendalough Wild Rose Irish Gin$q$, NULL, $q$Pink Gin$q$, $q$Glendalough Distillery$q$, NULL, $q$IE$q$, NULL, $q$https://www.glendaloughdistillery.com/products/wild-rose-gin$q$, $q$producer$q$),
($q$Gordon's London Dry Gin$q$, $q$Gordon's London Dry Gin$q$, $q$London Dry Gin$q$, $q$Gordon's$q$, 37.5, NULL, NULL, $q$https://www.thebar.com/en/products/gordons-london-dry-gin-70cl$q$, $q$producer$q$),
($q$Gordon's Mediterranean Orange Distilled Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Gordon's$q$, NULL, NULL, NULL, $q$https://www.thebar.com/en/products/gordon-s-mediterranean-orange-distilled-gin-70cl$q$, $q$producer$q$),
($q$Gordon's Morello Cherry Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Gordon's$q$, 37.5, NULL, NULL, $q$https://www.thebar.com/en/products/gordons-morello-cherry-gin-70cl$q$, $q$producer$q$),
($q$Gordon's Sicilian Lemon Distilled Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Gordon's$q$, 37.5, NULL, NULL, $q$https://www.thebar.com/en/products/gordons-sicilian-lemon-distilled-gin-70cl$q$, $q$producer$q$),
($q$Gordon's Tropical Passionfruit Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Gordon's$q$, 37.5, NULL, NULL, $q$https://www.thebar.com/en/products/gordons-tropical-passionfruit-gin-70cl$q$, $q$producer$q$),
($q$Greenall's Blueberry Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Greenall's$q$, 37.5, $q$GB$q$, NULL, $q$https://www.greenallsgin.com/greenalls-gin-range/blueberry-gin/$q$, $q$producer$q$),
($q$Greenall's Original London Dry Gin$q$, $q$Greenall's Original London Dry Gin$q$, $q$London Dry Gin$q$, $q$Greenall's$q$, 37.5, $q$GB$q$, NULL, $q$https://www.greenallsgin.com/greenalls-gin-range/london-dry-gin/$q$, $q$producer$q$),
($q$Greenall's Wild Berry Pink Gin$q$, NULL, $q$Pink Gin$q$, $q$Greenall's$q$, 37.5, $q$GB$q$, NULL, $q$https://www.greenallsgin.com/greenalls-gin-range/wild-berry-pink-gin/$q$, $q$producer$q$),
($q$Griffo Scott Street Gin$q$, $q$Griffo Gin$q$, $q$Gin$q$, $q$Griffo Distillery$q$, 46, $q$US$q$, NULL, $q$https://www.drinkhacker.com/2026/06/18/review-spirits-of-griffo-distillery-updated-2026/$q$, $q$reference$q$),
($q$Hammer & Son Old English Gin$q$, $q$Hammer & Son Old English Gin$q$, $q$Old Tom Gin$q$, $q$Hammer & Son$q$, 44, $q$GB$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/2352/hammer-and-son-old-english-gin$q$, $q$reference$q$),
($q$Hayman's Gently Rested Gin$q$, NULL, $q$Aged Gin$q$, $q$Hayman's$q$, 41.3, $q$GB$q$, NULL, $q$https://www.haymansgin.com/product/gently-rested/$q$, $q$producer$q$),
($q$Hayman's Old Tom Gin$q$, $q$Hayman's Old Tom Gin$q$, $q$Old Tom Gin$q$, $q$Hayman's$q$, 41.4, $q$GB$q$, NULL, $q$https://www.haymansgin.com/product/old-tom-gin/$q$, $q$producer$q$),
($q$Hayman's Royal Dock Navy Strength Gin$q$, $q$Hayman's Royal Dock Navy Strength Gin$q$, $q$Navy Strength Gin$q$, $q$Hayman's$q$, 57, $q$GB$q$, NULL, $q$https://www.haymansgin.com/product/royal-dock/$q$, $q$producer$q$),
($q$Hayman's Small Gin$q$, NULL, $q$Gin$q$, $q$Hayman's$q$, 43, $q$GB$q$, NULL, $q$https://www.haymansgin.com/product/small-gin/$q$, $q$producer$q$),
($q$Hayman's Vibrant Citrus Gin$q$, $q$Hayman's Citrus Gin$q$, $q$Flavoured Gin$q$, $q$Hayman's$q$, 41.1, $q$GB$q$, NULL, $q$https://www.haymansgin.com/product/vibrant-citrus-gin/$q$, $q$producer$q$),
($q$Hendrick's Gin$q$, $q$Hendrick's Gin$q$, $q$Gin$q$, $q$Hendrick's$q$, 41.4, $q$GB$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/27/hendricks-gin$q$, $q$reference$q$),
($q$Hensol Castle Welsh Dry Gin$q$, $q$Hensol Castle Gin$q$, $q$Gin$q$, $q$Hensol Castle Distillery$q$, 41, $q$GB$q$, NULL, $q$https://www.hensolcastledistillery.com/product/hensol-castle-welsh-dry-gin/$q$, $q$producer$q$),
($q$Junipero Gin$q$, $q$Junipero Gin$q$, $q$Gin$q$, $q$Hotaling & Co.$q$, 49.3, $q$US$q$, NULL, $q$https://www.hotalingandco.com/portfolio/junipero-gin/junipero-gin$q$, $q$producer$q$),
($q$Junipero Gin Smoked Rosemary$q$, NULL, $q$Flavoured Gin$q$, $q$Hotaling & Co.$q$, 49.3, $q$US$q$, NULL, $q$https://www.hotalingandco.com/portfolio/junipero-gin/junipero-gin-smoked-rosemary$q$, $q$producer$q$),
($q$Ink Gin$q$, $q$Husk Ink Gin$q$, $q$Gin$q$, $q$Husk Distillers$q$, 40, $q$AU$q$, NULL, $q$https://www.huskdistillers.com/shop/ink-gin$q$, $q$producer$q$),
($q$Iron Balls Gin$q$, $q$Iron Balls Gin$q$, $q$Gin$q$, $q$Iron Balls$q$, 40, $q$TH$q$, NULL, $q$https://www.theginguild.com/ginopedia/gin-brands/iron-balls-gin/$q$, $q$reference$q$),
($q$Isle of Harris Gin$q$, $q$Isle of Harris Gin$q$, $q$Gin$q$, $q$Isle of Harris Distillers$q$, 45, $q$GB$q$, NULL, $q$https://www.lcbo.com/en/isle-of-harris-gin-16100$q$, $q$retailer$q$),
($q$Rieger's Midwestern Dry Gin$q$, $q$J. Rieger Gin$q$, $q$London Dry Gin$q$, $q$J. Rieger & Co.$q$, 46.1, $q$US$q$, NULL, $q$https://www.jriegerco.com/our-spirits/midwestern-dry-gin$q$, $q$producer$q$),
($q$Jaisalmer Gold Edition Gin$q$, NULL, $q$Gin$q$, $q$Jaisalmer$q$, 43, $q$IN$q$, NULL, $q$https://www.theginguide.com/jaisalmer-gin.html$q$, $q$reference$q$),
($q$Jaisalmer Indian Craft Gin$q$, $q$Jaisalmer Indian Craft Gin$q$, $q$Gin$q$, $q$Jaisalmer$q$, 43, $q$IN$q$, NULL, $q$https://www.theginguide.com/jaisalmer-gin.html$q$, $q$reference$q$),
($q$KOVAL Barreled Gin$q$, NULL, $q$Aged Gin$q$, $q$KOVAL$q$, 47, $q$US$q$, NULL, $q$https://www.koval-distillery.com/gin/barreled-gin$q$, $q$producer$q$),
($q$KOVAL Dry Gin$q$, $q$Koval Gin$q$, $q$Gin$q$, $q$KOVAL$q$, 47, $q$US$q$, NULL, $q$https://www.koval-distillery.com/gin/dry-gin$q$, $q$producer$q$),
($q$Thresh & Winnow Citrine Gin$q$, NULL, $q$Gin$q$, $q$KOVAL$q$, 45, $q$US$q$, NULL, $q$https://www.koval-distillery.com/gin/dry-gin$q$, $q$producer$q$),
($q$Thresh & Winnow Forêt Gin$q$, NULL, $q$Gin$q$, $q$KOVAL$q$, 45, $q$US$q$, NULL, $q$https://www.koval-distillery.com/gin/dry-gin$q$, $q$producer$q$),
($q$Gin Katún$q$, $q$Gin Katún$q$, $q$Gin$q$, $q$Katún$q$, 42, $q$MX$q$, NULL, $q$https://mexiconewsdaily.com/lifestyle/food/the-names-ginebra-ginebra-mexicana-mexican-flavors-from-martini-to-gt/$q$, $q$reference$q$),
($q$Komasa Gin Sakurajima Komikan$q$, $q$Komasa Gin$q$, $q$Flavoured Gin$q$, $q$Komasa Jyozo$q$, 45, $q$JP$q$, NULL, $q$https://www.skurnik.com/sku/satsuma-gin-japanese-tangerine-komasa-gin$q$, $q$retailer$q$),
($q$Armónico Gin$q$, $q$Armónico Gin$q$, $q$Gin$q$, $q$La Insoportable Cervecería y Destilería$q$, 50, NULL, NULL, $q$https://www.skurnik.com/sku/gin-armonico-strapped/$q$, $q$reference$q$),
($q$Le Tribute Gin$q$, $q$Le Tribute Gin$q$, $q$Gin$q$, $q$Le Tribute$q$, 43, $q$ES$q$, NULL, $q$https://www.dmvini.ch/en/le-tribute-gin_79101700$q$, $q$retailer$q$),
($q$Leopold Bros Gin No. 25$q$, NULL, $q$Gin$q$, $q$Leopold Bros.$q$, NULL, $q$US$q$, NULL, $q$https://www.leopoldbros.com/spirits$q$, $q$producer$q$),
($q$Leopold Bros Summer Gin$q$, NULL, $q$Gin$q$, $q$Leopold Bros.$q$, NULL, $q$US$q$, NULL, $q$https://www.leopoldbros.com/spirits$q$, $q$producer$q$),
($q$Leopold's American Small Batch Gin$q$, NULL, $q$Gin$q$, $q$Leopold Bros.$q$, 40, $q$US$q$, NULL, $q$https://www.leopoldbros.com/s/Gin-Tech-Sheets.pdf$q$, $q$producer$q$),
($q$Leopold's Navy Strength American Gin$q$, $q$Leopold's Navy Strength American Gin$q$, $q$Navy Strength Gin$q$, $q$Leopold Bros.$q$, 57, $q$US$q$, NULL, $q$https://www.leopoldbros.com/s/Navy-Gin-Tech-Sheets.pdf$q$, $q$producer$q$),
($q$Long Table Barrel Aged Gin$q$, NULL, $q$Aged Gin$q$, $q$Long Table Distillery$q$, NULL, $q$CA$q$, NULL, $q$https://www.bcliquorstores.com/product/674929$q$, $q$retailer$q$),
($q$Long Table London Dry Gin$q$, NULL, $q$London Dry Gin$q$, $q$Long Table Distillery$q$, NULL, $q$CA$q$, NULL, $q$https://www.bcliquorstores.com/product/31161$q$, $q$retailer$q$),
($q$Malfy Gin Con Limone$q$, $q$Malfy Gin Con Limone$q$, $q$Flavoured Gin$q$, $q$Malfy$q$, 41, $q$IT$q$, NULL, $q$https://www.pernod-ricard.com/en/brands/malfy$q$, $q$producer$q$),
($q$Malfy Gin Originale$q$, $q$Malfy Gin Originale$q$, $q$Gin$q$, $q$Malfy$q$, 41, $q$IT$q$, NULL, $q$https://www.pernod-ricard.com/en/brands/malfy$q$, $q$producer$q$),
($q$Manly Spirits 'The Beaches' Gin$q$, NULL, $q$Gin$q$, $q$Manly Spirits Co.$q$, NULL, $q$AU$q$, NULL, $q$https://manlyspirits.com.au/collections/gin/products/the-beaches-gin$q$, $q$producer$q$),
($q$Manly Spirits Australian Dry Gin$q$, $q$Manly Spirits Australian Dry Gin$q$, $q$Gin$q$, $q$Manly Spirits Co.$q$, 43, $q$AU$q$, NULL, $q$https://manlyspirits.com.au/collections/gin/products/australian-dry-gin$q$, $q$producer$q$),
($q$Manly Spirits Coastal Citrus Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Manly Spirits Co.$q$, NULL, $q$AU$q$, NULL, $q$https://manlyspirits.com.au/collections/gin/products/coastal-citrus-gin$q$, $q$producer$q$),
($q$Manly Spirits Lilly Pilly Pink Gin$q$, NULL, $q$Pink Gin$q$, $q$Manly Spirits Co.$q$, 40, $q$AU$q$, NULL, $q$https://manlyspirits.com.au/collections/gin/products/lilly-pilly-pink-gin$q$, $q$producer$q$),
($q$Manly Spirits North Head Navy Strength Gin$q$, NULL, $q$Navy Strength Gin$q$, $q$Manly Spirits Co.$q$, NULL, $q$AU$q$, NULL, $q$https://manlyspirits.com.au/collections/gin/products/north-head-dry-gin-navy-strength$q$, $q$producer$q$),
($q$Martin Miller's 9 Moons Gin$q$, NULL, $q$Aged Gin$q$, $q$Martin Miller's$q$, NULL, $q$GB$q$, NULL, $q$https://martinmillersgin.com/our-range/$q$, $q$producer$q$),
($q$Martin Miller's Original Gin$q$, $q$Martin Miller's Gin$q$, $q$Gin$q$, $q$Martin Miller's$q$, 40, $q$GB$q$, NULL, $q$https://martinmillersgin.com/our-range/$q$, $q$producer$q$),
($q$Martin Miller's Summerful Gin$q$, NULL, $q$Gin$q$, $q$Martin Miller's$q$, 40, $q$GB$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/7513/martin-millers-summerful-gin$q$, $q$reference$q$),
($q$Martin Miller's Westbourne Strength Gin$q$, $q$Martin Miller's Westbourne Strength Gin$q$, $q$Gin$q$, $q$Martin Miller's$q$, 45.2, $q$GB$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/224/martin-millers-westbourne-strength$q$, $q$reference$q$),
($q$Martin Miller's Winterful Gin$q$, NULL, $q$Gin$q$, $q$Martin Miller's$q$, NULL, $q$GB$q$, NULL, $q$https://martinmillersgin.com/our-range/$q$, $q$producer$q$),
($q$Matsui The Hakuto Premium Gin$q$, NULL, $q$Gin$q$, $q$Matsui$q$, NULL, $q$JP$q$, NULL, $q$https://www.bcliquorstores.com/product/93258$q$, $q$retailer$q$),
($q$Moletto Tomato Gin$q$, $q$Moletto Tomato Gin$q$, $q$Flavoured Gin$q$, $q$Moletto$q$, 43, $q$IT$q$, NULL, $q$https://www.lairdandcompany.com/products/moletto-gin$q$, $q$retailer$q$),
($q$Monkey 47 Schwarzwald Dry Gin$q$, $q$Monkey 47 Schwarzwald Dry Gin$q$, $q$Gin$q$, $q$Monkey 47$q$, 47, $q$DE$q$, NULL, $q$https://www.lcbo.com/en/monkey-47-schwarzwald-dry-gin-11285$q$, $q$retailer$q$),
($q$Hepple Gin$q$, $q$Hepple Gin$q$, $q$Gin$q$, $q$Moorland Spirit Co.$q$, 45, $q$GB$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/5183/hepple-gin$q$, $q$reference$q$),
($q$Greater Than London Dry Gin$q$, NULL, $q$London Dry Gin$q$, $q$Nao Spirits$q$, 42.8, $q$IN$q$, NULL, $q$https://www.theginguide.com/hapusa-gin.html$q$, $q$reference$q$),
($q$Hapusa Himalayan Dry Gin$q$, $q$Hapusa Gin$q$, $q$Gin$q$, $q$Nao Spirits$q$, 43, $q$IN$q$, NULL, $q$https://www.theginguide.com/hapusa-gin.html$q$, $q$reference$q$),
($q$Never Never Southern Strength Gin$q$, $q$Never Never Southern Strength Gin$q$, $q$Gin$q$, $q$Never Never Distilling Co.$q$, 52, $q$AU$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/6762/never-never-southern-strength-gin$q$, $q$reference$q$),
($q$Never Never Triple Juniper Gin$q$, $q$Never Never Triple Juniper Gin$q$, $q$Gin$q$, $q$Never Never Distilling Co.$q$, 43, $q$AU$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/6759/never-never-triple-juniper-gin$q$, $q$reference$q$),
($q$Neversink Barrel-Aged Gin Reserve$q$, $q$Neversink Barrel Reserve Gin$q$, $q$Aged Gin$q$, $q$Neversink Spirits$q$, 45, $q$US$q$, NULL, $q$https://skurnik.com/sku/barrel-aged-gin-reserve-neversink$q$, $q$retailer$q$),
($q$Neversink Gin$q$, NULL, $q$Gin$q$, $q$Neversink Spirits$q$, 43, $q$US$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/7481/neversink-gin$q$, $q$reference$q$),
($q$Dorothy Parker New York Gin$q$, NULL, $q$Gin$q$, $q$New York Distilling Company$q$, NULL, $q$US$q$, NULL, $q$https://www.nydistilling.com/spirits$q$, $q$producer$q$),
($q$Dorothy Parker Rose Petal Infused Gin$q$, NULL, $q$Pink Gin$q$, $q$New York Distilling Company$q$, NULL, $q$US$q$, NULL, $q$https://www.nydistilling.com/spirits$q$, $q$producer$q$),
($q$Perry's Tot Navy Strength Gin$q$, $q$Perry's Tot Navy Strength Gin$q$, $q$Navy Strength Gin$q$, $q$New York Distilling Company$q$, 57, $q$US$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/3553/perrys-tot-navy-strength-gin$q$, $q$reference$q$),
($q$Nikka Coffey Gin$q$, $q$Nikka Coffey Gin$q$, $q$Gin$q$, $q$Nikka$q$, 47, $q$JP$q$, NULL, $q$https://nikka.com/en/brands/coffey-gin-vodka/$q$, $q$producer$q$),
($q$No.3 London Dry Gin$q$, $q$No. 3 London Dry Gin$q$, $q$London Dry Gin$q$, $q$No.3 Gin$q$, 46, NULL, NULL, $q$https://no3gin.com/products/no3-gin$q$, $q$producer$q$),
($q$Nolet's Reserve Gin$q$, $q$Nolet's The Reserve Gin$q$, $q$Gin$q$, $q$Nolet's$q$, 52.3, $q$NL$q$, NULL, $q$https://noletsgin.com/nolets-reserve/$q$, $q$producer$q$),
($q$Nolet's Silver Gin$q$, $q$Nolet's Gin$q$, $q$Gin$q$, $q$Nolet's$q$, 47.6, $q$NL$q$, NULL, $q$https://noletsgin.com/$q$, $q$producer$q$),
($q$Nordés Atlantic Galician Gin$q$, $q$Nordés Atlantic Galician Gin$q$, $q$Gin$q$, $q$Nordés$q$, NULL, $q$ES$q$, NULL, $q$https://nordesgin.com/en/descubre-nordes-gin/$q$, $q$producer$q$),
($q$Opihr Arabian Edition$q$, NULL, $q$London Dry Gin$q$, $q$Opihr$q$, NULL, $q$GB$q$, NULL, $q$https://opihr.com/opihr-gin-range/opihr-gin-arabian-edition/$q$, $q$producer$q$),
($q$Opihr European Edition$q$, NULL, $q$London Dry Gin$q$, $q$Opihr$q$, 43, $q$GB$q$, NULL, $q$https://opihr.com/opihr-gin-range/opihr-gin-european-edition/$q$, $q$producer$q$),
($q$Opihr Far East Edition$q$, NULL, $q$London Dry Gin$q$, $q$Opihr$q$, 43, $q$GB$q$, NULL, $q$https://opihr.com/opihr-gin-range/opihr-gin-far-east-edition/$q$, $q$producer$q$),
($q$Opihr Oriental Spiced London Dry Gin$q$, $q$Opihr Oriental Spiced London Dry Gin$q$, $q$London Dry Gin$q$, $q$Opihr$q$, 40, $q$GB$q$, NULL, $q$https://opihr.com/opihr-gin-range/opihr-oriental-spiced-gin/$q$, $q$producer$q$),
($q$Oxley London Dry Gin$q$, $q$Oxley Gin$q$, $q$London Dry Gin$q$, $q$Oxley$q$, 47, $q$GB$q$, NULL, $q$https://www.oxleygin.com/oxley-gin/$q$, $q$producer$q$),
($q$Patient Wolf Melbourne Dry Gin$q$, $q$Patient Wolf Melbourne Dry Gin$q$, $q$Gin$q$, $q$Patient Wolf$q$, NULL, $q$AU$q$, NULL, $q$https://www.patientwolfgin.com/product/melbourne-dry/$q$, $q$producer$q$),
($q$Patient Wolf Pink Lake Gin$q$, NULL, $q$Pink Gin$q$, $q$Patient Wolf$q$, 43, $q$AU$q$, NULL, $q$https://www.patientwolfgin.com/product/plsgin/$q$, $q$producer$q$),
($q$Patient Wolf Summer Thyme Gin$q$, NULL, $q$Gin$q$, $q$Patient Wolf$q$, NULL, $q$AU$q$, NULL, $q$https://www.patientwolfgin.com/product/summer-thyme/$q$, $q$producer$q$),
($q$Peter in Florence London Dry Gin$q$, $q$Peter in Florence Gin$q$, $q$London Dry Gin$q$, $q$Peter in Florence$q$, 43, $q$IT$q$, NULL, $q$https://beerandfoodattractionbbtechexpo.app.swapcard.com/event/beer-and-food-attraction/product/UHJvZHVjdF82NDgxODc=$q$, $q$reference$q$),
($q$Plymouth Gin Navy Strength$q$, $q$Plymouth Navy Strength Gin$q$, $q$Navy Strength Gin$q$, $q$Plymouth Gin$q$, 57, $q$GB$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/198/plymouth-gin-navy-strength$q$, $q$reference$q$),
($q$Plymouth Gin Original Strength$q$, $q$Plymouth Gin$q$, $q$Gin$q$, $q$Plymouth Gin$q$, 41.2, $q$GB$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/199/plymouth-gin-original-strength$q$, $q$reference$q$),
($q$Poor Toms Fool's Cut Gin$q$, NULL, $q$Gin$q$, $q$Poor Toms$q$, 52, $q$AU$q$, NULL, $q$https://www.poortoms.com/$q$, $q$producer$q$),
($q$Poor Toms Strawberry Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Poor Toms$q$, NULL, $q$AU$q$, NULL, $q$https://www.poortoms.com/products/strawberry-gin$q$, $q$producer$q$),
($q$Poor Toms Sydney Dry Gin$q$, $q$Poor Toms Sydney Dry Gin$q$, $q$Gin$q$, $q$Poor Toms$q$, 41.3, $q$AU$q$, NULL, $q$https://www.nicks.com.au/poor-toms-sydney-dry-gin-700ml$q$, $q$retailer$q$),
($q$Porter's Modern Classic Gin$q$, $q$Porter's Gin$q$, $q$Gin$q$, $q$Porter's Gin$q$, 41.5, $q$GB$q$, NULL, $q$https://portersgin.co.uk/our-gins$q$, $q$producer$q$),
($q$Porter's Old Tom Gin$q$, NULL, $q$Old Tom Gin$q$, $q$Porter's Gin$q$, 40, $q$GB$q$, NULL, $q$https://portersgin.co.uk/our-gins$q$, $q$producer$q$),
($q$Porter's Orchard Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Porter's Gin$q$, 40, $q$GB$q$, NULL, $q$https://portersgin.co.uk/our-gins$q$, $q$producer$q$),
($q$Portobello Road Gin London Dry No. 171$q$, $q$Portobello Road London Dry Gin$q$, $q$London Dry Gin$q$, $q$Portobello Road Gin$q$, 42, $q$GB$q$, NULL, $q$https://www.portobelloroadgin.com/products/portobello-road-gin-171$q$, $q$producer$q$),
($q$Procera Blue Dot Gin$q$, $q$Procera Gin$q$, $q$Gin$q$, $q$Procera$q$, NULL, $q$KE$q$, NULL, $q$https://www.zachys.com/products/procera-blue-dot-gin-750ml$q$, $q$retailer$q$),
($q$Príncipe de los Apóstoles Aromatic Dry Rosa Mosqueta$q$, $q$Príncipe De Los Apóstoles Rosa Mosqueta Gin$q$, $q$Flavoured Gin$q$, $q$Príncipe de los Apóstoles$q$, 40, NULL, NULL, $q$https://bottleofitaly.com/en-us/products/gin-aromatic-dry-rosa-mosqueta-70cl-principe-de-los-apostoles$q$, $q$retailer$q$),
($q$Puerto de Indias Blackberry$q$, NULL, $q$Flavoured Gin$q$, $q$Puerto de Indias$q$, 37.5, $q$ES$q$, NULL, $q$https://ginpuertodeindias.com/en/blackberry/$q$, $q$producer$q$),
($q$Puerto de Indias Classic$q$, NULL, $q$Gin$q$, $q$Puerto de Indias$q$, 40, $q$ES$q$, NULL, $q$https://ginpuertodeindias.com/en/classic-gin/$q$, $q$producer$q$),
($q$Puerto de Indias Lemonberry$q$, NULL, $q$Flavoured Gin$q$, $q$Puerto de Indias$q$, 37.5, $q$ES$q$, NULL, $q$https://ginpuertodeindias.com/en/lemonberry$q$, $q$producer$q$),
($q$Puerto de Indias Melon$q$, NULL, $q$Flavoured Gin$q$, $q$Puerto de Indias$q$, 37.5, $q$ES$q$, NULL, $q$https://ginpuertodeindias.com/en/melon$q$, $q$producer$q$),
($q$Puerto de Indias Peach$q$, NULL, $q$Flavoured Gin$q$, $q$Puerto de Indias$q$, 37.5, $q$ES$q$, NULL, $q$https://ginpuertodeindias.com/en/peach/$q$, $q$producer$q$),
($q$Puerto de Indias Pure Black Edition$q$, NULL, $q$Gin$q$, $q$Puerto de Indias$q$, 40, $q$ES$q$, NULL, $q$https://ginpuertodeindias.com/en/pure-black/$q$, $q$producer$q$),
($q$Ransom Old Tom Gin$q$, $q$Ransom Old Tom Gin$q$, $q$Old Tom Gin$q$, $q$Ransom$q$, 44, $q$US$q$, NULL, $q$https://www.nicks.com.au/ransom-old-tom-gin-750ml$q$, $q$retailer$q$),
($q$Reisetbauer Blue Gin$q$, NULL, $q$Gin$q$, $q$Reisetbauer$q$, NULL, $q$AT$q$, NULL, $q$https://www.bluegin.cc/$q$, $q$producer$q$),
($q$Reisetbauer Matured Blue Gin$q$, NULL, $q$Aged Gin$q$, $q$Reisetbauer$q$, 51, $q$AT$q$, NULL, $q$https://www.bluegin.cc/$q$, $q$producer$q$),
($q$Renais Gin$q$, $q$Renais Gin$q$, $q$Gin$q$, $q$Renais$q$, 40, NULL, NULL, $q$https://www.thecaterer.com/products/emma-watson-launches-gin-renais-may$q$, $q$reference$q$),
($q$Roku Japanese Craft Gin$q$, $q$Roku Gin$q$, $q$Gin$q$, $q$Roku$q$, NULL, $q$JP$q$, NULL, $q$https://house.suntory.com/roku-gin/roku-craft-gin$q$, $q$producer$q$),
($q$Roku Sakura Bloom Edition$q$, $q$Roku Sakura Bloom Gin$q$, $q$Gin$q$, $q$Roku$q$, NULL, $q$JP$q$, NULL, $q$https://house.suntory.com/roku-gin/sakura-bloom-edition$q$, $q$producer$q$),
($q$Sabatini Gin Barrel$q$, NULL, $q$Aged Gin$q$, $q$Sabatini Gin$q$, NULL, NULL, NULL, $q$https://www.sabatinigin.com/sabatini-gin-barrel/$q$, $q$producer$q$),
($q$Sabatini Gin Venezuela$q$, NULL, $q$Flavoured Gin$q$, $q$Sabatini Gin$q$, NULL, NULL, NULL, $q$https://www.sabatinigin.com/sabatini-gin-venezuela/$q$, $q$producer$q$),
($q$Sabatini London Dry Gin$q$, $q$Sabatini Gin$q$, $q$London Dry Gin$q$, $q$Sabatini Gin$q$, NULL, NULL, NULL, $q$https://www.sabatinigin.com/$q$, $q$producer$q$),
($q$Saigon Baigur Premium Dry Gin$q$, NULL, $q$Gin$q$, $q$Saigon Baigur$q$, NULL, $q$VN$q$, NULL, $q$https://www.saigonbaigur.com/$q$, $q$producer$q$),
($q$Sakurao Gin Limited$q$, $q$Sakurao Gin Limited$q$, $q$Gin$q$, $q$Sakurao Distillery$q$, 47, $q$JP$q$, NULL, $q$https://www.nicks.com.au/sakurao-japanese-dry-gin-700ml$q$, $q$retailer$q$),
($q$Sakurao Gin Original$q$, $q$Sakurao Gin Original$q$, $q$Gin$q$, $q$Sakurao Distillery$q$, 47, $q$JP$q$, NULL, $q$https://closdesspiritueux.com/29638-clos-des-millesimes-sakurao---gin-japonais---original---47.html$q$, $q$retailer$q$),
($q$Saneha Gin$q$, $q$Saneha Gin$q$, $q$Gin$q$, $q$Saneha$q$, 40, $q$TH$q$, NULL, $q$https://www.rhumattitude.com/en/cave/saneha-40/$q$, $q$retailer$q$),
($q$Sapling Climate Positive London Dry Gin$q$, $q$Sapling Climate Positive Gin$q$, $q$London Dry Gin$q$, $q$Sapling$q$, 40, $q$GB$q$, NULL, $q$https://www.abelandcole.co.uk/climate-positive-dry-gin-sapling$q$, $q$retailer$q$),
($q$Seagram's Extra Dry Gin$q$, $q$Seagram's Extra Dry Gin$q$, $q$Gin$q$, $q$Seagram's$q$, 40, $q$US$q$, NULL, $q$https://www.seagramsgin.com/flavored-gins/$q$, $q$producer$q$),
($q$Sheringham Beacon Gin$q$, NULL, $q$Gin$q$, $q$Sheringham Distillery$q$, 43, $q$CA$q$, NULL, $q$https://www.sheringhamdistillery.com/beacon-gin/$q$, $q$producer$q$),
($q$Sheringham London Dry Gin$q$, NULL, $q$London Dry Gin$q$, $q$Sheringham Distillery$q$, 43, $q$CA$q$, NULL, $q$https://www.sheringhamdistillery.com/london-dry-gin/$q$, $q$producer$q$),
($q$Sheringham Raincoast Gin$q$, NULL, $q$Gin$q$, $q$Sheringham Distillery$q$, 43, $q$CA$q$, NULL, $q$https://sheringhamdistillery.com/raincoast-gin$q$, $q$producer$q$),
($q$Sheringham Seaside Gin$q$, NULL, $q$Gin$q$, $q$Sheringham Distillery$q$, 43, $q$CA$q$, NULL, $q$https://www.sheringhamdistillery.com/seaside-gin/$q$, $q$producer$q$),
($q$Silent Pool Gin$q$, $q$Silent Pool Gin$q$, $q$Gin$q$, $q$Silent Pool$q$, 43, $q$GB$q$, NULL, $q$https://silentpooldistillers.com/products/silent-pool-gin-uk-70cl-43-abv$q$, $q$producer$q$),
($q$Silent Pool Rare Citrus Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Silent Pool$q$, 43, $q$GB$q$, NULL, $q$https://silentpooldistillers.com/products/rare-citrus-gin-uk-70cl-43-abv$q$, $q$producer$q$),
($q$Silent Pool Rose Expression Gin$q$, NULL, $q$Pink Gin$q$, $q$Silent Pool$q$, 43, $q$GB$q$, NULL, $q$https://silentpooldistillers.com/products/rose-expression-gin-uk-70cl-43-abv$q$, $q$producer$q$),
($q$Sipsmith Lemon Drizzle Gin$q$, $q$Sipsmith Lemon Drizzle Gin$q$, $q$Flavoured Gin$q$, $q$Sipsmith$q$, 40.4, $q$GB$q$, NULL, $q$https://sipsmith.com/product/lemon-drizzle-gin/$q$, $q$producer$q$),
($q$Sipsmith London Dry Gin$q$, $q$Sipsmith London Dry Gin$q$, $q$London Dry Gin$q$, $q$Sipsmith$q$, 41.6, $q$GB$q$, NULL, $q$https://sipsmith.com/product/london-dry-gin/$q$, $q$producer$q$),
($q$Sipsmith Strawberry Smash Gin$q$, $q$Sipsmith Strawberry Smash Gin$q$, $q$Flavoured Gin$q$, $q$Sipsmith$q$, NULL, $q$GB$q$, NULL, $q$https://sipsmith.com/our-spirits/$q$, $q$producer$q$),
($q$Sipsmith V.J.O.P. Gin$q$, $q$Sipsmith VJOP Gin$q$, $q$Navy Strength Gin$q$, $q$Sipsmith$q$, 57.7, $q$GB$q$, NULL, $q$https://sipsmith.com/product/v-j-o-p/$q$, $q$producer$q$),
($q$Sipsmith Zesty Orange Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Sipsmith$q$, 40, $q$GB$q$, NULL, $q$https://sipsmith.com/product/zesty-orange-gin/$q$, $q$producer$q$),
($q$Sorgin Gin$q$, NULL, $q$Gin$q$, $q$Sorgin$q$, 43, $q$FR$q$, NULL, $q$https://sorgin.fr/$q$, $q$producer$q$),
($q$Spring44 Gin$q$, NULL, $q$Gin$q$, $q$Spring44$q$, 44, NULL, NULL, $q$https://www.spring44.com/spirits$q$, $q$producer$q$),
($q$Spring44 Mountain Gin$q$, NULL, $q$Gin$q$, $q$Spring44$q$, 44, NULL, NULL, $q$https://www.spring44.com/spirits$q$, $q$producer$q$),
($q$Spring44 Old Tom Gin$q$, $q$Spring44 Old Tom Gin$q$, $q$Old Tom Gin$q$, $q$Spring44$q$, 44, NULL, NULL, $q$https://www.spring44.com/spirits$q$, $q$producer$q$),
($q$St. George Botanivore Gin$q$, $q$St. George Botanivore Gin$q$, $q$Gin$q$, $q$St. George Spirits$q$, 45, $q$US$q$, NULL, $q$https://stgeorgespirits.com/spirits/botanivore-gin$q$, $q$producer$q$),
($q$St. George Dry Rye Gin$q$, $q$St. George Dry Rye Gin$q$, $q$Gin$q$, $q$St. George Spirits$q$, 45, $q$US$q$, NULL, $q$https://stgeorgespirits.com/spirits/dry-rye-gin$q$, $q$producer$q$),
($q$St. George Dry Rye Reposado Gin$q$, NULL, $q$Aged Gin$q$, $q$St. George Spirits$q$, 49.5, $q$US$q$, NULL, $q$https://stgeorgespirits.com/spirits/dry-rye-reposado-gin$q$, $q$producer$q$),
($q$St. George Terroir Gin$q$, $q$St. George Terroir Gin$q$, $q$Gin$q$, $q$St. George Spirits$q$, 45, $q$US$q$, NULL, $q$https://stgeorgespirits.com/spirits/terroir-gin$q$, $q$producer$q$),
($q$St. George Valley Gin$q$, NULL, $q$Gin$q$, $q$St. George Spirits$q$, 45, $q$US$q$, NULL, $q$https://stgeorgespirits.com/spirits/valley-gin$q$, $q$producer$q$),
($q$Stranger & Sons Gin$q$, $q$Stranger & Sons Gin$q$, $q$Gin$q$, $q$Stranger & Sons$q$, 42.8, $q$IN$q$, NULL, $q$https://www.theginguild.com/ginopedia/gin-brands/stranger-sons-indian-spirited-gin/$q$, $q$reference$q$),
($q$Stray Dog Wild Gin$q$, $q$Stray Dog Gin$q$, $q$Gin$q$, $q$Stray Dog$q$, 43.5, $q$GR$q$, NULL, $q$https://www.skurnik.com/sku/wild-gin-stray-dog/$q$, $q$retailer$q$),
($q$Tanqueray Blackcurrant Royale$q$, NULL, $q$Flavoured Gin$q$, $q$Tanqueray$q$, 41.3, NULL, NULL, $q$https://www.thebar.com/en-gb/shop/tanqueray-blackcurrant-royale-gin-70cl$q$, $q$producer$q$),
($q$Tanqueray London Dry Gin$q$, $q$Tanqueray London Dry Gin$q$, $q$London Dry Gin$q$, $q$Tanqueray$q$, 47.3, NULL, NULL, $q$https://www.thebar.com/en-gb/shop/tanqueray-london-dry-gin-70cl$q$, $q$producer$q$),
($q$Tanqueray No. Ten$q$, $q$Tanqueray No. Ten Gin$q$, $q$Gin$q$, $q$Tanqueray$q$, 47.3, NULL, NULL, $q$https://www.thebar.com/en-gb/shop/tanqueray-no-ten-gin-70cl$q$, $q$producer$q$),
($q$Tanqueray Rangpur Lime$q$, $q$Tanqueray Rangpur Gin$q$, $q$Flavoured Gin$q$, $q$Tanqueray$q$, NULL, NULL, NULL, $q$https://www.tanqueray.com/en-gb/flavours/tanqueray-rangpur-lime$q$, $q$producer$q$),
($q$Tarquin's Cornish Dry Gin$q$, $q$Tarquin's Cornish Dry Gin$q$, $q$London Dry Gin$q$, $q$Tarquin's$q$, 42, $q$GB$q$, NULL, $q$https://www.theginguild.com/ginopedia/gin-brands/tarquins-cornish-dry-gin/$q$, $q$reference$q$),
($q$Tassoni Gin Superfine$q$, $q$Tassoni Gin Superfine$q$, $q$Gin$q$, $q$Tassoni$q$, 43.5, $q$IT$q$, NULL, $q$https://bottleofitaly.com/en-us/products/gin-tassoni-superfine-cl-70$q$, $q$retailer$q$),
($q$Boatyard Double Gin$q$, $q$Boatyard Double Gin$q$, $q$Gin$q$, $q$The Boatyard Distillery$q$, 46, NULL, NULL, $q$https://www.boatyarddistillery.com/range/boatyard-double-gin$q$, $q$producer$q$),
($q$Boatyard Old Tom Gin$q$, NULL, $q$Old Tom Gin$q$, $q$The Boatyard Distillery$q$, 41, NULL, NULL, $q$https://www.boatyarddistillery.com/range/old-tom-gin$q$, $q$producer$q$),
($q$The Botanist Cask Aged Gin$q$, $q$Botanist Aged Gin$q$, $q$Aged Gin$q$, $q$The Botanist$q$, 46, NULL, NULL, $q$https://www.thebotanist.com/products/the-botanist-cask-aged-gin$q$, $q$producer$q$),
($q$The Botanist Cask Rested Gin$q$, $q$The Botanist Rested Gin$q$, $q$Aged Gin$q$, $q$The Botanist$q$, 46, NULL, NULL, $q$https://www.thebotanist.com/products/the-botanist-gin-rested$q$, $q$producer$q$),
($q$The Botanist Distiller's Strength Gin$q$, NULL, $q$Gin$q$, $q$The Botanist$q$, 50, NULL, NULL, $q$https://www.thebotanist.com/products/the-botanist-distillers-strength$q$, $q$producer$q$),
($q$The Botanist Islay Dry Gin$q$, $q$The Botanist Gin$q$, $q$Gin$q$, $q$The Botanist$q$, 46, NULL, NULL, $q$https://www.thebotanist.com/products/the-botanist-islay-dry-gin$q$, $q$producer$q$),
($q$The Gardener Gin$q$, NULL, $q$London Dry Gin$q$, $q$The Gardener$q$, NULL, $q$FR$q$, NULL, $q$https://www.bcliquorstores.com/product/332580$q$, $q$retailer$q$),
($q$Ki No Bi Kyoto Dry Gin$q$, $q$Ki No Bi Kyoto Dry Gin$q$, $q$Gin$q$, $q$The Kyoto Distillery$q$, 45.7, $q$JP$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/6693/ki-no-bi-gin$q$, $q$reference$q$),
($q$Ki No Tea Kyoto Dry Gin$q$, $q$Ki No Tea Gin$q$, $q$Gin$q$, $q$The Kyoto Distillery$q$, 45.1, $q$JP$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/6990/ki-no-tea-gin$q$, $q$reference$q$),
($q$Melbourne Dry Gin$q$, $q$Melbourne Gin Company Dry Gin$q$, $q$Gin$q$, $q$The Melbourne Gin Company$q$, NULL, $q$AU$q$, NULL, $q$https://melbournegincompany.com/product/melbourne-dry-gin/$q$, $q$producer$q$),
($q$Melbourne Gin Company Single Shot Gin$q$, NULL, $q$Gin$q$, $q$The Melbourne Gin Company$q$, NULL, $q$AU$q$, NULL, $q$https://melbournegincompany.com/product/single-shot-gin/$q$, $q$producer$q$),
($q$The West Winds Gin The Broadside$q$, NULL, $q$Navy Strength Gin$q$, $q$The West Winds Gin$q$, 58, $q$AU$q$, NULL, $q$https://www.diffordsguide.com/en-au/beer-wine-spirits/5870/west-winds-the-broadside-gin$q$, $q$reference$q$),
($q$The West Winds Gin The Cutlass$q$, NULL, $q$Gin$q$, $q$The West Winds Gin$q$, 50, $q$AU$q$, NULL, $q$https://www.nicks.com.au/the-west-winds-the-cutlass-gin-700ml$q$, $q$retailer$q$),
($q$The West Winds Gin The Sabre$q$, $q$The West Winds Sabre Gin$q$, $q$Gin$q$, $q$The West Winds Gin$q$, 40, $q$AU$q$, NULL, $q$https://farehamwinecellar.co.uk/?p=43056$q$, $q$retailer$q$),
($q$Uncle Val's Botanical Gin$q$, $q$Uncle Val's Botanical Gin$q$, $q$Gin$q$, $q$Uncle Val's$q$, 45, $q$US$q$, NULL, $q$https://www.diffordsguide.com/en-au/beer-wine-spirits/8462/uncle-vals-botanical-gin$q$, $q$reference$q$),
($q$Uncle Val's Restorative Gin$q$, NULL, $q$Gin$q$, $q$Uncle Val's$q$, NULL, $q$US$q$, NULL, $q$https://www.unclevalsgin.com/spirits/restorative/$q$, $q$producer$q$),
($q$Uncle Val's Zested Gin$q$, NULL, $q$Gin$q$, $q$Uncle Val's$q$, NULL, $q$US$q$, NULL, $q$https://www.unclevalsgin.com/spirits/zested/$q$, $q$producer$q$),
($q$Ungava Canadian Premium Gin$q$, NULL, $q$Gin$q$, $q$Ungava$q$, 43.1, $q$CA$q$, NULL, $q$https://bevindustry.com/articles/87511-ungava-canadian-premium-gin$q$, $q$reference$q$),
($q$Whitley Neill Blood Orange Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Whitley Neill$q$, NULL, NULL, NULL, $q$https://whitleyneill.com/gin/blood-orange-gin/$q$, $q$producer$q$),
($q$Whitley Neill Original London Dry Gin$q$, $q$Whitley Neill Original London Dry Gin$q$, $q$London Dry Gin$q$, $q$Whitley Neill$q$, 43, NULL, NULL, $q$https://theginisin.com/gin-reviews/whitley-neill-gin/$q$, $q$reference$q$),
($q$Whitley Neill Pink Grapefruit Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Whitley Neill$q$, NULL, NULL, NULL, $q$https://whitleyneill.com/gin/pink-grapefruit-gin/$q$, $q$producer$q$),
($q$Whitley Neill Quince Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Whitley Neill$q$, NULL, NULL, NULL, $q$https://whitleyneill.com/gin/quince-gin/$q$, $q$producer$q$),
($q$Whitley Neill Raspberry Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Whitley Neill$q$, NULL, NULL, NULL, $q$https://whitleyneill.com/gin/raspberry-gin/$q$, $q$producer$q$),
($q$Whitley Neill Rhubarb & Ginger Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Whitley Neill$q$, NULL, NULL, NULL, $q$https://whitleyneill.com/gin/rhubarb-and-ginger-gin/$q$, $q$producer$q$),
($q$Saffron Island Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Xoriguer$q$, 38, $q$ES$q$, NULL, $q$https://xoriguer.es/producto/saffron-island-gin-ultra-premium/$q$, $q$producer$q$),
($q$Xoriguer Gin$q$, $q$Xoriguer Gin$q$, $q$Gin$q$, $q$Xoriguer$q$, 38, $q$ES$q$, NULL, $q$https://xoriguer.es/producto/xoriguer-70-cl-2/$q$, $q$producer$q$);

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
    WHEN b.style IN ($q$Gin$q$) AND EXISTS (
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
