-- Brandy and eau-de-vie: every bottle checked on its producer's own page
-- (or, where that page was blocked, a major retailer, importer or
-- Difford's), after 20261011163000. Step 3g of the bottle catalog plan:
-- https://claude.ai/artifact/Vu6seuSNtN42nKYb2nDCVR
--
--   * The core range of every cognac, armagnac, calvados, apple brandy,
--     eau-de-vie, grappa, pisco and grape brandy house in our catalog
--     or on BC Liquor's list.
--   * On a copy of production (2026-10-09, with the loads before this
--     one applied): 285 new bottles, and 100 we had that get their
--     label name (61 renamed, the old name kept as an alias), style,
--     ABV, country, protected name and maker where they were missing or
--     wrong.
--   * Styles: Cognac, Armagnac (and blanche), Calvados, applejack and
--     apple brandy, Poire Williams and pear brandy, kirsch, plum
--     brandy, raspberry and quince eau-de-vie, grappa, pisco (and
--     acholado), singani, brandy de Jerez and other grape brandies by
--     country.
--   * Out of scope: fruit liqueurs, pommeau and other mistelles,
--     flavoured brandies.
--   * Each producer gets an unclaimed maker page (makes: bottles), or a
--     page an earlier load made gains it, and each bottle names it.
--   * Every fact keeps the page it was checked on in item_sources. An
--     ABV read off another page isn't kept, and a review site isn't a
--     source.
--   * An independent second check of 100 random rows found 7 wrong
--     facts in 547 (1.3%). Every correction is taken: Massenez's
--     mirabelle is its VRP; Louis Royer Force 53 is the VSOP; Rhine
--     Hall's pineapple eau-de-vie is made in Mexico; Berta Casalotto is
--     a wine brandy (Italian Brandy, no Grappa GI); Berta Oltre (a
--     line, not one bottle) stays out; Cardenal Mendoza loses a vague
--     catalog match. The armagnac-castarede.fr shop was flagged for
--     card-skimming script, so no page there is a source.
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
(0, $q$Brandy$q$, NULL);

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
($q$Cognac VSOP$q$),
($q$Blanche De Normandie$q$),
($q$Fine De Bourgogne$q$);

-- ---------------------------------------------------------------------------
-- Maker pages
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE maker_in (name text PRIMARY KEY, handle text NOT NULL, website text, country text, part_of text);
INSERT INTO maker_in VALUES
($q$30&40$q$, $q$30.40$q$, $q$https://30et40.fr/en$q$, $q$FR$q$, NULL),
($q$Argonaut$q$, $q$argonaut$q$, $q$https://www.argonautbrandy.com$q$, $q$US$q$, NULL),
($q$Asbach$q$, $q$asbach$q$, $q$https://asbach.de$q$, $q$DE$q$, NULL),
($q$Avallen$q$, $q$avallen$q$, $q$https://www.avallenspirits.com$q$, $q$FR$q$, NULL),
($q$BarSol$q$, $q$barsol$q$, $q$https://specialitybrands.com/range/barsol-pisco/$q$, $q$PE$q$, NULL),
($q$Berta$q$, $q$berta$q$, $q$https://www.distillerieberta.it$q$, $q$IT$q$, NULL),
($q$Bertoux$q$, $q$bertoux$q$, $q$https://www.bertouxbrandy.com$q$, $q$US$q$, NULL),
($q$Bodega San Nicolás$q$, $q$bodega.san.nicolas$q$, NULL, $q$PE$q$, NULL),
($q$Bottega$q$, $q$bottega$q$, $q$https://www.bottegaspa.com$q$, $q$IT$q$, NULL),
($q$Boulard$q$, $q$boulard$q$, $q$https://www.calvados-boulard.com$q$, $q$FR$q$, NULL),
($q$Busnel$q$, $q$busnel$q$, $q$https://www.distillerie-busnel.fr$q$, $q$FR$q$, NULL),
($q$Campo de Encanto$q$, $q$campo.de.encanto$q$, $q$https://www.encantopisco.com$q$, $q$PE$q$, NULL),
($q$Capurro$q$, $q$capurro$q$, $q$https://www.piscocapurro.com$q$, $q$PE$q$, NULL),
($q$Caravedo$q$, $q$caravedo$q$, $q$https://caravedopisco.com$q$, $q$PE$q$, NULL),
($q$Casa Real$q$, $q$casa.real$q$, $q$https://www.singani63.com$q$, $q$BO$q$, NULL),
($q$Castarède$q$, $q$castarede$q$, $q$https://www.armagnac-castarede.fr$q$, $q$FR$q$, NULL),
($q$Christian Drouin$q$, $q$christian.drouin$q$, $q$https://www.calvados-drouin.com$q$, $q$FR$q$, NULL),
($q$Clear Creek$q$, $q$clear.creek$q$, $q$https://www.hrdspirits.com/clear-creek-distillery$q$, $q$US$q$, NULL),
($q$Clés des Ducs$q$, $q$cles.des.ducs$q$, NULL, $q$FR$q$, NULL),
($q$Copper & Kings$q$, $q$copper.kings$q$, $q$https://copperandkings.com$q$, $q$US$q$, NULL),
($q$Courvoisier$q$, $q$courvoisier$q$, $q$https://www.courvoisier.com$q$, $q$FR$q$, NULL),
($q$D'Ussé$q$, $q$d.usse$q$, $q$https://www.dusse.com$q$, $q$FR$q$, NULL),
($q$Darroze$q$, $q$darroze$q$, $q$https://darroze-armagnacs.com$q$, $q$FR$q$, NULL),
($q$Dartigalongue$q$, $q$dartigalongue$q$, $q$https://www.dartigalongue.com$q$, $q$FR$q$, NULL),
($q$Delord$q$, $q$delord$q$, $q$https://www.armagnacdelord.com$q$, $q$FR$q$, NULL),
($q$Domaine Dupont$q$, $q$domaine.dupont$q$, $q$https://www.calvados-dupont.com$q$, $q$FR$q$, NULL),
($q$Domaine du Tariquet$q$, $q$domaine.du.tariquet$q$, $q$https://www.tariquet.com$q$, $q$FR$q$, NULL),
($q$E&J$q$, $q$e.j$q$, $q$https://www.ejbrandy.com$q$, $q$US$q$, NULL),
($q$Frapin$q$, $q$frapin$q$, $q$https://www.cognac-frapin.com$q$, $q$FR$q$, NULL),
($q$Fundador$q$, $q$fundador$q$, $q$https://www.gonzalezbyass.com/en/wineries-brands/fundador$q$, $q$ES$q$, NULL),
($q$Germain-Robin$q$, $q$germain.robin$q$, $q$https://www.germain-robin.com$q$, $q$US$q$, NULL),
($q$González Byass$q$, $q$gonzalez.byass$q$, $q$https://www.gonzalezbyass.com$q$, $q$ES$q$, NULL),
($q$Greensand Ridge$q$, $q$greensand.ridge$q$, NULL, $q$GB$q$, NULL),
($q$Hennessy$q$, $q$hennessy$q$, $q$https://www.hennessy.com$q$, $q$FR$q$, NULL),
($q$Hine$q$, $q$hine$q$, $q$https://hine.com$q$, $q$FR$q$, NULL),
($q$Janneau$q$, $q$janneau$q$, $q$https://www.armagnac-janneau.com$q$, $q$FR$q$, NULL),
($q$KWV$q$, $q$kwv$q$, $q$https://kwv.co.za$q$, $q$ZA$q$, NULL),
($q$Klipdrift$q$, $q$klipdrift$q$, $q$https://www.klipdrift.co.za$q$, $q$ZA$q$, NULL),
($q$Korbel$q$, $q$korbel$q$, $q$https://www.korbel.com$q$, $q$US$q$, NULL),
($q$Laird's$q$, $q$laird.s$q$, $q$https://www.lairdandcompany.com$q$, $q$US$q$, NULL),
($q$Larressingle$q$, $q$larressingle$q$, NULL, $q$FR$q$, NULL),
($q$Louis Royer$q$, $q$louis.royer$q$, $q$https://louis-royer.com$q$, $q$FR$q$, NULL),
($q$Lustau$q$, $q$lustau$q$, $q$https://lustau.es$q$, $q$ES$q$, NULL),
($q$Luxardo$q$, $q$luxardo$q$, $q$https://www.luxardo.it$q$, $q$IT$q$, NULL),
($q$Macchu Pisco$q$, $q$macchu.pisco$q$, $q$https://macchupisco.com$q$, $q$PE$q$, NULL),
($q$Manguin$q$, $q$manguin$q$, $q$https://manguin.com$q$, $q$FR$q$, NULL),
($q$Marie Duffau$q$, $q$marie.duffau$q$, NULL, $q$FR$q$, NULL),
($q$Marolo$q$, $q$marolo$q$, $q$https://www.marolo.com$q$, $q$IT$q$, NULL),
($q$Martell$q$, $q$martell$q$, $q$https://www.martell.com$q$, $q$FR$q$, NULL),
($q$Massenez$q$, $q$massenez$q$, $q$https://www.massenez.com$q$, $q$FR$q$, NULL),
($q$Merlet$q$, $q$merlet$q$, $q$https://merlet.fr$q$, $q$FR$q$, NULL),
($q$Metaxa$q$, $q$metaxa$q$, $q$https://www.metaxa.com$q$, $q$GR$q$, NULL),
($q$Meukow$q$, $q$meukow$q$, $q$https://meukowcognac.com$q$, $q$FR$q$, NULL),
($q$Miguel Torres Chile$q$, $q$miguel.torres.chile$q$, $q$https://www.torres.es$q$, $q$CL$q$, NULL),
($q$Méry Melrose$q$, $q$mery.melrose$q$, NULL, $q$FR$q$, NULL),
($q$Nardini$q$, $q$nardini$q$, $q$https://www.nardini.it$q$, $q$IT$q$, NULL),
($q$Nonino$q$, $q$nonino$q$, $q$https://www.grappanonino.it$q$, $q$IT$q$, NULL),
($q$Osborne$q$, $q$osborne$q$, $q$https://www.osborne.es$q$, $q$ES$q$, NULL),
($q$Park$q$, $q$park$q$, $q$https://www.park-cognac.com$q$, $q$FR$q$, NULL),
($q$Paul Masson$q$, $q$paul.masson$q$, $q$https://paulmasson.com$q$, $q$US$q$, NULL),
($q$Pierre Ferrand$q$, $q$pierre.ferrand$q$, $q$https://ferrandcognac.com$q$, $q$FR$q$, NULL),
($q$Poli$q$, $q$poli$q$, $q$https://www.poligrappa.com$q$, $q$IT$q$, NULL),
($q$Purkhart$q$, $q$purkhart$q$, NULL, $q$AT$q$, NULL),
($q$Père Magloire$q$, $q$pere.magloire$q$, NULL, $q$FR$q$, NULL),
($q$R. Jelínek$q$, $q$r.jelinek$q$, $q$https://www.rjelinek.cz$q$, $q$CZ$q$, NULL),
($q$Reisetbauer$q$, $q$reisetbauer$q$, $q$https://www.reisetbauer.at$q$, $q$AT$q$, NULL),
($q$Rhine Hall$q$, $q$rhine.hall$q$, $q$https://www.rhinehall.com$q$, $q$US$q$, NULL),
($q$Rémy Martin$q$, $q$remy.martin$q$, $q$https://www.remymartin.com$q$, $q$FR$q$, NULL),
($q$Schladerer$q$, $q$schladerer$q$, $q$https://www.schladerer.de$q$, $q$DE$q$, NULL),
($q$Somerset Cider Brandy Company$q$, $q$somerset.cider.brandy.company$q$, $q$https://www.somersetciderbrandy.com$q$, $q$GB$q$, NULL),
($q$St Agnes$q$, $q$st.agnes$q$, $q$https://stagnesdistillery.com.au$q$, $q$AU$q$, NULL),
($q$St-Rémy$q$, $q$st.remy$q$, $q$https://www.remy-cointreau.com/en/brands/st-remy$q$, $q$FR$q$, NULL),
($q$St. George Spirits$q$, $q$st.george.spirits$q$, $q$https://stgeorgespirits.com$q$, $q$US$q$, NULL),
($q$Suyo$q$, $q$suyo$q$, $q$https://www.suyopisco.com$q$, $q$PE$q$, NULL),
($q$Sánchez Romate$q$, $q$sanchez.romate$q$, $q$https://www.cardenalmendoza.com$q$, $q$ES$q$, NULL),
($q$Tacama$q$, $q$tacama$q$, $q$https://www.tacama.com$q$, $q$PE$q$, NULL),
($q$The Christian Brothers$q$, $q$the.christian.brothers$q$, $q$http://christianbrothersbrandy.com$q$, $q$US$q$, NULL),
($q$Torres$q$, $q$torres$q$, $q$https://www.torresbrandy.com$q$, $q$ES$q$, NULL),
($q$Vecchia Romagna$q$, $q$vecchia.romagna$q$, $q$https://www.vecchiaromagna.com$q$, $q$IT$q$, NULL),
($q$Williams & Humbert$q$, $q$williams.humbert$q$, $q$https://www.williams-humbert.com$q$, $q$ES$q$, NULL),
($q$Žufánek$q$, $q$zufanek$q$, $q$https://www.zufanek.cz$q$, $q$CZ$q$, NULL);

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
($q$30&40 Eau-de-vie de Cidre$q$, $q$30&40 Apple EDV$q$, $q$Apple Brandy$q$, $q$30&40$q$, 45, $q$FR$q$, NULL, $q$https://www.whisky.fr/en/30-40-eau-de-vie-de-cidre.html$q$, $q$retailer$q$),
($q$Argonaut Fat Thumb$q$, NULL, $q$American Brandy$q$, $q$Argonaut$q$, 43, $q$US$q$, NULL, $q$https://www.argonautbrandy.com/expressions$q$, $q$producer$q$),
($q$Argonaut Saloon Strength$q$, $q$Argonaut Saloon Strength Brandy$q$, $q$American Brandy$q$, $q$Argonaut$q$, 45.5, $q$US$q$, NULL, $q$https://www.argonautbrandy.com/saloon-strength.html$q$, $q$producer$q$),
($q$Argonaut Speculator$q$, NULL, $q$American Brandy$q$, $q$Argonaut$q$, 43, $q$US$q$, NULL, $q$https://www.argonautbrandy.com/expressions$q$, $q$producer$q$),
($q$Asbach 15 Jahre gereift$q$, NULL, $q$Brandy$q$, $q$Asbach$q$, NULL, $q$DE$q$, NULL, $q$https://asbach.de/asbach-15-jahre-gereift-5122630$q$, $q$producer$q$),
($q$Asbach 8 Jahre gereift$q$, NULL, $q$Brandy$q$, $q$Asbach$q$, NULL, $q$DE$q$, NULL, $q$https://asbach.de/asbach-8-jahre-gereift-5110630$q$, $q$producer$q$),
($q$Asbach Uralt$q$, $q$Asbach Uralt$q$, $q$Brandy$q$, $q$Asbach$q$, NULL, $q$DE$q$, NULL, $q$https://asbach.de/asbach-uralt-07-l$q$, $q$producer$q$),
($q$Avallen Calvados$q$, $q$Avallen Calvados$q$, $q$Calvados$q$, $q$Avallen$q$, 40, $q$FR$q$, $q$Calvados$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/6397/avallen-calvados$q$, $q$reference$q$),
($q$BarSol Mosto Verde Italia$q$, NULL, $q$Pisco$q$, $q$BarSol$q$, NULL, $q$PE$q$, $q$Pisco$q$, $q$https://specialitybrands.com/range/barsol-pisco/$q$, $q$reference$q$),
($q$BarSol Mosto Verde Quebranta$q$, NULL, $q$Pisco$q$, $q$BarSol$q$, NULL, $q$PE$q$, $q$Pisco$q$, $q$https://specialitybrands.com/range/barsol-pisco/$q$, $q$reference$q$),
($q$BarSol Mosto Verde Torontel$q$, NULL, $q$Pisco$q$, $q$BarSol$q$, NULL, $q$PE$q$, $q$Pisco$q$, $q$https://specialitybrands.com/range/barsol-pisco/$q$, $q$reference$q$),
($q$BarSol Primero Quebranta$q$, $q$BarSol Primero Quebranta Pisco$q$, $q$Pisco$q$, $q$BarSol$q$, 41.3, $q$PE$q$, $q$Pisco$q$, $q$https://specialitybrands.com/range/barsol-pisco/barsol-primero-quebranta/$q$, $q$reference$q$),
($q$BarSol Selecto Acholado$q$, NULL, $q$Acholado Pisco$q$, $q$BarSol$q$, 41.3, $q$PE$q$, $q$Pisco$q$, $q$https://specialitybrands.com/range/barsol-pisco/barsol-selecto-acholado/$q$, $q$reference$q$),
($q$BarSol Selecto Italia$q$, NULL, $q$Pisco$q$, $q$BarSol$q$, NULL, $q$PE$q$, $q$Pisco$q$, $q$https://specialitybrands.com/range/barsol-pisco/$q$, $q$reference$q$),
($q$BarSol Selecto Torontel$q$, NULL, $q$Pisco$q$, $q$BarSol$q$, NULL, $q$PE$q$, $q$Pisco$q$, $q$https://specialitybrands.com/range/barsol-pisco/$q$, $q$reference$q$),
($q$Berta Bric del Gaian$q$, NULL, $q$Grappa$q$, $q$Berta$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.distillerieberta.it/prodotti/grappe/selezioni/bric-del-gaian/$q$, $q$producer$q$),
($q$Berta Casalotto$q$, NULL, $q$Italian Brandy$q$, $q$Berta$q$, NULL, $q$IT$q$, NULL, $q$https://www.distillerieberta.it/prodotti/grappe/selezioni/casalotto/$q$, $q$producer$q$),
($q$Berta Magia$q$, NULL, $q$Grappa$q$, $q$Berta$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.distillerieberta.it/prodotti/grappe/selezioni/magia/$q$, $q$producer$q$),
($q$Berta Roccanivo$q$, NULL, $q$Grappa$q$, $q$Berta$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.distillerieberta.it/prodotti/grappe/selezioni/roccanivo/$q$, $q$producer$q$),
($q$Berta Ròndena$q$, NULL, $q$Grappa$q$, $q$Berta$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.distillerieberta.it/prodotti/grappe/selezioni/rondena/$q$, $q$producer$q$),
($q$Berta Tre Soli Tre$q$, $q$Berta Tre Soli Tre Grappa$q$, $q$Grappa$q$, $q$Berta$q$, 43, $q$IT$q$, $q$Grappa$q$, $q$https://www.distillerieberta.it/prodotti/grappe/selezioni/tre-soli-tre/$q$, $q$producer$q$),
($q$Bertoux Brandy$q$, $q$Bertoux Brandy$q$, $q$American Brandy$q$, $q$Bertoux$q$, 40, $q$US$q$, NULL, $q$https://reservebar.com/products/bertoux-brandy/GROUPING-1295231$q$, $q$retailer$q$),
($q$1615 Pisco Acholado$q$, NULL, $q$Acholado Pisco$q$, $q$Bodega San Nicolás$q$, 42, $q$PE$q$, $q$Pisco$q$, $q$https://thedailypour.com/?p=138148$q$, $q$reference$q$),
($q$1615 Pisco Italia$q$, $q$Pisco 1615 Italia$q$, $q$Pisco$q$, $q$Bodega San Nicolás$q$, NULL, $q$PE$q$, $q$Pisco$q$, $q$https://thedailypour.com/?p=138148$q$, $q$reference$q$),
($q$1615 Pisco Quebranta$q$, NULL, $q$Pisco$q$, $q$Bodega San Nicolás$q$, NULL, $q$PE$q$, $q$Pisco$q$, $q$https://thedailypour.com/?p=138148$q$, $q$reference$q$),
($q$Bottega Alexander Cru Grappa$q$, NULL, $q$Grappa$q$, $q$Bottega$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.bottegaspa.com/en/collections/cru-grappa/$q$, $q$producer$q$),
($q$Bottega Alexander Grappa$q$, NULL, $q$Grappa$q$, $q$Bottega$q$, 38, $q$IT$q$, $q$Grappa$q$, $q$https://www.bottegaspa.com/en/grappa$q$, $q$producer$q$),
($q$Bottega Alexander Grappa Amarone$q$, NULL, $q$Grappa$q$, $q$Bottega$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.bottegaspa.com/en/collections/grappa-amarone-2/$q$, $q$producer$q$),
($q$Bottega Alexander Grappa Brunello di Montalcino$q$, NULL, $q$Grappa$q$, $q$Bottega$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.bottegaspa.com/en/collections/grappa-brunello-di-montalcino/$q$, $q$producer$q$),
($q$Bottega Alexander Grappa Cabernet$q$, NULL, $q$Grappa$q$, $q$Bottega$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.bottegaspa.com/en/collections/grappa-cabernet-2/$q$, $q$producer$q$),
($q$Bottega Alexander Grappa Chardonnay$q$, NULL, $q$Grappa$q$, $q$Bottega$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.bottegaspa.com/en/collections/grappa-chardonnay/$q$, $q$producer$q$),
($q$Bottega Alexander Grappa Merlot$q$, NULL, $q$Grappa$q$, $q$Bottega$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.bottegaspa.com/en/collections/grappa-merlot/$q$, $q$producer$q$),
($q$Bottega Alexander Grappa Moscato$q$, NULL, $q$Grappa$q$, $q$Bottega$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.bottegaspa.com/en/collections/grappa-moscato/$q$, $q$producer$q$),
($q$Bottega Alexander Grappa Platinum$q$, NULL, $q$Grappa$q$, $q$Bottega$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.bottegaspa.com/en/collections/grappa-platinum/$q$, $q$producer$q$),
($q$Bottega Alexander Grappa Prosecco$q$, $q$Bottega Alexander Grappa di Prosecco$q$, $q$Grappa$q$, $q$Bottega$q$, 38, $q$IT$q$, $q$Grappa$q$, $q$https://www.bottegaspa.com/en/collections/grappa-prosecco/$q$, $q$producer$q$),
($q$Bottega Alexander Grappa Sauvignon$q$, NULL, $q$Grappa$q$, $q$Bottega$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.bottegaspa.com/en/collections/grappa-sauvignon/$q$, $q$producer$q$),
($q$Bottega Uve d'Alexander Acquavite d'Uva$q$, NULL, $q$Grape Eau de Vie$q$, $q$Bottega$q$, NULL, $q$IT$q$, NULL, $q$https://www.bottegaspa.com/en/collections/uve-dalexander-acquavite-uva/$q$, $q$producer$q$),
($q$Boulard Auguste X.O.$q$, NULL, $q$Calvados$q$, $q$Boulard$q$, NULL, $q$FR$q$, $q$Calvados Pays d'Auge$q$, $q$https://www.calvados-boulard.com/calvados/auguste-x-o/$q$, $q$producer$q$),
($q$Boulard Extra$q$, NULL, $q$Calvados$q$, $q$Boulard$q$, NULL, $q$FR$q$, $q$Calvados Pays d'Auge$q$, $q$https://www.calvados-boulard.com/calvados/extra/$q$, $q$producer$q$),
($q$Boulard Grand Solage$q$, NULL, $q$Calvados$q$, $q$Boulard$q$, NULL, $q$FR$q$, $q$Calvados Pays d'Auge$q$, $q$https://www.calvados-boulard.com/en/$q$, $q$producer$q$),
($q$Boulard V.S.O.P.$q$, $q$Boulard VSOP Calvados Pays d'Auge$q$, $q$Calvados$q$, $q$Boulard$q$, NULL, $q$FR$q$, $q$Calvados Pays d'Auge$q$, $q$https://www.calvados-boulard.com/calvados/v-s-o-p/$q$, $q$producer$q$),
($q$Boulard X.O.$q$, NULL, $q$Calvados$q$, $q$Boulard$q$, NULL, $q$FR$q$, $q$Calvados Pays d'Auge$q$, $q$https://www.calvados-boulard.com/calvados/boulard-x-o/$q$, $q$producer$q$),
($q$Busnel Calvados Pays d'Auge Fine Bio$q$, NULL, $q$Calvados$q$, $q$Busnel$q$, NULL, $q$FR$q$, $q$Calvados Pays d'Auge$q$, $q$https://www.distillerie-busnel.fr/nos-produits/calvados/pays-d-auge-aoc-fine-bio$q$, $q$producer$q$),
($q$Busnel Calvados Pays d'Auge VSOP$q$, NULL, $q$Calvados$q$, $q$Busnel$q$, 40, $q$FR$q$, $q$Calvados Pays d'Auge$q$, $q$https://www.distillerie-busnel.fr/nos-produits/calvados/calvados-pays-d-auge-aoc-vsop-busnel$q$, $q$producer$q$),
($q$Busnel Calvados Pays d'Auge XO 12 ans$q$, NULL, $q$Calvados$q$, $q$Busnel$q$, NULL, $q$FR$q$, $q$Calvados Pays d'Auge$q$, $q$https://www.distillerie-busnel.fr/nos-produits/calvados/calvados-pays-d-auge-aoc-busnel-xo-12-ans$q$, $q$producer$q$),
($q$Busnel Calvados Pays d'Auge affiné en fûts de Whisky$q$, NULL, $q$Calvados$q$, $q$Busnel$q$, NULL, $q$FR$q$, $q$Calvados Pays d'Auge$q$, $q$https://www.distillerie-busnel.fr/nos-produits/calvados/calvados-pays-d-auge-busnel-affine-en-futs-de-whisky$q$, $q$producer$q$),
($q$Busnel Calvados VSOP Bio$q$, NULL, $q$Calvados$q$, $q$Busnel$q$, NULL, $q$FR$q$, $q$Calvados$q$, $q$https://www.distillerie-busnel.fr/nos-produits/calvados/pays-d-auge-aoc-vsop-bio$q$, $q$producer$q$),
($q$Campo de Encanto Grand & Noble Acholado$q$, $q$Campo de Encanto Acholado Pisco$q$, $q$Acholado Pisco$q$, $q$Campo de Encanto$q$, 42.5, $q$PE$q$, $q$Pisco$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/2721/campo-de-encanto$q$, $q$reference$q$),
($q$Capurro Pisco Acholado$q$, $q$Capurro Acholado Pisco$q$, $q$Acholado Pisco$q$, $q$Capurro$q$, NULL, $q$PE$q$, $q$Pisco$q$, $q$https://www.piscocapurro.com/our-pisco$q$, $q$producer$q$),
($q$Capurro Pisco Moscatel$q$, NULL, $q$Pisco$q$, $q$Capurro$q$, NULL, $q$PE$q$, $q$Pisco$q$, $q$https://www.piscocapurro.com/our-pisco$q$, $q$producer$q$),
($q$Capurro Pisco Quebranta$q$, NULL, $q$Pisco$q$, $q$Capurro$q$, NULL, $q$PE$q$, $q$Pisco$q$, $q$https://www.piscocapurro.com/our-pisco$q$, $q$producer$q$),
($q$Capurro Pisco Torontel$q$, NULL, $q$Pisco$q$, $q$Capurro$q$, NULL, $q$PE$q$, $q$Pisco$q$, $q$https://www.piscocapurro.com/our-pisco$q$, $q$producer$q$),
($q$Caravedo Acholado$q$, NULL, $q$Acholado Pisco$q$, $q$Caravedo$q$, NULL, $q$PE$q$, $q$Pisco$q$, $q$https://caravedopisco.com/acholado$q$, $q$producer$q$),
($q$Caravedo Mosto Verde Acholado$q$, $q$Caravedo Mosto Verde Pisco$q$, $q$Acholado Pisco$q$, $q$Caravedo$q$, NULL, $q$PE$q$, $q$Pisco$q$, $q$https://caravedopisco.com/mostoverde$q$, $q$producer$q$),
($q$Caravedo Puro Quebranta$q$, NULL, $q$Pisco$q$, $q$Caravedo$q$, NULL, $q$PE$q$, $q$Pisco$q$, $q$https://caravedopisco.com/quebranta$q$, $q$producer$q$),
($q$Caravedo Puro Torontel$q$, $q$Caravedo Torontel Pisco$q$, $q$Pisco$q$, $q$Caravedo$q$, NULL, $q$PE$q$, $q$Pisco$q$, $q$https://caravedopisco.com/torontel$q$, $q$producer$q$),
($q$Singani 63$q$, $q$Singani 63$q$, $q$Singani$q$, $q$Casa Real$q$, NULL, $q$BO$q$, NULL, $q$https://www.singani63.com/$q$, $q$producer$q$),
($q$Castarède VSOP$q$, $q$Castarède VSOP Armagnac$q$, $q$Armagnac$q$, $q$Castarède$q$, 40, $q$FR$q$, $q$Armagnac$q$, $q$https://www.enotria.com/products/armagnac-castarede-castarede-vsop-bas-armagnac$q$, $q$retailer$q$),
($q$Christian Drouin 25 ans$q$, NULL, $q$Calvados$q$, $q$Christian Drouin$q$, NULL, $q$FR$q$, NULL, $q$https://www.calvados-drouin.com/en/gamme/2/les-assemblages$q$, $q$producer$q$),
($q$Christian Drouin Calvados Sélection$q$, $q$Christian Drouin Selection Calvados$q$, $q$Calvados$q$, $q$Christian Drouin$q$, NULL, $q$FR$q$, $q$Calvados$q$, $q$https://www.calvados-drouin.com/en/product/55/calvados-selection/g/2$q$, $q$producer$q$),
($q$Christian Drouin Hors d'Age$q$, NULL, $q$Calvados$q$, $q$Christian Drouin$q$, NULL, $q$FR$q$, NULL, $q$https://www.calvados-drouin.com/en/gamme/2/les-assemblages$q$, $q$producer$q$),
($q$Christian Drouin La Blanche Bio$q$, NULL, $q$Apple Brandy$q$, $q$Christian Drouin$q$, NULL, $q$FR$q$, NULL, $q$https://www.calvados-drouin.com/en/product/49/la-blanche-bio-eau-de-vie-de-cidre/g/7$q$, $q$producer$q$),
($q$Christian Drouin La Réserve Amphore$q$, NULL, $q$Calvados$q$, $q$Christian Drouin$q$, NULL, $q$FR$q$, NULL, $q$https://www.calvados-drouin.com/en/gamme/2/les-assemblages$q$, $q$producer$q$),
($q$Christian Drouin Le Domfrontais$q$, NULL, $q$Calvados$q$, $q$Christian Drouin$q$, NULL, $q$FR$q$, $q$Calvados Domfrontais$q$, $q$https://www.calvados-drouin.com/en/gamme/2/les-assemblages$q$, $q$producer$q$),
($q$Christian Drouin VSOP$q$, NULL, $q$Calvados$q$, $q$Christian Drouin$q$, NULL, $q$FR$q$, NULL, $q$https://www.calvados-drouin.com/en/gamme/2/les-assemblages$q$, $q$producer$q$),
($q$Christian Drouin XO$q$, NULL, $q$Calvados$q$, $q$Christian Drouin$q$, NULL, $q$FR$q$, NULL, $q$https://www.calvados-drouin.com/en/gamme/2/les-assemblages$q$, $q$producer$q$),
($q$Clear Creek 2 Year Apple Brandy$q$, NULL, $q$Apple Brandy$q$, $q$Clear Creek$q$, NULL, $q$US$q$, NULL, $q$https://www.hrdspirits.com/clear-creek-distillery$q$, $q$producer$q$),
($q$Clear Creek Blue Plum Brandy$q$, $q$Clear Creek Blue Plum Brandy$q$, $q$Plum Brandy$q$, $q$Clear Creek$q$, NULL, $q$US$q$, NULL, $q$https://www.hrdspirits.com/clear-creek-distillery$q$, $q$producer$q$),
($q$Clear Creek Framboise$q$, NULL, $q$Raspberry Eau de Vie$q$, $q$Clear Creek$q$, NULL, $q$US$q$, NULL, $q$https://www.hrdspirits.com/clear-creek-distillery$q$, $q$producer$q$),
($q$Clear Creek Grappa Muscat$q$, NULL, $q$Grappa$q$, $q$Clear Creek$q$, NULL, $q$US$q$, NULL, $q$https://www.hrdspirits.com/clear-creek-distillery$q$, $q$producer$q$),
($q$Clear Creek Kirschwasser$q$, $q$Clear Creek Kirschwasser$q$, $q$Kirsch$q$, $q$Clear Creek$q$, NULL, $q$US$q$, NULL, $q$https://www.hrdspirits.com/clear-creek-distillery$q$, $q$producer$q$),
($q$Clear Creek Oregon Brandy$q$, NULL, $q$American Brandy$q$, $q$Clear Creek$q$, NULL, $q$US$q$, NULL, $q$https://www.hrdspirits.com/clear-creek-distillery$q$, $q$producer$q$),
($q$Clear Creek Pear Brandy$q$, $q$Clear Creek Pear Brandy$q$, $q$Pear Brandy$q$, $q$Clear Creek$q$, NULL, $q$US$q$, NULL, $q$https://www.hrdspirits.com/clear-creek-distillery$q$, $q$producer$q$),
($q$Clés des Ducs VSOP$q$, $q$Clés des Ducs VSOP Armagnac$q$, $q$Armagnac$q$, $q$Clés des Ducs$q$, 40, $q$FR$q$, $q$Armagnac$q$, $q$https://www.bondston.com/cles-des-ducs-vsop-p669$q$, $q$retailer$q$),
($q$Copper & Kings 12-year American Brandy$q$, NULL, $q$American Brandy$q$, $q$Copper & Kings$q$, NULL, $q$US$q$, NULL, $q$https://copperandkings.com/product/12-year-american-brandy/$q$, $q$producer$q$),
($q$Copper & Kings American Apple Brandy$q$, NULL, $q$Apple Brandy$q$, $q$Copper & Kings$q$, NULL, $q$US$q$, NULL, $q$https://copperandkings.com/product/american-apple-brandy/$q$, $q$producer$q$),
($q$Copper & Kings American Brandy V.S.O.P.$q$, NULL, $q$American Brandy$q$, $q$Copper & Kings$q$, NULL, $q$US$q$, NULL, $q$https://copperandkings.com/product/american-brandy/$q$, $q$producer$q$),
($q$Copper & Kings Revival American Brandy$q$, NULL, $q$American Brandy$q$, $q$Copper & Kings$q$, NULL, $q$US$q$, NULL, $q$https://copperandkings.com/product/revival-american-brandy/$q$, $q$producer$q$),
($q$Courvoisier VS$q$, $q$Courvoisier VS Cognac$q$, $q$Cognac$q$, $q$Courvoisier$q$, 40, $q$FR$q$, $q$Cognac$q$, $q$https://www.courvoisier.com/en-us/cognac-collection/vs/$q$, $q$producer$q$),
($q$Courvoisier VSOP$q$, $q$Courvoisier VSOP$q$, $q$Cognac$q$, $q$Courvoisier$q$, NULL, $q$FR$q$, $q$Cognac$q$, $q$https://www.courvoisier.com/en-us/cognac-collection/vsop/$q$, $q$producer$q$),
($q$Courvoisier XO$q$, $q$Courvoisier XO Cognac$q$, $q$Cognac$q$, $q$Courvoisier$q$, NULL, $q$FR$q$, $q$Cognac$q$, $q$https://www.courvoisier.com/en-us/cognac-collection/xo/$q$, $q$producer$q$),
($q$Courvoisier XO Royal$q$, NULL, $q$Cognac$q$, $q$Courvoisier$q$, NULL, $q$FR$q$, $q$Cognac$q$, $q$https://www.courvoisier.com/en-us/cognac-collection/xo-royal/$q$, $q$producer$q$),
($q$D'Ussé VSOP$q$, $q$D'Ussé VSOP Cognac$q$, $q$Cognac$q$, $q$D'Ussé$q$, 40, $q$FR$q$, $q$Cognac$q$, $q$https://www.dusse.com/product/dusse-vsop/$q$, $q$producer$q$),
($q$D'Ussé XO$q$, NULL, $q$Cognac$q$, $q$D'Ussé$q$, 40, $q$FR$q$, $q$Cognac$q$, $q$https://www.dusse.com/product/dusse-xo/$q$, $q$producer$q$),
($q$Darroze Les Grands Assemblages 12 ans d'âge$q$, NULL, $q$Armagnac$q$, $q$Darroze$q$, 43, $q$FR$q$, $q$Armagnac$q$, $q$https://darroze-armagnacs.com/en/les-grands-assemblages/$q$, $q$producer$q$),
($q$Darroze Les Grands Assemblages 8 ans d'âge$q$, NULL, $q$Armagnac$q$, $q$Darroze$q$, 43, $q$FR$q$, $q$Armagnac$q$, $q$https://darroze-armagnacs.com/en/les-grands-assemblages/$q$, $q$producer$q$),
($q$Dartigalongue Reserve$q$, NULL, $q$Armagnac$q$, $q$Dartigalongue$q$, 42, $q$FR$q$, $q$Armagnac$q$, $q$https://www.dartigalongue.com/en/our-armagnacs/$q$, $q$producer$q$),
($q$Dartigalongue VSOP$q$, NULL, $q$Armagnac$q$, $q$Dartigalongue$q$, 42, $q$FR$q$, $q$Armagnac$q$, $q$https://www.dartigalongue.com/en/our-armagnacs/$q$, $q$producer$q$),
($q$Dartigalongue XO Signature$q$, NULL, $q$Armagnac$q$, $q$Dartigalongue$q$, 42, $q$FR$q$, $q$Armagnac$q$, $q$https://www.dartigalongue.com/en/our-armagnacs/$q$, $q$producer$q$),
($q$Delord Armagnac 20 ans$q$, NULL, $q$Armagnac$q$, $q$Delord$q$, NULL, $q$FR$q$, $q$Armagnac$q$, $q$https://www.armagnacdelord.com/en/delord-armagnac/$q$, $q$producer$q$),
($q$Delord Armagnac 25 ans$q$, NULL, $q$Armagnac$q$, $q$Delord$q$, NULL, $q$FR$q$, $q$Armagnac$q$, $q$https://www.armagnacdelord.com/en/delord-armagnac/$q$, $q$producer$q$),
($q$Delord Armagnac Hors d'Âge$q$, NULL, $q$Armagnac$q$, $q$Delord$q$, NULL, $q$FR$q$, $q$Armagnac$q$, $q$https://www.armagnacdelord.com/en/delord-armagnac/$q$, $q$producer$q$),
($q$Delord Armagnac VSOP$q$, NULL, $q$Armagnac$q$, $q$Delord$q$, NULL, $q$FR$q$, $q$Armagnac$q$, $q$https://www.armagnacdelord.com/en/delord-armagnac/$q$, $q$producer$q$),
($q$Delord Armagnac XO Premium$q$, NULL, $q$Armagnac$q$, $q$Delord$q$, NULL, $q$FR$q$, $q$Armagnac$q$, $q$https://www.armagnacdelord.com/en/delord-armagnac/$q$, $q$producer$q$),
($q$Delord Armagnac l'Authentique$q$, NULL, $q$Armagnac$q$, $q$Delord$q$, NULL, $q$FR$q$, $q$Armagnac$q$, $q$https://www.armagnacdelord.com/en/delord-armagnac/$q$, $q$producer$q$),
($q$Delord Blanche Armagnac$q$, NULL, $q$Blanche d'Armagnac$q$, $q$Delord$q$, NULL, $q$FR$q$, $q$Blanche Armagnac$q$, $q$https://www.armagnacdelord.com/en/delord-armagnac/$q$, $q$producer$q$),
($q$Delord Fine Armagnac$q$, NULL, $q$Armagnac$q$, $q$Delord$q$, NULL, $q$FR$q$, $q$Armagnac$q$, $q$https://www.armagnacdelord.com/en/delord-armagnac/$q$, $q$producer$q$),
($q$Dupont Calvados 10 ans$q$, NULL, $q$Calvados$q$, $q$Domaine Dupont$q$, NULL, $q$FR$q$, $q$Calvados Pays d'Auge$q$, $q$https://www.calvados-dupont.com/en/ciders-calvados.htm$q$, $q$producer$q$),
($q$Dupont Calvados 12 ans$q$, NULL, $q$Calvados$q$, $q$Domaine Dupont$q$, NULL, $q$FR$q$, $q$Calvados Pays d'Auge$q$, $q$https://www.calvados-dupont.com/en/ciders-calvados.htm$q$, $q$producer$q$),
($q$Dupont Calvados 15 ans$q$, NULL, $q$Calvados$q$, $q$Domaine Dupont$q$, NULL, $q$FR$q$, $q$Calvados Pays d'Auge$q$, $q$https://www.calvados-dupont.com/en/ciders-calvados.htm$q$, $q$producer$q$),
($q$Dupont Calvados 20 ans$q$, NULL, $q$Calvados$q$, $q$Domaine Dupont$q$, NULL, $q$FR$q$, $q$Calvados Pays d'Auge$q$, $q$https://www.calvados-dupont.com/en/ciders-calvados.htm$q$, $q$producer$q$),
($q$Dupont Calvados Fine$q$, NULL, $q$Calvados$q$, $q$Domaine Dupont$q$, NULL, $q$FR$q$, $q$Calvados Pays d'Auge$q$, $q$https://www.calvados-dupont.com/en/ciders-calvados.htm$q$, $q$producer$q$),
($q$Dupont Calvados Hors d'Age$q$, NULL, $q$Calvados$q$, $q$Domaine Dupont$q$, NULL, $q$FR$q$, $q$Calvados Pays d'Auge$q$, $q$https://www.calvados-dupont.com/en/ciders-calvados.htm$q$, $q$producer$q$),
($q$Dupont Calvados Original$q$, NULL, $q$Calvados$q$, $q$Domaine Dupont$q$, NULL, $q$FR$q$, $q$Calvados Pays d'Auge$q$, $q$https://www.calvados-dupont.com/en/ciders-calvados.htm$q$, $q$producer$q$),
($q$Dupont Calvados Réserve$q$, NULL, $q$Calvados$q$, $q$Domaine Dupont$q$, NULL, $q$FR$q$, $q$Calvados Pays d'Auge$q$, $q$https://www.calvados-dupont.com/en/ciders-calvados.htm$q$, $q$producer$q$),
($q$Dupont Calvados VSOP$q$, $q$Dupont VSOP Calvados Pays d'Auge$q$, $q$Calvados$q$, $q$Domaine Dupont$q$, 42, $q$FR$q$, $q$Calvados Pays d'Auge$q$, $q$https://www.calvados-dupont.com/en/calvados-vsop.htm$q$, $q$producer$q$),
($q$Dupont Calvados Vieille Réserve$q$, NULL, $q$Calvados$q$, $q$Domaine Dupont$q$, NULL, $q$FR$q$, $q$Calvados Pays d'Auge$q$, $q$https://www.calvados-dupont.com/en/ciders-calvados.htm$q$, $q$producer$q$),
($q$Dupont Calvados XO$q$, NULL, $q$Calvados$q$, $q$Domaine Dupont$q$, NULL, $q$FR$q$, $q$Calvados Pays d'Auge$q$, $q$https://www.calvados-dupont.com/en/ciders-calvados.htm$q$, $q$producer$q$),
($q$Tariquet Baco 20 ans$q$, NULL, $q$Armagnac$q$, $q$Domaine du Tariquet$q$, NULL, $q$FR$q$, $q$Armagnac$q$, $q$https://www.tariquet.com/en/the-varietals/$q$, $q$producer$q$),
($q$Tariquet Blanche Armagnac$q$, NULL, $q$Blanche d'Armagnac$q$, $q$Domaine du Tariquet$q$, NULL, $q$FR$q$, $q$Blanche Armagnac$q$, $q$https://www.tariquet.com/en/pure-folle-blanche/$q$, $q$producer$q$),
($q$Tariquet Hors d'Âge 20 ans$q$, NULL, $q$Armagnac$q$, $q$Domaine du Tariquet$q$, 42, $q$FR$q$, $q$Armagnac$q$, $q$https://www.tariquet.com/en/the-traditonal-range/$q$, $q$producer$q$),
($q$Tariquet Pure Folle Blanche 12 ans$q$, NULL, $q$Armagnac$q$, $q$Domaine du Tariquet$q$, NULL, $q$FR$q$, $q$Armagnac$q$, $q$https://www.tariquet.com/en/pure-folle-blanche/$q$, $q$producer$q$),
($q$Tariquet Pure Folle Blanche 15 ans$q$, NULL, $q$Armagnac$q$, $q$Domaine du Tariquet$q$, NULL, $q$FR$q$, $q$Armagnac$q$, $q$https://www.tariquet.com/en/pure-folle-blanche/$q$, $q$producer$q$),
($q$Tariquet Pure Folle Blanche 8 ans$q$, NULL, $q$Armagnac$q$, $q$Domaine du Tariquet$q$, NULL, $q$FR$q$, $q$Armagnac$q$, $q$https://www.tariquet.com/en/pure-folle-blanche/$q$, $q$producer$q$),
($q$Tariquet Pure Folle Blanche VS$q$, NULL, $q$Armagnac$q$, $q$Domaine du Tariquet$q$, NULL, $q$FR$q$, $q$Armagnac$q$, $q$https://www.tariquet.com/en/pure-folle-blanche/$q$, $q$producer$q$),
($q$Tariquet VS Classique$q$, $q$Tariquet VS Classique Bas-Armagnac$q$, $q$Armagnac$q$, $q$Domaine du Tariquet$q$, 40, $q$FR$q$, $q$Armagnac$q$, $q$https://www.tariquet.com/en/the-traditonal-range/$q$, $q$producer$q$),
($q$Tariquet VSOP$q$, NULL, $q$Armagnac$q$, $q$Domaine du Tariquet$q$, 40, $q$FR$q$, $q$Armagnac$q$, $q$https://www.tariquet.com/en/the-traditonal-range/$q$, $q$producer$q$),
($q$Tariquet XO$q$, NULL, $q$Armagnac$q$, $q$Domaine du Tariquet$q$, 40, $q$FR$q$, $q$Armagnac$q$, $q$https://www.tariquet.com/en/the-traditonal-range/$q$, $q$producer$q$),
($q$E&J VS$q$, NULL, $q$American Brandy$q$, $q$E&J$q$, NULL, $q$US$q$, NULL, $q$https://www.ejbrandy.com/collection/vs/$q$, $q$producer$q$),
($q$E&J VSOP Grand Blue$q$, $q$E&J VSOP Brandy$q$, $q$American Brandy$q$, $q$E&J$q$, NULL, $q$US$q$, NULL, $q$https://www.ejbrandy.com/collection/vsop/$q$, $q$producer$q$),
($q$E&J XO$q$, NULL, $q$American Brandy$q$, $q$E&J$q$, NULL, $q$US$q$, NULL, $q$https://www.ejbrandy.com/collection/xo/$q$, $q$producer$q$),
($q$Frapin 1270$q$, $q$Frapin 1270 Cognac$q$, $q$Cognac$q$, $q$Frapin$q$, NULL, $q$FR$q$, $q$Cognac$q$, $q$https://www.cognac-frapin.com/cognacs/heritage-de-la-maison/frapin-1270$q$, $q$producer$q$),
($q$Frapin 15 Ans d'Âge$q$, NULL, $q$Cognac$q$, $q$Frapin$q$, NULL, $q$FR$q$, $q$Cognac$q$, $q$https://www.cognac-frapin.com/cognacs/tresors-du-chateau/frapin-15-ans-d-age$q$, $q$producer$q$),
($q$Frapin Château Fontpinot XO$q$, NULL, $q$Cognac$q$, $q$Frapin$q$, NULL, $q$FR$q$, $q$Cognac$q$, $q$https://www.cognac-frapin.com/cognacs/tresors-du-chateau/chateau-fontpinot-xo$q$, $q$producer$q$),
($q$Frapin Cigar Blend XO$q$, NULL, $q$Cognac$q$, $q$Frapin$q$, NULL, $q$FR$q$, $q$Cognac$q$, $q$https://www.cognac-frapin.com/cognacs/tresors-du-chateau/cigar-blend-xo$q$, $q$producer$q$),
($q$Frapin Extra$q$, $q$Frapin Grande Champagne Extra$q$, $q$Cognac$q$, $q$Frapin$q$, NULL, $q$FR$q$, $q$Cognac$q$, $q$https://www.cognac-frapin.com/cognacs/heritage-de-la-maison/extra$q$, $q$producer$q$),
($q$Frapin VSOP$q$, NULL, $q$Cognac$q$, $q$Frapin$q$, NULL, $q$FR$q$, $q$Cognac$q$, $q$https://www.cognac-frapin.com/cognacs/heritage-de-la-maison/frapin-vsop$q$, $q$producer$q$),
($q$Frapin XO VIP$q$, NULL, $q$Cognac$q$, $q$Frapin$q$, NULL, $q$FR$q$, $q$Cognac$q$, $q$https://www.cognac-frapin.com/cognacs/heritage-de-la-maison/xo-vip$q$, $q$producer$q$),
($q$Fundador Sherry Cask$q$, $q$Fundador Solera Reserva Brandy de Jerez$q$, $q$Brandy de Jerez$q$, $q$Fundador$q$, 40, $q$ES$q$, $q$Brandy de Jerez$q$, $q$https://www.bcliquorstores.com/product/43083$q$, $q$retailer$q$),
($q$Fundador Supremo 12$q$, NULL, $q$Brandy de Jerez$q$, $q$Fundador$q$, 40, $q$ES$q$, $q$Brandy de Jerez$q$, $q$https://www.gonzalezbyass.com/sites/www.gonzalezbyass.com/files/2026-07/Fundador-Supremo-12-web-ING.pdf$q$, $q$producer$q$),
($q$Fundador Supremo 15$q$, NULL, $q$Brandy de Jerez$q$, $q$Fundador$q$, NULL, $q$ES$q$, NULL, $q$https://www.gonzalezbyass.com/en/wineries-brands/fundador$q$, $q$producer$q$),
($q$Fundador Supremo 18$q$, NULL, $q$Brandy de Jerez$q$, $q$Fundador$q$, NULL, $q$ES$q$, NULL, $q$https://www.gonzalezbyass.com/en/wineries-brands/fundador$q$, $q$producer$q$),
($q$Fundador Triple Madera$q$, NULL, $q$Brandy de Jerez$q$, $q$Fundador$q$, NULL, $q$ES$q$, $q$Brandy de Jerez$q$, $q$https://www.gonzalezbyass.com/en/wineries-brands/fundador$q$, $q$producer$q$),
($q$Germain-Robin Brandy$q$, NULL, $q$American Brandy$q$, $q$Germain-Robin$q$, 40, $q$US$q$, NULL, $q$https://www.reservebar.com/products/germain-robin-brandy/GROUPING-51947$q$, $q$retailer$q$),
($q$Germain-Robin XO Brandy$q$, NULL, $q$American Brandy$q$, $q$Germain-Robin$q$, NULL, $q$US$q$, NULL, $q$https://www.germain-robin.com/ourexpressions.html$q$, $q$producer$q$),
($q$Lepanto OV$q$, NULL, $q$Brandy de Jerez$q$, $q$González Byass$q$, NULL, $q$ES$q$, $q$Brandy de Jerez$q$, $q$https://www.gonzalezbyass.com/en/wineries-brands/lepanto$q$, $q$producer$q$),
($q$Lepanto PX$q$, NULL, $q$Brandy de Jerez$q$, $q$González Byass$q$, NULL, $q$ES$q$, $q$Brandy de Jerez$q$, $q$https://www.gonzalezbyass.com/en/wineries-brands/lepanto$q$, $q$producer$q$),
($q$Lepanto Solera Gran Reserva$q$, $q$Lepanto Solera Gran Reserva Brandy de Jerez$q$, $q$Brandy de Jerez$q$, $q$González Byass$q$, NULL, $q$ES$q$, $q$Brandy de Jerez$q$, $q$https://www.gonzalezbyass.com/en/wineries-brands/lepanto$q$, $q$producer$q$),
($q$Soberano 12$q$, NULL, $q$Brandy de Jerez$q$, $q$González Byass$q$, NULL, $q$ES$q$, $q$Brandy de Jerez$q$, $q$https://www.gonzalezbyass.com/en/wineries-brands/soberano$q$, $q$producer$q$),
($q$Soberano 5$q$, NULL, $q$Brandy de Jerez$q$, $q$González Byass$q$, NULL, $q$ES$q$, $q$Brandy de Jerez$q$, $q$https://www.gonzalezbyass.com/en/wineries-brands/soberano$q$, $q$producer$q$),
($q$Soberano Solera$q$, NULL, $q$Brandy de Jerez$q$, $q$González Byass$q$, NULL, $q$ES$q$, $q$Brandy de Jerez$q$, $q$https://www.gonzalezbyass.com/en/wineries-brands/soberano$q$, $q$producer$q$),
($q$Greensand Ridge Apricot Eau de Vie$q$, $q$Greensand Ridge Apricot Eau de Vie$q$, $q$Eau-de-vie$q$, $q$Greensand Ridge$q$, 43, $q$GB$q$, NULL, $q$https://berry-bros-prodsupp-r1b.europe-west1.gcp.storefrontcloud.io/products-10008239666-greensand-ridge-apricot-eau-de-vie-england-43%25$q$, $q$retailer$q$),
($q$Hennessy V.S$q$, $q$Hennessy V.S Cognac$q$, $q$Cognac$q$, $q$Hennessy$q$, 40, $q$FR$q$, $q$Cognac$q$, $q$https://www.bcliquorstores.com/product/8284$q$, $q$retailer$q$),
($q$Hennessy V.S.O.P Privilège$q$, $q$Hennessy V.S.O.P Privilège$q$, $q$Cognac$q$, $q$Hennessy$q$, 40, $q$FR$q$, $q$Cognac$q$, $q$https://www.bcliquorstores.com/product/43703$q$, $q$retailer$q$),
($q$Hennessy X.O$q$, $q$Hennessy X.O$q$, $q$Cognac$q$, $q$Hennessy$q$, 40, $q$FR$q$, $q$Cognac$q$, $q$https://www.bcliquorstores.com/product/61440$q$, $q$retailer$q$),
($q$Hine Rare$q$, $q$Hine Rare VSOP Cognac$q$, $q$Cognac$q$, $q$Hine$q$, NULL, $q$FR$q$, $q$Cognac$q$, $q$https://hine.com$q$, $q$producer$q$),
($q$Hine VSOP$q$, NULL, $q$Cognac$q$, $q$Hine$q$, NULL, $q$FR$q$, $q$Cognac$q$, $q$https://hine.com$q$, $q$producer$q$),
($q$Hine XO 1er Cru$q$, NULL, $q$Cognac$q$, $q$Hine$q$, NULL, $q$FR$q$, $q$Cognac$q$, $q$https://hine.com$q$, $q$producer$q$),
($q$Janneau 12 Ans$q$, NULL, $q$Armagnac$q$, $q$Janneau$q$, NULL, $q$FR$q$, $q$Armagnac$q$, $q$https://www.armagnac-janneau.com/armagnac/janneau-12-ans/$q$, $q$producer$q$),
($q$Janneau 18 Ans$q$, NULL, $q$Armagnac$q$, $q$Janneau$q$, NULL, $q$FR$q$, $q$Armagnac$q$, $q$https://www.armagnac-janneau.com/armagnac/janneau-18-ans/$q$, $q$producer$q$),
($q$Janneau 25 Ans$q$, NULL, $q$Armagnac$q$, $q$Janneau$q$, NULL, $q$FR$q$, $q$Armagnac$q$, $q$https://www.armagnac-janneau.com/armagnac/janneau-25-ans/$q$, $q$producer$q$),
($q$Janneau VS$q$, NULL, $q$Armagnac$q$, $q$Janneau$q$, NULL, $q$FR$q$, $q$Armagnac$q$, $q$https://www.armagnac-janneau.com/armagnac/janneau-v-s/$q$, $q$producer$q$),
($q$Janneau VSOP$q$, $q$Janneau VSOP Armagnac$q$, $q$Armagnac$q$, $q$Janneau$q$, NULL, $q$FR$q$, $q$Armagnac$q$, $q$https://www.armagnac-janneau.com/armagnac/janneau-v-s-o-p/$q$, $q$producer$q$),
($q$Janneau XO$q$, NULL, $q$Armagnac$q$, $q$Janneau$q$, NULL, $q$FR$q$, $q$Armagnac$q$, $q$https://www.armagnac-janneau.com/armagnac/janneau-x-o/$q$, $q$producer$q$),
($q$Janneau XXO$q$, NULL, $q$Armagnac$q$, $q$Janneau$q$, NULL, $q$FR$q$, $q$Armagnac$q$, $q$https://www.armagnac-janneau.com/armagnac/janneau-xxo/$q$, $q$producer$q$),
($q$KWV 10 Year Old Brandy$q$, $q$KWV 10 Year Brandy$q$, $q$Brandy$q$, $q$KWV$q$, NULL, $q$ZA$q$, NULL, $q$https://kwv.co.za/product/kwv-10-yr-brandy-750ml/$q$, $q$producer$q$),
($q$KWV 12 Year Old Brandy$q$, NULL, $q$Brandy$q$, $q$KWV$q$, NULL, $q$ZA$q$, NULL, $q$https://kwv.co.za/product/kwv-12yr-oldbran-6-1x750/$q$, $q$producer$q$),
($q$KWV 15 Year Old Brandy$q$, NULL, $q$Brandy$q$, $q$KWV$q$, NULL, $q$ZA$q$, NULL, $q$https://kwv.co.za/product/kwv-15-year-old/$q$, $q$producer$q$),
($q$KWV 3 Year Old Brandy$q$, NULL, $q$Brandy$q$, $q$KWV$q$, NULL, $q$ZA$q$, NULL, $q$https://kwv.co.za/product/kwv-3-year-old-brandy/$q$, $q$producer$q$),
($q$KWV 5 Year Old Brandy$q$, NULL, $q$Brandy$q$, $q$KWV$q$, NULL, $q$ZA$q$, NULL, $q$https://kwv.co.za/product/kwv-5yr-old-brandy/$q$, $q$producer$q$),
($q$KWV Paarl Five Star VSOP$q$, NULL, $q$Brandy$q$, $q$KWV$q$, 40, $q$ZA$q$, NULL, $q$https://www.bcliquorstores.com/product/5173$q$, $q$retailer$q$),
($q$KWV Unlocked Brandy$q$, NULL, $q$Brandy$q$, $q$KWV$q$, NULL, $q$ZA$q$, NULL, $q$https://kwv.co.za/product/unlocked-pr-brandy-750ml/$q$, $q$producer$q$),
($q$KWV VS Brandy$q$, NULL, $q$Brandy$q$, $q$KWV$q$, NULL, $q$ZA$q$, NULL, $q$https://kwv.co.za/product/kwv-vs-brandy-6-1x750ml/$q$, $q$producer$q$),
($q$KWV XO Single Varietal Pinotage Brandy$q$, NULL, $q$Brandy$q$, $q$KWV$q$, NULL, $q$ZA$q$, NULL, $q$https://kwv.co.za/product/kwv-xo-single-varietal-pinotage-brandy-2/$q$, $q$producer$q$),
($q$KWV XXO 20 Year Old Brandy$q$, NULL, $q$Brandy$q$, $q$KWV$q$, NULL, $q$ZA$q$, NULL, $q$https://kwv.co.za/product/kwv-xxo-20-yo-brandy/$q$, $q$producer$q$),
($q$Klipdrift Export Blended$q$, $q$Klipdrift Export Brandy$q$, $q$Brandy$q$, $q$Klipdrift$q$, NULL, $q$ZA$q$, NULL, $q$https://sabrandy.co.za/brands/klipdrift/$q$, $q$reference$q$),
($q$Klipdrift Gold Potstill$q$, NULL, $q$Brandy$q$, $q$Klipdrift$q$, NULL, $q$ZA$q$, NULL, $q$https://sabrandy.co.za/brands/klipdrift/$q$, $q$reference$q$),
($q$Klipdrift Premium Blended$q$, NULL, $q$Brandy$q$, $q$Klipdrift$q$, NULL, $q$ZA$q$, NULL, $q$https://sabrandy.co.za/brands/klipdrift/$q$, $q$reference$q$),
($q$Korbel 12$q$, NULL, $q$American Brandy$q$, $q$Korbel$q$, NULL, $q$US$q$, NULL, $q$https://www.korbel.com/brandy/$q$, $q$producer$q$),
($q$Korbel 18$q$, NULL, $q$American Brandy$q$, $q$Korbel$q$, NULL, $q$US$q$, NULL, $q$https://www.korbel.com/brandy/$q$, $q$producer$q$),
($q$Korbel California Brandy$q$, $q$Korbel California Brandy$q$, $q$American Brandy$q$, $q$Korbel$q$, 40, $q$US$q$, NULL, $q$https://www.korbel.com/brandy/$q$, $q$producer$q$),
($q$Korbel Gold Reserve VSOP$q$, NULL, $q$American Brandy$q$, $q$Korbel$q$, 40, $q$US$q$, NULL, $q$https://www.korbel.com/brandy/$q$, $q$producer$q$),
($q$Laird's 10th Generation Apple Brandy$q$, NULL, $q$Apple Brandy$q$, $q$Laird's$q$, NULL, $q$US$q$, NULL, $q$https://www.lairdandcompany.com/our-products$q$, $q$producer$q$),
($q$Laird's 12 Year Old Rare Apple Brandy$q$, $q$Laird's 12 Year Apple Brandy$q$, $q$Apple Brandy$q$, $q$Laird's$q$, 44, $q$US$q$, NULL, $q$https://www.lairdandcompany.com/our-products$q$, $q$producer$q$),
($q$Laird's 7½ Year Old Apple Brandy$q$, $q$Laird's 7.5yr Apple Brandy$q$, $q$Apple Brandy$q$, $q$Laird's$q$, NULL, $q$US$q$, NULL, $q$https://www.lairdandcompany.com/our-products$q$, $q$producer$q$),
($q$Laird's Blended Applejack$q$, $q$Laird's Applejack$q$, $q$Applejack$q$, $q$Laird's$q$, 40, $q$US$q$, NULL, $q$https://www.lairdandcompany.com/our-products$q$, $q$producer$q$),
($q$Laird's Jersey Lightning Unaged Apple Brandy$q$, NULL, $q$Apple Brandy$q$, $q$Laird's$q$, NULL, $q$US$q$, NULL, $q$https://www.lairdandcompany.com/our-products$q$, $q$producer$q$),
($q$Laird's Straight Apple Brandy Bottled in Bond$q$, $q$Laird's Bottled-in-Bond Apple Brandy$q$, $q$Apple Brandy$q$, $q$Laird's$q$, NULL, $q$US$q$, NULL, $q$https://www.lairdandcompany.com/our-products$q$, $q$producer$q$),
($q$Laird's Straight Applejack 86$q$, $q$Lairds Applejack 86 brandy(ish)$q$, $q$Applejack$q$, $q$Laird's$q$, 43, $q$US$q$, NULL, $q$https://checkout.lairdandcompany.com/products/lairds-straight-applejack-86$q$, $q$producer$q$),
($q$Larressingle VSOP$q$, $q$Larressingle VSOP Armagnac$q$, $q$Armagnac$q$, $q$Larressingle$q$, 40, $q$FR$q$, $q$Armagnac$q$, $q$https://petitecellars.bottlenose.wine/products/13372219/larressingle-vsop-armagnac$q$, $q$retailer$q$),
($q$Louis Royer Force 53 VSOP$q$, $q$Louis Royer Force 53 Cognac$q$, $q$Cognac$q$, $q$Louis Royer$q$, 53, $q$FR$q$, $q$Cognac$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/7876/louis-royer-force-53-vsop-cognac$q$, $q$reference$q$),
($q$Lustau Brandy Solera Gran Reserva$q$, NULL, $q$Brandy de Jerez$q$, $q$Lustau$q$, 40, $q$ES$q$, $q$Brandy de Jerez$q$, $q$https://lustau.es/tienda/brandy-de-jerez/lustau-brandy-solera-gran-reserva/$q$, $q$producer$q$),
($q$Lustau Brandy Solera Gran Reserva Family Reserve$q$, NULL, $q$Brandy de Jerez$q$, $q$Lustau$q$, 43, $q$ES$q$, $q$Brandy de Jerez$q$, $q$https://lustau.es/tienda/brandy-de-jerez/lustau-brandy-solera-gran-reserva-family-reserve/$q$, $q$producer$q$),
($q$Lustau Brandy Solera Gran Reserva Finest Selection$q$, NULL, $q$Brandy de Jerez$q$, $q$Lustau$q$, 40, $q$ES$q$, $q$Brandy de Jerez$q$, $q$https://lustau.es/tienda/brandy-de-jerez/brandy-solera-gran-reserva-finest-selection/$q$, $q$producer$q$),
($q$Lustau Brandy Solera Reserva$q$, NULL, $q$Brandy de Jerez$q$, $q$Lustau$q$, 40, $q$ES$q$, $q$Brandy de Jerez$q$, $q$https://lustau.es/tienda/brandy-de-jerez/lustau-brandy-solera-reserva/$q$, $q$producer$q$),
($q$Luxardo Kirsch$q$, NULL, $q$Kirsch$q$, $q$Luxardo$q$, 40, $q$IT$q$, NULL, $q$https://www.bcliquorstores.com/product/667780$q$, $q$retailer$q$),
($q$La Diablada Pisco$q$, $q$La Diablada Pisco$q$, $q$Acholado Pisco$q$, $q$Macchu Pisco$q$, NULL, $q$PE$q$, $q$Pisco$q$, $q$https://macchupisco.com/main$q$, $q$producer$q$),
($q$Macchu Pisco$q$, $q$Macchu Pisco$q$, $q$Pisco$q$, $q$Macchu Pisco$q$, NULL, $q$PE$q$, $q$Pisco$q$, $q$https://macchupisco.com/main$q$, $q$producer$q$),
($q$Ñusta Pisco$q$, NULL, $q$Pisco$q$, $q$Macchu Pisco$q$, NULL, $q$PE$q$, $q$Pisco$q$, $q$https://macchupisco.com/main$q$, $q$producer$q$),
($q$Manguin Abricot du Ventoux$q$, $q$Manguin Apricot EDV$q$, $q$Eau-de-vie$q$, $q$Manguin$q$, 45, $q$FR$q$, NULL, $q$https://manguin.com/produit/abricot-ventoux-50cl$q$, $q$producer$q$),
($q$Manguin Eau-de-vie de Mirabelle$q$, NULL, $q$Plum Brandy$q$, $q$Manguin$q$, 43, $q$FR$q$, NULL, $q$https://manguin.com/produit/eau-de-vie-de-mirabelles-70cl$q$, $q$producer$q$),
($q$Manguin Eau-de-vie de Poire Williams N°43$q$, NULL, $q$Poire Williams$q$, $q$Manguin$q$, 43, $q$FR$q$, NULL, $q$https://manguin.com/produit/eau-de-vie-de-poires-williams-70cl$q$, $q$producer$q$),
($q$Manguin Eau-de-vie de Vieille Prune$q$, NULL, $q$Plum Brandy$q$, $q$Manguin$q$, 40, $q$FR$q$, NULL, $q$https://manguin.com/produit/eau-de-vie-de-vieille-prune-70cl$q$, $q$producer$q$),
($q$Manguin La Poire N°45$q$, NULL, $q$Poire Williams$q$, $q$Manguin$q$, 45, $q$FR$q$, NULL, $q$https://manguin.com/produit/la-poire-45-70cl$q$, $q$producer$q$),
($q$Manguin Poire Williams Brut Fût de Muscat$q$, NULL, $q$Poire Williams$q$, $q$Manguin$q$, 54, $q$FR$q$, NULL, $q$https://manguin.com/produit/poire-williams-brut-de-fut-50cl$q$, $q$producer$q$),
($q$Manguin Poire Williams Rouge N°47$q$, NULL, $q$Poire Williams$q$, $q$Manguin$q$, 47, $q$FR$q$, NULL, $q$https://manguin.com/produit/poires-williams-rouges-50cl$q$, $q$producer$q$),
($q$Marie Duffau Napoléon Bas-Armagnac$q$, $q$Marie Duffau Napoléon Bas-Armagnac$q$, $q$Armagnac$q$, $q$Marie Duffau$q$, 40, $q$FR$q$, $q$Armagnac$q$, $q$https://petitecellars.bottlenose.wine/products/13372220/marie-duffau-bas-armagnac-napoleon$q$, $q$retailer$q$),
($q$Marolo Grappa Dedicata al Padre$q$, NULL, $q$Grappa$q$, $q$Marolo$q$, 60, $q$IT$q$, $q$Grappa$q$, $q$https://www.marolo.com/it/prodotti/le-classiche/grappa-dedicata-padre$q$, $q$producer$q$),
($q$Marolo Grappa di Amarone$q$, NULL, $q$Grappa$q$, $q$Marolo$q$, 45, $q$IT$q$, $q$Grappa$q$, $q$https://www.marolo.com/it/prodotti/le-classiche/grappa-di-amarone$q$, $q$producer$q$),
($q$Marolo Grappa di Arneis$q$, NULL, $q$Grappa$q$, $q$Marolo$q$, 42, $q$IT$q$, $q$Grappa$q$, $q$https://www.marolo.com/it/prodotti/le-classiche/grappa-di-arneis$q$, $q$producer$q$),
($q$Marolo Grappa di Barbaresco$q$, NULL, $q$Grappa$q$, $q$Marolo$q$, 44, $q$IT$q$, $q$Grappa$q$, $q$https://www.marolo.com/it/prodotti/le-classiche/grappa-di-barbaresco$q$, $q$producer$q$),
($q$Marolo Grappa di Barbera$q$, NULL, $q$Grappa$q$, $q$Marolo$q$, 40, $q$IT$q$, $q$Grappa$q$, $q$https://www.marolo.com/it/prodotti/le-classiche/grappa-di-barbera$q$, $q$producer$q$),
($q$Marolo Grappa di Barolo$q$, $q$Marolo Grappa di Barolo$q$, $q$Grappa$q$, $q$Marolo$q$, 50, $q$IT$q$, $q$Grappa$q$, $q$https://www.marolo.com/it/prodotti/le-classiche/grappa-di-barolo$q$, $q$producer$q$),
($q$Marolo Grappa di Brunello$q$, NULL, $q$Grappa$q$, $q$Marolo$q$, 44, $q$IT$q$, $q$Grappa$q$, $q$https://www.marolo.com/it/prodotti/le-classiche/grappa-brunello$q$, $q$producer$q$),
($q$Marolo Grappa di Dolcetto$q$, NULL, $q$Grappa$q$, $q$Marolo$q$, 44, $q$IT$q$, $q$Grappa$q$, $q$https://www.marolo.com/it/prodotti/le-classiche/grappa-di-dolcetto$q$, $q$producer$q$),
($q$Marolo Grappa di Moscato$q$, NULL, $q$Grappa$q$, $q$Marolo$q$, 42, $q$IT$q$, $q$Grappa$q$, $q$https://www.marolo.com/it/prodotti/le-classiche/grappa-di-moscato$q$, $q$producer$q$),
($q$Marolo Grappa di Nebbiolo$q$, NULL, $q$Grappa$q$, $q$Marolo$q$, 44, $q$IT$q$, $q$Grappa$q$, $q$https://www.marolo.com/it/prodotti/le-classiche/grappa-di-nebbiolo$q$, $q$producer$q$),
($q$Martell Blue Swift$q$, $q$Martell 'Blue Swift' Cognac$q$, $q$Cognac$q$, $q$Martell$q$, 40, $q$FR$q$, NULL, $q$https://www.bcliquorstores.com/product/180568$q$, $q$retailer$q$),
($q$Martell Cordon Bleu$q$, $q$Martell Cordon Bleu Cognac$q$, $q$Cognac$q$, $q$Martell$q$, 40, $q$FR$q$, $q$Cognac$q$, $q$https://www.bcliquorstores.com/product/749812$q$, $q$retailer$q$),
($q$Martell Noblige$q$, $q$Martell Noblige$q$, $q$Cognac$q$, $q$Martell$q$, 40, $q$FR$q$, $q$Cognac$q$, $q$https://www.diffordsguide.com/en-au/beer-wine-spirits/1979/martell-noblige$q$, $q$reference$q$),
($q$Martell VS Single Distillery$q$, $q$Martell VS Cognac$q$, $q$Cognac$q$, $q$Martell$q$, 40, $q$FR$q$, $q$Cognac$q$, $q$https://www.bcliquorstores.com/product/612572$q$, $q$retailer$q$),
($q$Martell VSOP Aged in Red Barrels$q$, $q$Martell V.S.O.P Cognac$q$, $q$Cognac$q$, $q$Martell$q$, 40, $q$FR$q$, $q$Cognac$q$, $q$https://www.reservebar.com/products/martell-vsop-aged-in-red-barrels-cognac/GROUPING-1154866$q$, $q$retailer$q$),
($q$Martell XO$q$, NULL, $q$Cognac$q$, $q$Martell$q$, 40, $q$FR$q$, $q$Cognac$q$, $q$https://www.bcliquorstores.com/product/477794$q$, $q$retailer$q$),
($q$Massenez Coing Prestige$q$, NULL, $q$Quince Eau De Vie$q$, $q$Massenez$q$, 43, $q$FR$q$, NULL, $q$https://www.distilleriespeureux.com/eau-de-vie-coing-prestige-massenez$q$, $q$producer$q$),
($q$Massenez Eau-de-vie de Mirabelle VRP$q$, NULL, $q$Plum Brandy$q$, $q$Massenez$q$, 40, $q$FR$q$, NULL, $q$https://www.distilleriespeureux.com/eau-de-vie-mirabelle-vrp-massenez$q$, $q$producer$q$),
($q$Massenez Framboise Sauvage$q$, $q$Massenez Framboise Sauvage$q$, $q$Raspberry Eau de Vie$q$, $q$Massenez$q$, 40, $q$FR$q$, NULL, $q$https://www.distilleriespeureux.com/eau-de-vie-framboise-sauvage-vrp-massenez$q$, $q$producer$q$),
($q$Massenez Framboise Sauvage Origine$q$, NULL, $q$Raspberry Eau de Vie$q$, $q$Massenez$q$, 40, $q$FR$q$, NULL, $q$https://www.distilleriespeureux.com/eau-de-vie-framboise-sauvage-origine-massenez$q$, $q$producer$q$),
($q$Massenez Kirsch Origine$q$, NULL, $q$Kirsch$q$, $q$Massenez$q$, 40, $q$FR$q$, NULL, $q$https://www.distilleriespeureux.com/eau-de-vie-kirsch-origine-massenez$q$, $q$producer$q$),
($q$Massenez Kirsch Vieux$q$, $q$Massenez Kirsch Vieux$q$, $q$Kirsch$q$, $q$Massenez$q$, 40, $q$FR$q$, NULL, $q$https://www.distilleriespeureux.com/eau-de-vie-kirsch-vrp-massenez$q$, $q$producer$q$),
($q$Massenez Mirabelle Origine$q$, NULL, $q$Plum Brandy$q$, $q$Massenez$q$, 40, $q$FR$q$, NULL, $q$https://www.distilleriespeureux.com/eau-de-vie-mirabelle-origine-massenez$q$, $q$producer$q$),
($q$Massenez Poire Prisonnière$q$, NULL, $q$Poire Williams$q$, $q$Massenez$q$, 40, $q$FR$q$, NULL, $q$https://www.distilleriespeureux.com/eau-de-vie-poire-prisonniere-massenez$q$, $q$producer$q$),
($q$Massenez Poire Williams$q$, $q$Massenez Poire Williams$q$, $q$Poire Williams$q$, $q$Massenez$q$, 40, $q$FR$q$, NULL, $q$https://www.distilleriespeureux.com/eau-de-vie-poire-williams-vrp-massenez$q$, $q$producer$q$),
($q$Massenez Poire Williams Origine$q$, NULL, $q$Poire Williams$q$, $q$Massenez$q$, 40, $q$FR$q$, NULL, $q$https://www.distilleriespeureux.com/eau-de-vie-poire-williams-origine-massenez$q$, $q$producer$q$),
($q$Massenez Quetsche Prestige$q$, NULL, $q$Plum Brandy$q$, $q$Massenez$q$, 46, $q$FR$q$, NULL, $q$https://www.distilleriespeureux.com/eau-de-vie-de-quetsche-prestige-massenez$q$, $q$producer$q$),
($q$Massenez Vieille Prune$q$, NULL, $q$Plum Brandy$q$, $q$Massenez$q$, 40, $q$FR$q$, NULL, $q$https://www.distilleriespeureux.com/eau-de-vie-vieille-prune-massenez$q$, $q$producer$q$),
($q$Merlet Brothers Blend$q$, $q$Merlet Brothers Blend Cognac$q$, $q$Cognac$q$, $q$Merlet$q$, 40, $q$FR$q$, $q$Cognac$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/spirits/brandy-eaux-de-vie-cognac-and-armagnac/BWS002057/merlet-brothers-blend-cognac$q$, $q$reference$q$),
($q$Metaxa 7 Stars$q$, $q$Metaxa 7 Stars$q$, $q$Greek Brandy$q$, $q$Metaxa$q$, 40, $q$GR$q$, NULL, $q$https://www.bcliquorstores.com/product/623333$q$, $q$retailer$q$),
($q$Meukow 90$q$, NULL, $q$Cognac$q$, $q$Meukow$q$, 45, $q$FR$q$, $q$Cognac$q$, $q$https://meukowcognac.com/collection/meukow-90-2/$q$, $q$producer$q$),
($q$Meukow VS$q$, NULL, $q$Cognac$q$, $q$Meukow$q$, NULL, $q$FR$q$, $q$Cognac$q$, $q$https://meukowcognac.com/collection/meukow-vs/$q$, $q$producer$q$),
($q$Meukow VSOP$q$, NULL, $q$Cognac$q$, $q$Meukow$q$, NULL, $q$FR$q$, $q$Cognac$q$, $q$https://meukowcognac.com/collection/meukow-vsop/$q$, $q$producer$q$),
($q$Meukow VSOP Borderies$q$, NULL, $q$Cognac$q$, $q$Meukow$q$, NULL, $q$FR$q$, $q$Cognac$q$, $q$https://meukowcognac.com/collection/vsop-borderies/$q$, $q$producer$q$),
($q$Meukow VSOP Red Edition$q$, NULL, $q$Cognac$q$, $q$Meukow$q$, 40, $q$FR$q$, $q$Cognac$q$, $q$https://www.bcliquorstores.com/product/154722$q$, $q$retailer$q$),
($q$Meukow XO$q$, NULL, $q$Cognac$q$, $q$Meukow$q$, NULL, $q$FR$q$, $q$Cognac$q$, $q$https://meukowcognac.com/collection/meukow-xo/$q$, $q$producer$q$),
($q$Meukow XO Grande Champagne$q$, NULL, $q$Cognac$q$, $q$Meukow$q$, NULL, $q$FR$q$, $q$Cognac$q$, $q$https://meukowcognac.com/collection/meukow-xo-grande-champagne/$q$, $q$producer$q$),
($q$El Gobernador Pisco$q$, $q$El Gobernador Pisco$q$, $q$Pisco$q$, $q$Miguel Torres Chile$q$, 40, $q$CL$q$, $q$Pisco$q$, $q$https://www.bcliquorstores.com/product/844803$q$, $q$retailer$q$),
($q$Pisco El Gobernador$q$, NULL, $q$Pisco$q$, $q$Miguel Torres Chile$q$, NULL, $q$CL$q$, $q$Pisco$q$, $q$https://www.torres.es/en/wines/pisco-el-gobernador$q$, $q$producer$q$),
($q$Méry Melrose VSOP Organic Grande Champagne$q$, NULL, $q$Cognac$q$, $q$Méry Melrose$q$, NULL, $q$FR$q$, $q$Cognac$q$, $q$https://onereddot.com/en/product/detail/1019/$q$, $q$retailer$q$),
($q$Nardini Grappa Bianca$q$, $q$Nardini Grappa Bianca$q$, $q$Grappa$q$, $q$Nardini$q$, 50, $q$IT$q$, $q$Grappa$q$, $q$https://www.nardini.it/product/19646694/grappa?lang=en_US$q$, $q$producer$q$),
($q$Nardini Grappa Extrafina$q$, NULL, $q$Grappa$q$, $q$Nardini$q$, 42, $q$IT$q$, $q$Grappa$q$, $q$https://www.nardini.it/product/19646755/grappa-extrafina?lang=en_US$q$, $q$producer$q$),
($q$Nardini Grappa Riserva$q$, NULL, $q$Grappa$q$, $q$Nardini$q$, 50, $q$IT$q$, $q$Grappa$q$, $q$https://www.nardini.it/product/19646704/grappa-riserva?lang=en_US$q$, $q$producer$q$),
($q$Nardini Grappa Riserva 15 Anni$q$, NULL, $q$Grappa$q$, $q$Nardini$q$, 45, $q$IT$q$, $q$Grappa$q$, $q$https://www.nardini.it/product/19646758/grappa-riserva-15-anni?lang=en_US$q$, $q$producer$q$),
($q$Nardini Grappa Riserva 5 Anni$q$, NULL, $q$Grappa$q$, $q$Nardini$q$, 42, $q$IT$q$, $q$Grappa$q$, $q$https://www.nardini.it/product/22620906/grappa-riserva-5-anni?lang=en_US$q$, $q$producer$q$),
($q$Nardini Grappa Riserva 7 Anni$q$, NULL, $q$Grappa$q$, $q$Nardini$q$, 45, $q$IT$q$, $q$Grappa$q$, $q$https://www.nardini.it/product/19646757/grappa-riserva-7-anni?lang=en_US$q$, $q$producer$q$),
($q$Nonino Grappa 41° in Barriques 12 Months$q$, NULL, $q$Grappa$q$, $q$Nonino$q$, 41, $q$IT$q$, $q$Grappa$q$, $q$https://www.grappanonino.it/en/grappa-en/grappa-nonino-41-barriques/$q$, $q$producer$q$),
($q$Nonino Grappa AnticaCuvée Riserva 5 Years$q$, NULL, $q$Grappa$q$, $q$Nonino$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.grappanonino.it/en/grappa-en/anticacuvee-riserva-5-years/$q$, $q$producer$q$),
($q$Nonino Grappa Friulana 43°$q$, NULL, $q$Grappa$q$, $q$Nonino$q$, 43, $q$IT$q$, $q$Grappa$q$, $q$https://www.grappanonino.it/en/grappa-en/nonino-43/$q$, $q$producer$q$),
($q$Nonino Grappa Il Merlot$q$, NULL, $q$Grappa$q$, $q$Nonino$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.grappanonino.it/en/grappa-en/il-merlot/$q$, $q$producer$q$),
($q$Nonino Grappa Il Moscato$q$, $q$Nonino Grappa Il Moscato$q$, $q$Grappa$q$, $q$Nonino$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.grappanonino.it/en/grappa-en/il-moscato/$q$, $q$producer$q$),
($q$Nonino Grappa Il Sauvignon Blanc$q$, NULL, $q$Grappa$q$, $q$Nonino$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.grappanonino.it/en/grappa-en/il-sauvignon-blanc/$q$, $q$producer$q$),
($q$Nonino Grappa Optima$q$, NULL, $q$Grappa$q$, $q$Nonino$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.grappanonino.it/en/grappa-en/optima/$q$, $q$producer$q$),
($q$Nonino Grappa Picolit Cru$q$, NULL, $q$Grappa$q$, $q$Nonino$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.grappanonino.it/en/grappa-en/picolit-cru-the-legendary-grappa/$q$, $q$producer$q$),
($q$Nonino Grappa Riserva 8 Years$q$, NULL, $q$Grappa$q$, $q$Nonino$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.grappanonino.it/en/grappa-en/grappa-nonino-riserva-aged-8-years/$q$, $q$producer$q$),
($q$Nonino Grappa Tradizione 50°$q$, NULL, $q$Grappa$q$, $q$Nonino$q$, 50, $q$IT$q$, $q$Grappa$q$, $q$https://www.grappanonino.it/en/grappa-en/nonino-50/$q$, $q$producer$q$),
($q$Nonino Grappa Vendemmia$q$, NULL, $q$Grappa$q$, $q$Nonino$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.grappanonino.it/en/grappa-en/vendemmia/$q$, $q$producer$q$),
($q$Nonino Grappa Vendemmia Riserva 18 Months$q$, NULL, $q$Grappa$q$, $q$Nonino$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.grappanonino.it/en/grappa-en/vendemmia-riserva-18-months/$q$, $q$producer$q$),
($q$Nonino Grappa da Prosecco$q$, NULL, $q$Grappa$q$, $q$Nonino$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.grappanonino.it/en/grappa-en/il-prosecco-bianco/$q$, $q$producer$q$),
($q$Nonino Grappa lo Chardonnay in Barriques 12 Months$q$, NULL, $q$Grappa$q$, $q$Nonino$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.grappanonino.it/en/grappa-en/lo-chardonnay-in-barriques-12-months/$q$, $q$producer$q$),
($q$Carlos I$q$, $q$Carlos I Solera Gran Reserva Brandy$q$, $q$Brandy de Jerez$q$, $q$Osborne$q$, 40, $q$ES$q$, $q$Brandy de Jerez$q$, $q$https://www.osborne.es/en/shop-online/product/4737/carlos-i$q$, $q$producer$q$),
($q$Carlos I Amontillado$q$, NULL, $q$Brandy de Jerez$q$, $q$Osborne$q$, NULL, $q$ES$q$, NULL, $q$https://www.osborne.es/en/marca-carlos-i$q$, $q$producer$q$),
($q$Carlos I Imperial$q$, NULL, $q$Brandy de Jerez$q$, $q$Osborne$q$, NULL, $q$ES$q$, NULL, $q$https://www.osborne.es/en/marca-carlos-i$q$, $q$producer$q$),
($q$Carlos I Pedro Ximénez$q$, NULL, $q$Brandy de Jerez$q$, $q$Osborne$q$, NULL, $q$ES$q$, NULL, $q$https://www.osborne.es/en/marca-carlos-i$q$, $q$producer$q$),
($q$Magno$q$, $q$Magno Brandy de Jerez$q$, $q$Brandy de Jerez$q$, $q$Osborne$q$, 36, $q$ES$q$, $q$Brandy de Jerez$q$, $q$https://www.osborne.es/en/shop-online/product/1060/brandy-magno$q$, $q$producer$q$),
($q$Park Mizunara 12 Years$q$, NULL, $q$Cognac$q$, $q$Park$q$, NULL, $q$FR$q$, $q$Cognac$q$, $q$https://www.park-cognac.com/en/mizunara-12-ans/$q$, $q$producer$q$),
($q$Park Mizunara 5 Years$q$, NULL, $q$Cognac$q$, $q$Park$q$, NULL, $q$FR$q$, $q$Cognac$q$, $q$https://www.park-cognac.com/en/mizunara-5-ans/$q$, $q$producer$q$),
($q$Park VS Carte Blanche$q$, $q$Park VS Cognac$q$, $q$Cognac$q$, $q$Park$q$, NULL, $q$FR$q$, $q$Cognac$q$, $q$https://www.park-cognac.com/en/vs-carte-blanche-2/$q$, $q$producer$q$),
($q$Park VSOP Organic$q$, NULL, $q$Cognac$q$, $q$Park$q$, NULL, $q$FR$q$, $q$Cognac$q$, $q$https://www.park-cognac.com/en/vsop-organic-4/$q$, $q$producer$q$),
($q$Park VSOP Reflet Cuivré$q$, NULL, $q$Cognac$q$, $q$Park$q$, NULL, $q$FR$q$, $q$Cognac$q$, $q$https://www.park-cognac.com/en/vsop-reflet-cuivre-2/$q$, $q$producer$q$),
($q$Park XO Borderies$q$, NULL, $q$Cognac$q$, $q$Park$q$, NULL, $q$FR$q$, $q$Cognac$q$, $q$https://www.park-cognac.com/en/xo-blossom-2/$q$, $q$producer$q$),
($q$Park XO Fine Champagne$q$, NULL, $q$Cognac$q$, $q$Park$q$, NULL, $q$FR$q$, $q$Cognac$q$, $q$https://www.park-cognac.com/en/xo-cigare-blend/$q$, $q$producer$q$),
($q$Paul Masson Grande Amber VS$q$, $q$Paul Masson Grande Amber VS Brandy$q$, $q$American Brandy$q$, $q$Paul Masson$q$, NULL, $q$US$q$, NULL, $q$https://paulmasson.com/classics$q$, $q$producer$q$),
($q$Paul Masson Grande Amber VSOP$q$, NULL, $q$American Brandy$q$, $q$Paul Masson$q$, NULL, $q$US$q$, NULL, $q$https://paulmasson.com/classics$q$, $q$producer$q$),
($q$Pierre Ferrand 10 Générations$q$, NULL, $q$Cognac$q$, $q$Pierre Ferrand$q$, NULL, $q$FR$q$, NULL, $q$https://ferrandcognac.com/en/$q$, $q$producer$q$),
($q$Pierre Ferrand 1840 Original Formula$q$, $q$Pierre Ferrand 1840 Original Formula Cognac$q$, $q$Cognac$q$, $q$Pierre Ferrand$q$, 45, $q$FR$q$, $q$Cognac$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/spirits/brandy-eaux-de-vie-cognac-armagnac-rakia-etc/BWS000733/ferrand-1840-original$q$, $q$reference$q$),
($q$Pierre Ferrand Ambre$q$, $q$Pierre Ferrand Ambre Cognac$q$, $q$Cognac$q$, $q$Pierre Ferrand$q$, NULL, $q$FR$q$, NULL, $q$https://ferrandcognac.com/en/$q$, $q$producer$q$),
($q$Pierre Ferrand Double Cask Réserve$q$, NULL, $q$Cognac$q$, $q$Pierre Ferrand$q$, NULL, $q$FR$q$, NULL, $q$https://ferrandcognac.com/en/$q$, $q$producer$q$),
($q$Pierre Ferrand Sélection des Anges$q$, NULL, $q$Cognac$q$, $q$Pierre Ferrand$q$, NULL, $q$FR$q$, NULL, $q$https://ferrandcognac.com/en/$q$, $q$producer$q$),
($q$PO' di Poli Aromatica$q$, NULL, $q$Grappa$q$, $q$Poli$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.poligrappa.com/ita/grappe/po-di-poli-aromatica$q$, $q$producer$q$),
($q$PO' di Poli Elegante$q$, NULL, $q$Grappa$q$, $q$Poli$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.poligrappa.com/ita/grappe/po-di-poli-elegante$q$, $q$producer$q$),
($q$PO' di Poli Morbida$q$, NULL, $q$Grappa$q$, $q$Poli$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.poligrappa.com/ita/grappe/po-di-poli-morbida$q$, $q$producer$q$),
($q$PO' di Poli Secca$q$, NULL, $q$Grappa$q$, $q$Poli$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.poligrappa.com/ita/grappe/po-di-poli-secca$q$, $q$producer$q$),
($q$Poli Amorosa di Dicembre$q$, NULL, $q$Grappa$q$, $q$Poli$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.poligrappa.com/ita/grappe/amorosa-di-dicembre_$q$, $q$producer$q$),
($q$Poli Amorosa di Settembre$q$, NULL, $q$Grappa$q$, $q$Poli$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.poligrappa.com/ita/grappe/amorosa-di-settembre$q$, $q$producer$q$),
($q$Poli Barrique Solera di Famiglia$q$, NULL, $q$Grappa$q$, $q$Poli$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.poligrappa.com/ita/grappe/poli-barrique$q$, $q$producer$q$),
($q$Poli Bassano 24 Carati Oro$q$, NULL, $q$Grappa$q$, $q$Poli$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.poligrappa.com/ita/grappe/bassano-24-carati$q$, $q$producer$q$),
($q$Poli Bassano Classica$q$, NULL, $q$Grappa$q$, $q$Poli$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.poligrappa.com/ita/grappe/bassano-classica$q$, $q$producer$q$),
($q$Poli Cleopatra Amarone Oro$q$, NULL, $q$Grappa$q$, $q$Poli$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.poligrappa.com/ita/grappe/cleopatra-amarone-oro$q$, $q$producer$q$),
($q$Poli Cleopatra Moscato Oro$q$, NULL, $q$Grappa$q$, $q$Poli$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.poligrappa.com/ita/grappe/cleopatra-moscato-oro$q$, $q$producer$q$),
($q$Poli Due Barili$q$, NULL, $q$Grappa$q$, $q$Poli$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.poligrappa.com/ita/grappe/due-barili$q$, $q$producer$q$),
($q$Poli Maria Bio$q$, NULL, $q$Grappa$q$, $q$Poli$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.poligrappa.com/ita/grappe/maria-grappa-biologica$q$, $q$producer$q$),
($q$Sarpa Oro di Poli$q$, NULL, $q$Grappa$q$, $q$Poli$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.poligrappa.com/ita/grappe/sarpa-barrique$q$, $q$producer$q$),
($q$Sarpa di Poli$q$, $q$Poli Sarpa di Poli Grappa$q$, $q$Grappa$q$, $q$Poli$q$, NULL, $q$IT$q$, $q$Grappa$q$, $q$https://www.poligrappa.com/ita/grappe/sarpa$q$, $q$producer$q$),
($q$Blume Marillen$q$, NULL, $q$Eau-de-vie$q$, $q$Purkhart$q$, 40, $q$AT$q$, NULL, $q$https://alpenz.com/producer-purkhart.html$q$, $q$reference$q$),
($q$Purkhart Pear Williams$q$, $q$Purkhart Pear Williams Eau-de-Vie$q$, $q$Poire Williams$q$, $q$Purkhart$q$, 40, $q$AT$q$, NULL, $q$https://alpenz.com/producer-purkhart.html$q$, $q$reference$q$),
($q$Père Magloire Fine VS$q$, $q$Père Magloire Fine Calvados$q$, $q$Calvados$q$, $q$Père Magloire$q$, 40, $q$FR$q$, $q$Calvados$q$, $q$https://thedailypour.com/?p=141718$q$, $q$reference$q$),
($q$R. Jelínek Hruškovice$q$, NULL, $q$Poire Williams$q$, $q$R. Jelínek$q$, NULL, $q$CZ$q$, NULL, $q$https://www.rjelinek.cz/produkt/r-jelinek-hruskovice/$q$, $q$producer$q$),
($q$R. Jelínek Jadernička$q$, NULL, $q$Apple Brandy$q$, $q$R. Jelínek$q$, NULL, $q$CZ$q$, NULL, $q$https://www.rjelinek.cz/produkt/r-jelinek-jadernicka/$q$, $q$producer$q$),
($q$R. Jelínek Meruňkovice$q$, NULL, $q$Eau-de-vie$q$, $q$R. Jelínek$q$, NULL, $q$CZ$q$, NULL, $q$https://www.rjelinek.cz/produkt/r-jelinek-merunkovice/$q$, $q$producer$q$),
($q$R. Jelínek Slivovice$q$, $q$R. Jelínek Slivovitz$q$, $q$Plum Brandy$q$, $q$R. Jelínek$q$, NULL, $q$CZ$q$, NULL, $q$https://www.rjelinek.cz/produkt/r-jelinek-slivovice/$q$, $q$producer$q$),
($q$R. Jelínek Slivovice Zlatá$q$, NULL, $q$Plum Brandy$q$, $q$R. Jelínek$q$, NULL, $q$CZ$q$, NULL, $q$https://www.rjelinek.cz/produkt/r-jelinek-slivovice-zlata/$q$, $q$producer$q$),
($q$R. Jelínek Třešňovice$q$, NULL, $q$Kirsch$q$, $q$R. Jelínek$q$, NULL, $q$CZ$q$, NULL, $q$https://www.rjelinek.cz/produkt/r-jelinek-tresnovice/$q$, $q$producer$q$),
($q$Reisetbauer Apricot$q$, NULL, $q$Eau-de-vie$q$, $q$Reisetbauer$q$, NULL, $q$AT$q$, NULL, $q$https://www.reisetbauer.at/edelbrände?lang=en$q$, $q$producer$q$),
($q$Reisetbauer Carrot$q$, NULL, $q$Eau-de-vie$q$, $q$Reisetbauer$q$, NULL, $q$AT$q$, NULL, $q$https://www.reisetbauer.at/edelbrände?lang=en$q$, $q$producer$q$),
($q$Reisetbauer Ginger$q$, $q$Reisetbauer Ginger Eau de Vie$q$, $q$Eau-de-vie$q$, $q$Reisetbauer$q$, NULL, $q$AT$q$, NULL, $q$https://www.reisetbauer.at/edelbrände?lang=en$q$, $q$producer$q$),
($q$Reisetbauer Plum$q$, NULL, $q$Plum Brandy$q$, $q$Reisetbauer$q$, NULL, $q$AT$q$, NULL, $q$https://www.reisetbauer.at/edelbrände?lang=en$q$, $q$producer$q$),
($q$Reisetbauer Quince$q$, NULL, $q$Quince Eau De Vie$q$, $q$Reisetbauer$q$, NULL, $q$AT$q$, NULL, $q$https://www.reisetbauer.at/edelbrände?lang=en$q$, $q$producer$q$),
($q$Reisetbauer Williams Pear$q$, $q$Reisetbauer Williams Pear Brandy$q$, $q$Poire Williams$q$, $q$Reisetbauer$q$, NULL, $q$AT$q$, NULL, $q$https://www.reisetbauer.at/edelbrände?lang=en$q$, $q$producer$q$),
($q$Rhine Hall Apricot Brandy$q$, NULL, $q$Eau-de-vie$q$, $q$Rhine Hall$q$, NULL, $q$US$q$, NULL, $q$https://www.rhinehall.com/spirits/apricot-brandy$q$, $q$producer$q$),
($q$Rhine Hall Banana Brandy$q$, NULL, $q$Eau-de-vie$q$, $q$Rhine Hall$q$, NULL, $q$US$q$, NULL, $q$https://www.rhinehall.com/spirits/banana-brandy$q$, $q$producer$q$),
($q$Rhine Hall Cherry Brandy$q$, NULL, $q$Kirsch$q$, $q$Rhine Hall$q$, NULL, $q$US$q$, NULL, $q$https://www.rhinehall.com/spirits/cherry-brandy$q$, $q$producer$q$),
($q$Rhine Hall Grappa$q$, NULL, $q$Grappa$q$, $q$Rhine Hall$q$, NULL, $q$US$q$, NULL, $q$https://www.rhinehall.com/spirits/grappa$q$, $q$producer$q$),
($q$Rhine Hall Guava Eau de Vie$q$, $q$Rhine Hall Guava Eau-De-Vie$q$, $q$Eau-de-vie$q$, $q$Rhine Hall$q$, NULL, $q$US$q$, NULL, $q$https://www.rhinehall.com/spirits/guava-edv-e94ne-feccb$q$, $q$producer$q$),
($q$Rhine Hall Mango Eau de Vie$q$, $q$Rhine Hall Mango Brandy$q$, $q$Eau-de-vie$q$, $q$Rhine Hall$q$, NULL, $q$US$q$, NULL, $q$https://www.rhinehall.com/spirits/mango-edv$q$, $q$producer$q$),
($q$Rhine Hall Pear Brandy$q$, NULL, $q$Pear Brandy$q$, $q$Rhine Hall$q$, NULL, $q$US$q$, NULL, $q$https://www.rhinehall.com/spirits/pear-brandy$q$, $q$producer$q$),
($q$Rhine Hall Pineapple Eau de Vie$q$, NULL, $q$Eau-de-vie$q$, $q$Rhine Hall$q$, NULL, $q$MX$q$, NULL, $q$https://www.rhinehall.com/spirits/pineapple-edv-e94ne$q$, $q$producer$q$),
($q$Rhine Hall Plum Brandy$q$, NULL, $q$Plum Brandy$q$, $q$Rhine Hall$q$, NULL, $q$US$q$, NULL, $q$https://www.rhinehall.com/spirits/plum-brandy$q$, $q$producer$q$),
($q$Rhine Hall Reserve Apple Brandy$q$, NULL, $q$Apple Brandy$q$, $q$Rhine Hall$q$, NULL, $q$US$q$, NULL, $q$https://www.rhinehall.com/spirits/reserve-apple-brandy$q$, $q$producer$q$),
($q$Rhine Hall Reserve Cherry Brandy$q$, NULL, $q$Kirsch$q$, $q$Rhine Hall$q$, NULL, $q$US$q$, NULL, $q$https://www.rhinehall.com/spirits/reserve-cherry-brandy$q$, $q$producer$q$),
($q$Rhine Hall Reserve Grappa$q$, NULL, $q$Grappa$q$, $q$Rhine Hall$q$, NULL, $q$US$q$, NULL, $q$https://www.rhinehall.com/spirits/reserve-grappa$q$, $q$producer$q$),
($q$Rhine Hall Reserve Pear Brandy$q$, NULL, $q$Pear Brandy$q$, $q$Rhine Hall$q$, NULL, $q$US$q$, NULL, $q$https://www.rhinehall.com/spirits/reserve-pear-brandy$q$, $q$producer$q$),
($q$Rhine Hall Reserve Plum Brandy$q$, NULL, $q$Plum Brandy$q$, $q$Rhine Hall$q$, NULL, $q$US$q$, NULL, $q$https://www.rhinehall.com/spirits/reserve-plum-brandy$q$, $q$producer$q$),
($q$Rémy Martin 1738 Accord Royal$q$, $q$Rémy Martin 1738 Cognac$q$, $q$Cognac$q$, $q$Rémy Martin$q$, NULL, $q$FR$q$, NULL, $q$https://www.remymartin.com/en-us/collection/1738-accord-royal/$q$, $q$producer$q$),
($q$Rémy Martin Tercet$q$, NULL, $q$Cognac$q$, $q$Rémy Martin$q$, NULL, $q$FR$q$, NULL, $q$https://www.remymartin.com/en-us/collection/tercet/$q$, $q$producer$q$),
($q$Rémy Martin V.S.O.P$q$, $q$Rémy Martin VSOP$q$, $q$Cognac$q$, $q$Rémy Martin$q$, NULL, $q$FR$q$, NULL, $q$https://www.remymartin.com/en-us/collection/vsop/$q$, $q$producer$q$),
($q$Rémy Martin XO$q$, $q$Rémy Martin XO$q$, $q$Cognac$q$, $q$Rémy Martin$q$, NULL, $q$FR$q$, NULL, $q$https://www.remymartin.com/en-us/collection/xo/$q$, $q$producer$q$),
($q$Schladerer Schwarzwälder Kirschwasser$q$, $q$Schladerer Kirschwasser$q$, $q$Kirsch$q$, $q$Schladerer$q$, 42, $q$DE$q$, $q$Schwarzwälder Kirschwasser$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/4023/schladerer-schwarzwlder-kirschwasser$q$, $q$reference$q$),
($q$Somerset Alchemy$q$, NULL, $q$Apple Brandy$q$, $q$Somerset Cider Brandy Company$q$, 42, $q$GB$q$, NULL, $q$https://www.somersetciderbrandy.com/all-products/p/somerset-alchemy$q$, $q$producer$q$),
($q$Somerset Cider Brandy 10 Year Old$q$, NULL, $q$Apple Brandy$q$, $q$Somerset Cider Brandy Company$q$, 42, $q$GB$q$, NULL, $q$https://www.somersetciderbrandy.com/all-products/p/somerset-cider-brandy-10-year-old$q$, $q$producer$q$),
($q$Somerset Cider Brandy 20 Year Old$q$, NULL, $q$Apple Brandy$q$, $q$Somerset Cider Brandy Company$q$, 42, $q$GB$q$, NULL, $q$https://www.somersetciderbrandy.com/all-products/p/20-year-old-somerset$q$, $q$producer$q$),
($q$Somerset Cider Brandy 3 Year Old$q$, NULL, $q$Apple Brandy$q$, $q$Somerset Cider Brandy Company$q$, 42, $q$GB$q$, NULL, $q$https://www.somersetciderbrandy.com/all-products/p/somerset-cider-brandy-3-year-old$q$, $q$producer$q$),
($q$Somerset Cider Brandy 5 Year Old$q$, NULL, $q$Apple Brandy$q$, $q$Somerset Cider Brandy Company$q$, 42, $q$GB$q$, NULL, $q$https://www.somersetciderbrandy.com/all-products/p/somerset-cider-brandy-5-year-old$q$, $q$producer$q$),
($q$Somerset Cider Brandy in Somerset Oak$q$, NULL, $q$Apple Brandy$q$, $q$Somerset Cider Brandy Company$q$, 42, $q$GB$q$, NULL, $q$https://www.somersetciderbrandy.com/all-products/p/somersetoak$q$, $q$producer$q$),
($q$Somerset Shipwreck$q$, NULL, $q$Apple Brandy$q$, $q$Somerset Cider Brandy Company$q$, 43, $q$GB$q$, NULL, $q$https://www.somersetciderbrandy.com/all-products/p/shipwreck-somerset-cider-brandy$q$, $q$producer$q$),
($q$Somerset X.O.$q$, NULL, $q$Apple Brandy$q$, $q$Somerset Cider Brandy Company$q$, 42, $q$GB$q$, NULL, $q$https://www.somersetciderbrandy.com/all-products/p/somerset-cider-brandy-xo-3$q$, $q$producer$q$),
($q$St Agnes Bartender's Cut$q$, NULL, $q$Brandy$q$, $q$St Agnes$q$, NULL, $q$AU$q$, NULL, $q$https://stagnesdistillery.com.au/product/bartenders-cut/$q$, $q$producer$q$),
($q$St Agnes VS$q$, $q$St Agnes VS Brandy$q$, $q$Brandy$q$, $q$St Agnes$q$, NULL, $q$AU$q$, NULL, $q$https://stagnesdistillery.com.au/product/st-agnes-vs-very-superior/$q$, $q$producer$q$),
($q$St Agnes VSOP$q$, NULL, $q$Brandy$q$, $q$St Agnes$q$, NULL, $q$AU$q$, NULL, $q$https://stagnesdistillery.com.au/product/st-agnes-vsop/$q$, $q$producer$q$),
($q$St Agnes XO 15 Year Old$q$, NULL, $q$Brandy$q$, $q$St Agnes$q$, NULL, $q$AU$q$, NULL, $q$https://stagnesdistillery.com.au/product/st-agnes-xo-15-year-old/$q$, $q$producer$q$),
($q$St Agnes XO Imperial 20 Year Old$q$, NULL, $q$Brandy$q$, $q$St Agnes$q$, NULL, $q$AU$q$, NULL, $q$https://stagnesdistillery.com.au/product/st-agnes-xo-imperial-20-year-old/$q$, $q$producer$q$),
($q$St-Rémy Napoléon VSOP$q$, $q$St-Rémy VSOP Brandy$q$, $q$Brandy$q$, $q$St-Rémy$q$, NULL, $q$FR$q$, NULL, $q$https://www.remy-cointreau.com/en/brands/st-remy$q$, $q$producer$q$),
($q$St-Rémy Signature$q$, NULL, $q$Brandy$q$, $q$St-Rémy$q$, NULL, $q$FR$q$, NULL, $q$https://www.remy-cointreau.com/en/brands/st-remy$q$, $q$producer$q$),
($q$St-Rémy XO$q$, NULL, $q$Brandy$q$, $q$St-Rémy$q$, NULL, $q$FR$q$, NULL, $q$https://www.remy-cointreau.com/en/brands/st-remy$q$, $q$producer$q$),
($q$Aqua Perfecta Basil Eau de Vie$q$, $q$Aqua Perfecta Basil Brandy$q$, $q$Eau-de-vie$q$, $q$St. George Spirits$q$, NULL, $q$US$q$, NULL, $q$https://stgeorgespirits.com/spirits/aqua-perfecta-basil-eau-de-vie$q$, $q$producer$q$),
($q$St. George California Reserve Apple Brandy$q$, $q$St. George California Reserve Apple Brandy$q$, $q$Apple Brandy$q$, $q$St. George Spirits$q$, NULL, $q$US$q$, NULL, $q$https://stgeorgespirits.com/spirits/california-reserve-apple-brandy$q$, $q$producer$q$),
($q$St. George Pear Brandy$q$, $q$St. George Pear Brandy$q$, $q$Pear Brandy$q$, $q$St. George Spirits$q$, NULL, $q$US$q$, NULL, $q$https://stgeorgespirits.com/spirits/pear-brandy$q$, $q$producer$q$),
($q$St. George Raspberry Brandy$q$, $q$St. George Raspberry Brandy$q$, $q$Raspberry Eau de Vie$q$, $q$St. George Spirits$q$, NULL, $q$US$q$, NULL, $q$https://www.stgeorgespirits.com/spirits$q$, $q$producer$q$),
($q$Suyo Pisco Italia$q$, $q$Suyo Italia Pisco$q$, $q$Pisco$q$, $q$Suyo$q$, NULL, $q$PE$q$, $q$Pisco$q$, $q$https://www.suyopisco.com/piscos/single-origin$q$, $q$producer$q$),
($q$Cardenal Mendoza Carta Real$q$, NULL, $q$Brandy de Jerez$q$, $q$Sánchez Romate$q$, NULL, $q$ES$q$, NULL, $q$https://www.cardenalmendoza.com/en/sherry-brandy/cardenal-mendoza-carta-real$q$, $q$producer$q$),
($q$Cardenal Mendoza Clásico$q$, NULL, $q$Brandy de Jerez$q$, $q$Sánchez Romate$q$, NULL, $q$ES$q$, $q$Brandy de Jerez$q$, $q$https://www.cardenalmendoza.com/en/sherry-brandy/cardenal-mendoza-solera-gran-reserva$q$, $q$producer$q$),
($q$Cardenal Mendoza Nebulis$q$, NULL, $q$Spanish Brandy$q$, $q$Sánchez Romate$q$, NULL, $q$ES$q$, NULL, $q$https://www.cardenalmendoza.com/en/our-brandy-de-jerez/nebulis-unusually-smoky$q$, $q$producer$q$),
($q$Cardenal Mendoza Non Plus Ultra$q$, NULL, $q$Brandy de Jerez$q$, $q$Sánchez Romate$q$, NULL, $q$ES$q$, NULL, $q$https://www.cardenalmendoza.com/en/sherry-brandy/cardenal-mendoza-non-plus-ultra$q$, $q$producer$q$),
($q$Demonio de los Andes Acholado$q$, NULL, $q$Acholado Pisco$q$, $q$Tacama$q$, NULL, $q$PE$q$, NULL, $q$https://www.tacama.com/product/demonio-de-los-andes-acholado/$q$, $q$producer$q$),
($q$Demonio de los Andes Leyenda$q$, NULL, $q$Acholado Pisco$q$, $q$Tacama$q$, NULL, $q$PE$q$, NULL, $q$https://www.tacama.com/product/demonio-de-los-andes-leyenda-acholado/$q$, $q$producer$q$),
($q$Demonio de los Andes Quebranta$q$, NULL, $q$Pisco$q$, $q$Tacama$q$, NULL, $q$PE$q$, NULL, $q$https://www.tacama.com/product/demonio-de-los-andes-quebranta/$q$, $q$producer$q$),
($q$Demonio de los Andes Reserva de Familia Acholado$q$, NULL, $q$Acholado Pisco$q$, $q$Tacama$q$, NULL, $q$PE$q$, NULL, $q$https://www.tacama.com/product/pisco-demonio-de-los-andes-reserva-de-familia-acholado/$q$, $q$producer$q$),
($q$Demonio de los Andes Reserva de Familia Albilla$q$, NULL, $q$Pisco$q$, $q$Tacama$q$, NULL, $q$PE$q$, NULL, $q$https://www.tacama.com/product/pisco-demonio-de-los-andes-reserva-de-familia-albilla/$q$, $q$producer$q$),
($q$Demonio de los Andes Reserva de Familia Italia$q$, NULL, $q$Pisco$q$, $q$Tacama$q$, NULL, $q$PE$q$, NULL, $q$https://www.tacama.com/product/pisco-demonio-de-los-andes-reserva-de-familia-italia/$q$, $q$producer$q$),
($q$Demonio de los Andes Reserva de Familia Moscatel$q$, NULL, $q$Pisco$q$, $q$Tacama$q$, NULL, $q$PE$q$, NULL, $q$https://www.tacama.com/product/pisco-demonio-de-los-andes-reserva-de-familia-moscatel/$q$, $q$producer$q$),
($q$Demonio de los Andes Reserva de Familia Quebranta$q$, NULL, $q$Pisco$q$, $q$Tacama$q$, NULL, $q$PE$q$, NULL, $q$https://www.tacama.com/product/pisco-demonio-de-los-andes-reserva-de-familia-quebranta/$q$, $q$producer$q$),
($q$Gran Demonio Acholado$q$, NULL, $q$Acholado Pisco$q$, $q$Tacama$q$, NULL, $q$PE$q$, NULL, $q$https://www.tacama.com/product/gran-demonio-acholado/$q$, $q$producer$q$),
($q$Gran Demonio Italia$q$, NULL, $q$Pisco$q$, $q$Tacama$q$, NULL, $q$PE$q$, NULL, $q$https://www.tacama.com/product/gran-demonio-italia/$q$, $q$producer$q$),
($q$Gran Demonio Quebranta$q$, NULL, $q$Pisco$q$, $q$Tacama$q$, NULL, $q$PE$q$, NULL, $q$https://www.tacama.com/product/gran-demonio-quebranta/$q$, $q$producer$q$),
($q$Mulita Acholado$q$, NULL, $q$Acholado Pisco$q$, $q$Tacama$q$, NULL, $q$PE$q$, NULL, $q$https://www.tacama.com/product/mulita-acholado/$q$, $q$producer$q$),
($q$Mulita Quebranta$q$, NULL, $q$Pisco$q$, $q$Tacama$q$, NULL, $q$PE$q$, NULL, $q$https://www.tacama.com/product/mulita-quebranta/$q$, $q$producer$q$),
($q$The Christian Brothers VS$q$, $q$Christian Brothers VS Brandy$q$, $q$American Brandy$q$, $q$The Christian Brothers$q$, NULL, $q$US$q$, NULL, $q$http://christianbrothersbrandy.com/our-products.php$q$, $q$producer$q$),
($q$Jaime I$q$, NULL, $q$Spanish Brandy$q$, $q$Torres$q$, NULL, $q$ES$q$, NULL, $q$https://www.torresbrandy.com/en/brandies/jaime-I$q$, $q$producer$q$),
($q$Torres 10$q$, $q$Torres 10 Brandy$q$, $q$Spanish Brandy$q$, $q$Torres$q$, NULL, $q$ES$q$, NULL, $q$https://www.torresbrandy.com/en/brandies/torres-10$q$, $q$producer$q$),
($q$Torres 10 Double Barrel$q$, NULL, $q$Spanish Brandy$q$, $q$Torres$q$, NULL, $q$ES$q$, NULL, $q$https://www.torresbrandy.com/en/brandies/torres-10-double-barrel$q$, $q$producer$q$),
($q$Torres 15$q$, NULL, $q$Spanish Brandy$q$, $q$Torres$q$, NULL, $q$ES$q$, NULL, $q$https://www.torresbrandy.com/en/brandies/torres-15$q$, $q$producer$q$),
($q$Torres 20$q$, NULL, $q$Spanish Brandy$q$, $q$Torres$q$, NULL, $q$ES$q$, NULL, $q$https://www.torresbrandy.com/en/brandies/torres-20$q$, $q$producer$q$),
($q$Torres 5$q$, NULL, $q$Spanish Brandy$q$, $q$Torres$q$, NULL, $q$ES$q$, NULL, $q$https://www.torresbrandy.com/en/brandies/torres-5$q$, $q$producer$q$),
($q$Torres Alta Luz$q$, NULL, $q$Spanish Brandy$q$, $q$Torres$q$, NULL, $q$ES$q$, NULL, $q$https://www.torresbrandy.com/en/brandies/torres-alta-luz$q$, $q$producer$q$),
($q$Vecchia Romagna Etichetta Nera$q$, $q$Vecchia Romagna Etichetta Nera Italian Brandy$q$, $q$Italian Brandy$q$, $q$Vecchia Romagna$q$, 38, $q$IT$q$, NULL, $q$https://proofdrinks.com/brands/vecchia-romagna/$q$, $q$retailer$q$),
($q$Vecchia Romagna Riserva 18 Anni$q$, NULL, $q$Italian Brandy$q$, $q$Vecchia Romagna$q$, 43.8, $q$IT$q$, NULL, $q$https://proofdrinks.com/brands/vecchia-romagna/$q$, $q$retailer$q$),
($q$Vecchia Romagna Riserva Tre Botti$q$, NULL, $q$Italian Brandy$q$, $q$Vecchia Romagna$q$, 40.8, $q$IT$q$, NULL, $q$https://proofdrinks.com/brands/vecchia-romagna/$q$, $q$retailer$q$),
($q$Gran Duque de Alba$q$, $q$Gran Duque de Alba Solera Gran Reserva Brandy$q$, $q$Brandy de Jerez$q$, $q$Williams & Humbert$q$, NULL, $q$ES$q$, $q$Brandy de Jerez$q$, $q$https://www.williams-humbert.com/marcas/gran-duque-de-alba/$q$, $q$producer$q$),
($q$Gran Duque de Alba Oro$q$, NULL, $q$Brandy de Jerez$q$, $q$Williams & Humbert$q$, NULL, $q$ES$q$, NULL, $q$https://www.williams-humbert.com/marcas/gran-duque-de-alba/$q$, $q$producer$q$),
($q$Gran Duque de Alba XO$q$, NULL, $q$Brandy de Jerez$q$, $q$Williams & Humbert$q$, NULL, $q$ES$q$, NULL, $q$https://www.williams-humbert.com/marcas/gran-duque-de-alba/$q$, $q$producer$q$),
($q$Žufánek Apple Brandy$q$, NULL, $q$Apple Brandy$q$, $q$Žufánek$q$, 45, $q$CZ$q$, NULL, $q$https://www.zufanek.cz/en/product/apple-brandy/$q$, $q$producer$q$),
($q$Žufánek Apricot Brandy$q$, NULL, $q$Eau-de-vie$q$, $q$Žufánek$q$, 45, $q$CZ$q$, NULL, $q$https://www.zufanek.cz/en/product/apricot-brandy/$q$, $q$producer$q$),
($q$Žufánek Oak Barrel Aged Apple Brandy$q$, NULL, $q$Apple Brandy$q$, $q$Žufánek$q$, 45, $q$CZ$q$, NULL, $q$https://www.zufanek.cz/en/product/oak-barrel-aged-apple-brandy/$q$, $q$producer$q$),
($q$Žufánek Oak Barrel Aged Pear Brandy$q$, NULL, $q$Pear Brandy$q$, $q$Žufánek$q$, 40, $q$CZ$q$, NULL, $q$https://www.zufanek.cz/en/product/oak-barrel-aged-pear-brandy/$q$, $q$producer$q$),
($q$Žufánek Oak Barrel Aged Slivovitz$q$, NULL, $q$Plum Brandy$q$, $q$Žufánek$q$, 45, $q$CZ$q$, NULL, $q$https://www.zufanek.cz/en/product/oak-barrel-aged-slivovitz/$q$, $q$producer$q$),
($q$Žufánek Pear Brandy$q$, $q$Žufánek Pear Eau-De-Vie$q$, $q$Pear Brandy$q$, $q$Žufánek$q$, 45, $q$CZ$q$, NULL, $q$https://www.zufanek.cz/en/product/pear-brandy/$q$, $q$producer$q$),
($q$Žufánek Quince Spirit$q$, NULL, $q$Quince Eau De Vie$q$, $q$Žufánek$q$, 45, $q$CZ$q$, NULL, $q$https://www.zufanek.cz/en/product/quince-spirit/$q$, $q$producer$q$),
($q$Žufánek Reine Claude$q$, NULL, $q$Plum Brandy$q$, $q$Žufánek$q$, 45, $q$CZ$q$, NULL, $q$https://www.zufanek.cz/en/product/reine-claude/$q$, $q$producer$q$),
($q$Žufánek Slivovitz$q$, NULL, $q$Plum Brandy$q$, $q$Žufánek$q$, 50, $q$CZ$q$, NULL, $q$https://www.zufanek.cz/en/product/slivovitz/$q$, $q$producer$q$);

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
    WHEN b.style IN ($q$Brandy$q$, $q$Cognac$q$, $q$Eau-de-vie$q$, $q$Pisco$q$) AND EXISTS (
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
