-- Beer and cider: every bottle checked on its producer's own page (or,
-- where that page was blocked, a major retailer, importer or Difford's),
-- after 20261011169000. Step 3m of the bottle catalog plan:
-- https://claude.ai/artifact/Vu6seuSNtN42nKYb2nDCVR
--
--   * The core range of every brewery and cidery in our catalog or on
--     BC Liquor's import beer and cider lists.
--   * On a copy of production (2026-10-09, with the loads before this
--     one applied): 181 new bottles, and 14 we had that get their label
--     name (5 renamed, the old name kept as an alias), style, ABV,
--     country, protected name and maker where they were missing or
--     wrong.
--   * Styles: Lager, pilsner, Mexican lager, blond lager, pale ale,
--     IPA, wheat beer, stout (and imperial, milk), porter, sour, ale,
--     Scotch ale, saison, cider, perry, Basque and sparkling cider.
--   * Out of scope: alcohol-free beer and cider, flavoured malt drinks,
--     seltzers and coolers.
--   * Each producer gets an unclaimed maker page (makes: bottles), or a
--     page an earlier load made gains it, and each bottle names it.
--   * Every fact keeps the page it was checked on in item_sources. An
--     ABV read off another page isn't kept, and a review site isn't a
--     source.
--   * An independent second check of 100 random rows found 1 wrong
--     facts in 470 (0.2%). Every correction is taken: Budvar's 4% pale
--     beer is labelled Budvar Výčepní; Tyskie stays out (BC lists only
--     a "tall can").
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
(0, $q$Beer$q$, NULL);

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
($q$40FT$q$, $q$40ft$q$, $q$https://www.40ftbrewery.com$q$, $q$GB$q$, NULL),
($q$Aecht Schlenkerla$q$, $q$aecht.schlenkerla$q$, $q$https://www.schlenkerla.de$q$, $q$DE$q$, NULL),
($q$Alhambra$q$, $q$alhambra$q$, $q$https://www.cervezasalhambra.com$q$, $q$ES$q$, NULL),
($q$Angry Orchard$q$, $q$angry.orchard$q$, $q$https://www.angryorchard.com$q$, $q$US$q$, NULL),
($q$Asahi$q$, $q$asahi$q$, $q$https://www.asahibeer.co.jp$q$, $q$JP$q$, NULL),
($q$Aspall$q$, $q$aspall$q$, $q$https://www.aspall.co.uk$q$, $q$GB$q$, NULL),
($q$Bavaria$q$, $q$bavaria$q$, $q$https://int.bavaria.com$q$, $q$NL$q$, NULL),
($q$Birra Moretti$q$, $q$birra.moretti$q$, $q$https://www.birramoretti.com$q$, NULL, NULL),
($q$Bitburger$q$, $q$bitburger$q$, $q$https://www.bitburger.com$q$, $q$DE$q$, NULL),
($q$Boneyard$q$, $q$boneyard$q$, $q$https://boneyardbeer.com$q$, NULL, NULL),
($q$Budweiser Budvar$q$, $q$budweiser.budvar$q$, $q$https://www.budejovickybudvar.cz$q$, $q$CZ$q$, NULL),
($q$Bumper Crop$q$, $q$bumper.crop$q$, $q$https://www.bumpercropcider.com$q$, $q$CA$q$, NULL),
($q$Carib$q$, $q$carib$q$, $q$https://caribbrewery.com$q$, $q$TT$q$, NULL),
($q$Cass$q$, $q$cass$q$, $q$https://www.cass.co.kr$q$, $q$KR$q$, NULL),
($q$Chimay$q$, $q$chimay$q$, $q$https://chimay.com$q$, $q$BE$q$, NULL),
($q$Cobra$q$, $q$cobra$q$, $q$https://www.cobrabeer.com$q$, NULL, NULL),
($q$Corona$q$, $q$corona$q$, $q$https://www.corona.com$q$, $q$MX$q$, NULL),
($q$DAB$q$, $q$dab$q$, $q$https://www.dab.de$q$, $q$DE$q$, NULL),
($q$Dos Equis$q$, $q$dos.equis$q$, $q$https://www.dosequis.com$q$, $q$MX$q$, NULL),
($q$Estrella Damm$q$, $q$estrella.damm$q$, $q$https://www.estrelladamm.com$q$, $q$ES$q$, NULL),
($q$Früli$q$, $q$fruli$q$, $q$https://www.fruli.be$q$, $q$BE$q$, NULL),
($q$Fuller's$q$, $q$fuller.s$q$, $q$https://www.fullers.co.uk$q$, $q$GB$q$, NULL),
($q$Growers$q$, $q$growers$q$, $q$https://growerscider.com$q$, $q$CA$q$, NULL),
($q$Guinness$q$, $q$guinness$q$, $q$https://www.guinness.com$q$, $q$IE$q$, NULL),
($q$Hacker-Pschorr$q$, $q$hacker.pschorr$q$, $q$https://www.hacker-pschorr.com$q$, $q$DE$q$, NULL),
($q$Heineken$q$, $q$heineken$q$, $q$https://www.heineken.com$q$, NULL, NULL),
($q$Hoegaarden$q$, $q$hoegaarden$q$, $q$https://www.hoegaarden.com$q$, $q$BE$q$, NULL),
($q$Hollandia$q$, $q$hollandia$q$, NULL, $q$NL$q$, NULL),
($q$Innis & Gunn$q$, $q$innis.gunn$q$, $q$https://innisandgunn.com$q$, $q$GB$q$, NULL),
($q$Isastegi$q$, $q$isastegi$q$, $q$https://www.isastegi.com$q$, $q$ES$q$, NULL),
($q$Kilkenny$q$, $q$kilkenny$q$, NULL, $q$IE$q$, NULL),
($q$Kozel$q$, $q$kozel$q$, $q$https://www.velkopopovickykozel.com$q$, $q$CZ$q$, NULL),
($q$Krombacher$q$, $q$krombacher$q$, $q$https://www.krombacher.com$q$, $q$DE$q$, NULL),
($q$Leffe$q$, $q$leffe$q$, $q$https://www.leffe.com/en$q$, $q$BE$q$, NULL),
($q$Lonetree Cider$q$, $q$lonetree.cider$q$, $q$https://www.lonetreecider.com/$q$, $q$CA$q$, NULL),
($q$Lord Nelson Brewery$q$, $q$lord.nelson.brewery$q$, $q$https://www.lordnelsonbrewery.com/$q$, NULL, NULL),
($q$Magners$q$, $q$magners$q$, $q$https://magners.com/uk/$q$, $q$IE$q$, NULL),
($q$Maison Sassy$q$, $q$maison.sassy$q$, $q$https://maison-sassy.com/$q$, $q$FR$q$, NULL),
($q$Modelo$q$, $q$modelo$q$, $q$https://www.modelousa.com/$q$, $q$MX$q$, NULL),
($q$Pacifico$q$, $q$pacifico$q$, $q$https://www.pacificobeer.com/$q$, $q$MX$q$, NULL),
($q$Paulaner$q$, $q$paulaner$q$, $q$https://www.paulaner.com/$q$, $q$DE$q$, NULL),
($q$Peroni$q$, $q$peroni$q$, $q$https://www.peroni.it/$q$, $q$IT$q$, NULL),
($q$Philter Brewing$q$, $q$philter.brewing$q$, $q$https://philterbrewing.com.au/$q$, $q$AU$q$, NULL),
($q$Pilsner Urquell$q$, $q$pilsner.urquell$q$, $q$https://www.pilsnerurquell.com/$q$, $q$CZ$q$, NULL),
($q$Radeberger$q$, $q$radeberger$q$, $q$https://www.radeberger.de/$q$, $q$DE$q$, NULL),
($q$Red Stripe$q$, $q$red.stripe$q$, $q$https://www.redstripebeer.com/$q$, $q$JM$q$, NULL),
($q$Sapporo$q$, $q$sapporo$q$, $q$https://www.sapporobeer.com/$q$, NULL, NULL),
($q$Sea Cider$q$, $q$sea.cider$q$, $q$https://seacider.ca/$q$, $q$CA$q$, NULL),
($q$Singha$q$, $q$singha$q$, $q$https://www.singha.com/$q$, $q$TH$q$, NULL),
($q$St.Bernardus$q$, $q$st.bernardus$q$, $q$https://www.sintbernardus.be/$q$, $q$BE$q$, NULL),
($q$Strongbow$q$, $q$strongbow$q$, $q$https://www.strongbow.com/$q$, NULL, NULL),
($q$Super Bock$q$, $q$super.bock$q$, $q$https://www.superbock.pt/en$q$, $q$PT$q$, NULL),
($q$Tennent's$q$, $q$tennent.s$q$, $q$https://www.tennents.com/uk/$q$, $q$GB$q$, NULL),
($q$Tiger$q$, $q$tiger$q$, $q$https://www.tigerbeer.com/$q$, $q$SG$q$, NULL),
($q$Tsingtao$q$, $q$tsingtao$q$, $q$https://www.tsingtao.com.cn/$q$, $q$CN$q$, NULL),
($q$Urpiner$q$, $q$urpiner$q$, $q$https://www.urpiner.sk/$q$, $q$SK$q$, NULL),
($q$Warsteiner$q$, $q$warsteiner$q$, $q$https://www.warsteiner.de/$q$, $q$DE$q$, NULL),
($q$Westmalle$q$, $q$westmalle$q$, $q$https://www.trappistwestmalle.be/en/$q$, $q$BE$q$, NULL);

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
($q$40FT Disco Pils$q$, $q$40FT Disco Pils$q$, $q$Pilsner$q$, $q$40FT$q$, 4.8, $q$GB$q$, NULL, $q$https://www.eebriatrade.com/products/beer/40ft-brewery/33564-disco-pils$q$, $q$retailer$q$),
($q$Aecht Schlenkerla Erle$q$, NULL, $q$Lager$q$, $q$Aecht Schlenkerla$q$, 4.2, $q$DE$q$, NULL, $q$https://www.schlenkerla.de/rauchbier/sorten/sortene.html$q$, $q$producer$q$),
($q$Aecht Schlenkerla Rauchbier Märzen$q$, NULL, $q$Lager$q$, $q$Aecht Schlenkerla$q$, 5.1, $q$DE$q$, NULL, $q$https://www.schlenkerla.de/rauchbier/sorten/sortene.html$q$, $q$producer$q$),
($q$Aecht Schlenkerla Rauchbier Urbock$q$, NULL, $q$Lager$q$, $q$Aecht Schlenkerla$q$, 6.5, $q$DE$q$, NULL, $q$https://www.schlenkerla.de/rauchbier/sorten/sortene.html$q$, $q$producer$q$),
($q$Aecht Schlenkerla Rauchbier Wheat$q$, NULL, $q$Wheat Beer$q$, $q$Aecht Schlenkerla$q$, 5.2, $q$DE$q$, NULL, $q$https://www.schlenkerla.de/rauchbier/sorten/sortene.html$q$, $q$producer$q$),
($q$Aecht Schlenkerla Weichsel$q$, NULL, $q$Lager$q$, $q$Aecht Schlenkerla$q$, 4.6, $q$DE$q$, NULL, $q$https://www.schlenkerla.de/rauchbier/sorten/sortene.html$q$, $q$producer$q$),
($q$Helles Schlenkerla Lager$q$, NULL, $q$Blond Lager$q$, $q$Aecht Schlenkerla$q$, 4.3, $q$DE$q$, NULL, $q$https://www.schlenkerla.de/rauchbier/sorten/sortene.html$q$, $q$producer$q$),
($q$Alhambra Especial$q$, NULL, $q$Lager$q$, $q$Alhambra$q$, 5.4, $q$ES$q$, NULL, $q$https://www.cervezasalhambra.com/en/nuestras-cervezas/alhambra-especial$q$, $q$producer$q$),
($q$Alhambra Reserva 1925$q$, NULL, $q$Lager$q$, $q$Alhambra$q$, 6.4, $q$ES$q$, NULL, $q$https://www.cervezasalhambra.com/en/nuestras-cervezas/alhambra-reserva-1925$q$, $q$producer$q$),
($q$Alhambra Reserva Roja$q$, NULL, $q$Lager$q$, $q$Alhambra$q$, 7.2, $q$ES$q$, NULL, $q$https://www.cervezasalhambra.com/en/nuestras-cervezas/alhambra-reserva-roja$q$, $q$producer$q$),
($q$Angry Orchard Crisp Apple$q$, $q$Angry Orchard Crisp Apple$q$, $q$Cider$q$, $q$Angry Orchard$q$, 5.0, $q$US$q$, NULL, $q$https://www.angryorchard.com/our-ciders/core-styles/crisp-apple$q$, $q$producer$q$),
($q$Angry Orchard Crisp Imperial$q$, NULL, $q$Cider$q$, $q$Angry Orchard$q$, 8.0, $q$US$q$, NULL, $q$https://www.angryorchard.com/our-ciders/core-styles/crisp-imperial$q$, $q$producer$q$),
($q$Angry Orchard Green Apple$q$, NULL, $q$Cider$q$, $q$Angry Orchard$q$, 5.0, $q$US$q$, NULL, $q$https://www.angryorchard.com/our-ciders/other-styles/green-apple$q$, $q$producer$q$),
($q$Angry Orchard Rosé$q$, NULL, $q$Cider$q$, $q$Angry Orchard$q$, 5.5, $q$US$q$, NULL, $q$https://www.angryorchard.com/our-ciders/other-styles/rose$q$, $q$producer$q$),
($q$Asahi Gold$q$, NULL, $q$Lager$q$, $q$Asahi$q$, 5.5, $q$JP$q$, NULL, $q$https://www.asahibeer.co.jp/products/beer/gold/1EV21.html$q$, $q$producer$q$),
($q$Asahi Nama Beer$q$, NULL, $q$Lager$q$, $q$Asahi$q$, 5, $q$JP$q$, NULL, $q$https://www.asahibeer.co.jp/products/beer/asahinamabeer/1EG05.html$q$, $q$producer$q$),
($q$Asahi Stout$q$, NULL, $q$Stout$q$, $q$Asahi$q$, 8, $q$JP$q$, NULL, $q$https://www.asahibeer.co.jp/products/beer/stout/1F019.html$q$, $q$producer$q$),
($q$Asahi Super Dry$q$, $q$Asahi Super Dry$q$, $q$Lager$q$, $q$Asahi$q$, 5, $q$JP$q$, NULL, $q$https://www.asahibeer.co.jp/products/beer/superdry/1ER42.html$q$, $q$producer$q$),
($q$Asahi Super Dry Dry Crystal$q$, NULL, $q$Lager$q$, $q$Asahi$q$, 3.5, $q$JP$q$, NULL, $q$https://www.asahibeer.co.jp/products/beer/drycrystal/1ES01.html$q$, $q$producer$q$),
($q$Aspall Draught 4.5%$q$, NULL, $q$Cider$q$, $q$Aspall$q$, 4.5, $q$GB$q$, NULL, $q$https://www.molsoncoors.com/brands/our-brands/aspall?region=936$q$, $q$producer$q$),
($q$Aspall Harry Sparrow$q$, NULL, $q$Cider$q$, $q$Aspall$q$, 4.6, $q$GB$q$, NULL, $q$https://www.molsoncoors.com/brands/our-brands/aspall?region=936$q$, $q$producer$q$),
($q$Aspall Imperial$q$, NULL, $q$Cider$q$, $q$Aspall$q$, 8.2, $q$GB$q$, NULL, $q$https://www.molsoncoors.com/brands/our-brands/aspall?region=936$q$, $q$producer$q$),
($q$Aspall Organic$q$, NULL, $q$Cider$q$, $q$Aspall$q$, 6.8, $q$GB$q$, NULL, $q$https://www.molsoncoors.com/brands/our-brands/aspall?region=936$q$, $q$producer$q$),
($q$Aspall Perronelle's Blush$q$, NULL, $q$Cider$q$, $q$Aspall$q$, 4, $q$GB$q$, NULL, $q$https://www.molsoncoors.com/brands/our-brands/aspall?region=936$q$, $q$producer$q$),
($q$Aspall Premier Cru$q$, NULL, $q$Sparkling Cider$q$, $q$Aspall$q$, 6.8, $q$GB$q$, NULL, $q$https://www.molsoncoors.com/brands/our-brands/aspall?region=936$q$, $q$producer$q$),
($q$Bavaria Original Brew$q$, NULL, $q$Lager$q$, $q$Bavaria$q$, 5, $q$NL$q$, NULL, $q$https://www.bcliquorstores.com/product/676437$q$, $q$retailer$q$),
($q$Birra Moretti L'Autentica$q$, NULL, $q$Lager$q$, $q$Birra Moretti$q$, 4.6, NULL, NULL, $q$https://www.birramoretti.com/global/en/our-beers/birra-moretti-l-autentica/$q$, $q$producer$q$),
($q$Bitburger Lager unfiltered, gluten removed$q$, NULL, $q$Lager$q$, $q$Bitburger$q$, 5.1, $q$DE$q$, NULL, $q$https://www.bitburger.com/beers/premium-classics/gluten-removed-lager$q$, $q$producer$q$),
($q$Bitburger Premium Pils$q$, NULL, $q$Pilsner$q$, $q$Bitburger$q$, 4.8, $q$DE$q$, NULL, $q$https://www.bitburger.com/beers/premium-classics/premium-pils$q$, $q$producer$q$),
($q$Boneyard Bone-A-Fide Pale Ale$q$, NULL, $q$Pale Ale$q$, $q$Boneyard$q$, NULL, NULL, NULL, $q$https://boneyardbeer.com/$q$, $q$producer$q$),
($q$Boneyard Hop Venom DIPA$q$, NULL, $q$IPA$q$, $q$Boneyard$q$, NULL, NULL, NULL, $q$https://boneyardbeer.com/$q$, $q$producer$q$),
($q$Boneyard RPM India Pale Ale$q$, NULL, $q$IPA$q$, $q$Boneyard$q$, NULL, NULL, NULL, $q$https://boneyardbeer.com/$q$, $q$producer$q$),
($q$Budvar 33$q$, NULL, $q$Pilsner$q$, $q$Budweiser Budvar$q$, 4.6, $q$CZ$q$, $q$Budějovické pivo$q$, $q$https://www.budejovickybudvar.cz/sortiment/budvar-33-2$q$, $q$producer$q$),
($q$Budvar Výčepní$q$, NULL, $q$Pilsner$q$, $q$Budweiser Budvar$q$, 4, $q$CZ$q$, $q$Budějovické pivo$q$, $q$https://www.budejovickybudvar.cz/sortiment/budweiser-budvar-classic-3$q$, $q$producer$q$),
($q$Budweiser Budvar Dark Lager$q$, NULL, $q$Lager$q$, $q$Budweiser Budvar$q$, 4.7, $q$CZ$q$, $q$Budějovické pivo$q$, $q$https://www.budejovickybudvar.cz/sortiment/budweiser-budvar-dark-lager-3$q$, $q$producer$q$),
($q$Budweiser Budvar Original$q$, NULL, $q$Pilsner$q$, $q$Budweiser Budvar$q$, 5, $q$CZ$q$, $q$Budějovické pivo$q$, $q$https://www.budejovickybudvar.cz/sortiment/budweiser-budvar-original-2$q$, $q$producer$q$),
($q$Bumper Crop Black Cherry$q$, NULL, $q$Cider$q$, $q$Bumper Crop$q$, NULL, $q$CA$q$, NULL, $q$https://www.bumpercropcider.com/hard-ciders$q$, $q$producer$q$),
($q$Bumper Crop Crisp Apple$q$, NULL, $q$Cider$q$, $q$Bumper Crop$q$, NULL, $q$CA$q$, NULL, $q$https://www.bumpercropcider.com/hard-ciders$q$, $q$producer$q$),
($q$Bumper Crop Mountain Pear$q$, NULL, $q$Cider$q$, $q$Bumper Crop$q$, NULL, $q$CA$q$, NULL, $q$https://www.bumpercropcider.com/hard-ciders$q$, $q$producer$q$),
($q$Bumper Crop Orchard Peach$q$, NULL, $q$Cider$q$, $q$Bumper Crop$q$, NULL, $q$CA$q$, NULL, $q$https://www.bumpercropcider.com/hard-ciders$q$, $q$producer$q$),
($q$Bumper Crop Tropical Mango$q$, NULL, $q$Cider$q$, $q$Bumper Crop$q$, NULL, $q$CA$q$, NULL, $q$https://www.bumpercropcider.com/hard-ciders$q$, $q$producer$q$),
($q$Carib Lager$q$, NULL, $q$Lager$q$, $q$Carib$q$, 5.0, $q$TT$q$, NULL, $q$https://caribbrewery.com/brands/$q$, $q$producer$q$),
($q$Carib Pilsner Light$q$, NULL, $q$Pilsner$q$, $q$Carib$q$, 4.0, $q$TT$q$, NULL, $q$https://caribbrewery.com/brands/$q$, $q$producer$q$),
($q$Cass$q$, NULL, $q$Lager$q$, $q$Cass$q$, 4.5, $q$KR$q$, NULL, $q$https://www.bcliquorstores.com/product/156828$q$, $q$retailer$q$),
($q$Chimay Cent Septante-cinq$q$, NULL, $q$Ale$q$, $q$Chimay$q$, 6.5, $q$BE$q$, NULL, $q$https://chimay.com/us/taste-our/beers/$q$, $q$producer$q$),
($q$Chimay Cinq Cents$q$, NULL, $q$Ale$q$, $q$Chimay$q$, 8, $q$BE$q$, NULL, $q$https://chimay.com/us/taste-our/beers/$q$, $q$producer$q$),
($q$Chimay Gold$q$, NULL, $q$Ale$q$, $q$Chimay$q$, 4.8, $q$BE$q$, NULL, $q$https://chimay.com/us/taste-our/beers/$q$, $q$producer$q$),
($q$Chimay Grande Réserve$q$, NULL, $q$Ale$q$, $q$Chimay$q$, 9, $q$BE$q$, NULL, $q$https://chimay.com/us/taste-our/beers/$q$, $q$producer$q$),
($q$Chimay Green$q$, NULL, $q$Ale$q$, $q$Chimay$q$, 10, $q$BE$q$, NULL, $q$https://chimay.com/us/taste-our/beers/$q$, $q$producer$q$),
($q$Chimay Première$q$, NULL, $q$Ale$q$, $q$Chimay$q$, 7, $q$BE$q$, NULL, $q$https://chimay.com/us/taste-our/beers/$q$, $q$producer$q$),
($q$Cobra Malabar$q$, NULL, $q$IPA$q$, $q$Cobra$q$, 4.7, NULL, NULL, $q$https://www.cobrabeer.com/en/our-beer$q$, $q$producer$q$),
($q$Cobra Premium$q$, NULL, $q$Lager$q$, $q$Cobra$q$, 4.5, NULL, NULL, $q$https://www.cobrabeer.com/en/our-beer$q$, $q$producer$q$),
($q$King Cobra$q$, NULL, $q$Lager$q$, $q$Cobra$q$, 5.2, NULL, NULL, $q$https://www.cobrabeer.com/en/our-beer$q$, $q$producer$q$),
($q$Corona Extra$q$, $q$Corona Extra$q$, $q$Mexican Lager$q$, $q$Corona$q$, NULL, $q$MX$q$, NULL, $q$https://www.grupomodelo.com/nuestras-marcas$q$, $q$producer$q$),
($q$Corona Golden$q$, NULL, $q$Mexican Lager$q$, $q$Corona$q$, NULL, $q$MX$q$, NULL, $q$https://www.grupomodelo.com/nuestras-marcas$q$, $q$producer$q$),
($q$Corona Light$q$, NULL, $q$Mexican Lager$q$, $q$Corona$q$, NULL, $q$MX$q$, NULL, $q$https://www.grupomodelo.com/nuestras-marcas$q$, $q$producer$q$),
($q$DAB D-Pils$q$, NULL, $q$Pilsner$q$, $q$DAB$q$, 4.9, $q$DE$q$, NULL, $q$https://www.dab.de/produkte/dab-d-pils/$q$, $q$producer$q$),
($q$DAB Original$q$, NULL, $q$Lager$q$, $q$DAB$q$, 5, $q$DE$q$, NULL, $q$https://www.bcliquorstores.com/product/82345$q$, $q$retailer$q$),
($q$DAB Pilsener$q$, NULL, $q$Pilsner$q$, $q$DAB$q$, 4.8, $q$DE$q$, NULL, $q$https://www.dab.de/produkte/dab-pilsener/$q$, $q$producer$q$),
($q$Dos Equis Ambar Especial$q$, NULL, $q$Mexican Lager$q$, $q$Dos Equis$q$, 4.7, $q$MX$q$, NULL, $q$https://www.dosequis.com/en-us/our-products/dos-equis-ambar-especial/$q$, $q$producer$q$),
($q$Dos Equis Lager Especial$q$, NULL, $q$Mexican Lager$q$, $q$Dos Equis$q$, 4.2, $q$MX$q$, NULL, $q$https://www.dosequis.com/en-us/our-products/dos-equis-lager-especial/$q$, $q$producer$q$),
($q$Estrella Damm$q$, NULL, $q$Lager$q$, $q$Estrella Damm$q$, NULL, $q$ES$q$, NULL, $q$https://www.estrelladamm.com/en/mediterranean-beer$q$, $q$producer$q$),
($q$Früli Strawberry Beer$q$, $q$Früli$q$, $q$Wheat Beer$q$, $q$Früli$q$, 4.1, $q$BE$q$, NULL, $q$https://www.fruli.be/fruli$q$, $q$producer$q$),
($q$Fuller's London Pride$q$, $q$London Pride$q$, $q$Ale$q$, $q$Fuller's$q$, 4.1, $q$GB$q$, NULL, $q$https://www.inn-express.com/ale/fullers-london-pride-cask$q$, $q$retailer$q$),
($q$Growers Bartlett Pear$q$, NULL, $q$Cider$q$, $q$Growers$q$, NULL, $q$CA$q$, NULL, $q$https://growerscider.com/flavours-west/$q$, $q$producer$q$),
($q$Growers Extra Dry Apple$q$, NULL, $q$Cider$q$, $q$Growers$q$, NULL, $q$CA$q$, NULL, $q$https://growerscider.com/flavours-west/$q$, $q$producer$q$),
($q$Growers Harvest Stone Fruit$q$, NULL, $q$Cider$q$, $q$Growers$q$, NULL, $q$CA$q$, NULL, $q$https://growerscider.com/flavours-west/$q$, $q$producer$q$),
($q$Growers Summer Peach$q$, NULL, $q$Cider$q$, $q$Growers$q$, NULL, $q$CA$q$, NULL, $q$https://growerscider.com/flavours-west/$q$, $q$producer$q$),
($q$Growers Tart Granny Smith Apple$q$, NULL, $q$Cider$q$, $q$Growers$q$, NULL, $q$CA$q$, NULL, $q$https://growerscider.com/flavours-west/$q$, $q$producer$q$),
($q$Guinness Draught$q$, NULL, $q$Stout$q$, $q$Guinness$q$, 4.2, $q$IE$q$, NULL, $q$https://www.guinness.com/en-gb/beers/guinness-draught$q$, $q$producer$q$),
($q$Guinness Extra Stout$q$, NULL, $q$Stout$q$, $q$Guinness$q$, 4.2, $q$IE$q$, NULL, $q$https://www.guinness.com/en-gb/beers/guinness-original$q$, $q$producer$q$),
($q$Guinness Foreign Extra Stout$q$, NULL, $q$Stout$q$, $q$Guinness$q$, 7.5, $q$IE$q$, NULL, $q$https://www.guinness.com/en-gb/beers/guinness-foreign-extra-stout$q$, $q$producer$q$),
($q$Guinness West Indies Porter$q$, NULL, $q$Porter$q$, $q$Guinness$q$, 6, $q$IE$q$, NULL, $q$https://www.guinness.com/en-gb/beers/guinness-west-indies-porter$q$, $q$producer$q$),
($q$Hacker-Pschorr Kellerbier$q$, NULL, $q$Lager$q$, $q$Hacker-Pschorr$q$, 5.5, $q$DE$q$, NULL, $q$https://www.hacker-pschorr.com/our-beers/international/kellerbier$q$, $q$producer$q$),
($q$Hacker-Pschorr Münchner Gold$q$, NULL, $q$Lager$q$, $q$Hacker-Pschorr$q$, 5.5, $q$DE$q$, NULL, $q$https://www.hacker-pschorr.com/our-beers/international/munchner-gold$q$, $q$producer$q$),
($q$Hacker-Pschorr Weissbier$q$, NULL, $q$Wheat Beer$q$, $q$Hacker-Pschorr$q$, 5.5, $q$DE$q$, NULL, $q$https://www.hacker-pschorr.com/our-beers/international/weissbier$q$, $q$producer$q$),
($q$Heineken Original$q$, NULL, $q$Lager$q$, $q$Heineken$q$, 5, NULL, NULL, $q$https://www.heineken.com/global/en/our-products/heineken-original/$q$, $q$producer$q$),
($q$Heineken Silver$q$, NULL, $q$Lager$q$, $q$Heineken$q$, 4, NULL, NULL, $q$https://www.heineken.com/ca/en/our-products/heineken-silver/$q$, $q$producer$q$),
($q$Hoegaarden Rosée$q$, NULL, $q$Wheat Beer$q$, $q$Hoegaarden$q$, NULL, $q$BE$q$, NULL, $q$https://www.hoegaarden.com/beer$q$, $q$producer$q$),
($q$Hoegaarden White$q$, $q$Hoegaarden Witbier$q$, $q$Wheat Beer$q$, $q$Hoegaarden$q$, NULL, $q$BE$q$, NULL, $q$https://www.hoegaarden.com/beer$q$, $q$producer$q$),
($q$Hollandia Premium Lager$q$, NULL, $q$Lager$q$, $q$Hollandia$q$, 5, $q$NL$q$, NULL, $q$https://www.bcliquorstores.com/product/392290$q$, $q$retailer$q$),
($q$Innis & Gunn Caribbean Rum Cask$q$, NULL, $q$Ale$q$, $q$Innis & Gunn$q$, 6.8, $q$GB$q$, NULL, $q$https://innisandgunn.com/our-products/$q$, $q$producer$q$),
($q$Innis & Gunn Lager$q$, NULL, $q$Lager$q$, $q$Innis & Gunn$q$, 4.6, $q$GB$q$, NULL, $q$https://innisandgunn.com/our-products/$q$, $q$producer$q$),
($q$Innis & Gunn Session IPA$q$, NULL, $q$IPA$q$, $q$Innis & Gunn$q$, NULL, $q$GB$q$, NULL, $q$https://innisandgunn.com/our-products/$q$, $q$producer$q$),
($q$Innis & Gunn The Original$q$, NULL, $q$Scotch Ale$q$, $q$Innis & Gunn$q$, 6.6, $q$GB$q$, NULL, $q$https://innisandgunn.com/our-products/$q$, $q$producer$q$),
($q$Ossian$q$, NULL, $q$Pale Ale$q$, $q$Innis & Gunn$q$, 4.1, $q$GB$q$, NULL, $q$https://innisandgunn.com/our-products/$q$, $q$producer$q$),
($q$Isastegi Gorenak$q$, NULL, $q$Basque Cider$q$, $q$Isastegi$q$, NULL, $q$ES$q$, NULL, $q$https://www.isastegi.com/denda-isastegi-sagardoa$q$, $q$producer$q$),
($q$Isastegi Premium$q$, NULL, $q$Basque Cider$q$, $q$Isastegi$q$, NULL, $q$ES$q$, NULL, $q$https://www.isastegi.com/denda-isastegi-sagardoa$q$, $q$producer$q$),
($q$Isastegi Sagardo Naturala$q$, $q$Isastegi Sagardo Naturala$q$, $q$Basque Cider$q$, $q$Isastegi$q$, NULL, $q$ES$q$, $q$Euskal Sagardoa$q$, $q$https://www.isastegi.com/isastegi-euskal-sagardo-naturala$q$, $q$producer$q$),
($q$Kilkenny Irish Cream Ale$q$, NULL, $q$Ale$q$, $q$Kilkenny$q$, 4.3, $q$IE$q$, NULL, $q$https://www.bcliquorstores.com/product/793810$q$, $q$retailer$q$),
($q$Kozel Dark$q$, NULL, $q$Lager$q$, $q$Kozel$q$, NULL, $q$CZ$q$, NULL, $q$https://www.velkopopovickykozel.com/$q$, $q$producer$q$),
($q$Kozel Premium$q$, NULL, $q$Lager$q$, $q$Kozel$q$, NULL, $q$CZ$q$, NULL, $q$https://www.velkopopovickykozel.com/$q$, $q$producer$q$),
($q$Krombacher Pils$q$, NULL, $q$Pilsner$q$, $q$Krombacher$q$, 4.8, $q$DE$q$, NULL, $q$https://www.krombacher.com/en/products/krombacher-pils$q$, $q$producer$q$),
($q$Leffe Ambrée$q$, NULL, $q$Ale$q$, $q$Leffe$q$, 6.6, $q$BE$q$, NULL, $q$https://www.leffe.com/beer?name=leffe-ambree$q$, $q$producer$q$),
($q$Leffe Blonde$q$, NULL, $q$Ale$q$, $q$Leffe$q$, 6.6, $q$BE$q$, NULL, $q$https://www.leffe.com/beer?name=leffe-blonde$q$, $q$producer$q$),
($q$Leffe Brune$q$, NULL, $q$Ale$q$, $q$Leffe$q$, 6.5, $q$BE$q$, NULL, $q$https://www.leffe.com/beer?name=leffe-brune$q$, $q$producer$q$),
($q$Leffe Rituel 9°$q$, NULL, $q$Ale$q$, $q$Leffe$q$, 9, $q$BE$q$, NULL, $q$https://www.leffe.com/beer?name=leffe-rituel-9deg$q$, $q$producer$q$),
($q$Leffe Ruby$q$, NULL, $q$Beer$q$, $q$Leffe$q$, 5, $q$BE$q$, NULL, $q$https://www.leffe.com/beer?name=leffe-ruby$q$, $q$producer$q$),
($q$Leffe Triple$q$, NULL, $q$Ale$q$, $q$Leffe$q$, 8.5, $q$BE$q$, NULL, $q$https://www.leffe.com/beer?name=leffe-triple$q$, $q$producer$q$),
($q$Lonetree Apple Black Currant$q$, NULL, $q$Cider$q$, $q$Lonetree Cider$q$, 5.5, $q$CA$q$, NULL, $q$https://www.lonetreecider.com/our-ciders$q$, $q$producer$q$),
($q$Lonetree Apple Ginger Cider$q$, NULL, $q$Cider$q$, $q$Lonetree Cider$q$, 5.5, $q$CA$q$, NULL, $q$https://www.lonetreecider.com/our-ciders$q$, $q$producer$q$),
($q$Lonetree Apple Pear Cider$q$, NULL, $q$Cider$q$, $q$Lonetree Cider$q$, 5.5, $q$CA$q$, NULL, $q$https://www.lonetreecider.com/our-ciders$q$, $q$producer$q$),
($q$Lonetree Apple Rhubarb Cider$q$, NULL, $q$Cider$q$, $q$Lonetree Cider$q$, 5.5, $q$CA$q$, NULL, $q$https://www.lonetreecider.com/our-ciders$q$, $q$producer$q$),
($q$Lonetree Authentic Dry Apple Cider$q$, NULL, $q$Cider$q$, $q$Lonetree Cider$q$, 5.5, $q$CA$q$, NULL, $q$https://www.lonetreecider.com/our-ciders$q$, $q$producer$q$),
($q$Lord Nelson Nelson's Blood$q$, NULL, $q$Beer$q$, $q$Lord Nelson Brewery$q$, NULL, NULL, NULL, $q$https://www.lordnelsonbrewery.com/brewery$q$, $q$producer$q$),
($q$Lord Nelson Quayle Ale$q$, NULL, $q$Ale$q$, $q$Lord Nelson Brewery$q$, NULL, NULL, NULL, $q$https://www.lordnelsonbrewery.com/brewery$q$, $q$producer$q$),
($q$Lord Nelson Smooth Sailing$q$, NULL, $q$Ale$q$, $q$Lord Nelson Brewery$q$, NULL, NULL, NULL, $q$https://www.lordnelsonbrewery.com/brewery$q$, $q$producer$q$),
($q$Lord Nelson Three Sheets$q$, NULL, $q$Pale Ale$q$, $q$Lord Nelson Brewery$q$, NULL, NULL, NULL, $q$https://www.lordnelsonbrewery.com/brewery$q$, $q$producer$q$),
($q$Lord Nelson Trafalgar Pale Ale$q$, NULL, $q$Pale Ale$q$, $q$Lord Nelson Brewery$q$, NULL, NULL, NULL, $q$https://www.lordnelsonbrewery.com/brewery$q$, $q$producer$q$),
($q$Lord Nelson Victory Bitter$q$, NULL, $q$Ale$q$, $q$Lord Nelson Brewery$q$, NULL, NULL, NULL, $q$https://www.lordnelsonbrewery.com/brewery$q$, $q$producer$q$),
($q$Magners Dark Fruit$q$, NULL, $q$Cider$q$, $q$Magners$q$, NULL, $q$IE$q$, NULL, $q$https://magners.com/uk/our-products/dark-fruit/$q$, $q$producer$q$),
($q$Magners Light$q$, NULL, $q$Cider$q$, $q$Magners$q$, NULL, $q$IE$q$, NULL, $q$https://magners.com/uk/our-products/$q$, $q$producer$q$),
($q$Magners Original Irish Cider$q$, $q$Magners Original Irish Cider$q$, $q$Cider$q$, $q$Magners$q$, 4.5, $q$IE$q$, NULL, $q$https://magners.com/uk/our-products/magners-original/$q$, $q$producer$q$),
($q$Sassy Cidre Brut$q$, NULL, $q$Cider$q$, $q$Maison Sassy$q$, NULL, $q$FR$q$, NULL, $q$https://maison-sassy.com/$q$, $q$producer$q$),
($q$Sassy Cidre Rosé$q$, NULL, $q$Cider$q$, $q$Maison Sassy$q$, NULL, $q$FR$q$, NULL, $q$https://maison-sassy.com/$q$, $q$producer$q$),
($q$Sassy Poiré$q$, NULL, $q$Perry$q$, $q$Maison Sassy$q$, NULL, $q$FR$q$, NULL, $q$https://maison-sassy.com/$q$, $q$producer$q$),
($q$Modelo Especial$q$, NULL, $q$Mexican Lager$q$, $q$Modelo$q$, 4.4, $q$MX$q$, NULL, $q$https://www.modelousa.com/products/especial$q$, $q$producer$q$),
($q$Modelo Negra$q$, $q$Negra Modelo$q$, $q$Mexican Lager$q$, $q$Modelo$q$, 5.3, $q$MX$q$, NULL, $q$https://www.bcliquorstores.com/product/120501$q$, $q$retailer$q$),
($q$Modelo Oro$q$, NULL, $q$Mexican Lager$q$, $q$Modelo$q$, NULL, NULL, NULL, $q$https://www.modelousa.com/beers$q$, $q$producer$q$),
($q$Pacifico Clara$q$, $q$Pacifico Clara$q$, $q$Mexican Lager$q$, $q$Pacifico$q$, 4.6, $q$MX$q$, NULL, $q$https://www.bcliquorstores.com/product/262626$q$, $q$retailer$q$),
($q$Paulaner Münchner Hell$q$, NULL, $q$Blond Lager$q$, $q$Paulaner$q$, 4.9, $q$DE$q$, NULL, $q$https://www.paulaner.com/our-products/muenchner-hell$q$, $q$producer$q$),
($q$Paulaner Salvator$q$, NULL, $q$Lager$q$, $q$Paulaner$q$, 7.9, $q$DE$q$, NULL, $q$https://www.paulaner.com/our-products/salvator$q$, $q$producer$q$),
($q$Paulaner Weissbier$q$, NULL, $q$Wheat Beer$q$, $q$Paulaner$q$, 5.5, $q$DE$q$, NULL, $q$https://www.paulaner.com/our-products/weissbier$q$, $q$producer$q$),
($q$Paulaner Weissbier Dunkel$q$, NULL, $q$Wheat Beer$q$, $q$Paulaner$q$, 5.3, $q$DE$q$, NULL, $q$https://www.paulaner.com/our-products/weissbier-dunkel$q$, $q$producer$q$),
($q$Peroni Nastro Azzurro$q$, NULL, $q$Lager$q$, $q$Peroni$q$, 5, $q$IT$q$, NULL, $q$https://www.bcliquorstores.com/product/525188$q$, $q$retailer$q$),
($q$Peroni Nastro Azzurro Stile Capri$q$, NULL, $q$Lager$q$, $q$Peroni$q$, 4.2, $q$IT$q$, NULL, $q$https://www.bcliquorstores.com/product/383094$q$, $q$retailer$q$),
($q$Philter Coldie$q$, NULL, $q$Beer$q$, $q$Philter Brewing$q$, 3.5, $q$AU$q$, NULL, $q$https://philterbrewing.com.au/our-beers$q$, $q$producer$q$),
($q$Philter Eclipse Haze$q$, NULL, $q$IPA$q$, $q$Philter Brewing$q$, 6.3, $q$AU$q$, NULL, $q$https://philterbrewing.com.au/our-beers$q$, $q$producer$q$),
($q$Philter Extra Stout$q$, NULL, $q$Stout$q$, $q$Philter Brewing$q$, 5.0, $q$AU$q$, NULL, $q$https://philterbrewing.com.au/our-beers$q$, $q$producer$q$),
($q$Philter Hazy Pale$q$, NULL, $q$Pale Ale$q$, $q$Philter Brewing$q$, 5.3, $q$AU$q$, NULL, $q$https://philterbrewing.com.au/our-beers$q$, $q$producer$q$),
($q$Philter Henson Park Draught$q$, NULL, $q$Beer$q$, $q$Philter Brewing$q$, 4.5, $q$AU$q$, NULL, $q$https://philterbrewing.com.au/our-beers$q$, $q$producer$q$),
($q$Philter Old Ale$q$, NULL, $q$Ale$q$, $q$Philter Brewing$q$, 4.5, $q$AU$q$, NULL, $q$https://philterbrewing.com.au/our-beers$q$, $q$producer$q$),
($q$Philter Red Session Ale$q$, $q$Philter Red Ale$q$, $q$Ale$q$, $q$Philter Brewing$q$, 4.8, $q$AU$q$, NULL, $q$https://philterbrewing.com.au/our-beers$q$, $q$producer$q$),
($q$Philter Super Cool Lager$q$, NULL, $q$Lager$q$, $q$Philter Brewing$q$, 4.2, $q$AU$q$, NULL, $q$https://philterbrewing.com.au/our-beers$q$, $q$producer$q$),
($q$Philter West Coast IPA$q$, NULL, $q$IPA$q$, $q$Philter Brewing$q$, 6.0, $q$AU$q$, NULL, $q$https://philterbrewing.com.au/our-beers$q$, $q$producer$q$),
($q$Philter XPA$q$, NULL, $q$Pale Ale$q$, $q$Philter Brewing$q$, 4.2, $q$AU$q$, NULL, $q$https://philterbrewing.com.au/our-beers$q$, $q$producer$q$),
($q$Pilsner Urquell$q$, $q$Pilsner Urquell$q$, $q$Pilsner$q$, $q$Pilsner Urquell$q$, 4.4, $q$CZ$q$, NULL, $q$https://www.prazdroj.cz/en/brands/pilsner-urquell$q$, $q$producer$q$),
($q$Radeberger Pilsner$q$, NULL, $q$Pilsner$q$, $q$Radeberger$q$, NULL, $q$DE$q$, NULL, $q$https://www.radeberger.de/biere/pilsner/$q$, $q$producer$q$),
($q$Red Stripe$q$, NULL, $q$Lager$q$, $q$Red Stripe$q$, 4.7, $q$JM$q$, NULL, $q$https://www.bcliquorstores.com/product/178491$q$, $q$retailer$q$),
($q$Sapporo Premium$q$, $q$Sapporo Premium$q$, $q$Lager$q$, $q$Sapporo$q$, 4.9, NULL, NULL, $q$https://www.sapporobeer.com/our-beers/sapporo-premium-beer$q$, $q$producer$q$),
($q$Sapporo Premium Black$q$, NULL, $q$Lager$q$, $q$Sapporo$q$, 5.0, NULL, NULL, $q$https://www.sapporobeer.com/our-beers/sapporo-black-beer$q$, $q$producer$q$),
($q$Sapporo Premium Light$q$, NULL, $q$Lager$q$, $q$Sapporo$q$, 3.5, NULL, NULL, $q$https://www.sapporobeer.com/our-beers/sapporo-premium-light-beer$q$, $q$producer$q$),
($q$Sapporo Reserve$q$, NULL, $q$Lager$q$, $q$Sapporo$q$, 5.0, NULL, NULL, $q$https://www.sapporobeer.com/our-beers/sapporo-reserve-beer$q$, $q$producer$q$),
($q$Sea Cider Birds and the Bees$q$, NULL, $q$Sparkling Cider$q$, $q$Sea Cider$q$, NULL, $q$CA$q$, NULL, $q$https://seacider.ca/collections/all-cider$q$, $q$producer$q$),
($q$Sea Cider Bittersweet$q$, NULL, $q$Sparkling Cider$q$, $q$Sea Cider$q$, NULL, $q$CA$q$, NULL, $q$https://seacider.ca/collections/all-cider$q$, $q$producer$q$),
($q$Sea Cider Bramble Bubbly$q$, NULL, $q$Sparkling Cider$q$, $q$Sea Cider$q$, NULL, $q$CA$q$, NULL, $q$https://seacider.ca/collections/all-cider$q$, $q$producer$q$),
($q$Sea Cider Cherry Lane$q$, NULL, $q$Sparkling Cider$q$, $q$Sea Cider$q$, NULL, $q$CA$q$, NULL, $q$https://seacider.ca/collections/all-cider$q$, $q$producer$q$),
($q$Sea Cider Flagship$q$, NULL, $q$Sparkling Cider$q$, $q$Sea Cider$q$, NULL, $q$CA$q$, NULL, $q$https://seacider.ca/collections/all-cider$q$, $q$producer$q$),
($q$Sea Cider Ginger Perry$q$, NULL, $q$Perry$q$, $q$Sea Cider$q$, NULL, $q$CA$q$, NULL, $q$https://seacider.ca/collections/all-cider$q$, $q$producer$q$),
($q$Sea Cider Kings & Spies$q$, NULL, $q$Sparkling Cider$q$, $q$Sea Cider$q$, NULL, $q$CA$q$, NULL, $q$https://seacider.ca/collections/all-cider$q$, $q$producer$q$),
($q$Sea Cider Perry$q$, NULL, $q$Perry$q$, $q$Sea Cider$q$, NULL, $q$CA$q$, NULL, $q$https://seacider.ca/collections/all-cider$q$, $q$producer$q$),
($q$Sea Cider Pippins$q$, NULL, $q$Sparkling Cider$q$, $q$Sea Cider$q$, NULL, $q$CA$q$, NULL, $q$https://seacider.ca/collections/all-cider$q$, $q$producer$q$),
($q$Sea Cider Platinum$q$, NULL, $q$Sparkling Cider$q$, $q$Sea Cider$q$, NULL, $q$CA$q$, NULL, $q$https://seacider.ca/collections/all-cider$q$, $q$producer$q$),
($q$Sea Cider Ruby Rose$q$, NULL, $q$Sparkling Cider$q$, $q$Sea Cider$q$, NULL, $q$CA$q$, NULL, $q$https://seacider.ca/collections/all-cider$q$, $q$producer$q$),
($q$Sea Cider Rumrunner$q$, NULL, $q$Sparkling Cider$q$, $q$Sea Cider$q$, NULL, $q$CA$q$, NULL, $q$https://seacider.ca/collections/all-cider$q$, $q$producer$q$),
($q$Sea Cider Sassamanash$q$, NULL, $q$Sparkling Cider$q$, $q$Sea Cider$q$, NULL, $q$CA$q$, NULL, $q$https://seacider.ca/collections/all-cider$q$, $q$producer$q$),
($q$Singha Lager$q$, NULL, $q$Lager$q$, $q$Singha$q$, 5, $q$TH$q$, NULL, $q$https://www.bcliquorstores.com/product/676395$q$, $q$retailer$q$),
($q$St.Bernardus Abt 12$q$, NULL, $q$Ale$q$, $q$St.Bernardus$q$, 10, $q$BE$q$, NULL, $q$https://www.sintbernardus.be/en/brewery/our-beers/stbernardus-abt-12-en$q$, $q$producer$q$),
($q$St.Bernardus Extra 4$q$, NULL, $q$Ale$q$, $q$St.Bernardus$q$, 4.8, $q$BE$q$, NULL, $q$https://www.sintbernardus.be/en/brewery/our-beers/stbernardus-extra-4-en$q$, $q$producer$q$),
($q$St.Bernardus Pater 6$q$, NULL, $q$Ale$q$, $q$St.Bernardus$q$, 6.7, $q$BE$q$, NULL, $q$https://www.sintbernardus.be/en/brewery/our-beers/stbernardus-pater-6-en$q$, $q$producer$q$),
($q$St.Bernardus Prior 8$q$, NULL, $q$Ale$q$, $q$St.Bernardus$q$, 8, $q$BE$q$, NULL, $q$https://www.sintbernardus.be/en/brewery/our-beers/stbernardus-prior-8-en$q$, $q$producer$q$),
($q$St.Bernardus Tokyo$q$, NULL, $q$Wheat Beer$q$, $q$St.Bernardus$q$, 6.0, $q$BE$q$, NULL, $q$https://www.sintbernardus.be/en/brewery/our-beers/stbernardus-tokyo-en$q$, $q$producer$q$),
($q$St.Bernardus Tripel$q$, NULL, $q$Ale$q$, $q$St.Bernardus$q$, 8, $q$BE$q$, NULL, $q$https://www.sintbernardus.be/en/brewery/our-beers/stbernardus-tripel-en$q$, $q$producer$q$),
($q$St.Bernardus Wit$q$, NULL, $q$Wheat Beer$q$, $q$St.Bernardus$q$, 5.5, $q$BE$q$, NULL, $q$https://www.sintbernardus.be/en/brewery/our-beers/stbernardus-wit-en$q$, $q$producer$q$),
($q$Watou Tripel$q$, NULL, $q$Ale$q$, $q$St.Bernardus$q$, 7.5, $q$BE$q$, NULL, $q$https://www.sintbernardus.be/en/brewery/our-beers/watou-tripel-en$q$, $q$producer$q$),
($q$Strongbow Dark Fruit$q$, NULL, $q$Cider$q$, $q$Strongbow$q$, 4.5, NULL, NULL, $q$https://www.strongbow.com/global/en/apple-ciders/$q$, $q$producer$q$),
($q$Strongbow Gold Apple$q$, NULL, $q$Cider$q$, $q$Strongbow$q$, 4.5, NULL, NULL, $q$https://www.strongbow.com/global/en/apple-ciders/$q$, $q$producer$q$),
($q$Strongbow Original Dry$q$, NULL, $q$Cider$q$, $q$Strongbow$q$, 5.3, NULL, NULL, $q$https://www.strongbow.com/ca/en/$q$, $q$producer$q$),
($q$Strongbow Red Berries$q$, NULL, $q$Cider$q$, $q$Strongbow$q$, 4.5, NULL, NULL, $q$https://www.strongbow.com/global/en/apple-ciders/$q$, $q$producer$q$),
($q$Super Bock Abadia$q$, NULL, $q$Ale$q$, $q$Super Bock$q$, 6.4, $q$PT$q$, NULL, $q$https://www.superbock.pt/en/our-beers/super-bock-abadia$q$, $q$producer$q$),
($q$Super Bock Coruja$q$, NULL, $q$IPA$q$, $q$Super Bock$q$, 6.0, $q$PT$q$, NULL, $q$https://www.superbock.pt/en/our-beers/super-bock-coruja$q$, $q$producer$q$),
($q$Super Bock Gluten-Free$q$, NULL, $q$Lager$q$, $q$Super Bock$q$, NULL, $q$PT$q$, NULL, $q$https://www.superbock.pt/en/our-beers$q$, $q$producer$q$),
($q$Super Bock Original$q$, NULL, $q$Lager$q$, $q$Super Bock$q$, 5.2, $q$PT$q$, NULL, $q$https://www.superbock.pt/en/our-beers/super-bock-original$q$, $q$producer$q$),
($q$Super Bock Stout$q$, NULL, $q$Stout$q$, $q$Super Bock$q$, 5, $q$PT$q$, NULL, $q$https://www.superbock.pt/en/our-beers/super-bock-stout$q$, $q$producer$q$),
($q$Gluten Free T$q$, NULL, $q$Lager$q$, $q$Tennent's$q$, NULL, $q$GB$q$, NULL, $q$https://www.tennents.com/uk/our-beers$q$, $q$producer$q$),
($q$Tennent's 1885 Lager$q$, NULL, $q$Lager$q$, $q$Tennent's$q$, 5, $q$GB$q$, NULL, $q$https://www.tennents.com/uk/our-beers$q$, $q$producer$q$),
($q$Tennent's Extra$q$, NULL, $q$Lager$q$, $q$Tennent's$q$, 9, $q$GB$q$, NULL, $q$https://www.tennents.com/uk/our-beers$q$, $q$producer$q$),
($q$Tennent's India Pale Ale$q$, NULL, $q$IPA$q$, $q$Tennent's$q$, 6.2, $q$GB$q$, NULL, $q$https://www.tennents.com/uk/our-beers$q$, $q$producer$q$),
($q$Tennent's Lager$q$, NULL, $q$Lager$q$, $q$Tennent's$q$, NULL, $q$GB$q$, NULL, $q$https://www.tennents.com/uk/our-beers$q$, $q$producer$q$),
($q$Tennent's Light$q$, NULL, $q$Lager$q$, $q$Tennent's$q$, 3.4, $q$GB$q$, NULL, $q$https://www.tennents.com/uk/our-beers/tennents-light$q$, $q$producer$q$),
($q$Tennent's Scotch Ale$q$, NULL, $q$Scotch Ale$q$, $q$Tennent's$q$, 9, $q$GB$q$, NULL, $q$https://www.tennents.com/uk/our-beers$q$, $q$producer$q$),
($q$Tiger$q$, NULL, $q$Lager$q$, $q$Tiger$q$, 5, $q$SG$q$, NULL, $q$https://www.bcliquorstores.com/product/537258$q$, $q$retailer$q$),
($q$Tsingtao$q$, NULL, $q$Lager$q$, $q$Tsingtao$q$, 4.5, $q$CN$q$, NULL, $q$https://www.bcliquorstores.com/product/293787$q$, $q$retailer$q$),
($q$Kaprál 11°$q$, NULL, $q$Lager$q$, $q$Urpiner$q$, 4.5, $q$SK$q$, NULL, $q$https://urpiner.eu/produkty/$q$, $q$producer$q$),
($q$Urpiner Classic 10°$q$, NULL, $q$Lager$q$, $q$Urpiner$q$, 4.0, $q$SK$q$, NULL, $q$https://urpiner.eu/produkty/$q$, $q$producer$q$),
($q$Urpiner Dark 11°$q$, NULL, $q$Lager$q$, $q$Urpiner$q$, 4.5, $q$SK$q$, NULL, $q$https://urpiner.eu/produkty/$q$, $q$producer$q$),
($q$Urpiner Exclusive 16°$q$, NULL, $q$Lager$q$, $q$Urpiner$q$, 7.0, $q$SK$q$, NULL, $q$https://urpiner.eu/produkty/$q$, $q$producer$q$),
($q$Urpiner Extra chmelený 14°$q$, NULL, $q$Lager$q$, $q$Urpiner$q$, 6.0, $q$SK$q$, NULL, $q$https://urpiner.eu/produkty/$q$, $q$producer$q$),
($q$Urpiner IPL 13°$q$, NULL, $q$Lager$q$, $q$Urpiner$q$, 5.5, $q$SK$q$, NULL, $q$https://urpiner.eu/produkty/$q$, $q$producer$q$),
($q$Urpiner Premium 12°$q$, NULL, $q$Lager$q$, $q$Urpiner$q$, 5.0, $q$SK$q$, NULL, $q$https://urpiner.eu/produkty/$q$, $q$producer$q$),
($q$Urpín 93 11°$q$, NULL, $q$Pilsner$q$, $q$Urpiner$q$, 4.5, $q$SK$q$, NULL, $q$https://urpiner.eu/produkty/$q$, $q$producer$q$),
($q$Warsteiner Premium Pilsener$q$, NULL, $q$Pilsner$q$, $q$Warsteiner$q$, NULL, $q$DE$q$, NULL, $q$https://www.warsteiner.de/unser-bier/premium-pilsener$q$, $q$producer$q$),
($q$Westmalle Dubbel$q$, NULL, $q$Ale$q$, $q$Westmalle$q$, 7, $q$BE$q$, NULL, $q$https://www.trappistwestmalle.be/en/trappist-beer/westmalle-dubbel/$q$, $q$producer$q$),
($q$Westmalle Extra$q$, NULL, $q$Ale$q$, $q$Westmalle$q$, 4.8, $q$BE$q$, NULL, $q$https://www.trappistwestmalle.be/en/trappist-beer/westmalle-extra/$q$, $q$producer$q$),
($q$Westmalle Tripel$q$, NULL, $q$Ale$q$, $q$Westmalle$q$, 9.5, $q$BE$q$, NULL, $q$https://www.trappistwestmalle.be/en/trappist-beer/westmalle-tripel/$q$, $q$producer$q$);

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
    WHEN b.style IN ($q$Beer$q$, $q$Cider$q$, $q$Lager$q$, $q$Ale$q$) AND EXISTS (
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
