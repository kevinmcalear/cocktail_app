-- Liqueurs: every bottle checked on its producer's own page (or, where that
-- page was blocked, a major retailer, importer or Difford's), after
-- 20261011162000. Step 3f of the bottle catalog plan:
-- https://claude.ai/artifact/Vu6seuSNtN42nKYb2nDCVR
--
--   * The core range of every liqueur house in our catalog or on BC
--     Liquor's list, including sloe gin, whisky and rum liqueurs,
--     umeshu and yuzushu (the gin and whisky loads left those out).
--   * On a copy of production (2026-10-09, with the loads before this
--     one applied): 220 new bottles, and 219 we had that get their
--     label name (67 renamed, the old name kept as an alias), style,
--     ABV, country, protected name and maker where they were missing or
--     wrong.
--   * Styles: The most specific existing liqueur style: triple sec,
--     curaçao (blue when blue), cognac orange liqueur, crème de cassis,
--     mûre, pêche, violette, cacao and menthe, maraschino, herbal,
--     génépi, sambuca, falernum, allspice dram, coffee, cream and fruit
--     liqueurs and so on.
--   * Out of scope: amari, bitter aperitivi and gentian aperitifs (the
--     vermouth load), unsweetened spirits (absinthe, pastis, ouzo),
--     syrups, ready-to-drink cans.
--   * Each producer gets an unclaimed maker page (makes: bottles), or a
--     page an earlier load made gains it, and each bottle names it.
--   * Every fact keeps the page it was checked on in item_sources. An
--     ABV read off another page isn't kept, and a review site isn't a
--     source.
--   * An independent second check of 100 random rows found 2 wrong
--     facts in 502 (0.4%). Every correction is taken: Senior Rasenchi
--     "Curaçao" is a raisin liqueur (Liqueur); Mandarine Napoléon is
--     Mandarin Liqueur; Walcher's coffee liqueur loses a vague catalog
--     match; four bottles under one-off styles (Ancho Reyes, Baileys
--     Salted Caramel, two pistachio creams) move to Chile Liqueur and
--     Cream Liqueur. Rows whose page was never opened are held back.
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
(0, $q$Liqueur$q$, NULL);

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
($q$99 Brand$q$, $q$99.brand$q$, $q$https://www.99brand.com/$q$, $q$US$q$, NULL),
($q$Adriatico$q$, $q$adriatico$q$, $q$https://amarettoadriatico.com/$q$, $q$IT$q$, NULL),
($q$Agavero$q$, $q$agavero$q$, NULL, $q$MX$q$, NULL),
($q$Akashi-Tai$q$, $q$akashi.tai$q$, $q$https://www.akashi-tai.com/$q$, $q$JP$q$, NULL),
($q$Alma Finca$q$, $q$alma.finca$q$, $q$https://www.casalumbre.com/alma-finca$q$, $q$MX$q$, NULL),
($q$Alma Tepec$q$, $q$alma.tepec$q$, $q$https://www.almatepec.com/$q$, $q$MX$q$, NULL),
($q$Amarula$q$, $q$amarula$q$, $q$https://amarula.com/$q$, $q$ZA$q$, NULL),
($q$Ancho Reyes$q$, $q$ancho.reyes$q$, $q$https://www.anchoreyes.com/$q$, $q$MX$q$, NULL),
($q$Antica Sambuca$q$, $q$antica.sambuca$q$, NULL, $q$IT$q$, NULL),
($q$Anís del Mono$q$, $q$anis.del.mono$q$, $q$https://www.anisdelmono.com/$q$, $q$ES$q$, NULL),
($q$Archers$q$, $q$archers$q$, $q$https://archers.com/$q$, NULL, NULL),
($q$Baileys$q$, $q$baileys$q$, $q$https://www.baileys.com/$q$, $q$IE$q$, NULL),
($q$Baja Rosa$q$, $q$baja.rosa$q$, NULL, $q$CA$q$, NULL),
($q$Barrow's Intense$q$, $q$barrow.s.intense$q$, $q$https://www.barrowsintense.com/$q$, $q$US$q$, NULL),
($q$Becherovka$q$, $q$becherovka$q$, $q$https://www.becherovka.com/$q$, $q$CZ$q$, NULL),
($q$Bepi Tosolini$q$, $q$bepi.tosolini$q$, $q$https://www.bepitosolini.it/en/$q$, $q$IT$q$, NULL),
($q$Berentzen$q$, $q$berentzen$q$, $q$https://www.berentzen.de/$q$, $q$DE$q$, NULL),
($q$Bols$q$, $q$bols$q$, $q$https://bols.com/$q$, $q$NL$q$, NULL),
($q$Bordiga$q$, $q$bordiga$q$, NULL, $q$IT$q$, NULL),
($q$Borghetti$q$, $q$borghetti$q$, NULL, $q$IT$q$, NULL),
($q$Bottega$q$, $q$bottega$q$, $q$https://www.bottegaspa.com/$q$, $q$IT$q$, NULL),
($q$Bramley & Gage$q$, $q$bramley.gage$q$, NULL, $q$GB$q$, NULL),
($q$Brillet$q$, $q$brillet$q$, $q$https://www.belledebrillet.com/$q$, $q$FR$q$, NULL),
($q$Briottet$q$, $q$briottet$q$, $q$https://www.briottet.fr/$q$, $q$FR$q$, NULL),
($q$Bumbu$q$, $q$bumbu$q$, $q$https://bumbu.sovereignbrands.com/$q$, NULL, NULL),
($q$Bénédictine$q$, $q$benedictine$q$, $q$https://www.benedictinedom.com/$q$, $q$FR$q$, NULL),
($q$Cabot Trail$q$, $q$cabot.trail$q$, NULL, $q$CA$q$, NULL),
($q$Cadello$q$, $q$cadello$q$, $q$https://www.cadello.com/$q$, $q$IT$q$, NULL),
($q$Caravella$q$, $q$caravella$q$, NULL, $q$IT$q$, NULL),
($q$Carlshamns$q$, $q$carlshamns$q$, $q$https://www.systembolaget.se/$q$, $q$FI$q$, NULL),
($q$Carolans$q$, $q$carolans$q$, $q$https://www.carolans.com/$q$, $q$IE$q$, NULL),
($q$Casa D'Aristi$q$, $q$casa.d.aristi$q$, NULL, $q$MX$q$, NULL),
($q$Casoni$q$, $q$casoni$q$, $q$https://www.casoni.it/$q$, $q$IT$q$, NULL),
($q$Chambord$q$, $q$chambord$q$, $q$https://www.chambord.com/$q$, $q$FR$q$, NULL),
($q$Chareau$q$, $q$chareau$q$, $q$https://www.chareau.com/$q$, $q$US$q$, NULL),
($q$Charles Jacquin et Cie$q$, $q$charles.jacquin.et.cie$q$, NULL, $q$FR$q$, NULL),
($q$Chartreuse$q$, $q$chartreuse$q$, $q$https://www.chartreuse.fr$q$, $q$FR$q$, NULL),
($q$Chinola$q$, $q$chinola$q$, $q$https://chinola.com$q$, $q$DO$q$, NULL),
($q$Choya$q$, $q$choya$q$, $q$https://www.choya.co.jp$q$, $q$JP$q$, NULL),
($q$Clément$q$, $q$clement$q$, $q$https://www.rhum-clement.com$q$, $q$MQ$q$, NULL),
($q$Cointreau$q$, $q$cointreau$q$, $q$https://www.cointreau.com$q$, $q$FR$q$, NULL),
($q$Combier$q$, $q$combier$q$, $q$https://www.combierusa.com$q$, $q$FR$q$, NULL),
($q$DeKuyper$q$, $q$dekuyper$q$, $q$https://www.dekuyperusa.com$q$, $q$US$q$, NULL),
($q$Dillon's$q$, $q$dillon.s$q$, $q$https://www.dillons.ca$q$, $q$CA$q$, NULL),
($q$Disaronno$q$, $q$disaronno$q$, $q$https://www.disaronno.com$q$, $q$IT$q$, NULL),
($q$Domaine de Canton$q$, $q$domaine.de.canton$q$, $q$https://www.domainedecanton.com$q$, NULL, NULL),
($q$Dooley's$q$, $q$dooley.s$q$, NULL, $q$DE$q$, NULL),
($q$Drambuie$q$, $q$drambuie$q$, $q$https://www.drambuie.com$q$, $q$GB$q$, NULL),
($q$FAIR.$q$, $q$fair$q$, NULL, $q$FR$q$, NULL),
($q$Fireball$q$, $q$fireball$q$, $q$https://www.fireballwhisky.com$q$, NULL, NULL),
($q$Foxdenton$q$, $q$foxdenton$q$, $q$https://www.foxdentonestate.co.uk$q$, $q$GB$q$, NULL),
($q$Frangelico$q$, $q$frangelico$q$, $q$https://frangelico.com$q$, $q$IT$q$, NULL),
($q$Gabriel Boudier$q$, $q$gabriel.boudier$q$, NULL, $q$FR$q$, NULL),
($q$Galliano$q$, $q$galliano$q$, $q$https://galliano.com$q$, $q$IT$q$, NULL),
($q$Get 27$q$, $q$get.27$q$, NULL, $q$FR$q$, NULL),
($q$Giffard$q$, $q$giffard$q$, $q$https://www.giffard.com$q$, $q$FR$q$, NULL),
($q$Gilka$q$, $q$gilka$q$, NULL, $q$DE$q$, NULL),
($q$Goldschläger$q$, $q$goldschlager$q$, NULL, $q$IT$q$, NULL),
($q$Gordon's$q$, $q$gordon.s$q$, $q$https://www.gordonsgin.com$q$, $q$GB$q$, NULL),
($q$Gran Gala$q$, $q$gran.gala$q$, NULL, NULL, NULL),
($q$Grand Marnier$q$, $q$grand.marnier$q$, $q$https://www.grandmarnier.com$q$, $q$FR$q$, NULL),
($q$Hamilton$q$, $q$hamilton$q$, NULL, $q$JM$q$, NULL),
($q$Hayman's$q$, $q$hayman.s$q$, $q$https://www.haymansgin.com$q$, $q$GB$q$, NULL),
($q$Heering$q$, $q$heering$q$, $q$https://www.heering.com$q$, $q$DK$q$, NULL),
($q$Heinrich Helbing$q$, $q$heinrich.helbing$q$, NULL, $q$DE$q$, NULL),
($q$Hpnotiq$q$, $q$hpnotiq$q$, $q$https://www.hpnotiq.com$q$, NULL, NULL),
($q$Irish Mist$q$, $q$irish.mist$q$, NULL, $q$IE$q$, NULL),
($q$Italicus$q$, $q$italicus$q$, $q$https://rosolioitalicus.com$q$, $q$IT$q$, NULL),
($q$John D. Taylor's$q$, $q$john.d.taylor.s$q$, NULL, $q$BB$q$, NULL),
($q$Joseph Cartron$q$, $q$joseph.cartron$q$, $q$https://www.cartron.fr$q$, $q$FR$q$, NULL),
($q$Jägermeister$q$, $q$jagermeister$q$, $q$https://www.mast-jaegermeister.de$q$, $q$DE$q$, NULL),
($q$Kahlúa$q$, $q$kahlua$q$, $q$https://www.kahlua.com$q$, $q$MX$q$, NULL),
($q$Kleos$q$, $q$kleos$q$, NULL, $q$GR$q$, NULL),
($q$Kronan$q$, $q$kronan$q$, $q$https://alpenz.com/product-kronan.html$q$, $q$SE$q$, NULL),
($q$Kō Hana$q$, $q$ko.hana$q$, $q$https://www.kohanarum.com$q$, $q$US$q$, NULL),
($q$L'Ermitage Saint Valbert$q$, $q$l.ermitage.saint.valbert$q$, $q$https://www.distilleriespeureux.com$q$, $q$FR$q$, NULL),
($q$Lazzaroni$q$, $q$lazzaroni$q$, $q$https://www.lazzaroni.it$q$, $q$IT$q$, NULL),
($q$Lejay$q$, $q$lejay$q$, $q$https://www.lejay-lagoute.com$q$, $q$FR$q$, NULL),
($q$Leopold Bros$q$, $q$leopold.bros$q$, $q$https://www.leopoldbros.com$q$, $q$US$q$, NULL),
($q$Licor 43$q$, $q$licor.43$q$, $q$https://licor43.com$q$, NULL, NULL),
($q$Limoncello di Capri$q$, $q$limoncello.di.capri$q$, NULL, $q$IT$q$, NULL),
($q$Luxardo$q$, $q$luxardo$q$, $q$https://www.luxardo.it$q$, $q$IT$q$, NULL),
($q$Maggie's Farm$q$, $q$maggie.s.farm$q$, $q$https://maggiesfarmrum.com$q$, $q$US$q$, NULL),
($q$Mandarine Napoléon$q$, $q$mandarine.napoleon$q$, $q$https://mandarinenapoleon.com$q$, NULL, NULL),
($q$Manly Spirits$q$, $q$manly.spirits$q$, $q$https://www.manlyspirits.com.au$q$, $q$AU$q$, NULL),
($q$Maraska$q$, $q$maraska$q$, $q$https://maraska.hr$q$, $q$HR$q$, NULL),
($q$Marie Brizard$q$, $q$marie.brizard$q$, $q$https://mariebrizard.com$q$, NULL, NULL),
($q$Marionette$q$, $q$marionette$q$, $q$https://www.marionette.com.au$q$, $q$AU$q$, NULL),
($q$Massenez$q$, $q$massenez$q$, $q$https://www.massenez.com$q$, $q$FR$q$, NULL),
($q$Mentzendorff$q$, $q$mentzendorff$q$, $q$https://mentzendorff.co.uk$q$, $q$FR$q$, NULL),
($q$Merlet$q$, $q$merlet$q$, $q$https://www.merlet.fr$q$, $q$FR$q$, NULL),
($q$Midori$q$, $q$midori$q$, $q$https://www.midori-world.com$q$, NULL, NULL),
($q$Molinari$q$, $q$molinari$q$, $q$https://www.molinari.it$q$, $q$IT$q$, NULL),
($q$Monkey 47$q$, $q$monkey.47$q$, $q$https://www.monkey47.com$q$, $q$DE$q$, NULL),
($q$Mozart$q$, $q$mozart$q$, $q$https://www.mozartchocolateliqueur.com$q$, NULL, NULL),
($q$Mr Black$q$, $q$mr.black$q$, $q$https://mrblack.co$q$, $q$AU$q$, NULL),
($q$Muyu$q$, $q$muyu$q$, NULL, $q$NL$q$, NULL),
($q$Nardini$q$, $q$nardini$q$, $q$https://www.nardini.it$q$, $q$IT$q$, NULL),
($q$Nixta$q$, $q$nixta$q$, NULL, $q$MX$q$, NULL),
($q$Opal Nera$q$, $q$opal.nera$q$, NULL, $q$IT$q$, NULL),
($q$Pallini$q$, $q$pallini$q$, $q$https://pallini.com$q$, $q$IT$q$, NULL),
($q$Pama$q$, $q$pama$q$, NULL, $q$US$q$, NULL),
($q$Passoã$q$, $q$passoa$q$, $q$https://www.passoa.com$q$, NULL, NULL),
($q$Patrón$q$, $q$patron$q$, $q$https://www.patrontequila.com$q$, $q$MX$q$, NULL),
($q$Pavan$q$, $q$pavan$q$, NULL, $q$FR$q$, NULL),
($q$Pierre Ferrand$q$, $q$pierre.ferrand$q$, $q$https://www.ferrandcognac.com/$q$, $q$FR$q$, NULL),
($q$Pimm's$q$, $q$pimm.s$q$, NULL, $q$GB$q$, NULL),
($q$Pisang Ambon$q$, $q$pisang.ambon$q$, NULL, $q$NL$q$, NULL),
($q$Plymouth$q$, $q$plymouth$q$, $q$https://www.plymouthgin.com/$q$, $q$GB$q$, NULL),
($q$Purkhart$q$, $q$purkhart$q$, $q$https://alpenz.com/$q$, $q$AT$q$, NULL),
($q$Quaglia$q$, $q$quaglia$q$, $q$https://distilleriaquaglia.it/en/$q$, $q$IT$q$, NULL),
($q$Ramazzotti$q$, $q$ramazzotti$q$, NULL, $q$IT$q$, NULL),
($q$Riga Black Balsam$q$, $q$riga.black.balsam$q$, NULL, $q$LV$q$, NULL),
($q$Rockey's$q$, $q$rockey.s$q$, NULL, $q$US$q$, NULL),
($q$Roots$q$, $q$roots$q$, $q$https://finestroots.com/$q$, $q$GR$q$, NULL),
($q$Rothman & Winter$q$, $q$rothman.winter$q$, $q$https://alpenz.com/$q$, $q$AT$q$, NULL),
($q$RumChata$q$, $q$rumchata$q$, $q$https://rumchata.com/$q$, $q$US$q$, NULL),
($q$Senior & Co.$q$, $q$senior.co$q$, $q$https://www.curacaoliqueur.com/$q$, $q$CW$q$, NULL),
($q$Shanky's Whip$q$, $q$shanky.s.whip$q$, $q$https://shankyswhip.com/$q$, $q$IE$q$, NULL),
($q$Sheridan's$q$, $q$sheridan.s$q$, NULL, $q$IE$q$, NULL),
($q$Sipsmith$q$, $q$sipsmith$q$, $q$https://www.sipsmith.com/$q$, $q$GB$q$, NULL),
($q$Skinos$q$, $q$skinos$q$, NULL, $q$GR$q$, NULL),
($q$Soho$q$, $q$soho$q$, NULL, $q$FR$q$, NULL),
($q$Solerno$q$, $q$solerno$q$, NULL, $q$IT$q$, NULL),
($q$Sortilège$q$, $q$sortilege$q$, NULL, $q$CA$q$, NULL),
($q$Sour Puss$q$, $q$sour.puss$q$, NULL, $q$US$q$, NULL),
($q$Sourz$q$, $q$sourz$q$, NULL, $q$ES$q$, NULL),
($q$Southern Comfort$q$, $q$southern.comfort$q$, $q$https://www.southerncomfort.com/$q$, $q$US$q$, NULL),
($q$St-Germain$q$, $q$st.germain$q$, $q$https://www.stgermainliqueur.com/$q$, $q$FR$q$, NULL),
($q$St. Elizabeth$q$, $q$st.elizabeth$q$, $q$https://alpenz.com/$q$, $q$AT$q$, NULL),
($q$St. George Spirits$q$, $q$st.george.spirits$q$, $q$https://stgeorgespirits.com/$q$, $q$US$q$, NULL),
($q$Strega$q$, $q$strega$q$, $q$https://strega.it/$q$, $q$IT$q$, NULL),
($q$Tempus Fugit Spirits$q$, $q$tempus.fugit.spirits$q$, $q$https://www.tempusfugitspirits.com/$q$, $q$CH$q$, NULL),
($q$The Bitter Truth$q$, $q$the.bitter.truth$q$, $q$https://the-bitter-truth.com/$q$, $q$DE$q$, NULL),
($q$The Boatyard Distillery$q$, $q$the.boatyard.distillery$q$, $q$https://www.boatyarddistillery.com/$q$, $q$GB$q$, NULL),
($q$The King's Ginger$q$, $q$the.king.s.ginger$q$, $q$https://www.thekingsginger.com$q$, $q$GB$q$, NULL),
($q$Tia Maria$q$, $q$tia.maria$q$, $q$https://www.tiamaria.com/$q$, $q$IT$q$, NULL),
($q$Toschi$q$, $q$toschi$q$, $q$https://www.toschi.it/en/$q$, $q$IT$q$, NULL),
($q$Tuaca$q$, $q$tuaca$q$, NULL, $q$IT$q$, NULL),
($q$Umenoyado$q$, $q$umenoyado$q$, $q$https://www.umenoyado.com/en/$q$, $q$JP$q$, NULL),
($q$Villa Massa$q$, $q$villa.massa$q$, $q$https://villamassa.com/$q$, $q$IT$q$, NULL),
($q$Vok$q$, $q$vok$q$, $q$https://vokliqueurs.com.au/$q$, $q$AU$q$, NULL),
($q$Walcher$q$, $q$walcher$q$, $q$https://www.walcher.eu/en/$q$, $q$IT$q$, NULL),
($q$Warninks$q$, $q$warninks$q$, NULL, $q$NL$q$, NULL),
($q$Zoco$q$, $q$zoco$q$, NULL, $q$ES$q$, NULL);

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
($q$99 Bananas$q$, $q$99 Bananas$q$, $q$Banana Liqueur$q$, $q$99 Brand$q$, 49.5, $q$US$q$, NULL, $q$https://specsonline.com/shop/spirits/99-bananas-banana-schnapps/$q$, $q$retailer$q$),
($q$99 Watermelons$q$, NULL, $q$Watermelon Liqueur$q$, $q$99 Brand$q$, 49.5, $q$US$q$, NULL, $q$https://specsonline.com/shop/spirits/99-watermelons-watermelon-schnapps/$q$, $q$retailer$q$),
($q$Adriatico Amaretto Roasted$q$, $q$Adriatico Roasted Amaretto$q$, $q$Amaretto$q$, $q$Adriatico$q$, 28, $q$IT$q$, NULL, $q$https://www.lcbo.com/en/adriatico-amaretto-46752$q$, $q$retailer$q$),
($q$Agavero$q$, NULL, $q$Damiana Liqueur$q$, $q$Agavero$q$, 32, $q$MX$q$, NULL, $q$https://www.tequilasource.com/agavero/index.html$q$, $q$reference$q$),
($q$Akashi-Tai Ginjo Yuzushu$q$, $q$Akashi-Tai Ginjo Yuzushu$q$, $q$Yuzushu$q$, $q$Akashi-Tai$q$, 10, $q$JP$q$, NULL, $q$https://www.lcbo.com/en/akashi-tai-ginjo-yuzushu-40124$q$, $q$retailer$q$),
($q$Alma Finca Orange Liqueur$q$, $q$Alma Finca$q$, $q$Orange Liqueur$q$, $q$Alma Finca$q$, 40, $q$MX$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/8157/alma-finca$q$, $q$reference$q$),
($q$Alma Tepec$q$, $q$Alma Tepec Chile Liqueur$q$, $q$Chile Liqueur$q$, $q$Alma Tepec$q$, 40, $q$MX$q$, NULL, $q$https://www.skurnik.com/wp-content/uploads/1980/06/Alma-Tepec-Tech-Sheet_Jan-2024.pdf$q$, $q$retailer$q$),
($q$Amarula Cream Liqueur$q$, $q$Amarula Cream Liqueur$q$, $q$Cream Liqueur$q$, $q$Amarula$q$, 17, $q$ZA$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/34/amarula-wild-fruit-cream$q$, $q$reference$q$),
($q$Ancho Reyes Original$q$, $q$Ancho Reyes Original$q$, $q$Chile Liqueur$q$, $q$Ancho Reyes$q$, NULL, $q$MX$q$, NULL, $q$https://www.anchoreyes.com/$q$, $q$producer$q$),
($q$Ancho Reyes Verde$q$, $q$Ancho Reyes Verde$q$, $q$Green Chile Liqueur$q$, $q$Ancho Reyes$q$, NULL, $q$MX$q$, NULL, $q$https://www.anchoreyes.com/$q$, $q$producer$q$),
($q$Antica Sambuca Classic$q$, $q$Antica Sambuca Classic$q$, $q$Sambuca$q$, $q$Antica Sambuca$q$, 38, $q$IT$q$, NULL, $q$https://bevx.com/spirits/antica-classic$q$, $q$reference$q$),
($q$Anís del Mono Dulce$q$, $q$Anís del Mono Dulce$q$, $q$Anisette$q$, $q$Anís del Mono$q$, NULL, $q$ES$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/7334/anis-del-mono-dulce$q$, $q$reference$q$),
($q$Archers$q$, $q$Archers Peach Schnapps$q$, $q$Peach Schnapps Liqueur$q$, $q$Archers$q$, 18, NULL, NULL, $q$https://archers.com/products/archers/$q$, $q$producer$q$),
($q$Baileys Chocolate Liqueur$q$, NULL, $q$Chocolate Liqueur$q$, $q$Baileys$q$, NULL, $q$IE$q$, NULL, $q$https://www.baileys.com/en-us/products$q$, $q$producer$q$),
($q$Baileys Espresso Crème$q$, NULL, $q$Cream Liqueur$q$, $q$Baileys$q$, NULL, $q$IE$q$, NULL, $q$https://www.baileys.com/en-us/products$q$, $q$producer$q$),
($q$Baileys Salted Caramel$q$, NULL, $q$Cream Liqueur$q$, $q$Baileys$q$, NULL, $q$IE$q$, NULL, $q$https://www.baileys.com/en-us/products$q$, $q$producer$q$),
($q$Baileys Strawberries & Cream$q$, NULL, $q$Cream Liqueur$q$, $q$Baileys$q$, NULL, $q$IE$q$, NULL, $q$https://www.baileys.com/en-us/products$q$, $q$producer$q$),
($q$Baja Rosa Tequila & Strawberry Cream Liqueur$q$, NULL, $q$Cream Liqueur$q$, $q$Baja Rosa$q$, 15, $q$CA$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/9044/baja-rosa-liqueur$q$, $q$reference$q$),
($q$Barrow's Intense Ginger Liqueur$q$, $q$Barrow's Intense Ginger Liqueur$q$, $q$Ginger Liqueur$q$, $q$Barrow's Intense$q$, 22, $q$US$q$, NULL, $q$https://www.barrowsintense.com/$q$, $q$producer$q$),
($q$Becherovka Grapefruit Hops$q$, NULL, $q$Pamplemousse Liqueur$q$, $q$Becherovka$q$, NULL, $q$CZ$q$, NULL, $q$https://www.becherovka.com/produkty/becherovka-grapefruit-hops/$q$, $q$producer$q$),
($q$Becherovka Lemond$q$, $q$Becherovka Lemond$q$, $q$Citrus Liqueur$q$, $q$Becherovka$q$, NULL, $q$CZ$q$, NULL, $q$https://www.becherovka.com/produkty/becherovka-lemond/$q$, $q$producer$q$),
($q$Becherovka Lime Basil$q$, NULL, $q$Citrus Liqueur$q$, $q$Becherovka$q$, NULL, $q$CZ$q$, NULL, $q$https://www.becherovka.com/produkty/becherovka-lime-basil/$q$, $q$producer$q$),
($q$Becherovka Orange Ginger$q$, NULL, $q$Orange Liqueur$q$, $q$Becherovka$q$, NULL, $q$CZ$q$, NULL, $q$https://www.becherovka.com/produkty/becherovka-orange-ginger/$q$, $q$producer$q$),
($q$Becherovka Original$q$, $q$Becherovka$q$, $q$Herbal Liqueur$q$, $q$Becherovka$q$, NULL, $q$CZ$q$, NULL, $q$https://www.becherovka.com/produkty/becherovka-original/$q$, $q$producer$q$),
($q$Becherovka Unfiltered$q$, NULL, $q$Herbal Liqueur$q$, $q$Becherovka$q$, NULL, $q$CZ$q$, NULL, $q$https://www.becherovka.com/produkty/becherovka-unfiltered/$q$, $q$producer$q$),
($q$Saliza Amaretto$q$, $q$Saliza Amaretto$q$, $q$Amaretto$q$, $q$Bepi Tosolini$q$, 28, $q$IT$q$, NULL, $q$https://www.bepitosolini.it/en/products/liquore-amaretto-saliza/$q$, $q$producer$q$),
($q$Berentzen Apfel$q$, $q$Berentzen Apple Liqueur$q$, $q$Apple Liqueur$q$, $q$Berentzen$q$, 18, $q$DE$q$, NULL, $q$https://www.berentzen.de/produkte/fruchtige/$q$, $q$producer$q$),
($q$Berentzen Himbeere Pfirsich$q$, NULL, $q$Raspberry Liqueur$q$, $q$Berentzen$q$, 16, $q$DE$q$, NULL, $q$https://www.berentzen.de/produkte/fruchtige/$q$, $q$producer$q$),
($q$Berentzen Mango Vanille$q$, NULL, $q$Mango Liqueur$q$, $q$Berentzen$q$, 16, $q$DE$q$, NULL, $q$https://www.berentzen.de/produkte/fruchtige/$q$, $q$producer$q$),
($q$Berentzen Maracuja$q$, NULL, $q$Passion Fruit Liqueur$q$, $q$Berentzen$q$, 18, $q$DE$q$, NULL, $q$https://www.berentzen.de/produkte/fruchtige/$q$, $q$producer$q$),
($q$Berentzen Plum$q$, NULL, $q$Plum Liqueur$q$, $q$Berentzen$q$, 20, $q$DE$q$, NULL, $q$https://www.berentzen.de/produkte/fruchtige/$q$, $q$producer$q$),
($q$Berentzen Rhabarber-Erdbeere$q$, NULL, $q$Rhubarb Liqueur$q$, $q$Berentzen$q$, 15, $q$DE$q$, NULL, $q$https://www.berentzen.de/produkte/fruchtige/$q$, $q$producer$q$),
($q$Berentzen Saurer Apfel$q$, NULL, $q$Sour Apple Liqueur$q$, $q$Berentzen$q$, 16, $q$DE$q$, NULL, $q$https://www.berentzen.de/produkte/fruchtige/$q$, $q$producer$q$),
($q$Berentzen Waldfrucht$q$, NULL, $q$Berry Liqueur$q$, $q$Berentzen$q$, 16, $q$DE$q$, NULL, $q$https://www.berentzen.de/produkte/fruchtige/$q$, $q$producer$q$),
($q$Berentzen Waldmeister$q$, NULL, $q$Herbal Liqueur$q$, $q$Berentzen$q$, 15, $q$DE$q$, NULL, $q$https://www.berentzen.de/produkte/fruchtige/$q$, $q$producer$q$),
($q$Berentzen Wildkirsche$q$, NULL, $q$Cherry Liqueur$q$, $q$Berentzen$q$, 16, $q$DE$q$, NULL, $q$https://www.berentzen.de/produkte/fruchtige/$q$, $q$producer$q$),
($q$Berentzen Zitrone$q$, NULL, $q$Citrus Liqueur$q$, $q$Berentzen$q$, 15, $q$DE$q$, NULL, $q$https://www.berentzen.de/produkte/fruchtige/$q$, $q$producer$q$),
($q$Bols Advocaat$q$, $q$Bols Advocaat$q$, $q$Advocaat$q$, $q$Bols$q$, 15, $q$NL$q$, NULL, $q$https://www.lcbo.com/en/bols-advocaat-8532$q$, $q$retailer$q$),
($q$Bols Amaretto$q$, $q$Bols Amaretto$q$, $q$Amaretto$q$, $q$Bols$q$, NULL, $q$NL$q$, NULL, $q$https://www.diffordsguide.com/producer/1248/lucas-bols/liqueurs$q$, $q$reference$q$),
($q$Bols Apricot Brandy$q$, $q$Bols Apricot Brandy$q$, $q$Apricot Liqueur$q$, $q$Bols$q$, NULL, $q$NL$q$, NULL, $q$https://www.diffordsguide.com/producer/1248/lucas-bols/liqueurs$q$, $q$reference$q$),
($q$Bols Banana Liqueur$q$, $q$Bols Banana Liqueur$q$, $q$Banana Liqueur$q$, $q$Bols$q$, NULL, $q$NL$q$, NULL, $q$https://www.diffordsguide.com/producer/1248/lucas-bols/liqueurs$q$, $q$reference$q$),
($q$Bols Blue Curaçao$q$, $q$Bols Blue Curaçao$q$, $q$Blue Curaçao$q$, $q$Bols$q$, NULL, $q$NL$q$, NULL, $q$https://www.diffordsguide.com/producer/1248/lucas-bols/liqueurs$q$, $q$reference$q$),
($q$Bols Butterscotch$q$, $q$Bols Butterscotch Schnapps$q$, $q$Butterscotch Schnapps$q$, $q$Bols$q$, NULL, $q$NL$q$, NULL, $q$https://www.diffordsguide.com/producer/1248/lucas-bols/liqueurs$q$, $q$reference$q$),
($q$Bols Cacao Brown$q$, $q$Bols Brown Crème de Cacao$q$, $q$Dark Crème de Cacao$q$, $q$Bols$q$, NULL, $q$NL$q$, NULL, $q$https://www.diffordsguide.com/producer/1248/lucas-bols/liqueurs$q$, $q$reference$q$),
($q$Bols Cacao White$q$, $q$Bols White Crème de Cacao$q$, $q$White Crème de Cacao$q$, $q$Bols$q$, NULL, $q$NL$q$, NULL, $q$https://www.diffordsguide.com/producer/1248/lucas-bols/liqueurs$q$, $q$reference$q$),
($q$Bols Cherry Brandy Liqueur$q$, NULL, $q$Cherry Brandy$q$, $q$Bols$q$, NULL, $q$NL$q$, NULL, $q$https://www.diffordsguide.com/producer/1248/lucas-bols/liqueurs$q$, $q$reference$q$),
($q$Bols Coffee Liqueur$q$, NULL, $q$Coffee Liqueur$q$, $q$Bols$q$, NULL, $q$NL$q$, NULL, $q$https://www.diffordsguide.com/producer/1248/lucas-bols/liqueurs$q$, $q$reference$q$),
($q$Bols Crème de Cassis$q$, NULL, $q$Crème de Cassis$q$, $q$Bols$q$, NULL, $q$NL$q$, NULL, $q$https://www.diffordsguide.com/producer/1248/lucas-bols/liqueurs$q$, $q$reference$q$),
($q$Bols Dry Orange Curaçao$q$, NULL, $q$Dry Curacao Liqueur$q$, $q$Bols$q$, NULL, $q$NL$q$, NULL, $q$https://www.diffordsguide.com/producer/1248/lucas-bols/liqueurs$q$, $q$reference$q$),
($q$Bols Elderflower Liqueur$q$, NULL, $q$Elderflower Liqueur$q$, $q$Bols$q$, NULL, $q$NL$q$, NULL, $q$https://www.diffordsguide.com/producer/1248/lucas-bols/liqueurs$q$, $q$reference$q$),
($q$Bols Maraschino Liqueur$q$, $q$Bols Maraschino$q$, $q$Maraschino Liqueur$q$, $q$Bols$q$, NULL, $q$NL$q$, NULL, $q$https://www.diffordsguide.com/producer/1248/lucas-bols/liqueurs$q$, $q$reference$q$),
($q$Bols Melon$q$, $q$Bols Melon$q$, $q$Melon Liqueur$q$, $q$Bols$q$, NULL, $q$NL$q$, NULL, $q$https://www.diffordsguide.com/producer/1248/lucas-bols/liqueurs$q$, $q$reference$q$),
($q$Bols Parfait Amour$q$, NULL, $q$Parfait Amour$q$, $q$Bols$q$, NULL, $q$NL$q$, NULL, $q$https://www.diffordsguide.com/producer/1248/lucas-bols/liqueurs$q$, $q$reference$q$),
($q$Bols Passion Fruit Liqueur$q$, $q$Bols Passion Fruit Liqueur$q$, $q$Passion Fruit Liqueur$q$, $q$Bols$q$, NULL, $q$NL$q$, NULL, $q$https://www.diffordsguide.com/producer/1248/lucas-bols/liqueurs$q$, $q$reference$q$),
($q$Bols Peppermint Schnapps$q$, $q$Bols Peppermint Schnapps$q$, $q$Peppermint Schnapps$q$, $q$Bols$q$, 24, NULL, NULL, $q$https://abc2.nc.gov/Pricing/ViewItemDetails/168227$q$, $q$retailer$q$),
($q$Bols Peppermint White$q$, NULL, $q$Crème de Menthe$q$, $q$Bols$q$, NULL, $q$NL$q$, NULL, $q$https://www.diffordsguide.com/producer/1248/lucas-bols/liqueurs$q$, $q$reference$q$),
($q$Bols Triple Sec$q$, $q$Bols Triple Sec$q$, $q$Triple Sec$q$, $q$Bols$q$, 38, $q$NL$q$, NULL, $q$https://www.diffordsguide.com/producer/1248/lucas-bols/liqueurs$q$, $q$reference$q$),
($q$Bordiga Génépy$q$, $q$Bordiga Génépy Occitan$q$, $q$Genepy$q$, $q$Bordiga$q$, 35, $q$IT$q$, NULL, $q$https://creamwine.com/product.php?id=21892$q$, $q$retailer$q$),
($q$Caffè Borghetti$q$, $q$Caffè Borghetti$q$, $q$Espresso Liqueur$q$, $q$Borghetti$q$, 25, $q$IT$q$, NULL, $q$https://reservebar.com/products/borghetti-espresso-liqueur/GROUPING-920473.html$q$, $q$retailer$q$),
($q$Bottega Fior di Latte$q$, NULL, $q$White Chocolate Liqueur$q$, $q$Bottega$q$, NULL, $q$IT$q$, NULL, $q$https://palmbay.com/spirits/bottega-spirits/bottega-liqueurs-sambuca$q$, $q$retailer$q$),
($q$Bottega Gianduia$q$, NULL, $q$Chocolate Liqueur$q$, $q$Bottega$q$, NULL, $q$IT$q$, NULL, $q$https://palmbay.com/spirits/bottega-spirits/bottega-liqueurs-sambuca$q$, $q$retailer$q$),
($q$Bottega Limoncino$q$, NULL, $q$Limoncello$q$, $q$Bottega$q$, NULL, $q$IT$q$, NULL, $q$https://palmbay.com/spirits/bottega-spirits/bottega-liqueurs-sambuca$q$, $q$retailer$q$),
($q$Bottega Pistacchio$q$, NULL, $q$Pistachio Liqueur$q$, $q$Bottega$q$, NULL, $q$IT$q$, NULL, $q$https://palmbay.com/spirits/bottega-spirits/bottega-liqueurs-sambuca$q$, $q$retailer$q$),
($q$Bottega Sambuca$q$, NULL, $q$Sambuca$q$, $q$Bottega$q$, 40, $q$IT$q$, NULL, $q$https://palmbay.com/spirits/bottega-spirits/bottega-liqueurs-sambuca$q$, $q$retailer$q$),
($q$Bramley and Gage Sweet Sloe Gin$q$, $q$Bramley & Gage Sloe Gin$q$, $q$Sloe Gin$q$, $q$Bramley & Gage$q$, 26, $q$GB$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/501/bramley-and-gage-sweet-sloe-gin$q$, $q$reference$q$),
($q$Belle de Brillet$q$, $q$Belle De Brillet$q$, $q$Pear Liqueur$q$, $q$Brillet$q$, 30, $q$FR$q$, NULL, $q$https://www.strathliquor.com/product/belle-de-brillet-pear-cognac/$q$, $q$retailer$q$),
($q$Briottet Crème d'Abricot$q$, NULL, $q$Apricot Liqueur$q$, $q$Briottet$q$, 25, $q$FR$q$, NULL, $q$https://boutique.briottet.fr/en/produit/1318-creme-d-abricot$q$, $q$producer$q$),
($q$Briottet Crème de Banane$q$, NULL, $q$Banana Liqueur$q$, $q$Briottet$q$, 25, $q$FR$q$, NULL, $q$https://boutique.briottet.fr/en/produit/1322-creme-de-banane$q$, $q$producer$q$),
($q$Briottet Crème de Cacao Ambré$q$, NULL, $q$Dark Crème de Cacao$q$, $q$Briottet$q$, 25, $q$FR$q$, NULL, $q$https://boutique.briottet.fr/en/produit/1328-creme-de-cacao-ambre$q$, $q$producer$q$),
($q$Briottet Crème de Cacao Blanc$q$, NULL, $q$White Crème de Cacao$q$, $q$Briottet$q$, 25, $q$FR$q$, NULL, $q$https://boutique.briottet.fr/en/produit/1330-creme-de-cacao-blanc$q$, $q$producer$q$),
($q$Briottet Crème de Cassis de Dijon$q$, $q$Briottet Crème de Cassis$q$, $q$Crème de Cassis$q$, $q$Briottet$q$, 20, $q$FR$q$, $q$Cassis de Dijon$q$, $q$https://boutique.briottet.fr/en/produit/768-creme-de-cassis-de-dijon$q$, $q$producer$q$),
($q$Briottet Crème de Framboise$q$, $q$Briottet Crème de Framboise$q$, $q$Creme de Framboise$q$, $q$Briottet$q$, 18, $q$FR$q$, NULL, $q$https://boutique.briottet.fr/en/produit/1722-creme-de-framboise$q$, $q$producer$q$),
($q$Briottet Crème de Mûre$q$, $q$Briottet Crème de Mûre$q$, $q$Crème de Mûre$q$, $q$Briottet$q$, 18, $q$FR$q$, NULL, $q$https://boutique.briottet.fr/en/produit/1787-creme-de-mure$q$, $q$producer$q$),
($q$Briottet Crème de Pêche de Vigne Sanguine$q$, $q$Briottet Crème de Pêche de Vigne$q$, $q$Crème de Pêche$q$, $q$Briottet$q$, 18, $q$FR$q$, NULL, $q$https://boutique.briottet.fr/en/produit/1819-creme-de-peche-de-vigne-sanguine$q$, $q$producer$q$),
($q$Briottet Curaçao Bleu$q$, NULL, $q$Blue Curaçao$q$, $q$Briottet$q$, 25, $q$FR$q$, NULL, $q$https://boutique.briottet.fr/en/produit/1700-curacao-bleu$q$, $q$producer$q$),
($q$Briottet Curaçao Orange$q$, NULL, $q$Curaçao$q$, $q$Briottet$q$, 25, $q$FR$q$, NULL, $q$https://boutique.briottet.fr/en/produit/1704-curacao-orange$q$, $q$producer$q$),
($q$Briottet Curaçao Triple Sec 40%$q$, NULL, $q$Triple Sec$q$, $q$Briottet$q$, 40, $q$FR$q$, NULL, $q$https://boutique.briottet.fr/en/produit/1713-curacao-triple-sec-40-bitter-orange-liqueur$q$, $q$producer$q$),
($q$Briottet Liqueur de Sureau$q$, NULL, $q$Elderflower Liqueur$q$, $q$Briottet$q$, 18, $q$FR$q$, NULL, $q$https://boutique.briottet.fr/en/produit/1855-liqueur-de-sureau$q$, $q$producer$q$),
($q$Briottet Liqueur de Violette$q$, $q$Briottet Crème de Violette$q$, $q$Crème de Violette$q$, $q$Briottet$q$, 18, $q$FR$q$, NULL, $q$https://boutique.briottet.fr/en/produit/1866-liqueur-de-violette$q$, $q$producer$q$),
($q$Briottet Manzana$q$, $q$Briottet Manzana Verde$q$, $q$Sour Apple Liqueur$q$, $q$Briottet$q$, 18, $q$FR$q$, NULL, $q$https://boutique.briottet.fr/en/produit/1765-manzana$q$, $q$producer$q$),
($q$Briottet Marasquin$q$, NULL, $q$Maraschino Liqueur$q$, $q$Briottet$q$, 25, $q$FR$q$, NULL, $q$https://boutique.briottet.fr/en/produit/1768-marasquin$q$, $q$producer$q$),
($q$Bumbu Crème$q$, NULL, $q$Cream Liqueur$q$, $q$Bumbu$q$, 15, NULL, NULL, $q$https://bumbu.sovereignbrands.com/bumbu-crme/$q$, $q$producer$q$),
($q$Bumbu The Original$q$, NULL, $q$Spice Liqueur$q$, $q$Bumbu$q$, 35, NULL, NULL, $q$https://bumbu.sovereignbrands.com/the-original/$q$, $q$producer$q$),
($q$B&B$q$, $q$B&B$q$, $q$French Herbal Liqueur$q$, $q$Bénédictine$q$, 40, $q$FR$q$, NULL, $q$https://www.benedictinedom.com/collection/b-and-b/$q$, $q$producer$q$),
($q$Bénédictine D.O.M$q$, $q$Bénédictine$q$, $q$French Herbal Liqueur$q$, $q$Bénédictine$q$, 40, $q$FR$q$, NULL, $q$https://www.benedictinedom.com/collection/benedictine-dom/$q$, $q$producer$q$),
($q$Cabot Trail Maple Cream$q$, NULL, $q$Cream Liqueur$q$, $q$Cabot Trail$q$, 15, $q$CA$q$, NULL, $q$https://www.lcbo.com/en/cabot-trail-maple-cream-462424$q$, $q$retailer$q$),
($q$Cabot Trail Maple Whisky$q$, NULL, $q$Whiskey Liqueur$q$, $q$Cabot Trail$q$, 31.7, $q$CA$q$, NULL, $q$https://www.lcbo.com/en/cabot-trail-maple-whisky-27892$q$, $q$retailer$q$),
($q$Cabot Trail Maple and Blueberry Cream$q$, NULL, $q$Cream Liqueur$q$, $q$Cabot Trail$q$, 15, $q$CA$q$, NULL, $q$https://www.lcbo.com/en/cabot-trail-maple-and-blueberry-cream-34480$q$, $q$retailer$q$),
($q$Cadello 88$q$, $q$Cadello 88$q$, $q$Botanical Liqueur$q$, $q$Cadello$q$, 33, $q$IT$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/6260/cadello$q$, $q$reference$q$),
($q$Caravella Limoncello$q$, $q$Caravella Limoncello$q$, $q$Limoncello$q$, $q$Caravella$q$, 28, $q$IT$q$, NULL, $q$https://www.marketviewliquor.com/product/spirit/caravella-limoncello-750-ml$q$, $q$retailer$q$),
($q$Carlshamns Flaggpunsch$q$, $q$Carlshamns Flaggpunsch$q$, $q$Swedish Punsch$q$, $q$Carlshamns$q$, 26, $q$FI$q$, NULL, $q$https://www.systembolaget.se/produkt/sprit/carlshamns-flaggpunsch-58802/$q$, $q$retailer$q$),
($q$Carolans Irish Cream$q$, $q$Carolans Irish Cream$q$, $q$Irish Cream Liqueur$q$, $q$Carolans$q$, 17, $q$IE$q$, $q$Irish Cream$q$, $q$https://www.lcbo.com/en/carolans-irish-cream-30082$q$, $q$retailer$q$),
($q$D'Aristi Xtabentún$q$, $q$D'Aristi Xtabentún$q$, $q$Xtabentún$q$, $q$Casa D'Aristi$q$, 30, $q$MX$q$, NULL, $q$https://theliquorbarn.com/collections/spirits/products/daristi-xtabentun-honey-liqueur-750ml$q$, $q$retailer$q$),
($q$Casoni Limoncello di Sorrento$q$, NULL, $q$Limoncello$q$, $q$Casoni$q$, 30, $q$IT$q$, NULL, $q$https://www.northberkeleyimports.com/wordpress/wp-content/uploads/2025/01/CASONI_Limoncello.pdf$q$, $q$retailer$q$),
($q$Chambord$q$, $q$Chambord$q$, $q$Black Raspberry Liqueur$q$, $q$Chambord$q$, 16.5, $q$FR$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/877/chambord-liqueur$q$, $q$reference$q$),
($q$Chareau Aloe Liqueur$q$, $q$Chareau$q$, $q$Liqueur$q$, $q$Chareau$q$, 25, $q$US$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/4040/chareau-aloe-liqueur$q$, $q$reference$q$),
($q$Crème Yvette$q$, $q$Crème Yvette$q$, $q$Crème de Violette$q$, $q$Charles Jacquin et Cie$q$, 27.7, $q$FR$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/1115/creme-yvette-delicieuse-liqueur$q$, $q$reference$q$),
($q$Chartreuse Liqueur d'Élixir 1605$q$, $q$Chartreuse 1605$q$, $q$French Herbal Liqueur$q$, $q$Chartreuse$q$, 56, $q$FR$q$, NULL, $q$https://www.chartreuse.fr/?p=1178$q$, $q$producer$q$),
($q$Chartreuse MOF$q$, $q$Chartreuse MOF$q$, $q$French Herbal Liqueur$q$, $q$Chartreuse$q$, 45, $q$FR$q$, NULL, $q$https://www.chartreuse.fr/en/produit/mof-liqueur/$q$, $q$producer$q$),
($q$Green Chartreuse$q$, $q$Green Chartreuse$q$, $q$French Herbal Liqueur$q$, $q$Chartreuse$q$, 55, $q$FR$q$, NULL, $q$https://www.chartreuse.fr/en/produit/green-chartreuse/$q$, $q$producer$q$),
($q$Yellow Chartreuse$q$, $q$Yellow Chartreuse$q$, $q$French Herbal Liqueur$q$, $q$Chartreuse$q$, 43, $q$FR$q$, NULL, $q$https://www.chartreuse.fr/en/produit/yellow-chartreuse/$q$, $q$producer$q$),
($q$Élixir Végétal de la Grande-Chartreuse$q$, $q$Chartreuse Elixir Végétal$q$, $q$French Herbal Liqueur$q$, $q$Chartreuse$q$, NULL, $q$FR$q$, NULL, $q$https://www.chartreuse.fr/en/produit/vegetable-elixir/$q$, $q$producer$q$),
($q$Chinola Mango Liqueur$q$, NULL, $q$Mango Liqueur$q$, $q$Chinola$q$, 21, $q$DO$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/9030/chinola-mango-liqueur$q$, $q$reference$q$),
($q$Chinola Passion Fruit Liqueur$q$, $q$Chinola Passion Fruit Liqueur$q$, $q$Passion Fruit Liqueur$q$, $q$Chinola$q$, 21, $q$DO$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/7379/chinola-passion-fruit-liqueur$q$, $q$reference$q$),
($q$The CHOYA Extra Years$q$, $q$Choya Extra Years Umeshu$q$, $q$Aged Umeshu$q$, $q$Choya$q$, 17, $q$JP$q$, NULL, $q$https://www.choya.co.jp/en/products/the_choya/the-choya-extra-years/$q$, $q$producer$q$),
($q$The CHOYA Single Year$q$, $q$The Choya Single Year Umeshu$q$, $q$Umeshu$q$, $q$Choya$q$, 15, $q$JP$q$, NULL, $q$https://www.choya.co.jp/en/products/the_choya/the-choya-single-year/$q$, $q$producer$q$),
($q$Clément Bana Canne$q$, NULL, $q$Banana Liqueur$q$, $q$Clément$q$, 25, $q$MQ$q$, NULL, $q$https://www.rhum-clement.com/rhum/bana-canne-new-range/$q$, $q$producer$q$),
($q$Clément Créole Shrubb$q$, $q$Clément Créole Shrubb$q$, $q$Orange Liqueur$q$, $q$Clément$q$, 40, $q$MQ$q$, NULL, $q$https://www.rhum-clement.com/rhum/creole-shrubb-new-range/$q$, $q$producer$q$),
($q$Clément Mahina Coco$q$, NULL, $q$Coconut Liqueur$q$, $q$Clément$q$, 18, $q$MQ$q$, NULL, $q$https://www.rhum-clement.com/rhum/mahina-coco-new-range/$q$, $q$producer$q$),
($q$Cointreau$q$, $q$Cointreau$q$, $q$Triple Sec$q$, $q$Cointreau$q$, 40, $q$FR$q$, NULL, $q$https://www.cointreau.com/us/en/products/cointreau$q$, $q$producer$q$),
($q$Cointreau Noir$q$, $q$Cointreau Noir$q$, $q$Cognac Orange Liqueur$q$, $q$Cointreau$q$, 40, $q$FR$q$, NULL, $q$https://www.cointreau.com/us/en/products/cointreau-noir$q$, $q$producer$q$),
($q$Combier Kümmel$q$, NULL, $q$Kümmel$q$, $q$Combier$q$, 38, $q$FR$q$, NULL, $q$https://www.combierusa.com/products$q$, $q$producer$q$),
($q$Combier Le Bleu$q$, NULL, $q$Blue Curaçao$q$, $q$Combier$q$, 40, $q$FR$q$, NULL, $q$https://www.combierusa.com/products$q$, $q$producer$q$),
($q$Combier Liqueur d'Abricot$q$, NULL, $q$Apricot Liqueur$q$, $q$Combier$q$, 20, $q$FR$q$, NULL, $q$https://www.combierusa.com/products$q$, $q$producer$q$),
($q$Combier Liqueur de Banane$q$, NULL, $q$Banana Liqueur$q$, $q$Combier$q$, 22, $q$FR$q$, NULL, $q$https://www.combierusa.com/products$q$, $q$producer$q$),
($q$Combier Liqueur de Cassis$q$, NULL, $q$Crème de Cassis$q$, $q$Combier$q$, 20, $q$FR$q$, NULL, $q$https://www.combierusa.com/products$q$, $q$producer$q$),
($q$Combier Liqueur de Framboise$q$, NULL, $q$Raspberry Liqueur$q$, $q$Combier$q$, 20, $q$FR$q$, NULL, $q$https://www.combierusa.com/products$q$, $q$producer$q$),
($q$Combier Liqueur de Fruit de la Passion$q$, NULL, $q$Passion Fruit Liqueur$q$, $q$Combier$q$, 20, $q$FR$q$, NULL, $q$https://www.combierusa.com/products$q$, $q$producer$q$),
($q$Combier Liqueur de Mûre$q$, NULL, $q$Crème de Mûre$q$, $q$Combier$q$, 20, $q$FR$q$, NULL, $q$https://www.combierusa.com/products$q$, $q$producer$q$),
($q$Combier Liqueur de Pamplemousse$q$, NULL, $q$Pamplemousse Liqueur$q$, $q$Combier$q$, 16, $q$FR$q$, NULL, $q$https://www.combierusa.com/products$q$, $q$producer$q$),
($q$Combier Liqueur de Pêche de Vigne$q$, NULL, $q$Crème de Pêche$q$, $q$Combier$q$, 20, $q$FR$q$, NULL, $q$https://www.combierusa.com/products$q$, $q$producer$q$),
($q$Combier Liqueur de Rose$q$, NULL, $q$Rose Liqueur$q$, $q$Combier$q$, 25, $q$FR$q$, NULL, $q$https://www.combierusa.com/products$q$, $q$producer$q$),
($q$Combier Liqueur de Sureau$q$, NULL, $q$Elderflower Liqueur$q$, $q$Combier$q$, 20, $q$FR$q$, NULL, $q$https://www.combierusa.com/products$q$, $q$producer$q$),
($q$Combier Liqueur de Violette$q$, NULL, $q$Crème de Violette$q$, $q$Combier$q$, 25, $q$FR$q$, NULL, $q$https://www.combierusa.com/products$q$, $q$producer$q$),
($q$Elixir Combier$q$, NULL, $q$Herbal Liqueur$q$, $q$Combier$q$, 38, $q$FR$q$, NULL, $q$https://www.combierusa.com/products$q$, $q$producer$q$),
($q$L'Original Combier Triple Sec$q$, $q$Combier Triple Sec$q$, $q$Triple Sec$q$, $q$Combier$q$, 40, $q$FR$q$, NULL, $q$https://www.combier.fr/en/produit/loriginal-combier-triple-sec/$q$, $q$producer$q$),
($q$Royal Combier$q$, $q$Royal Combier$q$, $q$Cognac Orange Liqueur$q$, $q$Combier$q$, 38, $q$FR$q$, NULL, $q$https://www.combierusa.com/products$q$, $q$producer$q$),
($q$DeKuyper Amaretto$q$, $q$De Kuyper Amaretto$q$, $q$Amaretto$q$, $q$DeKuyper$q$, NULL, $q$US$q$, NULL, $q$https://www.dekuyperusa.com/flavor/dekuyper-amaretto-liqueur$q$, $q$producer$q$),
($q$DeKuyper Blue Curaçao$q$, $q$De Kuyper Blue Curaçao$q$, $q$Blue Curaçao$q$, $q$DeKuyper$q$, NULL, $q$US$q$, NULL, $q$https://www.dekuyperusa.com/flavor/dekuyper-blue-curacao$q$, $q$producer$q$),
($q$DeKuyper Buttershots$q$, $q$De Kuyper Buttershots$q$, $q$Butterscotch Schnapps$q$, $q$DeKuyper$q$, NULL, $q$US$q$, NULL, $q$https://www.dekuyperusa.com/flavor/dekuyper-buttershots-schnapps$q$, $q$producer$q$),
($q$DeKuyper Hot Damn! Cinnamon Schnapps$q$, NULL, $q$Cinnamon Liqueur$q$, $q$DeKuyper$q$, NULL, $q$US$q$, NULL, $q$https://www.dekuyperusa.com/flavor/dekuyper-hot-damn-cinnamon-schnapps-liqueur$q$, $q$producer$q$),
($q$DeKuyper Melon Schnapps$q$, NULL, $q$Melon Liqueur$q$, $q$DeKuyper$q$, NULL, $q$US$q$, NULL, $q$https://www.dekuyperusa.com/flavor/dekuyper-melon-schnapps-liqueur$q$, $q$producer$q$),
($q$DeKuyper Peachtree Schnapps$q$, $q$De Kuyper Peachtree Schnapps$q$, $q$Peach Schnapps Liqueur$q$, $q$DeKuyper$q$, NULL, $q$US$q$, NULL, $q$https://www.dekuyperusa.com/flavor/dekuyper-peachtree-schnapps-liqueur$q$, $q$producer$q$),
($q$DeKuyper Peppermint Schnapps$q$, NULL, $q$Peppermint Schnapps$q$, $q$DeKuyper$q$, NULL, $q$US$q$, NULL, $q$https://www.dekuyperusa.com/flavor/dekuyper-peppermint-schnapps-liqueur$q$, $q$producer$q$),
($q$DeKuyper Pucker Sour Apple$q$, NULL, $q$Sour Apple Liqueur$q$, $q$DeKuyper$q$, NULL, $q$US$q$, NULL, $q$https://www.dekuyperusa.com/flavor/dekuyper-pucker-sour-apple-schnapps-liqueur$q$, $q$producer$q$),
($q$DeKuyper Pucker Watermelon$q$, NULL, $q$Watermelon Liqueur$q$, $q$DeKuyper$q$, NULL, $q$US$q$, NULL, $q$https://www.dekuyperusa.com/flavor/dekuyper-pucker-watermelon-schnapps-liqueur$q$, $q$producer$q$),
($q$DeKuyper Razzmatazz$q$, NULL, $q$Raspberry Liqueur$q$, $q$DeKuyper$q$, NULL, $q$US$q$, NULL, $q$https://www.dekuyperusa.com/flavor/dekuyper-razzmatazz-schnapps-liqueur$q$, $q$producer$q$),
($q$DeKuyper Triple Sec$q$, $q$De Kuyper Triple Sec$q$, $q$Triple Sec$q$, $q$DeKuyper$q$, NULL, $q$US$q$, NULL, $q$https://www.dekuyperusa.com/flavor/dekuyper-triple-sec$q$, $q$producer$q$),
($q$Dillon's Amaretto Liqueur$q$, NULL, $q$Amaretto$q$, $q$Dillon's$q$, NULL, $q$CA$q$, NULL, $q$https://shop.dillons.ca/amaretto-liqueur-750ml.html$q$, $q$producer$q$),
($q$Dillon's Black Currant Liqueur$q$, NULL, $q$Crème de Cassis$q$, $q$Dillon's$q$, NULL, $q$CA$q$, NULL, $q$https://shop.dillons.ca/black-currant-liqueur-750ml.html$q$, $q$producer$q$),
($q$Dillon's Coffee Liqueur$q$, NULL, $q$Coffee Liqueur$q$, $q$Dillon's$q$, NULL, $q$CA$q$, NULL, $q$https://shop.dillons.ca/coffee-liqueur-750ml.html$q$, $q$producer$q$),
($q$Dillon's Elderflower Liqueur$q$, NULL, $q$Elderflower Liqueur$q$, $q$Dillon's$q$, NULL, $q$CA$q$, NULL, $q$https://shop.dillons.ca/elderflower-liqueur-750ml.html$q$, $q$producer$q$),
($q$Dillon's Orange Liqueur$q$, NULL, $q$Orange Liqueur$q$, $q$Dillon's$q$, NULL, $q$CA$q$, NULL, $q$https://shop.dillons.ca/orange-liqueur-750ml.html$q$, $q$producer$q$),
($q$Dillon's Peach Liqueur$q$, $q$Dillon's Peach Liqueur$q$, $q$Peach Liqueur$q$, $q$Dillon's$q$, NULL, $q$CA$q$, NULL, $q$https://shop.dillons.ca/peach-liqueur-750ml.html$q$, $q$producer$q$),
($q$Disaronno Originale$q$, $q$Disaronno Originale$q$, $q$Amaretto$q$, $q$Disaronno$q$, NULL, $q$IT$q$, NULL, $q$https://disaronno.com/nl/products/disaronno-originale/$q$, $q$producer$q$),
($q$Disaronno Velvet$q$, NULL, $q$Cream Liqueur$q$, $q$Disaronno$q$, NULL, $q$IT$q$, NULL, $q$https://www.disaronno.com/$q$, $q$producer$q$),
($q$Domaine de Canton$q$, $q$Domaine de Canton$q$, $q$Ginger Liqueur$q$, $q$Domaine de Canton$q$, 28, NULL, NULL, $q$https://www.domainedecanton.com/$q$, $q$producer$q$),
($q$Dooley's Original Toffee Cream Liqueur$q$, $q$Dooley's Toffee Cream Liqueur$q$, $q$Cream Liqueur$q$, $q$Dooley's$q$, 17, $q$DE$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/236/dooleys-original$q$, $q$reference$q$),
($q$Drambuie$q$, $q$Drambuie$q$, $q$Scotch Liqueur$q$, $q$Drambuie$q$, NULL, $q$GB$q$, NULL, $q$https://www.drambuie.com/en/about-us/$q$, $q$producer$q$),
($q$FAIR Elderflower Liqueur$q$, $q$FAIR Elderflower Liqueur$q$, $q$Elderflower Liqueur$q$, $q$FAIR.$q$, 18, $q$FR$q$, NULL, $q$https://catalog.lwc.co.uk/fair-elderflower-liqueur-70cl/$q$, $q$retailer$q$),
($q$Fireball Blazin' Apple$q$, NULL, $q$Cinnamon Whisky$q$, $q$Fireball$q$, NULL, NULL, NULL, $q$https://www.fireballwhisky.com/blazin-apple/$q$, $q$producer$q$),
($q$Fireball Cinnamon Whisky$q$, $q$Fireball Cinnamon Whisky$q$, $q$Cinnamon Whisky$q$, $q$Fireball$q$, 33, NULL, NULL, $q$https://www.fireballwhisky.com/cinnamon-whisky/$q$, $q$producer$q$),
($q$Foxdenton Bramble & Blackthorn$q$, NULL, $q$Berry Liqueur$q$, $q$Foxdenton$q$, NULL, $q$GB$q$, NULL, $q$https://www.foxdentonestate.co.uk/shop/bramble-blackthorn$q$, $q$producer$q$),
($q$Foxdenton Damson$q$, NULL, $q$Plum Liqueur$q$, $q$Foxdenton$q$, NULL, $q$GB$q$, NULL, $q$https://www.foxdentonestate.co.uk/shop/damson-gin$q$, $q$producer$q$),
($q$Foxdenton Raspberry$q$, NULL, $q$Raspberry Liqueur$q$, $q$Foxdenton$q$, NULL, $q$GB$q$, NULL, $q$https://www.foxdentonestate.co.uk/shop/raspberry-gin$q$, $q$producer$q$),
($q$Foxdenton Rhubarb$q$, NULL, $q$Rhubarb Liqueur$q$, $q$Foxdenton$q$, NULL, $q$GB$q$, NULL, $q$https://www.foxdentonestate.co.uk/shop/rhubarb-gin$q$, $q$producer$q$),
($q$Foxdenton Sloe Gin$q$, $q$Foxdenton Sloe Gin$q$, $q$Sloe Gin$q$, $q$Foxdenton$q$, NULL, $q$GB$q$, NULL, $q$https://www.foxdentonestate.co.uk/shop/sloe-gin$q$, $q$producer$q$),
($q$Foxdenton Sloe Whisky$q$, NULL, $q$Fruit Whisky Liqueur$q$, $q$Foxdenton$q$, NULL, $q$GB$q$, NULL, $q$https://www.foxdentonestate.co.uk/shop/sloe-whisky$q$, $q$producer$q$),
($q$Foxdenton St George Elderflower Liqueur$q$, NULL, $q$Elderflower Liqueur$q$, $q$Foxdenton$q$, NULL, $q$GB$q$, NULL, $q$https://www.foxdentonestate.co.uk/shop/st-george-elderflower-liqueur-70cl$q$, $q$producer$q$),
($q$Foxdenton Winslow Plum$q$, NULL, $q$Plum Liqueur$q$, $q$Foxdenton$q$, NULL, $q$GB$q$, NULL, $q$https://www.foxdentonestate.co.uk/shop/plum-gin$q$, $q$producer$q$),
($q$Frangelico$q$, $q$Frangelico$q$, $q$Hazelnut Liqueur$q$, $q$Frangelico$q$, NULL, $q$IT$q$, NULL, $q$https://frangelico.com/$q$, $q$producer$q$),
($q$Gabriel Boudier Crème de Cassis de Dijon$q$, $q$Gabriel Boudier Crème de Cassis$q$, $q$Crème de Cassis$q$, $q$Gabriel Boudier$q$, 20, $q$FR$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/liqueurs-alc-cordials/fruit-liqueurs/BWS002992/gabriel-boudier-creme-de-cassis-de-dijon$q$, $q$reference$q$),
($q$Galliano L'Autentico$q$, $q$Galliano L'Autentico$q$, $q$Vanilla-Anise Liqueur$q$, $q$Galliano$q$, 42.3, $q$IT$q$, NULL, $q$https://galliano.com/product/galliano-lautentico/$q$, $q$producer$q$),
($q$Get 27$q$, $q$Get 27$q$, $q$Crème de Menthe Green$q$, $q$Get 27$q$, 21, $q$FR$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/3092/get-27$q$, $q$reference$q$),
($q$Get 31$q$, $q$Get 31$q$, $q$Crème de Menthe$q$, $q$Get 27$q$, 24, $q$FR$q$, NULL, $q$https://www.nicks.com.au/get-31-menthe-intense-liqueur-1000ml$q$, $q$retailer$q$),
($q$Giffard Abricot du Roussillon$q$, $q$Giffard Abricot du Roussillon$q$, $q$Apricot Liqueur$q$, $q$Giffard$q$, NULL, $q$FR$q$, NULL, $q$https://www.giffard.com/en/liqueurs-premium/367-28-abricot-du-roussillon-3.html$q$, $q$producer$q$),
($q$Gilka Kaiser-Kümmel$q$, $q$Gilka Kaiser-Kümmel$q$, $q$Kümmel$q$, $q$Gilka$q$, 38, $q$DE$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/3439/gilka-kaiser-kummel-liqueur$q$, $q$reference$q$),
($q$Goldschläger$q$, $q$Goldschläger$q$, $q$Cinnamon Liqueur$q$, $q$Goldschläger$q$, 40, $q$IT$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/312/goldschlager-cinnamon-schnapps-liqueur$q$, $q$reference$q$),
($q$Gordon's Sloe Gin$q$, $q$Gordon's Sloe Gin$q$, $q$Sloe Gin$q$, $q$Gordon's$q$, NULL, $q$GB$q$, NULL, $q$https://www.thebar.com/en-gb/products/gordons-sloe-gin-70cl$q$, $q$producer$q$),
($q$Gran Gala Triple Sec$q$, $q$Gran Gala Triple Orange Liqueur$q$, $q$Cognac Orange Liqueur$q$, $q$Gran Gala$q$, 40, NULL, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/1846/stock-gran-gala-triple-sec$q$, $q$reference$q$),
($q$Grand Marnier Cordon Rouge$q$, $q$Grand Marnier Cordon Rouge$q$, $q$Cognac Orange Liqueur$q$, $q$Grand Marnier$q$, NULL, $q$FR$q$, NULL, $q$https://www.grandmarnier.com/our-collection/cordon-rouge/$q$, $q$producer$q$),
($q$Grand Marnier Cuvée Louis-Alexandre$q$, $q$Grand Marnier Cuvée Louis Alexandre$q$, $q$Cognac Orange Liqueur$q$, $q$Grand Marnier$q$, NULL, $q$FR$q$, NULL, $q$https://www.grandmarnier.com/our-collection/cuvee-louis-alexandre/$q$, $q$producer$q$),
($q$Grand Marnier Cuvée du Centenaire$q$, NULL, $q$Cognac Orange Liqueur$q$, $q$Grand Marnier$q$, NULL, $q$FR$q$, NULL, $q$https://www.grandmarnier.com/our-collection/cuvee-du-centenaire/$q$, $q$producer$q$),
($q$Hamilton Jamaican Pimento Dram$q$, $q$Hamilton Pimento Dram$q$, $q$Allspice Dram$q$, $q$Hamilton$q$, 30, $q$JM$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/6508/hamilton-pimento-dram$q$, $q$reference$q$),
($q$Hayman's Sloe Gin$q$, $q$Hayman's Sloe Gin$q$, $q$Sloe Gin$q$, $q$Hayman's$q$, 26, $q$GB$q$, NULL, $q$https://www.haymansgin.com/product/sloe-gin/$q$, $q$producer$q$),
($q$Heering Cherry Liqueur$q$, $q$Heering Cherry Liqueur$q$, $q$Cherry Liqueur$q$, $q$Heering$q$, NULL, $q$DK$q$, NULL, $q$https://www.heering.com/$q$, $q$producer$q$),
($q$Helbing Hamburg's Kümmel$q$, $q$Helbing Kümmel$q$, $q$Kümmel$q$, $q$Heinrich Helbing$q$, 35, $q$DE$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/5494/helbing-kuemmel$q$, $q$reference$q$),
($q$Hpnotiq$q$, $q$Hpnotiq$q$, $q$Liqueur$q$, $q$Hpnotiq$q$, 17, NULL, NULL, $q$https://www.hpnotiq.com/$q$, $q$producer$q$),
($q$Irish Mist$q$, $q$Irish Mist$q$, $q$Irish Whisky Liqueur$q$, $q$Irish Mist$q$, 35, $q$IE$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/45/irish-mist$q$, $q$reference$q$),
($q$Italicus Rosolio di Bergamotto$q$, $q$Italicus Rosolio di Bergamotto$q$, $q$Rosolio di Bergamotto$q$, $q$Italicus$q$, 20, $q$IT$q$, NULL, $q$https://nicks.com.au/italicus-rosolio-di-bergamotto-liqueur-700ml$q$, $q$retailer$q$),
($q$John D. Taylor's Velvet Falernum$q$, $q$John D. Taylor's Velvet Falernum$q$, $q$Falernum$q$, $q$John D. Taylor's$q$, 11, $q$BB$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/173/velvet-falernum$q$, $q$reference$q$),
($q$Joseph Cartron Apricot Brandy$q$, $q$Joseph Cartron Apricot Brandy$q$, $q$Apricot Liqueur$q$, $q$Joseph Cartron$q$, 25, $q$FR$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/8312/joseph-cartron-apricot-brandy$q$, $q$reference$q$),
($q$Joseph Cartron Banane$q$, NULL, $q$Banana Liqueur$q$, $q$Joseph Cartron$q$, NULL, $q$FR$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/6986/joseph-cartron-banane-liqueur$q$, $q$reference$q$),
($q$Joseph Cartron Blue Curaçao$q$, NULL, $q$Blue Curaçao$q$, $q$Joseph Cartron$q$, NULL, $q$FR$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/8539/joseph-cartron-blue-curacao-liqueur$q$, $q$reference$q$),
($q$Joseph Cartron Crème de Cassis de Bourgogne$q$, NULL, $q$Crème de Cassis$q$, $q$Joseph Cartron$q$, NULL, $q$FR$q$, $q$Cassis de Bourgogne$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/7834/joseph-cartron-creme-de-cassis-de-bourgogne$q$, $q$reference$q$),
($q$Joseph Cartron Crème de Framboise$q$, NULL, $q$Creme de Framboise$q$, $q$Joseph Cartron$q$, NULL, $q$FR$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/8314/joseph-cartron-creme-de-framboise$q$, $q$reference$q$),
($q$Joseph Cartron Crème de Mûre des Roncières$q$, NULL, $q$Crème de Mûre$q$, $q$Joseph Cartron$q$, NULL, $q$FR$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/8315/joseph-cartron-creme-de-mure-des-roncieres$q$, $q$reference$q$),
($q$Joseph Cartron Crème de Pêche de Vigne$q$, NULL, $q$Crème de Pêche$q$, $q$Joseph Cartron$q$, NULL, $q$FR$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/502/joseph-cartron-creme-de-peche-de-vigne$q$, $q$reference$q$),
($q$Joseph Cartron Peppermint$q$, NULL, $q$Crème de Menthe$q$, $q$Joseph Cartron$q$, NULL, $q$FR$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/2619/joseph-cartron-peppermint-liqueur$q$, $q$reference$q$),
($q$Joseph Cartron Pomme Verte$q$, NULL, $q$Liqueur de Pomme Verte$q$, $q$Joseph Cartron$q$, NULL, $q$FR$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/2971/joseph-cartron-pomme-verte-green-apple$q$, $q$reference$q$),
($q$Joseph Cartron Triple Sec$q$, NULL, $q$Triple Sec$q$, $q$Joseph Cartron$q$, NULL, $q$FR$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/8311/joseph-cartron-triple-sec-liqueur$q$, $q$reference$q$),
($q$Jägermeister$q$, $q$Jägermeister$q$, $q$Herbal Liqueur$q$, $q$Jägermeister$q$, NULL, $q$DE$q$, NULL, $q$https://www.mast-jaegermeister.de/en/products/$q$, $q$producer$q$),
($q$Jägermeister Cold Brew Coffee$q$, NULL, $q$Coffee Liqueur$q$, $q$Jägermeister$q$, 33, $q$DE$q$, NULL, $q$https://pressemappe.mast-jaegermeister.de/download/64/texte-en/1051/6-jaegermeister_products.pdf$q$, $q$producer$q$),
($q$Jägermeister Manifest$q$, NULL, $q$Herbal Liqueur$q$, $q$Jägermeister$q$, 38, $q$DE$q$, NULL, $q$https://pressemappe.mast-jaegermeister.de/download/64/texte-en/1051/6-jaegermeister_products.pdf$q$, $q$producer$q$),
($q$Jägermeister Orange$q$, NULL, $q$Herbal Liqueur$q$, $q$Jägermeister$q$, 33, $q$DE$q$, NULL, $q$https://uk.jagermeister.com/products/orange$q$, $q$producer$q$),
($q$Kahlúa$q$, $q$Kahlúa Coffee Liqueur$q$, $q$Coffee Liqueur$q$, $q$Kahlúa$q$, 16, $q$MX$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/248/kahlua-coffee-liqueur$q$, $q$reference$q$),
($q$Kahlúa Rum & Coffee Liqueur$q$, NULL, $q$Coffee Liqueur$q$, $q$Kahlúa$q$, NULL, NULL, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/11619/kahlua-rum-and-coffee-liqueur$q$, $q$reference$q$),
($q$Kleos Mastiha$q$, $q$Kleos Mastiha Spirit$q$, $q$Mastiha$q$, $q$Kleos$q$, 30, $q$GR$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/6524/kleos-mastiha$q$, $q$reference$q$),
($q$Kronan Swedish Punsch$q$, $q$Kronan Swedish Punsch$q$, $q$Swedish Punsch$q$, $q$Kronan$q$, 26, $q$SE$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/7329/kronan-swedish-punsch-liqueur$q$, $q$reference$q$),
($q$Kō Hana Kokoleka$q$, $q$KoHana Kokoleka$q$, $q$Chocolate Liqueur$q$, $q$Kō Hana$q$, 30, $q$US$q$, NULL, $q$https://www.kohanarum.com/shop$q$, $q$producer$q$),
($q$L'Ermitage Saint Valbert Liqueur Végétale Jaune$q$, NULL, $q$French Herbal Liqueur$q$, $q$L'Ermitage Saint Valbert$q$, NULL, $q$FR$q$, NULL, $q$https://www.distilleriespeureux.com/l-ermitage-saint-valbertr$q$, $q$producer$q$),
($q$L'Ermitage Saint Valbert Liqueur Végétale Verte$q$, $q$L'Ermitage Green$q$, $q$French Herbal Liqueur$q$, $q$L'Ermitage Saint Valbert$q$, NULL, $q$FR$q$, NULL, $q$https://www.distilleriespeureux.com/l-ermitage-saint-valbertr$q$, $q$producer$q$),
($q$Amaretto Lazzaroni 1851$q$, $q$Lazzaroni Amaretto$q$, $q$Amaretto$q$, $q$Lazzaroni$q$, 24, $q$IT$q$, NULL, $q$https://www.lazzaroni.it/en/classic-liqueurs/amaretto-lazzaroni-1851-24°-1.html$q$, $q$producer$q$),
($q$Lazzaroni Anice$q$, NULL, $q$Anisette$q$, $q$Lazzaroni$q$, NULL, $q$IT$q$, NULL, $q$https://www.lazzaroni.it/en/classic-liqueurs/anice-13.html$q$, $q$producer$q$),
($q$Lazzaroni Black Caffè$q$, NULL, $q$Coffee Liqueur$q$, $q$Lazzaroni$q$, NULL, $q$IT$q$, NULL, $q$https://www.lazzaroni.it/en/classic-liqueurs/black-caffè-27.html$q$, $q$producer$q$),
($q$Lazzaroni Crema Pistacchio$q$, NULL, $q$Cream Liqueur$q$, $q$Lazzaroni$q$, NULL, $q$IT$q$, NULL, $q$https://www.lazzaroni.it/en/classic-liqueurs/crema-pistacchio-29.html$q$, $q$producer$q$),
($q$Lazzaroni Limoncino del Chiostro$q$, NULL, $q$Limoncello$q$, $q$Lazzaroni$q$, 32, $q$IT$q$, NULL, $q$https://www.lazzaroni.it/en/fruit-base-liqueurs/limoncino-del-chiostro-11.html$q$, $q$producer$q$),
($q$Lazzaroni Maraschino$q$, $q$Lazzaroni Maraschino$q$, $q$Maraschino Liqueur$q$, $q$Lazzaroni$q$, NULL, $q$IT$q$, NULL, $q$https://www.lazzaroni.it/en/classic-liqueurs/maraschino-12.html$q$, $q$producer$q$),
($q$Lazzaroni Triple Sec$q$, NULL, $q$Triple Sec$q$, $q$Lazzaroni$q$, 38, $q$IT$q$, NULL, $q$https://www.lazzaroni.it/en/classic-liqueurs/triple-sec-38°-10.html$q$, $q$producer$q$),
($q$Sambuca Lazzaroni$q$, NULL, $q$Sambuca$q$, $q$Lazzaroni$q$, 42, $q$IT$q$, NULL, $q$https://www.lazzaroni.it/en/classic-liqueurs/sambuca-lazzaroni-42°-6.html$q$, $q$producer$q$),
($q$Lejay Crème de Cassis de Dijon$q$, $q$Lejay Crème de Cassis de Dijon$q$, $q$Crème de Cassis$q$, $q$Lejay$q$, 18, $q$FR$q$, $q$Cassis de Dijon$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/4503/lejay-creme-de-cassis-18$q$, $q$reference$q$),
($q$Leopold Bros Blackberry Liqueur$q$, NULL, $q$Berry Liqueur$q$, $q$Leopold Bros$q$, 20, $q$US$q$, NULL, $q$https://www.leopoldbros.com/s/Blackberry-Liqueur-aedn.pdf$q$, $q$producer$q$),
($q$Leopold Bros Maraschino Cherry Liqueur$q$, $q$Leopold Bros. Maraschino Liqueur$q$, $q$Maraschino Liqueur$q$, $q$Leopold Bros$q$, NULL, $q$US$q$, NULL, $q$https://www.leopoldbros.com/spirits$q$, $q$producer$q$),
($q$Leopold Bros Michigan Tart Cherry Liqueur$q$, NULL, $q$Cherry Liqueur$q$, $q$Leopold Bros$q$, NULL, $q$US$q$, NULL, $q$https://www.leopoldbros.com/spirits$q$, $q$producer$q$),
($q$Leopold Bros New England Cranberry Liqueur$q$, NULL, $q$Cranberry Liqueur$q$, $q$Leopold Bros$q$, NULL, $q$US$q$, NULL, $q$https://www.leopoldbros.com/s/Leopold-Bros-Cranberry-Liqueur.pdf$q$, $q$producer$q$),
($q$Leopold Bros Orange Blossom Cordial$q$, NULL, $q$Orange Liqueur$q$, $q$Leopold Bros$q$, 40, $q$US$q$, NULL, $q$https://www.leopoldbros.com/s/Orange-Blossom-Cordial-Tech-Sheet.pdf$q$, $q$producer$q$),
($q$Leopold Bros Orange Liqueur$q$, NULL, $q$Orange Liqueur$q$, $q$Leopold Bros$q$, NULL, $q$US$q$, NULL, $q$https://www.leopoldbros.com/spirits$q$, $q$producer$q$),
($q$Leopold Bros Sour Apple Liqueur$q$, NULL, $q$Sour Apple Liqueur$q$, $q$Leopold Bros$q$, 20, $q$US$q$, NULL, $q$https://www.leopoldbros.com/s/Leopold-Bros-Sour-Apple.pdf$q$, $q$producer$q$),
($q$Leopold Bros Sour Lime Cordial$q$, NULL, $q$Citrus Liqueur$q$, $q$Leopold Bros$q$, 40, $q$US$q$, NULL, $q$https://www.leopoldbros.com/s/LB-SourLime-Cordial-SellSheet.pdf$q$, $q$producer$q$),
($q$Leopold Bros Three Chamber Peach Liqueur$q$, NULL, $q$Peach Liqueur$q$, $q$Leopold Bros$q$, 40, $q$US$q$, NULL, $q$https://www.leopoldbros.com/s/Leopold-Peach-Liqueur.pdf$q$, $q$producer$q$),
($q$Leopold Bros Three Pins Alpine Liqueur$q$, NULL, $q$Alpine Liqueur$q$, $q$Leopold Bros$q$, 35, $q$US$q$, NULL, $q$https://www.leopoldbros.com/s/ThreePinsSellSheet.pdf$q$, $q$producer$q$),
($q$Licor 43 Caramel Cookie$q$, NULL, $q$Cream Liqueur$q$, $q$Licor 43$q$, NULL, NULL, NULL, $q$https://licor43.com/licor-43-caramel-cookie/$q$, $q$producer$q$),
($q$Licor 43 Chocolate$q$, NULL, $q$Chocolate Liqueur$q$, $q$Licor 43$q$, NULL, NULL, NULL, $q$https://licor43.com/licor-43-chocolate/$q$, $q$producer$q$),
($q$Licor 43 Crème Brûlée$q$, NULL, $q$Cream Liqueur$q$, $q$Licor 43$q$, NULL, NULL, NULL, $q$https://licor43.com/licor-43-creme-brulee/$q$, $q$producer$q$),
($q$Licor 43 Horchata$q$, NULL, $q$Cream Liqueur$q$, $q$Licor 43$q$, NULL, NULL, NULL, $q$https://licor43.com/licor-43-horchata/$q$, $q$producer$q$),
($q$Licor 43 Original$q$, $q$Licor 43$q$, $q$Vanilla Liqueur$q$, $q$Licor 43$q$, NULL, NULL, NULL, $q$https://licor43.com/licor-43-original/$q$, $q$producer$q$),
($q$Limoncello di Capri$q$, $q$Limoncello di Capri$q$, $q$Limoncello$q$, $q$Limoncello di Capri$q$, 30, $q$IT$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/1957/limoncello-di-capri$q$, $q$reference$q$),
($q$Luxardo Amaretto di Saschira$q$, NULL, $q$Amaretto$q$, $q$Luxardo$q$, 28, $q$IT$q$, NULL, $q$https://www.lcbo.com/webapp/wcs/stores/servlet/en/lcbo/nut-15015037/luxardo-amaretto-di-saschira-215988$q$, $q$retailer$q$),
($q$Luxardo Angioletto Hazelnut Liqueur$q$, $q$Luxardo Angioletto Hazelnut Liqueur$q$, $q$Hazelnut Liqueur$q$, $q$Luxardo$q$, 24, $q$IT$q$, NULL, $q$https://www.luxardo.it/liqueurs-and-distillates/angioletto-hazelnut-liqueur/$q$, $q$producer$q$),
($q$Luxardo Apricot$q$, $q$Luxardo Apricot$q$, $q$Apricot Liqueur$q$, $q$Luxardo$q$, 30, $q$IT$q$, NULL, $q$https://www.luxardo.it/liqueurs-and-distillates/apricot/$q$, $q$producer$q$),
($q$Luxardo Limoncello$q$, $q$Luxardo Limoncello$q$, $q$Limoncello$q$, $q$Luxardo$q$, 27, $q$IT$q$, NULL, $q$https://www.luxardo.it/liqueurs-and-distillates/limoncello/$q$, $q$producer$q$),
($q$Luxardo Maraschino Originale$q$, $q$Luxardo Maraschino Originale$q$, $q$Maraschino Liqueur$q$, $q$Luxardo$q$, 32, $q$IT$q$, NULL, $q$https://www.luxardo.it/liqueurs-and-distillates/maraschino-originale/$q$, $q$producer$q$),
($q$Luxardo Maraschino Perla Dry$q$, NULL, $q$Maraschino Liqueur$q$, $q$Luxardo$q$, 40, $q$IT$q$, NULL, $q$https://www.luxardo.it/liqueurs-and-distillates/maraschino-perla-dry/$q$, $q$producer$q$),
($q$Luxardo Passione Nera$q$, NULL, $q$Sambuca$q$, $q$Luxardo$q$, 38, $q$IT$q$, NULL, $q$https://www.luxardo.it/liqueurs-and-distillates/passione-nera/$q$, $q$producer$q$),
($q$Luxardo Passione Raspberry$q$, NULL, $q$Sambuca$q$, $q$Luxardo$q$, 38, $q$IT$q$, NULL, $q$https://www.luxardo.it/liqueurs-and-distillates/passione-raspberry/$q$, $q$producer$q$),
($q$Luxardo Sambuca dei Cesari$q$, $q$Luxardo Sambuca dei Cesari$q$, $q$Sambuca$q$, $q$Luxardo$q$, 38, $q$IT$q$, NULL, $q$https://www.luxardo.it/liqueurs-and-distillates/sambuca-dei-cesari/$q$, $q$producer$q$),
($q$Luxardo Sangue Morlacco$q$, $q$Luxardo Sangue Morlacco$q$, $q$Cherry Liqueur$q$, $q$Luxardo$q$, 30, $q$IT$q$, NULL, $q$https://www.luxardo.it/liqueurs-and-distillates/sangue-morlacco/$q$, $q$producer$q$),
($q$Luxardo Sour Apple$q$, NULL, $q$Sour Apple Liqueur$q$, $q$Luxardo$q$, 15, $q$IT$q$, NULL, $q$https://www.luxardo.it/liqueurs-and-distillates/sour-apple/$q$, $q$producer$q$),
($q$Luxardo Triplum Triple Sec$q$, $q$Luxardo Triplum Triple Sec$q$, $q$Triple Sec$q$, $q$Luxardo$q$, 39, $q$IT$q$, NULL, $q$https://www.luxardo.it/liqueurs-and-distillates/triplum-triple-sec-citrus/$q$, $q$producer$q$),
($q$Maggie's Farm Falernum$q$, $q$Maggie's Farm Falernum$q$, $q$Falernum$q$, $q$Maggie's Farm$q$, NULL, $q$US$q$, NULL, $q$https://www.bowlerwine.com/producer/maggies-farm$q$, $q$retailer$q$),
($q$Mandarine Napoléon$q$, $q$Mandarine Napoléon$q$, $q$Mandarin Liqueur$q$, $q$Mandarine Napoléon$q$, 38, NULL, NULL, $q$https://mandarinenapoleon.com/product/$q$, $q$producer$q$),
($q$Manly Spirits Zesty Limoncello$q$, NULL, $q$Limoncello$q$, $q$Manly Spirits$q$, 23, $q$AU$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/7690/manly-spirits-zesty-limoncello-liqueur$q$, $q$reference$q$),
($q$Maraska Zadarski Maraschino$q$, $q$Maraska Maraschino$q$, $q$Maraschino Liqueur$q$, $q$Maraska$q$, 32, $q$HR$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/3630/maraska-zadarski-maraschino$q$, $q$reference$q$),
($q$Marie Brizard Anisette$q$, $q$Marie Brizard Anisette$q$, $q$Anisette$q$, $q$Marie Brizard$q$, 25, NULL, NULL, $q$https://mariebrizard.com/bottles/anisette/$q$, $q$producer$q$),
($q$Marie Brizard Apry$q$, $q$Apry$q$, $q$Apricot Liqueur$q$, $q$Marie Brizard$q$, 20.5, NULL, NULL, $q$https://mariebrizard.com/bottles/apry/$q$, $q$producer$q$),
($q$Marie Brizard Blue Curaçao$q$, $q$Marie Brizard Blue Curaçao$q$, $q$Blue Curaçao$q$, $q$Marie Brizard$q$, 23, NULL, NULL, $q$https://mariebrizard.com/bottles/blue-curac%cc%a7ao/$q$, $q$producer$q$),
($q$Marie Brizard Brown Cocoa$q$, NULL, $q$Dark Crème de Cacao$q$, $q$Marie Brizard$q$, 20, NULL, NULL, $q$https://mariebrizard.com/bottles/brown-cocoa/$q$, $q$producer$q$),
($q$Marie Brizard Curaçao Orange$q$, $q$Marie Brizard Orange Curaçao$q$, $q$Curaçao$q$, $q$Marie Brizard$q$, 30, NULL, NULL, $q$https://mariebrizard.com/bottles/curac%cc%a7ao-orange/$q$, $q$producer$q$),
($q$Marie Brizard Falernum$q$, NULL, $q$Falernum$q$, $q$Marie Brizard$q$, 15, NULL, NULL, $q$https://mariebrizard.com/bottles/falernum/$q$, $q$producer$q$),
($q$Marie Brizard Green Mint$q$, NULL, $q$Crème de Menthe Green$q$, $q$Marie Brizard$q$, 20, NULL, NULL, $q$https://mariebrizard.com/bottles/green-mint/$q$, $q$producer$q$),
($q$Marie Brizard Orchard Peach$q$, NULL, $q$Peach Liqueur$q$, $q$Marie Brizard$q$, 15, NULL, NULL, $q$https://mariebrizard.com/bottles/peach/$q$, $q$producer$q$),
($q$Marie Brizard Parfait Amour$q$, $q$Marie Brizard Parfait Amour$q$, $q$Parfait Amour$q$, $q$Marie Brizard$q$, 25, NULL, NULL, $q$https://mariebrizard.com/bottles/parfait-amour/$q$, $q$producer$q$),
($q$Marie Brizard Pear William$q$, $q$Marie Brizard Pear Williams$q$, $q$Pear Liqueur$q$, $q$Marie Brizard$q$, 23, NULL, NULL, $q$https://mariebrizard.com/bottles/pear-william/$q$, $q$producer$q$),
($q$Marie Brizard Triple Sec$q$, NULL, $q$Triple Sec$q$, $q$Marie Brizard$q$, 39, NULL, NULL, $q$https://mariebrizard.com/bottles/triple-sec/$q$, $q$producer$q$),
($q$Marie Brizard Violet$q$, NULL, $q$Crème de Violette$q$, $q$Marie Brizard$q$, 15, NULL, NULL, $q$https://mariebrizard.com/bottles/violet/$q$, $q$producer$q$),
($q$Marie Brizard White Cocoa$q$, $q$Marie Brizard White Crème de Cacao$q$, $q$White Crème de Cacao$q$, $q$Marie Brizard$q$, 20, NULL, NULL, $q$https://mariebrizard.com/bottles/white-cocoa/$q$, $q$producer$q$),
($q$Marie Brizard White Mint$q$, $q$Marie Brizard Crème de Menthe White$q$, $q$Crème de Menthe$q$, $q$Marie Brizard$q$, 20, NULL, NULL, $q$https://mariebrizard.com/bottles/white-mint/$q$, $q$producer$q$),
($q$Marionette Amaretto$q$, $q$Marionette Amaretto$q$, $q$Amaretto$q$, $q$Marionette$q$, 25, $q$AU$q$, NULL, $q$https://www.marionette.com.au/shop/p/amaretto$q$, $q$producer$q$),
($q$Marionette Apricot$q$, $q$Marionette Apricot$q$, $q$Apricot Liqueur$q$, $q$Marionette$q$, 25, $q$AU$q$, NULL, $q$https://www.marionette.com.au/shop/p/apricot$q$, $q$producer$q$),
($q$Marionette Berry$q$, NULL, $q$Berry Liqueur$q$, $q$Marionette$q$, 20, $q$AU$q$, NULL, $q$https://www.marionette.com.au/shop/p/marionetteberry$q$, $q$producer$q$),
($q$Marionette Bitter Curaçao$q$, $q$Marionette Bitter Curacao$q$, $q$Curaçao$q$, $q$Marionette$q$, 28, $q$AU$q$, NULL, $q$https://www.marionette.com.au/shop/p/bittercuracao-1$q$, $q$producer$q$),
($q$Marionette Blue Curaçao$q$, $q$Marionette Blue Curacao$q$, $q$Blue Curaçao$q$, $q$Marionette$q$, 28, $q$AU$q$, NULL, $q$https://www.marionette.com.au/shop/p/bluecuracao$q$, $q$producer$q$),
($q$Marionette Dry Cassis$q$, NULL, $q$Crème de Cassis$q$, $q$Marionette$q$, 20, $q$AU$q$, NULL, $q$https://www.marionette.com.au/shop/p/drycassis$q$, $q$producer$q$),
($q$Marionette Elderflower$q$, $q$Marionette Elderflower$q$, $q$Elderflower Liqueur$q$, $q$Marionette$q$, 20, $q$AU$q$, NULL, $q$https://www.marionette.com.au/shop/p/elderflower$q$, $q$producer$q$),
($q$Marionette Mure$q$, $q$Marionette Mure$q$, $q$Crème de Mûre$q$, $q$Marionette$q$, 20, $q$AU$q$, NULL, $q$https://www.marionette.com.au/shop/p/mure$q$, $q$producer$q$),
($q$Marionette Nocino$q$, NULL, $q$Nocino$q$, $q$Marionette$q$, 28, $q$AU$q$, NULL, $q$https://www.marionette.com.au/shop/p/nocino$q$, $q$producer$q$),
($q$Marionette Peach$q$, NULL, $q$Peach Liqueur$q$, $q$Marionette$q$, 25, $q$AU$q$, NULL, $q$https://www.marionette.com.au/shop/p/peach$q$, $q$producer$q$),
($q$Marionette Pineapple$q$, NULL, $q$Pineapple Liqueur$q$, $q$Marionette$q$, 25, $q$AU$q$, NULL, $q$https://www.marionette.com.au/shop/p/pineapple$q$, $q$producer$q$),
($q$Marionette Plum$q$, NULL, $q$Plum Liqueur$q$, $q$Marionette$q$, 22, $q$AU$q$, NULL, $q$https://www.marionette.com.au/shop/p/plum$q$, $q$producer$q$),
($q$Massenez Crème de Banane$q$, $q$Massenez Banana Liqueur$q$, $q$Banana Liqueur$q$, $q$Massenez$q$, 20, $q$FR$q$, NULL, $q$https://www.distilleriespeureux.com/creme-de-banane$q$, $q$producer$q$),
($q$Massenez Crème de Cacao$q$, NULL, $q$Crème de Cacao$q$, $q$Massenez$q$, NULL, $q$FR$q$, NULL, $q$https://www.distilleriespeureux.com/creme-de-cacao-massenez$q$, $q$producer$q$),
($q$Massenez Crème de Cassis de Dijon$q$, NULL, $q$Crème de Cassis$q$, $q$Massenez$q$, 20, $q$FR$q$, $q$Cassis de Dijon$q$, $q$https://www.distilleriespeureux.com/creme-cassis-dijon-massenez$q$, $q$producer$q$),
($q$Massenez Crème de Framboise$q$, NULL, $q$Creme de Framboise$q$, $q$Massenez$q$, 20, $q$FR$q$, NULL, $q$https://www.distilleriespeureux.com/creme-framboise-massenez$q$, $q$producer$q$),
($q$Massenez Crème de Gingembre$q$, NULL, $q$Ginger Liqueur$q$, $q$Massenez$q$, 20, $q$FR$q$, NULL, $q$https://www.distilleriespeureux.com/creme-de-gingembre-massenez$q$, $q$producer$q$),
($q$Massenez Crème de Menthe Verte$q$, NULL, $q$Crème de Menthe Green$q$, $q$Massenez$q$, 20, $q$FR$q$, NULL, $q$https://www.distilleriespeureux.com/creme-menthe-verte-massenez$q$, $q$producer$q$),
($q$Massenez Crème de Mûre$q$, NULL, $q$Crème de Mûre$q$, $q$Massenez$q$, 20, $q$FR$q$, NULL, $q$https://www.distilleriespeureux.com/creme-mure-massenez$q$, $q$producer$q$),
($q$Massenez Crème de Pêche$q$, NULL, $q$Crème de Pêche$q$, $q$Massenez$q$, 20, $q$FR$q$, NULL, $q$https://www.distilleriespeureux.com/creme-peche-massenez$q$, $q$producer$q$),
($q$Massenez Crème de Violettes$q$, NULL, $q$Crème de Violette$q$, $q$Massenez$q$, 25, $q$FR$q$, NULL, $q$https://www.distilleriespeureux.com/creme-violettes-massenez$q$, $q$producer$q$),
($q$Massenez Liqueur d'Abricot$q$, NULL, $q$Apricot Liqueur$q$, $q$Massenez$q$, 25, $q$FR$q$, NULL, $q$https://www.distilleriespeureux.com/liqueur-abricot-massenez$q$, $q$producer$q$),
($q$Massenez Liqueur de Litchi$q$, NULL, $q$Lychee Liqueur$q$, $q$Massenez$q$, 24, $q$FR$q$, NULL, $q$https://www.distilleriespeureux.com/liqueur-litchi-massenez$q$, $q$producer$q$),
($q$Massenez Liqueur de Pamplemousse$q$, NULL, $q$Pamplemousse Liqueur$q$, $q$Massenez$q$, 20, $q$FR$q$, NULL, $q$https://www.distilleriespeureux.com/liqueur-pamplemousse-massenez$q$, $q$producer$q$),
($q$Massenez Liqueur de Poire au Cognac$q$, NULL, $q$Pear Liqueur$q$, $q$Massenez$q$, 38, $q$FR$q$, NULL, $q$https://www.distilleriespeureux.com/liqueur-poire-cognac-massenez$q$, $q$producer$q$),
($q$Mentzendorff Kümmel$q$, $q$Mentzendorff Kümmel$q$, $q$Kümmel$q$, $q$Mentzendorff$q$, 38, $q$FR$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/1548/mentzendorff-kummel-liqueur$q$, $q$reference$q$),
($q$Merlet C2 Café$q$, NULL, $q$Coffee Liqueur$q$, $q$Merlet$q$, 33, $q$FR$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/5006/merlet-c2-cafe$q$, $q$reference$q$),
($q$Merlet C2 Citron$q$, NULL, $q$Citrus Liqueur$q$, $q$Merlet$q$, 33, $q$FR$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/3965/merlet-c2-lemon$q$, $q$reference$q$),
($q$Merlet Crème de Cassis$q$, $q$Merlet Crème de Cassis$q$, $q$Crème de Cassis$q$, $q$Merlet$q$, 20, $q$FR$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/1584/merlet-creme-de-cassis$q$, $q$reference$q$),
($q$Merlet Crème de Fraise des Bois$q$, NULL, $q$Strawberry Liqueur$q$, $q$Merlet$q$, 18, $q$FR$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/1585/merlet-creme-de-fraise-des-bois$q$, $q$reference$q$),
($q$Merlet Crème de Framboise$q$, NULL, $q$Creme de Framboise$q$, $q$Merlet$q$, 18, $q$FR$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/1586/merlet-creme-de-framboise$q$, $q$reference$q$),
($q$Merlet Crème de Melon$q$, NULL, $q$Melon Liqueur$q$, $q$Merlet$q$, 18, $q$FR$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/1596/merlet-creme-de-melon$q$, $q$reference$q$),
($q$Merlet Crème de Mûre$q$, $q$Merlet Crème de Mûre$q$, $q$Crème de Mûre$q$, $q$Merlet$q$, 18, $q$FR$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/1587/merlet-creme-de-mure$q$, $q$reference$q$),
($q$Merlet Crème de Poire William$q$, NULL, $q$Pear Liqueur$q$, $q$Merlet$q$, 18, $q$FR$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/1589/merlet-creme-de-poire-william$q$, $q$reference$q$),
($q$Merlet Crème de Pêche$q$, $q$Merlet Creme de Peche$q$, $q$Crème de Pêche$q$, $q$Merlet$q$, 18, $q$FR$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/1588/merlet-creme-de-peche$q$, $q$reference$q$),
($q$Merlet Lune d'Abricot$q$, $q$Merlet Apricot$q$, $q$Apricot Liqueur$q$, $q$Merlet$q$, 25, $q$FR$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/2528/merlet-lune-dabricot$q$, $q$reference$q$),
($q$Midori$q$, $q$Midori$q$, $q$Melon Liqueur$q$, $q$Midori$q$, NULL, NULL, NULL, $q$https://www.midori-world.com/product$q$, $q$producer$q$),
($q$Molinari Sambuca Extra$q$, $q$Molinari Sambuca Extra$q$, $q$Sambuca$q$, $q$Molinari$q$, 40, $q$IT$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/1659/molinari-sambuca-extra$q$, $q$reference$q$),
($q$Monkey 47 Schwarzwald Sloe Gin$q$, $q$Monkey 47 Schwarzwald Sloe Gin$q$, $q$Sloe Gin$q$, $q$Monkey 47$q$, 29, $q$DE$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/5747/monkey-47-sloe-gin$q$, $q$reference$q$),
($q$Mozart Coffee Chocolate Liqueur$q$, NULL, $q$Chocolate Liqueur$q$, $q$Mozart$q$, 17, NULL, NULL, $q$https://www.mozartchocolateliqueur.com/en/products/coffee$q$, $q$producer$q$),
($q$Mozart Dark Chocolate Liqueur$q$, NULL, $q$Chocolate Liqueur$q$, $q$Mozart$q$, NULL, NULL, NULL, $q$https://www.mozartchocolateliqueur.com/en/products/dark$q$, $q$producer$q$),
($q$Mozart Milk Chocolate Liqueur$q$, $q$Mozart Chocolate Liqueur$q$, $q$Chocolate Liqueur$q$, $q$Mozart$q$, NULL, NULL, NULL, $q$https://www.mozartchocolateliqueur.com/en/products/cream$q$, $q$producer$q$),
($q$Mozart Strawberry White Chocolate Liqueur$q$, NULL, $q$White Chocolate Liqueur$q$, $q$Mozart$q$, NULL, NULL, NULL, $q$https://www.mozartchocolateliqueur.com/en/products/strawberry$q$, $q$producer$q$),
($q$Mozart White Chocolate Liqueur$q$, NULL, $q$White Chocolate Liqueur$q$, $q$Mozart$q$, NULL, NULL, NULL, $q$https://www.mozartchocolateliqueur.com/en/products/white$q$, $q$producer$q$),
($q$Mr Black Cold Brew Coffee Liqueur$q$, $q$Mr Black Cold Brew Coffee Liqueur$q$, $q$Coffee Liqueur$q$, $q$Mr Black$q$, NULL, NULL, NULL, $q$https://mrblack.co/en/products$q$, $q$producer$q$),
($q$Mr Black Double Cacao Coffee and Whisky Liqueur$q$, $q$Mr Black Double Cacao$q$, $q$Coffee Liqueur$q$, $q$Mr Black$q$, 23, $q$AU$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/7906/mr-black-double-cacao-coffee-and-whisky-liqueur$q$, $q$reference$q$),
($q$Muyu Chinotto Nero$q$, $q$Muyu Chinotto Nero$q$, $q$Chinotto Liqueur$q$, $q$Muyu$q$, 24, $q$NL$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/6356/muyu-chinotto-nero$q$, $q$reference$q$),
($q$Muyu Jasmine Verte$q$, $q$Muyu Jasmine Verte$q$, $q$Jasmine Liqueur$q$, $q$Muyu$q$, 24, $q$NL$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/6355/muyu-jasmine-verte$q$, $q$reference$q$),
($q$Muyu Vetiver Gris$q$, $q$Muyu Vetiver Gris$q$, $q$Botanical Liqueur$q$, $q$Muyu$q$, 22, $q$NL$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/6354/muyu-vetiver-gris$q$, $q$reference$q$),
($q$Nardini Acqua di Cedro$q$, $q$Nardini Acqua Di Cedro$q$, $q$Acqua di Cedro$q$, $q$Nardini$q$, 29, $q$IT$q$, NULL, $q$https://www.nardini.it/product/19646716/acqua-di-cedro?lang=it_IT$q$, $q$producer$q$),
($q$Nardini Acqua di Mandorla$q$, NULL, $q$Almond Liqueur$q$, $q$Nardini$q$, 29, $q$IT$q$, NULL, $q$https://www.nardini.it/product/35618769/acqua-di-mandorla-$q$, $q$producer$q$),
($q$Nardini Hylde$q$, NULL, $q$Elderflower Liqueur$q$, $q$Nardini$q$, 20, $q$IT$q$, NULL, $q$https://www.nardini.it/product/41393391/hylde-$q$, $q$producer$q$),
($q$Nixta Licor de Elote$q$, $q$Nixta Licor de Elote$q$, $q$Corn Liqueur$q$, $q$Nixta$q$, 30, $q$MX$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/6704/nixta-liqueur$q$, $q$reference$q$),
($q$Opal Nera$q$, $q$Opal Nera Black Sambuca$q$, $q$Sambuca$q$, $q$Opal Nera$q$, 38, $q$IT$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/212/opal-nera-liqueur$q$, $q$reference$q$),
($q$Pallini Limoncello$q$, $q$Pallini Limoncello$q$, $q$Limoncello$q$, $q$Pallini$q$, 26, $q$IT$q$, NULL, $q$https://pallini.com/prodotti-pallini/limoncello/$q$, $q$producer$q$),
($q$Pama Pomegranate Liqueur$q$, $q$Pama Pomegranate Liqueur$q$, $q$Pomegranate Liqueur$q$, $q$Pama$q$, 17, $q$US$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/1666/pama-pomegranate$q$, $q$reference$q$),
($q$Passoã$q$, $q$Passoã$q$, $q$Passion Fruit Liqueur$q$, $q$Passoã$q$, NULL, NULL, NULL, $q$https://www.passoa.com/en/product$q$, $q$producer$q$),
($q$Patrón Citrónge Orange & Jalapeño Liqueur$q$, NULL, $q$Orange Liqueur$q$, $q$Patrón$q$, NULL, $q$MX$q$, NULL, $q$https://www.patrontequila.com/products/patron-citronge-orange-and-jalapeno-liqueur.html$q$, $q$producer$q$),
($q$Patrón Citrónge Orange Liqueur$q$, $q$Patrón Citrónge Orange$q$, $q$Orange Liqueur$q$, $q$Patrón$q$, NULL, $q$MX$q$, NULL, $q$https://www.patrontequila.com/products/patron-citronge-orange-liqueur.html$q$, $q$producer$q$),
($q$Patrón XO Cafe$q$, $q$Patrón XO Cafe$q$, $q$Coffee Liqueur$q$, $q$Patrón$q$, NULL, $q$MX$q$, NULL, $q$https://www.patrontequila.com/products/patron-xo-cafe-coffee-liquor.html$q$, $q$producer$q$),
($q$Pavan$q$, $q$Pavan$q$, $q$Muscat Liqueur$q$, $q$Pavan$q$, 18, $q$FR$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/3555/pavan-liqueur$q$, $q$reference$q$),
($q$Pierre Ferrand Dry Curaçao$q$, $q$Pierre Ferrand Dry Curaçao$q$, $q$Dry Curacao Liqueur$q$, $q$Pierre Ferrand$q$, 40, $q$FR$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/734/ferrand-dry-curacao$q$, $q$reference$q$),
($q$Pierre Ferrand Dry Curaçao Yuzu Late Harvest$q$, $q$Pierre Ferrand Yuzu Dry Curacao$q$, $q$Dry Curacao Liqueur$q$, $q$Pierre Ferrand$q$, 40, $q$FR$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/8133/ferrand-yuzu-late-harvest-dry-curacao$q$, $q$reference$q$),
($q$Pimm's No.1 Cup$q$, $q$Pimm's No.1 Cup$q$, $q$Liqueur$q$, $q$Pimm's$q$, 25, $q$GB$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/363/pimms-no-1-cup$q$, $q$reference$q$),
($q$Pisang Ambon$q$, $q$Pisang Ambon Banana Liqueur$q$, $q$Banana Liqueur$q$, $q$Pisang Ambon$q$, 17, $q$NL$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/200/pisang-ambon$q$, $q$reference$q$),
($q$Plymouth Sloe Gin$q$, $q$Plymouth sloe Gin$q$, $q$Sloe Gin$q$, $q$Plymouth$q$, 26, $q$GB$q$, NULL, $q$http://www.diffordsguide.com/beer-wine-spirits/197/plymouth-sloe-gin-liqueur$q$, $q$reference$q$),
($q$Nux Alpina$q$, $q$Nux Alpina$q$, $q$Nocino$q$, $q$Purkhart$q$, 32, $q$AT$q$, NULL, $q$https://alpenz.com/producer-purkhart.html$q$, $q$producer$q$),
($q$Quaglia Chinotto$q$, $q$Quaglia Chinotto$q$, $q$Chinotto Liqueur$q$, $q$Quaglia$q$, 35, $q$IT$q$, NULL, $q$https://distilleriaquaglia.it/en/prodotto/liquore-al-chinotto/$q$, $q$producer$q$),
($q$Ramazzotti Sambuca$q$, $q$Ramazzotti Sambuca$q$, $q$Sambuca$q$, $q$Ramazzotti$q$, 38, $q$IT$q$, NULL, $q$https://www.lcbo.com/webapp/wcs/stores/servlet/en/sdp/sambuca/ramazzotti-sambuca-605709$q$, $q$retailer$q$),
($q$Riga Black Balsam Original$q$, $q$Riga Black Balsam$q$, $q$Herbal Liqueur$q$, $q$Riga Black Balsam$q$, 45, $q$LV$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/7227/riga-black-balsam-original$q$, $q$reference$q$),
($q$Rockey's Botanical Liqueur$q$, $q$Rockey's Botanical Liqueur$q$, $q$Botanical Liqueur$q$, $q$Rockey's$q$, 12, $q$US$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/9008/rockeys-liqueur$q$, $q$reference$q$),
($q$Roots Diktamo$q$, NULL, $q$Herbal Liqueur$q$, $q$Roots$q$, NULL, $q$GR$q$, NULL, $q$https://finestroots.com/roots-craft-liqueurs/$q$, $q$producer$q$),
($q$Roots Kanela$q$, NULL, $q$Cinnamon Liqueur$q$, $q$Roots$q$, NULL, $q$GR$q$, NULL, $q$https://finestroots.com/roots-craft-liqueurs/$q$, $q$producer$q$),
($q$Roots Mastic$q$, NULL, $q$Mastiha$q$, $q$Roots$q$, NULL, $q$GR$q$, NULL, $q$https://finestroots.com/roots-craft-liqueurs/$q$, $q$producer$q$),
($q$Roots Mastic VS$q$, NULL, $q$Mastiha$q$, $q$Roots$q$, NULL, $q$GR$q$, NULL, $q$https://finestroots.com/roots-craft-liqueurs/$q$, $q$producer$q$),
($q$Roots Rakomelo$q$, NULL, $q$Honey Liqueur$q$, $q$Roots$q$, NULL, $q$GR$q$, NULL, $q$https://finestroots.com/roots-craft-liqueurs/$q$, $q$producer$q$),
($q$Rothman & Winter Crème de Violette$q$, $q$Rothman & Winter Crème de Violette$q$, $q$Crème de Violette$q$, $q$Rothman & Winter$q$, 20, $q$AT$q$, NULL, $q$https://alpenz.com/producer-purkhart.html$q$, $q$producer$q$),
($q$Rothman & Winter Orchard Apricot$q$, $q$Rothman & Winter Orchard Apricot$q$, $q$Apricot Liqueur$q$, $q$Rothman & Winter$q$, 24, $q$AT$q$, NULL, $q$https://alpenz.com/producer-purkhart.html$q$, $q$producer$q$),
($q$Rothman & Winter Orchard Cherry$q$, $q$Rothman & Winter Orchard Cherry$q$, $q$Cherry Liqueur$q$, $q$Rothman & Winter$q$, 24, $q$AT$q$, NULL, $q$https://alpenz.com/producer-purkhart.html$q$, $q$producer$q$),
($q$Rothman & Winter Orchard Elderberry$q$, NULL, $q$Berry Liqueur$q$, $q$Rothman & Winter$q$, 24, $q$AT$q$, NULL, $q$https://alpenz.com/producer-purkhart.html$q$, $q$producer$q$),
($q$Rothman & Winter Orchard Peach$q$, NULL, $q$Peach Liqueur$q$, $q$Rothman & Winter$q$, 24, $q$AT$q$, NULL, $q$https://alpenz.com/producer-purkhart.html$q$, $q$producer$q$),
($q$Rothman & Winter Orchard Pear$q$, $q$Rothman & Winter Orchard Pear$q$, $q$Pear Liqueur$q$, $q$Rothman & Winter$q$, 24, $q$AT$q$, NULL, $q$https://alpenz.com/producer-purkhart.html$q$, $q$producer$q$),
($q$Rothman & Winter Orchard Quince$q$, NULL, $q$Quince Liqueur$q$, $q$Rothman & Winter$q$, 24, $q$AT$q$, NULL, $q$https://alpenz.com/producer-purkhart.html$q$, $q$producer$q$),
($q$RumChata$q$, $q$RumChata$q$, $q$Cream Liqueur$q$, $q$RumChata$q$, 13.75, $q$US$q$, NULL, $q$https://specsonline.com/shop/spirits/rumchata-horchata-con-ron-cream-liqueur-3/$q$, $q$retailer$q$),
($q$RumChata Coconut Cream$q$, NULL, $q$Cream Liqueur$q$, $q$RumChata$q$, NULL, NULL, NULL, $q$https://www.rumchata.com/flavors/coconut-cream/$q$, $q$producer$q$),
($q$RumChata Peppermint Bark$q$, NULL, $q$Cream Liqueur$q$, $q$RumChata$q$, NULL, NULL, NULL, $q$https://www.rumchata.com/flavors/peppermint-bark/$q$, $q$producer$q$),
($q$RumChata Pineapple Cream$q$, NULL, $q$Cream Liqueur$q$, $q$RumChata$q$, NULL, NULL, NULL, $q$https://www.rumchata.com/flavors/pineapple-cream/$q$, $q$producer$q$),
($q$Senior Blue Curaçao$q$, $q$Senior Blue Curaçao$q$, $q$Blue Curaçao$q$, $q$Senior & Co.$q$, NULL, $q$CW$q$, NULL, $q$https://www.curacaoliqueur.com/senior-liqueurs/colored-cocktail-essentials/blue-curacao$q$, $q$producer$q$),
($q$Senior Chukulati$q$, NULL, $q$Chocolate Liqueur$q$, $q$Senior & Co.$q$, NULL, $q$CW$q$, NULL, $q$https://www.curacaoliqueur.com/senior-liqueurs/specialty-liqueurs/chukulati$q$, $q$producer$q$),
($q$Senior Curaçao 31% Triple Sec$q$, NULL, $q$Curaçao$q$, $q$Senior & Co.$q$, 31, $q$CW$q$, NULL, $q$https://www.curacaoliqueur.com/senior-liqueurs/curacao-triple-sec/31-curacao-triple-sec$q$, $q$producer$q$),
($q$Senior Curaçao 40% Triple Sec$q$, NULL, $q$Curaçao$q$, $q$Senior & Co.$q$, 40, $q$CW$q$, NULL, $q$https://www.curacaoliqueur.com/$q$, $q$producer$q$),
($q$Senior Kòfi Kòrsou$q$, NULL, $q$Coffee Liqueur$q$, $q$Senior & Co.$q$, NULL, $q$CW$q$, NULL, $q$https://www.curacaoliqueur.com/senior-liqueurs/specialty-liqueurs/kofi-korsou$q$, $q$producer$q$),
($q$Senior Orange Curaçao$q$, NULL, $q$Curaçao$q$, $q$Senior & Co.$q$, NULL, $q$CW$q$, NULL, $q$https://www.curacaoliqueur.com/senior-liqueurs/colored-cocktail-essentials/orange-curacao$q$, $q$producer$q$),
($q$Senior Rasenchi Curaçao$q$, NULL, $q$Liqueur$q$, $q$Senior & Co.$q$, NULL, $q$CW$q$, NULL, $q$https://www.curacaoliqueur.com/senior-liqueurs/specialty-liqueurs/rasenchi-curacao$q$, $q$producer$q$),
($q$Senior Red & Green Curaçao$q$, NULL, $q$Curaçao$q$, $q$Senior & Co.$q$, NULL, $q$CW$q$, NULL, $q$https://www.curacaoliqueur.com/senior-liqueurs/colored-cocktail-essentials/red-green-curacao$q$, $q$producer$q$),
($q$Senior Tamarèin$q$, NULL, $q$Liqueur$q$, $q$Senior & Co.$q$, NULL, $q$CW$q$, NULL, $q$https://www.curacaoliqueur.com/senior-liqueurs/specialty-liqueurs/tamarein$q$, $q$producer$q$),
($q$Shanky's Whip$q$, $q$Shanky's Whip$q$, $q$Irish Whisky Liqueur$q$, $q$Shanky's Whip$q$, 33, $q$IE$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/7410/shankys-whip$q$, $q$reference$q$),
($q$Sheridan's Coffee Layered Liqueur$q$, $q$Sheridan's$q$, $q$Cream Liqueur$q$, $q$Sheridan's$q$, 15.5, $q$IE$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/8379/sheridans-coffee-liqueur$q$, $q$reference$q$),
($q$Sipsmith Sloe Gin$q$, $q$Sipsmith Sloe Gin$q$, $q$Sloe Gin$q$, $q$Sipsmith$q$, 29, $q$GB$q$, NULL, $q$https://www.sipsmith.com/products/sloe-gin$q$, $q$producer$q$),
($q$Skinos Mastiha$q$, $q$Skinos Mastiha$q$, $q$Mastiha$q$, $q$Skinos$q$, 30, $q$GR$q$, NULL, $q$https://specsonline.com/shop/spirits/skinos-mastiha-spirit-6/$q$, $q$retailer$q$),
($q$Soho Lychee Liqueur$q$, $q$Soho Lychee Liqueur$q$, $q$Lychee Liqueur$q$, $q$Soho$q$, 21, $q$FR$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/185/soho-lychee-liqueur$q$, $q$reference$q$),
($q$Solerno Blood Orange Liqueur$q$, $q$Solerno$q$, $q$Blood Orange Liqueur$q$, $q$Solerno$q$, 27.5, $q$IT$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/2269/solerno-liqueur$q$, $q$reference$q$),
($q$Sortilège Bleuets Sauvages$q$, NULL, $q$Blueberry Liqueur$q$, $q$Sortilège$q$, NULL, $q$CA$q$, NULL, $q$https://www.kanata.fr/gb/sortilege-liqueur-de-bleuets-sauvages-avec-whisky-canadien-et-sirop-derable-750ml-2143-.html$q$, $q$retailer$q$),
($q$Sortilège Crème d'Érable$q$, NULL, $q$Cream Liqueur$q$, $q$Sortilège$q$, NULL, $q$CA$q$, NULL, $q$https://www.kanata.fr/gb/sortilege-creme-d-erable-boisson-au-sirop-et-wisky-d-erable-750-ml-1605-.html$q$, $q$retailer$q$),
($q$Sortilège Prestige$q$, NULL, $q$Whiskey Liqueur$q$, $q$Sortilège$q$, NULL, $q$CA$q$, NULL, $q$https://www.kanata.fr/gb/sortilege-prestige-7-year-old-canadian-whisky-1607-.html$q$, $q$retailer$q$),
($q$Sour Puss Raspberry$q$, NULL, $q$Raspberry Liqueur$q$, $q$Sour Puss$q$, 15, $q$US$q$, NULL, $q$https://www.lcbo.com/en/sour-puss-raspberry-liquor-518670$q$, $q$retailer$q$),
($q$Sourz Apple$q$, $q$Sourz Apple$q$, $q$Sour Apple Liqueur$q$, $q$Sourz$q$, 15, $q$ES$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/184/sourz-spirited-apple$q$, $q$reference$q$),
($q$Southern Comfort 100$q$, NULL, $q$Whiskey Liqueur$q$, $q$Southern Comfort$q$, NULL, $q$US$q$, NULL, $q$https://www.southerncomfort.com/products/100.html$q$, $q$producer$q$),
($q$Southern Comfort Black$q$, NULL, $q$Whiskey Liqueur$q$, $q$Southern Comfort$q$, NULL, $q$US$q$, NULL, $q$https://www.southerncomfort.com/products/black.html$q$, $q$producer$q$),
($q$Southern Comfort Original$q$, $q$Southern Comfort$q$, $q$Whiskey Liqueur$q$, $q$Southern Comfort$q$, NULL, $q$US$q$, NULL, $q$https://www.southerncomfort.com/products/original.html$q$, $q$producer$q$),
($q$St-Germain$q$, $q$St-Germain$q$, $q$Elderflower Liqueur$q$, $q$St-Germain$q$, 20, $q$FR$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/liqueurs-alc-cordials/floral-liqueurs/BWS000182/st-germain-elderflower-liqueur$q$, $q$reference$q$),
($q$St. Elizabeth Allspice Dram$q$, $q$St. Elizabeth Allspice Dram$q$, $q$Allspice Dram$q$, $q$St. Elizabeth$q$, 22.5, $q$AT$q$, NULL, $q$https://alpenz.com/producer-purkhart.html$q$, $q$producer$q$),
($q$St. George NOLA Coffee Liqueur$q$, $q$St. George NOLA Coffee Liqueur$q$, $q$Coffee Liqueur$q$, $q$St. George Spirits$q$, 25, $q$US$q$, NULL, $q$https://stgeorgespirits.com/spirits/nola-coffee-liqueur$q$, $q$producer$q$),
($q$St. George Spiced Pear Liqueur$q$, $q$St. George Spiced Pear Liqueur$q$, $q$Spiced Pear Liqueur$q$, $q$St. George Spirits$q$, 20, $q$US$q$, NULL, $q$https://stgeorgespirits.com/spirits/spiced-pear-liqueur$q$, $q$producer$q$),
($q$Liquore Strega$q$, $q$Strega$q$, $q$Herbal Liqueur$q$, $q$Strega$q$, 40, $q$IT$q$, NULL, $q$https://www.strega.it/liquore-strega/$q$, $q$producer$q$),
($q$Tempus Fugit Crème de Banane$q$, $q$Tempus Fugit Crème de Banane$q$, $q$Banana Liqueur$q$, $q$Tempus Fugit Spirits$q$, 26, NULL, NULL, $q$https://www.tempusfugitspirits.com/products/creme-de-banane/$q$, $q$producer$q$),
($q$Tempus Fugit Crème de Cacao$q$, $q$Tempus Fugit Crème de Cacao$q$, $q$Crème de Cacao$q$, $q$Tempus Fugit Spirits$q$, 24, NULL, NULL, $q$https://www.tempusfugitspirits.com/products/creme-de-cacao/$q$, $q$producer$q$),
($q$Tempus Fugit Crème de Menthe Glaciale$q$, $q$Tempus Fugit Crème de Menthe$q$, $q$Crème de Menthe$q$, $q$Tempus Fugit Spirits$q$, 28, NULL, NULL, $q$https://www.tempusfugitspirits.com/products/creme-de-menthe-glaciale/$q$, $q$producer$q$),
($q$Tempus Fugit Crème de Moka$q$, NULL, $q$Coffee Liqueur$q$, $q$Tempus Fugit Spirits$q$, 25, NULL, NULL, $q$https://www.tempusfugitspirits.com/products/creme-de-moka/$q$, $q$producer$q$),
($q$Tempus Fugit Crème de Noyaux$q$, $q$Tempus Fugit Crème de Noyaux$q$, $q$Crème de Noyaux$q$, $q$Tempus Fugit Spirits$q$, 30, NULL, NULL, $q$https://www.tempusfugitspirits.com/products/creme-de-noyaux/$q$, $q$producer$q$),
($q$Tempus Fugit Liqueur de Violettes$q$, $q$Tempus Fugit Crème de Violette$q$, $q$Crème de Violette$q$, $q$Tempus Fugit Spirits$q$, 22, $q$CH$q$, NULL, $q$https://www.tempusfugitspirits.com/products/liqueur-de-violettes/$q$, $q$producer$q$),
($q$The Bitter Truth Apricot Liqueur$q$, NULL, $q$Apricot Liqueur$q$, $q$The Bitter Truth$q$, 22, $q$DE$q$, NULL, $q$https://the-bitter-truth.com/liqueurs-spirits/apricot-liqueur/$q$, $q$producer$q$),
($q$The Bitter Truth Elderflower Liqueur$q$, NULL, $q$Elderflower Liqueur$q$, $q$The Bitter Truth$q$, 22, $q$DE$q$, NULL, $q$https://the-bitter-truth.com/liqueurs-spirits/elderflower-liqueur/$q$, $q$producer$q$),
($q$The Bitter Truth Golden Falernum$q$, $q$The Bitter Truth Golden Falernum$q$, $q$Falernum$q$, $q$The Bitter Truth$q$, 18, $q$DE$q$, NULL, $q$https://the-bitter-truth.com/liqueurs-spirits/golden-falernum/$q$, $q$producer$q$),
($q$The Bitter Truth Pimento Dram$q$, $q$The Bitter Truth Pimento Dram$q$, $q$Allspice Dram$q$, $q$The Bitter Truth$q$, 22, $q$DE$q$, NULL, $q$https://the-bitter-truth.com/liqueurs-spirits/pimento-dram/$q$, $q$producer$q$),
($q$The Bitter Truth Violet Liqueur$q$, $q$The Bitter Truth Violet Liqueur$q$, $q$Crème de Violette$q$, $q$The Bitter Truth$q$, 22, $q$DE$q$, NULL, $q$https://the-bitter-truth.com/liqueurs-spirits/violet-liqueur/$q$, $q$producer$q$),
($q$Boatyard Sloe Boat Gin$q$, $q$Boatyard Sloe Boat$q$, $q$Sloe Gin$q$, $q$The Boatyard Distillery$q$, 29.8, $q$GB$q$, NULL, $q$https://www.theginguild.com/ginopedia/gin-brands/boatyard-sloe-boat-gin/$q$, $q$reference$q$),
($q$The King's Ginger$q$, $q$The King's Ginger$q$, $q$Ginger Liqueur$q$, $q$The King's Ginger$q$, NULL, $q$GB$q$, NULL, $q$https://www.thekingsginger.com/faqs$q$, $q$producer$q$),
($q$Tia Maria$q$, $q$Tia Maria Coffee Liqueur$q$, $q$Coffee Liqueur$q$, $q$Tia Maria$q$, 20, $q$IT$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/1210/tia-maria-liqueur$q$, $q$reference$q$),
($q$Toschi Fragolì$q$, NULL, $q$Strawberry Liqueur$q$, $q$Toschi$q$, NULL, $q$IT$q$, NULL, $q$https://www.toschi.it/en/fragoli-toschi/$q$, $q$producer$q$),
($q$Toschi Lemoncello$q$, NULL, $q$Limoncello$q$, $q$Toschi$q$, NULL, $q$IT$q$, NULL, $q$https://www.toschi.it/en/il-lemoncello-toschi/$q$, $q$producer$q$),
($q$Toschi Mirtillì$q$, NULL, $q$Blueberry Liqueur$q$, $q$Toschi$q$, NULL, $q$IT$q$, NULL, $q$https://www.toschi.it/en/fragoli-toschi/$q$, $q$producer$q$),
($q$Toschi Nocello$q$, NULL, $q$Hazelnut Liqueur$q$, $q$Toschi$q$, NULL, $q$IT$q$, NULL, $q$https://www.toschi.it/en/nocello-toschi/$q$, $q$producer$q$),
($q$Toschi Nocino di Modena$q$, $q$Toschi Nocino$q$, $q$Nocino$q$, $q$Toschi$q$, NULL, $q$IT$q$, NULL, $q$https://www.toschi.it/en/nocino-di-modena-toschi/$q$, $q$producer$q$),
($q$Tuaca$q$, $q$Tuaca$q$, $q$Vanilla Liqueur$q$, $q$Tuaca$q$, 35, $q$IT$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/174/tuaca-liqueur$q$, $q$reference$q$),
($q$Umenoyado Aragoshi Ginger$q$, NULL, $q$Ginger Liqueur$q$, $q$Umenoyado$q$, NULL, $q$JP$q$, NULL, $q$https://www.umenoyado.com/en/products/aragoshi-ginger/$q$, $q$producer$q$),
($q$Umenoyado Aragoshi Lemon$q$, NULL, $q$Citrus Liqueur$q$, $q$Umenoyado$q$, NULL, $q$JP$q$, NULL, $q$https://www.umenoyado.com/en/products/aragoshi-lemon/$q$, $q$producer$q$),
($q$Umenoyado Aragoshi Mikan$q$, NULL, $q$Mandarin Liqueur$q$, $q$Umenoyado$q$, NULL, $q$JP$q$, NULL, $q$https://www.umenoyado.com/en/products/aragoshi-mikan/$q$, $q$producer$q$),
($q$Umenoyado Aragoshi Mikku-shu$q$, NULL, $q$Liqueur$q$, $q$Umenoyado$q$, NULL, $q$JP$q$, NULL, $q$https://www.umenoyado.com/en/products/aragoshi-mikku-shu/$q$, $q$producer$q$),
($q$Umenoyado Aragoshi Momo$q$, NULL, $q$Peach Liqueur$q$, $q$Umenoyado$q$, NULL, $q$JP$q$, NULL, $q$https://www.umenoyado.com/en/products/aragoshi-momo/$q$, $q$producer$q$),
($q$Umenoyado Aragoshi Pineapple$q$, NULL, $q$Pineapple Liqueur$q$, $q$Umenoyado$q$, NULL, $q$JP$q$, NULL, $q$https://www.umenoyado.com/en/products/aragoshi-pineapple/$q$, $q$producer$q$),
($q$Umenoyado Aragoshi Ringo$q$, NULL, $q$Apple Liqueur$q$, $q$Umenoyado$q$, NULL, $q$JP$q$, NULL, $q$https://www.umenoyado.com/en/products/aragoshi-ringo/$q$, $q$producer$q$),
($q$Umenoyado Aragoshi Umeshu$q$, $q$Umenoyado Aragoshi Umeshu$q$, $q$Umeshu$q$, $q$Umenoyado$q$, 12, $q$JP$q$, NULL, $q$https://www.umenoyado.com/en/products/aragoshi-umeshu/$q$, $q$producer$q$),
($q$Umenoyado Aragoshi Yuzu$q$, $q$Umenoyado Yuzushu$q$, $q$Yuzushu$q$, $q$Umenoyado$q$, NULL, $q$JP$q$, NULL, $q$https://www.umenoyado.com/en/products/aragoshi-yuzu/$q$, $q$producer$q$),
($q$Umenoyado Umeshu Black-tea$q$, NULL, $q$Umeshu$q$, $q$Umenoyado$q$, NULL, $q$JP$q$, NULL, $q$https://www.umenoyado.com/en/products/umenoyado-umeshu-black-tea/$q$, $q$producer$q$),
($q$Umenoyado Umeshu Rose$q$, NULL, $q$Umeshu$q$, $q$Umenoyado$q$, NULL, $q$JP$q$, NULL, $q$https://www.umenoyado.com/en/products/umenoyado-umeshu-rose/$q$, $q$producer$q$),
($q$Umenoyado no Umeshu$q$, NULL, $q$Umeshu$q$, $q$Umenoyado$q$, NULL, $q$JP$q$, NULL, $q$https://www.umenoyado.com/en/products/umenoyado-no-umeshu/$q$, $q$producer$q$),
($q$Umenoyado no Umeshu Kuro Label$q$, NULL, $q$Umeshu$q$, $q$Umenoyado$q$, NULL, $q$JP$q$, NULL, $q$https://www.umenoyado.com/en/products/umenoyado-no-umeshu-kuro-label/$q$, $q$producer$q$),
($q$Villa Massa Amaretto$q$, NULL, $q$Amaretto$q$, $q$Villa Massa$q$, NULL, $q$IT$q$, NULL, $q$https://villamassa.com/amaretto/$q$, $q$producer$q$),
($q$Villa Massa Limoncello$q$, $q$Villa Massa Limoncello$q$, $q$Limoncello$q$, $q$Villa Massa$q$, NULL, $q$IT$q$, NULL, $q$https://villamassa.com/limoncello/$q$, $q$producer$q$),
($q$Vok Advokaat$q$, NULL, $q$Advocaat$q$, $q$Vok$q$, NULL, $q$AU$q$, NULL, $q$https://vokliqueurs.com.au/advokaat$q$, $q$producer$q$),
($q$Vok Banana$q$, $q$Vok Banana Liqueur$q$, $q$Banana Liqueur$q$, $q$Vok$q$, NULL, $q$AU$q$, NULL, $q$https://vokliqueurs.com.au/banana$q$, $q$producer$q$),
($q$Vok Blue Curaçao$q$, NULL, $q$Blue Curaçao$q$, $q$Vok$q$, NULL, $q$AU$q$, NULL, $q$https://vokliqueurs.com.au/blue-curacao$q$, $q$producer$q$),
($q$Vok Brown Crème de Cacao$q$, NULL, $q$Dark Crème de Cacao$q$, $q$Vok$q$, NULL, $q$AU$q$, NULL, $q$https://vokliqueurs.com.au/brown-creme-de-cacao$q$, $q$producer$q$),
($q$Vok Butterscotch Schnapps$q$, NULL, $q$Butterscotch Schnapps$q$, $q$Vok$q$, NULL, $q$AU$q$, NULL, $q$https://vokliqueurs.com.au/butterscotch-schnapps$q$, $q$producer$q$),
($q$Vok Cherry Brandy$q$, NULL, $q$Cherry Brandy$q$, $q$Vok$q$, NULL, $q$AU$q$, NULL, $q$https://vokliqueurs.com.au/cherry-brandy$q$, $q$producer$q$),
($q$Vok Coffee$q$, NULL, $q$Coffee Liqueur$q$, $q$Vok$q$, NULL, $q$AU$q$, NULL, $q$https://vokliqueurs.com.au/coffee$q$, $q$producer$q$),
($q$Vok Crème de Menthe$q$, NULL, $q$Crème de Menthe$q$, $q$Vok$q$, NULL, $q$AU$q$, NULL, $q$https://vokliqueurs.com.au/creme-de-menthe$q$, $q$producer$q$),
($q$Vok Lychee$q$, NULL, $q$Lychee Liqueur$q$, $q$Vok$q$, NULL, $q$AU$q$, NULL, $q$https://vokliqueurs.com.au/lychee$q$, $q$producer$q$),
($q$Vok Melon$q$, $q$Vok Melon Liqueur$q$, $q$Melon Liqueur$q$, $q$Vok$q$, NULL, $q$AU$q$, NULL, $q$https://vokliqueurs.com.au/melon$q$, $q$producer$q$),
($q$Vok Parfait Amour$q$, NULL, $q$Parfait Amour$q$, $q$Vok$q$, NULL, $q$AU$q$, NULL, $q$https://vokliqueurs.com.au/parfait-amour$q$, $q$producer$q$),
($q$Vok Passionfruit$q$, NULL, $q$Passion Fruit Liqueur$q$, $q$Vok$q$, NULL, $q$AU$q$, NULL, $q$https://vokliqueurs.com.au/passionfruit$q$, $q$producer$q$),
($q$Vok Peach$q$, NULL, $q$Peach Liqueur$q$, $q$Vok$q$, NULL, $q$AU$q$, NULL, $q$https://vokliqueurs.com.au/peach$q$, $q$producer$q$),
($q$Vok Triple Sec$q$, NULL, $q$Triple Sec$q$, $q$Vok$q$, NULL, $q$AU$q$, NULL, $q$https://vokliqueurs.com.au/triple-sec$q$, $q$producer$q$),
($q$Vok White Crème de Cacao$q$, NULL, $q$White Crème de Cacao$q$, $q$Vok$q$, NULL, $q$AU$q$, NULL, $q$https://vokliqueurs.com.au/white-creme-de-cacao$q$, $q$producer$q$),
($q$Walcher Amaretto BIO$q$, NULL, $q$Amaretto$q$, $q$Walcher$q$, NULL, $q$IT$q$, NULL, $q$https://www.walcher.eu/en/products/p-estates-distillery/p/amaretto-bio_191$q$, $q$producer$q$),
($q$Walcher Apricot$q$, NULL, $q$Apricot Liqueur$q$, $q$Walcher$q$, NULL, $q$IT$q$, NULL, $q$https://www.walcher.eu/en/products/p-estates-distillery/p/apricot_131$q$, $q$producer$q$),
($q$Walcher Blueberry$q$, NULL, $q$Blueberry Liqueur$q$, $q$Walcher$q$, NULL, $q$IT$q$, NULL, $q$https://www.walcher.eu/en/products/p-estates-distillery/p/blueberry_127$q$, $q$producer$q$),
($q$Walcher Bombardino$q$, NULL, $q$Egg Liqueur$q$, $q$Walcher$q$, NULL, $q$IT$q$, NULL, $q$https://www.walcher.eu/en/products/p-estates-distillery/p/bombardino_101$q$, $q$producer$q$),
($q$Walcher Butterscotch$q$, NULL, $q$Butterscotch Liqueur$q$, $q$Walcher$q$, NULL, $q$IT$q$, NULL, $q$https://www.walcher.eu/en/products/p-estates-distillery/p/butterscotch_232$q$, $q$producer$q$),
($q$Walcher Coffee Premium$q$, NULL, $q$Coffee Liqueur$q$, $q$Walcher$q$, NULL, $q$IT$q$, NULL, $q$https://www.walcher.eu/en/products/p-estates-distillery/p/coffee-premium_199$q$, $q$producer$q$),
($q$Walcher Elderflower$q$, NULL, $q$Elderflower Liqueur$q$, $q$Walcher$q$, NULL, $q$IT$q$, NULL, $q$https://www.walcher.eu/en/products/p-estates-distillery/p/elderflower_143$q$, $q$producer$q$),
($q$Walcher Limoncello Gran Gourmet$q$, NULL, $q$Limoncello$q$, $q$Walcher$q$, NULL, $q$IT$q$, NULL, $q$https://www.walcher.eu/en/products/p-estates-distillery/p/limoncello-gran-gourmet_134$q$, $q$producer$q$),
($q$Walcher Mountain Mint BIO$q$, NULL, $q$Crème de Menthe$q$, $q$Walcher$q$, NULL, $q$IT$q$, NULL, $q$https://www.walcher.eu/en/products/p-estates-distillery/p/mountain-mint-bio_184$q$, $q$producer$q$),
($q$Walcher Noisetto with Rum$q$, $q$Walcher Niosette$q$, $q$Hazelnut Liqueur$q$, $q$Walcher$q$, NULL, $q$IT$q$, NULL, $q$https://www.walcher.eu/en/products/p-estates-distillery/p/noisetto-with-rum_125$q$, $q$producer$q$),
($q$Walcher Pistachio Cream Liqueur$q$, NULL, $q$Cream Liqueur$q$, $q$Walcher$q$, NULL, $q$IT$q$, NULL, $q$https://www.walcher.eu/en/products/p-estates-distillery/p/pistachio-cream-liqueur_212$q$, $q$producer$q$),
($q$Walcher Prugna$q$, NULL, $q$Plum Liqueur$q$, $q$Walcher$q$, NULL, $q$IT$q$, NULL, $q$https://www.walcher.eu/en/products/p-estates-distillery/p/prugna-plum_120$q$, $q$producer$q$),
($q$Walcher Sambuca BIO$q$, NULL, $q$Sambuca$q$, $q$Walcher$q$, NULL, $q$IT$q$, NULL, $q$https://www.walcher.eu/en/products/p-estates-distillery/p/sambuca-bio_119$q$, $q$producer$q$),
($q$Walcher South Tyrolean Stone Pine$q$, NULL, $q$Alpine Liqueur$q$, $q$Walcher$q$, NULL, $q$IT$q$, NULL, $q$https://www.walcher.eu/en/products/p-estates-distillery/p/south-tyrolean-stone-pine_187$q$, $q$producer$q$),
($q$Walcher Walnut$q$, $q$Walcher Nocino$q$, $q$Nocino$q$, $q$Walcher$q$, NULL, $q$IT$q$, NULL, $q$https://www.walcher.eu/en/products/p-estates-distillery/p/walnut_123$q$, $q$producer$q$),
($q$Warninks Advocaat$q$, $q$Warninks Advocaat$q$, $q$Advocaat$q$, $q$Warninks$q$, 17.2, $q$NL$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/1124/warninks-advocaat-liqueur$q$, $q$reference$q$),
($q$Zoco Pacharán Navarro$q$, $q$Pacharán Zoco$q$, $q$Pacharán$q$, $q$Zoco$q$, 25, $q$ES$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/153/zoco-pacharan$q$, $q$reference$q$);

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
    WHEN b.style IN ($q$Liqueur$q$) AND EXISTS (
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
