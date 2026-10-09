-- Rum and cachaça: every bottle checked on its producer's own page (or,
-- where that page was blocked, a major retailer, importer or Difford's),
-- after 20261011160500. Step 3d of the bottle catalog plan:
-- https://claude.ai/artifact/Vu6seuSNtN42nKYb2nDCVR
--
--   * The core range of every rum and cachaça house in our catalog or
--     on BC Liquor's list.
--   * On a copy of production (2026-10-09, with the loads before this
--     one applied): 219 new bottles, and 136 we had that get their
--     label name (84 renamed, the old name kept as an alias), style,
--     ABV, country, protected name and maker where they were missing or
--     wrong.
--   * Styles: Rhum agricole blanc and aged, clairin, charanda, Jamaican
--     (plain, aged, overproof), Demerara, navy, blackstrap, overproof,
--     spiced, pineapple and coconut rum (coconut only at 37.5% or
--     more), white, gold, dark and aged rum, and white and aged
--     cachaça. A Jamaican rum at 57% or more files as Overproof
--     Jamaican Rum. New style: Aged Cachaça.
--   * Out of scope: flavoured and coconut rums under 37.5% (liqueurs),
--     rum creams, ready-to-drink cans.
--   * Each producer gets an unclaimed maker page (makes: bottles), or a
--     page an earlier load made gains it, and each bottle names it.
--   * Every fact keeps the page it was checked on in item_sources. An
--     ABV read off another page isn't kept, and a review site isn't a
--     source.
--   * An independent second check of 100 random rows found 8 wrong
--     facts in 498 (1.6%). Every correction is taken: Dictador Platinum
--     is Aged Rum; Duppy Share White is Jamaican Rum; Ron Colón High
--     Proof (55.5%) is Dark Rum; Angostura 1919 and 1824 take their
--     current names (Grand Reserve 1919, Founders Reserve 1824);
--     Hamilton Breezeway Blend; Duppy Share Aged loses its country (a
--     two-country blend) and its vague catalog match. Planteray Cut &
--     Dry Coconut stays out (no page confirms it reaches 37.5%).
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
(0, $q$Rum$q$, NULL),
(1, $q$Cachaça$q$, NULL),
(2, $q$Aged Cachaça$q$, $q$Cachaça$q$),
(3, $q$White Cachaça$q$, $q$Cachaça$q$);

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
($q$Barbados Rum$q$),
($q$Caribbean Rum$q$),
($q$Cuban Rum$q$),
($q$Puerto Rican Rum$q$),
($q$Lucian rum$q$),
($q$Oaxacan Rum$q$),
($q$Barbadian White Rum$q$),
($q$Haitian Rhum$q$),
($q$Martinique Agricole Rum$q$),
($q$VSOP Martinique Rhum$q$),
($q$Gold Jamaican Rum$q$),
($q$Jamaican Black Rum$q$),
($q$Lightly Aged Rum$q$),
($q$Three-Year-Old Rum$q$),
($q$Aged Caribbean Blended Rum$q$),
($q$Light Gold Rum$q$),
($q$Island Spiced Rum$q$),
($q$Cachaça Amburana$q$),
($q$Freijó-Aged Cachaça$q$);

-- ---------------------------------------------------------------------------
-- Maker pages
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE maker_in (name text PRIMARY KEY, handle text NOT NULL, website text, country text, part_of text);
INSERT INTO maker_in VALUES
($q$Angostura$q$, $q$angostura$q$, $q$https://angostura.com$q$, NULL, NULL),
($q$Appleton Estate$q$, $q$appleton.estate$q$, $q$https://www.appletonestate.com$q$, $q$JM$q$, NULL),
($q$Avuá$q$, $q$avua$q$, $q$https://avuacachaca.com.br$q$, $q$BR$q$, NULL),
($q$Bacardí$q$, $q$bacardi$q$, $q$https://www.bacardi.com$q$, NULL, NULL),
($q$Banks$q$, $q$banks$q$, $q$https://www.bacardilimited.com$q$, NULL, NULL),
($q$Barceló$q$, $q$barcelo$q$, $q$https://ronbarcelo.com$q$, $q$DO$q$, NULL),
($q$Black Tot$q$, $q$black.tot$q$, $q$https://www.blacktot.com$q$, NULL, NULL),
($q$Blackwell$q$, $q$blackwell$q$, $q$https://www.blackwellrum.com$q$, $q$JM$q$, NULL),
($q$Blue Chair Bay$q$, $q$blue.chair.bay$q$, $q$https://bluechairbayrum.com$q$, NULL, NULL),
($q$Botran$q$, $q$botran$q$, $q$https://botranrum.com$q$, $q$GT$q$, NULL),
($q$Brugal$q$, $q$brugal$q$, $q$https://www.brugal-rum.com$q$, $q$DO$q$, NULL),
($q$Bumbu$q$, $q$bumbu$q$, $q$https://bumbu.sovereignbrands.com$q$, NULL, NULL),
($q$Cadenhead's$q$, $q$cadenhead.s$q$, $q$https://www.cadenhead.scot$q$, NULL, NULL),
($q$Captain Morgan$q$, $q$captain.morgan$q$, $q$https://www.captainmorgan.com$q$, NULL, NULL),
($q$Chairman's Reserve$q$, $q$chairman.s.reserve$q$, $q$https://www.chairmansreserverum.com$q$, NULL, NULL),
($q$Chalong Bay$q$, $q$chalong.bay$q$, $q$https://www.chalongbayrum.com$q$, $q$TH$q$, NULL),
($q$Clément$q$, $q$clement$q$, $q$https://www.rhum-clement.com$q$, $q$MQ$q$, NULL),
($q$Coruba$q$, $q$coruba$q$, NULL, $q$JM$q$, NULL),
($q$Cruzan$q$, $q$cruzan$q$, $q$https://www.cruzanrum.com$q$, $q$VI$q$, NULL),
($q$Dead Man's Fingers$q$, $q$dead.man.s.fingers$q$, $q$https://deadmansfingers.com$q$, NULL, NULL),
($q$Denizen$q$, $q$denizen$q$, $q$https://www.denizenrum.com$q$, NULL, NULL),
($q$Depaz$q$, $q$depaz$q$, $q$https://depaz.fr$q$, NULL, NULL),
($q$Dictador$q$, $q$dictador$q$, $q$https://dictador.com$q$, NULL, NULL),
($q$Diplomático$q$, $q$diplomatico$q$, $q$https://www.rondiplomatico.com$q$, NULL, NULL),
($q$Discarded$q$, $q$discarded$q$, $q$https://www.discardedspirits.com$q$, NULL, NULL),
($q$Distillerie Bethel Romelus$q$, $q$distillerie.bethel.romelus$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/8096/clairin-le-rocher-rum$q$, $q$HT$q$, NULL),
($q$Don Pancho Orígenes$q$, $q$don.pancho.origenes$q$, NULL, $q$PA$q$, NULL),
($q$Don Papa$q$, $q$don.papa$q$, $q$https://donpaparum.com$q$, NULL, NULL),
($q$Don Q$q$, $q$don.q$q$, $q$https://donq.com$q$, NULL, NULL),
($q$Dos Maderas$q$, $q$dos.maderas$q$, $q$https://dosmaderas.com/$q$, NULL, NULL),
($q$El Dorado$q$, $q$el.dorado$q$, $q$https://theeldoradorum.com/$q$, $q$GY$q$, NULL),
($q$Eminente$q$, $q$eminente$q$, $q$https://www.eminente.com/$q$, $q$CU$q$, NULL),
($q$Flor de Caña$q$, $q$flor.de.cana$q$, $q$https://www.flordecana.com/$q$, NULL, NULL),
($q$Gosling's$q$, $q$gosling.s$q$, $q$https://goslings.com/$q$, $q$BM$q$, NULL),
($q$Hamilton$q$, $q$hamilton$q$, $q$https://www.hamiltonrum.com/$q$, $q$GY$q$, NULL),
($q$Hampden Estate$q$, $q$hampden.estate$q$, $q$https://specialitybrands.com/range/hampden-estate-rum$q$, $q$JM$q$, NULL),
($q$Havana Club$q$, $q$havana.club$q$, $q$https://havana-club.com/$q$, $q$CU$q$, NULL),
($q$Husk Distillers$q$, $q$husk.distillers$q$, $q$https://huskdistillers.com/$q$, $q$AU$q$, NULL),
($q$Kōloa$q$, $q$koloa$q$, $q$https://koloarum.com/$q$, $q$US$q$, NULL),
($q$La Favorite$q$, $q$la.favorite$q$, $q$https://rhum-lafavorite.com/$q$, $q$MQ$q$, NULL),
($q$La Hechicera$q$, $q$la.hechicera$q$, $q$https://lahechicera.co/$q$, $q$CO$q$, NULL),
($q$Lamb's$q$, $q$lamb.s$q$, $q$https://www.lambsrum.com/$q$, NULL, NULL),
($q$Leblon$q$, $q$leblon$q$, $q$https://www.leblon.com/$q$, $q$BR$q$, NULL),
($q$Lemon Hart$q$, $q$lemon.hart$q$, $q$https://lemonhartrum.com/$q$, $q$GY$q$, NULL),
($q$Magnífica$q$, $q$magnifica$q$, $q$https://bottleofitaly.com/en/pages/produttore-magnifica$q$, $q$BR$q$, NULL),
($q$Matusalem$q$, $q$matusalem$q$, $q$https://matusalem.com/$q$, NULL, NULL),
($q$Montanya$q$, $q$montanya$q$, $q$https://www.montanyarum.com/$q$, $q$US$q$, NULL),
($q$Mount Gay$q$, $q$mount.gay$q$, $q$https://www.mountgayrum.com/$q$, $q$BB$q$, NULL),
($q$Myers's$q$, $q$myers.s$q$, $q$https://www.myersrum.com/$q$, $q$JM$q$, NULL),
($q$Neisson$q$, $q$neisson$q$, $q$https://neisson.com/$q$, $q$MQ$q$, NULL),
($q$Novo Fogo$q$, $q$novo.fogo$q$, $q$https://novofogo.com/$q$, $q$BR$q$, NULL),
($q$Oxbow Rum Distillery$q$, $q$oxbow.rum.distillery$q$, $q$https://www.oxbowrumdistillery.com/$q$, $q$US$q$, NULL),
($q$Paranubes$q$, $q$paranubes$q$, $q$https://www.paranubes.com$q$, NULL, NULL),
($q$Phraya$q$, $q$phraya$q$, $q$https://phrayarum.com$q$, NULL, NULL),
($q$Pitú$q$, $q$pitu$q$, $q$https://pitu.com.br$q$, $q$BR$q$, NULL),
($q$Planteray$q$, $q$planteray$q$, $q$https://planterayrum.com$q$, $q$BB$q$, NULL),
($q$Rhum J.M$q$, $q$rhum.j.m$q$, $q$https://www.rhum-jm.com$q$, $q$MQ$q$, NULL),
($q$Ron Abuelo$q$, $q$ron.abuelo$q$, $q$https://ronabuelo.com$q$, NULL, NULL),
($q$Ron Colón Salvadoreño$q$, $q$ron.colon.salvadoreno$q$, $q$https://roncolon.com$q$, NULL, NULL),
($q$Ron Matusalem$q$, $q$ron.matusalem$q$, $q$https://matusalem.com$q$, $q$DO$q$, NULL),
($q$Ron Santiago de Cuba$q$, $q$ron.santiago.de.cuba$q$, $q$https://www.ronsantiagodecuba.com$q$, $q$CU$q$, NULL),
($q$Ron del Barrilito$q$, $q$ron.del.barrilito$q$, $q$https://rondelbarrilito.com$q$, NULL, NULL),
($q$Rum Co. of Fiji$q$, $q$rum.co.of.fiji$q$, $q$https://rumcooffiji.com$q$, $q$FJ$q$, NULL),
($q$Sailor Jerry$q$, $q$sailor.jerry$q$, $q$https://www.sailorjerry.com$q$, NULL, NULL),
($q$Saint James$q$, $q$saint.james$q$, $q$https://rhum-saintjames.com$q$, $q$MQ$q$, NULL),
($q$Saint Lucia Distillers$q$, $q$saint.lucia.distillers$q$, $q$https://www.stluciadistillers.com$q$, $q$LC$q$, NULL),
($q$Santa Teresa$q$, $q$santa.teresa$q$, $q$https://www.santateresarum.com$q$, NULL, NULL),
($q$Smith & Cross$q$, $q$smith.cross$q$, $q$https://smithandcrossrum.com$q$, $q$JM$q$, NULL),
($q$St. Vincent Distillers$q$, $q$st.vincent.distillers$q$, $q$https://www.sunsetrum.com$q$, $q$VC$q$, NULL),
($q$Stroh$q$, $q$stroh$q$, $q$https://www.stroh.at$q$, $q$AT$q$, NULL),
($q$Takamaka$q$, $q$takamaka$q$, $q$https://www.takamakarum.com$q$, $q$SC$q$, NULL),
($q$Ten To One$q$, $q$ten.to.one$q$, $q$https://www.tentoonerum.com$q$, NULL, NULL),
($q$The Duppy Share$q$, $q$the.duppy.share$q$, $q$https://www.theduppyshare.com/$q$, $q$JM$q$, NULL),
($q$The Kraken$q$, $q$the.kraken$q$, $q$https://www.krakenrum.com/$q$, $q$DO$q$, NULL),
($q$Trois Rivières$q$, $q$trois.rivieres$q$, $q$https://www.troisrivieresrhum.com$q$, $q$MQ$q$, NULL),
($q$Velho Barreiro$q$, $q$velho.barreiro$q$, $q$https://tatuzinho.com.br$q$, $q$BR$q$, NULL),
($q$Worthy Park$q$, $q$worthy.park$q$, $q$https://worthyparkestate.com$q$, $q$JM$q$, NULL),
($q$Wray & Nephew$q$, $q$wray.nephew$q$, $q$https://www.wrayandnephew.com/$q$, $q$JM$q$, NULL),
($q$Zacapa$q$, $q$zacapa$q$, $q$https://www.zacaparum.com$q$, $q$GT$q$, NULL);

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
($q$Angostura 1787 15 Year Old$q$, NULL, $q$Aged Rum$q$, $q$Angostura$q$, NULL, NULL, NULL, $q$https://angostura.com/brands/rums/premium-rums/angostura-1787-2/$q$, $q$producer$q$),
($q$Angostura 5 Year Old$q$, $q$Angostura 5 Year Old Rum$q$, $q$Aged Rum$q$, $q$Angostura$q$, NULL, NULL, NULL, $q$https://angostura.com/brands/rums/premium-rums/angostura-5-year-old-2/$q$, $q$producer$q$),
($q$Angostura 7 Year Old$q$, $q$Angostura 7 Year Rum$q$, $q$Aged Rum$q$, $q$Angostura$q$, NULL, NULL, NULL, $q$https://angostura.com/brands/rums/premium-rums/angostura-7-year-old-2/$q$, $q$producer$q$),
($q$Angostura Founders Reserve 1824$q$, NULL, $q$Aged Rum$q$, $q$Angostura$q$, NULL, NULL, NULL, $q$https://angostura.com/brands/rums/premium-rums/angostura-founders-reserve-1824/$q$, $q$producer$q$),
($q$Angostura Grand Reserve 1919$q$, $q$Angostura 1919 Rum$q$, $q$Aged Rum$q$, $q$Angostura$q$, NULL, NULL, NULL, $q$https://angostura.com/brands/rums/premium-rums/angostura-1919-2/$q$, $q$producer$q$),
($q$Angostura Single Barrel Reserve$q$, NULL, $q$Aged Rum$q$, $q$Angostura$q$, NULL, NULL, NULL, $q$https://angostura.com/brands/rums/standard-rums/angostura-single-barrel-reserve/$q$, $q$producer$q$),
($q$Appleton Estate 12 Year Old Rare Casks$q$, $q$Appleton Estate 12 Year Old Rare Casks$q$, $q$Aged Jamaican Rum$q$, $q$Appleton Estate$q$, 43, $q$JM$q$, NULL, $q$https://www.appletonestate.com/en-us/rums/12-year-old/$q$, $q$producer$q$),
($q$Appleton Estate 15 Year Old Black River Casks$q$, $q$Appleton Estate 15yo$q$, $q$Aged Jamaican Rum$q$, $q$Appleton Estate$q$, 43, $q$JM$q$, NULL, $q$https://www.appletonestate.com/en-us/rums/15-year-old-black-river-casks/$q$, $q$producer$q$),
($q$Appleton Estate 21 Year Old Nassau Valley Casks$q$, $q$Appleton 21Y Rum$q$, $q$Aged Jamaican Rum$q$, $q$Appleton Estate$q$, 43, $q$JM$q$, NULL, $q$https://www.appletonestate.com/en-us/rums/21-year-old-nassau-valley-casks/$q$, $q$producer$q$),
($q$Appleton Estate 8 Year Old Reserve$q$, $q$Appleton Estate 8 Year Old Reserve$q$, $q$Aged Jamaican Rum$q$, $q$Appleton Estate$q$, 43, $q$JM$q$, NULL, $q$https://www.appletonestate.com/en-us/rums/8-year-old/$q$, $q$producer$q$),
($q$Appleton Estate Signature$q$, $q$Appleton Estate Signature$q$, $q$Jamaican Rum$q$, $q$Appleton Estate$q$, NULL, $q$JM$q$, NULL, $q$https://www.appletonestate.com/en-us/rums/signature/$q$, $q$producer$q$),
($q$Avuá Amburana$q$, $q$Avua Amburana Cachaça$q$, $q$Aged Cachaça$q$, $q$Avuá$q$, NULL, $q$BR$q$, $q$Cachaça$q$, $q$https://avuacachaca.com.br/our-products$q$, $q$producer$q$),
($q$Avuá Bálsamo$q$, NULL, $q$Aged Cachaça$q$, $q$Avuá$q$, NULL, $q$BR$q$, $q$Cachaça$q$, $q$https://avuacachaca.com.br/our-products$q$, $q$producer$q$),
($q$Avuá Jequitibá Rosa$q$, NULL, $q$Aged Cachaça$q$, $q$Avuá$q$, NULL, $q$BR$q$, $q$Cachaça$q$, $q$https://avuacachaca.com.br/our-products$q$, $q$producer$q$),
($q$Avuá Oak$q$, $q$Avuá Oak Cachaça$q$, $q$Aged Cachaça$q$, $q$Avuá$q$, NULL, $q$BR$q$, $q$Cachaça$q$, $q$https://avuacachaca.com.br/our-products$q$, $q$producer$q$),
($q$Avuá Prata$q$, $q$Avuá Prata Cachaça$q$, $q$White Cachaça$q$, $q$Avuá$q$, NULL, $q$BR$q$, $q$Cachaça$q$, $q$https://avuacachaca.com.br/our-products$q$, $q$producer$q$),
($q$Avuá Still Strength$q$, NULL, $q$White Cachaça$q$, $q$Avuá$q$, 45, $q$BR$q$, $q$Cachaça$q$, $q$https://avuacachaca.com.br/our-products$q$, $q$producer$q$),
($q$Avuá Tapinhoã$q$, NULL, $q$Aged Cachaça$q$, $q$Avuá$q$, NULL, $q$BR$q$, $q$Cachaça$q$, $q$https://avuacachaca.com.br/our-products$q$, $q$producer$q$),
($q$Bacardí Añejo Cuatro$q$, $q$Bacardí Añejo Cuatro$q$, $q$Aged Rum$q$, $q$Bacardí$q$, NULL, NULL, NULL, $q$https://www.bacardi.com/our-rums/anejo-cuatro-rum/$q$, $q$producer$q$),
($q$Bacardí Carta Negra$q$, $q$Bacardi Black Rum$q$, $q$Dark Rum$q$, $q$Bacardí$q$, NULL, NULL, NULL, $q$https://www.bacardi.com/our-rums/carta-negra-rum/$q$, $q$producer$q$),
($q$Bacardí Carta Oro$q$, $q$Bacardí Carta Oro$q$, $q$Gold Rum$q$, $q$Bacardí$q$, NULL, NULL, NULL, $q$https://www.bacardi.com/our-rums/carta-oro-rum/$q$, $q$producer$q$),
($q$Bacardí Gran Reserva Diez$q$, $q$Bacardí Reserva Diez$q$, $q$Aged Rum$q$, $q$Bacardí$q$, NULL, NULL, NULL, $q$https://www.bacardi.com/our-rums/reserva-diez-rum/$q$, $q$producer$q$),
($q$Bacardí Gran Reserva Limitada$q$, NULL, $q$Aged Rum$q$, $q$Bacardí$q$, NULL, NULL, NULL, $q$https://www.bacardi.com/our-rums/reserva-limitada-rum/$q$, $q$producer$q$),
($q$Bacardí Reserva Ocho$q$, $q$Bacardí 8 Años$q$, $q$Aged Rum$q$, $q$Bacardí$q$, NULL, NULL, NULL, $q$https://www.bacardi.com/our-rums/reserva-ocho-rum/$q$, $q$producer$q$),
($q$Bacardí Spiced$q$, $q$Bacardi Spiced Rum$q$, $q$Spiced Rum$q$, $q$Bacardí$q$, NULL, NULL, NULL, $q$https://www.bacardi.com/our-rums/spiced-rum/$q$, $q$producer$q$),
($q$Banks 5 Island Blend$q$, $q$Banks 5 Island Rum$q$, $q$White Rum$q$, $q$Banks$q$, NULL, NULL, NULL, $q$https://www.bacardilimited.com/our-brands/portfolio/$q$, $q$producer$q$),
($q$Banks 7 Golden Blend$q$, NULL, $q$Gold Rum$q$, $q$Banks$q$, NULL, NULL, NULL, $q$https://www.bacardilimited.com/our-brands/portfolio/$q$, $q$producer$q$),
($q$Barceló Añejo$q$, NULL, $q$Aged Rum$q$, $q$Barceló$q$, NULL, $q$DO$q$, NULL, $q$https://ronbarcelo.com/en/$q$, $q$producer$q$),
($q$Barceló Blanco Añejado$q$, NULL, $q$White Rum$q$, $q$Barceló$q$, NULL, $q$DO$q$, NULL, $q$https://ronbarcelo.com/en/$q$, $q$producer$q$),
($q$Barceló Dorado Añejado$q$, NULL, $q$Gold Rum$q$, $q$Barceló$q$, NULL, $q$DO$q$, NULL, $q$https://ronbarcelo.com/en/$q$, $q$producer$q$),
($q$Barceló Gran Añejo$q$, NULL, $q$Aged Rum$q$, $q$Barceló$q$, NULL, $q$DO$q$, NULL, $q$https://ronbarcelo.com/en/$q$, $q$producer$q$),
($q$Barceló Gran Añejo Dark$q$, NULL, $q$Dark Rum$q$, $q$Barceló$q$, NULL, $q$DO$q$, NULL, $q$https://ronbarcelo.com/en/$q$, $q$producer$q$),
($q$Barceló Imperial$q$, $q$Barceló Imperial Rum$q$, $q$Aged Rum$q$, $q$Barceló$q$, NULL, $q$DO$q$, NULL, $q$https://ronbarcelo.com/en/rum/imperial/$q$, $q$producer$q$),
($q$Barceló Imperial Onyx$q$, NULL, $q$Aged Rum$q$, $q$Barceló$q$, NULL, $q$DO$q$, NULL, $q$https://ronbarcelo.com/en/$q$, $q$producer$q$),
($q$Barceló Imperial Premium Blend$q$, NULL, $q$Aged Rum$q$, $q$Barceló$q$, NULL, $q$DO$q$, NULL, $q$https://ronbarcelo.com/en/$q$, $q$producer$q$),
($q$Barceló Organic$q$, NULL, $q$Rum$q$, $q$Barceló$q$, NULL, $q$DO$q$, NULL, $q$https://ronbarcelo.com/en/$q$, $q$producer$q$),
($q$Black Tot Historic Solera$q$, NULL, $q$Rum$q$, $q$Black Tot$q$, 46.2, NULL, NULL, $q$https://www.blacktot.com/our-rums/black-tot-historic-solera$q$, $q$producer$q$),
($q$Blackwell Black Gold$q$, $q$Blackwell Fine Jamaican Rum$q$, $q$Jamaican Rum$q$, $q$Blackwell$q$, NULL, $q$JM$q$, NULL, $q$https://www.blackwellrum.com/$q$, $q$producer$q$),
($q$Blue Chair Bay Spiced$q$, NULL, $q$Spiced Rum$q$, $q$Blue Chair Bay$q$, NULL, NULL, NULL, $q$https://bluechairbayrum.com/rums/spiced-rum$q$, $q$producer$q$),
($q$Blue Chair Bay White$q$, NULL, $q$White Rum$q$, $q$Blue Chair Bay$q$, NULL, NULL, NULL, $q$https://bluechairbayrum.com/rums/white-rum$q$, $q$producer$q$),
($q$Botran No. 12 Solera$q$, NULL, $q$Aged Rum$q$, $q$Botran$q$, 40, $q$GT$q$, NULL, $q$https://www.bcliquorstores.com/product/287584$q$, $q$retailer$q$),
($q$Brugal 1888$q$, $q$Brugal 1888 Rum$q$, $q$Aged Rum$q$, $q$Brugal$q$, 40, $q$DO$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/397/angostura-aromatic-bitters$q$, $q$reference$q$),
($q$Bumbu The Original$q$, $q$Bumbu The Original Rum$q$, $q$Spiced Rum$q$, $q$Bumbu$q$, 35, NULL, NULL, $q$https://bumbu.sovereignbrands.com/$q$, $q$producer$q$),
($q$Bumbu XO$q$, NULL, $q$Aged Rum$q$, $q$Bumbu$q$, 40, NULL, NULL, $q$https://bumbu.sovereignbrands.com/$q$, $q$producer$q$),
($q$Cadenhead's Classic Blended Rum$q$, $q$Cadenhead's Classic Rum$q$, $q$Rum$q$, $q$Cadenhead's$q$, 50, NULL, NULL, $q$https://www.cadenhead.scot/our-spirits/cadenheads-rum/$q$, $q$producer$q$),
($q$Captain Morgan 100 Proof Spiced$q$, NULL, $q$Spiced Rum$q$, $q$Captain Morgan$q$, 50, NULL, NULL, $q$https://www.captainmorgan.com/en-us/products/captain-morgan-100-proof-spiced-rum$q$, $q$producer$q$),
($q$Captain Morgan Original Spiced$q$, $q$Captain Morgan Original Spiced Rum$q$, $q$Spiced Rum$q$, $q$Captain Morgan$q$, 35, NULL, NULL, $q$https://www.captainmorgan.com/en-us/products/captain-morgan-original-spiced-rum$q$, $q$producer$q$),
($q$Captain Morgan Private Stock$q$, NULL, $q$Spiced Rum$q$, $q$Captain Morgan$q$, NULL, NULL, NULL, $q$https://www.captainmorgan.com/en-us/products/captain-morgan-private-stock-rum$q$, $q$producer$q$),
($q$Captain Morgan Silver Spiced$q$, NULL, $q$Spiced Rum$q$, $q$Captain Morgan$q$, NULL, NULL, NULL, $q$https://www.captainmorgan.com/en-us/products/captain-morgan-silver-spiced-rum$q$, $q$producer$q$),
($q$Captain Morgan White Rum$q$, NULL, $q$White Rum$q$, $q$Captain Morgan$q$, NULL, NULL, NULL, $q$https://www.captainmorgan.com/en-us/products/captain-morgan-white-rum$q$, $q$producer$q$),
($q$Chairman's Reserve 1931$q$, $q$Chairman's Reserve 1931 Rum$q$, $q$Aged Rum$q$, $q$Chairman's Reserve$q$, NULL, NULL, NULL, $q$https://www.chairmansreserverum.com/cr-1931/$q$, $q$producer$q$),
($q$Chairman's Reserve Forgotten Casks$q$, NULL, $q$Aged Rum$q$, $q$Chairman's Reserve$q$, NULL, NULL, NULL, $q$https://www.chairmansreserverum.com/cr-forgot/$q$, $q$producer$q$),
($q$Chairman's Reserve Legacy$q$, $q$Chairman's Reserve Legacy Rum$q$, $q$Rum$q$, $q$Chairman's Reserve$q$, NULL, NULL, NULL, $q$https://www.chairmansreserverum.com/cr-legacy/$q$, $q$producer$q$),
($q$Chairman's Reserve Original$q$, $q$Chairman's Reserve Original Rum$q$, $q$Gold Rum$q$, $q$Chairman's Reserve$q$, NULL, NULL, NULL, $q$https://www.chairmansreserverum.com/cr-original/$q$, $q$producer$q$),
($q$Chairman's Reserve Spiced$q$, $q$Chairman's Reserve Spiced Rum$q$, $q$Spiced Rum$q$, $q$Chairman's Reserve$q$, NULL, NULL, NULL, $q$https://www.chairmansreserverum.com/cr-spiced/$q$, $q$producer$q$),
($q$Chairman's Reserve White$q$, NULL, $q$White Rum$q$, $q$Chairman's Reserve$q$, NULL, NULL, NULL, $q$https://www.chairmansreserverum.com/cr-white/$q$, $q$producer$q$),
($q$Chalong Bay Pure$q$, NULL, $q$Rhum Agricole Blanc$q$, $q$Chalong Bay$q$, NULL, $q$TH$q$, NULL, $q$https://www.chalongbayrum.com/$q$, $q$producer$q$),
($q$Chalong Bay White Spiced$q$, NULL, $q$Spiced Rum$q$, $q$Chalong Bay$q$, NULL, $q$TH$q$, NULL, $q$https://www.chalongbayrum.com/$q$, $q$producer$q$),
($q$Clément 10 Ans$q$, NULL, $q$Aged Rhum Agricole$q$, $q$Clément$q$, 42, $q$MQ$q$, NULL, $q$https://www.rhum-clement.com/en/rhum/clement-10-ans/$q$, $q$producer$q$),
($q$Clément Ambré$q$, NULL, $q$Aged Rhum Agricole$q$, $q$Clément$q$, 40, $q$MQ$q$, $q$Rhum de la Martinique$q$, $q$https://www.rhum-clement.com/en/rhum/amber-clement/$q$, $q$producer$q$),
($q$Clément Blanc$q$, NULL, $q$Rhum Agricole Blanc$q$, $q$Clément$q$, NULL, $q$MQ$q$, $q$Rhum de la Martinique$q$, $q$https://www.rhum-clement.com/en/rhum/clement-blanc/$q$, $q$producer$q$),
($q$Clément Canne Bleue$q$, $q$Rhum Clément Canne Bleue$q$, $q$Rhum Agricole Blanc$q$, $q$Clément$q$, 50, $q$MQ$q$, $q$Rhum de la Martinique$q$, $q$https://www.rhum-clement.com/en/rhum/canne-bleue/$q$, $q$producer$q$),
($q$Clément Colonne Créole Blanc$q$, NULL, $q$Rhum Agricole Blanc$q$, $q$Clément$q$, 49.6, $q$MQ$q$, NULL, $q$https://www.rhum-clement.com/en/rhum/colonne-creole-blanc/$q$, $q$producer$q$),
($q$Clément Cuvée Homère$q$, NULL, $q$Aged Rhum Agricole$q$, $q$Clément$q$, 44, $q$MQ$q$, NULL, $q$https://www.rhum-clement.com/en/rhum/cuvee-homere/$q$, $q$producer$q$),
($q$Clément Hors d'Âge$q$, NULL, $q$Aged Rhum Agricole$q$, $q$Clément$q$, 42, $q$MQ$q$, $q$Rhum de la Martinique$q$, $q$https://www.rhum-clement.com/en/rhum/hors-dage/$q$, $q$producer$q$),
($q$Clément Select Barrel$q$, $q$Rhum Clément Select Barrel$q$, $q$Aged Rhum Agricole$q$, $q$Clément$q$, 40, $q$MQ$q$, NULL, $q$https://www.rhum-clement.com/en/rhum/select-barrel/$q$, $q$producer$q$),
($q$Clément VO$q$, NULL, $q$Aged Rhum Agricole$q$, $q$Clément$q$, 40, $q$MQ$q$, $q$Rhum de la Martinique$q$, $q$https://www.rhum-clement.com/en/rhum/clement-vo/$q$, $q$producer$q$),
($q$Clément VSOP$q$, $q$Rhum Clément VSOP$q$, $q$Aged Rhum Agricole$q$, $q$Clément$q$, 40, $q$MQ$q$, NULL, $q$https://www.rhum-clement.com/en/rhum/clement-vsop/$q$, $q$producer$q$),
($q$Clément XO$q$, $q$Rhum Clément XO$q$, $q$Aged Rhum Agricole$q$, $q$Clément$q$, 42, $q$MQ$q$, NULL, $q$https://www.rhum-clement.com/en/rhum/clement-xo/$q$, $q$producer$q$),
($q$Coruba Dark$q$, $q$Coruba Dark Rum$q$, $q$Dark Rum$q$, $q$Coruba$q$, NULL, $q$JM$q$, NULL, $q$https://flaskfinewines.com/products/coruba-jamaican-dark-rum-750ml$q$, $q$retailer$q$),
($q$Cruzan Aged Dark$q$, NULL, $q$Dark Rum$q$, $q$Cruzan$q$, NULL, $q$VI$q$, NULL, $q$https://www.cruzanrum.com/our-rums/core-rums/cruzan-aged-dark-rum$q$, $q$producer$q$),
($q$Cruzan Aged Light$q$, $q$Cruzan Aged Light Rum$q$, $q$White Rum$q$, $q$Cruzan$q$, NULL, $q$VI$q$, NULL, $q$https://www.cruzanrum.com/our-rums/core-rums/cruzan-aged-light-rum$q$, $q$producer$q$),
($q$Cruzan Black Strap$q$, $q$Cruzan Black Strap Rum$q$, $q$Blackstrap Rum$q$, $q$Cruzan$q$, NULL, $q$VI$q$, NULL, $q$https://www.cruzanrum.com/our-rums/premium-rums/cruzan-black-strap-rum$q$, $q$producer$q$),
($q$Cruzan Estate Diamond Dark$q$, NULL, $q$Dark Rum$q$, $q$Cruzan$q$, NULL, $q$VI$q$, NULL, $q$https://www.cruzanrum.com/our-rums/premium-rums/cruzan-estate-diamond-dark-rum$q$, $q$producer$q$),
($q$Cruzan Estate Diamond Light$q$, NULL, $q$White Rum$q$, $q$Cruzan$q$, NULL, $q$VI$q$, NULL, $q$https://www.cruzanrum.com/our-rums/premium-rums/cruzan-estate-diamond-light-rum$q$, $q$producer$q$),
($q$Cruzan Hurricane Proof Aged$q$, NULL, $q$Overproof Rum$q$, $q$Cruzan$q$, NULL, $q$VI$q$, NULL, $q$https://www.cruzanrum.com/our-rums/core-rums/cruzan-hurricane-proof-aged-rum$q$, $q$producer$q$),
($q$Cruzan Island Reserve$q$, NULL, $q$Aged Rum$q$, $q$Cruzan$q$, NULL, $q$VI$q$, NULL, $q$https://www.cruzanrum.com/our-rums/premium-rums/cruzan-island-reserve-rum$q$, $q$producer$q$),
($q$Cruzan Island Reserve 13 Year Old$q$, NULL, $q$Aged Rum$q$, $q$Cruzan$q$, NULL, $q$VI$q$, NULL, $q$https://www.cruzanrum.com/our-rums/premium-rums/cruzanr-island-reserve-13-year-old$q$, $q$producer$q$),
($q$Cruzan Island Spiced$q$, NULL, $q$Spiced Rum$q$, $q$Cruzan$q$, NULL, $q$VI$q$, NULL, $q$https://www.cruzanrum.com/our-rums/flavored-rums/cruzan-island-spiced-rum$q$, $q$producer$q$),
($q$Cruzan Single Barrel$q$, NULL, $q$Aged Rum$q$, $q$Cruzan$q$, NULL, $q$VI$q$, NULL, $q$https://www.cruzanrum.com/our-rums/premium-rums/cruzan-single-barrel-rum$q$, $q$producer$q$),
($q$Dead Man's Fingers Golden Spiced$q$, NULL, $q$Spiced Rum$q$, $q$Dead Man's Fingers$q$, NULL, NULL, NULL, $q$https://deadmansfingers.com/product/golden-spiced/$q$, $q$producer$q$),
($q$Dead Man's Fingers Pineapple$q$, $q$Dead Man's Fingers Pineapple Rum$q$, $q$Pineapple Rum$q$, $q$Dead Man's Fingers$q$, NULL, NULL, NULL, $q$https://deadmansfingers.com/product/pineapple/$q$, $q$producer$q$),
($q$Dead Man's Fingers Spiced$q$, $q$Dead Man's Fingers Spiced Rum$q$, $q$Spiced Rum$q$, $q$Dead Man's Fingers$q$, NULL, NULL, NULL, $q$https://deadmansfingers.com/product/spiced-rum/$q$, $q$producer$q$),
($q$Dead Man's Fingers White Rum$q$, NULL, $q$White Rum$q$, $q$Dead Man's Fingers$q$, NULL, NULL, NULL, $q$https://deadmansfingers.com/product/white-rum/$q$, $q$producer$q$),
($q$Denizen Aged White$q$, $q$Denizen White Rum$q$, $q$White Rum$q$, $q$Denizen$q$, NULL, NULL, NULL, $q$https://www.denizenrum.com/$q$, $q$producer$q$),
($q$Denizen Merchant's Reserve$q$, $q$Denizen Merchant's Reserve 8 Year Old Rum$q$, $q$Rum$q$, $q$Denizen$q$, NULL, NULL, NULL, $q$https://www.denizenrum.com/$q$, $q$producer$q$),
($q$Denizen Vatted Dark$q$, NULL, $q$Dark Rum$q$, $q$Denizen$q$, 50, NULL, NULL, $q$https://www.denizenrum.com/$q$, $q$producer$q$),
($q$Depaz Cuvée de la Montagne$q$, NULL, $q$Rhum Agricole Blanc$q$, $q$Depaz$q$, NULL, NULL, NULL, $q$https://depaz.fr/en/our-white-rhums/depaz-cuvee-de-la-montagne$q$, $q$producer$q$),
($q$Depaz Cuvée des Alizés$q$, NULL, $q$Rhum Agricole Blanc$q$, $q$Depaz$q$, NULL, NULL, NULL, $q$https://depaz.fr/en/our-white-rhums/depaz-cuvee-des-alizes$q$, $q$producer$q$),
($q$Depaz Grande Réserve XO$q$, NULL, $q$Aged Rhum Agricole$q$, $q$Depaz$q$, NULL, NULL, NULL, $q$https://depaz.fr/en/our-aged-rhums/depaz-grande-reserve-xo$q$, $q$producer$q$),
($q$Depaz Port Cask Finish$q$, NULL, $q$Aged Rhum Agricole$q$, $q$Depaz$q$, NULL, NULL, NULL, $q$https://depaz.fr/en/our-special-editions/depaz-port-cask-finish$q$, $q$producer$q$),
($q$Depaz Réserve Spéciale VSOP$q$, NULL, $q$Aged Rhum Agricole$q$, $q$Depaz$q$, NULL, NULL, NULL, $q$https://depaz.fr/en/our-aged-rhums/depaz-reserve-speciale-vsop$q$, $q$producer$q$),
($q$Dictador 12$q$, $q$Dictador 12 Year Old Rum$q$, $q$Aged Rum$q$, $q$Dictador$q$, NULL, NULL, NULL, $q$https://dictador.com/product/dictador-d12-blend/$q$, $q$producer$q$),
($q$Dictador 20$q$, NULL, $q$Aged Rum$q$, $q$Dictador$q$, NULL, NULL, NULL, $q$https://dictador.com/product/dictador-d20-blend-with-gitbox/$q$, $q$producer$q$),
($q$Dictador Aurum$q$, NULL, $q$Aged Rum$q$, $q$Dictador$q$, NULL, NULL, NULL, $q$https://dictador.com/product/dictador-aurum/$q$, $q$producer$q$),
($q$Dictador Platinum$q$, NULL, $q$Aged Rum$q$, $q$Dictador$q$, NULL, NULL, NULL, $q$https://dictador.com/product/dictador-platinum/$q$, $q$producer$q$),
($q$Diplomático Ambassador$q$, NULL, $q$Aged Rum$q$, $q$Diplomático$q$, NULL, NULL, NULL, $q$https://www.rondiplomatico.com/product/ambassador/$q$, $q$producer$q$),
($q$Diplomático Mantuano$q$, $q$Diplomático Mantuano Rum$q$, $q$Aged Rum$q$, $q$Diplomático$q$, NULL, NULL, NULL, $q$https://www.rondiplomatico.com/product/mantuano/$q$, $q$producer$q$),
($q$Diplomático Planas$q$, $q$Diplomático Planas Rum$q$, $q$White Rum$q$, $q$Diplomático$q$, NULL, NULL, NULL, $q$https://www.rondiplomatico.com/product/planas/$q$, $q$producer$q$),
($q$Diplomático Reserva Exclusiva$q$, $q$Diplomático Reserva Exclusiva$q$, $q$Aged Rum$q$, $q$Diplomático$q$, NULL, NULL, NULL, $q$https://www.rondiplomatico.com/product/reserva-exclusiva/$q$, $q$producer$q$),
($q$Diplomático Selección de Familia$q$, $q$Diplomático Selección de Familia Rum$q$, $q$Aged Rum$q$, $q$Diplomático$q$, NULL, NULL, NULL, $q$https://www.rondiplomatico.com/product/seleccion-de-familia/$q$, $q$producer$q$),
($q$Discarded Banana Peel Rum$q$, $q$Discarded Banana Peel Rum$q$, $q$Rum$q$, $q$Discarded$q$, 37.5, NULL, NULL, $q$https://www.discardedspirits.com/products/discarded-rum/$q$, $q$producer$q$),
($q$Clairin Le Rocher$q$, $q$Clairin Le Rocher$q$, $q$Clairin$q$, $q$Distillerie Bethel Romelus$q$, 47.2, $q$HT$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/8096/clairin-le-rocher-rum$q$, $q$reference$q$),
($q$Don Pancho Orígenes 8$q$, $q$Don Pancho 8 Rum$q$, $q$Aged Rum$q$, $q$Don Pancho Orígenes$q$, 40, $q$PA$q$, NULL, $q$https://www.reservebar.com/products/don-pancho-origenes-8-year-old/GROUPING-107655$q$, $q$retailer$q$),
($q$Don Papa$q$, NULL, $q$Aged Rum$q$, $q$Don Papa$q$, NULL, NULL, NULL, $q$https://donpaparum.com/collections/don-papa-rum$q$, $q$producer$q$),
($q$Don Papa Port Cask$q$, NULL, $q$Aged Rum$q$, $q$Don Papa$q$, NULL, NULL, NULL, $q$https://donpaparum.com/collections/don-papa-rum$q$, $q$producer$q$),
($q$Don Papa Rare Cask$q$, NULL, $q$Aged Rum$q$, $q$Don Papa$q$, NULL, NULL, NULL, $q$https://donpaparum.com/collections/don-papa-rum$q$, $q$producer$q$),
($q$Don Papa Rye Cask$q$, NULL, $q$Aged Rum$q$, $q$Don Papa$q$, NULL, NULL, NULL, $q$https://donpaparum.com/collections/don-papa-rum$q$, $q$producer$q$),
($q$Don Papa Sevillana$q$, NULL, $q$Aged Rum$q$, $q$Don Papa$q$, NULL, NULL, NULL, $q$https://donpaparum.com/collections/don-papa-rum$q$, $q$producer$q$),
($q$Don Papa Sherry Cask$q$, NULL, $q$Aged Rum$q$, $q$Don Papa$q$, NULL, NULL, NULL, $q$https://donpaparum.com/collections/don-papa-rum$q$, $q$producer$q$),
($q$Don Q 151$q$, $q$Don Q 151 Rum$q$, $q$Overproof Rum$q$, $q$Don Q$q$, NULL, NULL, NULL, $q$https://donq.com/don-q-151$q$, $q$producer$q$),
($q$Don Q Cristal$q$, $q$Don Q Cristal White Rum$q$, $q$White Rum$q$, $q$Don Q$q$, NULL, NULL, NULL, $q$https://donq.com/our-rums$q$, $q$producer$q$),
($q$Don Q Double Aged Port Cask Finish$q$, NULL, $q$Aged Rum$q$, $q$Don Q$q$, NULL, NULL, NULL, $q$https://donq.com/don-q-double-aged-port-cask-finish$q$, $q$producer$q$),
($q$Don Q Gold$q$, $q$Don Q Gold$q$, $q$Gold Rum$q$, $q$Don Q$q$, NULL, NULL, NULL, $q$https://donq.com/don-q-gold$q$, $q$producer$q$),
($q$Don Q Gran Reserva XO$q$, NULL, $q$Aged Rum$q$, $q$Don Q$q$, NULL, NULL, NULL, $q$https://donq.com/don-q-gran-reserva-xo$q$, $q$producer$q$),
($q$Don Q Oak Barrel Spiced$q$, $q$Don Q Spiced Rum$q$, $q$Spiced Rum$q$, $q$Don Q$q$, NULL, NULL, NULL, $q$https://donq.com/don-q-oak-barrel-spiced$q$, $q$producer$q$),
($q$Don Q Reserva$q$, NULL, $q$Aged Rum$q$, $q$Don Q$q$, NULL, NULL, NULL, $q$https://donq.com/don-q-reserva$q$, $q$producer$q$),
($q$Don Q Reserva 7$q$, $q$Don Q Reserva 7 Rum$q$, $q$Aged Rum$q$, $q$Don Q$q$, NULL, NULL, NULL, $q$https://donq.com/don-q-reserva-7$q$, $q$producer$q$),
($q$Don Q Reserva Especial$q$, NULL, $q$Aged Rum$q$, $q$Don Q$q$, NULL, NULL, NULL, $q$https://donq.com/don-q-reserva-especial$q$, $q$producer$q$),
($q$Dos Maderas 5+3$q$, NULL, $q$Aged Rum$q$, $q$Dos Maderas$q$, NULL, NULL, NULL, $q$https://dosmaderas.com/$q$, $q$producer$q$),
($q$Dos Maderas 5+5$q$, $q$Dos Maderas 5+5$q$, $q$Aged Rum$q$, $q$Dos Maderas$q$, NULL, NULL, NULL, $q$https://dosmaderas.com/the-collection/dos-maderas-5-5/$q$, $q$producer$q$),
($q$Dos Maderas Atlantic$q$, NULL, $q$Rum$q$, $q$Dos Maderas$q$, NULL, NULL, NULL, $q$https://dosmaderas.com/$q$, $q$producer$q$),
($q$Dos Maderas Luxus$q$, NULL, $q$Aged Rum$q$, $q$Dos Maderas$q$, NULL, NULL, NULL, $q$https://dosmaderas.com/$q$, $q$producer$q$),
($q$Dos Maderas Origen Thailand$q$, NULL, $q$Rum$q$, $q$Dos Maderas$q$, NULL, NULL, NULL, $q$https://dosmaderas.com/$q$, $q$producer$q$),
($q$Dos Maderas Selección$q$, NULL, $q$Aged Rum$q$, $q$Dos Maderas$q$, NULL, NULL, NULL, $q$https://dosmaderas.com/$q$, $q$producer$q$),
($q$El Dorado 12 Year Old$q$, $q$El Dorado 12 Year Rum$q$, $q$Demerara Rum$q$, $q$El Dorado$q$, NULL, $q$GY$q$, NULL, $q$https://theeldoradorum.com/blended-rums/12-year-old$q$, $q$producer$q$),
($q$El Dorado 15 Year Old$q$, $q$El Dorado 15 Year Aged Rum$q$, $q$Demerara Rum$q$, $q$El Dorado$q$, NULL, $q$GY$q$, NULL, $q$https://theeldoradorum.com/blended-rums$q$, $q$producer$q$),
($q$El Dorado 21 Year Old$q$, NULL, $q$Demerara Rum$q$, $q$El Dorado$q$, NULL, $q$GY$q$, NULL, $q$https://theeldoradorum.com/blended-rums$q$, $q$producer$q$),
($q$El Dorado 25 Year Old Grand Special Reserve$q$, NULL, $q$Demerara Rum$q$, $q$El Dorado$q$, NULL, $q$GY$q$, NULL, $q$https://theeldoradorum.com/blended-rums$q$, $q$producer$q$),
($q$El Dorado 3 Year Old$q$, $q$El Dorado 3 Year Old Rum$q$, $q$Demerara Rum$q$, $q$El Dorado$q$, NULL, $q$GY$q$, NULL, $q$https://theeldoradorum.com/blended-rums$q$, $q$producer$q$),
($q$El Dorado 5 Year Old$q$, $q$El Dorado 5 Year Old Rum$q$, $q$Demerara Rum$q$, $q$El Dorado$q$, NULL, $q$GY$q$, NULL, $q$https://theeldoradorum.com/blended-rums$q$, $q$producer$q$),
($q$El Dorado 8 Year Old$q$, $q$El Dorado 8 Year Old Rum$q$, $q$Demerara Rum$q$, $q$El Dorado$q$, NULL, $q$GY$q$, NULL, $q$https://theeldoradorum.com/blended-rums$q$, $q$producer$q$),
($q$El Dorado Enmore Single Still$q$, NULL, $q$Demerara Rum$q$, $q$El Dorado$q$, NULL, $q$GY$q$, NULL, $q$https://theeldoradorum.com/blended-rums$q$, $q$producer$q$),
($q$El Dorado High Ester$q$, NULL, $q$Demerara Rum$q$, $q$El Dorado$q$, NULL, $q$GY$q$, NULL, $q$https://theeldoradorum.com/blended-rums$q$, $q$producer$q$),
($q$El Dorado Port Mourant Single Still$q$, $q$El Dorado Port Mourant Rum$q$, $q$Demerara Rum$q$, $q$El Dorado$q$, NULL, $q$GY$q$, NULL, $q$https://theeldoradorum.com/blended-rums$q$, $q$producer$q$),
($q$El Dorado Versailles Single Still$q$, NULL, $q$Demerara Rum$q$, $q$El Dorado$q$, NULL, $q$GY$q$, NULL, $q$https://theeldoradorum.com/blended-rums$q$, $q$producer$q$),
($q$Eminente Carta Oro$q$, NULL, $q$Gold Rum$q$, $q$Eminente$q$, NULL, $q$CU$q$, $q$Ron de Cuba$q$, $q$https://www.eminente.com/en/carta-oro$q$, $q$producer$q$),
($q$Eminente Reserva 7 Años$q$, $q$Eminente Reserva 7 Años Rum$q$, $q$Aged Rum$q$, $q$Eminente$q$, NULL, $q$CU$q$, $q$Ron de Cuba$q$, $q$https://www.eminente.com/en/reserva$q$, $q$producer$q$),
($q$Eminente Ámbar Claro$q$, $q$Eminente Ámbar Claro$q$, $q$Gold Rum$q$, $q$Eminente$q$, NULL, $q$CU$q$, $q$Ron de Cuba$q$, $q$https://www.eminente.com/en/ambar-claro$q$, $q$producer$q$),
($q$Flor de Caña 12$q$, $q$Flor de Caña 12 Rum$q$, $q$Aged Rum$q$, $q$Flor de Caña$q$, NULL, NULL, NULL, $q$https://www.flordecana.com/portfolio/12-year$q$, $q$producer$q$),
($q$Flor de Caña 18$q$, $q$Flor de Caña 18 Rum$q$, $q$Aged Rum$q$, $q$Flor de Caña$q$, NULL, NULL, NULL, $q$https://www.flordecana.com/premium-rums$q$, $q$producer$q$),
($q$Flor de Caña 25$q$, NULL, $q$Aged Rum$q$, $q$Flor de Caña$q$, NULL, NULL, NULL, $q$https://www.flordecana.com/premium-rums$q$, $q$producer$q$),
($q$Flor de Caña Blanco Reserva$q$, $q$Flor de Caña White Rum$q$, $q$White Rum$q$, $q$Flor de Caña$q$, NULL, NULL, NULL, $q$https://www.flordecana.com/reserva-collection$q$, $q$producer$q$),
($q$Flor de Caña Clásico Reserva$q$, NULL, $q$Aged Rum$q$, $q$Flor de Caña$q$, NULL, NULL, NULL, $q$https://www.flordecana.com/reserva-collection$q$, $q$producer$q$),
($q$Flor de Caña Cristalino$q$, NULL, $q$White Rum$q$, $q$Flor de Caña$q$, NULL, NULL, NULL, $q$https://www.flordecana.com/premium-rums$q$, $q$producer$q$),
($q$Flor de Caña Gran Reserva$q$, $q$Flor de Caña 7 Gran Reserva Rum$q$, $q$Aged Rum$q$, $q$Flor de Caña$q$, NULL, NULL, NULL, $q$https://www.flordecana.com/reserva-collection$q$, $q$producer$q$),
($q$Flor de Caña Oro Reserva$q$, NULL, $q$Gold Rum$q$, $q$Flor de Caña$q$, NULL, NULL, NULL, $q$https://www.flordecana.com/reserva-collection$q$, $q$producer$q$),
($q$Goslings Black Seal$q$, $q$Goslings Black Seal Rum$q$, $q$Dark Rum$q$, $q$Gosling's$q$, 40, $q$BM$q$, NULL, $q$https://goslings.com/newProduct/goslings-black-seal-rum/$q$, $q$producer$q$),
($q$Goslings Spirited Seas Ocean Aged$q$, NULL, $q$Dark Rum$q$, $q$Gosling's$q$, NULL, $q$BM$q$, NULL, $q$https://goslings.com/newProduct/goslings-spirited-seas-ocean-aged-rum/$q$, $q$producer$q$),
($q$Hamilton 151 Overproof Demerara$q$, $q$Hamilton 151 Overproof Demerara Rum$q$, $q$Demerara Rum$q$, $q$Hamilton$q$, NULL, $q$GY$q$, NULL, $q$https://www.astorwines.com/SearchResult.aspx?search=&term=hamilton%20rum$q$, $q$retailer$q$),
($q$Hamilton Beachbum Berry Zombie Blend$q$, NULL, $q$Rum$q$, $q$Hamilton$q$, NULL, NULL, NULL, $q$https://www.astorwines.com/SearchResult.aspx?search=&term=hamilton%20rum$q$, $q$retailer$q$),
($q$Hamilton Beachbum Berry's Navy Grog Blend$q$, NULL, $q$Navy Rum$q$, $q$Hamilton$q$, 57, NULL, NULL, $q$https://www.astorwines.com/SearchResult.aspx?search=&term=hamilton%20rum$q$, $q$retailer$q$),
($q$Hamilton Breezeway Blend$q$, NULL, $q$White Rum$q$, $q$Hamilton$q$, NULL, NULL, NULL, $q$https://www.astorwines.com/SearchResult.aspx?search=&term=hamilton%20rum$q$, $q$retailer$q$),
($q$Hamilton Demerara$q$, NULL, $q$Demerara Rum$q$, $q$Hamilton$q$, NULL, $q$GY$q$, NULL, $q$https://www.astorwines.com/SearchResult.aspx?search=&term=hamilton%20rum$q$, $q$retailer$q$),
($q$Hamilton Navy Strength$q$, NULL, $q$Navy Rum$q$, $q$Hamilton$q$, NULL, NULL, NULL, $q$https://www.astorwines.com/SearchResult.aspx?search=&term=hamilton%20rum$q$, $q$retailer$q$),
($q$Hamilton White 'Stache$q$, NULL, $q$White Rum$q$, $q$Hamilton$q$, NULL, NULL, NULL, $q$https://www.astorwines.com/SearchResult.aspx?search=&term=hamilton%20rum$q$, $q$retailer$q$),
($q$Hamilton Worthy Park Jamaica Black$q$, $q$Hamilton Jamaican Pot Still Black Rum$q$, $q$Dark Rum$q$, $q$Hamilton$q$, 46.5, $q$JM$q$, NULL, $q$https://www.astorwines.com/item/31300$q$, $q$retailer$q$),
($q$Hampden Estate 1753$q$, NULL, $q$Jamaican Rum$q$, $q$Hampden Estate$q$, 46, $q$JM$q$, NULL, $q$https://specialitybrands.com/range/hampden-estate-rum/hampden-estate-1753$q$, $q$retailer$q$),
($q$Hampden Estate 8 Year Old$q$, $q$Hampden Estate 8 Year Old Rum$q$, $q$Aged Jamaican Rum$q$, $q$Hampden Estate$q$, 46, $q$JM$q$, NULL, $q$https://specialitybrands.com/range/hampden-estate-rum/hampden-estate-8-year-old-rum$q$, $q$retailer$q$),
($q$Hampden Estate HLCF Classic$q$, $q$Hampden Estate HLCF Classic Overproof Rum$q$, $q$Overproof Jamaican Rum$q$, $q$Hampden Estate$q$, 60, $q$JM$q$, NULL, $q$https://specialitybrands.com/range/hampden-estate-rum/hampden-estate-hlcf-classic$q$, $q$retailer$q$),
($q$Rum Fire$q$, $q$Rum Fire White Overproof Rum$q$, $q$Overproof Jamaican Rum$q$, $q$Hampden Estate$q$, 63, $q$JM$q$, NULL, $q$https://specialitybrands.com/range/hampden-estate-rum/rum-fire$q$, $q$retailer$q$),
($q$Havana Club Añejo 3 Años$q$, $q$Havana Club Añejo 3 Años$q$, $q$White Rum$q$, $q$Havana Club$q$, NULL, $q$CU$q$, NULL, $q$https://www.diffordsguide.com/producer/1279/havana-club/havana-club-range$q$, $q$reference$q$),
($q$Havana Club Añejo 7 Años$q$, $q$Havana Club Añejo 7 Años$q$, $q$Aged Rum$q$, $q$Havana Club$q$, NULL, $q$CU$q$, NULL, $q$https://www.diffordsguide.com/producer/1279/havana-club/havana-club-range$q$, $q$reference$q$),
($q$Havana Club Añejo Especial$q$, $q$Havana Club Añejo Especial Rum$q$, $q$Gold Rum$q$, $q$Havana Club$q$, NULL, $q$CU$q$, NULL, $q$https://www.diffordsguide.com/producer/1279/havana-club/havana-club-range$q$, $q$reference$q$),
($q$Havana Club Cuban Spiced$q$, NULL, $q$Spiced Rum$q$, $q$Havana Club$q$, NULL, $q$CU$q$, NULL, $q$https://www.diffordsguide.com/producer/1279/havana-club/havana-club-range$q$, $q$reference$q$),
($q$Havana Club Gran Reserva 15 Años$q$, NULL, $q$Aged Rum$q$, $q$Havana Club$q$, NULL, $q$CU$q$, NULL, $q$https://www.diffordsguide.com/producer/1279/havana-club/iconica-collection$q$, $q$reference$q$),
($q$Havana Club Selección de Maestros$q$, $q$Havana Club Selección de Maestros$q$, $q$Aged Rum$q$, $q$Havana Club$q$, NULL, $q$CU$q$, NULL, $q$https://www.diffordsguide.com/producer/1279/havana-club/iconica-collection$q$, $q$reference$q$),
($q$Havana Club Smoky$q$, NULL, $q$Rum$q$, $q$Havana Club$q$, NULL, $q$CU$q$, NULL, $q$https://www.diffordsguide.com/producer/1279/havana-club/havana-club-range$q$, $q$reference$q$),
($q$Husk Bam Bam$q$, NULL, $q$Spiced Rum$q$, $q$Husk Distillers$q$, 40, $q$AU$q$, NULL, $q$https://huskdistillers.com/husk-rum$q$, $q$producer$q$),
($q$Husk Botanic$q$, NULL, $q$Rhum Agricole$q$, $q$Husk Distillers$q$, 40, $q$AU$q$, NULL, $q$https://huskdistillers.com/husk-rum$q$, $q$producer$q$),
($q$Husk Pure Cane$q$, NULL, $q$Rhum Agricole Blanc$q$, $q$Husk Distillers$q$, 40, $q$AU$q$, NULL, $q$https://huskdistillers.com/husk-rum$q$, $q$producer$q$),
($q$Husk Pure Cane 50%$q$, NULL, $q$Rhum Agricole Blanc$q$, $q$Husk Distillers$q$, 50, $q$AU$q$, NULL, $q$https://huskdistillers.com/husk-rum$q$, $q$producer$q$),
($q$Husk Rare Blend$q$, $q$Husk Rare Blend Rum$q$, $q$Rum$q$, $q$Husk Distillers$q$, 40, $q$AU$q$, NULL, $q$https://huskdistillers.com/husk-rum$q$, $q$producer$q$),
($q$Husk Signature ACR$q$, NULL, $q$Rhum Agricole$q$, $q$Husk Distillers$q$, NULL, $q$AU$q$, NULL, $q$https://huskdistillers.com/husk-rum$q$, $q$producer$q$),
($q$Kōloa Kauaʻi Cane Fire Rum$q$, NULL, $q$Spiced Rum$q$, $q$Kōloa$q$, 40, $q$US$q$, NULL, $q$https://koloarum.com/rum/koloa-kauai-cane-fire-rum/$q$, $q$producer$q$),
($q$Kōloa Kauaʻi Coconut Rum$q$, $q$Kōloa Kauaʻi Coconut Rum$q$, $q$Coconut Rum$q$, $q$Kōloa$q$, 40, $q$US$q$, NULL, $q$https://koloarum.com/rum/koloa-kauai-coconut-rum/$q$, $q$producer$q$),
($q$Kōloa Kauaʻi Dark Rum$q$, NULL, $q$Dark Rum$q$, $q$Kōloa$q$, 40, $q$US$q$, NULL, $q$https://koloarum.com/rum/koloa-kauai-dark-rum/$q$, $q$producer$q$),
($q$Kōloa Kauaʻi Gold Rum$q$, NULL, $q$Gold Rum$q$, $q$Kōloa$q$, 40, $q$US$q$, NULL, $q$https://koloarum.com/rum/koloa-kauai-gold-rum/$q$, $q$producer$q$),
($q$Kōloa Kauaʻi Single-Batch Aged Rum$q$, NULL, $q$Aged Rum$q$, $q$Kōloa$q$, NULL, $q$US$q$, NULL, $q$https://koloarum.com/rum/koloa-kauai-reserve-aged-hawaiian-rum/$q$, $q$producer$q$),
($q$Kōloa Kauaʻi Spice Rum$q$, NULL, $q$Spiced Rum$q$, $q$Kōloa$q$, 44, $q$US$q$, NULL, $q$https://koloarum.com/rum/koloa-kauai-spice-rum/$q$, $q$producer$q$),
($q$Kōloa Kauaʻi White Rum$q$, NULL, $q$White Rum$q$, $q$Kōloa$q$, 40, $q$US$q$, NULL, $q$https://koloarum.com/rum/koloa-kauai-white-rum/$q$, $q$producer$q$),
($q$La Favorite Cœur Ambré$q$, $q$La Favorite Coeur Ambré Rhum$q$, $q$Rhum Agricole$q$, $q$La Favorite$q$, NULL, $q$MQ$q$, $q$Rhum de la Martinique$q$, $q$https://rhum-lafavorite.com/rhums/$q$, $q$producer$q$),
($q$La Favorite Cœur de Canne Blanc 50$q$, NULL, $q$Rhum Agricole Blanc$q$, $q$La Favorite$q$, 50, $q$MQ$q$, $q$Rhum de la Martinique$q$, $q$https://rhum-lafavorite.com/rhums/$q$, $q$producer$q$),
($q$La Favorite Cœur de Canne Blanc 55$q$, NULL, $q$Rhum Agricole Blanc$q$, $q$La Favorite$q$, 55, $q$MQ$q$, $q$Rhum de la Martinique$q$, $q$https://rhum-lafavorite.com/rhums/$q$, $q$producer$q$),
($q$La Favorite Cœur de Canne VO 3 Ans$q$, NULL, $q$Aged Rhum Agricole$q$, $q$La Favorite$q$, NULL, $q$MQ$q$, $q$Rhum de la Martinique$q$, $q$https://rhum-lafavorite.com/rhums/$q$, $q$producer$q$),
($q$La Favorite Cœur de Canne VSOP 4 Ans$q$, NULL, $q$Aged Rhum Agricole$q$, $q$La Favorite$q$, NULL, $q$MQ$q$, $q$Rhum de la Martinique$q$, $q$https://rhum-lafavorite.com/rhums/$q$, $q$producer$q$),
($q$La Favorite Cœur de Canne Élevé Sous Bois$q$, NULL, $q$Aged Rhum Agricole$q$, $q$La Favorite$q$, NULL, $q$MQ$q$, $q$Rhum de la Martinique$q$, $q$https://rhum-lafavorite.com/rhums/$q$, $q$producer$q$),
($q$La Favorite L'Authentique Blanc 50$q$, NULL, $q$Rhum Agricole Blanc$q$, $q$La Favorite$q$, 50, $q$MQ$q$, $q$Rhum de la Martinique$q$, $q$https://rhum-lafavorite.com/rhums/$q$, $q$producer$q$),
($q$La Favorite L'Authentique Blanc 55$q$, NULL, $q$Rhum Agricole Blanc$q$, $q$La Favorite$q$, 55, $q$MQ$q$, $q$Rhum de la Martinique$q$, $q$https://rhum-lafavorite.com/rhums/$q$, $q$producer$q$),
($q$La Favorite L'Authentique Blanc AOC 40$q$, NULL, $q$Rhum Agricole Blanc$q$, $q$La Favorite$q$, 40, $q$MQ$q$, $q$Rhum de la Martinique$q$, $q$https://rhum-lafavorite.com/rhums/$q$, $q$producer$q$),
($q$La Favorite L'Authentique Élevé Sous Bois$q$, NULL, $q$Aged Rhum Agricole$q$, $q$La Favorite$q$, 40, $q$MQ$q$, $q$Rhum de la Martinique$q$, $q$https://rhum-lafavorite.com/rhums/$q$, $q$producer$q$),
($q$La Hechicera Reserva Familiar$q$, $q$La Hechicera Rum$q$, $q$Aged Rum$q$, $q$La Hechicera$q$, NULL, $q$CO$q$, NULL, $q$https://lahechicera.co/$q$, $q$producer$q$),
($q$Lamb's Navy Rum$q$, $q$Lamb's Navy Rum$q$, $q$Navy Rum$q$, $q$Lamb's$q$, 40, NULL, NULL, $q$https://www.lcbo.com/webapp/wcs/stores/servlet/en/lcbo/lambs-navy-rum-(pet)-240135$q$, $q$retailer$q$),
($q$Leblon Cachaça$q$, $q$Leblon Cachaça$q$, $q$Aged Cachaça$q$, $q$Leblon$q$, NULL, $q$BR$q$, $q$Cachaça$q$, $q$https://www.leblon.com/$q$, $q$producer$q$),
($q$Maison Leblon Reserva Especial$q$, NULL, $q$Aged Cachaça$q$, $q$Leblon$q$, NULL, $q$BR$q$, $q$Cachaça$q$, $q$https://www.leblon.com/$q$, $q$producer$q$),
($q$Lemon Hart 151$q$, $q$Lemon Hart 151 Demerara Rum$q$, $q$Overproof Rum$q$, $q$Lemon Hart$q$, NULL, NULL, NULL, $q$https://lemonhartrum.com/rum-always$q$, $q$producer$q$),
($q$Lemon Hart 86 Redux$q$, NULL, $q$Demerara Rum$q$, $q$Lemon Hart$q$, 43, NULL, NULL, $q$https://lemonhartrum.com/rum-always$q$, $q$producer$q$),
($q$Lemon Hart 96 Redux$q$, NULL, $q$Demerara Rum$q$, $q$Lemon Hart$q$, 48, NULL, NULL, $q$https://lemonhartrum.com/rum-always$q$, $q$producer$q$),
($q$Lemon Hart Blackpool$q$, NULL, $q$Spiced Rum$q$, $q$Lemon Hart$q$, NULL, NULL, NULL, $q$https://lemonhartrum.com/rum-always$q$, $q$producer$q$),
($q$Lemon Hart Original 1804$q$, $q$Lemon Hart 1804 Demerara Rum$q$, $q$Demerara Rum$q$, $q$Lemon Hart$q$, 40, $q$GY$q$, NULL, $q$https://lemonhartrum.com/rum-always$q$, $q$producer$q$),
($q$Magnífica Reserva Soleira$q$, NULL, $q$Aged Cachaça$q$, $q$Magnífica$q$, NULL, $q$BR$q$, $q$Cachaça$q$, $q$https://bottleofitaly.com/en/pages/produttore-magnifica$q$, $q$retailer$q$),
($q$Magnífica Tradicional$q$, $q$Magnífica Tradicional Cachaça$q$, $q$Aged Cachaça$q$, $q$Magnífica$q$, NULL, $q$BR$q$, $q$Cachaça$q$, $q$https://bottleofitaly.com/en/pages/produttore-magnifica$q$, $q$retailer$q$),
($q$Matusalem Enigma$q$, NULL, $q$Aged Rum$q$, $q$Matusalem$q$, NULL, NULL, NULL, $q$https://www.matusalem.com/$q$, $q$producer$q$),
($q$Matusalem Gran Reserva 15$q$, $q$Matusalem Gran Reserva 15$q$, $q$Aged Rum$q$, $q$Matusalem$q$, NULL, NULL, NULL, $q$https://www.matusalem.com/$q$, $q$producer$q$),
($q$Matusalem Gran Reserva 23$q$, NULL, $q$Aged Rum$q$, $q$Matusalem$q$, NULL, NULL, NULL, $q$https://www.matusalem.com/$q$, $q$producer$q$),
($q$Montanya Exclusiva$q$, NULL, $q$Aged Rum$q$, $q$Montanya$q$, 40, $q$US$q$, NULL, $q$https://www.montanyarum.com/montanya-exclusiva-rum$q$, $q$producer$q$),
($q$Montanya Oro$q$, NULL, $q$Gold Rum$q$, $q$Montanya$q$, 40, $q$US$q$, NULL, $q$https://www.montanyarum.com/montanya-oro-rum$q$, $q$producer$q$),
($q$Montanya Pineapple Habanero$q$, NULL, $q$Pineapple Rum$q$, $q$Montanya$q$, 40, $q$US$q$, NULL, $q$https://www.montanyarum.com/montanya-pineapple-habanero$q$, $q$producer$q$),
($q$Montanya Platino$q$, NULL, $q$White Rum$q$, $q$Montanya$q$, 40, $q$US$q$, NULL, $q$https://www.montanyarum.com/montanya-platino-rum$q$, $q$producer$q$),
($q$Montanya Valentia$q$, NULL, $q$Aged Rum$q$, $q$Montanya$q$, 40, $q$US$q$, NULL, $q$https://www.montanyarum.com/montanya-valentia-rum$q$, $q$producer$q$),
($q$Mount Gay Bajan Spiced$q$, NULL, $q$Spiced Rum$q$, $q$Mount Gay$q$, 35, $q$BB$q$, NULL, $q$https://www.mountgayrum.com/rum/bajan-spiced/$q$, $q$producer$q$),
($q$Mount Gay Black Barrel$q$, $q$Mount Gay Black Barrel Rum$q$, $q$Aged Rum$q$, $q$Mount Gay$q$, NULL, $q$BB$q$, NULL, $q$https://www.mountgayrum.com/rum/black-barrel/$q$, $q$producer$q$),
($q$Mount Gay Black Barrel Cask Strength$q$, NULL, $q$Overproof Rum$q$, $q$Mount Gay$q$, 66, $q$BB$q$, NULL, $q$https://www.mountgayrum.com/rum/black-barrel-cask-strength/$q$, $q$producer$q$),
($q$Mount Gay Eclipse$q$, $q$Mount Gay Eclipse Rum$q$, $q$Gold Rum$q$, $q$Mount Gay$q$, NULL, $q$BB$q$, NULL, $q$https://www.mountgayrum.com/rum/eclipse/$q$, $q$producer$q$),
($q$Mount Gay Eclipse Navy Strength$q$, NULL, $q$Navy Rum$q$, $q$Mount Gay$q$, 57.1, $q$BB$q$, NULL, $q$https://www.mountgayrum.com/rum/eclipse-navy-strength/$q$, $q$producer$q$),
($q$Mount Gay Silver$q$, NULL, $q$White Rum$q$, $q$Mount Gay$q$, NULL, $q$BB$q$, NULL, $q$https://www.mountgayrum.com/rum/silver/$q$, $q$producer$q$),
($q$Mount Gay XO$q$, $q$Mount Gay XO Aged Rum$q$, $q$Aged Rum$q$, $q$Mount Gay$q$, NULL, $q$BB$q$, NULL, $q$https://www.mountgayrum.com/rum/xo/$q$, $q$producer$q$),
($q$Myers's Original Dark$q$, $q$Myers's Original Dark Rum$q$, $q$Dark Rum$q$, $q$Myers's$q$, 40, $q$JM$q$, NULL, $q$https://www.lcbo.com/en/myers-s-original-dark-rum-30331$q$, $q$retailer$q$),
($q$Le Rhum par Neisson Blanc 52,5$q$, NULL, $q$Rhum Agricole Blanc$q$, $q$Neisson$q$, 52.5, $q$MQ$q$, $q$Rhum de la Martinique$q$, $q$https://neisson.com/nos-rhums/nos-rhums-blancs/$q$, $q$producer$q$),
($q$Neisson Full Proof$q$, NULL, $q$Aged Rhum Agricole$q$, $q$Neisson$q$, NULL, $q$MQ$q$, $q$Rhum de la Martinique$q$, $q$https://neisson.com/nos-rhums/nos-rhums-vieux/$q$, $q$producer$q$),
($q$Neisson Le Rhum Bio$q$, NULL, $q$Rhum Agricole Blanc$q$, $q$Neisson$q$, 52.5, $q$MQ$q$, $q$Rhum de la Martinique$q$, $q$https://neisson.com/nos-rhums/nos-rhums-bio/$q$, $q$producer$q$),
($q$Neisson Profil 105$q$, NULL, $q$Aged Rhum Agricole$q$, $q$Neisson$q$, 54.2, $q$MQ$q$, $q$Rhum de la Martinique$q$, $q$https://neisson.com/$q$, $q$producer$q$),
($q$Neisson Rhum Blanc 50$q$, NULL, $q$Rhum Agricole Blanc$q$, $q$Neisson$q$, 50, $q$MQ$q$, $q$Rhum de la Martinique$q$, $q$https://neisson.com/nos-rhums/nos-rhums-blancs/$q$, $q$producer$q$),
($q$Neisson Rhum Vieux$q$, NULL, $q$Aged Rhum Agricole$q$, $q$Neisson$q$, 45, $q$MQ$q$, $q$Rhum de la Martinique$q$, $q$https://neisson.com/$q$, $q$producer$q$),
($q$Neisson XO$q$, NULL, $q$Aged Rhum Agricole$q$, $q$Neisson$q$, 48.5, $q$MQ$q$, $q$Rhum de la Martinique$q$, $q$https://neisson.com/nos-rhums/nos-rhums-vieux/$q$, $q$producer$q$),
($q$Novo Fogo Barrel-Aged$q$, NULL, $q$Aged Cachaça$q$, $q$Novo Fogo$q$, 40, $q$BR$q$, $q$Cachaça$q$, $q$https://novofogo.com/organic-cachacas/$q$, $q$producer$q$),
($q$Novo Fogo Chameleon$q$, NULL, $q$Aged Cachaça$q$, $q$Novo Fogo$q$, NULL, $q$BR$q$, $q$Cachaça$q$, $q$https://novofogo.com/organic-cachacas/$q$, $q$producer$q$),
($q$Novo Fogo Colibri$q$, NULL, $q$Aged Cachaça$q$, $q$Novo Fogo$q$, 42, $q$BR$q$, $q$Cachaça$q$, $q$https://novofogo.com/organic-cachacas/$q$, $q$producer$q$),
($q$Novo Fogo Graciosa$q$, NULL, $q$Aged Cachaça$q$, $q$Novo Fogo$q$, NULL, $q$BR$q$, $q$Cachaça$q$, $q$https://novofogo.com/organic-cachacas/$q$, $q$producer$q$),
($q$Novo Fogo Passion Fruit Cachaça$q$, NULL, $q$Cachaça$q$, $q$Novo Fogo$q$, 40, $q$BR$q$, $q$Cachaça$q$, $q$https://novofogo.com/organic-cachacas/$q$, $q$producer$q$),
($q$Novo Fogo Silver$q$, $q$Novo Fogo Silver Cachaça$q$, $q$White Cachaça$q$, $q$Novo Fogo$q$, 40, $q$BR$q$, $q$Cachaça$q$, $q$https://novofogo.com/organic-cachacas/$q$, $q$producer$q$),
($q$Novo Fogo Silver Bar Strength$q$, NULL, $q$White Cachaça$q$, $q$Novo Fogo$q$, 43, $q$BR$q$, $q$Cachaça$q$, $q$https://novofogo.com/organic-cachacas/$q$, $q$producer$q$),
($q$Novo Fogo Tanager$q$, $q$Novo Fogo Tanager Cachaça$q$, $q$Aged Cachaça$q$, $q$Novo Fogo$q$, NULL, $q$BR$q$, $q$Cachaça$q$, $q$https://novofogo.com/organic-cachacas/$q$, $q$producer$q$),
($q$False River Barrel Aged Spiced Rum$q$, NULL, $q$Spiced Rum$q$, $q$Oxbow Rum Distillery$q$, NULL, $q$US$q$, NULL, $q$https://www.oxbowrumdistillery.com/$q$, $q$producer$q$),
($q$False River Dark Rum$q$, NULL, $q$Dark Rum$q$, $q$Oxbow Rum Distillery$q$, NULL, $q$US$q$, NULL, $q$https://www.oxbowrumdistillery.com/$q$, $q$producer$q$),
($q$False River Spiced Rum$q$, NULL, $q$Spiced Rum$q$, $q$Oxbow Rum Distillery$q$, 44, $q$US$q$, NULL, $q$https://www.oxbowrumdistillery.com/$q$, $q$producer$q$),
($q$Oxbow Estate Barrel Aged Straight Rum$q$, NULL, $q$Aged Rum$q$, $q$Oxbow Rum Distillery$q$, NULL, $q$US$q$, NULL, $q$https://www.oxbowrumdistillery.com/oxbow-estate-rum/$q$, $q$producer$q$),
($q$Oxbow Estate Rhum Louisiane$q$, $q$Oxbow Rhum Louisiane$q$, $q$Rhum Agricole Blanc$q$, $q$Oxbow Rum Distillery$q$, NULL, $q$US$q$, NULL, $q$https://www.oxbowrumdistillery.com/oxbow-estate-rum/$q$, $q$producer$q$),
($q$Oxbow Estate Small Batch White Rum$q$, NULL, $q$White Rum$q$, $q$Oxbow Rum Distillery$q$, NULL, $q$US$q$, NULL, $q$https://www.oxbowrumdistillery.com/oxbow-estate-rum/$q$, $q$producer$q$),
($q$Paranubes Añejo$q$, NULL, $q$Aged Rum$q$, $q$Paranubes$q$, 54, NULL, NULL, $q$https://www.paranubes.com/products$q$, $q$producer$q$),
($q$Paranubes Blanco$q$, $q$Paranubes Oaxaca Rum$q$, $q$Rum$q$, $q$Paranubes$q$, 54, NULL, NULL, $q$https://www.paranubes.com/products$q$, $q$producer$q$),
($q$Phraya Deep Matured Gold Rum$q$, $q$Phraya Gold Rum$q$, $q$Gold Rum$q$, $q$Phraya$q$, NULL, NULL, NULL, $q$https://phrayarum.com/$q$, $q$producer$q$),
($q$Phraya Rum Elements$q$, NULL, $q$Rum$q$, $q$Phraya$q$, NULL, NULL, NULL, $q$https://phrayarum.com/$q$, $q$producer$q$),
($q$Phraya Rum Elements 8 Years$q$, $q$Phraya Elements 8 Rum$q$, $q$Aged Rum$q$, $q$Phraya$q$, NULL, NULL, NULL, $q$https://phrayarum.com/$q$, $q$producer$q$),
($q$Pitú Gold$q$, NULL, $q$Aged Cachaça$q$, $q$Pitú$q$, 39, $q$BR$q$, NULL, $q$https://pitu.com.br/produtos/pitu-gold/$q$, $q$producer$q$),
($q$Planteray Barbados 5 Years$q$, $q$Planteray Barbados 5 Year Old Rum$q$, $q$Aged Rum$q$, $q$Planteray$q$, NULL, $q$BB$q$, NULL, $q$https://planterayrum.com/product/five-years/$q$, $q$producer$q$),
($q$Planteray Gran Añejo$q$, NULL, $q$Aged Rum$q$, $q$Planteray$q$, NULL, NULL, NULL, $q$https://planterayrum.com/product/gran-anejo/$q$, $q$producer$q$),
($q$Planteray Grande Réserve$q$, NULL, $q$Aged Rum$q$, $q$Planteray$q$, NULL, $q$BB$q$, NULL, $q$https://planterayrum.com/product/grande-reserve/$q$, $q$producer$q$),
($q$Planteray Isle of Fiji$q$, $q$Planteray Fiji$q$, $q$Gold Rum$q$, $q$Planteray$q$, NULL, $q$FJ$q$, NULL, $q$https://planterayrum.com/product/isle-of-fiji/$q$, $q$producer$q$),
($q$Planteray O.F.T.D.$q$, $q$Planteray O.F.T.D.$q$, $q$Overproof Rum$q$, $q$Planteray$q$, 69, NULL, NULL, $q$https://planterayrum.com/product/oftd/$q$, $q$producer$q$),
($q$Planteray PXXO 20th Anniversary$q$, NULL, $q$Aged Rum$q$, $q$Planteray$q$, NULL, $q$BB$q$, NULL, $q$https://planterayrum.com/product/planteray-pxxo/$q$, $q$producer$q$),
($q$Planteray Sealander$q$, NULL, $q$Rum$q$, $q$Planteray$q$, NULL, NULL, NULL, $q$https://planterayrum.com/product/sealander/$q$, $q$producer$q$),
($q$Planteray Stiggins' Fancy Pineapple$q$, $q$Planteray Stiggins' Fancy Pineapple Rum$q$, $q$Pineapple Rum$q$, $q$Planteray$q$, NULL, NULL, NULL, $q$https://planterayrum.com/product/stiggins-fancy-pineapple/$q$, $q$producer$q$),
($q$Planteray XO 20th Anniversary$q$, $q$Planteray XO 20th Anniversary$q$, $q$Aged Rum$q$, $q$Planteray$q$, NULL, $q$BB$q$, NULL, $q$https://planterayrum.com/product/barbados-xo/$q$, $q$producer$q$),
($q$Planteray Xaymaca Special Dry$q$, $q$Planteray Xaymaca Special Dry Rum$q$, $q$Jamaican Rum$q$, $q$Planteray$q$, NULL, $q$JM$q$, NULL, $q$https://planterayrum.com/product/xaymaca/$q$, $q$producer$q$),
($q$Rhum J.M Atelier Épices Créoles$q$, $q$Rhum J.M Épices Créoles$q$, $q$Rhum Agricole$q$, $q$Rhum J.M$q$, 46, $q$MQ$q$, NULL, $q$https://www.rhum-jm.com/en/our-rhums/$q$, $q$producer$q$),
($q$Rhum J.M Blanc 55$q$, NULL, $q$Rhum Agricole Blanc$q$, $q$Rhum J.M$q$, 55, $q$MQ$q$, NULL, $q$https://www.rhum-jm.com/en/our-rhums/$q$, $q$producer$q$),
($q$Rhum J.M VO Terroir Volcanique$q$, $q$Rhum J.M Volcanique$q$, $q$Aged Rhum Agricole$q$, $q$Rhum J.M$q$, 43, $q$MQ$q$, NULL, $q$https://www.rhum-jm.com/en/our-rhums/$q$, $q$producer$q$),
($q$Rhum J.M VSOP$q$, $q$Rhum J.M VSOP$q$, $q$Aged Rhum Agricole$q$, $q$Rhum J.M$q$, 43, $q$MQ$q$, NULL, $q$https://www.rhum-jm.com/en/our-rhums/$q$, $q$producer$q$),
($q$Rhum J.M XO$q$, NULL, $q$Aged Rhum Agricole$q$, $q$Rhum J.M$q$, 45, $q$MQ$q$, NULL, $q$https://www.rhum-jm.com/en/our-rhums/$q$, $q$producer$q$),
($q$Ron Abuelo 12 Años$q$, NULL, $q$Aged Rum$q$, $q$Ron Abuelo$q$, NULL, NULL, NULL, $q$https://backend.ronabuelo.com/api/v1/korit/products$q$, $q$producer$q$),
($q$Ron Abuelo 7 Años$q$, $q$Ron Abuelo 7 Años$q$, $q$Aged Rum$q$, $q$Ron Abuelo$q$, NULL, NULL, NULL, $q$https://backend.ronabuelo.com/api/v1/korit/products$q$, $q$producer$q$),
($q$Ron Abuelo Añejo$q$, NULL, $q$Aged Rum$q$, $q$Ron Abuelo$q$, NULL, NULL, NULL, $q$https://backend.ronabuelo.com/api/v1/korit/products$q$, $q$producer$q$),
($q$Ron Abuelo Napoleon$q$, NULL, $q$Aged Rum$q$, $q$Ron Abuelo$q$, 40, NULL, NULL, $q$https://backend.ronabuelo.com/api/v1/korit/products$q$, $q$producer$q$),
($q$Ron Abuelo Oloroso$q$, NULL, $q$Aged Rum$q$, $q$Ron Abuelo$q$, 40, NULL, NULL, $q$https://backend.ronabuelo.com/api/v1/korit/products$q$, $q$producer$q$),
($q$Ron Abuelo Tawny$q$, NULL, $q$Aged Rum$q$, $q$Ron Abuelo$q$, 40, NULL, NULL, $q$https://backend.ronabuelo.com/api/v1/korit/products$q$, $q$producer$q$),
($q$Ron Abuelo Two Oaks$q$, NULL, $q$Aged Rum$q$, $q$Ron Abuelo$q$, 40, NULL, NULL, $q$https://backend.ronabuelo.com/api/v1/korit/products$q$, $q$producer$q$),
($q$Ron Colón Salvadoreño Coffee Infused$q$, NULL, $q$Rum$q$, $q$Ron Colón Salvadoreño$q$, 40.5, NULL, NULL, $q$https://roncolon.com/products/$q$, $q$producer$q$),
($q$Ron Colón Salvadoreño Dark Aged High Proof$q$, NULL, $q$Dark Rum$q$, $q$Ron Colón Salvadoreño$q$, 55.5, NULL, NULL, $q$https://roncolon.com/products/$q$, $q$producer$q$),
($q$Ron Colón Salvadoreño Dark Aged Rum$q$, $q$Ron Colón Salvadoreño$q$, $q$Aged Rum$q$, $q$Ron Colón Salvadoreño$q$, 40.5, NULL, NULL, $q$https://roncolon.com/products/$q$, $q$producer$q$),
($q$Ron Matusalem Añejo$q$, NULL, $q$Aged Rum$q$, $q$Ron Matusalem$q$, NULL, $q$DO$q$, NULL, $q$https://matusalem.com/ron-matusalem-anejo/$q$, $q$producer$q$),
($q$Ron Matusalem Enigma American Oak$q$, NULL, $q$Rum$q$, $q$Ron Matusalem$q$, NULL, $q$DO$q$, NULL, $q$https://matusalem.com/ron-matusalem-enigma-american-oak/$q$, $q$producer$q$),
($q$Ron Matusalem Enigma French Oak$q$, NULL, $q$Rum$q$, $q$Ron Matusalem$q$, NULL, $q$DO$q$, NULL, $q$https://matusalem.com/ron-matusalem-enigma-french-oak/$q$, $q$producer$q$),
($q$Ron Matusalem Gran Reserva 15$q$, NULL, $q$Aged Rum$q$, $q$Ron Matusalem$q$, NULL, $q$DO$q$, NULL, $q$https://matusalem.com/ron-matusalem-gran-reserva-15/$q$, $q$producer$q$),
($q$Ron Matusalem Platino$q$, NULL, $q$White Rum$q$, $q$Ron Matusalem$q$, NULL, $q$DO$q$, NULL, $q$https://matusalem.com/ron-matusalem-platino/$q$, $q$producer$q$),
($q$Ron Matusalem Solera 7$q$, NULL, $q$Aged Rum$q$, $q$Ron Matusalem$q$, NULL, $q$DO$q$, NULL, $q$https://matusalem.com/ron-matusalem-solera-7/$q$, $q$producer$q$),
($q$Ron Santiago de Cuba Añejo 8 Años$q$, $q$Ron Santiago de Cuba Añejo 8 Años$q$, $q$Aged Rum$q$, $q$Ron Santiago de Cuba$q$, NULL, $q$CU$q$, NULL, $q$https://www.ronsantiagodecuba.com/rum/$q$, $q$producer$q$),
($q$Ron Santiago de Cuba Carta Blanca$q$, NULL, $q$White Rum$q$, $q$Ron Santiago de Cuba$q$, NULL, $q$CU$q$, NULL, $q$https://www.ronsantiagodecuba.com/rum/$q$, $q$producer$q$),
($q$Ron Santiago de Cuba Extra Añejo 11 Años$q$, $q$Ron Santiago de Cuba Extra Añejo 11 Años$q$, $q$Aged Rum$q$, $q$Ron Santiago de Cuba$q$, NULL, $q$CU$q$, NULL, $q$https://www.ronsantiagodecuba.com/rum/$q$, $q$producer$q$),
($q$Ron Santiago de Cuba Extra Añejo 12 Años$q$, NULL, $q$Aged Rum$q$, $q$Ron Santiago de Cuba$q$, NULL, $q$CU$q$, NULL, $q$https://www.ronsantiagodecuba.com/rum/$q$, $q$producer$q$),
($q$Ron del Barrilito Four Stars$q$, NULL, $q$Aged Rum$q$, $q$Ron del Barrilito$q$, NULL, NULL, NULL, $q$https://rondelbarrilito.com/our-products/$q$, $q$producer$q$),
($q$Ron del Barrilito Three Stars$q$, $q$Ron del Barrilito 3 Stars Rum$q$, $q$Aged Rum$q$, $q$Ron del Barrilito$q$, NULL, NULL, NULL, $q$https://rondelbarrilito.com/our-products/$q$, $q$producer$q$),
($q$Ron del Barrilito Two Stars$q$, $q$Ron Del Barrilito Two Stars Rum$q$, $q$Aged Rum$q$, $q$Ron del Barrilito$q$, NULL, NULL, NULL, $q$https://rondelbarrilito.com/our-products/$q$, $q$producer$q$),
($q$Bati Dark$q$, NULL, $q$Dark Rum$q$, $q$Rum Co. of Fiji$q$, 37.5, $q$FJ$q$, NULL, $q$https://rumcooffiji.com/explore-the-range-bati/bati-dark/$q$, $q$producer$q$),
($q$Bati Spiced$q$, NULL, $q$Spiced Rum$q$, $q$Rum Co. of Fiji$q$, 37.5, $q$FJ$q$, NULL, $q$https://rumcooffiji.com/explore-the-range-bati/bati-spiced/$q$, $q$producer$q$),
($q$Bati White$q$, NULL, $q$White Rum$q$, $q$Rum Co. of Fiji$q$, 37.5, $q$FJ$q$, NULL, $q$https://rumcooffiji.com/explore-the-range-bati/bati-white/$q$, $q$producer$q$),
($q$Ratu Dark$q$, NULL, $q$Dark Rum$q$, $q$Rum Co. of Fiji$q$, 40, $q$FJ$q$, NULL, $q$https://rumcooffiji.com/explore-the-range/ratu-dark/$q$, $q$producer$q$),
($q$Ratu Signature$q$, NULL, $q$Aged Rum$q$, $q$Rum Co. of Fiji$q$, 35, $q$FJ$q$, NULL, $q$https://rumcooffiji.com/explore-the-range/ratu-signature/$q$, $q$producer$q$),
($q$Ratu White$q$, NULL, $q$White Rum$q$, $q$Rum Co. of Fiji$q$, 40, $q$FJ$q$, NULL, $q$https://rumcooffiji.com/explore-the-range/ratu-white/$q$, $q$producer$q$),
($q$Sailor Jerry Spiced$q$, $q$Sailor Jerry Spiced Rum$q$, $q$Spiced Rum$q$, $q$Sailor Jerry$q$, 46, NULL, NULL, $q$https://www.bcliquorstores.com/product/723224$q$, $q$retailer$q$),
($q$Saint James Blanc 55$q$, NULL, $q$Rhum Agricole Blanc$q$, $q$Saint James$q$, 55, $q$MQ$q$, NULL, $q$https://rhum-saintjames.com/en/produit/blanc-agricole-55/$q$, $q$producer$q$),
($q$Saint James Coeur de Chauffe$q$, NULL, $q$Rhum Agricole Blanc$q$, $q$Saint James$q$, 60, $q$MQ$q$, NULL, $q$https://rhum-saintjames.com/en/produit/coeur-de-chauffe/$q$, $q$producer$q$),
($q$Saint James Extra Old$q$, $q$Saint James XO Rum$q$, $q$Aged Rhum Agricole$q$, $q$Saint James$q$, 43, $q$MQ$q$, NULL, $q$https://rhum-saintjames.com/en/produit/rhum-extra-old/$q$, $q$producer$q$),
($q$Saint James Fleur de Canne$q$, $q$Saint James Fleur de Canne Rhum Agricole$q$, $q$Rhum Agricole Blanc$q$, $q$Saint James$q$, 50, $q$MQ$q$, NULL, $q$https://rhum-saintjames.com/en/produit/fleur-de-canne/$q$, $q$producer$q$),
($q$Saint James Impérial Blanc$q$, NULL, $q$Rhum Agricole Blanc$q$, $q$Saint James$q$, 40, $q$MQ$q$, NULL, $q$https://rhum-saintjames.com/en/produit/imperial-blanc-agricole/$q$, $q$producer$q$),
($q$Saint James Paille$q$, NULL, $q$Aged Rhum Agricole$q$, $q$Saint James$q$, 40, $q$MQ$q$, NULL, $q$https://rhum-saintjames.com/en/produit/rhum-paille-agricole/$q$, $q$producer$q$),
($q$Saint James Royal Ambré$q$, NULL, $q$Aged Rhum Agricole$q$, $q$Saint James$q$, 40, $q$MQ$q$, NULL, $q$https://rhum-saintjames.com/en/produit/rhum-ambre-agricole/$q$, $q$producer$q$),
($q$Saint James Vieux 12 Ans$q$, NULL, $q$Aged Rhum Agricole$q$, $q$Saint James$q$, 43, $q$MQ$q$, NULL, $q$https://rhum-saintjames.com/en/produit/rhum-vieux-12-ans/$q$, $q$producer$q$),
($q$Saint James Vieux 15 Ans$q$, NULL, $q$Aged Rhum Agricole$q$, $q$Saint James$q$, 43, $q$MQ$q$, NULL, $q$https://rhum-saintjames.com/en/produit/rhum-vieux-15-ans/$q$, $q$producer$q$),
($q$Saint James Vieux 3 Ans$q$, NULL, $q$Aged Rhum Agricole$q$, $q$Saint James$q$, 42, $q$MQ$q$, NULL, $q$https://rhum-saintjames.com/en/produit/rhum-vieux-3-ans/$q$, $q$producer$q$),
($q$Saint James Vieux VSOP$q$, NULL, $q$Aged Rhum Agricole$q$, $q$Saint James$q$, 43, $q$MQ$q$, NULL, $q$https://rhum-saintjames.com/en/produit/rhum-vieux-vsop/$q$, $q$producer$q$),
($q$Admiral Rodney$q$, NULL, $q$Aged Rum$q$, $q$Saint Lucia Distillers$q$, NULL, $q$LC$q$, NULL, $q$https://www.stluciadistillers.com/our-rums$q$, $q$producer$q$),
($q$Bounty$q$, NULL, $q$Rum$q$, $q$Saint Lucia Distillers$q$, NULL, $q$LC$q$, NULL, $q$https://www.stluciadistillers.com/our-rums$q$, $q$producer$q$),
($q$Denros Overproof$q$, NULL, $q$Overproof Rum$q$, $q$Saint Lucia Distillers$q$, NULL, $q$LC$q$, NULL, $q$https://www.stluciadistillers.com/our-rums$q$, $q$producer$q$),
($q$Santa Teresa 1796$q$, $q$Santa Teresa 1796 Rum$q$, $q$Aged Rum$q$, $q$Santa Teresa$q$, 40, NULL, NULL, $q$https://www.santateresarum.com/santa-teresa-1796/$q$, $q$producer$q$),
($q$Smith & Cross$q$, $q$Smith & Cross Traditional Jamaica Rum$q$, $q$Overproof Jamaican Rum$q$, $q$Smith & Cross$q$, 57, $q$JM$q$, NULL, $q$https://smithandcrossrum.com/$q$, $q$producer$q$),
($q$Captain Bligh XO$q$, NULL, $q$Aged Rum$q$, $q$St. Vincent Distillers$q$, NULL, $q$VC$q$, NULL, $q$https://www.sunsetrum.com/$q$, $q$producer$q$),
($q$Sparrow's Premium Aged Rum$q$, NULL, $q$Aged Rum$q$, $q$St. Vincent Distillers$q$, NULL, $q$VC$q$, NULL, $q$https://www.sunsetrum.com/$q$, $q$producer$q$),
($q$Sunset Light Rum$q$, NULL, $q$White Rum$q$, $q$St. Vincent Distillers$q$, 40, $q$VC$q$, NULL, $q$https://www.sunsetrum.com/$q$, $q$producer$q$),
($q$Sunset Very Strong$q$, $q$Sunset Very Strong Rum$q$, $q$Overproof Rum$q$, $q$St. Vincent Distillers$q$, NULL, $q$VC$q$, NULL, $q$https://www.sunsetrum.com/$q$, $q$producer$q$),
($q$Stroh 40$q$, NULL, $q$Spiced Rum$q$, $q$Stroh$q$, NULL, $q$AT$q$, $q$Inländerrum$q$, $q$https://www.stroh.at/stroh-sortiment/$q$, $q$producer$q$),
($q$Stroh 60$q$, NULL, $q$Overproof Rum$q$, $q$Stroh$q$, NULL, $q$AT$q$, $q$Inländerrum$q$, $q$https://www.stroh.at/stroh-sortiment/$q$, $q$producer$q$),
($q$Stroh 80$q$, $q$Stroh 80$q$, $q$Overproof Rum$q$, $q$Stroh$q$, NULL, $q$AT$q$, $q$Inländerrum$q$, $q$https://www.stroh.at/stroh-sortiment/$q$, $q$producer$q$),
($q$Takamaka Dark Spiced$q$, NULL, $q$Spiced Rum$q$, $q$Takamaka$q$, NULL, $q$SC$q$, NULL, $q$https://www.takamakarum.com/series-dark-spiced$q$, $q$producer$q$),
($q$Takamaka Extra Noir$q$, $q$Takamaka Extra Noir$q$, $q$Dark Rum$q$, $q$Takamaka$q$, 43, $q$SC$q$, NULL, $q$https://www.takamakarum.com/st-andre-extra-noir$q$, $q$producer$q$),
($q$Takamaka Grankaz$q$, NULL, $q$Rum$q$, $q$Takamaka$q$, 45.1, NULL, NULL, $q$https://www.takamakarum.com/st-andre-grankaz$q$, $q$producer$q$),
($q$Takamaka Overproof$q$, NULL, $q$Overproof Rum$q$, $q$Takamaka$q$, 69, $q$SC$q$, NULL, $q$https://www.takamakarum.com/series-overproof$q$, $q$producer$q$),
($q$Takamaka Pti Lakaz$q$, NULL, $q$Rum$q$, $q$Takamaka$q$, 45.1, NULL, NULL, $q$https://www.takamakarum.com/st-andre-pti-lakaz$q$, $q$producer$q$),
($q$Takamaka Rum Blanc$q$, NULL, $q$White Rum$q$, $q$Takamaka$q$, NULL, $q$SC$q$, NULL, $q$https://www.takamakarum.com/series-rum-blanc$q$, $q$producer$q$),
($q$Takamaka Rum Zenn$q$, NULL, $q$White Rum$q$, $q$Takamaka$q$, NULL, $q$SC$q$, NULL, $q$https://www.takamakarum.com/series-rumzenn$q$, $q$producer$q$),
($q$Takamaka Zepis Kreol$q$, NULL, $q$Spiced Rum$q$, $q$Takamaka$q$, 43, $q$SC$q$, NULL, $q$https://www.takamakarum.com/st-andre-zepis$q$, $q$producer$q$),
($q$Ten To One Dark Rum$q$, $q$Ten to One Dark Rum$q$, $q$Dark Rum$q$, $q$Ten To One$q$, 40, NULL, NULL, $q$https://www.tentoonerum.com/dark-rum/$q$, $q$producer$q$),
($q$Ten To One Five Origin Select$q$, NULL, $q$Rum$q$, $q$Ten To One$q$, NULL, NULL, NULL, $q$https://www.tentoonerum.com/our-rums/$q$, $q$producer$q$),
($q$Ten To One Oloroso Sherry Cask Select$q$, NULL, $q$Rum$q$, $q$Ten To One$q$, 46, NULL, NULL, $q$https://www.tentoonerum.com/our-rums/$q$, $q$producer$q$),
($q$Ten To One White Rum$q$, $q$Ten To One White Rum$q$, $q$White Rum$q$, $q$Ten To One$q$, 45, NULL, NULL, $q$https://www.tentoonerum.com/white-rum/$q$, $q$producer$q$),
($q$The Duppy Share Aged$q$, NULL, $q$Aged Rum$q$, $q$The Duppy Share$q$, 38, NULL, NULL, $q$https://proofdrinks.com/brands/duppy-share-rum/$q$, $q$retailer$q$),
($q$The Duppy Share Spiced$q$, NULL, $q$Spiced Rum$q$, $q$The Duppy Share$q$, 35, NULL, NULL, $q$https://proofdrinks.com/brands/duppy-share-rum/$q$, $q$retailer$q$),
($q$The Duppy Share White$q$, $q$Duppy White Rum$q$, $q$Jamaican Rum$q$, $q$The Duppy Share$q$, 37.5, $q$JM$q$, NULL, $q$https://proofdrinks.com/brands/duppy-share-rum/$q$, $q$retailer$q$),
($q$The Duppy Share XO$q$, NULL, $q$Aged Rum$q$, $q$The Duppy Share$q$, 40, $q$BB$q$, NULL, $q$https://proofdrinks.com/brands/duppy-share-rum/$q$, $q$retailer$q$),
($q$Kraken Gold Spiced$q$, NULL, $q$Spiced Rum$q$, $q$The Kraken$q$, 35, $q$DO$q$, NULL, $q$https://www.krakenrum.com/products/kraken-gold-spice/$q$, $q$producer$q$),
($q$The Kraken Black Spiced$q$, $q$The Kraken Black Spiced$q$, $q$Spiced Rum$q$, $q$The Kraken$q$, 47, NULL, NULL, $q$https://www.krakenrum.com/$q$, $q$producer$q$),
($q$Trois Rivières Cellar Réserve 4 Ans$q$, NULL, $q$Aged Rhum Agricole$q$, $q$Trois Rivières$q$, 40, $q$MQ$q$, NULL, $q$https://www.troisrivieresrhum.com/our-rhums/tasting-rhums/cellar-reserve/$q$, $q$producer$q$),
($q$Trois Rivières Cuvée de l'Océan$q$, $q$Trois Rivières Cuvée De L'Océan$q$, $q$Rhum Agricole Blanc$q$, $q$Trois Rivières$q$, 42, $q$MQ$q$, NULL, $q$https://www.troisrivieresrhum.com/our-rhums/white-rhums/cuvee-de-locean/$q$, $q$producer$q$),
($q$Trois Rivières Rhum Blanc 40$q$, NULL, $q$Rhum Agricole Blanc$q$, $q$Trois Rivières$q$, 40, $q$MQ$q$, NULL, $q$https://www.troisrivieresrhum.com/our-rhums/white-rhums/rhum-blanc-40/$q$, $q$producer$q$),
($q$Trois Rivières Rhum Blanc 50$q$, NULL, $q$Rhum Agricole Blanc$q$, $q$Trois Rivières$q$, 50, $q$MQ$q$, $q$Rhum de la Martinique$q$, $q$https://www.troisrivieresrhum.com/our-rhums/white-rhums/blanc-50/$q$, $q$producer$q$),
($q$Trois Rivières VO Cuvée du Moulin$q$, NULL, $q$Aged Rhum Agricole$q$, $q$Trois Rivières$q$, 40, $q$MQ$q$, $q$Rhum de la Martinique$q$, $q$https://www.troisrivieresrhum.com/our-rhums/tasting-rhums/vo-cuvee-du-moulin/$q$, $q$producer$q$),
($q$Trois Rivières VSOP Réserve Spéciale$q$, NULL, $q$Aged Rhum Agricole$q$, $q$Trois Rivières$q$, 40, $q$MQ$q$, NULL, $q$https://www.troisrivieresrhum.com/our-rhums/tasting-rhums/vsop-reserve-speciale/$q$, $q$producer$q$),
($q$Trois Rivières XO$q$, NULL, $q$Aged Rhum Agricole$q$, $q$Trois Rivières$q$, 43, $q$MQ$q$, $q$Rhum de la Martinique$q$, $q$https://www.troisrivieresrhum.com/our-rhums/tasting-rhums/xo/$q$, $q$producer$q$),
($q$Velho Barreiro Gold$q$, NULL, $q$Cachaça$q$, $q$Velho Barreiro$q$, 39, $q$BR$q$, NULL, $q$https://tatuzinho.com.br/produtos/detalhes/id/7$q$, $q$producer$q$),
($q$Velho Barreiro Reserva Ouro$q$, NULL, $q$Cachaça$q$, $q$Velho Barreiro$q$, 39, $q$BR$q$, NULL, $q$https://tatuzinho.com.br/produtos/detalhes/id/3$q$, $q$producer$q$),
($q$Velho Barreiro Reserva Prata$q$, NULL, $q$White Cachaça$q$, $q$Velho Barreiro$q$, 39, $q$BR$q$, NULL, $q$https://tatuzinho.com.br/produtos/detalhes/id/18$q$, $q$producer$q$),
($q$Velho Barreiro Tradicional$q$, $q$Velho Barreiro Cachaça$q$, $q$White Cachaça$q$, $q$Velho Barreiro$q$, 39, $q$BR$q$, NULL, $q$https://tatuzinho.com.br/produtos/detalhes/id/1$q$, $q$producer$q$),
($q$Rum-Bar Gold$q$, $q$Rum-Bar Gold Rum$q$, $q$Jamaican Rum$q$, $q$Worthy Park$q$, 40, $q$JM$q$, NULL, $q$https://worthyparkestate.com/spirit/rum-bar-gold/$q$, $q$producer$q$),
($q$Rum-Bar White Overproof$q$, $q$Rum-Bar White Overproof Rum$q$, $q$Overproof Jamaican Rum$q$, $q$Worthy Park$q$, 63, $q$JM$q$, NULL, $q$https://worthyparkestate.com/spirit/rum-bar-white-overproof/$q$, $q$producer$q$),
($q$Worthy Park 109$q$, $q$Worthy Park 109 Rum$q$, $q$Jamaican Rum$q$, $q$Worthy Park$q$, 54.5, $q$JM$q$, NULL, $q$https://worthyparkestate.com/spirit/worthy-park-109/$q$, $q$producer$q$),
($q$Worthy Park Overproof$q$, NULL, $q$Overproof Jamaican Rum$q$, $q$Worthy Park$q$, 63, $q$JM$q$, NULL, $q$https://worthyparkestate.com/spirit/worthy-park-overproof/$q$, $q$producer$q$),
($q$Worthy Park Select$q$, $q$Worthy Park Select Rum$q$, $q$Jamaican Rum$q$, $q$Worthy Park$q$, 40, $q$JM$q$, NULL, $q$https://worthyparkestate.com/spirit/worthy-park-select/$q$, $q$producer$q$),
($q$Worthy Park Silver$q$, $q$Worthy Park Silver Rum$q$, $q$Jamaican Rum$q$, $q$Worthy Park$q$, 40, $q$JM$q$, NULL, $q$https://worthyparkestate.com/spirit/worthy-park-silver/$q$, $q$producer$q$),
($q$Worthy Park Single Estate 12 Year$q$, NULL, $q$Aged Jamaican Rum$q$, $q$Worthy Park$q$, 50, $q$JM$q$, NULL, $q$https://worthyparkestate.com/spirit/worthy-park-single-estate-12-year/$q$, $q$producer$q$),
($q$Worthy Park Single Estate Reserve$q$, $q$Worthy Park Single Estate Reserve Rum$q$, $q$Aged Jamaican Rum$q$, $q$Worthy Park$q$, 45, $q$JM$q$, NULL, $q$https://worthyparkestate.com/spirit/worthy-park-single-estate-reserve/$q$, $q$producer$q$),
($q$Koko Kanu$q$, $q$Koko Kanu Coconut Rum$q$, $q$Coconut Rum$q$, $q$Wray & Nephew$q$, 37.5, $q$JM$q$, NULL, $q$https://farehamwinecellar.co.uk/Products/spirit/rum/jamaican-rum/flavoured-rum-jamaican-rum/koko-kanu-coconut-rum/$q$, $q$retailer$q$),
($q$Wray & Nephew White Overproof$q$, $q$Wray & Nephew White Overproof Rum$q$, $q$Overproof Jamaican Rum$q$, $q$Wray & Nephew$q$, 63, $q$JM$q$, $q$Jamaica Rum$q$, $q$https://www.wrayandnephew.com/en-gb/white-overproof-rum/$q$, $q$producer$q$),
($q$Zacapa Edición Negra$q$, NULL, $q$Aged Rum$q$, $q$Zacapa$q$, 43, $q$GT$q$, NULL, $q$https://www.zacaparum.com/en-us/rums/zacapa-edicion-negra$q$, $q$producer$q$),
($q$Zacapa No. 23$q$, $q$Ron Zacapa Sistema Solera 23$q$, $q$Aged Rum$q$, $q$Zacapa$q$, 40, $q$GT$q$, NULL, $q$https://www.zacaparum.com/en-us/rums/zacapa-23-centenario$q$, $q$producer$q$),
($q$Zacapa XO$q$, $q$Ron Zacapa XO Rum$q$, $q$Aged Rum$q$, $q$Zacapa$q$, 40, $q$GT$q$, NULL, $q$https://www.zacaparum.com/en-us/rums/zacapa-xo$q$, $q$producer$q$);

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
    WHEN b.style IN ($q$Rum$q$, $q$White Rum$q$, $q$Gold Rum$q$, $q$Dark Rum$q$, $q$Aged Rum$q$, $q$Aged Cachaça$q$, $q$Cachaça$q$) AND EXISTS (
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
