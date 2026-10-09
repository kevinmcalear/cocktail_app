-- Vermouth, aperitif wines, amari and bitter aperitivi: every bottle checked
-- on its producer's own page (or, where that page was blocked, a major
-- retailer, importer or Difford's), after 20261011152100. Step 3a of the
-- bottle catalog plan: https://claude.ai/artifact/Vu6seuSNtN42nKYb2nDCVR
--
--   * 301 checked bottles from 107 producers. On a copy of production
--     (2026-10-09): 148 new bottles, and 152 we had that get their label
--     name (61 renamed, the old name kept as an alias), style, ABV, country
--     and protected name (Vermouth di Torino) where they were missing or
--     wrong. Different expressions stay different bottles. A bottle filed as
--     sweet or dry keeps its colour when the producer's page doesn't say.
--   * Each producer gets an unclaimed maker page (makes: bottles), and each
--     bottle names it. Brand houses that belong to another (Alessio to Tempus
--     Fugit Spirits, Bèrto to Quaglia) say so.
--   * Every fact keeps the page it was checked on in item_sources.
--   * An independent second check of 100 random rows found 4 wrong facts in
--     482 (0.8%), all a brand named where the parent house was meant; the
--     brand house is the maker page here, so none needed changing. Its five
--     stricter style calls are taken.
--
-- Matched by name key; rows that don't exist are skipped and a second run
-- changes nothing more. Venue ingredients aren't touched. Other copies the
-- check spotted (two catalog names for one bottle) are listed on the review
-- sheet, not merged here.

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

-- ---------------------------------------------------------------------------
-- Maker pages
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE maker_in (name text PRIMARY KEY, handle text NOT NULL, website text, country text, part_of text);
INSERT INTO maker_in VALUES
($q$9diDANTE$q$, $q$9didante$q$, $q$https://www.9didante.com$q$, $q$IT$q$, NULL),
($q$A.A. Badenhorst$q$, $q$a.a.badenhorst$q$, NULL, $q$ZA$q$, NULL),
($q$Adelaide Hills Distillery$q$, $q$adelaide.hills.distillery$q$, NULL, $q$AU$q$, NULL),
($q$Alessio$q$, $q$alessio$q$, $q$https://www.tempusfugitspirits.com$q$, NULL, $q$Tempus Fugit Spirits$q$),
($q$Amaro dell'Etna$q$, $q$amaro.dell.etna$q$, $q$https://amarodelletna.it/$q$, $q$IT$q$, NULL),
($q$Angostura$q$, $q$angostura$q$, $q$https://angosturabitters.com$q$, NULL, NULL),
($q$Aperol$q$, $q$aperol$q$, $q$https://www.aperol.com$q$, $q$IT$q$, NULL),
($q$Asterley Bros$q$, $q$asterley.bros$q$, $q$https://asterleybros.com$q$, $q$GB$q$, NULL),
($q$Averna$q$, $q$averna$q$, $q$https://www.amaroaverna.com$q$, $q$IT$q$, NULL),
($q$Beechworth Bitters$q$, $q$beechworth.bitters$q$, $q$https://www.beechworthbitters.com$q$, $q$AU$q$, NULL),
($q$Bepi Tosolini$q$, $q$bepi.tosolini$q$, NULL, $q$IT$q$, NULL),
($q$Bigallet$q$, $q$bigallet$q$, $q$https://www.bigallet.fr/$q$, $q$FR$q$, NULL),
($q$Bisleri$q$, $q$bisleri$q$, NULL, $q$IT$q$, NULL),
($q$Bonal$q$, $q$bonal$q$, NULL, $q$FR$q$, NULL),
($q$Bordiga$q$, $q$bordiga$q$, $q$https://bordiga1888.it/$q$, $q$IT$q$, NULL),
($q$Braulio$q$, $q$braulio$q$, $q$https://www.amarobraulio.com$q$, $q$IT$q$, NULL),
($q$Byrrh$q$, $q$byrrh$q$, NULL, $q$FR$q$, NULL),
($q$Bèrto$q$, $q$berto$q$, $q$https://distilleriaquaglia.it$q$, $q$IT$q$, $q$Quaglia$q$),
($q$Caffo$q$, $q$caffo$q$, $q$https://www.vecchioamarodelcapo.com$q$, NULL, NULL),
($q$Calissano$q$, $q$calissano$q$, $q$https://www.gruppoitalianovini.it/it/brand/calissano$q$, $q$IT$q$, NULL),
($q$Campari$q$, $q$campari$q$, $q$https://www.campari.com$q$, $q$IT$q$, NULL),
($q$Cappelletti$q$, $q$cappelletti$q$, NULL, $q$IT$q$, NULL),
($q$Carpano$q$, $q$carpano$q$, $q$https://carpano.com$q$, $q$IT$q$, NULL),
($q$Casa Mariol$q$, $q$casa.mariol$q$, $q$https://www.casamariol.com$q$, NULL, NULL),
($q$Casoni$q$, $q$casoni$q$, NULL, $q$IT$q$, NULL),
($q$Chazalettes$q$, $q$chazalettes$q$, $q$https://chazalettes.com$q$, $q$IT$q$, NULL),
($q$Cinzano$q$, $q$cinzano$q$, $q$https://www.cinzano.com$q$, $q$IT$q$, NULL),
($q$Cocchi$q$, $q$cocchi$q$, $q$https://www.cocchi.it$q$, $q$IT$q$, NULL),
($q$Contratto$q$, $q$contratto$q$, $q$https://www.contratto.it$q$, $q$IT$q$, NULL),
($q$Cynar$q$, $q$cynar$q$, NULL, $q$IT$q$, NULL),
($q$Del Professore$q$, $q$del.professore$q$, $q$https://www.delprofessore.com$q$, $q$IT$q$, NULL),
($q$DelMago$q$, $q$delmago$q$, NULL, $q$IT$q$, NULL),
($q$Discarded$q$, $q$discarded$q$, NULL, $q$GB$q$, NULL),
($q$Distillerie de Grandmont$q$, $q$distillerie.de.grandmont$q$, NULL, $q$FR$q$, NULL),
($q$Distilleries et Domaines de Provence$q$, $q$distilleries.et.domaines.de.pr$q$, $q$https://www.distilleries-provence.com$q$, $q$FR$q$, NULL),
($q$Doghouse$q$, $q$doghouse$q$, NULL, $q$GB$q$, NULL),
($q$Dolin$q$, $q$dolin$q$, $q$https://www.dolin.fr$q$, $q$FR$q$, NULL),
($q$Dubonnet$q$, $q$dubonnet$q$, NULL, $q$FR$q$, NULL),
($q$El Bandarra$q$, $q$el.bandarra$q$, $q$https://www.elbandarra.com/$q$, NULL, NULL),
($q$Esquimalt$q$, $q$esquimalt$q$, $q$https://esquimaltvermouth.ca$q$, $q$CA$q$, NULL),
($q$Foro$q$, $q$foro$q$, NULL, $q$IT$q$, NULL),
($q$Forthave Spirits$q$, $q$forthave.spirits$q$, NULL, NULL, NULL),
($q$Fratelli Branca$q$, $q$fratelli.branca$q$, $q$https://www.fernetbranca.com$q$, $q$IT$q$, NULL),
($q$Galliano$q$, $q$galliano$q$, $q$https://galliano.com/$q$, NULL, NULL),
($q$Gancia$q$, $q$gancia$q$, $q$https://www.gancia.it$q$, $q$IT$q$, NULL),
($q$Heirloom$q$, $q$heirloom$q$, $q$https://heirloomliqueurs.com$q$, NULL, NULL),
($q$Jefferson$q$, $q$jefferson$q$, NULL, $q$IT$q$, NULL),
($q$Joseph Cartron$q$, $q$joseph.cartron$q$, NULL, $q$FR$q$, NULL),
($q$L.N. Mattei$q$, $q$l.n.mattei$q$, NULL, $q$FR$q$, NULL),
($q$La Quintinye$q$, $q$la.quintinye$q$, $q$https://maisonvillevert.com$q$, $q$FR$q$, NULL),
($q$Lazzaroni$q$, $q$lazzaroni$q$, $q$https://www.lazzaroni.it$q$, NULL, NULL),
($q$Leopold Bros.$q$, $q$leopold.bros$q$, $q$https://www.leopoldbros.com$q$, NULL, NULL),
($q$Letherbee$q$, $q$letherbee$q$, $q$https://www.letherbee.com$q$, $q$US$q$, NULL),
($q$Lillet$q$, $q$lillet$q$, $q$https://www.lillet.com$q$, $q$FR$q$, NULL),
($q$Lo-Fi$q$, $q$lo.fi$q$, $q$https://www.lofiaperitifs.com$q$, $q$US$q$, NULL),
($q$Lucano$q$, $q$lucano$q$, $q$https://www.amarolucano.it$q$, $q$IT$q$, NULL),
($q$Lustau$q$, $q$lustau$q$, $q$https://lustau.es$q$, $q$ES$q$, NULL),
($q$Luxardo$q$, $q$luxardo$q$, $q$https://www.luxardo.it/$q$, NULL, NULL),
($q$Maidenii$q$, $q$maidenii$q$, $q$https://maidenii.com.au/$q$, $q$AU$q$, NULL),
($q$Mancino$q$, $q$mancino$q$, $q$https://mancinovermouth.com$q$, $q$IT$q$, NULL),
($q$Marionette$q$, $q$marionette$q$, NULL, $q$AU$q$, NULL),
($q$Martini$q$, $q$martini$q$, $q$https://www.martini.com$q$, NULL, NULL),
($q$Martínez Lacuesta$q$, $q$martinez.lacuesta$q$, $q$https://martinezlacuesta.com$q$, $q$ES$q$, NULL),
($q$Maurin$q$, $q$maurin$q$, NULL, $q$FR$q$, NULL),
($q$Meletti$q$, $q$meletti$q$, $q$https://www.meletti.it$q$, $q$IT$q$, NULL),
($q$Mondino$q$, $q$mondino$q$, NULL, $q$DE$q$, NULL),
($q$Montenegro$q$, $q$montenegro$q$, $q$https://www.amaromontenegro.com$q$, NULL, NULL),
($q$Mr Black$q$, $q$mr.black$q$, $q$https://www.mrblack.co$q$, $q$AU$q$, NULL),
($q$Nardini$q$, $q$nardini$q$, $q$https://www.nardini.it$q$, $q$IT$q$, NULL),
($q$Neumeister$q$, $q$neumeister$q$, $q$https://www.neumeister.cc$q$, $q$AT$q$, NULL),
($q$Noilly Prat$q$, $q$noilly.prat$q$, $q$https://www.noillyprat.com$q$, $q$FR$q$, NULL),
($q$Nonino$q$, $q$nonino$q$, $q$https://www.grappanonino.it$q$, $q$IT$q$, NULL),
($q$Oscar.697$q$, $q$oscar.697$q$, $q$https://www.oscar697.com$q$, $q$IT$q$, NULL),
($q$Otto's$q$, $q$otto.s$q$, NULL, $q$GR$q$, NULL),
($q$Pampelle$q$, $q$pampelle$q$, $q$https://pampelle.com$q$, NULL, NULL),
($q$Paolucci$q$, $q$paolucci$q$, NULL, $q$IT$q$, NULL),
($q$Peychaud's$q$, $q$peychaud.s$q$, NULL, $q$IT$q$, NULL),
($q$Picon$q$, $q$picon$q$, NULL, $q$FR$q$, NULL),
($q$Poli$q$, $q$poli$q$, $q$https://www.poligrappa.com$q$, $q$IT$q$, NULL),
($q$Quaglia$q$, $q$quaglia$q$, $q$https://distilleriaquaglia.it$q$, $q$IT$q$, NULL),
($q$Ramazzotti$q$, $q$ramazzotti$q$, $q$https://pernod-ricard.com/en/brands/ramazzotti$q$, $q$IT$q$, NULL),
($q$Regal Rogue$q$, $q$regal.rogue$q$, $q$https://regalrogue.com$q$, $q$AU$q$, NULL),
($q$Rinomato$q$, $q$rinomato$q$, NULL, $q$IT$q$, NULL),
($q$Sacred$q$, $q$sacred$q$, $q$https://sacredgin.com$q$, $q$GB$q$, NULL),
($q$Salers$q$, $q$salers$q$, NULL, $q$FR$q$, NULL),
($q$Santoni$q$, $q$santoni$q$, $q$https://amarosantoni.com/$q$, $q$IT$q$, NULL),
($q$Sarti$q$, $q$sarti$q$, NULL, NULL, NULL),
($q$Savoia$q$, $q$savoia$q$, $q$https://casa-savoia.com/$q$, $q$IT$q$, NULL),
($q$Select$q$, $q$select$q$, $q$https://selectaperitivo.com$q$, NULL, NULL),
($q$Sipello$q$, $q$sipello$q$, $q$https://www.sipello.com/$q$, NULL, NULL),
($q$St Raphaël$q$, $q$st.raphael$q$, $q$https://www.straphael.fr$q$, $q$FR$q$, NULL),
($q$St. Agrestis$q$, $q$st.agrestis$q$, NULL, $q$US$q$, NULL),
($q$St. George$q$, $q$st.george$q$, $q$https://stgeorgespirits.com$q$, $q$US$q$, NULL),
($q$Stillgarden$q$, $q$stillgarden$q$, $q$https://stillgardendistillery.com$q$, $q$IE$q$, NULL),
($q$Strucchi$q$, $q$strucchi$q$, NULL, $q$IT$q$, NULL),
($q$Super Cattivo$q$, $q$super.cattivo$q$, NULL, NULL, NULL),
($q$Suze$q$, $q$suze$q$, NULL, $q$FR$q$, NULL),
($q$Tempus Fugit Spirits$q$, $q$tempus.fugit.spirits$q$, $q$https://www.tempusfugitspirits.com$q$, $q$CH$q$, NULL),
($q$Tosti$q$, $q$tosti$q$, $q$https://www.cardamaro.it$q$, $q$IT$q$, NULL),
($q$Valentia Island Vermouth$q$, $q$valentia.island.vermouth$q$, $q$https://valentiaislandvermouth.ie$q$, $q$IE$q$, NULL),
($q$Vallet$q$, $q$vallet$q$, NULL, $q$MX$q$, NULL),
($q$Varnelli$q$, $q$varnelli$q$, $q$https://www.varnelli.it$q$, NULL, NULL),
($q$Vault$q$, $q$vault$q$, $q$https://www.vaultaperitivo.com$q$, $q$GB$q$, NULL),
($q$Vergano$q$, $q$vergano$q$, NULL, $q$IT$q$, NULL),
($q$Vya$q$, $q$vya$q$, $q$https://vya.com$q$, NULL, NULL),
($q$Zucca$q$, $q$zucca$q$, NULL, $q$IT$q$, NULL),
($q$Zwack$q$, $q$zwack$q$, $q$https://zwackunicum.hu$q$, $q$HU$q$, NULL);

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
($q$9diDANTE Inferno$q$, $q$9 Di Dante Rosso$q$, $q$Sweet Vermouth$q$, $q$9diDANTE$q$, 17.5, $q$IT$q$, $q$Vermouth di Torino Superiore$q$, $q$https://www.9didante.com/en/products$q$, $q$producer$q$),
($q$9diDANTE Paradiso$q$, NULL, $q$Rosé Vermouth$q$, $q$9diDANTE$q$, 18, $q$IT$q$, NULL, $q$https://www.9didante.com/en/products$q$, $q$producer$q$),
($q$9diDANTE Purgatorio$q$, NULL, $q$Dry Vermouth$q$, $q$9diDANTE$q$, 18, $q$IT$q$, $q$Vermouth di Torino Superiore$q$, $q$https://www.9didante.com/en/products$q$, $q$producer$q$),
($q$Caperitif$q$, $q$Caperitif$q$, $q$Vermouth$q$, $q$A.A. Badenhorst$q$, 16, $q$ZA$q$, NULL, $q$https://www.skurnik.com/sku/caperitif/$q$, $q$retailer$q$),
($q$Adelaide Hills Distillery The Italian Bitter Orange Aperitif$q$, $q$Adelaide Hills Distillery Bitter Orange$q$, $q$Bitter Aperitivo$q$, $q$Adelaide Hills Distillery$q$, 20, $q$AU$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/6817/adelaide-hills-distillery-bitter-orange$q$, $q$reference$q$),
($q$Alessio Dry Vermouth$q$, NULL, $q$Dry Vermouth$q$, $q$Alessio$q$, 17, NULL, NULL, $q$https://www.tempusfugitspirits.com/products/alessio-dry-vermouth/$q$, $q$producer$q$),
($q$Alessio Vermouth Bianco$q$, $q$Alessio Vermouth Bianco$q$, $q$Bianco Vermouth$q$, $q$Alessio$q$, 18, NULL, NULL, $q$https://www.tempusfugitspirits.com/products/alessio-vermouth-bianco/$q$, $q$producer$q$),
($q$Alessio Vermouth Chinato$q$, NULL, $q$Vermouth$q$, $q$Alessio$q$, 16.5, NULL, NULL, $q$https://www.tempusfugitspirits.com/products/alessio-vermouth-chinato/$q$, $q$producer$q$),
($q$Alessio Vermouth di Torino Rosso$q$, $q$Alessio Vermouth di Torino Rosso$q$, $q$Sweet Vermouth$q$, $q$Alessio$q$, 17, NULL, $q$Vermouth di Torino$q$, $q$https://www.tempusfugitspirits.com/products/alessio-vermouth-di-torino-rosso/$q$, $q$producer$q$),
($q$Alessio Vino Chinato$q$, NULL, $q$Vino Amaro$q$, $q$Alessio$q$, 16.5, NULL, NULL, $q$https://www.tempusfugitspirits.com/products/alessio-vino-chinato/$q$, $q$producer$q$),
($q$Amaro dell'Etna$q$, $q$Amaro dell'Etna$q$, $q$Amaro$q$, $q$Amaro dell'Etna$q$, 29, $q$IT$q$, NULL, $q$https://amarodelletna.it/collections/amaro-delletna$q$, $q$producer$q$),
($q$Amaro dell'Etna Riserva 120 Anniversario$q$, NULL, $q$Amaro$q$, $q$Amaro dell'Etna$q$, 32, $q$IT$q$, NULL, $q$https://amarodelletna.it/collections/amaro-delletna$q$, $q$producer$q$),
($q$Amaro di Angostura$q$, $q$Amaro di Angostura$q$, $q$Amaro$q$, $q$Angostura$q$, NULL, NULL, NULL, $q$https://angosturabitters.com/portfolio/amaro-di-angostura/$q$, $q$producer$q$),
($q$Aperol$q$, $q$Aperol$q$, $q$Bittersweet Orange Aperitivo$q$, $q$Aperol$q$, NULL, $q$IT$q$, NULL, $q$https://www.aperol.com/$q$, $q$producer$q$),
($q$Asterley Bros Britannica Fernet$q$, $q$Asterley Bros Britannica Fernet$q$, $q$Fernet$q$, $q$Asterley Bros$q$, NULL, $q$GB$q$, NULL, $q$https://asterleybros.com/products/britannica-london-fernet$q$, $q$producer$q$),
($q$Asterley Bros Cunard Dry Vermouth$q$, NULL, $q$Dry Vermouth$q$, $q$Asterley Bros$q$, NULL, NULL, NULL, $q$https://asterleybros.com/products/limited-edition-cunard-dry-vermouth$q$, $q$producer$q$),
($q$Asterley Bros Dispense Amaro$q$, $q$Asterley Bros Dispense Amaro$q$, $q$Amaro$q$, $q$Asterley Bros$q$, NULL, $q$GB$q$, NULL, $q$https://asterleybros.com/products/dispense-modern-british-amaro$q$, $q$producer$q$),
($q$Asterley Bros Estate$q$, $q$Asterley Bros. Estate English Vermouth$q$, $q$Sweet Vermouth$q$, $q$Asterley Bros$q$, NULL, NULL, NULL, $q$https://asterleybros.com/products/estate-english-sweet-vermouth$q$, $q$producer$q$),
($q$Asterley Bros Rosé Vermouth$q$, NULL, $q$Rosé Vermouth$q$, $q$Asterley Bros$q$, 15, $q$GB$q$, NULL, $q$https://asterleybros.com/products/rose-vermouth$q$, $q$producer$q$),
($q$Asterley Bros Schofield's Dry Vermouth$q$, $q$Asterley Bros. Schofield's Dry Vermouth$q$, $q$Dry Vermouth$q$, $q$Asterley Bros$q$, NULL, $q$GB$q$, NULL, $q$https://asterleybros.com/products/schofields-english-dry-vermouth$q$, $q$producer$q$),
($q$Asterley Original$q$, NULL, $q$Bitter Aperitivo$q$, $q$Asterley Bros$q$, NULL, $q$GB$q$, NULL, $q$https://asterleybros.com/products/asterley-original-british-aperitivo$q$, $q$producer$q$),
($q$Amaro Averna$q$, $q$Averna Amaro Siciliano$q$, $q$Amaro$q$, $q$Averna$q$, NULL, $q$IT$q$, NULL, $q$https://www.amaroaverna.com/it/prodotto/$q$, $q$producer$q$),
($q$Beechworth Bitters A Walk in the Black Forest$q$, NULL, $q$Amaro$q$, $q$Beechworth Bitters$q$, NULL, $q$AU$q$, NULL, $q$https://www.beechworthbitters.com/shop/p/a-walk-in-the-black-forest$q$, $q$producer$q$),
($q$Beechworth Bitters Auric Vermouth$q$, NULL, $q$Vermouth$q$, $q$Beechworth Bitters$q$, NULL, $q$AU$q$, NULL, $q$https://www.beechworthbitters.com/shop/p/auric-vermouth$q$, $q$producer$q$),
($q$Beechworth Bitters B8$q$, NULL, $q$Amaro$q$, $q$Beechworth Bitters$q$, NULL, $q$AU$q$, NULL, $q$https://www.beechworthbitters.com/shop/p/style-01-m3zhr$q$, $q$producer$q$),
($q$Beechworth Bitters Beetlejuice$q$, NULL, $q$Bitter Aperitivo$q$, $q$Beechworth Bitters$q$, NULL, $q$AU$q$, NULL, $q$https://www.beechworthbitters.com/shop/p/beetlejuice-500ml$q$, $q$producer$q$),
($q$Beechworth Bitters Orchard$q$, NULL, $q$Amaro$q$, $q$Beechworth Bitters$q$, NULL, $q$AU$q$, NULL, $q$https://www.beechworthbitters.com/shop/p/orchard$q$, $q$producer$q$),
($q$Beechworth Bitters The Daisy Age$q$, $q$Beechworth Bitters Daisy Age Amaro$q$, $q$Amaro$q$, $q$Beechworth Bitters$q$, NULL, $q$AU$q$, NULL, $q$https://www.beechworthbitters.com/shop/p/the-daisy-age-500ml$q$, $q$producer$q$),
($q$Amaro Tosolini$q$, $q$Amaro Tosolini$q$, $q$Amaro$q$, $q$Bepi Tosolini$q$, 30, $q$IT$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/5272/amaro-tosolini$q$, $q$reference$q$),
($q$Bigallet Bellecour$q$, NULL, $q$Bittersweet Orange Aperitivo$q$, $q$Bigallet$q$, 18, $q$FR$q$, NULL, $q$https://www.bigallet.fr/produit/bellecour-spritz/?attribute_pa_contenance=70cl$q$, $q$producer$q$),
($q$Bigallet China China$q$, $q$Bigallet China-China Amer$q$, $q$Amaro$q$, $q$Bigallet$q$, 40, $q$FR$q$, NULL, $q$https://www.bigallet.fr/produit/china-china/?attribute_pa_contenance=70cl$q$, $q$producer$q$),
($q$Bigallet Gentiane$q$, NULL, $q$Gentian Aperitif$q$, $q$Bigallet$q$, 16, $q$FR$q$, NULL, $q$https://www.bigallet.fr/produit/gentiane/?attribute_pa_contenance=70cl$q$, $q$producer$q$),
($q$Ferro-China Bisleri$q$, NULL, $q$Amaro$q$, $q$Bisleri$q$, 21, $q$IT$q$, NULL, $q$https://www.skurnik.com/sku/ferrochina-bitter-bisleri/$q$, $q$retailer$q$),
($q$Bonal Gentiane-Quina$q$, $q$Bonal Gentiane Quina$q$, $q$Quinquina$q$, $q$Bonal$q$, 16, $q$FR$q$, NULL, $q$https://alpenz.com/producer-bonal.html$q$, $q$reference$q$),
($q$Amaro Bordiga$q$, NULL, $q$Amaro$q$, $q$Bordiga$q$, NULL, $q$IT$q$, NULL, $q$https://bordiga1888.it/prodotto/amaro-bordiga-70cl/$q$, $q$producer$q$),
($q$Amaro Chiot Montamaro$q$, NULL, $q$Amaro$q$, $q$Bordiga$q$, NULL, $q$IT$q$, NULL, $q$https://bordiga1888.it/prodotto/amaro-chiot-montamaro-70cl/$q$, $q$producer$q$),
($q$Amaro Monasticus$q$, NULL, $q$Amaro$q$, $q$Bordiga$q$, NULL, $q$IT$q$, NULL, $q$https://bordiga1888.it/prodotto/amaro-centum-herbis-70cl/$q$, $q$producer$q$),
($q$Amaro St. Hubertus$q$, NULL, $q$Amaro$q$, $q$Bordiga$q$, NULL, $q$IT$q$, NULL, $q$https://bordiga1888.it/prodotto/amaro-st-hubertus-70cl/$q$, $q$producer$q$),
($q$Amaro di Cuneo$q$, NULL, $q$Amaro$q$, $q$Bordiga$q$, NULL, $q$IT$q$, NULL, $q$https://bordiga1888.it/prodotto/amaro-di-cuneo-70cl/$q$, $q$producer$q$),
($q$Bordiga Excelsior Vermouth di Torino Rosso Superiore$q$, $q$Bordiga Excelsior Vermouth$q$, $q$Sweet Vermouth$q$, $q$Bordiga$q$, NULL, $q$IT$q$, $q$Vermouth di Torino Superiore$q$, $q$https://bordiga1888.it/prodotto/vermouth-di-torino-excelsior-riserva-superiore-75cl/$q$, $q$producer$q$),
($q$Bordiga Genzianella$q$, NULL, $q$Amaro$q$, $q$Bordiga$q$, NULL, $q$IT$q$, NULL, $q$https://bordiga1888.it/prodotto/genzianella/$q$, $q$producer$q$),
($q$Bordiga Saint Veran$q$, NULL, $q$Amaro Alpino$q$, $q$Bordiga$q$, NULL, $q$IT$q$, NULL, $q$https://bordiga1888.it/prodotto/saint-veran/$q$, $q$producer$q$),
($q$Bordiga Vermouth di Torino Bianco$q$, $q$Bordiga Bianco Vermouth$q$, $q$Bianco Vermouth$q$, $q$Bordiga$q$, NULL, $q$IT$q$, $q$Vermouth di Torino$q$, $q$https://bordiga1888.it/prodotto/vermouth-di-torino-bianco-75cl/$q$, $q$producer$q$),
($q$Bordiga Vermouth di Torino Extra Dry$q$, $q$Bordiga Extra Dry Vermouth$q$, $q$Dry Vermouth$q$, $q$Bordiga$q$, NULL, $q$IT$q$, $q$Vermouth di Torino$q$, $q$https://bordiga1888.it/prodotto/vermouth-di-torino-extra-dry-75cl/$q$, $q$producer$q$),
($q$Bordiga Vermouth di Torino Rosso$q$, NULL, $q$Sweet Vermouth$q$, $q$Bordiga$q$, NULL, $q$IT$q$, $q$Vermouth di Torino$q$, $q$https://bordiga1888.it/prodotto/vermouth-di-torino-rosso-75cl/$q$, $q$producer$q$),
($q$Bordiga Vermouth di Torino Superiore Biologico$q$, NULL, $q$Vermouth$q$, $q$Bordiga$q$, NULL, $q$IT$q$, $q$Vermouth di Torino Superiore$q$, $q$https://bordiga1888.it/prodotto/vermouth-di-torino-superiore-igp-biologico-75cl/$q$, $q$producer$q$),
($q$Mulassano Vermouth di Torino Bianco$q$, NULL, $q$Bianco Vermouth$q$, $q$Bordiga$q$, NULL, $q$IT$q$, $q$Vermouth di Torino$q$, $q$https://bordiga1888.it/prodotto/vermouth-bianco-mulassano/$q$, $q$producer$q$),
($q$Mulassano Vermouth di Torino Extra Dry$q$, NULL, $q$Dry Vermouth$q$, $q$Bordiga$q$, NULL, $q$IT$q$, $q$Vermouth di Torino$q$, $q$https://bordiga1888.it/prodotto/vermouth-extra-dry-mulassano/$q$, $q$producer$q$),
($q$Mulassano Vermouth di Torino Rosso$q$, NULL, $q$Sweet Vermouth$q$, $q$Bordiga$q$, NULL, $q$IT$q$, $q$Vermouth di Torino$q$, $q$https://bordiga1888.it/prodotto/vermouth-rosso-mulassano/$q$, $q$producer$q$),
($q$Braulio$q$, $q$Braulio Amaro Alpino$q$, $q$Amaro Alpino$q$, $q$Braulio$q$, NULL, $q$IT$q$, NULL, $q$https://www.amarobraulio.com/it-it/$q$, $q$producer$q$),
($q$Braulio Riserva Speciale$q$, $q$Braulio Riserva Amaro$q$, $q$Amaro Alpino$q$, $q$Braulio$q$, NULL, $q$IT$q$, NULL, $q$https://www.amarobraulio.com/it-it/prodotti/$q$, $q$producer$q$),
($q$Byrrh Grand Quinquina$q$, $q$Byrrh$q$, $q$Quinquina$q$, $q$Byrrh$q$, 18, $q$FR$q$, NULL, $q$https://alpenz.com/producer-byrrh.html$q$, $q$reference$q$),
($q$Bèrto Vermouth Dry$q$, NULL, $q$Dry Vermouth$q$, $q$Bèrto$q$, NULL, $q$IT$q$, NULL, $q$https://distilleriaquaglia.it/prodotto/vermouth-secco-berto-dry/$q$, $q$producer$q$),
($q$Vecchio Amaro del Capo$q$, $q$Vecchio Amaro del Capo$q$, $q$Amaro$q$, $q$Caffo$q$, NULL, NULL, NULL, $q$https://www.vecchioamarodelcapo.com/en/$q$, $q$producer$q$),
($q$Vecchio Amaro del Capo Red Hot Edition$q$, NULL, $q$Amaro$q$, $q$Caffo$q$, NULL, NULL, NULL, $q$https://www.vecchioamarodelcapo.com/en/red-hot-edition/$q$, $q$producer$q$),
($q$Vecchio Amaro del Capo Riserva$q$, NULL, $q$Amaro$q$, $q$Caffo$q$, NULL, NULL, NULL, $q$https://www.vecchioamarodelcapo.com/en/riserva/$q$, $q$producer$q$),
($q$Calissano Vermouth Bianco$q$, NULL, $q$Bianco Vermouth$q$, $q$Calissano$q$, NULL, $q$IT$q$, $q$Vermouth di Torino Superiore$q$, $q$https://www.gruppoitalianovini.it/it/brand/calissano/vini/vermouth-di-torino/calissano-vermouth-bianco-superiore-60020-03$q$, $q$producer$q$),
($q$Calissano Vermouth Rosso$q$, NULL, $q$Sweet Vermouth$q$, $q$Calissano$q$, NULL, $q$IT$q$, $q$Vermouth di Torino Superiore$q$, $q$https://www.gruppoitalianovini.it/it/brand/calissano/vini/vermouth-di-torino/calissano-vermouth-rosso-superiore-60021-03$q$, $q$producer$q$),
($q$Campari$q$, $q$Campari$q$, $q$Bitter Aperitivo$q$, $q$Campari$q$, NULL, $q$IT$q$, NULL, $q$https://www.campari.com/our-products/campari/$q$, $q$producer$q$),
($q$Cappelletti Amaro Alta Verde$q$, NULL, $q$Amaro$q$, $q$Cappelletti$q$, NULL, $q$IT$q$, NULL, $q$https://alpenz.com/producer-cappelletti.html$q$, $q$reference$q$),
($q$Cappelletti Amaro Sfumato Rabarbaro$q$, $q$Cappelletti Amaro Sfumato Rabarbaro$q$, $q$Rabarbaro$q$, $q$Cappelletti$q$, NULL, $q$IT$q$, NULL, $q$https://alpenz.com/producer-cappelletti.html$q$, $q$reference$q$),
($q$Cappelletti Aperitivo Americano Rosso$q$, $q$Cappelletti Vino Aperitivo Americano Rosso$q$, $q$Americano Aperitif Wine$q$, $q$Cappelletti$q$, NULL, $q$IT$q$, NULL, $q$https://alpenz.com/productrecipes-cappelletti_aperitivo.html$q$, $q$reference$q$),
($q$Cappelletti Aperitivo Mazzura$q$, NULL, $q$Bitter Aperitivo$q$, $q$Cappelletti$q$, NULL, $q$IT$q$, NULL, $q$https://alpenz.com/producer-cappelletti.html$q$, $q$reference$q$),
($q$Cappelletti Elisir Novasalus$q$, NULL, $q$Vino Amaro$q$, $q$Cappelletti$q$, NULL, $q$IT$q$, NULL, $q$https://alpenz.com/producer-cappelletti.html$q$, $q$reference$q$),
($q$Cappelletti Pasubio Vino Amaro$q$, $q$Cappelletti Pasubio Vino Amaro$q$, $q$Vino Amaro$q$, $q$Cappelletti$q$, 17, $q$IT$q$, NULL, $q$https://alpenz.com/product-pasubio.html$q$, $q$reference$q$),
($q$Carpano Antica Formula$q$, $q$Carpano Antica Formula$q$, $q$Sweet Vermouth$q$, $q$Carpano$q$, 16.5, $q$IT$q$, NULL, $q$https://carpano.com/en/prodotto/antica-formula-2/$q$, $q$producer$q$),
($q$Carpano Bianco$q$, $q$Carpano Bianco Vermouth$q$, $q$Bianco Vermouth$q$, $q$Carpano$q$, 14.9, $q$IT$q$, NULL, $q$https://carpano.com/en/prodotto/carpano-bianco-2/$q$, $q$producer$q$),
($q$Carpano Botanic Bitter$q$, NULL, $q$Bitter Aperitivo$q$, $q$Carpano$q$, NULL, $q$IT$q$, NULL, $q$https://carpano.com/en/carpano-botanic-bitter/$q$, $q$producer$q$),
($q$Carpano Dry$q$, $q$Carpano Dry Vermouth$q$, $q$Dry Vermouth$q$, $q$Carpano$q$, NULL, $q$IT$q$, NULL, $q$https://carpano.com/en/prodotto/$q$, $q$producer$q$),
($q$Carpano Rosso$q$, $q$Carpano Rosso$q$, $q$Sweet Vermouth$q$, $q$Carpano$q$, 16, $q$IT$q$, NULL, $q$https://carpano.com/en/prodotto/carpano-classico-2/$q$, $q$producer$q$),
($q$Punt e Mes$q$, $q$Punt E Mes$q$, $q$Sweet Vermouth$q$, $q$Carpano$q$, NULL, $q$IT$q$, NULL, $q$https://carpano.com/en/prodotto/punt-e-mes-2/$q$, $q$producer$q$),
($q$Casa Mariol Vermut Blanc$q$, NULL, $q$Bianco Vermouth$q$, $q$Casa Mariol$q$, 15, NULL, NULL, $q$https://www.casamariol.com/en/productes/vermut-en/white-vermouth-1l/$q$, $q$producer$q$),
($q$Casa Mariol Vermut Negre$q$, $q$Casa Mariol Vermut Negre$q$, $q$Sweet Vermouth$q$, $q$Casa Mariol$q$, 15, NULL, NULL, $q$https://www.casamariol.com/en/productes/vermut-en/black-vermouth-1l/$q$, $q$producer$q$),
($q$Casoni Amaro del Ciclista$q$, NULL, $q$Amaro$q$, $q$Casoni$q$, 26, $q$IT$q$, NULL, $q$https://bottleofitaly.com/products/amaro-del-ciclista-70cl-casoni$q$, $q$retailer$q$),
($q$Casoni Aperitivo Rosso Italiano$q$, NULL, $q$Aromatised Wine$q$, $q$Casoni$q$, 11, $q$IT$q$, NULL, $q$https://bottleofitaly.com/products/aperitivo-rosso-italia-1lt-casoni$q$, $q$retailer$q$),
($q$Casoni Aperitivo Upper Spritz$q$, NULL, $q$Bittersweet Orange Aperitivo$q$, $q$Casoni$q$, 11, $q$IT$q$, NULL, $q$https://bottleofitaly.com/products/aperitivo-upper-spritz-1-lt$q$, $q$retailer$q$),
($q$Casoni Vermouth del Marchese$q$, NULL, $q$Vermouth$q$, $q$Casoni$q$, 18, $q$IT$q$, NULL, $q$https://bottleofitaly.com/products/vermouth-del-marchese-1-lt-casoni$q$, $q$retailer$q$),
($q$Chazalettes Vermouth Bianco della Regina$q$, NULL, $q$Bianco Vermouth$q$, $q$Chazalettes$q$, NULL, $q$IT$q$, $q$Vermouth di Torino$q$, $q$https://chazalettes.com/vermouth-bianco-della-regina/$q$, $q$producer$q$),
($q$Chazalettes Vermouth Extra Dry$q$, NULL, $q$Dry Vermouth$q$, $q$Chazalettes$q$, NULL, $q$IT$q$, $q$Vermouth di Torino$q$, $q$https://chazalettes.com/vermouth-extra-dry/$q$, $q$producer$q$),
($q$Chazalettes Vermouth Rosso della Regina$q$, NULL, $q$Sweet Vermouth$q$, $q$Chazalettes$q$, NULL, $q$IT$q$, $q$Vermouth di Torino$q$, $q$https://chazalettes.com/vermouth-rosso-della-regina/$q$, $q$producer$q$),
($q$Cinzano Bianco$q$, $q$Cinzano Blanco Vermouth$q$, $q$Bianco Vermouth$q$, $q$Cinzano$q$, 15, $q$IT$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/3159/cinzano-bianco-vermouth$q$, $q$reference$q$),
($q$Cocchi Americano$q$, $q$Cocchi Americano$q$, $q$Americano Aperitif Wine$q$, $q$Cocchi$q$, 16.5, $q$IT$q$, NULL, $q$https://www.cocchi.it/en/wines/americano/$q$, $q$producer$q$),
($q$Cocchi Barolo Chinato$q$, $q$Cocchi Barolo Chinato$q$, $q$Vino Amaro$q$, $q$Cocchi$q$, 16.5, $q$IT$q$, $q$Barolo Chinato$q$, $q$https://www.cocchi.it/en/wines/barolo-chinato/$q$, $q$producer$q$),
($q$Cocchi Barolo Chinato Tipo Esportazione 135 anni$q$, NULL, $q$Vino Amaro$q$, $q$Cocchi$q$, 18, $q$IT$q$, $q$Barolo Chinato$q$, $q$https://www.cocchi.it/en/wines/barolo-chinato-tipo-esportazione-135-years/$q$, $q$producer$q$),
($q$Cocchi Dopo Teatro Vermouth Amaro$q$, $q$Cocchi Vermouth Amaro Dopo Teatro$q$, $q$Sweet Vermouth$q$, $q$Cocchi$q$, 16, $q$IT$q$, NULL, $q$https://www.cocchi.it/en/wines/dopo-teatro-vermouth-amaro/$q$, $q$producer$q$),
($q$Cocchi Rosa$q$, $q$Cocchi Americano Rosa$q$, $q$Americano Aperitif Wine$q$, $q$Cocchi$q$, 16.5, $q$IT$q$, NULL, $q$https://www.cocchi.it/en/wines/cocchi-rosa/$q$, $q$producer$q$),
($q$Cocchi Savoy Vermouth Dry (Third Edition)$q$, NULL, $q$Dry Vermouth$q$, $q$Cocchi$q$, 18, $q$IT$q$, NULL, $q$https://www.cocchi.it/en/wines/cocchi-dry-vermouth-di-torino/$q$, $q$producer$q$),
($q$Cocchi Vermouth$q$, $q$Cocchi Vermouth$q$, $q$Sweet Vermouth$q$, $q$Cocchi$q$, 16, $q$IT$q$, $q$Vermouth di Torino$q$, $q$https://www.cocchi.it/en/wines/storico-vermouth-di-torino/$q$, $q$producer$q$),
($q$Cocchi Vermouth di Torino Extra Dry$q$, $q$Cocchi Extra Dry Vermouth$q$, $q$Dry Vermouth$q$, $q$Cocchi$q$, 17, $q$IT$q$, $q$Vermouth di Torino$q$, $q$https://www.cocchi.it/en/wines/vermouth-di-torino-extra-dry/$q$, $q$producer$q$),
($q$Contratto Americano Rosso$q$, NULL, $q$Americano Aperitif Wine$q$, $q$Contratto$q$, NULL, $q$IT$q$, NULL, $q$https://www.contratto.it/prodotto/americano-rosso/$q$, $q$producer$q$),
($q$Contratto Bitter$q$, $q$Contratto Bitter$q$, $q$Bitter Aperitivo$q$, $q$Contratto$q$, NULL, $q$IT$q$, NULL, $q$https://www.contratto.it/prodotto/bitter/$q$, $q$producer$q$),
($q$Contratto Fernet$q$, NULL, $q$Fernet$q$, $q$Contratto$q$, NULL, $q$IT$q$, NULL, $q$https://www.contratto.it/prodotto/fernet/$q$, $q$producer$q$),
($q$Contratto Vermouth Bianco$q$, $q$Contratto Bianco Vermouth$q$, $q$Bianco Vermouth$q$, $q$Contratto$q$, NULL, $q$IT$q$, NULL, $q$https://www.contratto.it/prodotto/vermouth-bianco/$q$, $q$producer$q$),
($q$Contratto Vermouth Rosso$q$, $q$Contratto Vermouth Rosso$q$, $q$Sweet Vermouth$q$, $q$Contratto$q$, NULL, $q$IT$q$, NULL, $q$https://www.contratto.it/prodotto/vermouth-rosso/$q$, $q$producer$q$),
($q$Cynar 70 Proof$q$, $q$Cynar 70$q$, $q$Artichoke Amaro$q$, $q$Cynar$q$, 35, $q$IT$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/6719/cynar-70-proof$q$, $q$reference$q$),
($q$Del Professore Vermouth Chinato$q$, NULL, $q$Vermouth$q$, $q$Del Professore$q$, NULL, $q$IT$q$, NULL, $q$https://www.delprofessore.com/vermouth/$q$, $q$producer$q$),
($q$Del Professore Vermouth di Torino Classico$q$, NULL, $q$Ambrato Vermouth$q$, $q$Del Professore$q$, NULL, $q$IT$q$, $q$Vermouth di Torino$q$, $q$https://www.delprofessore.com/vermouth/classico-di-torino/$q$, $q$producer$q$),
($q$Del Professore Vermouth di Torino Rosso$q$, $q$Vermouth del Professore Rosso$q$, $q$Sweet Vermouth$q$, $q$Del Professore$q$, NULL, $q$IT$q$, $q$Vermouth di Torino$q$, $q$https://www.delprofessore.com/vermouth/rosso-di-torino/$q$, $q$producer$q$),
($q$Del Professore Vermouth di Torino Superiore$q$, NULL, $q$Sweet Vermouth$q$, $q$Del Professore$q$, NULL, $q$IT$q$, $q$Vermouth di Torino Superiore$q$, $q$https://www.delprofessore.com/vermouth/$q$, $q$producer$q$),
($q$Bitter DelMago$q$, NULL, $q$Bitter Aperitivo$q$, $q$DelMago$q$, 25, $q$IT$q$, NULL, $q$https://callmewine.com/en/bitter-delmago-P37262.htm$q$, $q$retailer$q$),
($q$Discarded Cascara Sweet Vermouth$q$, NULL, $q$Sweet Vermouth$q$, $q$Discarded$q$, 21, $q$GB$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/6206/discarded-cascara-vermouth$q$, $q$reference$q$),
($q$Distillerie de Grandmont Amer Gentiane$q$, NULL, $q$Gentian Aperitif$q$, $q$Distillerie de Grandmont$q$, 32, $q$FR$q$, NULL, $q$https://closdesspiritueux.com/23468-liqueurs-de-plantes-distillerie-de-grandmont---amer-gentiane---32.html$q$, $q$retailer$q$),
($q$Gentiane de Lure$q$, NULL, $q$Gentian Aperitif$q$, $q$Distilleries et Domaines de Provence$q$, 15, $q$FR$q$, NULL, $q$https://www.distilleries-provence.com/en/gentiane-de-lure/39-17-gentiane-de-lure.html$q$, $q$producer$q$),
($q$Noix de la Saint-Jean$q$, $q$Noix De St-Jean$q$, $q$Aromatised Wine$q$, $q$Distilleries et Domaines de Provence$q$, NULL, $q$FR$q$, NULL, $q$https://www.distilleries-provence.com/en/noix-de-st-jean/26-21-noix-de-la-saint-jean.html/$q$, $q$producer$q$),
($q$Orange Colombo$q$, NULL, $q$Aromatised Wine$q$, $q$Distilleries et Domaines de Provence$q$, 15, $q$FR$q$, NULL, $q$https://www.distilleries-provence.com/en/orange-colombo/27-23-orange-colombo.html/$q$, $q$producer$q$),
($q$RinQuinQuin à la Pêche$q$, NULL, $q$Aromatised Wine$q$, $q$Distilleries et Domaines de Provence$q$, 15, $q$FR$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/5724/rinquinquin-liqueur$q$, $q$reference$q$),
($q$Rinquinquin$q$, NULL, $q$Aromatised Wine$q$, $q$Distilleries et Domaines de Provence$q$, NULL, $q$FR$q$, NULL, $q$https://www.distilleries-provence.com/en/8-rinquinquin$q$, $q$producer$q$),
($q$Vermouth de Forcalquier$q$, NULL, $q$Vermouth$q$, $q$Distilleries et Domaines de Provence$q$, 18, $q$FR$q$, NULL, $q$https://www.distilleries-provence.com/en/vermouth/33-27-vermouth-de-forcalquier.html/$q$, $q$producer$q$),
($q$Doppelgänger Aperitivo$q$, NULL, $q$Bittersweet Orange Aperitivo$q$, $q$Doghouse$q$, 20, $q$GB$q$, NULL, $q$https://hedonism.co.uk/product/doppelganger-aperitivo$q$, $q$retailer$q$),
($q$Dolin Vermouth Blanc$q$, $q$Dolin Blanc Vermouth$q$, $q$Bianco Vermouth$q$, $q$Dolin$q$, 16, $q$FR$q$, $q$Vermouth de Chambéry$q$, $q$https://www.dolin.fr/en/products/white-vermouth/$q$, $q$producer$q$),
($q$Dolin Vermouth Dry$q$, $q$Dolin Dry Vermouth$q$, $q$Dry Vermouth$q$, $q$Dolin$q$, 17.5, $q$FR$q$, $q$Vermouth de Chambéry$q$, $q$https://www.dolin.fr/en/products/vermouth-dry/$q$, $q$producer$q$),
($q$Dolin Vermouth Rouge$q$, $q$Dolin Rouge Sweet Vermouth$q$, $q$Sweet Vermouth$q$, $q$Dolin$q$, 16, $q$FR$q$, $q$Vermouth de Chambéry$q$, $q$https://www.dolin.fr/en/products/red-vermouth/$q$, $q$producer$q$),
($q$Dubonnet Red$q$, $q$Dubonnet$q$, $q$Quinquina$q$, $q$Dubonnet$q$, 14.8, $q$FR$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/856/dubonnet-red$q$, $q$reference$q$),
($q$El Bandarra Al Fresco$q$, NULL, $q$Aromatised Wine$q$, $q$El Bandarra$q$, 14.5, NULL, NULL, $q$https://elbandarra.myshopify.com/collections/el-bandarra/products/el-bandarra-al-fresco-100-cl$q$, $q$producer$q$),
($q$El Bandarra Blanco$q$, NULL, $q$Bianco Vermouth$q$, $q$El Bandarra$q$, 15, NULL, NULL, $q$https://elbandarra.myshopify.com/collections/el-bandarra/products/el-bandarra-blanco-100-cl$q$, $q$producer$q$),
($q$El Bandarra Rojo$q$, NULL, $q$Sweet Vermouth$q$, $q$El Bandarra$q$, 15, NULL, NULL, $q$https://elbandarra.myshopify.com/products/el-bandarra-rojo$q$, $q$producer$q$),
($q$El Bandarra Rosé$q$, $q$El Bandarra Rosé$q$, $q$Rosé Vermouth$q$, $q$El Bandarra$q$, 15, NULL, NULL, $q$https://elbandarra.myshopify.com/collections/el-bandarra/products/copia-de-el-bandarra-rose-100-cl$q$, $q$producer$q$),
($q$Esquimalt Apéritif Cascadia$q$, NULL, $q$Aromatised Wine$q$, $q$Esquimalt$q$, 20, $q$CA$q$, NULL, $q$https://esquimaltvermouth.ca/products/aperitif-cascadia$q$, $q$producer$q$),
($q$Esquimalt Barrel-Aged Rosso Vermouth$q$, NULL, $q$Sweet Vermouth$q$, $q$Esquimalt$q$, NULL, $q$CA$q$, NULL, $q$https://esquimaltvermouth.ca/products/barrel-aged-rosso-vermouth-500-ml$q$, $q$producer$q$),
($q$Esquimalt Bianco Sweet Vermouth$q$, NULL, $q$Bianco Vermouth$q$, $q$Esquimalt$q$, 18, $q$CA$q$, NULL, $q$https://esquimaltvermouth.ca/products/bianco-vermouth$q$, $q$producer$q$),
($q$Esquimalt Bitter Orange$q$, NULL, $q$Bittersweet Orange Aperitivo$q$, $q$Esquimalt$q$, 18, $q$CA$q$, NULL, $q$https://esquimaltvermouth.ca/products/bitter-orange$q$, $q$producer$q$),
($q$Esquimalt Bitter Red (Americano)$q$, NULL, $q$Americano Aperitif Wine$q$, $q$Esquimalt$q$, 21, $q$CA$q$, NULL, $q$https://esquimaltvermouth.ca/products/bitter-red$q$, $q$producer$q$),
($q$Esquimalt Dry Vermouth$q$, $q$Esquimalt - Dry Vermouth$q$, $q$Dry Vermouth$q$, $q$Esquimalt$q$, 18, $q$CA$q$, NULL, $q$https://esquimaltvermouth.ca/products/dry-vermouth-500ml$q$, $q$producer$q$),
($q$Esquimalt Kina-Salal$q$, NULL, $q$Quinquina$q$, $q$Esquimalt$q$, NULL, $q$CA$q$, NULL, $q$https://esquimaltvermouth.ca/products/kina-salal$q$, $q$producer$q$),
($q$Esquimalt Rosso Sweet Vermouth$q$, $q$Esquimalt - Sweet Rosso Vermouth$q$, $q$Sweet Vermouth$q$, $q$Esquimalt$q$, 17.5, $q$CA$q$, NULL, $q$https://esquimaltvermouth.ca/products/rosso-vermouth-500ml$q$, $q$producer$q$),
($q$Esquimalt Smoked Apéritif Cascadia$q$, NULL, $q$Aromatised Wine$q$, $q$Esquimalt$q$, 20, $q$CA$q$, NULL, $q$https://esquimaltvermouth.ca/products/smoked-aperitif-cascadia$q$, $q$producer$q$),
($q$Foro Amaro Speciale$q$, $q$Foro Amaro Speciale$q$, $q$Amaro$q$, $q$Foro$q$, NULL, $q$IT$q$, NULL, $q$https://www.chathamimports.com/brands/foro-amaro$q$, $q$reference$q$),
($q$Forthave Marseille Amaro$q$, $q$Forthave Marseille Amaro$q$, $q$Amaro$q$, $q$Forthave Spirits$q$, 36, NULL, NULL, $q$https://www.skurnik.com/sku/combo-pack-3btls-each-red-blue-marseilles-brown-forthave-spirits/$q$, $q$retailer$q$),
($q$Forthave Red Aperitivo$q$, $q$Forthave Red Aperitivo$q$, $q$Bitter Aperitivo$q$, $q$Forthave Spirits$q$, 24, NULL, NULL, $q$https://www.skurnik.com/sku/combo-pack-3btls-each-red-blue-marseilles-brown-forthave-spirits/$q$, $q$retailer$q$),
($q$Brancamenta$q$, NULL, $q$Fernet$q$, $q$Fratelli Branca$q$, NULL, $q$IT$q$, NULL, $q$https://www.brancadistillerie.com/product/brancamenta/$q$, $q$producer$q$),
($q$Fernet-Branca$q$, $q$Fernet-Branca$q$, $q$Fernet$q$, $q$Fratelli Branca$q$, 39, $q$IT$q$, NULL, $q$https://us.fernetbranca.com$q$, $q$producer$q$),
($q$Fernet-Branca Gold Limited Edition$q$, NULL, $q$Fernet$q$, $q$Fratelli Branca$q$, NULL, $q$IT$q$, NULL, $q$https://www.fernetbranca.com/natale-2025$q$, $q$producer$q$),
($q$Galliano L'Aperitivo$q$, $q$Galliano L'Aperitivo$q$, $q$Bitter Aperitivo$q$, $q$Galliano$q$, NULL, NULL, NULL, $q$https://galliano.com/product/galliano-laperitivo/$q$, $q$producer$q$),
($q$Bitter Gancia$q$, NULL, $q$Bitter Aperitivo$q$, $q$Gancia$q$, 25, $q$IT$q$, NULL, $q$https://www.gancia.it/i-prodotti-gancia/spirits/aperitivi/bitter/$q$, $q$producer$q$),
($q$Fernet Gancia$q$, NULL, $q$Fernet$q$, $q$Gancia$q$, 40, $q$IT$q$, NULL, $q$https://www.gancia.it/i-prodotti-gancia/spirits/gin-amari/fernet/$q$, $q$producer$q$),
($q$Gancia Americano Aperitivo$q$, NULL, $q$Americano Aperitif Wine$q$, $q$Gancia$q$, 14.5, $q$IT$q$, NULL, $q$https://www.gancia.it/i-prodotti-gancia/spirits/aperitivi/americano-aperitivo/$q$, $q$producer$q$),
($q$Gancia Vermouth Bianco$q$, NULL, $q$Bianco Vermouth$q$, $q$Gancia$q$, 16, $q$IT$q$, NULL, $q$https://www.gancia.it/i-prodotti-gancia/spirits/vermouth-bianco/$q$, $q$producer$q$),
($q$Gancia Vermouth Extra Dry$q$, NULL, $q$Dry Vermouth$q$, $q$Gancia$q$, 18, $q$IT$q$, NULL, $q$https://www.gancia.it/i-prodotti-gancia/spirits/vermouth-extra-dry/$q$, $q$producer$q$),
($q$Gancia Vermouth Rosso$q$, NULL, $q$Sweet Vermouth$q$, $q$Gancia$q$, 16, $q$IT$q$, NULL, $q$https://www.gancia.it/i-prodotti-gancia/spirits/vermouth-rosso/$q$, $q$producer$q$),
($q$Gancia Vermouth di Torino Rosso$q$, NULL, $q$Sweet Vermouth$q$, $q$Gancia$q$, 17, $q$IT$q$, $q$Vermouth di Torino$q$, $q$https://www.gancia.it/i-prodotti-gancia/spirits/vermouth-di-torino-rosso/$q$, $q$producer$q$),
($q$Heirloom Pineapple Amaro$q$, $q$Heirloom Pineapple Amaro$q$, $q$Amaro$q$, $q$Heirloom$q$, NULL, NULL, NULL, $q$https://heirloomliqueurs.com/products/pineapple-amaro/$q$, $q$producer$q$),
($q$Jefferson Amaro Importante$q$, $q$Amaro Jefferson$q$, $q$Amaro$q$, $q$Jefferson$q$, NULL, $q$IT$q$, NULL, $q$https://bottleofitaly.com/en-us/pages/produttore-jefferson$q$, $q$retailer$q$),
($q$Jefferson Tintura Importante$q$, NULL, $q$Amaro$q$, $q$Jefferson$q$, NULL, $q$IT$q$, NULL, $q$https://bottleofitaly.com/en-us/pages/produttore-jefferson$q$, $q$retailer$q$),
($q$Joseph Cartron Le Vermouth Rouge$q$, NULL, $q$Sweet Vermouth$q$, $q$Joseph Cartron$q$, 17.5, $q$FR$q$, NULL, $q$https://www.skurnik.com/sku/vermouth-rouge-joseph-cartron/$q$, $q$retailer$q$),
($q$L.N. Mattei Cap Corse Blanc Grande Réserve Quinquina$q$, $q$Cap Corse Mattei Blanc$q$, $q$Quinquina$q$, $q$L.N. Mattei$q$, 17, $q$FR$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/wine-fortified/vermouth-and-aromatized-wines/BWS006053/ln-mattei-cap-corse-blanc$q$, $q$reference$q$),
($q$Mattei Cap Corse Rouge$q$, $q$Cap Corse Mattei Rouge$q$, $q$Quinquina$q$, $q$L.N. Mattei$q$, 17, $q$FR$q$, NULL, $q$https://alpenz.com/producer-mattei.html$q$, $q$reference$q$),
($q$La Quintinye Vermouth Royal Blanc$q$, $q$La Quintinye Vermouth Royal Blanc$q$, $q$Bianco Vermouth$q$, $q$La Quintinye$q$, 16, $q$FR$q$, NULL, $q$https://maisonvillevert.com/collections/tous-nos-spiritueux/products/la-quintinye-vermouth-royal-blanc$q$, $q$producer$q$),
($q$La Quintinye Vermouth Royal Extra Dry$q$, $q$La Quintinye Vermouth Royal Extra Dry$q$, $q$Dry Vermouth$q$, $q$La Quintinye$q$, 17, $q$FR$q$, NULL, $q$https://maisonvillevert.com/collections/tous-nos-spiritueux/products/la-quintinye-vermouth-royal-dry$q$, $q$producer$q$),
($q$La Quintinye Vermouth Royal Rouge$q$, $q$La Quintinye Vermouth Royal Rouge$q$, $q$Sweet Vermouth$q$, $q$La Quintinye$q$, 16.5, $q$FR$q$, NULL, $q$https://maisonvillevert.com/collections/tous-nos-spiritueux/products/la-quintinye-vermouth-royal-rouge$q$, $q$producer$q$),
($q$Lazzaroni Amaro$q$, $q$Amaro Lazzaroni$q$, $q$Amaro$q$, $q$Lazzaroni$q$, 25, NULL, NULL, $q$https://www.lazzaroni.it/it/grappe-e-amari/amaro-25°-22.html$q$, $q$producer$q$),
($q$Lazzaroni Fernet$q$, NULL, $q$Fernet$q$, $q$Lazzaroni$q$, 40, NULL, NULL, $q$https://www.lazzaroni.it/it/grappe-e-amari/fernet-40°-20.html$q$, $q$producer$q$),
($q$Leopold Bros x Matthiasson Sweet Wermut$q$, NULL, $q$Sweet Vermouth$q$, $q$Leopold Bros.$q$, NULL, NULL, NULL, $q$https://www.leopoldbros.com/spirits$q$, $q$producer$q$),
($q$Letherbee Fernet$q$, $q$Letherbee Fernet$q$, $q$Fernet$q$, $q$Letherbee$q$, 35, $q$US$q$, NULL, $q$https://www.letherbee.com/products/p/letherbee-fernet$q$, $q$producer$q$),
($q$Lillet Blanc$q$, $q$Lillet Blanc$q$, $q$Aromatised Wine$q$, $q$Lillet$q$, 17, $q$FR$q$, NULL, $q$https://pernod-ricard.com/en/brands/lillet$q$, $q$producer$q$),
($q$Lillet Rosé$q$, $q$Lillet Rosé$q$, $q$Aromatised Wine$q$, $q$Lillet$q$, 17, $q$FR$q$, NULL, $q$https://pernod-ricard.com/en/brands/lillet$q$, $q$producer$q$),
($q$Lillet Rouge$q$, $q$Lillet Rouge$q$, $q$Aromatised Wine$q$, $q$Lillet$q$, 17, $q$FR$q$, NULL, $q$https://pernod-ricard.com/en/brands/lillet$q$, $q$producer$q$),
($q$Lo-Fi Dry Vermouth$q$, $q$Lo-Fi Dry Vermouth$q$, $q$Dry Vermouth$q$, $q$Lo-Fi$q$, NULL, $q$US$q$, NULL, $q$https://www.lofiaperitifs.com/000000000210043537.html$q$, $q$producer$q$),
($q$Lo-Fi Gentian Amaro$q$, $q$Lo-Fi Gentian Amaro$q$, $q$Vino Amaro$q$, $q$Lo-Fi$q$, NULL, $q$US$q$, NULL, $q$https://www.lofiaperitifs.com/000000000210012089.html$q$, $q$producer$q$),
($q$Lo-Fi Sweet Vermouth$q$, $q$Lo-Fi Sweet Red Vermouth$q$, $q$Sweet Vermouth$q$, $q$Lo-Fi$q$, NULL, $q$US$q$, NULL, $q$https://www.lofiaperitifs.com/00000000028060875.html$q$, $q$producer$q$),
($q$Amaro Lucano$q$, $q$Amaro Lucano$q$, $q$Amaro$q$, $q$Lucano$q$, 28, $q$IT$q$, NULL, $q$https://www.amarolucano.it/en/amaro-lucano$q$, $q$producer$q$),
($q$Lucano Amaro Essenza$q$, NULL, $q$Amaro$q$, $q$Lucano$q$, 35, $q$IT$q$, NULL, $q$https://www.amarolucano.it/en/amarolucano_essenza$q$, $q$producer$q$),
($q$Vermouth del Cavaliere$q$, NULL, $q$Vermouth$q$, $q$Lucano$q$, 18, $q$IT$q$, NULL, $q$https://www.amarolucano.it/en/vermouth-del-cavaliere$q$, $q$producer$q$),
($q$Lustau Vermut Blanco$q$, $q$Lustau Vermut Blanco$q$, $q$Bianco Vermouth$q$, $q$Lustau$q$, NULL, $q$ES$q$, NULL, $q$https://lustau.es/en/shop/sherry-vermuoth-en/white-vermouth-lustau/$q$, $q$producer$q$),
($q$Lustau Vermut Rojo$q$, $q$Lustau Vermut Rojo$q$, $q$Sweet Vermouth$q$, $q$Lustau$q$, 15, $q$ES$q$, NULL, $q$https://lustau.es/en/shop/sherry-vermuoth-en/red-vermouth/$q$, $q$producer$q$),
($q$Lustau Vermut Rosé$q$, $q$Lustau Vermut Rosé$q$, $q$Rosé Vermouth$q$, $q$Lustau$q$, NULL, $q$ES$q$, NULL, $q$https://lustau.es/en/shop/sherry-vermuoth-en/vermut-lustau-rose/$q$, $q$producer$q$),
($q$Luxardo Antico$q$, NULL, $q$Aromatised Wine$q$, $q$Luxardo$q$, 16.5, NULL, NULL, $q$https://www.luxardo.it/liqueurs-and-distillates/antico/$q$, $q$producer$q$),
($q$Luxardo Aperitivo$q$, $q$Luxardo Aperitivo$q$, $q$Bittersweet Orange Aperitivo$q$, $q$Luxardo$q$, 11, NULL, NULL, $q$https://www.luxardo.it/liqueurs-and-distillates/aperitivo/$q$, $q$producer$q$),
($q$Luxardo Bitter$q$, $q$Luxardo Bitter$q$, $q$Bitter Aperitivo$q$, $q$Luxardo$q$, 25, NULL, NULL, $q$https://www.luxardo.it/liqueurs-and-distillates/bitter/$q$, $q$producer$q$),
($q$Luxardo Bitter Bianco$q$, $q$Luxardo Bitter Bianco$q$, $q$Bitter Bianco$q$, $q$Luxardo$q$, 30, NULL, NULL, $q$https://www.luxardo.it/liqueurs-and-distillates/bitter-bianco/$q$, $q$producer$q$),
($q$Maidenii Classic Vermouth$q$, $q$Maidenii Classic Vermouth$q$, $q$Vermouth$q$, $q$Maidenii$q$, 16, $q$AU$q$, NULL, $q$https://maidenii.com.au/$q$, $q$producer$q$),
($q$Maidenii Dry Vermouth$q$, $q$Maidenii Dry Vermouth$q$, $q$Dry Vermouth$q$, $q$Maidenii$q$, 19, $q$AU$q$, NULL, $q$https://maidenii.com.au/$q$, $q$producer$q$),
($q$Maidenii Kina$q$, NULL, $q$Quinquina$q$, $q$Maidenii$q$, 17.5, $q$AU$q$, NULL, $q$https://maidenii.com.au/$q$, $q$producer$q$),
($q$Maidenii Nocturne Vin Amer$q$, NULL, $q$Vino Amaro$q$, $q$Maidenii$q$, NULL, $q$AU$q$, NULL, $q$https://maidenii.com.au/$q$, $q$producer$q$),
($q$Maidenii Roselle Bitter$q$, NULL, $q$Bitter Aperitivo$q$, $q$Maidenii$q$, 22, $q$AU$q$, NULL, $q$https://maidenii.com.au/$q$, $q$producer$q$),
($q$Maidenii Sweet Vermouth$q$, $q$Maidenii Sweet Vermouth$q$, $q$Sweet Vermouth$q$, $q$Maidenii$q$, 16, $q$AU$q$, NULL, $q$https://maidenii.com.au/$q$, $q$producer$q$),
($q$Mancino Chinato$q$, $q$Mancino Chinato$q$, $q$Vino Amaro$q$, $q$Mancino$q$, 17.5, $q$IT$q$, NULL, $q$https://mancinovermouth.com/prodotti/chinato$q$, $q$producer$q$),
($q$Mancino Kopi$q$, $q$Mancino Kopi Vermouth$q$, $q$Vermouth$q$, $q$Mancino$q$, 17, $q$IT$q$, NULL, $q$https://mancinovermouth.com/prodotti/kopi$q$, $q$producer$q$),
($q$Mancino Sakura$q$, $q$Mancino Sakura Vermouth$q$, $q$Vermouth$q$, $q$Mancino$q$, 18, $q$IT$q$, NULL, $q$https://mancinovermouth.com/prodotti/sakura$q$, $q$producer$q$),
($q$Mancino Vecchio$q$, NULL, $q$Sweet Vermouth$q$, $q$Mancino$q$, 16, $q$IT$q$, NULL, $q$https://mancinovermouth.com/prodotti/vecchio$q$, $q$producer$q$),
($q$Mancino Vermouth di Torino Rosso Amaranto$q$, $q$Mancino Rosso Amaranto Vermouth$q$, $q$Sweet Vermouth$q$, $q$Mancino$q$, 16, $q$IT$q$, $q$Vermouth di Torino$q$, $q$https://mancinovermouth.com/prodotti/rosso-amaranto$q$, $q$producer$q$),
($q$Mancino Vermouth di Torino Secco$q$, $q$Mancino Secco Vermouth$q$, $q$Dry Vermouth$q$, $q$Mancino$q$, 18, $q$IT$q$, $q$Vermouth di Torino$q$, $q$https://mancinovermouth.com/prodotti/secco$q$, $q$producer$q$),
($q$Marionette Bitter Curacao$q$, $q$Marionette Bitter$q$, $q$Bitter Aperitivo$q$, $q$Marionette$q$, 28, $q$AU$q$, NULL, $q$https://www.winecompanion.com.au/distilleries/victoria/melbourne/marionette/spirits/citrusy/amaro/bitter-curacao/2025$q$, $q$reference$q$),
($q$Martini Bianco$q$, $q$Martini Bianco Vermouth$q$, $q$Bianco Vermouth$q$, $q$Martini$q$, NULL, NULL, NULL, $q$https://www.martini.com/products/martini-bianco/$q$, $q$producer$q$),
($q$Martini Bitter$q$, $q$Martini Bitter$q$, $q$Bitter Aperitivo$q$, $q$Martini$q$, NULL, NULL, NULL, $q$https://www.martini.com/products/martini-bitter/$q$, $q$producer$q$),
($q$Martini Extra Dry$q$, $q$Martini Extra Dry Vermouth$q$, $q$Dry Vermouth$q$, $q$Martini$q$, NULL, NULL, NULL, $q$https://www.martini.com/products/martini-extra-dry/$q$, $q$producer$q$),
($q$Martini Riserva Speciale Ambrato$q$, $q$Martini Riserva Speciale Ambrato Vermouth$q$, $q$Ambrato Vermouth$q$, $q$Martini$q$, NULL, NULL, NULL, $q$https://www.martini.com/products/riserva-speciale-ambrato/$q$, $q$producer$q$),
($q$Martini Riserva Speciale Bitter$q$, $q$Martini Riserva Speciale Bitter$q$, $q$Bitter Aperitivo$q$, $q$Martini$q$, NULL, NULL, NULL, $q$https://www.martini.com/products/riserva-speciale-bitter/$q$, $q$producer$q$),
($q$Martini Riserva Speciale Rubino$q$, $q$Martini Riserva Speciale Rubino Sweet Vermouth$q$, $q$Sweet Vermouth$q$, $q$Martini$q$, NULL, NULL, NULL, $q$https://www.martini.com/products/riserva-speciale-rubino/$q$, $q$producer$q$),
($q$Martini Rosato$q$, $q$Martini Rosato Vermouth$q$, $q$Rosé Vermouth$q$, $q$Martini$q$, NULL, NULL, NULL, $q$https://www.martini.com/products/martini-rosato/$q$, $q$producer$q$),
($q$Martini Rosso$q$, $q$Martini Rosso Sweet Vermouth$q$, $q$Sweet Vermouth$q$, $q$Martini$q$, NULL, NULL, NULL, $q$https://www.martini.com/products/martini-rosso/$q$, $q$producer$q$),
($q$Martínez Lacuesta Vermut Blanco$q$, NULL, $q$Bianco Vermouth$q$, $q$Martínez Lacuesta$q$, NULL, $q$ES$q$, NULL, $q$https://martinezlacuesta.com/vermut/$q$, $q$producer$q$),
($q$Martínez Lacuesta Vermut Blanco Extra Seco$q$, NULL, $q$Dry Vermouth$q$, $q$Martínez Lacuesta$q$, NULL, $q$ES$q$, NULL, $q$https://martinezlacuesta.com/vermut/$q$, $q$producer$q$),
($q$Martínez Lacuesta Vermut Conzia$q$, NULL, $q$Vermouth$q$, $q$Martínez Lacuesta$q$, NULL, $q$ES$q$, NULL, $q$https://martinezlacuesta.com/vermut/$q$, $q$producer$q$),
($q$Martínez Lacuesta Vermut Edición Limitada$q$, NULL, $q$Vermouth$q$, $q$Martínez Lacuesta$q$, NULL, $q$ES$q$, NULL, $q$https://martinezlacuesta.com/vermut/$q$, $q$producer$q$),
($q$Martínez Lacuesta Vermut Reserva en Roble$q$, NULL, $q$Vermouth$q$, $q$Martínez Lacuesta$q$, NULL, $q$ES$q$, NULL, $q$https://martinezlacuesta.com/vermut/$q$, $q$producer$q$),
($q$Martínez Lacuesta Vermut Rojo$q$, $q$Lacuesta Vermut Rojo$q$, $q$Sweet Vermouth$q$, $q$Martínez Lacuesta$q$, NULL, $q$ES$q$, NULL, $q$https://martinezlacuesta.com/vermut/$q$, $q$producer$q$),
($q$Maurin Quina$q$, NULL, $q$Quinquina$q$, $q$Maurin$q$, 16, $q$FR$q$, NULL, $q$https://www.nicks.com.au/maurin-quina-le-puy-aperitif-1000ml$q$, $q$retailer$q$),
($q$Maurin Vermouth Dry$q$, NULL, $q$Dry Vermouth$q$, $q$Maurin$q$, 17, NULL, NULL, $q$https://unwindbottleshop.com/products/maurin-vermouth-dry-17-750ml$q$, $q$retailer$q$),
($q$Maurin Vermouth White$q$, NULL, $q$Bianco Vermouth$q$, $q$Maurin$q$, 17, NULL, NULL, $q$https://unwindbottleshop.com/products/maurin-vermouth-white-17-750ml$q$, $q$retailer$q$),
($q$Amaro Meletti$q$, $q$Meletti Amaro$q$, $q$Amaro$q$, $q$Meletti$q$, 32, $q$IT$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/6733/amaro-meletti$q$, $q$reference$q$),
($q$Mondino Amaro Bavarese$q$, NULL, $q$Bittersweet Orange Aperitivo$q$, $q$Mondino$q$, 18, $q$DE$q$, NULL, $q$https://diffordsguide.com/beer-wine-spirits/6183/mondino-amaro$q$, $q$reference$q$),
($q$Amaro Montenegro$q$, $q$Amaro Montenegro$q$, $q$Amaro$q$, $q$Montenegro$q$, 23, NULL, NULL, $q$https://www.amaromontenegro.com/en$q$, $q$producer$q$),
($q$Mr Black Coffee Amaro$q$, $q$Mr Black Amaro$q$, $q$Amaro$q$, $q$Mr Black$q$, 28.5, $q$AU$q$, NULL, $q$https://www.mrblack.co/en-us/products/coffee-amaro-new$q$, $q$producer$q$),
($q$Amaro Nardini$q$, $q$Amaro Nardini$q$, $q$Amaro$q$, $q$Nardini$q$, NULL, $q$IT$q$, NULL, $q$https://www.nardini.it/product/19646686/amaro-nardini$q$, $q$producer$q$),
($q$Bitter Nardini$q$, NULL, $q$Bitter Aperitivo$q$, $q$Nardini$q$, NULL, $q$IT$q$, NULL, $q$https://www.nardini.it/product/19646687/bitter-nardini$q$, $q$producer$q$),
($q$Mezzoemezzo Nardini$q$, NULL, $q$Rabarbaro$q$, $q$Nardini$q$, 22, NULL, NULL, $q$https://www.nardini.it/product/35484696/mezzoemezzo-nardini$q$, $q$producer$q$),
($q$Nardini Bitter Chinato$q$, NULL, $q$Bitter Aperitivo$q$, $q$Nardini$q$, NULL, NULL, NULL, $q$https://www.nardini.it/product/19646692/bitter-chinato$q$, $q$producer$q$),
($q$Rabarbaro Nardini$q$, NULL, $q$Rabarbaro$q$, $q$Nardini$q$, NULL, $q$IT$q$, NULL, $q$https://www.nardini.it/product/19646691/rabarbaro-nardini$q$, $q$producer$q$),
($q$Rosso Nardini$q$, NULL, $q$Bitter Aperitivo$q$, $q$Nardini$q$, NULL, $q$IT$q$, NULL, $q$https://www.nardini.it/product/22368707/rosso-nardini$q$, $q$producer$q$),
($q$Neumeister Wermut Rot BIO$q$, NULL, $q$Sweet Vermouth$q$, $q$Neumeister$q$, 17, $q$AT$q$, NULL, $q$https://www.neumeister.cc/produkt/wermut-rot-bio/$q$, $q$producer$q$),
($q$Neumeister Wermut Weiß BIO$q$, NULL, $q$Bianco Vermouth$q$, $q$Neumeister$q$, 16, $q$AT$q$, NULL, $q$https://www.neumeister.cc/produkt/wermut-weiss-bio-2/$q$, $q$producer$q$),
($q$Noilly Prat Original Dry$q$, $q$Noilly Prat Original Dry Vermouth$q$, $q$Dry Vermouth$q$, $q$Noilly Prat$q$, 18, $q$FR$q$, NULL, $q$https://www.noillyprat.com/original-dry-vermouth/$q$, $q$producer$q$),
($q$Amaro Nonino Quintessentia$q$, $q$Amaro Nonino$q$, $q$Amaro$q$, $q$Nonino$q$, 35, $q$IT$q$, NULL, $q$https://www.grappanonino.it/en/amaro-and-liqueurs/amaro-nonino-quintessentia/$q$, $q$producer$q$),
($q$L'Aperitivo Nonino BotanicalDrink$q$, $q$Nonino Aperitivo$q$, $q$Bitter Aperitivo$q$, $q$Nonino$q$, 21, $q$IT$q$, NULL, $q$https://www.grappanonino.it/en/amaro-and-liqueurs/laperitivo-nonino-botanicaldrink/$q$, $q$producer$q$),
($q$OSCAR.697 Bianco$q$, NULL, $q$Bianco Vermouth$q$, $q$Oscar.697$q$, NULL, $q$IT$q$, NULL, $q$https://www.oscar697.com/products$q$, $q$producer$q$),
($q$OSCAR.697 Extra Dry$q$, NULL, $q$Dry Vermouth$q$, $q$Oscar.697$q$, NULL, $q$IT$q$, NULL, $q$https://www.oscar697.com/products$q$, $q$producer$q$),
($q$OSCAR.697 Rosso$q$, $q$Oscar.697 Rosso Vermouth$q$, $q$Sweet Vermouth$q$, $q$Oscar.697$q$, NULL, $q$IT$q$, NULL, $q$https://www.oscar697.com/products$q$, $q$producer$q$),
($q$Otto's Athens Vermouth$q$, NULL, $q$Vermouth$q$, $q$Otto's$q$, 17, $q$GR$q$, NULL, $q$https://www.lcbo.com/en/otto-s-athens-vermouth-27139$q$, $q$retailer$q$),
($q$Pampelle Grapefruit Aperitif$q$, $q$Pampelle$q$, $q$Bitter Aperitivo$q$, $q$Pampelle$q$, NULL, NULL, NULL, $q$https://www.pampelle.com/$q$, $q$producer$q$),
($q$Amaro CioCiaro$q$, $q$Amaro CioCiaro$q$, $q$Amaro$q$, $q$Paolucci$q$, 30, $q$IT$q$, NULL, $q$https://specsonline.com/shop/spirits/paolucci-amaro-ciociara/$q$, $q$retailer$q$),
($q$Peychaud's Aperitivo$q$, $q$Peychaud's Aperitivo$q$, $q$Bittersweet Orange Aperitivo$q$, $q$Peychaud's$q$, 11, $q$IT$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/5651/peychauds-aperitivo$q$, $q$reference$q$),
($q$Picon Bière$q$, $q$Picon Biere Amaro$q$, $q$Amaro$q$, $q$Picon$q$, 18, $q$FR$q$, NULL, $q$https://www.whisky.fr/en/picon-biere.html$q$, $q$retailer$q$),
($q$Picon Club$q$, NULL, $q$Amaro$q$, $q$Picon$q$, 18, $q$FR$q$, NULL, $q$https://www.whisky.fr/en/picon-club.html$q$, $q$retailer$q$),
($q$Poli Airone Rosso$q$, NULL, $q$Bitter Aperitivo$q$, $q$Poli$q$, 17, $q$IT$q$, NULL, $q$https://www.poligrappa.com/ita/liquori/aperitivo-di-poli$q$, $q$producer$q$),
($q$Amaro Balsamico 1890$q$, NULL, $q$Amaro$q$, $q$Quaglia$q$, NULL, $q$IT$q$, NULL, $q$https://distilleriaquaglia.it/prodotto/amaro-balsamico-1890/$q$, $q$producer$q$),
($q$Amaro Martina$q$, NULL, $q$Amaro$q$, $q$Quaglia$q$, 38, $q$IT$q$, NULL, $q$https://distilleriaquaglia.it/prodotto/amaro-martina/$q$, $q$producer$q$),
($q$Bèrto Liquore Amaro$q$, NULL, $q$Bitter Aperitivo$q$, $q$Quaglia$q$, 25, $q$IT$q$, NULL, $q$https://distilleriaquaglia.it/prodotto/liquore-amaro-berto-bitter/$q$, $q$producer$q$),
($q$Bèrto Liquore Arancio e Genziana$q$, NULL, $q$Bittersweet Orange Aperitivo$q$, $q$Quaglia$q$, 15, $q$IT$q$, NULL, $q$https://distilleriaquaglia.it/prodotto/liquore-arancio-e-genziana/$q$, $q$producer$q$),
($q$Bèrto Vermouth di Torino Bianco$q$, NULL, $q$Bianco Vermouth$q$, $q$Quaglia$q$, 17, $q$IT$q$, $q$Vermouth di Torino$q$, $q$https://distilleriaquaglia.it/prodotto/vermouth-bianco-di-torino-apertiv-dla-tradission/$q$, $q$producer$q$),
($q$Bèrto Vermouth di Torino Dry$q$, NULL, $q$Dry Vermouth$q$, $q$Quaglia$q$, 19, $q$IT$q$, $q$Vermouth di Torino$q$, $q$https://distilleriaquaglia.it/prodotto/vermouth-secco-berto-dry/$q$, $q$producer$q$),
($q$Bèrto Vermouth di Torino Rosso$q$, $q$Berto Vermouth Rosso$q$, $q$Sweet Vermouth$q$, $q$Quaglia$q$, 17, $q$IT$q$, $q$Vermouth di Torino$q$, $q$https://distilleriaquaglia.it/prodotto/vermouth-rosso-di-torino-ross-da-travaj/$q$, $q$producer$q$),
($q$Bèrto Vermouth di Torino Superiore Bianco$q$, NULL, $q$Bianco Vermouth$q$, $q$Quaglia$q$, 18, $q$IT$q$, $q$Vermouth di Torino Superiore$q$, $q$https://distilleriaquaglia.it/prodotto/vermouth-superiore-bianco-di-torino/$q$, $q$producer$q$),
($q$Bèrto Vermouth di Torino Superiore Rosso$q$, NULL, $q$Sweet Vermouth$q$, $q$Quaglia$q$, 18, $q$IT$q$, $q$Vermouth di Torino Superiore$q$, $q$https://distilleriaquaglia.it/prodotto/vermouth-superiore-rosso-di-torino/$q$, $q$producer$q$),
($q$Quaglia Amaro Balsamico 1890$q$, NULL, $q$Amaro$q$, $q$Quaglia$q$, 19, $q$IT$q$, NULL, $q$https://distilleriaquaglia.it/prodotto/amaro-balsamico-1890/$q$, $q$producer$q$),
($q$Quaglia Amaro Classico 1890$q$, NULL, $q$Amaro$q$, $q$Quaglia$q$, 25, $q$IT$q$, NULL, $q$https://distilleriaquaglia.it/prodotto/amaro-classico-1890/$q$, $q$producer$q$),
($q$Quaglia Amaro alle Erbe Biologico$q$, NULL, $q$Amaro$q$, $q$Quaglia$q$, 30, $q$IT$q$, NULL, $q$https://distilleriaquaglia.it/prodotto/amaro-alle-erbe-biologico/$q$, $q$producer$q$),
($q$Quaglia Barolo Chinato$q$, NULL, $q$Vino Amaro$q$, $q$Quaglia$q$, 17, $q$IT$q$, $q$Barolo Chinato$q$, $q$https://distilleriaquaglia.it/prodotto/barolo-chinato/$q$, $q$producer$q$),
($q$Quaglia Fernet$q$, NULL, $q$Fernet$q$, $q$Quaglia$q$, 40, $q$IT$q$, NULL, $q$https://distilleriaquaglia.it/prodotto/fernet/$q$, $q$producer$q$),
($q$Quaglia Liquore al Rabarbaro$q$, NULL, $q$Rabarbaro$q$, $q$Quaglia$q$, 20, $q$IT$q$, NULL, $q$https://distilleriaquaglia.it/prodotto/liquore-al-rabarbaro/$q$, $q$producer$q$),
($q$Quaglia Vecchio Amaro Piemontese$q$, NULL, $q$Amaro$q$, $q$Quaglia$q$, 25, $q$IT$q$, NULL, $q$https://distilleriaquaglia.it/prodotto/vecchio-amaro-piemontese/$q$, $q$producer$q$),
($q$Quaglia Vermouth di Torino Superiore Rosso$q$, NULL, $q$Sweet Vermouth$q$, $q$Quaglia$q$, 18, $q$IT$q$, $q$Vermouth di Torino Superiore$q$, $q$https://distilleriaquaglia.it/prodotto/vermouth-di-torino-superiore-rosso/$q$, $q$producer$q$),
($q$Vermouth di Torino Superiore Rosso Quaglia$q$, NULL, $q$Sweet Vermouth$q$, $q$Quaglia$q$, 18, $q$IT$q$, $q$Vermouth di Torino Superiore$q$, $q$https://distilleriaquaglia.it/prodotto/vermouth-di-torino-superiore-rosso/$q$, $q$producer$q$),
($q$Amaro Ramazzotti$q$, $q$Ramazzotti$q$, $q$Amaro$q$, $q$Ramazzotti$q$, 30, $q$IT$q$, NULL, $q$https://pernod-ricard.com/en/brands/ramazzotti$q$, $q$producer$q$),
($q$Ramazzotti Aperitivo Rosato$q$, NULL, $q$Bitter Aperitivo$q$, $q$Ramazzotti$q$, 15, $q$IT$q$, NULL, $q$https://pernod-ricard.com/en/brands/ramazzotti$q$, $q$producer$q$),
($q$Regal Rogue Bold Red$q$, $q$Regal Rogue Bold Red Vermouth$q$, $q$Sweet Vermouth$q$, $q$Regal Rogue$q$, NULL, $q$AU$q$, NULL, $q$https://regalrogue.com/our-varietals/$q$, $q$producer$q$),
($q$Regal Rogue Daring Dry$q$, $q$Regal Rogue Daring Dry Vermouth$q$, $q$Dry Vermouth$q$, $q$Regal Rogue$q$, NULL, $q$AU$q$, NULL, $q$https://regalrogue.com/our-varietals/$q$, $q$producer$q$),
($q$Regal Rogue Lively White$q$, $q$Regal Rogue Lively White Vermouth$q$, $q$Bianco Vermouth$q$, $q$Regal Rogue$q$, NULL, $q$AU$q$, NULL, $q$https://regalrogue.com/our-varietals/$q$, $q$producer$q$),
($q$Regal Rogue Wild Rosé$q$, $q$Regal Rogue Wild Rosé Vermouth$q$, $q$Rosé Vermouth$q$, $q$Regal Rogue$q$, NULL, $q$AU$q$, NULL, $q$https://regalrogue.com/our-varietals/$q$, $q$producer$q$),
($q$Rinomato Americano Bianco$q$, $q$Rinomato Americano$q$, $q$Americano Aperitif Wine$q$, $q$Rinomato$q$, 17, $q$IT$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/6899/rinomato-americano-bianco$q$, $q$reference$q$),
($q$Rinomato Aperitivo Deciso$q$, $q$Rinomato Aperitivo$q$, $q$Americano Aperitif Wine$q$, $q$Rinomato$q$, 14, $q$IT$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/7295/rinomato-aperitivo-deciso$q$, $q$reference$q$),
($q$Sacred English Amber Vermouth$q$, NULL, $q$Ambrato Vermouth$q$, $q$Sacred$q$, NULL, $q$GB$q$, NULL, $q$https://sacredgin.com/products/sacred-english-amber-vermouth-1$q$, $q$producer$q$),
($q$Sacred English Dry Vermouth$q$, NULL, $q$Dry Vermouth$q$, $q$Sacred$q$, NULL, $q$GB$q$, NULL, $q$https://sacredgin.com/products/sacred-english-dry-vermouth-1$q$, $q$producer$q$),
($q$Sacred English Spiced Vermouth$q$, NULL, $q$Vermouth$q$, $q$Sacred$q$, NULL, $q$GB$q$, NULL, $q$https://sacredgin.com/products/sacred-english-spiced-vermouth-1$q$, $q$producer$q$),
($q$Sacred Rosehip Cup$q$, NULL, $q$Bitter Aperitivo$q$, $q$Sacred$q$, NULL, $q$GB$q$, NULL, $q$https://sacredgin.com/products/sacred-rosehip-cup$q$, $q$producer$q$),
($q$Salers Gentian Apéritif$q$, $q$Salers Gentiane Aperitif$q$, $q$Gentian Aperitif$q$, $q$Salers$q$, 16, $q$FR$q$, NULL, $q$https://alpenz.com/producer-distillerie_de_la_salers.html$q$, $q$retailer$q$),
($q$Amaro Santoni$q$, $q$Amaro Santoni$q$, $q$Bitter Aperitivo$q$, $q$Santoni$q$, 16, $q$IT$q$, NULL, $q$https://amarosantoni.com/prodotto/amaro-santoni/$q$, $q$producer$q$),
($q$Sarti Rosa$q$, NULL, $q$Bittersweet Orange Aperitivo$q$, $q$Sarti$q$, NULL, NULL, NULL, $q$https://theliquorbarn.com/collections/aperitifs/products/sarti-aperitivo-rosa-750ml$q$, $q$retailer$q$),
($q$Savoia Americano Rosso$q$, $q$Savoia Americano Rosso$q$, $q$Vino Amaro$q$, $q$Savoia$q$, 18.6, $q$IT$q$, NULL, $q$https://casa-savoia.com/savoia-rosso-update/$q$, $q$producer$q$),
($q$Savoia Orancio$q$, $q$Savoia Orancio$q$, $q$Aromatised Wine$q$, $q$Savoia$q$, 17.2, $q$IT$q$, NULL, $q$https://casa-savoia.com/savoia-orancio-update/$q$, $q$producer$q$),
($q$Select Aperitivo$q$, $q$Select Aperitivo$q$, $q$Bitter Aperitivo$q$, $q$Select$q$, 17.5, NULL, NULL, $q$https://www.selectaperitivo.com/$q$, $q$producer$q$),
($q$Sipello$q$, $q$Sipello$q$, $q$Bitter Aperitivo$q$, $q$Sipello$q$, 22, NULL, NULL, $q$https://www.sipello.com/product/sipello/$q$, $q$producer$q$),
($q$St Raphaël Classique Ambré$q$, NULL, $q$Quinquina$q$, $q$St Raphaël$q$, NULL, $q$FR$q$, NULL, $q$https://www.straphael.fr/nos-aperitifs/$q$, $q$producer$q$),
($q$St Raphaël Classique Rouge$q$, NULL, $q$Quinquina$q$, $q$St Raphaël$q$, NULL, $q$FR$q$, NULL, $q$https://www.straphael.fr/nos-aperitifs/$q$, $q$producer$q$),
($q$St Raphaël Quina Ambré$q$, NULL, $q$Quinquina$q$, $q$St Raphaël$q$, NULL, $q$FR$q$, NULL, $q$https://www.straphael.fr/nos-aperitifs/$q$, $q$producer$q$),
($q$St Raphaël Quina Rouge$q$, NULL, $q$Quinquina$q$, $q$St Raphaël$q$, NULL, $q$FR$q$, NULL, $q$https://www.straphael.fr/nos-aperitifs/$q$, $q$producer$q$),
($q$St. Agrestis Inferno Bitter$q$, $q$St. Agrestis Inferno Bitter Aperitivo$q$, $q$Bitter Aperitivo$q$, $q$St. Agrestis$q$, 24, $q$US$q$, NULL, $q$https://www.skurnik.com/sku/inferno-bitter-st-agrestis/$q$, $q$retailer$q$),
($q$St. George Bruto Americano$q$, $q$St. George Bruto Americano$q$, $q$Bitter Aperitivo$q$, $q$St. George$q$, 24, $q$US$q$, NULL, $q$https://stgeorgespirits.com/spirits/bruto-americano$q$, $q$producer$q$),
($q$Stillgarden O'Maro Irish Amaro$q$, $q$Stillgarden O'Maro Irish Amaro$q$, $q$Amaro$q$, $q$Stillgarden$q$, NULL, $q$IE$q$, NULL, $q$https://stillgardendistillery.com/product/omaro-irish-omaro/$q$, $q$producer$q$),
($q$Strucchi Bitter$q$, NULL, $q$Bitter Aperitivo$q$, $q$Strucchi$q$, NULL, $q$IT$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/8203/strucchi-bitter$q$, $q$reference$q$),
($q$Strucchi Bitter Bianco$q$, $q$Strucchi Bitter Bianco$q$, $q$Bitter Bianco$q$, $q$Strucchi$q$, 27, $q$IT$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/13925/strucchi-bitter-bianco$q$, $q$reference$q$),
($q$Vermouth alla Maniera di Strucchi Bianco$q$, NULL, $q$Bianco Vermouth$q$, $q$Strucchi$q$, 16, $q$IT$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/8202/-strucchi-vermouth-bianco$q$, $q$reference$q$),
($q$Vermouth alla Maniera di Strucchi Dry$q$, $q$Strucchi Dry Vermouth$q$, $q$Dry Vermouth$q$, $q$Strucchi$q$, 18, $q$IT$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/8201/strucchi-vermouth-dry$q$, $q$reference$q$),
($q$Vermouth alla Maniera di Strucchi Rosso$q$, $q$Strucchi Rosso Sweet (rosso) Vermouth$q$, $q$Sweet Vermouth$q$, $q$Strucchi$q$, 16, $q$IT$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/wine-fortified/vermouth-and-aromatized-wines/BWS008200/-strucchi-vermouth-rosso$q$, $q$reference$q$),
($q$Super Cattivo Aperitivo Bianco Bitter$q$, NULL, $q$Bitter Bianco$q$, $q$Super Cattivo$q$, 20, NULL, NULL, $q$https://leonandsonwine.com/products/nv-super-cattivo-aperitivo-bianco-bitter-burgenland-austria$q$, $q$retailer$q$),
($q$Suze$q$, $q$Suze$q$, $q$Gentian Aperitif$q$, $q$Suze$q$, 15, $q$FR$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/181/suze$q$, $q$reference$q$),
($q$Fernet del Frate$q$, NULL, $q$Fernet$q$, $q$Tempus Fugit Spirits$q$, NULL, NULL, NULL, $q$https://www.tempusfugitspirits.com/products/fernet-del-frate/$q$, $q$producer$q$),
($q$Gentiane du Sommet$q$, NULL, $q$Gentian Aperitif$q$, $q$Tempus Fugit Spirits$q$, NULL, NULL, NULL, $q$https://www.tempusfugitspirits.com/products/gentiane-du-sommet/$q$, $q$producer$q$),
($q$Gran Classico Bitter$q$, $q$Gran Classico$q$, $q$Bitter Aperitivo$q$, $q$Tempus Fugit Spirits$q$, 28, $q$CH$q$, NULL, $q$https://www.tempusfugitspirits.com/products/gran-classico-bitter/$q$, $q$producer$q$),
($q$Kina L'Aéro d'Or$q$, $q$Kina L'Aéro d'Or$q$, $q$Quinquina$q$, $q$Tempus Fugit Spirits$q$, 18, NULL, NULL, $q$https://www.tempusfugitspirits.com/products/kina-laero-dor/$q$, $q$producer$q$),
($q$Cardamaro$q$, $q$Cardamaro$q$, $q$Vino Amaro$q$, $q$Tosti$q$, NULL, $q$IT$q$, NULL, $q$https://www.cardamaro.it/$q$, $q$producer$q$),
($q$Valentia Island Vermouth$q$, $q$Valentia Island Vermouth$q$, $q$Sweet Vermouth$q$, $q$Valentia Island Vermouth$q$, NULL, $q$IE$q$, NULL, $q$https://valentiaislandvermouth.ie/product/valentia-island-vermouth-70cl/$q$, $q$producer$q$),
($q$Amargo-Vallet$q$, $q$Amargo Vallet$q$, $q$Amaro$q$, $q$Vallet$q$, 45, $q$MX$q$, NULL, $q$https://www.skurnik.com/sku/liqueur-amargo-angostura-vallet/$q$, $q$retailer$q$),
($q$Fernet-Vallet$q$, $q$Fernet Vallet$q$, $q$Fernet$q$, $q$Vallet$q$, 35, $q$MX$q$, NULL, $q$https://www.skurnik.com/sku/liqueur-fernet-vallet/$q$, $q$retailer$q$),
($q$Granada-Vallet$q$, NULL, $q$Bitter Aperitivo$q$, $q$Vallet$q$, 32, $q$MX$q$, NULL, $q$https://www.skurnik.com/sku/liqueur-granada-vallet/$q$, $q$retailer$q$),
($q$Amaro Sibilla$q$, $q$Amaro Sibilla$q$, $q$Amaro$q$, $q$Varnelli$q$, NULL, NULL, NULL, $q$https://www.varnelli.it/en/amaro-sibilla$q$, $q$producer$q$),
($q$Vault Bitter Aperitivo Rosemary & Orange$q$, NULL, $q$Bitter Aperitivo$q$, $q$Vault$q$, NULL, $q$GB$q$, NULL, $q$https://www.vaultaperitivo.com/product-page/bitter-rosemary-orange$q$, $q$producer$q$),
($q$Vault Coastal Dry Vermouth$q$, NULL, $q$Dry Vermouth$q$, $q$Vault$q$, NULL, $q$GB$q$, NULL, $q$https://www.vaultaperitivo.com/product-page/coastal-vermouth$q$, $q$producer$q$),
($q$Vault Forest Red Vermouth$q$, NULL, $q$Sweet Vermouth$q$, $q$Vault$q$, NULL, $q$GB$q$, NULL, $q$https://www.vaultaperitivo.com/product-page/forest-vermouth$q$, $q$producer$q$),
($q$Vault Meadow White Vermouth$q$, NULL, $q$Bianco Vermouth$q$, $q$Vault$q$, NULL, $q$GB$q$, NULL, $q$https://www.vaultaperitivo.com/product-page/meadow-vermouth$q$, $q$producer$q$),
($q$Vault Wildflowers Dry Vermouth$q$, NULL, $q$Dry Vermouth$q$, $q$Vault$q$, NULL, $q$GB$q$, NULL, $q$https://www.vaultaperitivo.com/product-page/wildflowers-dry-vermouth$q$, $q$producer$q$),
($q$Vergano Americano$q$, NULL, $q$Americano Aperitif Wine$q$, $q$Vergano$q$, NULL, $q$IT$q$, NULL, $q$https://louisdressner.com/producers/chinati+vergano$q$, $q$reference$q$),
($q$Vergano Chinato$q$, NULL, $q$Vino Amaro$q$, $q$Vergano$q$, NULL, $q$IT$q$, NULL, $q$https://louisdressner.com/producers/chinati+vergano$q$, $q$reference$q$),
($q$Vergano Luli$q$, NULL, $q$Vino Amaro$q$, $q$Vergano$q$, NULL, $q$IT$q$, NULL, $q$https://louisdressner.com/producers/chinati+vergano$q$, $q$reference$q$),
($q$Vergano Vermouth$q$, NULL, $q$Vermouth$q$, $q$Vergano$q$, NULL, $q$IT$q$, NULL, $q$https://louisdressner.com/producers/chinati+vergano$q$, $q$reference$q$),
($q$Vya Extra Dry$q$, $q$Vya Extra Dry Vermouth$q$, $q$Dry Vermouth$q$, $q$Vya$q$, NULL, NULL, NULL, $q$https://vya.com/wine/extra-dry/$q$, $q$producer$q$),
($q$Vya Sweet$q$, $q$Vya Sweet Vermouth$q$, $q$Sweet Vermouth$q$, $q$Vya$q$, NULL, NULL, NULL, $q$https://vya.com/wine/sweet/$q$, $q$producer$q$),
($q$Rabarbaro Zucca$q$, $q$Zucca Rabarbaro$q$, $q$Rabarbaro$q$, $q$Zucca$q$, 16, $q$IT$q$, NULL, $q$https://www.diffordsguide.com/beer-wine-spirits/151/zucca-rabarbaro$q$, $q$reference$q$),
($q$Unicum$q$, $q$Unicum$q$, $q$Amaro$q$, $q$Zwack$q$, 40, $q$HU$q$, NULL, $q$https://zwackunicum.hu/en/portfolio/unicum/$q$, $q$producer$q$),
($q$Unicum Barista$q$, NULL, $q$Amaro$q$, $q$Zwack$q$, NULL, $q$HU$q$, NULL, $q$https://zwackunicum.hu/en/portfolio/unicum-barista/$q$, $q$producer$q$),
($q$Unicum Plum$q$, NULL, $q$Amaro$q$, $q$Zwack$q$, 34.5, $q$HU$q$, NULL, $q$https://zwackunicum.hu/en/portfolio/unicum-szilva/$q$, $q$producer$q$),
($q$Unicum Riserva$q$, NULL, $q$Amaro$q$, $q$Zwack$q$, NULL, $q$HU$q$, NULL, $q$https://zwackunicum.hu/en/portfolio/unicum-riserva/$q$, $q$producer$q$);

-- Which row each bottle is: the catalog's row (by its name or an alias), else
-- one already called by the label name. Two checks that land on one row keep
-- the producer's own page.
CREATE TEMP TABLE bottle_row AS
SELECT DISTINCT ON (COALESCE(x.id::text, public.ingredient_key(x.label_name))) x.*
  FROM (SELECT b.*, COALESCE(pg_temp.shared(b.catalog_name), pg_temp.shared(b.label_name)) AS id FROM bottle_in b) x
 ORDER BY COALESCE(x.id::text, public.ingredient_key(x.label_name)), (x.kind = 'producer') DESC, (x.abv IS NOT NULL) DESC,
          length(x.label_name) DESC, x.label_name;

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

-- Bottles we had: a bottle, its checked style, and what was missing.
UPDATE public.items i SET
    ingredient_role = 'product',
    made_from_id = NULL,
    -- A page that names no colour doesn't undo a bottle already filed by colour.
    generic_id = CASE WHEN b.style = 'Vermouth' AND EXISTS (
                          SELECT 1 FROM public.items g WHERE g.id = i.generic_id AND g.generic_id = pg_temp.style('Vermouth'))
                      THEN i.generic_id ELSE pg_temp.style(b.style) END,
    brand_maker = COALESCE(NULLIF(btrim(i.brand_maker), ''), b.producer),
    abv = COALESCE(i.abv, b.abv),
    origin_country = COALESCE(i.origin_country, b.country),
    gi = COALESCE(i.gi, b.gi),
    maker_profile_id = COALESCE(i.maker_profile_id, pg_temp.maker(b.producer))
  FROM bottle_row b
 WHERE i.id = b.id AND NOT i.is_core AND i.bar_id IS NULL
   AND pg_temp.style(b.style) IS NOT NULL
   AND (i.ingredient_role IS DISTINCT FROM 'product'
        OR (i.generic_id IS DISTINCT FROM pg_temp.style(b.style) AND NOT (b.style = 'Vermouth' AND EXISTS (
                SELECT 1 FROM public.items g WHERE g.id = i.generic_id AND g.generic_id = pg_temp.style('Vermouth'))))
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
   AND NOT i.is_core
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

DROP TABLE "maker_in", "bottle_in", "bottle_row", "renamed";
DROP FUNCTION pg_temp.shared(text);
DROP FUNCTION pg_temp.style(text);
DROP FUNCTION pg_temp.maker(text);
RESET "app.image_worker";
