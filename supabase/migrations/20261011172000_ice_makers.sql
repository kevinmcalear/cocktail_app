-- Ice makers: unclaimed maker pages for specialty cocktail-ice companies
-- (clear blocks, cut cubes, spears, spheres, branded ice), after
-- 20261011171000. Step 4a of the bottle catalog plan:
-- https://claude.ai/artifact/Vu6seuSNtN42nKYb2nDCVR
--
--   * 29 pages, each checked on the company's own site (or a 2025-2026
--     article where it has none): name, website, base country and city,
--     what it makes, and the cities it says it delivers to (serves).
--   * Only companies trading now; closed or unconfirmed ones stay out.
--   * Like every maker page: owned by a venue team once claimed, never
--     on the map or in Discover.
--   * An independent second check of every row found 0 wrong facts in
--     159. Hundredweight's city is New York City (its site names no
--     borough); Baïkal Pure Ice is in Le Havre.
--
-- A page someone already has (by handle or name) is left alone, or gains
-- what this load says it makes. A second run changes nothing more.


CREATE TEMP TABLE maker_in (name text PRIMARY KEY, handle text NOT NULL, website text, country text, city text, makes text[] NOT NULL, serves text[] NOT NULL);
INSERT INTO maker_in VALUES
($q$Abstract Ice$q$, $q$abstract.ice$q$, $q$https://www.abstractice.com/$q$, $q$US$q$, $q$Petaluma$q$, ARRAY[$q$ice$q$]::text[], '{}'::text[]),
($q$Artisan Ice Co$q$, $q$artisan.ice.co$q$, $q$https://artisaniceco.com/$q$, $q$AE$q$, $q$Dubai$q$, ARRAY[$q$ice$q$]::text[], '{}'::text[]),
($q$Baïkal Pure Ice$q$, $q$baikal.pure.ice$q$, $q$https://pureicebaikal.fr/$q$, $q$FR$q$, $q$Le Havre$q$, ARRAY[$q$ice$q$]::text[], ARRAY[$q$France métropolitaine hors Corse$q$, $q$Monte-Carlo$q$]::text[]),
($q$Bare Bones Ice Co.$q$, $q$bare.bones.ice.co$q$, $q$https://www.barebonesice.co/$q$, $q$AU$q$, $q$Sydney$q$, ARRAY[$q$ice$q$]::text[], ARRAY[$q$Sydney$q$]::text[]),
($q$Block Ice$q$, $q$block.ice$q$, $q$https://blockice.com/$q$, $q$US$q$, $q$Sacramento$q$, ARRAY[$q$ice$q$]::text[], ARRAY[$q$Sacramento$q$, $q$Napa$q$, $q$North Bay$q$, $q$Northern California$q$, $q$Tahoe-Reno area$q$]::text[]),
($q$Colorado Ice Works$q$, $q$colorado.ice.works$q$, $q$https://coloradoiceworks.com/$q$, $q$US$q$, $q$Englewood, CO$q$, ARRAY[$q$ice$q$]::text[], ARRAY[$q$Colorado$q$]::text[]),
($q$Disco Cubes$q$, $q$disco.cubes$q$, $q$https://www.discocubes.com/$q$, $q$US$q$, $q$Los Angeles$q$, ARRAY[$q$ice$q$]::text[], '{}'::text[]),
($q$EURO GLAÇONS$q$, $q$euro.glacons$q$, $q$https://www.euroglacons.fr/$q$, $q$FR$q$, $q$Baillet-en-France$q$, ARRAY[$q$ice$q$]::text[], ARRAY[$q$Paris$q$, $q$Île-de-France$q$]::text[]),
($q$Fat Ice$q$, $q$fat.ice$q$, $q$https://fatice.com/$q$, $q$US$q$, $q$Austin$q$, ARRAY[$q$ice$q$]::text[], ARRAY[$q$Texas$q$, $q$Las Vegas$q$, $q$South Florida$q$, $q$Orlando$q$, $q$Chicago$q$, $q$Phoenix$q$, $q$Boston$q$, $q$Southern California$q$]::text[]),
($q$Good Ice$q$, $q$good.ice$q$, $q$https://www.goodicestl.com/$q$, $q$US$q$, $q$St. Louis$q$, ARRAY[$q$ice$q$]::text[], '{}'::text[]),
($q$Hundredweight Ice$q$, $q$hundredweight.ice$q$, $q$https://www.hundredweightice.com/$q$, $q$US$q$, $q$New York City$q$, ARRAY[$q$ice$q$]::text[], ARRAY[$q$New York City$q$, $q$Tri-State area$q$]::text[]),
($q$Ice Club$q$, $q$ice.club$q$, $q$https://ice-club.co.uk/$q$, $q$GB$q$, $q$Crawley$q$, ARRAY[$q$ice$q$]::text[], ARRAY[$q$UK$q$]::text[]),
($q$Ice Cube Clear Ice Company$q$, $q$ice.cube.clear.ice.company$q$, $q$https://www.icecubeco.fr/$q$, $q$FR$q$, $q$Cestas$q$, ARRAY[$q$ice$q$]::text[], ARRAY[$q$Bordeaux$q$, $q$Paris$q$, $q$Lyon$q$, $q$Cannes$q$, $q$Lille$q$, $q$Montpellier$q$, $q$Toulouse$q$, $q$Biarritz$q$, $q$Genève$q$, $q$Luxembourg$q$, $q$Clermont-Ferrand$q$]::text[]),
($q$Icebox$q$, $q$icebox$q$, $q$https://theicebox.com/$q$, $q$GB$q$, $q$London$q$, ARRAY[$q$ice$q$]::text[], ARRAY[$q$London$q$]::text[]),
($q$King Cube$q$, $q$king.cube$q$, $q$https://kingcube.com/$q$, $q$US$q$, $q$Atlanta$q$, ARRAY[$q$ice$q$]::text[], '{}'::text[]),
($q$Kuramoto Ice$q$, $q$kuramoto.ice$q$, NULL, $q$JP$q$, $q$Kanazawa$q$, ARRAY[$q$ice$q$]::text[], '{}'::text[]),
($q$Lady Chiller$q$, $q$lady.chiller$q$, $q$https://www.ladychiller.com/$q$, $q$US$q$, $q$Richmond, VA$q$, ARRAY[$q$ice$q$]::text[], ARRAY[$q$Richmond$q$, $q$Charlottesville$q$, $q$Virginia Beach$q$]::text[]),
($q$Lux Ice$q$, $q$lux.ice$q$, $q$https://www.luxiceusa.com/$q$, $q$US$q$, $q$Flower Mound, TX$q$, ARRAY[$q$ice$q$]::text[], '{}'::text[]),
($q$O'GLAÇONS$q$, $q$o.glacons$q$, $q$https://oglacons.fr/$q$, $q$FR$q$, $q$Gonesse$q$, ARRAY[$q$ice$q$]::text[], ARRAY[$q$Ile-de-France$q$]::text[]),
($q$Penny Pound Ice$q$, $q$penny.pound.ice$q$, $q$https://www.pennypoundice.com/$q$, $q$US$q$, $q$Los Angeles$q$, ARRAY[$q$ice$q$]::text[], ARRAY[$q$Southern California$q$]::text[]),
($q$Philadelphia Craft Ice Co.$q$, $q$philadelphia.craft.ice.co$q$, $q$https://www.philadelphiacraftice.com/$q$, $q$US$q$, $q$Ambler, PA$q$, ARRAY[$q$ice$q$]::text[], ARRAY[$q$Philadelphia and surrounding areas$q$]::text[]),
($q$Prisma Clear Ice$q$, $q$prisma.clear.ice$q$, NULL, $q$AR$q$, NULL, ARRAY[$q$ice$q$]::text[], '{}'::text[]),
($q$Quari Ice$q$, $q$quari.ice$q$, $q$https://www.quari-ice.com/$q$, $q$US$q$, $q$Chicago$q$, ARRAY[$q$ice$q$]::text[], '{}'::text[]),
($q$RealMix Ice$q$, $q$realmix.ice$q$, $q$https://realmixice.co.uk/$q$, $q$GB$q$, $q$London$q$, ARRAY[$q$ice$q$]::text[], ARRAY[$q$London$q$]::text[]),
($q$Revolution Craft Ice$q$, $q$revolution.craft.ice$q$, $q$https://www.revolutioncraftice.com/$q$, $q$US$q$, $q$Santa Cruz$q$, ARRAY[$q$ice$q$]::text[], ARRAY[$q$Santa Cruz$q$, $q$Monterey$q$, $q$Santa Clara$q$, $q$Alameda$q$]::text[]),
($q$The Ice Queen$q$, $q$the.ice.queen$q$, $q$https://www.icequeenstudio.com/$q$, $q$US$q$, $q$Arlington, VA$q$, ARRAY[$q$ice$q$]::text[], ARRAY[$q$DC$q$, $q$Northern VA$q$, $q$MD$q$]::text[]),
($q$The Nice Company$q$, $q$the.nice.company$q$, $q$https://www.thenicecompanyparis.com/$q$, $q$FR$q$, $q$Chessy$q$, ARRAY[$q$ice$q$, $q$equipment$q$]::text[], ARRAY[$q$France$q$]::text[]),
($q$Tremml Ice Team$q$, $q$tremml.ice.team$q$, $q$https://www.iceteam.de/$q$, $q$DE$q$, $q$Ismaning$q$, ARRAY[$q$ice$q$]::text[], '{}'::text[]),
($q$West Coast Ice Pro$q$, $q$west.coast.ice.pro$q$, $q$https://www.westcoasticepro.com/$q$, $q$US$q$, $q$Los Angeles$q$, ARRAY[$q$ice$q$]::text[], ARRAY[$q$greater Los Angeles Area$q$, $q$San Diego to Paso Robles$q$]::text[]);

-- A page per maker, unclaimed, public. A handle someone already uses is left alone.
INSERT INTO public.profiles (kind, handle, display_name, website, country_code, city, makes, serves, is_public)
SELECT 'maker', m.handle, m.name, m.website, m.country, m.city, m.makes, m.serves, true
  FROM maker_in m
 WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.handle = m.handle)
   AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.kind = 'maker' AND lower(p.display_name) = lower(m.name));

-- A maker page an earlier load made gains what this one says it makes, and the cities it serves.
UPDATE public.profiles p SET
    makes = ARRAY(SELECT DISTINCT unnest(p.makes || m.makes) ORDER BY 1),
    serves = CASE WHEN cardinality(p.serves) = 0 THEN m.serves ELSE p.serves END
  FROM maker_in m
 WHERE p.kind = 'maker' AND lower(p.display_name) = lower(m.name)
   AND (NOT (m.makes <@ p.makes) OR (cardinality(p.serves) = 0 AND cardinality(m.serves) > 0));

DROP TABLE maker_in;
