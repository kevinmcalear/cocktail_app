-- Where a catalog fact comes from, and two facts a bottle carries on its own
-- (after 20261011150000). Step 1 of the bottle catalog plan:
-- https://claude.ai/artifact/Vu6seuSNtN42nKYb2nDCVR
--
--   items.origin_country   ISO 3166-1 alpha-2 country the drink comes from
--                          ("GB" for Scotch, "MX" for tequila). `origin` stays
--                          the free text ("Speyside, Scotland").
--   items.gi               the protected name it carries, as on the label
--                          ("Vermouth di Torino", "Cognac"), when it has one.
--   item_sources           one row per checked fact: which fact, the page it
--                          was checked on, what kind of page, and when.
--                          Signed-in people read the sources of a shared row
--                          (like the row itself); only app admins (and
--                          migrations) write them.
--
-- Data: `origin_country` is filled for shared rows whose `origin` ends in a
-- plain country name ("Kentucky, USA" is US; "Barbados and Jamaica" and
-- "Caribbean blend" stay empty). Scotland, England, Wales and Northern
-- Ireland are GB. The rows taxonomy v2 checked get their sources.

ALTER TABLE "public"."items"
    ADD COLUMN "origin_country" "text",
    ADD COLUMN "gi" "text",
    ADD CONSTRAINT "items_origin_country_code" CHECK ("origin_country" IS NULL OR "origin_country" ~ '^[A-Z]{2}$'),
    ADD CONSTRAINT "items_gi_length" CHECK ("gi" IS NULL OR char_length(btrim("gi")) BETWEEN 2 AND 80);

COMMENT ON COLUMN "public"."items"."origin_country" IS
    'ISO 3166-1 alpha-2 country the drink comes from. origin keeps the free text.';
COMMENT ON COLUMN "public"."items"."gi" IS
    'The protected name (GI, appellation) the drink carries, as labelled. NULL when it has none.';

CREATE INDEX "items_products_by_country_idx" ON "public"."items" ("origin_country")
    WHERE "origin_country" IS NOT NULL AND "ingredient_role" = 'product';

CREATE TABLE "public"."item_sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    -- exists: it's a real product. merge: a copy was folded into it.
    "field" "text" NOT NULL CHECK ("field" IN ('exists', 'name', 'maker', 'abv', 'origin', 'gi', 'style', 'merge')),
    "url" "text" NOT NULL CHECK ("url" ~ '^https?://\S+$' AND char_length("url") <= 2000),
    -- producer: the maker's own page. retailer: a shop. reference: a guide
    -- such as Difford's. registry: a label or GI register. law: a regulation.
    "kind" "text" NOT NULL CHECK ("kind" IN ('producer', 'retailer', 'reference', 'registry', 'law')),
    "checked_on" "date" NOT NULL,
    "note" "text" CHECK ("note" IS NULL OR char_length("note") <= 500),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "item_sources_one_per_page" UNIQUE ("item_id", "field", "url")
);

COMMENT ON TABLE "public"."item_sources" IS
    'One row per checked catalog fact: the page it was checked on and when.';

ALTER TABLE "public"."item_sources" ENABLE ROW LEVEL SECURITY;

-- Readable when the row it's about is readable and shared (items' own RLS
-- applies inside the subquery, so signed in, like items); venue rows'
-- sources stay with the venue.
CREATE POLICY "Signed-in people read sources of shared rows" ON "public"."item_sources" FOR SELECT TO "authenticated"
    USING (EXISTS (SELECT 1 FROM "public"."items" i WHERE i."id" = "item_id" AND i."bar_id" IS NULL));
CREATE POLICY "App admins manage item sources" ON "public"."item_sources" FOR ALL TO "authenticated"
    USING ("private"."is_app_admin"()) WITH CHECK ("private"."is_app_admin"());

REVOKE ALL ON TABLE "public"."item_sources" FROM "anon", "authenticated";
GRANT SELECT ON TABLE "public"."item_sources" TO "authenticated";
GRANT INSERT, UPDATE, DELETE ON TABLE "public"."item_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."item_sources" TO "service_role";

-- ---------------------------------------------------------------------------
-- Country from the origin text
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE country_in (name text PRIMARY KEY, code text NOT NULL);
INSERT INTO country_in VALUES
('argentina', 'AR'), ('australia', 'AU'), ('austria', 'AT'), ('barbados', 'BB'), ('belgium', 'BE'),
('bermuda', 'BM'), ('bolivia', 'BO'), ('brazil', 'BR'), ('canada', 'CA'), ('chile', 'CL'),
('china', 'CN'), ('colombia', 'CO'), ('croatia', 'HR'), ('cuba', 'CU'), ('curaçao', 'CW'),
('czech republic', 'CZ'), ('czechia', 'CZ'), ('denmark', 'DK'), ('dominican republic', 'DO'),
('england', 'GB'), ('fiji', 'FJ'), ('finland', 'FI'), ('france', 'FR'), ('germany', 'DE'),
('greece', 'GR'), ('grenada', 'GD'), ('guadeloupe', 'GP'), ('guatemala', 'GT'), ('guyana', 'GY'),
('haiti', 'HT'), ('hungary', 'HU'), ('iceland', 'IS'), ('india', 'IN'), ('indonesia', 'ID'),
('ireland', 'IE'), ('italy', 'IT'), ('jamaica', 'JM'), ('japan', 'JP'), ('kenya', 'KE'),
('laos', 'LA'), ('latvia', 'LV'), ('lebanon', 'LB'), ('martinique', 'MQ'), ('mauritius', 'MU'),
('mexico', 'MX'), ('namibia', 'NA'), ('netherlands', 'NL'), ('new zealand', 'NZ'), ('nicaragua', 'NI'),
('northern ireland', 'GB'), ('norway', 'NO'), ('panama', 'PA'), ('peru', 'PE'), ('philippines', 'PH'),
('poland', 'PL'), ('portugal', 'PT'), ('puerto rico', 'PR'), ('russia', 'RU'), ('saint lucia', 'LC'),
('scotland', 'GB'), ('singapore', 'SG'), ('south africa', 'ZA'), ('south korea', 'KR'), ('spain', 'ES'),
('sri lanka', 'LK'), ('st vincent and the grenadines', 'VC'), ('sweden', 'SE'), ('switzerland', 'CH'),
('taiwan', 'TW'), ('thailand', 'TH'), ('trinidad and tobago', 'TT'), ('turkey', 'TR'), ('uk', 'GB'),
('united kingdom', 'GB'), ('united states', 'US'), ('us virgin islands', 'VI'), ('usa', 'US'),
('venezuela', 'VE'), ('vietnam', 'VN'), ('wales', 'GB');

-- The country is the last comma-separated part: "Speyside, Scotland".
UPDATE public.items i SET origin_country = c.code
  FROM country_in c
 WHERE i.bar_id IS NULL AND i.origin_country IS NULL
   AND NULLIF(btrim(i.origin), '') IS NOT NULL
   AND lower(btrim(regexp_replace(i.origin, '^.*,', ''))) = c.name;

DROP TABLE country_in;

-- ---------------------------------------------------------------------------
-- Sources for the rows taxonomy v2 checked (2026-10-09)
-- ---------------------------------------------------------------------------

-- Matched by the row's name or alias, so a row that isn't there is skipped.
CREATE TEMP TABLE source_in (name text NOT NULL, field text NOT NULL, url text NOT NULL, kind text NOT NULL, note text);
INSERT INTO source_in VALUES
-- Styles and the law they rest on.
($q$Sloe Gin$q$, 'style', $q$https://eur-lex.europa.eu/eli/reg/2019/787/oj$q$, 'law', $q$Annex I category 35: sloe gin is a liqueur, at least 25% ABV.$q$),
($q$Sloe Gin$q$, 'style', $q$https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-5/subpart-I/section-5.150$q$, 'law', $q$27 CFR 5.150: sloe gin is a cordial or liqueur.$q$),
($q$Aromatised Wine$q$, 'style', $q$https://eur-lex.europa.eu/eli/reg/2014/251/oj$q$, 'law', $q$Aromatised wine products are their own category, not wine.$q$),
($q$Non-Alcoholic Drink$q$, 'style', $q$https://eur-lex.europa.eu/eli/reg/2019/787/oj$q$, 'law', $q$Art. 10(7): legal spirit names are kept off drinks that don't meet the category.$q$),
($q$Non-Alcoholic Drink$q$, 'style', $q$https://curia.europa.eu/jcms/upload/docs/application/pdf/2025-11/cp250140en.pdf$q$, 'law', $q$CJEU C-563/24: "non-alcoholic gin" may not be used as a name.$q$),
($q$Tequila$q$, 'style', $q$https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-5/subpart-I$q$, 'law', $q$27 CFR 5.148: tequila is a type of agave spirit.$q$),
($q$Mezcal$q$, 'style', $q$https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-5/subpart-I$q$, 'law', $q$27 CFR 5.148: mezcal is a type of agave spirit.$q$),
($q$Bourbon$q$, 'style', $q$https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-5/subpart-I$q$, 'law', $q$27 CFR 5.143 and 5.154: bourbon is a US whiskey type, a distinctive product of the US.$q$),
($q$Corn Whiskey$q$, 'style', $q$https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-5/subpart-I$q$, 'law', $q$27 CFR 5.143: corn whisky is a US whiskey type.$q$),
($q$Ambrato Vermouth$q$, 'style', $q$https://www.gazzettaufficiale.it/eli/id/2017/04/03/17A02417/sg$q$, 'law', $q$Vermouth di Torino decree: bianco runs from white to straw to amber.$q$),
-- Bottles: real, label name, maker and ABV from one page each.
($q$Casa Dragones Reposado Mizunara$q$, 'exists', $q$https://www.blackwellswines.com/collections/tequila/products/casa-dragones-reposado-tequila-mizunara-casks$q$, 'retailer', NULL),
($q$Casa Dragones Reposado Mizunara$q$, 'abv', $q$https://www.blackwellswines.com/collections/tequila/products/casa-dragones-reposado-tequila-mizunara-casks$q$, 'retailer', NULL),
($q$Casa Dragones Reposado Mizunara$q$, 'merge', $q$https://www.blackwellswines.com/collections/tequila/products/casa-dragones-reposado-tequila-mizunara-casks$q$, 'retailer', $q$"Casa Dragones Reposado Tequila" is this bottle.$q$),
($q$Gran Centenario Reposado$q$, 'exists', $q$https://www.grancentenario.com/$q$, 'producer', NULL),
($q$Gran Centenario Reposado$q$, 'name', $q$https://www.grancentenario.com/$q$, 'producer', NULL),
($q$Citadelle Jardin d'Été$q$, 'exists', $q$https://citadellegin.com/gin/jardin-dete/$q$, 'producer', NULL),
($q$Citadelle Jardin d'Été$q$, 'name', $q$https://citadellegin.com/gin/jardin-dete/$q$, 'producer', NULL),
($q$Citadelle Jardin d'Été$q$, 'abv', $q$https://citadellegin.com/gin/jardin-dete/$q$, 'producer', NULL),
($q$Glendalough Wild Botanical Irish Gin$q$, 'exists', $q$https://www.glendaloughdistillery.com/products/wild-botanical-gin$q$, 'producer', NULL),
($q$Glendalough Wild Botanical Irish Gin$q$, 'abv', $q$https://www.glendaloughdistillery.com/products/wild-botanical-gin$q$, 'producer', NULL),
($q$Knob Creek Single Barrel Reserve$q$, 'exists', $q$https://www.diffordsguide.com/beer-wine-spirits/113/knob-creek-single-barrel-reserve$q$, 'reference', NULL),
($q$Knob Creek Single Barrel Reserve$q$, 'name', $q$https://www.diffordsguide.com/beer-wine-spirits/113/knob-creek-single-barrel-reserve$q$, 'reference', NULL),
($q$Knob Creek Single Barrel Reserve$q$, 'abv', $q$https://www.diffordsguide.com/beer-wine-spirits/113/knob-creek-single-barrel-reserve$q$, 'reference', NULL),
($q$Monkey 47 Schwarzwald Dry Gin$q$, 'name', $q$https://www.monkey47.com/$q$, 'producer', NULL),
($q$Monkey 47 Schwarzwald Dry Gin$q$, 'merge', $q$https://www.monkey47.com/$q$, 'producer', $q$"Monkey 47 Gin" and "Monkey 47 Dry Gin" are this bottle.$q$),
($q$Redemption High Rye Bourbon$q$, 'exists', $q$https://www.redemptionwhiskey.com/whiskeys/high-rye-bourbon/$q$, 'producer', NULL),
($q$Redemption High Rye Bourbon$q$, 'abv', $q$https://www.redemptionwhiskey.com/whiskeys/high-rye-bourbon/$q$, 'producer', NULL),
($q$Widow Jane Applewood Rye Whiskey$q$, 'exists', $q$https://www.thebarreltap.com/collections/rye/products/widow-jane-oak-applewood-aged-rye-mash-750ml$q$, 'retailer', $q$Label reads rye mash; filed as Whiskey until the label is checked.$q$),
($q$Widow Jane Applewood Rye Whiskey$q$, 'abv', $q$https://www.thebarreltap.com/collections/rye/products/widow-jane-oak-applewood-aged-rye-mash-750ml$q$, 'retailer', NULL),
($q$Wyoming Whiskey Small Batch Bourbon$q$, 'exists', $q$https://www.wyomingwhiskey.com/small-batch/$q$, 'producer', NULL),
($q$Wyoming Whiskey Small Batch Bourbon$q$, 'abv', $q$https://www.wyomingwhiskey.com/small-batch/$q$, 'producer', NULL),
($q$Paragon Timur Berry Cordial$q$, 'exists', $q$https://monin1912.com/collections/paragon-cordial$q$, 'producer', $q$Monin's Paragon cordial range.$q$),
($q$Paragon Vetiver Cordial$q$, 'exists', $q$https://monin1912.com/collections/paragon-cordial$q$, 'producer', $q$Monin's Paragon cordial range.$q$),
($q$Bordiga Excelsior Vermouth$q$, 'style', $q$https://dandm.com/products/bordiga-vermouth-di-torino-excelsior-rosso-riserva$q$, 'retailer', $q$Sold as Excelsior Rosso Riserva.$q$),
($q$Gotha Marcvs Vermouth$q$, 'style', $q$https://flaskfinewines.com/products/copy-of-gotha-amaro-blu-700ml$q$, 'retailer', $q$Sold as Gotha Marcus Vermouth Rosso.$q$),
($q$Giovannoni Torrontés Vermouth$q$, 'style', $q$https://bottleofitaly.com/en/pages/produttore-giovannoni$q$, 'retailer', $q$Producer profile: the Torrontés one is the dry (seco).$q$),
($q$Unico Zelo Pomelo Vermouth$q$, 'style', $q$https://lucacollections.com.au/el-cy/products/unico-pomelovermouth$q$, 'retailer', $q$Sold as a dry vermouth, 16%.$q$),
($q$Sūpāsawā$q$, 'style', $q$https://www.diffordsguide.com/beer-wine-spirits/6191/supasawa$q$, 'reference', $q$A 0% sour mixer that stands in for lemon or lime.$q$),
($q$Lillet Blanc$q$, 'merge', $q$https://www.diffordsguide.com/beer-wine-spirits/286/lillet-blanc$q$, 'reference', $q$An aperitif wine; no Lillet is called a vermouth.$q$),
($q$Red Star Erguotou$q$, 'name', $q$https://bottleofitaly.com/en/produttori/beijing-red-star$q$, 'retailer', $q$Hongxing (红星) is Red Star.$q$),
($q$Absolut Raspberri$q$, 'name', $q$https://www.diffordsguide.com/beer-wine-spirits/1233/absolut-raspberri$q$, 'reference', NULL),
($q$Planteray XO 20th Anniversary$q$, 'name', $q$https://www.blackwellswines.com/collections/spirits/products/planteray-xo-rum-barbados-20th-anniversary$q$, 'retailer', $q$Plantation was renamed Planteray; same rum.$q$),
($q$Grant's Triple Wood$q$, 'name', $q$https://www.grantswhisky.com/$q$, 'producer', $q$Formerly Family Reserve.$q$);

INSERT INTO public.item_sources (item_id, field, url, kind, checked_on, note)
SELECT public.resolve_ingredient(s.name), s.field, s.url, s.kind, DATE '2026-10-09', s.note
  FROM source_in s
 WHERE public.resolve_ingredient(s.name) IS NOT NULL
ON CONFLICT ON CONSTRAINT "item_sources_one_per_page" DO NOTHING;

DROP TABLE source_in;
