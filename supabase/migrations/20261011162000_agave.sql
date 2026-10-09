-- Tequila, mezcal and other agave spirits: every bottle checked on its
-- producer's own page (or, where that page was blocked, a major retailer,
-- importer or Difford's), after 20261011161000. Step 3e of the bottle
-- catalog plan: https://claude.ai/artifact/Vu6seuSNtN42nKYb2nDCVR
--
--   * The core range of every tequila, mezcal, raicilla, bacanora and
--     sotol house in our catalog or on BC Liquor's list.
--   * On a copy of production (2026-10-09, with the loads before this
--     one applied): 229 new bottles, and 138 we had that get their
--     label name (86 renamed, the old name kept as an alias), style,
--     ABV, country, protected name and maker where they were missing or
--     wrong.
--   * Styles: Blanco, joven, reposado, añejo, extra añejo and
--     cristalino tequila; espadín, tobalá, cupreata, salmiana and
--     ensamble mezcal, and Mezcal for other agaves or labels that name
--     none; raicilla, bacanora, sotol, and Agave Spirit for destilados
--     outside the denominations. New styles: Joven Tequila, Extra Añejo
--     Tequila.
--   * Out of scope: flavoured tequilas and agave liqueurs, agave syrup,
--     ready-to-drink cans.
--   * Each producer gets an unclaimed maker page (makes: bottles), or a
--     page an earlier load made gains it, and each bottle names it.
--   * Every fact keeps the page it was checked on in item_sources. An
--     ABV read off another page isn't kept, and a review site isn't a
--     source.
--   * An independent second check of 100 random rows found 11 wrong
--     facts in 582 (1.9%). Every correction is taken: every correction
--     is a mezcal style: three Dixeebe bottles are labelled destilado
--     de agave, so they file as Agave Spirit with no Mezcal GI;
--     Derrumbes Tamaulipas and Creyente Cristalino are Ensamble Mezcal;
--     Banhez Pechuga, Derrumbes Oaxaca and Del Maguey Las Milpas are
--     Espadín Mezcal. ABVs read off a brand-wide page footer are not
--     kept.
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
(0, $q$Agave Spirit$q$, NULL),
(1, $q$Tequila$q$, $q$Agave Spirit$q$),
(2, $q$Joven Tequila$q$, $q$Tequila$q$),
(3, $q$Extra Añejo Tequila$q$, $q$Tequila$q$),
(4, $q$Mezcal$q$, $q$Agave Spirit$q$);

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
($q$San Luis Potosí Mezcal$q$),
($q$Maguey Puebla Mezcal$q$),
($q$Indian Agave Spirit$q$),
($q$Mezcal Joven$q$),
($q$Mezcal Blanco$q$),
($q$Mezcal Reposado$q$),
($q$Mezcal Añejo$q$),
($q$Aged Tequila$q$),
($q$Agave Blanco$q$),
($q$Sotol Blanco$q$);

-- ---------------------------------------------------------------------------
-- Maker pages
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE maker_in (name text PRIMARY KEY, handle text NOT NULL, website text, country text, part_of text);
INSERT INTO maker_in VALUES
($q$1800$q$, $q$1800$q$, $q$https://www.1800tequila.com$q$, $q$MX$q$, NULL),
($q$400 Conejos$q$, $q$400.conejos$q$, $q$https://400conejos.com$q$, $q$MX$q$, NULL),
($q$818$q$, $q$818$q$, $q$https://drink818.com$q$, $q$MX$q$, NULL),
($q$Amarás$q$, $q$amaras$q$, $q$https://www.mezcalamaras.com/$q$, $q$MX$q$, NULL),
($q$Arette$q$, $q$arette$q$, $q$https://www.tequilaarette.com$q$, $q$MX$q$, NULL),
($q$Avión$q$, $q$avion$q$, $q$https://www.tequilaavion.com$q$, $q$MX$q$, NULL),
($q$Banhez$q$, $q$banhez$q$, $q$https://www.banhezmezcal.com$q$, $q$MX$q$, NULL),
($q$Bozal$q$, $q$bozal$q$, $q$https://bozalmezcal.com$q$, $q$MX$q$, NULL),
($q$Bruxo$q$, $q$bruxo$q$, $q$https://www.bruxomezcal.com$q$, $q$MX$q$, NULL),
($q$Cabo Wabo$q$, $q$cabo.wabo$q$, $q$https://www.cabowabo.com$q$, $q$MX$q$, NULL),
($q$Calle 23$q$, $q$calle.23$q$, NULL, $q$MX$q$, NULL),
($q$Casa Dragones$q$, $q$casa.dragones$q$, $q$https://casadragones.com$q$, $q$MX$q$, NULL),
($q$Casamigos$q$, $q$casamigos$q$, $q$https://www.casamigos.com$q$, $q$MX$q$, NULL),
($q$Cascahuín$q$, $q$cascahuin$q$, $q$https://www.tequilacascahuin.com$q$, $q$MX$q$, NULL),
($q$Cazadores$q$, $q$cazadores$q$, $q$https://www.cazadores.com$q$, $q$MX$q$, NULL),
($q$Cazcabel$q$, $q$cazcabel$q$, NULL, $q$MX$q$, NULL),
($q$Cimarrón$q$, $q$cimarron$q$, $q$https://tequilacimarron.com$q$, $q$MX$q$, NULL),
($q$Clase Azul$q$, $q$clase.azul$q$, $q$https://claseazul.com$q$, $q$MX$q$, NULL),
($q$Convite$q$, $q$convite$q$, $q$https://convitemezcal.com/$q$, $q$MX$q$, NULL),
($q$Corazón$q$, $q$corazon$q$, $q$https://www.tequilacorazon.com$q$, $q$MX$q$, NULL),
($q$Corralejo$q$, $q$corralejo$q$, $q$https://tequilacorralejo.mx$q$, $q$MX$q$, NULL),
($q$Creyente$q$, $q$creyente$q$, $q$https://mezcalcreyente.com$q$, $q$MX$q$, NULL),
($q$Código 1530$q$, $q$codigo.1530$q$, $q$https://www.codigo1530.com$q$, $q$MX$q$, NULL),
($q$Del Maguey$q$, $q$del.maguey$q$, $q$https://www.delmaguey.com$q$, $q$MX$q$, NULL),
($q$Derrumbes$q$, $q$derrumbes$q$, NULL, $q$MX$q$, NULL),
($q$Desert Door$q$, $q$desert.door$q$, $q$https://www.desertdoor.com$q$, $q$US$q$, NULL),
($q$Dixeebe$q$, $q$dixeebe$q$, $q$https://mezcaldixeebe.com$q$, $q$MX$q$, NULL),
($q$Don Fulano$q$, $q$don.fulano$q$, $q$https://donfulano.com$q$, $q$MX$q$, NULL),
($q$Don Julio$q$, $q$don.julio$q$, $q$https://www.donjulio.com$q$, $q$MX$q$, NULL),
($q$Don Ramón$q$, $q$don.ramon$q$, $q$https://casadonramon.com$q$, $q$MX$q$, NULL),
($q$Dos Hombres$q$, $q$dos.hombres$q$, $q$https://www.doshombres.com$q$, $q$MX$q$, NULL),
($q$El Jimador$q$, $q$el.jimador$q$, $q$https://www.eljimador.com$q$, $q$MX$q$, NULL),
($q$El Silencio$q$, $q$el.silencio$q$, $q$https://www.silencio.com$q$, $q$MX$q$, NULL),
($q$El Tequileño$q$, $q$el.tequileno$q$, $q$https://www.tequileno.com/$q$, $q$MX$q$, NULL),
($q$El Tesoro$q$, $q$el.tesoro$q$, $q$https://www.eltesorotequila.com/$q$, $q$MX$q$, NULL),
($q$Espolòn$q$, $q$espolon$q$, $q$https://www.espolontequila.com/$q$, $q$MX$q$, NULL),
($q$Estancia$q$, $q$estancia$q$, $q$https://estanciadestileria.com/$q$, $q$MX$q$, NULL),
($q$Exotico$q$, $q$exotico$q$, $q$https://exoticotequila.com/$q$, $q$MX$q$, NULL),
($q$Fandango$q$, $q$fandango$q$, NULL, $q$MX$q$, NULL),
($q$Fidencio$q$, $q$fidencio$q$, $q$https://www.creamwine.com/brand.php?id=92$q$, $q$MX$q$, NULL),
($q$Fortaleza$q$, $q$fortaleza$q$, $q$https://tequilafortaleza.com/$q$, $q$MX$q$, NULL),
($q$G4$q$, $q$g4.co$q$, $q$https://pkgdgroup.com/g4-tequila$q$, $q$MX$q$, NULL),
($q$Gran Centenario$q$, $q$gran.centenario$q$, $q$https://grancentenario.com/$q$, $q$MX$q$, NULL),
($q$Hacienda de Chihuahua$q$, $q$hacienda.de.chihuahua$q$, $q$https://sotol.com/$q$, $q$MX$q$, NULL),
($q$Herradura$q$, $q$herradura$q$, $q$https://www.herradura.com/$q$, $q$MX$q$, NULL),
($q$Hornitos$q$, $q$hornitos$q$, $q$https://www.hornitostequila.com/$q$, $q$MX$q$, NULL),
($q$Ilegal$q$, $q$ilegal$q$, $q$https://www.ilegalmezcal.com/$q$, $q$MX$q$, NULL),
($q$Jose Cuervo$q$, $q$jose.cuervo$q$, $q$https://cuervo.com/$q$, $q$MX$q$, NULL),
($q$La Venenosa$q$, $q$la.venenosa$q$, $q$https://www.creamwine.com/brand.php?id=1058$q$, $q$MX$q$, NULL),
($q$Legendario Domingo$q$, $q$legendario.domingo$q$, $q$https://vintus.com/producers/legendario-domingo/$q$, $q$MX$q$, NULL),
($q$Los Siete Misterios$q$, $q$los.siete.misterios$q$, $q$https://www.sietemisterios.com/$q$, $q$MX$q$, NULL),
($q$Lunazul$q$, $q$lunazul$q$, $q$https://www.lunazultequila.com/$q$, $q$MX$q$, NULL),
($q$Madre$q$, $q$madre$q$, $q$https://www.madremezcal.com/$q$, $q$MX$q$, NULL),
($q$Maestro Dobel$q$, $q$maestro.dobel$q$, $q$https://www.maestrodobel.com/$q$, $q$MX$q$, NULL),
($q$Marca Negra$q$, $q$marca.negra$q$, $q$https://www.mezcalmarcanegra.com/$q$, $q$MX$q$, NULL),
($q$Mayalen$q$, $q$mayalen$q$, $q$http://www.mezcalmayalen.com/$q$, $q$MX$q$, NULL),
($q$Mezcal Unión$q$, $q$mezcal.union$q$, $q$https://www.thebar.com/en-us/brands/mezcal-union$q$, $q$MX$q$, NULL),
($q$Mezcal Vago$q$, $q$mezcal.vago$q$, $q$https://mezcalvago.com/$q$, $q$MX$q$, NULL),
($q$Mezcal Verde$q$, $q$mezcal.verde$q$, NULL, $q$MX$q$, NULL),
($q$Mijenta$q$, $q$mijenta$q$, $q$https://mijenta-tequila.com$q$, $q$MX$q$, NULL),
($q$Montelobos$q$, $q$montelobos$q$, $q$https://www.montelobos.com$q$, $q$MX$q$, NULL),
($q$Nocheluna$q$, $q$nocheluna$q$, $q$https://www.casalumbre.com/nocheluna$q$, $q$MX$q$, NULL),
($q$Ojo de Dios$q$, $q$ojo.de.dios$q$, NULL, $q$MX$q$, NULL),
($q$Ojo de Tigre$q$, $q$ojo.de.tigre$q$, $q$https://ojodetigremezcal.com$q$, $q$MX$q$, NULL),
($q$Olmeca$q$, $q$olmeca$q$, $q$https://www.olmecatequila.com$q$, $q$MX$q$, NULL),
($q$Olmeca Altos$q$, $q$olmeca.altos$q$, $q$https://www.pernod-ricard.com/en/brands/altos$q$, $q$MX$q$, NULL),
($q$Origen Raíz$q$, $q$origen.raiz$q$, $q$https://www.origenraiz.com$q$, $q$MX$q$, NULL),
($q$Partida$q$, $q$partida$q$, $q$https://www.partidatequila.com$q$, $q$MX$q$, NULL),
($q$Patrón$q$, $q$patron$q$, $q$https://www.patrontequila.com$q$, $q$MX$q$, NULL),
($q$Pueblo Viejo$q$, $q$pueblo.viejo$q$, $q$https://sanmatias.com$q$, $q$MX$q$, NULL),
($q$Quiquiriqui$q$, $q$quiquiriqui$q$, $q$https://www.quiquiriquimezcal.com$q$, $q$MX$q$, NULL),
($q$Rancho Tepúa$q$, $q$rancho.tepua$q$, NULL, $q$MX$q$, NULL),
($q$Rey Campero$q$, $q$rey.campero$q$, $q$https://www.reycampero.com$q$, $q$MX$q$, NULL),
($q$Rosaluna$q$, $q$rosaluna$q$, $q$https://mezcalrosaluna.com$q$, $q$MX$q$, NULL),
($q$Sauza$q$, $q$sauza$q$, $q$https://www.sauzatequila.com$q$, $q$MX$q$, NULL),
($q$Siembra Azul$q$, $q$siembra.azul$q$, $q$https://agavesdemexico.com/siembra-azul/$q$, $q$MX$q$, NULL),
($q$Sierra$q$, $q$sierra$q$, NULL, $q$MX$q$, NULL),
($q$Siete Leguas$q$, $q$siete.leguas$q$, $q$https://tequilasieteleguas.com$q$, $q$MX$q$, NULL),
($q$Sombra$q$, $q$sombra$q$, NULL, $q$MX$q$, NULL),
($q$Sotol Por Siempre$q$, $q$sotol.por.siempre$q$, $q$https://backbarproject.com/portfolio/sotol-por-siempre/$q$, $q$MX$q$, NULL),
($q$Tapatío$q$, $q$tapatio$q$, $q$https://specialitybrands.com/range/tapatio/$q$, $q$MX$q$, NULL),
($q$Tequila Ocho$q$, $q$tequila.ocho$q$, $q$https://ochotequila.com$q$, $q$MX$q$, NULL),
($q$Teremana$q$, $q$teremana$q$, $q$https://www.teremana.com$q$, $q$MX$q$, NULL),
($q$The Lost Explorer$q$, $q$the.lost.explorer$q$, $q$https://thelostexplorer.com/$q$, $q$MX$q$, NULL),
($q$Tierra Noble$q$, $q$tierra.noble$q$, NULL, $q$MX$q$, NULL),
($q$Tres Agaves$q$, $q$tres.agaves$q$, $q$https://www.tresagaves.com$q$, $q$MX$q$, NULL),
($q$Tres Generaciones$q$, $q$tres.generaciones$q$, $q$https://www.tresgeneraciones.com$q$, $q$MX$q$, NULL),
($q$Tromba$q$, $q$tromba$q$, NULL, $q$MX$q$, NULL),
($q$Vivir$q$, $q$vivir$q$, NULL, $q$MX$q$, NULL),
($q$Wahaka$q$, $q$wahaka$q$, $q$https://www.wahakamezcal.com$q$, $q$MX$q$, NULL),
($q$Yuu Baal$q$, $q$yuu.baal$q$, NULL, $q$MX$q$, NULL);

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
($q$1800 Añejo$q$, NULL, $q$Añejo Tequila$q$, $q$1800$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.1800tequila.com/products/anejo$q$, $q$producer$q$),
($q$1800 Blanco$q$, $q$1800 Blanco Tequila$q$, $q$Blanco Tequila$q$, $q$1800$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.1800tequila.com/products/blanco$q$, $q$producer$q$),
($q$1800 Cristalino$q$, $q$1800 Cristalino$q$, $q$Cristalino Tequila$q$, $q$1800$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.1800tequila.com/products/cristalino$q$, $q$producer$q$),
($q$1800 High Proof Blanco$q$, NULL, $q$Blanco Tequila$q$, $q$1800$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.1800tequila.com/products/1800-high-proof-blanco$q$, $q$producer$q$),
($q$1800 High Proof Reposado$q$, NULL, $q$Reposado Tequila$q$, $q$1800$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.1800tequila.com/products/1800-high-proof-reposado$q$, $q$producer$q$),
($q$1800 Reposado$q$, $q$1800 Reposado Tequila$q$, $q$Reposado Tequila$q$, $q$1800$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.1800tequila.com/products/reposado$q$, $q$producer$q$),
($q$400 Conejos Añejo$q$, NULL, $q$Espadín Mezcal$q$, $q$400 Conejos$q$, 40, $q$MX$q$, $q$Mezcal$q$, $q$https://400conejos.com/products/anejo/$q$, $q$producer$q$),
($q$400 Conejos Cuishe$q$, NULL, $q$Ensamble Mezcal$q$, $q$400 Conejos$q$, 40, $q$MX$q$, $q$Mezcal$q$, $q$https://400conejos.com/products/cuishe/$q$, $q$producer$q$),
($q$400 Conejos Joven$q$, $q$400 Conejos Mezcal$q$, $q$Espadín Mezcal$q$, $q$400 Conejos$q$, 40, $q$MX$q$, $q$Mezcal$q$, $q$https://400conejos.com/products/joven/$q$, $q$producer$q$),
($q$400 Conejos Reposado$q$, NULL, $q$Espadín Mezcal$q$, $q$400 Conejos$q$, 40, $q$MX$q$, $q$Mezcal$q$, $q$https://400conejos.com/products/reposado/$q$, $q$producer$q$),
($q$400 Conejos Tobalá$q$, NULL, $q$Ensamble Mezcal$q$, $q$400 Conejos$q$, 40, $q$MX$q$, $q$Mezcal$q$, $q$https://400conejos.com/products/tobala/$q$, $q$producer$q$),
($q$818 Añejo$q$, NULL, $q$Añejo Tequila$q$, $q$818$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://drink818.com/products/818-anejo$q$, $q$producer$q$),
($q$818 Blanco$q$, NULL, $q$Blanco Tequila$q$, $q$818$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://drink818.com/products/818-blanco$q$, $q$producer$q$),
($q$818 Eight Reserve$q$, NULL, $q$Añejo Tequila$q$, $q$818$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://drink818.com/products/eightreserve$q$, $q$producer$q$),
($q$818 Reposado$q$, NULL, $q$Reposado Tequila$q$, $q$818$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://drink818.com/products/818-reposado$q$, $q$producer$q$),
($q$Amarás Americana$q$, NULL, $q$Mezcal$q$, $q$Amarás$q$, 40, $q$MX$q$, $q$Mezcal$q$, $q$https://www.mezcalamaras.com/$q$, $q$producer$q$),
($q$Amarás Cupreata$q$, NULL, $q$Cupreata Mezcal$q$, $q$Amarás$q$, 40.3, $q$MX$q$, $q$Mezcal$q$, $q$https://www.mezcalamaras.com/$q$, $q$producer$q$),
($q$Amarás Espadín Joven$q$, $q$Amarás Espadín Mezcal$q$, $q$Espadín Mezcal$q$, $q$Amarás$q$, 37, $q$MX$q$, $q$Mezcal$q$, $q$https://www.mezcalamaras.com/$q$, $q$producer$q$),
($q$Amarás Espadín Reposado$q$, NULL, $q$Espadín Mezcal$q$, $q$Amarás$q$, 37, $q$MX$q$, $q$Mezcal$q$, $q$https://www.mezcalamaras.com/$q$, $q$producer$q$),
($q$Amarás Espadín-Tobalá Ensamble$q$, NULL, $q$Ensamble Mezcal$q$, $q$Amarás$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.mezcalamaras.com/products/amaras-espadin-tobala-ensamble$q$, $q$producer$q$),
($q$Arette Artesanal Añejo Suave$q$, NULL, $q$Añejo Tequila$q$, $q$Arette$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.tequilaarette.com/$q$, $q$producer$q$),
($q$Arette Artesanal Blanco Fuerte$q$, NULL, $q$Blanco Tequila$q$, $q$Arette$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.tequilaarette.com/$q$, $q$producer$q$),
($q$Arette Artesanal Blanco Suave$q$, NULL, $q$Blanco Tequila$q$, $q$Arette$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.tequilaarette.com/$q$, $q$producer$q$),
($q$Arette Blanco$q$, $q$Arette Blanco Tequila$q$, $q$Blanco Tequila$q$, $q$Arette$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.tequilaarette.com/$q$, $q$producer$q$),
($q$Arette Gran Clase Extra Añejo$q$, NULL, $q$Extra Añejo Tequila$q$, $q$Arette$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.tequilaarette.com/$q$, $q$producer$q$),
($q$Arette Reposado$q$, $q$Arette Reposado Tequila$q$, $q$Reposado Tequila$q$, $q$Arette$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.tequilaarette.com/$q$, $q$producer$q$),
($q$Avión Reposado$q$, NULL, $q$Reposado Tequila$q$, $q$Avión$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/3492/avion-reposado-tequila$q$, $q$reference$q$),
($q$Avión Reserva Cristalino$q$, NULL, $q$Cristalino Tequila$q$, $q$Avión$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/7373/avion-reserva-cristalino$q$, $q$reference$q$),
($q$Avión Silver$q$, $q$Avión Silver$q$, $q$Blanco Tequila$q$, $q$Avión$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/3558/avion-silver-tequila$q$, $q$reference$q$),
($q$Banhez Arroqueño$q$, NULL, $q$Mezcal$q$, $q$Banhez$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.banhezmezcal.com/arroqueno$q$, $q$producer$q$),
($q$Banhez Cuishe$q$, NULL, $q$Mezcal$q$, $q$Banhez$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.banhezmezcal.com/cuishe$q$, $q$producer$q$),
($q$Banhez Ensamble$q$, $q$Banhez Ensamble Mezcal$q$, $q$Ensamble Mezcal$q$, $q$Banhez$q$, 42, $q$MX$q$, $q$Mezcal$q$, $q$https://www.banhezmezcal.com/ensamble$q$, $q$producer$q$),
($q$Banhez Espadín$q$, $q$Banhez Espadín Mezcal$q$, $q$Espadín Mezcal$q$, $q$Banhez$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.banhezmezcal.com/expressions$q$, $q$producer$q$),
($q$Banhez Jabalí$q$, NULL, $q$Mezcal$q$, $q$Banhez$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.banhezmezcal.com/jabali$q$, $q$producer$q$),
($q$Banhez Mexicano$q$, NULL, $q$Mezcal$q$, $q$Banhez$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.banhezmezcal.com/mexicano$q$, $q$producer$q$),
($q$Banhez Pechuga$q$, NULL, $q$Espadín Mezcal$q$, $q$Banhez$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.banhezmezcal.com/pechuga$q$, $q$producer$q$),
($q$Banhez Tepeztate$q$, NULL, $q$Mezcal$q$, $q$Banhez$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.banhezmezcal.com/tepeztate$q$, $q$producer$q$),
($q$Banhez Tobalá$q$, NULL, $q$Tobalá Mezcal$q$, $q$Banhez$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.banhezmezcal.com/tobala$q$, $q$producer$q$),
($q$Bozal Borrego$q$, NULL, $q$Mezcal$q$, $q$Bozal$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://bozalmezcal.com/spirits/$q$, $q$producer$q$),
($q$Bozal Cenizo$q$, NULL, $q$Mezcal$q$, $q$Bozal$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://bozalmezcal.com/spirits/$q$, $q$producer$q$),
($q$Bozal Cuishe$q$, NULL, $q$Mezcal$q$, $q$Bozal$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://bozalmezcal.com/spirits/$q$, $q$producer$q$),
($q$Bozal Ensamble$q$, $q$Bozal Ensamble Mezcal$q$, $q$Ensamble Mezcal$q$, $q$Bozal$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://bozalmezcal.com/spirits/$q$, $q$producer$q$),
($q$Bozal Guías de Calabaza$q$, NULL, $q$Mezcal$q$, $q$Bozal$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://bozalmezcal.com/spirits/$q$, $q$producer$q$),
($q$Bozal Jamón Ibérico$q$, NULL, $q$Mezcal$q$, $q$Bozal$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://bozalmezcal.com/spirits/$q$, $q$producer$q$),
($q$Bozal Madrecuishe$q$, NULL, $q$Mezcal$q$, $q$Bozal$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://bozalmezcal.com/spirits/$q$, $q$producer$q$),
($q$Bozal Pechuga$q$, NULL, $q$Mezcal$q$, $q$Bozal$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://bozalmezcal.com/spirits/$q$, $q$producer$q$),
($q$Bozal Sacatoro$q$, NULL, $q$Mezcal$q$, $q$Bozal$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://bozalmezcal.com/spirits/$q$, $q$producer$q$),
($q$Bozal Tepeztate$q$, NULL, $q$Mezcal$q$, $q$Bozal$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://bozalmezcal.com/spirits/$q$, $q$producer$q$),
($q$Bozal Tobasiche$q$, NULL, $q$Mezcal$q$, $q$Bozal$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://bozalmezcal.com/spirits/$q$, $q$producer$q$),
($q$Bruxo No.1 Espadín$q$, NULL, $q$Espadín Mezcal$q$, $q$Bruxo$q$, 46, $q$MX$q$, $q$Mezcal$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/5628/bruxo-no1-mezcal$q$, $q$reference$q$),
($q$Cabo Wabo Añejo$q$, NULL, $q$Añejo Tequila$q$, $q$Cabo Wabo$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.cabowabo.com/tequilas/anejo/$q$, $q$producer$q$),
($q$Cabo Wabo Blanco$q$, NULL, $q$Blanco Tequila$q$, $q$Cabo Wabo$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.cabowabo.com/tequilas/blanco/$q$, $q$producer$q$),
($q$Cabo Wabo Reposado$q$, NULL, $q$Reposado Tequila$q$, $q$Cabo Wabo$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.cabowabo.com/tequilas/reposado/$q$, $q$producer$q$),
($q$Calle 23 Añejo$q$, NULL, $q$Añejo Tequila$q$, $q$Calle 23$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/2282/calle-23-anjeo$q$, $q$reference$q$),
($q$Calle 23 Blanco$q$, $q$Calle 23 Blanco Tequila$q$, $q$Blanco Tequila$q$, $q$Calle 23$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/2280/calle-23-blanco-tequila$q$, $q$reference$q$),
($q$Calle 23 Criollo Blanco$q$, NULL, $q$Blanco Tequila$q$, $q$Calle 23$q$, 49.3, $q$MX$q$, $q$Tequila$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/6523/calle-23-criollo-blanco$q$, $q$reference$q$),
($q$Calle 23 Reposado$q$, NULL, $q$Reposado Tequila$q$, $q$Calle 23$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/2281/calle-23-reposado$q$, $q$reference$q$),
($q$200 Copas by Casa Dragones$q$, NULL, $q$Cristalino Tequila$q$, $q$Casa Dragones$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://casadragones.com/us/sipping-tequila/casa-dragones-cristalino-200-copas/$q$, $q$producer$q$),
($q$Casa Dragones Añejo Barrel Blend$q$, NULL, $q$Añejo Tequila$q$, $q$Casa Dragones$q$, NULL, NULL, NULL, $q$https://casadragones.com/us/sipping-tequila/casa-dragones-anejo$q$, $q$producer$q$),
($q$Casa Dragones Blanco$q$, $q$Casa Dragones Blanco$q$, $q$Blanco Tequila$q$, $q$Casa Dragones$q$, NULL, NULL, NULL, $q$https://casadragones.com/us/sipping-tequila/casa-dragones-blanco/$q$, $q$producer$q$),
($q$Casa Dragones Joven$q$, NULL, $q$Joven Tequila$q$, $q$Casa Dragones$q$, NULL, NULL, NULL, $q$https://casadragones.com/us/sipping-tequila/casa-dragones-joven/$q$, $q$producer$q$),
($q$Casa Dragones Reposado Mizunara$q$, $q$Casa Dragones Reposado Mizunara$q$, $q$Reposado Tequila$q$, $q$Casa Dragones$q$, NULL, NULL, NULL, $q$https://casadragones.com/us/sipping-tequila/casa-dragones-reposado/$q$, $q$producer$q$),
($q$Casamigos Añejo$q$, $q$Casamigos Añejo$q$, $q$Añejo Tequila$q$, $q$Casamigos$q$, NULL, NULL, NULL, $q$https://www.casamigos.com/en-us/our-tequilas/anejo$q$, $q$producer$q$),
($q$Casamigos Blanco$q$, $q$Casamigos Blanco Tequila$q$, $q$Blanco Tequila$q$, $q$Casamigos$q$, NULL, NULL, NULL, $q$https://www.casamigos.com/en-us/our-tequilas/blanco$q$, $q$producer$q$),
($q$Casamigos Cristalino$q$, NULL, $q$Cristalino Tequila$q$, $q$Casamigos$q$, NULL, NULL, NULL, $q$https://www.casamigos.com/en-us/our-tequilas/cristalino$q$, $q$producer$q$),
($q$Casamigos Joven Mezcal$q$, $q$Casamigos Joven Mezcal$q$, $q$Espadín Mezcal$q$, $q$Casamigos$q$, 40, $q$MX$q$, $q$Mezcal$q$, $q$https://www.casamigos.com/en-us/our-tequilas/mezcal$q$, $q$producer$q$),
($q$Casamigos Reposado$q$, $q$Casamigos Reposado$q$, $q$Reposado Tequila$q$, $q$Casamigos$q$, NULL, NULL, NULL, $q$https://www.casamigos.com/en-us/our-tequilas/reposado$q$, $q$producer$q$),
($q$Cascahuín Añejo$q$, NULL, $q$Añejo Tequila$q$, $q$Cascahuín$q$, 38, $q$MX$q$, $q$Tequila$q$, $q$https://www.tequilacascahuin.com/productos$q$, $q$producer$q$),
($q$Cascahuín Blanco$q$, $q$Cascahuin Blanco Tequila$q$, $q$Blanco Tequila$q$, $q$Cascahuín$q$, 38, $q$MX$q$, $q$Tequila$q$, $q$https://www.tequilacascahuin.com/productos$q$, $q$producer$q$),
($q$Cascahuín Extra Añejo$q$, NULL, $q$Extra Añejo Tequila$q$, $q$Cascahuín$q$, 43, $q$MX$q$, $q$Tequila$q$, $q$https://www.tequilacascahuin.com/productos$q$, $q$producer$q$),
($q$Cascahuín Plata$q$, $q$Cascahuín 48 Plata Tequila$q$, $q$Blanco Tequila$q$, $q$Cascahuín$q$, 48, $q$MX$q$, $q$Tequila$q$, $q$https://www.tequilacascahuin.com/productos$q$, $q$producer$q$),
($q$Cascahuín Reposado$q$, $q$Cascahuin Reposado$q$, $q$Reposado Tequila$q$, $q$Cascahuín$q$, 38, $q$MX$q$, $q$Tequila$q$, $q$https://www.tequilacascahuin.com/productos$q$, $q$producer$q$),
($q$Cascahuín Tahona$q$, NULL, $q$Blanco Tequila$q$, $q$Cascahuín$q$, 42, $q$MX$q$, $q$Tequila$q$, $q$https://www.tequilacascahuin.com/productos$q$, $q$producer$q$),
($q$Cazadores Añejo$q$, NULL, $q$Añejo Tequila$q$, $q$Cazadores$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.cazadores.com/us/en/our-tequila/cazadores-anejo/$q$, $q$producer$q$),
($q$Cazadores Añejo Cristalino$q$, NULL, $q$Cristalino Tequila$q$, $q$Cazadores$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.cazadores.com/us/en/our-tequila/cazadores-anejo-cristalino/$q$, $q$producer$q$),
($q$Cazadores Blanco$q$, $q$Cazadores Blanco Tequila$q$, $q$Blanco Tequila$q$, $q$Cazadores$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.cazadores.com/us/en/our-tequila/cazadores-blanco/$q$, $q$producer$q$),
($q$Cazadores Extra Añejo$q$, NULL, $q$Extra Añejo Tequila$q$, $q$Cazadores$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.cazadores.com/us/en/our-tequila/cazadores-extra-anejo/$q$, $q$producer$q$),
($q$Cazadores Reposado$q$, $q$Cazadores Reposado Tequila$q$, $q$Reposado Tequila$q$, $q$Cazadores$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.cazadores.com/us/en/our-tequila/cazadores-reposado/$q$, $q$producer$q$),
($q$Cazcabel Blanco$q$, $q$Cazcabel Blanco Tequila$q$, $q$Blanco Tequila$q$, $q$Cazcabel$q$, 38, $q$MX$q$, $q$Tequila$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/7765/cazcabel-blanco-tequila$q$, $q$reference$q$),
($q$Cimarrón Blanco$q$, $q$Cimarrón Blanco Tequila$q$, $q$Blanco Tequila$q$, $q$Cimarrón$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/8374/cimarron-blanco-tequila$q$, $q$reference$q$),
($q$Cimarrón Reposado$q$, $q$Cimarrón Reposado Tequila$q$, $q$Reposado Tequila$q$, $q$Cimarrón$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://tequilacimarron.com/$q$, $q$producer$q$),
($q$Clase Azul Añejo$q$, NULL, $q$Añejo Tequila$q$, $q$Clase Azul$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://claseazul.com/spirits/icons/clase-azul-tequila-anejo/$q$, $q$producer$q$),
($q$Clase Azul Blanco Ahumado$q$, NULL, $q$Blanco Tequila$q$, $q$Clase Azul$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://claseazul.com/spirits/icons/clase-azul-tequila-blanco-ahumado/$q$, $q$producer$q$),
($q$Clase Azul Gold$q$, NULL, $q$Joven Tequila$q$, $q$Clase Azul$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://claseazul.com/spirits/icons/clase-azul-tequila-gold/$q$, $q$producer$q$),
($q$Clase Azul Mezcal Durango$q$, NULL, $q$Mezcal$q$, $q$Clase Azul$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://claseazul.com/spirits/icons/clase-azul-mezcal-durango/$q$, $q$producer$q$),
($q$Clase Azul Mezcal Guerrero$q$, NULL, $q$Mezcal$q$, $q$Clase Azul$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://claseazul.com/spirits/icons/clase-azul-mezcal-guerrero/$q$, $q$producer$q$),
($q$Clase Azul Mezcal San Luis Potosí$q$, NULL, $q$Mezcal$q$, $q$Clase Azul$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://claseazul.com/spirits/icons/clase-azul-mezcal-san-luis-potosi/$q$, $q$producer$q$),
($q$Clase Azul Plata$q$, NULL, $q$Blanco Tequila$q$, $q$Clase Azul$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://claseazul.com/spirits/icons/clase-azul-tequila-plata/$q$, $q$producer$q$),
($q$Clase Azul Reposado$q$, $q$Clase Azul Reposado$q$, $q$Reposado Tequila$q$, $q$Clase Azul$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://claseazul.com/spirits/icons/clase-azul-tequila-reposado/$q$, $q$producer$q$),
($q$Convite Coyote$q$, NULL, $q$Mezcal$q$, $q$Convite$q$, 46, $q$MX$q$, $q$Mezcal$q$, $q$https://www.hotalingandco.com/portfolio/convite-mezcal/convite-mezcal-coyote$q$, $q$retailer$q$),
($q$Convite Esencial$q$, NULL, $q$Espadín Mezcal$q$, $q$Convite$q$, 40, $q$MX$q$, $q$Mezcal$q$, $q$https://www.hotalingandco.com/portfolio/convite-mezcal/convite-mezcal-esencial$q$, $q$retailer$q$),
($q$Convite Espadín Madrecuishe$q$, NULL, $q$Ensamble Mezcal$q$, $q$Convite$q$, 42, $q$MX$q$, $q$Mezcal$q$, $q$https://www.hotalingandco.com/portfolio/convite-mezcal/convite-mezcal-espadin-madrecuishe$q$, $q$retailer$q$),
($q$Convite Jabalí$q$, NULL, $q$Mezcal$q$, $q$Convite$q$, 46, $q$MX$q$, $q$Mezcal$q$, $q$https://www.hotalingandco.com/portfolio/convite-mezcal/convite-mezcal-jabali$q$, $q$retailer$q$),
($q$Convite Pechuga$q$, NULL, $q$Mezcal$q$, $q$Convite$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.hotalingandco.com/portfolio/convite-mezcal/convite-pechuga-mezcal$q$, $q$retailer$q$),
($q$Convite Tepextate$q$, NULL, $q$Mezcal$q$, $q$Convite$q$, 46, $q$MX$q$, $q$Mezcal$q$, $q$https://www.hotalingandco.com/portfolio/convite-mezcal/convite-mezcal-tepextate$q$, $q$retailer$q$),
($q$Convite Una'$q$, NULL, $q$Espadín Mezcal$q$, $q$Convite$q$, 40, $q$MX$q$, $q$Mezcal$q$, $q$https://www.hotalingandco.com/portfolio/convite-mezcal/convite-mezcal-una$q$, $q$retailer$q$),
($q$Corazón Single Estate Añejo$q$, NULL, $q$Añejo Tequila$q$, $q$Corazón$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.tequilacorazon.com/single-estate-tequila$q$, $q$producer$q$),
($q$Corazón Single Estate Blanco$q$, NULL, $q$Blanco Tequila$q$, $q$Corazón$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.tequilacorazon.com/single-estate-tequila$q$, $q$producer$q$),
($q$Corazón Single Estate Reposado$q$, NULL, $q$Reposado Tequila$q$, $q$Corazón$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.tequilacorazon.com/single-estate-tequila$q$, $q$producer$q$),
($q$Corralejo Añejo$q$, NULL, $q$Añejo Tequila$q$, $q$Corralejo$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/8234/corralejo-anejo-tequila$q$, $q$reference$q$),
($q$Creyente Cristalino$q$, $q$Creyente Cristalino Mezcal$q$, $q$Ensamble Mezcal$q$, $q$Creyente$q$, 40, $q$MX$q$, $q$Mezcal$q$, $q$https://mezcalcreyente.com/products/$q$, $q$producer$q$),
($q$Creyente Cuishe$q$, NULL, $q$Mezcal$q$, $q$Creyente$q$, 40, $q$MX$q$, $q$Mezcal$q$, $q$https://mezcalcreyente.com/products/$q$, $q$producer$q$),
($q$Creyente Tobalá$q$, NULL, $q$Tobalá Mezcal$q$, $q$Creyente$q$, 40, $q$MX$q$, $q$Mezcal$q$, $q$https://mezcalcreyente.com/products/$q$, $q$producer$q$),
($q$Código 1530 Blanco$q$, $q$Código 1530 Blanco$q$, $q$Blanco Tequila$q$, $q$Código 1530$q$, 39.9, $q$MX$q$, $q$Tequila$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/7955/codigo-1530-blanco-tequila$q$, $q$reference$q$),
($q$Código 1530 Reposado$q$, NULL, $q$Reposado Tequila$q$, $q$Código 1530$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/7956/codigo-1530-reposado-tequila$q$, $q$reference$q$),
($q$Código 1530 Rosa$q$, $q$Código 1530 Rosa Tequila$q$, $q$Blanco Tequila$q$, $q$Código 1530$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/7954/codigo-1530-rosa-blanco$q$, $q$reference$q$),
($q$Del Maguey Arroqueño$q$, NULL, $q$Mezcal$q$, $q$Del Maguey$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/9367/del-maguey-arroqueno-mezcal$q$, $q$reference$q$),
($q$Del Maguey Chichicapa$q$, $q$Del Maguey Chichicapa Mezcal$q$, $q$Mezcal$q$, $q$Del Maguey$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/5158/del-maguey-chichicapa$q$, $q$reference$q$),
($q$Del Maguey Espadín, Arroqueño & Mexicano$q$, NULL, $q$Ensamble Mezcal$q$, $q$Del Maguey$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/9370/del-maguey-espadin-arroqueno-and-mexicano-mezcal$q$, $q$reference$q$),
($q$Del Maguey Ibérico$q$, NULL, $q$Mezcal$q$, $q$Del Maguey$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/5161/del-maguey-iberico-mezcal$q$, $q$reference$q$),
($q$Del Maguey Las Milpas$q$, NULL, $q$Espadín Mezcal$q$, $q$Del Maguey$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/9366/del-maguey-las-milpas-mezcal$q$, $q$reference$q$),
($q$Del Maguey Madrecuixe$q$, NULL, $q$Mezcal$q$, $q$Del Maguey$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/9371/del-maguey-madrecuixe-mezcal$q$, $q$reference$q$),
($q$Del Maguey Minero Santa Catarina Minas$q$, NULL, $q$Mezcal$q$, $q$Del Maguey$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/5159/del-maguey-minero-santa-catarina-minas-mezcal$q$, $q$reference$q$),
($q$Del Maguey Pechuga$q$, NULL, $q$Mezcal$q$, $q$Del Maguey$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/5181/del-maguey-pechuga-mezcal$q$, $q$reference$q$),
($q$Del Maguey San Luis Del Rio$q$, $q$Del Maguey San Luis Del Rio Mezcal$q$, $q$Mezcal$q$, $q$Del Maguey$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/5166/del-maguey-san-luis-del-rio$q$, $q$reference$q$),
($q$Del Maguey Santo Domingo Albarradas$q$, NULL, $q$Mezcal$q$, $q$Del Maguey$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/8990/del-maguey-santo-domingo-albarradas$q$, $q$reference$q$),
($q$Del Maguey Tobalá$q$, $q$Del Maguey Tobalá Mezcal$q$, $q$Tobalá Mezcal$q$, $q$Del Maguey$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/9373/del-maguey-tobala-mezcal$q$, $q$reference$q$),
($q$Del Maguey Vida Clásico$q$, $q$Del Maguey Vida Clasico Mezcal$q$, $q$Mezcal$q$, $q$Del Maguey$q$, 42, $q$MX$q$, $q$Mezcal$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/5018/del-maguey-vida-clasico-mezcal$q$, $q$reference$q$),
($q$Del Maguey Vida Puebla$q$, NULL, $q$Espadín Mezcal$q$, $q$Del Maguey$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/7856/del-maguey-vida-puebla$q$, $q$reference$q$),
($q$Del Maguey Wild Papalome$q$, NULL, $q$Mezcal$q$, $q$Del Maguey$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/5164/del-maguey-wild-papalome-mezcal$q$, $q$reference$q$),
($q$Del Maguey Wild Tepextate$q$, NULL, $q$Mezcal$q$, $q$Del Maguey$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/5165/del-maguey-wild-tepextate-mezcal$q$, $q$reference$q$),
($q$Derrumbes Durango$q$, NULL, $q$Mezcal$q$, $q$Derrumbes$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://specialitybrands.com/range/derrumbes/derrumbes-durango/$q$, $q$reference$q$),
($q$Derrumbes Michoacán$q$, $q$Derumbas Michoacan Mezcal$q$, $q$Mezcal$q$, $q$Derrumbes$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://specialitybrands.com/range/derrumbes/derrumbes-michoacan/$q$, $q$reference$q$),
($q$Derrumbes Oaxaca$q$, $q$Derrumbes Oaxaca Mezcal$q$, $q$Espadín Mezcal$q$, $q$Derrumbes$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://specialitybrands.com/range/derrumbes/derrumbes-oaxaca/$q$, $q$reference$q$),
($q$Derrumbes San Luis Potosí$q$, $q$Derrumbes San Luis Potosí Mezcal$q$, $q$Mezcal$q$, $q$Derrumbes$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://specialitybrands.com/range/derrumbes/derrumbes-san-luis-potosi/$q$, $q$reference$q$),
($q$Derrumbes Tamaulipas$q$, NULL, $q$Ensamble Mezcal$q$, $q$Derrumbes$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://specialitybrands.com/range/derrumbes/derrumbes-tamaulipas/$q$, $q$reference$q$),
($q$Derrumbes Zacatecas$q$, NULL, $q$Mezcal$q$, $q$Derrumbes$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://specialitybrands.com/range/derrumbes/derrumbes-zacatecas/$q$, $q$reference$q$),
($q$Desert Door Oak Aged Texas Sotol$q$, NULL, $q$Sotol$q$, $q$Desert Door$q$, NULL, $q$US$q$, NULL, $q$https://www.desertdoor.com/product/desert-door-oak-aged-texas-sotol$q$, $q$producer$q$),
($q$Desert Door Original Texas Sotol$q$, $q$Desert Door Sotol$q$, $q$Sotol$q$, $q$Desert Door$q$, NULL, $q$US$q$, NULL, $q$https://www.desertdoor.com/product/desert-door-original-texas-sotol$q$, $q$producer$q$),
($q$Dixeebe Barril$q$, NULL, $q$Agave Spirit$q$, $q$Dixeebe$q$, NULL, $q$MX$q$, NULL, $q$https://mezcaldixeebe.com/product/barril-2-edicion/$q$, $q$producer$q$),
($q$Dixeebe Espadín$q$, NULL, $q$Espadín Mezcal$q$, $q$Dixeebe$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://mezcaldixeebe.com/product/espadin-6-edicion-2024/$q$, $q$producer$q$),
($q$Dixeebe Madrecuishe$q$, NULL, $q$Agave Spirit$q$, $q$Dixeebe$q$, NULL, $q$MX$q$, NULL, $q$https://mezcaldixeebe.com/product/madrecuishe-5-edicion/$q$, $q$producer$q$),
($q$Dixeebe Pechuga$q$, NULL, $q$Agave Spirit$q$, $q$Dixeebe$q$, NULL, $q$MX$q$, NULL, $q$https://mezcaldixeebe.com/product/pechuga-4-edicion/$q$, $q$producer$q$),
($q$Dixeebe Tobalá$q$, NULL, $q$Tobalá Mezcal$q$, $q$Dixeebe$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://mezcaldixeebe.com/product/tobala-5-edicion/$q$, $q$producer$q$),
($q$Don Fulano Añejo$q$, NULL, $q$Añejo Tequila$q$, $q$Don Fulano$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://donfulano.com/products/a%C3%B1ejo$q$, $q$producer$q$),
($q$Don Fulano Blanco$q$, $q$Don Fulano Blanco Tequila$q$, $q$Blanco Tequila$q$, $q$Don Fulano$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://donfulano.com/products/blanco$q$, $q$producer$q$),
($q$Don Fulano Fuerte$q$, $q$Don Fulano Fuerte Tequila$q$, $q$Blanco Tequila$q$, $q$Don Fulano$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://donfulano.com/products/fuerte$q$, $q$producer$q$),
($q$Don Fulano Reposado$q$, $q$Don Fulano Reposado Tequila$q$, $q$Reposado Tequila$q$, $q$Don Fulano$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://donfulano.com/products/reposado$q$, $q$producer$q$),
($q$Don Julio 1942$q$, $q$Don Julio 1942$q$, $q$Añejo Tequila$q$, $q$Don Julio$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.donjulio.com/our-tequilas/don-julio-1942-tequila$q$, $q$producer$q$),
($q$Don Julio 70 Cristalino$q$, $q$Don Julio 70 Cristalino Tequila$q$, $q$Cristalino Tequila$q$, $q$Don Julio$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.donjulio.com/our-tequilas/don-julio-70-cristalino-tequila$q$, $q$producer$q$),
($q$Don Julio Alma Miel$q$, NULL, $q$Joven Tequila$q$, $q$Don Julio$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.donjulio.com/our-tequilas/don-julio-alma-miel$q$, $q$producer$q$),
($q$Don Julio Añejo$q$, $q$Don Julio Añejo Tequila$q$, $q$Añejo Tequila$q$, $q$Don Julio$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.donjulio.com/our-tequilas/don-julio-anejo-tequila$q$, $q$producer$q$),
($q$Don Julio Blanco$q$, $q$Don Julio Blanco Tequila$q$, $q$Blanco Tequila$q$, $q$Don Julio$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.donjulio.com/our-tequilas/don-julio-blanco-tequila$q$, $q$producer$q$),
($q$Don Julio Reposado$q$, $q$Don Julio Reposado Tequila$q$, $q$Reposado Tequila$q$, $q$Don Julio$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.donjulio.com/our-tequilas/don-julio-reposado-tequila$q$, $q$producer$q$),
($q$Don Julio Rosado$q$, NULL, $q$Reposado Tequila$q$, $q$Don Julio$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.donjulio.com/our-tequilas/don-julio-rosado$q$, $q$producer$q$),
($q$Don Julio Ultima Reserva$q$, NULL, $q$Extra Añejo Tequila$q$, $q$Don Julio$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.donjulio.com/our-tequilas/don-julio-ultima-reserva$q$, $q$producer$q$),
($q$Don Ramón Platinium Añejo Cristalino$q$, NULL, $q$Cristalino Tequila$q$, $q$Don Ramón$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://casadonramon.com/tequila/platinium/tequila-anejo-cristalino-platinum$q$, $q$producer$q$),
($q$Don Ramón Platinium Plata$q$, NULL, $q$Blanco Tequila$q$, $q$Don Ramón$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://casadonramon.com/tequila/platinium/tequila-plata-platinum$q$, $q$producer$q$),
($q$Don Ramón Platinium Reposado Cristalino$q$, NULL, $q$Cristalino Tequila$q$, $q$Don Ramón$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://casadonramon.com/tequila/platinium/tequila-reposado-cristalino-platinum$q$, $q$producer$q$),
($q$Don Ramón Punta Diamante Añejo Cristalino$q$, NULL, $q$Cristalino Tequila$q$, $q$Don Ramón$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://casadonramon.com/tequila/punta-diamante/tequila-anejo-cristalino-punta-diamante$q$, $q$producer$q$),
($q$Don Ramón Punta Diamante Plata$q$, NULL, $q$Blanco Tequila$q$, $q$Don Ramón$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://casadonramon.com/tequila/punta-diamante/tequila-plata-punta-diamante$q$, $q$producer$q$),
($q$Don Ramón Punta Diamante Reposado$q$, NULL, $q$Reposado Tequila$q$, $q$Don Ramón$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://casadonramon.com/tequila/punta-diamante/tequila-reposado-punta-diamante$q$, $q$producer$q$),
($q$Don Ramón Reposado$q$, NULL, $q$Reposado Tequila$q$, $q$Don Ramón$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://casadonramon.com/tequila/reposado$q$, $q$producer$q$),
($q$Mezcal Don Ramón Espadín$q$, NULL, $q$Espadín Mezcal$q$, $q$Don Ramón$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://casadonramon.com/mezcal/mezcal-espadin$q$, $q$producer$q$),
($q$Mezcal Don Ramón Joven Salmiana$q$, NULL, $q$Salmiana Mezcal$q$, $q$Don Ramón$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://casadonramon.com/mezcal/mezcal-joven$q$, $q$producer$q$),
($q$Dos Hombres Espadín Mezcal$q$, $q$Dos Hombres Espadín Mezcal$q$, $q$Espadín Mezcal$q$, $q$Dos Hombres$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.doshombres.com/products/espadin-mezcal$q$, $q$producer$q$),
($q$Dos Hombres Tobalá Mezcal$q$, NULL, $q$Tobalá Mezcal$q$, $q$Dos Hombres$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.doshombres.com/products/tobala-mezcal$q$, $q$producer$q$),
($q$El Jimador Añejo$q$, NULL, $q$Añejo Tequila$q$, $q$El Jimador$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.eljimador.com/product/anejo/$q$, $q$producer$q$),
($q$El Jimador Cristalino$q$, NULL, $q$Cristalino Tequila$q$, $q$El Jimador$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.eljimador.com/product/cristalino/$q$, $q$producer$q$),
($q$El Jimador Reposado$q$, $q$El Jimador Reposado Tequila$q$, $q$Reposado Tequila$q$, $q$El Jimador$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.eljimador.com/product/reposado/$q$, $q$producer$q$),
($q$El Jimador Silver$q$, $q$El Jimador Blanco Tequila$q$, $q$Blanco Tequila$q$, $q$El Jimador$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.eljimador.com/product/silver/$q$, $q$producer$q$),
($q$El Silencio Espadín$q$, $q$El Silencio Espadín Mezcal$q$, $q$Espadín Mezcal$q$, $q$El Silencio$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://mezcal-silencio.myshopify.com/products/espadin$q$, $q$producer$q$),
($q$El Tequileño Añejo Gran Reserva$q$, NULL, $q$Añejo Tequila$q$, $q$El Tequileño$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.tequileno.com/anejo$q$, $q$producer$q$),
($q$El Tequileño Blanco$q$, $q$El Tequileño Blanco Tequila$q$, $q$Blanco Tequila$q$, $q$El Tequileño$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.tequileno.com/blanco$q$, $q$producer$q$),
($q$El Tequileño Cristalino$q$, NULL, $q$Cristalino Tequila$q$, $q$El Tequileño$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.tequileno.com/cristalino$q$, $q$producer$q$),
($q$El Tequileño Platinum$q$, NULL, $q$Blanco Tequila$q$, $q$El Tequileño$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.tequileno.com/platinum$q$, $q$producer$q$),
($q$El Tequileño Reposado$q$, $q$El Tequileño Reposado$q$, $q$Reposado Tequila$q$, $q$El Tequileño$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.tequileno.com/reposado$q$, $q$producer$q$),
($q$El Tequileño Reposado Gran Reserva$q$, NULL, $q$Reposado Tequila$q$, $q$El Tequileño$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.tequileno.com/reposadogranreserva$q$, $q$producer$q$),
($q$El Tequileño Still Strength$q$, NULL, $q$Blanco Tequila$q$, $q$El Tequileño$q$, 50, $q$MX$q$, $q$Tequila$q$, $q$https://www.tequileno.com/still-strength$q$, $q$producer$q$),
($q$El Tesoro Añejo$q$, $q$El Tesoro Añejo$q$, $q$Añejo Tequila$q$, $q$El Tesoro$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.eltesorotequila.com/tequilas/el-tesoro-anejo$q$, $q$producer$q$),
($q$El Tesoro Blanco$q$, $q$El Tesoro Blanco Tequila$q$, $q$Blanco Tequila$q$, $q$El Tesoro$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.eltesorotequila.com/tequilas/el-tesoro-blanco$q$, $q$producer$q$),
($q$El Tesoro Extra Añejo$q$, NULL, $q$Extra Añejo Tequila$q$, $q$El Tesoro$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.eltesorotequila.com/tequilas/el-tesoro-extra-anejo$q$, $q$producer$q$),
($q$El Tesoro Paradiso$q$, NULL, $q$Extra Añejo Tequila$q$, $q$El Tesoro$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.eltesorotequila.com/tequilas/el-tesoro-paradiso$q$, $q$producer$q$),
($q$El Tesoro Reposado$q$, $q$El Tesoro Reposado Tequila$q$, $q$Reposado Tequila$q$, $q$El Tesoro$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.eltesorotequila.com/tequilas/el-tesoro-reposado$q$, $q$producer$q$),
($q$Espolòn Añejo$q$, $q$Espolòn Añejo$q$, $q$Añejo Tequila$q$, $q$Espolòn$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.espolontequila.com/our-tequilas/tequila-anejo/$q$, $q$producer$q$),
($q$Espolòn Blanco$q$, $q$Espolòn Blanco$q$, $q$Blanco Tequila$q$, $q$Espolòn$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.espolontequila.com/our-tequilas/tequila-blanco/$q$, $q$producer$q$),
($q$Espolòn Cristalino$q$, NULL, $q$Cristalino Tequila$q$, $q$Espolòn$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.espolontequila.com/our-tequilas/tequila-cristalino/$q$, $q$producer$q$),
($q$Espolòn Reposado$q$, $q$Espolón Reposado Tequila$q$, $q$Reposado Tequila$q$, $q$Espolòn$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.espolontequila.com/our-tequilas/tequila-reposado/$q$, $q$producer$q$),
($q$Espolòn Reposado Chardonnay$q$, NULL, $q$Reposado Tequila$q$, $q$Espolòn$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.espolontequila.com/our-tequilas/tequila-reposado-chardonnay/$q$, $q$producer$q$),
($q$Estancia Raicilla de la Sierra$q$, $q$Estancia Raicilla$q$, $q$Raicilla$q$, $q$Estancia$q$, NULL, $q$MX$q$, NULL, $q$https://estanciadestileria.com/distillates/raicilla-de-la-sierra$q$, $q$producer$q$),
($q$Estancia Tequilana$q$, NULL, $q$Agave Spirit$q$, $q$Estancia$q$, NULL, $q$MX$q$, NULL, $q$https://estanciadestileria.com/distillates/tequilana$q$, $q$producer$q$),
($q$Exotico Blanco$q$, NULL, $q$Blanco Tequila$q$, $q$Exotico$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://exoticotequila.com/our-tequilas/$q$, $q$producer$q$),
($q$Exotico Reposado$q$, NULL, $q$Reposado Tequila$q$, $q$Exotico$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://exoticotequila.com/our-tequilas/$q$, $q$producer$q$),
($q$Fandango Mezcal$q$, NULL, $q$Mezcal$q$, $q$Fandango$q$, 40, $q$MX$q$, $q$Mezcal$q$, $q$https://www.bcliquorstores.com/product/77821$q$, $q$retailer$q$),
($q$Fidencio Clásico$q$, $q$Fidencio Clásico Mezcal$q$, $q$Espadín Mezcal$q$, $q$Fidencio$q$, 45.1, $q$MX$q$, $q$Mezcal$q$, $q$https://www.creamwine.com/product.php?id=4698$q$, $q$retailer$q$),
($q$Fidencio Madrecuixe$q$, NULL, $q$Mezcal$q$, $q$Fidencio$q$, 49.4, $q$MX$q$, $q$Mezcal$q$, $q$https://www.creamwine.com/brand.php?id=92$q$, $q$retailer$q$),
($q$Fidencio Pechuga$q$, NULL, $q$Espadín Mezcal$q$, $q$Fidencio$q$, 47.8, $q$MX$q$, $q$Mezcal$q$, $q$https://www.creamwine.com/brand.php?id=92$q$, $q$retailer$q$),
($q$Fidencio Tobalá$q$, NULL, $q$Tobalá Mezcal$q$, $q$Fidencio$q$, 48, $q$MX$q$, $q$Mezcal$q$, $q$https://www.creamwine.com/brand.php?id=92$q$, $q$retailer$q$),
($q$Fidencio Único$q$, NULL, $q$Espadín Mezcal$q$, $q$Fidencio$q$, 44.5, $q$MX$q$, $q$Mezcal$q$, $q$https://www.creamwine.com/brand.php?id=92$q$, $q$retailer$q$),
($q$Fortaleza Añejo$q$, $q$Fortaleza Añejo Tequila$q$, $q$Añejo Tequila$q$, $q$Fortaleza$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://tequilafortaleza.com/tequila-fortaleza-anejo/$q$, $q$producer$q$),
($q$Fortaleza Blanco$q$, $q$Fortaleza Blanco Tequila$q$, $q$Blanco Tequila$q$, $q$Fortaleza$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://tequilafortaleza.com/tequila-fortaleza-blanco/$q$, $q$producer$q$),
($q$Fortaleza Blanco Still Strength$q$, NULL, $q$Blanco Tequila$q$, $q$Fortaleza$q$, 46, $q$MX$q$, $q$Tequila$q$, $q$https://tequilafortaleza.com/fortaleza-blanco-still-strength/$q$, $q$producer$q$),
($q$Fortaleza Reposado$q$, $q$Fortaleza Reposado Tequila$q$, $q$Reposado Tequila$q$, $q$Fortaleza$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://tequilafortaleza.com/tequila-fortaleza-reposado/$q$, $q$producer$q$),
($q$G4 Añejo$q$, NULL, $q$Añejo Tequila$q$, $q$G4$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://pkgdgroup.com/g4-tequila-anejo$q$, $q$producer$q$),
($q$G4 Blanco$q$, $q$G4 Blanco Tequila$q$, $q$Blanco Tequila$q$, $q$G4$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://pkgdgroup.com/g4-tequila-blanco$q$, $q$producer$q$),
($q$G4 Blanco High Proof$q$, NULL, $q$Blanco Tequila$q$, $q$G4$q$, 54, $q$MX$q$, $q$Tequila$q$, $q$https://pkgdgroup.com/g4-tequila-blanco-high-proof$q$, $q$producer$q$),
($q$G4 Blanco Madera$q$, NULL, $q$Blanco Tequila$q$, $q$G4$q$, 45, $q$MX$q$, $q$Tequila$q$, $q$https://pkgdgroup.com/g4-tequila-blanco-madera$q$, $q$producer$q$),
($q$G4 Extra Añejo$q$, NULL, $q$Extra Añejo Tequila$q$, $q$G4$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://pkgdgroup.com/g4-tequila-extra-anejo$q$, $q$producer$q$),
($q$G4 Reposado$q$, NULL, $q$Reposado Tequila$q$, $q$G4$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://pkgdgroup.com/g4-tequila-reposado-features$q$, $q$producer$q$),
($q$Gran Centenario Añejo$q$, NULL, $q$Añejo Tequila$q$, $q$Gran Centenario$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://grancentenario.com/products/anejo/$q$, $q$producer$q$),
($q$Gran Centenario Cristalino$q$, NULL, $q$Cristalino Tequila$q$, $q$Gran Centenario$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://grancentenario.com/products/cristalino/$q$, $q$producer$q$),
($q$Gran Centenario Gallardo$q$, NULL, $q$Extra Añejo Tequila$q$, $q$Gran Centenario$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://grancentenario.com/product/gallardo$q$, $q$producer$q$),
($q$Gran Centenario Leyenda$q$, NULL, $q$Extra Añejo Tequila$q$, $q$Gran Centenario$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://grancentenario.com/products/leyenda/$q$, $q$producer$q$),
($q$Gran Centenario Plata$q$, NULL, $q$Blanco Tequila$q$, $q$Gran Centenario$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://grancentenario.com/products/plata/$q$, $q$producer$q$),
($q$Gran Centenario Reposado$q$, $q$Gran Centenario Reposado$q$, $q$Reposado Tequila$q$, $q$Gran Centenario$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://grancentenario.com/products/reposado/$q$, $q$producer$q$),
($q$Hacienda de Chihuahua Sotol Añejo$q$, NULL, $q$Sotol$q$, $q$Hacienda de Chihuahua$q$, 38, $q$MX$q$, $q$Sotol$q$, $q$https://sotol.com/product/sotol-anejo/$q$, $q$producer$q$),
($q$Hacienda de Chihuahua Sotol H5$q$, NULL, $q$Sotol$q$, $q$Hacienda de Chihuahua$q$, 38, $q$MX$q$, $q$Sotol$q$, $q$https://sotol.com/product/sotol-h5/$q$, $q$producer$q$),
($q$Hacienda de Chihuahua Sotol Oro$q$, NULL, $q$Sotol$q$, $q$Hacienda de Chihuahua$q$, 38, $q$MX$q$, $q$Sotol$q$, $q$https://sotol.com/product/sotol-oro/$q$, $q$producer$q$),
($q$Hacienda de Chihuahua Sotol Plata$q$, $q$Hacienda de Chihuahua Sotol Plata$q$, $q$Sotol$q$, $q$Hacienda de Chihuahua$q$, 38, $q$MX$q$, $q$Sotol$q$, $q$https://sotol.com/product/sotol-plata/$q$, $q$producer$q$),
($q$Hacienda de Chihuahua Sotol Platinum$q$, NULL, $q$Sotol$q$, $q$Hacienda de Chihuahua$q$, 38, $q$MX$q$, $q$Sotol$q$, $q$https://sotol.com/product/sotol-platinum/$q$, $q$producer$q$),
($q$Hacienda de Chihuahua Sotol Reposado$q$, NULL, $q$Sotol$q$, $q$Hacienda de Chihuahua$q$, 38, $q$MX$q$, $q$Sotol$q$, $q$https://sotol.com/product/sotol-reposado/$q$, $q$producer$q$),
($q$Hacienda de Chihuahua Sotol Rústico$q$, NULL, $q$Sotol$q$, $q$Hacienda de Chihuahua$q$, 45, $q$MX$q$, $q$Sotol$q$, $q$https://sotol.com/product/sotol-rustico/$q$, $q$producer$q$),
($q$Herradura Añejo$q$, $q$Herradura Añejo$q$, $q$Añejo Tequila$q$, $q$Herradura$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.herradura.com/blog/product/anejo/$q$, $q$producer$q$),
($q$Herradura Blanco$q$, $q$Herradura Blanco Tequila$q$, $q$Blanco Tequila$q$, $q$Herradura$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.herradura.com/blog/product/blanco/$q$, $q$producer$q$),
($q$Herradura Double Barrel Reposado$q$, NULL, $q$Reposado Tequila$q$, $q$Herradura$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.herradura.com/blog/product/double-barrel-reposado/$q$, $q$producer$q$),
($q$Herradura Legend$q$, NULL, $q$Añejo Tequila$q$, $q$Herradura$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.herradura.com/blog/product/legend/$q$, $q$producer$q$),
($q$Herradura Reposado$q$, $q$Herradura Reposado Tequila$q$, $q$Reposado Tequila$q$, $q$Herradura$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.herradura.com/blog/product/reposado/$q$, $q$producer$q$),
($q$Herradura Selección Suprema$q$, NULL, $q$Extra Añejo Tequila$q$, $q$Herradura$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.herradura.com/blog/product/seleccion-suprema/$q$, $q$producer$q$),
($q$Herradura Silver$q$, $q$Herradura Silver Tequila$q$, $q$Blanco Tequila$q$, $q$Herradura$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.herradura.com/blog/product/silver/$q$, $q$producer$q$),
($q$Herradura Ultra$q$, $q$Herradura Ultra$q$, $q$Cristalino Tequila$q$, $q$Herradura$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.herradura.com/blog/product/herradura-ultra/$q$, $q$producer$q$),
($q$Hornitos Añejo$q$, NULL, $q$Añejo Tequila$q$, $q$Hornitos$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.hornitostequila.com/tequilas/anejo$q$, $q$producer$q$),
($q$Hornitos Black Barrel$q$, NULL, $q$Añejo Tequila$q$, $q$Hornitos$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.bcliquorstores.com/product/425728$q$, $q$retailer$q$),
($q$Hornitos Cristalino Reserve$q$, NULL, $q$Cristalino Tequila$q$, $q$Hornitos$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.hornitostequila.com/tequilas/cristalino-reserve$q$, $q$producer$q$),
($q$Hornitos Plata$q$, $q$Hornitos Plata Tequila$q$, $q$Blanco Tequila$q$, $q$Hornitos$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.hornitostequila.com/tequilas/plata$q$, $q$producer$q$),
($q$Hornitos Reposado$q$, NULL, $q$Reposado Tequila$q$, $q$Hornitos$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.hornitostequila.com/tequilas/reposado$q$, $q$producer$q$),
($q$Ilegal Añejo$q$, NULL, $q$Espadín Mezcal$q$, $q$Ilegal$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.ilegalmezcal.com/mezcal$q$, $q$producer$q$),
($q$Ilegal Joven$q$, $q$Ilegal Mezcal Joven$q$, $q$Espadín Mezcal$q$, $q$Ilegal$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.ilegalmezcal.com/mezcal$q$, $q$producer$q$),
($q$Ilegal Reposado$q$, $q$Ilegal Mezcal Reposado$q$, $q$Espadín Mezcal$q$, $q$Ilegal$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.ilegalmezcal.com/mezcal$q$, $q$producer$q$),
($q$Cuervo Tradicional Añejo$q$, NULL, $q$Añejo Tequila$q$, $q$Jose Cuervo$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://cuervo.com/products/tradicional-anejo/$q$, $q$producer$q$),
($q$Cuervo Tradicional Cristalino$q$, NULL, $q$Cristalino Tequila$q$, $q$Jose Cuervo$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://cuervo.com/products/tradicional-cristalino/$q$, $q$producer$q$),
($q$Cuervo Tradicional Reposado$q$, $q$Jose Cuervo Tradicional Reposado$q$, $q$Reposado Tequila$q$, $q$Jose Cuervo$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://cuervo.com/products/tradicional-reposado/$q$, $q$producer$q$),
($q$Jose Cuervo Especial Gold$q$, $q$Jose Cuervo Especial Gold Tequila$q$, $q$Joven Tequila$q$, $q$Jose Cuervo$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://cuervo.com/products/especial-gold/$q$, $q$producer$q$),
($q$Jose Cuervo Especial Silver$q$, $q$Jose Cuervo Especial Silver Tequila$q$, $q$Blanco Tequila$q$, $q$Jose Cuervo$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://cuervo.com/products/especial-silver/$q$, $q$producer$q$),
($q$La Venenosa Costa de Jalisco$q$, $q$La Venenosa costa Jalisco (green) raicillia$q$, $q$Raicilla$q$, $q$La Venenosa$q$, NULL, $q$MX$q$, NULL, $q$https://www.creamwine.com/brand.php?id=1058$q$, $q$retailer$q$),
($q$La Venenosa Sierra Occidental de Jalisco$q$, NULL, $q$Raicilla$q$, $q$La Venenosa$q$, NULL, $q$MX$q$, NULL, $q$https://www.creamwine.com/brand.php?id=1058$q$, $q$retailer$q$),
($q$La Venenosa Sierra Volcanes de Jalisco$q$, NULL, $q$Raicilla$q$, $q$La Venenosa$q$, NULL, $q$MX$q$, NULL, $q$https://www.creamwine.com/brand.php?id=1058$q$, $q$retailer$q$),
($q$La Venenosa Sierra del Tigre de Jalisco$q$, NULL, $q$Raicilla$q$, $q$La Venenosa$q$, NULL, $q$MX$q$, NULL, $q$https://www.creamwine.com/brand.php?id=1058$q$, $q$retailer$q$),
($q$La Venenosa Tabernas Edición III$q$, $q$La Venenosa tabernas 3rd Ed raicillia$q$, $q$Raicilla$q$, $q$La Venenosa$q$, NULL, $q$MX$q$, NULL, $q$https://www.creamwine.com/brand.php?id=1058$q$, $q$retailer$q$),
($q$La Venenosa Tabernas Reposado$q$, NULL, $q$Raicilla$q$, $q$La Venenosa$q$, NULL, $q$MX$q$, NULL, $q$https://www.creamwine.com/brand.php?id=1058$q$, $q$retailer$q$),
($q$Legendario Domingo Espadín$q$, $q$Legendario Domingo Espadín$q$, $q$Espadín Mezcal$q$, $q$Legendario Domingo$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://vintus.com/wines/legendario-domingo-espadin/$q$, $q$retailer$q$),
($q$Legendario Domingo Guerrero Cupreata$q$, NULL, $q$Cupreata Mezcal$q$, $q$Legendario Domingo$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://vintus.com/wines/legendario-domingo-guerreo-cupreata/$q$, $q$retailer$q$),
($q$Legendario Domingo Michoacán Ensamble$q$, NULL, $q$Ensamble Mezcal$q$, $q$Legendario Domingo$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://vintus.com/wines/legendario-domingo-michoacan-ensamble/$q$, $q$retailer$q$),
($q$Los Siete Misterios Arroqueño$q$, NULL, $q$Mezcal$q$, $q$Los Siete Misterios$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.sietemisterios.com/$q$, $q$producer$q$),
($q$Los Siete Misterios Barril$q$, NULL, $q$Mezcal$q$, $q$Los Siete Misterios$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.sietemisterios.com/$q$, $q$producer$q$),
($q$Los Siete Misterios Coyote$q$, NULL, $q$Mezcal$q$, $q$Los Siete Misterios$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.sietemisterios.com/$q$, $q$producer$q$),
($q$Los Siete Misterios Doba-Yej$q$, $q$Los Siete Misterios Doba-Yej Mezcal$q$, $q$Espadín Mezcal$q$, $q$Los Siete Misterios$q$, 44, $q$MX$q$, $q$Mezcal$q$, $q$https://www.sietemisterios.com/$q$, $q$producer$q$),
($q$Los Siete Misterios Espadín (Ancestral)$q$, NULL, $q$Espadín Mezcal$q$, $q$Los Siete Misterios$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.sietemisterios.com/$q$, $q$producer$q$),
($q$Los Siete Misterios Espadín/Cuishe$q$, NULL, $q$Ensamble Mezcal$q$, $q$Los Siete Misterios$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.sietemisterios.com/$q$, $q$producer$q$),
($q$Los Siete Misterios Espadín/Mexicanito$q$, NULL, $q$Ensamble Mezcal$q$, $q$Los Siete Misterios$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.sietemisterios.com/$q$, $q$producer$q$),
($q$Los Siete Misterios Espadín/Tepeztate$q$, NULL, $q$Ensamble Mezcal$q$, $q$Los Siete Misterios$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.sietemisterios.com/$q$, $q$producer$q$),
($q$Los Siete Misterios Espadín/Tobalá$q$, NULL, $q$Ensamble Mezcal$q$, $q$Los Siete Misterios$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.sietemisterios.com/$q$, $q$producer$q$),
($q$Los Siete Misterios Mexicano$q$, NULL, $q$Mezcal$q$, $q$Los Siete Misterios$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.sietemisterios.com/$q$, $q$producer$q$),
($q$Los Siete Misterios Tobalá$q$, NULL, $q$Tobalá Mezcal$q$, $q$Los Siete Misterios$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.sietemisterios.com/$q$, $q$producer$q$),
($q$Lunazul Añejo$q$, NULL, $q$Añejo Tequila$q$, $q$Lunazul$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.lunazultequila.com/our-tequilas.php$q$, $q$producer$q$),
($q$Lunazul Blanco$q$, $q$Lunazul Blanco Tequila$q$, $q$Blanco Tequila$q$, $q$Lunazul$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.lunazultequila.com/our-tequilas.php$q$, $q$producer$q$),
($q$Lunazul Primero Cristalino$q$, NULL, $q$Cristalino Tequila$q$, $q$Lunazul$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.lunazultequila.com/primero-cristalino.php$q$, $q$producer$q$),
($q$Lunazul Reposado$q$, NULL, $q$Reposado Tequila$q$, $q$Lunazul$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.lunazultequila.com/our-tequilas.php$q$, $q$producer$q$),
($q$Madre Ancestral$q$, NULL, $q$Ensamble Mezcal$q$, $q$Madre$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.madremezcal.com/products/madre-ancestral$q$, $q$producer$q$),
($q$Madre Ensamble$q$, $q$Madre Mezcal Ensamble$q$, $q$Ensamble Mezcal$q$, $q$Madre$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.madremezcal.com/products/madre-ensamble$q$, $q$producer$q$),
($q$Madre Espadín$q$, NULL, $q$Espadín Mezcal$q$, $q$Madre$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.madremezcal.com/products/madre-ensamble-copy$q$, $q$producer$q$),
($q$Madre Tequila$q$, NULL, $q$Blanco Tequila$q$, $q$Madre$q$, 48, $q$MX$q$, $q$Tequila$q$, $q$https://www.madremezcal.com/products/madre-tequila-700-ml$q$, $q$producer$q$),
($q$Dobel 50 Cristalino Extra Añejo$q$, NULL, $q$Extra Añejo Tequila$q$, $q$Maestro Dobel$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.maestrodobel.com/$q$, $q$producer$q$),
($q$Dobel Añejo$q$, NULL, $q$Añejo Tequila$q$, $q$Maestro Dobel$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.maestrodobel.com/$q$, $q$producer$q$),
($q$Dobel Blanco$q$, NULL, $q$Blanco Tequila$q$, $q$Maestro Dobel$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.maestrodobel.com/$q$, $q$producer$q$),
($q$Dobel Reposado$q$, NULL, $q$Reposado Tequila$q$, $q$Maestro Dobel$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.maestrodobel.com/$q$, $q$producer$q$),
($q$Dobel Tahona Blanco$q$, $q$Maestro Dobel Tahona Tequila$q$, $q$Blanco Tequila$q$, $q$Maestro Dobel$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.maestrodobel.com/$q$, $q$producer$q$),
($q$Maestro Dobel Diamante Cristalino$q$, $q$Maestro Dobel Diamante$q$, $q$Cristalino Tequila$q$, $q$Maestro Dobel$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.maestrodobel.com/$q$, $q$producer$q$),
($q$Marca Negra Espadín$q$, $q$Mezcal Marca Negra Espadín$q$, $q$Espadín Mezcal$q$, $q$Marca Negra$q$, 50.7, $q$MX$q$, $q$Mezcal$q$, $q$https://thechampagnecompany.com/marca-negra-espadin-mezcal-70cl-50-7$q$, $q$retailer$q$),
($q$Marca Negra Tobalá$q$, NULL, $q$Tobalá Mezcal$q$, $q$Marca Negra$q$, 52, $q$MX$q$, $q$Mezcal$q$, $q$https://thechampagnecompany.com/marca-negra-tobala-mezcal-70cl-52$q$, $q$retailer$q$),
($q$Mayalen Guerrero$q$, NULL, $q$Cupreata Mezcal$q$, $q$Mayalen$q$, 52, $q$MX$q$, $q$Mezcal$q$, $q$http://www.mezcalmayalen.com/$q$, $q$producer$q$),
($q$Mayalen Wild Barril$q$, NULL, $q$Mezcal$q$, $q$Mayalen$q$, 48, $q$MX$q$, $q$Mezcal$q$, $q$http://www.mezcalmayalen.com/$q$, $q$producer$q$),
($q$Mayalen Wild Coyote$q$, NULL, $q$Mezcal$q$, $q$Mayalen$q$, 48, $q$MX$q$, $q$Mezcal$q$, $q$http://www.mezcalmayalen.com/$q$, $q$producer$q$),
($q$Mayalen Wild Cuishe$q$, NULL, $q$Mezcal$q$, $q$Mayalen$q$, 48, $q$MX$q$, $q$Mezcal$q$, $q$http://www.mezcalmayalen.com/$q$, $q$producer$q$),
($q$Mayalen Wild Cupreata$q$, NULL, $q$Cupreata Mezcal$q$, $q$Mayalen$q$, 46.5, $q$MX$q$, $q$Mezcal$q$, $q$http://www.mezcalmayalen.com/$q$, $q$producer$q$),
($q$Mayalen Wild Tobalá$q$, NULL, $q$Tobalá Mezcal$q$, $q$Mayalen$q$, 47, $q$MX$q$, $q$Mezcal$q$, $q$http://www.mezcalmayalen.com/$q$, $q$producer$q$),
($q$Mezcal Unión El Viejo$q$, NULL, $q$Ensamble Mezcal$q$, $q$Mezcal Unión$q$, 45, $q$MX$q$, $q$Mezcal$q$, $q$https://www.thebar.com/en-us/products/mezcal-union-el-viejo-750-ml$q$, $q$producer$q$),
($q$Mezcal Vago El Manantial$q$, NULL, $q$Espadín Mezcal$q$, $q$Mezcal Vago$q$, 43, $q$MX$q$, $q$Mezcal$q$, $q$https://mezcalvago.com/our-products/$q$, $q$producer$q$),
($q$Mezcal Vago Elote$q$, $q$Mezcal Vago Elote$q$, $q$Espadín Mezcal$q$, $q$Mezcal Vago$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://mezcalvago.com/our-products/$q$, $q$producer$q$),
($q$Mezcal Vago Ensamble en Barro$q$, NULL, $q$Ensamble Mezcal$q$, $q$Mezcal Vago$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://mezcalvago.com/our-products/$q$, $q$producer$q$),
($q$Mezcal Vago Espadín by Joel$q$, NULL, $q$Espadín Mezcal$q$, $q$Mezcal Vago$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://mezcalvago.com/our-products/$q$, $q$producer$q$),
($q$Mezcal Verde Momento$q$, $q$Mezcal Verde Momento$q$, $q$Espadín Mezcal$q$, $q$Mezcal Verde$q$, 42, $q$MX$q$, $q$Mezcal$q$, $q$https://blackheartsandsparrows.com.au/products/21843/mezcal-verde-momento-42percent-700ml$q$, $q$retailer$q$),
($q$Mijenta Blanco$q$, $q$Mijenta Blanco$q$, $q$Blanco Tequila$q$, $q$Mijenta$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.millesima-usa.com/spirits/mijenta-blanco-0000.html$q$, $q$retailer$q$),
($q$Mijenta Reposado$q$, $q$Mijenta Reposado$q$, $q$Reposado Tequila$q$, $q$Mijenta$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.millesima-usa.com/spirits/mijenta-reposado-0000.html$q$, $q$retailer$q$),
($q$Montelobos Ensamble$q$, $q$Montelobos Ensamble Mezcal$q$, $q$Ensamble Mezcal$q$, $q$Montelobos$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.montelobos.com/our-mezcals/montelobos-ensamble/$q$, $q$producer$q$),
($q$Montelobos Espadín$q$, $q$Montelobos Espadín Mezcal$q$, $q$Espadín Mezcal$q$, $q$Montelobos$q$, 43.2, $q$MX$q$, $q$Mezcal$q$, $q$https://www.montelobos.com/our-mezcals/montelobos-espadin/$q$, $q$producer$q$),
($q$Montelobos Pechuga$q$, NULL, $q$Espadín Mezcal$q$, $q$Montelobos$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.montelobos.com/our-mezcals/montelobos-pechuga/$q$, $q$producer$q$),
($q$Montelobos Tobalá$q$, NULL, $q$Tobalá Mezcal$q$, $q$Montelobos$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.montelobos.com/our-mezcals/montelobos-tobala/$q$, $q$producer$q$),
($q$Nocheluna Sotol$q$, $q$Noche Luna Sotol$q$, $q$Sotol$q$, $q$Nocheluna$q$, NULL, $q$MX$q$, NULL, $q$https://www.casalumbre.com/nocheluna$q$, $q$producer$q$),
($q$Ojo de Dios Mezcal Joven$q$, $q$Ojo De Dios Mezcal$q$, $q$Mezcal$q$, $q$Ojo de Dios$q$, 42, $q$MX$q$, $q$Mezcal$q$, $q$https://www.enotria.com/products/ojo-de-dios-mezcal-joven$q$, $q$retailer$q$),
($q$Ojo de Tigre Joven$q$, $q$Ojo de Tigre Mezcal$q$, $q$Ensamble Mezcal$q$, $q$Ojo de Tigre$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://ojodetigremezcal.com/en/elaboration-joven-mezcal-white-mezcal/$q$, $q$producer$q$),
($q$Ojo de Tigre Reposado$q$, NULL, $q$Ensamble Mezcal$q$, $q$Ojo de Tigre$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://ojodetigremezcal.com/es/mezcal-reposado-elaboracion/$q$, $q$producer$q$),
($q$Olmeca Blanco$q$, $q$Olmeca Blanco Tequila$q$, $q$Blanco Tequila$q$, $q$Olmeca$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.pernod-ricard.com/en/brands/olmeca$q$, $q$producer$q$),
($q$Olmeca Extra Aged$q$, NULL, $q$Añejo Tequila$q$, $q$Olmeca$q$, 38, $q$MX$q$, $q$Tequila$q$, $q$https://www.pernod-ricard.com/en/brands/olmeca$q$, $q$producer$q$),
($q$Olmeca Reposado$q$, $q$Olmeca Reposado$q$, $q$Reposado Tequila$q$, $q$Olmeca$q$, 35, $q$MX$q$, $q$Tequila$q$, $q$https://www.pernod-ricard.com/en/brands/olmeca$q$, $q$producer$q$),
($q$Olmeca Altos Añejo$q$, NULL, $q$Añejo Tequila$q$, $q$Olmeca Altos$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.pernod-ricard.com/en/brands/altos$q$, $q$producer$q$),
($q$Olmeca Altos Plata$q$, $q$Olmeca Altos Plata$q$, $q$Blanco Tequila$q$, $q$Olmeca Altos$q$, 43, $q$MX$q$, $q$Tequila$q$, $q$https://www.pernod-ricard.com/en/brands/altos$q$, $q$producer$q$),
($q$Olmeca Altos Reposado$q$, $q$Olmeca Altos Reposado Tequila$q$, $q$Reposado Tequila$q$, $q$Olmeca Altos$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.pernod-ricard.com/en/brands/altos$q$, $q$producer$q$),
($q$Origen Raíz Madrecuishe$q$, $q$Origin Raiz - Madrecuixe Mezcal$q$, $q$Mezcal$q$, $q$Origen Raíz$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://flaskfinewines.com/products/origen-raiz-madrecuishe$q$, $q$retailer$q$),
($q$Partida Reposado$q$, NULL, $q$Reposado Tequila$q$, $q$Partida$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.bcliquorstores.com/product/322212$q$, $q$retailer$q$),
($q$Patrón Añejo$q$, $q$Patron Anejo$q$, $q$Añejo Tequila$q$, $q$Patrón$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.patrontequila.com/products/patron-anejo.html$q$, $q$producer$q$),
($q$Patrón Cristalino$q$, $q$Patrón Cristalino$q$, $q$Cristalino Tequila$q$, $q$Patrón$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.patrontequila.com/products/patron-cristalino.html$q$, $q$producer$q$),
($q$Patrón El Alto$q$, $q$Patrón El Alto$q$, $q$Extra Añejo Tequila$q$, $q$Patrón$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.patrontequila.com/products/el-alto.html$q$, $q$producer$q$),
($q$Patrón El Cielo$q$, NULL, $q$Blanco Tequila$q$, $q$Patrón$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.patrontequila.com/products/el-cielo.html$q$, $q$producer$q$),
($q$Patrón Extra Añejo$q$, NULL, $q$Extra Añejo Tequila$q$, $q$Patrón$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.patrontequila.com/products/patron-extra-anejo.html$q$, $q$producer$q$),
($q$Patrón Reposado$q$, $q$Patrón Reposado Tequila$q$, $q$Reposado Tequila$q$, $q$Patrón$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.patrontequila.com/products/patron-reposado.html$q$, $q$producer$q$),
($q$Patrón Silver$q$, $q$Patrón Silver Tequila$q$, $q$Blanco Tequila$q$, $q$Patrón$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.patrontequila.com/products/patron-silver.html$q$, $q$producer$q$),
($q$Pueblo Viejo Blanco$q$, $q$Pueblo Viejo Blanco Tequila$q$, $q$Blanco Tequila$q$, $q$Pueblo Viejo$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.saratogawine.com/product/casa-san-matias-pueblo-viejo-tequila-blanco-1-0ltr/$q$, $q$retailer$q$),
($q$Pueblo Viejo Blanco 104$q$, NULL, $q$Blanco Tequila$q$, $q$Pueblo Viejo$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.saratogawine.com/product/casa-san-matias-pueblo-viejo-tequila-blanco-1-0ltr/$q$, $q$retailer$q$),
($q$Quiquiriqui Arroqueño$q$, NULL, $q$Mezcal$q$, $q$Quiquiriqui$q$, 47, $q$MX$q$, $q$Mezcal$q$, $q$https://www.quiquiriquimezcal.com/services-9-1$q$, $q$producer$q$),
($q$Quiquiriqui Destilado con Mole Negro$q$, NULL, $q$Espadín Mezcal$q$, $q$Quiquiriqui$q$, 45, $q$MX$q$, $q$Mezcal$q$, $q$https://www.quiquiriquimezcal.com/services-9-1$q$, $q$producer$q$),
($q$Quiquiriqui Destilado con Mole Rojo$q$, NULL, $q$Espadín Mezcal$q$, $q$Quiquiriqui$q$, 45, $q$MX$q$, $q$Mezcal$q$, $q$https://www.quiquiriquimezcal.com/services-9-1$q$, $q$producer$q$),
($q$Quiquiriqui Ensamble$q$, NULL, $q$Ensamble Mezcal$q$, $q$Quiquiriqui$q$, 47, $q$MX$q$, $q$Mezcal$q$, $q$https://www.quiquiriquimezcal.com/services-9-1$q$, $q$producer$q$),
($q$Quiquiriqui Espadín$q$, NULL, $q$Espadín Mezcal$q$, $q$Quiquiriqui$q$, 45, $q$MX$q$, $q$Mezcal$q$, $q$https://www.quiquiriquimezcal.com/services-9-1$q$, $q$producer$q$),
($q$Quiquiriqui Matatlán$q$, $q$Quiquiriqui Matatlán Mezcal$q$, $q$Espadín Mezcal$q$, $q$Quiquiriqui$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://www.quiquiriquimezcal.com/services-9-1$q$, $q$producer$q$),
($q$Quiquiriqui Tobalá$q$, NULL, $q$Tobalá Mezcal$q$, $q$Quiquiriqui$q$, 47, $q$MX$q$, $q$Mezcal$q$, $q$https://www.quiquiriquimezcal.com/services-9-1$q$, $q$producer$q$),
($q$Rancho Tepúa Bacanora Blanco$q$, $q$Rancho Tepúa Bacanora Blanco$q$, $q$Bacanora$q$, $q$Rancho Tepúa$q$, NULL, $q$MX$q$, $q$Bacanora$q$, $q$https://golden-rule-liquor.onrender.com/products/rancho-tepua-bacanora-blanco$q$, $q$retailer$q$),
($q$Rey Campero Espadín$q$, $q$Rey Campero Espadín Mezcal$q$, $q$Espadín Mezcal$q$, $q$Rey Campero$q$, 48, $q$MX$q$, $q$Mezcal$q$, $q$https://www.skurnik.com/sku/espadin-rey-campero/$q$, $q$retailer$q$),
($q$Rosaluna Mezcal Joven$q$, $q$Rosaluna Mezcal$q$, $q$Espadín Mezcal$q$, $q$Rosaluna$q$, 40, $q$MX$q$, $q$Mezcal$q$, $q$https://mezcalrosaluna.com/the-mezcal/$q$, $q$producer$q$),
($q$Sauza Conmemorativo Añejo$q$, NULL, $q$Añejo Tequila$q$, $q$Sauza$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.sauzatequila.com/our-tequilas/sauza-conmemorativo-anejo-tequila$q$, $q$producer$q$),
($q$Sauza Hacienda Gold$q$, NULL, $q$Joven Tequila$q$, $q$Sauza$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.sauzatequila.com/our-tequilas/sauza-hacienda-gold-tequila$q$, $q$producer$q$),
($q$Sauza Hacienda Silver$q$, $q$Sauza Silver Tequila$q$, $q$Blanco Tequila$q$, $q$Sauza$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.sauzatequila.com/our-tequilas/sauza-hacienda-silver-tequila$q$, $q$producer$q$),
($q$Sauza Signature Blue Blanco$q$, NULL, $q$Blanco Tequila$q$, $q$Sauza$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.sauzatequila.com/our-tequilas/sauza-signature-blue-blanco$q$, $q$producer$q$),
($q$Sauza Signature Blue Reposado$q$, NULL, $q$Reposado Tequila$q$, $q$Sauza$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.sauzatequila.com/our-tequilas/sauza-signature-blue-reposado$q$, $q$producer$q$),
($q$Siembra Azul Blanco$q$, $q$Siembra Azul Blanco Tequila$q$, $q$Blanco Tequila$q$, $q$Siembra Azul$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://agavesdemexico.com/siembra-azul/$q$, $q$producer$q$),
($q$Sierra Tequila Reposado$q$, NULL, $q$Reposado Tequila$q$, $q$Sierra$q$, 38, $q$MX$q$, $q$Tequila$q$, $q$https://www.bcliquorstores.com/product/222842$q$, $q$retailer$q$),
($q$Sierra Tequila Silver$q$, NULL, $q$Blanco Tequila$q$, $q$Sierra$q$, 38, $q$MX$q$, $q$Tequila$q$, $q$https://www.bcliquorstores.com/product/222839$q$, $q$retailer$q$),
($q$Siete Leguas Añejo$q$, $q$Siete Leguas Añejo Tequila$q$, $q$Añejo Tequila$q$, $q$Siete Leguas$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://tequilasieteleguas.com/nuestros-tequilas/$q$, $q$producer$q$),
($q$Siete Leguas Blanco$q$, $q$Siete Leguas Blanco$q$, $q$Blanco Tequila$q$, $q$Siete Leguas$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://tequilasieteleguas.com/nuestros-tequilas/$q$, $q$producer$q$),
($q$Siete Leguas Reposado$q$, $q$Siete Leguas Reposado$q$, $q$Reposado Tequila$q$, $q$Siete Leguas$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://tequilasieteleguas.com/nuestros-tequilas/$q$, $q$producer$q$),
($q$Sombra Mezcal Joven$q$, $q$Sombra Mezcal$q$, $q$Mezcal$q$, $q$Sombra$q$, 45, $q$MX$q$, $q$Mezcal$q$, $q$https://lucacollections.com.au/products/sombra-joven$q$, $q$retailer$q$),
($q$Sotol Por Siempre$q$, $q$Sotol Por Siempre$q$, $q$Sotol$q$, $q$Sotol Por Siempre$q$, 45, $q$MX$q$, $q$Sotol$q$, $q$https://backbarproject.com/portfolio/sotol-por-siempre/$q$, $q$producer$q$),
($q$Tapatío Añejo$q$, NULL, $q$Añejo Tequila$q$, $q$Tapatío$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://specialitybrands.com/range/tapatio/tapatio-anejo/$q$, $q$retailer$q$),
($q$Tapatío Blanco$q$, $q$Tapatio Blanco Tequila$q$, $q$Blanco Tequila$q$, $q$Tapatío$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://specialitybrands.com/range/tapatio/tapatio-blanco/$q$, $q$retailer$q$),
($q$Tapatío Blanco 110$q$, $q$Tapatio Blanco 110 Tequila$q$, $q$Blanco Tequila$q$, $q$Tapatío$q$, 55, $q$MX$q$, $q$Tequila$q$, $q$https://specialitybrands.com/range/tapatio/tapatio-blanco-110/$q$, $q$retailer$q$),
($q$Tapatío Excelencia Gran Reserva$q$, NULL, $q$Extra Añejo Tequila$q$, $q$Tapatío$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://specialitybrands.com/range/tapatio/tapatio-excelencia/$q$, $q$retailer$q$),
($q$Tapatío Reposado$q$, $q$Tapatío Reposado Tequila$q$, $q$Reposado Tequila$q$, $q$Tapatío$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://specialitybrands.com/range/tapatio/tapatio-reposado/$q$, $q$retailer$q$),
($q$Tequila Ocho Añejo$q$, NULL, $q$Añejo Tequila$q$, $q$Tequila Ocho$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://ochotequila.com/products-2/$q$, $q$producer$q$),
($q$Tequila Ocho Extra Añejo$q$, NULL, $q$Extra Añejo Tequila$q$, $q$Tequila Ocho$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://ochotequila.com/products-2/$q$, $q$producer$q$),
($q$Tequila Ocho Plata$q$, $q$Tequila Ocho Plata$q$, $q$Blanco Tequila$q$, $q$Tequila Ocho$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://ochotequila.com/products-2/$q$, $q$producer$q$),
($q$Tequila Ocho Reposado$q$, $q$Ocho Reposado Tequila$q$, $q$Reposado Tequila$q$, $q$Tequila Ocho$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://ochotequila.com/products-2/$q$, $q$producer$q$),
($q$Teremana Blanco$q$, $q$Teremana Blanco Tequila$q$, $q$Blanco Tequila$q$, $q$Teremana$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.bcliquorstores.com/product/45690$q$, $q$retailer$q$),
($q$Teremana Reposado$q$, NULL, $q$Reposado Tequila$q$, $q$Teremana$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.bcliquorstores.com/product/768184$q$, $q$retailer$q$),
($q$The Lost Explorer Espadín$q$, $q$The Lost Explorer Espadín$q$, $q$Espadín Mezcal$q$, $q$The Lost Explorer$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://thelostexplorer.com/mezcal/espadin/$q$, $q$producer$q$),
($q$The Lost Explorer Salmiana$q$, $q$The Lost Explorer Salmiana Mezcal$q$, $q$Salmiana Mezcal$q$, $q$The Lost Explorer$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://thelostexplorer.com/mezcal/salmiana/$q$, $q$producer$q$),
($q$The Lost Explorer Tequila Blanco$q$, NULL, $q$Blanco Tequila$q$, $q$The Lost Explorer$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://thelostexplorer.com/tequila/blanco/$q$, $q$producer$q$),
($q$The Lost Explorer Tequila Reposado$q$, NULL, $q$Reposado Tequila$q$, $q$The Lost Explorer$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://thelostexplorer.com/tequila/reposado/$q$, $q$producer$q$),
($q$The Lost Explorer Tobalá$q$, NULL, $q$Tobalá Mezcal$q$, $q$The Lost Explorer$q$, NULL, $q$MX$q$, $q$Mezcal$q$, $q$https://thelostexplorer.com/mezcal/tobala/$q$, $q$producer$q$),
($q$Tierra Noble Añejo$q$, NULL, $q$Añejo Tequila$q$, $q$Tierra Noble$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.bcliquorstores.com/product/613885$q$, $q$retailer$q$),
($q$Tres Agaves Añejo$q$, NULL, $q$Añejo Tequila$q$, $q$Tres Agaves$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.tresagaves.com/tequilas/organic-tequila-anejo$q$, $q$producer$q$),
($q$Tres Agaves Blanco$q$, $q$Tres Agaves Blanco Tequila$q$, $q$Blanco Tequila$q$, $q$Tres Agaves$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.tresagaves.com/tequilas/organic-tequila-blanco$q$, $q$producer$q$),
($q$Tres Agaves Reposado$q$, NULL, $q$Reposado Tequila$q$, $q$Tres Agaves$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.tresagaves.com/tequilas/organic-tequlia-reposado$q$, $q$producer$q$),
($q$Tres Generaciones Añejo$q$, NULL, $q$Añejo Tequila$q$, $q$Tres Generaciones$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.tresgeneraciones.com/our-tequilas/anejo$q$, $q$producer$q$),
($q$Tres Generaciones Cristalino$q$, NULL, $q$Cristalino Tequila$q$, $q$Tres Generaciones$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.tresgeneraciones.com/our-tequilas/cristalino$q$, $q$producer$q$),
($q$Tres Generaciones Plata$q$, NULL, $q$Blanco Tequila$q$, $q$Tres Generaciones$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.tresgeneraciones.com/our-tequilas/plata$q$, $q$producer$q$),
($q$Tres Generaciones Reposado$q$, NULL, $q$Reposado Tequila$q$, $q$Tres Generaciones$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.tresgeneraciones.com/our-tequilas/reposado$q$, $q$producer$q$),
($q$Tromba Blanco$q$, $q$Tromba Blanco Tequila$q$, $q$Blanco Tequila$q$, $q$Tromba$q$, 36, $q$MX$q$, $q$Tequila$q$, $q$https://www.lcbo.com/en/tequila-tromba-blanco-271643$q$, $q$retailer$q$),
($q$Tromba Reposado$q$, $q$Tromba Reposado Tequila$q$, $q$Reposado Tequila$q$, $q$Tromba$q$, NULL, $q$MX$q$, $q$Tequila$q$, $q$https://www.lcbo.com/en/tequila-tromba-reposado-360206$q$, $q$retailer$q$),
($q$Vivir Tequila Añejo$q$, NULL, $q$Añejo Tequila$q$, $q$Vivir$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.enotria.com/products/vivir-tequila-anejo$q$, $q$retailer$q$),
($q$Vivir Tequila Blanco$q$, $q$Vivir Blanco Tequila$q$, $q$Blanco Tequila$q$, $q$Vivir$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.enotria.com/products/vivir-tequila-blanco$q$, $q$retailer$q$),
($q$Vivir Tequila Reposado$q$, NULL, $q$Reposado Tequila$q$, $q$Vivir$q$, 40, $q$MX$q$, $q$Tequila$q$, $q$https://www.enotria.com/products/vivir-tequila-reposado$q$, $q$retailer$q$),
($q$Wahaka Abocado con Gusano$q$, NULL, $q$Espadín Mezcal$q$, $q$Wahaka$q$, 40, $q$MX$q$, $q$Mezcal$q$, $q$https://www.wahakamezcal.com/our-mezcal/$q$, $q$producer$q$),
($q$Wahaka Ensamble$q$, NULL, $q$Ensamble Mezcal$q$, $q$Wahaka$q$, 40, $q$MX$q$, $q$Mezcal$q$, $q$https://www.wahakamezcal.com/our-mezcal/$q$, $q$producer$q$),
($q$Wahaka Espadín$q$, $q$Wahaka Espadín Mezcal$q$, $q$Espadín Mezcal$q$, $q$Wahaka$q$, 40, $q$MX$q$, $q$Mezcal$q$, $q$https://www.wahakamezcal.com/our-mezcal/$q$, $q$producer$q$),
($q$Wahaka Madre-Cuishe$q$, NULL, $q$Mezcal$q$, $q$Wahaka$q$, 42, $q$MX$q$, $q$Mezcal$q$, $q$https://www.wahakamezcal.com/our-mezcal/$q$, $q$producer$q$),
($q$Wahaka Tobalá$q$, NULL, $q$Tobalá Mezcal$q$, $q$Wahaka$q$, 42, $q$MX$q$, $q$Mezcal$q$, $q$https://www.wahakamezcal.com/our-mezcal/$q$, $q$producer$q$),
($q$Yuu Baal Espadín Joven$q$, $q$Yuu Baal Joven Mezcal$q$, $q$Espadín Mezcal$q$, $q$Yuu Baal$q$, 45, $q$MX$q$, $q$Mezcal$q$, $q$https://www.caskers.com/yuu-baal-espadin-mezcal-joven-750/$q$, $q$retailer$q$);

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
    WHEN b.style IN ($q$Mezcal$q$, $q$Agave Spirit$q$, $q$Blanco Tequila$q$) AND EXISTS (
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
