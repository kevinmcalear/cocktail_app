-- Glassware makers: unclaimed maker pages for bar glassware houses (crystal
-- and glass makers, and bar-supply brands with their own glass lines),
-- after 20261011172000. Step 4b of the bottle catalog plan:
-- https://claude.ai/artifact/Vu6seuSNtN42nKYb2nDCVR
--
--   * 18 pages, each checked on the company's own site (or a 2025-2026
--     article where it has none): name, website, base country and city,
--     what it makes.
--   * Only companies trading now; closed or unconfirmed ones stay out.
--   * Like every maker page: owned by a venue team once claimed, never
--     on the map or in Discover.
--   * An independent second check of every row found 1 wrong facts in
--     79. LSA International is in Liverpool, not London. Zalto stays
--     out (its site shows no cocktail glasses); Sasaki Glass merged
--     into Toyo-Sasaki in 2002.
--
-- A page someone already has (by handle or name) is left alone, or gains
-- what this load says it makes. A second run changes nothing more.


CREATE TEMP TABLE maker_in (name text PRIMARY KEY, handle text NOT NULL, website text, country text, city text, makes text[] NOT NULL, serves text[] NOT NULL);
INSERT INTO maker_in VALUES
($q$BarProducts.com$q$, $q$barproducts.com$q$, $q$https://barproducts.com/$q$, NULL, NULL, ARRAY[$q$glassware$q$, $q$barware$q$]::text[], '{}'::text[]),
($q$BOBO$q$, $q$bobo$q$, $q$https://bobo.store/$q$, $q$SE$q$, $q$Stockholm$q$, ARRAY[$q$glassware$q$]::text[], '{}'::text[]),
($q$Bormioli Rocco$q$, $q$bormioli.rocco$q$, $q$https://bormioliluigi.com/glassware/en/$q$, $q$IT$q$, $q$Parma$q$, ARRAY[$q$glassware$q$]::text[], '{}'::text[]),
($q$Cocktail Kingdom$q$, $q$cocktail.kingdom$q$, $q$https://www.cocktailkingdom.com/$q$, $q$US$q$, $q$New York$q$, ARRAY[$q$glassware$q$, $q$barware$q$]::text[], '{}'::text[]),
($q$Kimura Glass$q$, $q$kimura.glass$q$, $q$https://www.kimuraglass.co.jp/$q$, $q$JP$q$, $q$Tokyo$q$, ARRAY[$q$glassware$q$]::text[], '{}'::text[]),
($q$KINTO$q$, $q$kinto$q$, NULL, NULL, NULL, ARRAY[$q$glassware$q$]::text[], '{}'::text[]),
($q$Libbey$q$, $q$libbey$q$, $q$https://www.libbey.com/$q$, $q$US$q$, $q$Toledo$q$, ARRAY[$q$glassware$q$]::text[], '{}'::text[]),
($q$LSA International$q$, $q$lsa.international$q$, $q$https://www.lsa-international.com/$q$, $q$GB$q$, $q$Liverpool$q$, ARRAY[$q$glassware$q$]::text[], '{}'::text[]),
($q$Luigi Bormioli$q$, $q$luigi.bormioli$q$, $q$https://bormioliluigi.com/glassware/en/$q$, $q$IT$q$, $q$Parma$q$, ARRAY[$q$glassware$q$, $q$barware$q$]::text[], '{}'::text[]),
($q$Nude$q$, $q$nude$q$, NULL, NULL, NULL, ARRAY[$q$glassware$q$]::text[], '{}'::text[]),
($q$RCR Cristalleria Italiana$q$, $q$rcr.cristalleria.italiana$q$, $q$https://www.rcrcrystal.com/$q$, $q$IT$q$, $q$Colle di Val d'Elsa$q$, ARRAY[$q$glassware$q$, $q$barware$q$]::text[], '{}'::text[]),
($q$Riedel$q$, $q$riedel$q$, $q$https://www.riedel.com/$q$, $q$AT$q$, $q$Kufstein$q$, ARRAY[$q$glassware$q$, $q$barware$q$]::text[], '{}'::text[]),
($q$Sghr Sugahara$q$, $q$sghr.sugahara$q$, $q$https://www.sugahara.com/$q$, $q$JP$q$, $q$Kujukuri$q$, ARRAY[$q$glassware$q$]::text[], '{}'::text[]),
($q$SIP AND GUZZLE$q$, $q$sip.and.guzzle$q$, $q$https://sipandguzzle.net/$q$, $q$JP$q$, NULL, ARRAY[$q$glassware$q$]::text[], '{}'::text[]),
($q$Spiegelau$q$, $q$spiegelau$q$, $q$https://www.spiegelau.com/$q$, $q$DE$q$, NULL, ARRAY[$q$glassware$q$, $q$barware$q$]::text[], '{}'::text[]),
($q$Toyo-Sasaki Glass$q$, $q$toyo.sasaki.glass$q$, $q$https://www.toyo.sasaki.co.jp/$q$, $q$JP$q$, $q$Yachiyo$q$, ARRAY[$q$glassware$q$]::text[], '{}'::text[]),
($q$Urban Bar$q$, $q$urban.bar$q$, $q$https://www.urbanbar.com/$q$, $q$GB$q$, NULL, ARRAY[$q$glassware$q$, $q$barware$q$]::text[], '{}'::text[]),
($q$Viski$q$, $q$viski$q$, $q$https://www.viski.com/$q$, $q$US$q$, $q$Seattle$q$, ARRAY[$q$glassware$q$, $q$barware$q$]::text[], '{}'::text[]);

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
