-- DRAFT. Local stack only until Kevin's OK.
--
-- Cocktail Omakase and Bar 7, the two rooms at 217 Eldridge Street on the
-- Lower East Side (opened 27 March 2026 by Cocktail Kingdom Hospitality Group
-- with the owners of Tokyo's Bar Libre), their drinks, and their head
-- bartender Mathew Resler.
--
-- 1. Both bars, as public, unclaimed venue profiles (same rules as the earlier
--    seeds: a bar already here under the same name nearby, or the handle
--    taken, is left alone). They share one Instagram account.
-- 2. Mathew Resler, as a public, unclaimed person profile: professional
--    details only, in our words, no photo. His jobs here and at Bar Goto,
--    and Jillian Vose's as consulting beverage director.
-- 3. Every drink public sources name: the three opening tasting menus
--    (spirited, low-ABV, non-alcoholic), read from the printed menus in the
--    bar's design studio's case study, and four of Bar 7's seven drinks from
--    the press. Ingredients as the menus list them, no measures (none are
--    published). Two Bar 7 drinks have no published name; they carry a plain
--    one and say so in their notes.
-- 4. The menus, as menu editions. The tasting menus change every two weeks,
--    so the opening set is marked as over.
--
-- Also fixes a typo in Bar Libre's bio (Kazuaki Nagao, not Kizuaki).
--
-- Safe to re-run: bars, people, positions, drinks, lines and menus already
-- present are left alone.

-- Seeded drinks don't queue automatic sketches (nobody to bill for them).
SET "app.image_worker" = 'on';

-- --- Bars ---

INSERT INTO "public"."profiles" ("kind", "handle", "display_name", "bio", "website", "instagram", "is_public", "locality",
                                 "address_line", "postcode", "city", "region", "country_code", "latitude", "longitude",
                                 "page_visibility")
SELECT 'bar', v.handle, v.name, v.bio, v.website, 'cocktail_omakase_nyc', true, 'Lower East Side',
       '217 Eldridge Street', '10002', 'New York', 'New York', 'US', 40.7217541, -73.9903257, 'description'
FROM (VALUES
    ('cocktail_omakase_nyc', 'Cocktail Omakase',
     'Twelve-seat cocktail tasting counter at Eldridge and Stanton, opened in March 2026 by Cocktail Kingdom Hospitality Group (Katana Kitten, Superbueno) with Yujiro Kiyosaki and Kazuaki Nagao of Bar Libre in Tokyo, in the old Uchū sushi room. Run like a sushi omakase: four small drinks, each paired with a bite from chef Phillip Kirschen-Clark, over about an hour, from a spirited, a low-ABV or a non-alcoholic menu that changes every two weeks. Mathew Resler leads the bar with Jillian Vose consulting.',
     'https://www.cocktailomakase.com/'),
    ('bar7.cocktailomakase', 'Bar 7',
     'Seven-seat walk-in bar behind Cocktail Omakase, with its own entrance, opened with it in March 2026 at the old walnut counter of the Bar at Uchū. Modelled on Tokyo''s micro bars: seven full-size cocktails and seven dishes, à la carte, from the Cocktail Omakase team led by Mathew Resler.',
     'https://www.cocktailomakase.com/')
) AS v("handle", "name", "bio", "website")
-- Not a second copy of a bar someone already added (add_venue's rule).
WHERE NOT EXISTS (
    SELECT 1 FROM "public"."profiles" p
    WHERE p.kind = 'bar' AND p.latitude BETWEEN 40.7197541 AND 40.7237541
      AND private.venue_name_key(p.display_name) = private.venue_name_key(v.name)
      AND private.distance_km(40.7217541, -73.9903257, p.latitude, p.longitude) <= 0.15
)
ON CONFLICT ("handle") DO NOTHING;

UPDATE "public"."profiles" SET "bio" = replace("bio", 'Kizuaki Nagao', 'Kazuaki Nagao')
WHERE "kind" = 'bar' AND "handle" = 'barlibre_ikebukuro' AND "bio" LIKE '%Kizuaki Nagao%';

-- --- People ---

INSERT INTO "public"."profiles" ("kind", "handle", "display_name", "bio", "is_public", "city")
VALUES ('person', 'mathew.resler', 'Mathew Resler',
        'New York bartender, also known as Mat, who leads the bar at Cocktail Omakase and Bar 7 on the Lower East Side. He helped open Bar Goto, worked at Bar Goto Niban in Brooklyn and ran the bar at Empellón Taqueria, and spent time at Bar Libre in Tokyo before Cocktail Omakase opened in 2026.',
        true, 'New York')
ON CONFLICT ("handle") DO NOTHING;

INSERT INTO "public"."profile_positions" ("person_profile_id", "bar_profile_id", "title", "is_current", "source_url")
SELECT a.id, b.id, v.title, v.is_current, v.source_url
FROM (VALUES
    ('mathew.resler', 'cocktail_omakase_nyc', 'Head bartender', true,
     'https://bartender.com/cocktail-omakase-brings-tokyo-precision-to-new-yorks-lower-east-side/'),
    ('mathew.resler', 'bar7.cocktailomakase', 'Head bartender', true,
     'https://robertsimonson.substack.com/p/gibson-city'),
    ('mathew.resler', 'bargoto_nyc', 'Bartender (opening team)', false,
     'https://www.thespiritsbusiness.com/2026/04/cocktail-omakase-opens-in-nyc/'),
    ('jillian.vose', 'cocktail_omakase_nyc', 'Consulting beverage director', true,
     'https://www.thespiritsbusiness.com/2026/04/cocktail-omakase-opens-in-nyc/')
) AS v("person", "bar", "title", "is_current", "source_url")
JOIN "public"."profiles" a ON a.kind = 'person' AND a.handle = v.person
JOIN "public"."profiles" b ON b.kind = 'bar' AND b.handle = v.bar
WHERE NOT EXISTS (
    SELECT 1 FROM "public"."profile_positions" x
    WHERE x.person_profile_id = a.id AND x.bar_profile_id = b.id AND lower(x.title) = lower(v.title)
);

-- --- Drinks ---

CREATE TEMP TABLE "co_drinks" ("handle" text, "name" text, "description" text, "notes" text, "riff_of" text);
CREATE TEMP TABLE "co_lines" ("handle" text, "drink" text, "pos" int, "ingredient" text);
CREATE TEMP TABLE "co_menu" ("handle" text, "edition" text, "pos" int, "drink" text);

INSERT INTO "co_drinks" VALUES
    ('cocktail_omakase_nyc', 'Yōkoso',
     'Hot, non-alcoholic welcome broth of donko shiitake, tomato and vegetables, seasoned with smoked salt and liquid shio koji.',
     'Poured first on all three opening menus, before the four courses: Yōkoso means welcome. Served hot. Ingredients from the printed opening menus (Crow Hill Design case study, 2026).',
     NULL),
    ('cocktail_omakase_nyc', 'Ember Highball',
     'Smoky non-alcoholic highball of lapsang souchong tea, cedar and local honey, lengthened with plum soda.',
     'The first course on every opening menu, spirited, low-ABV or non-alcoholic. Ingredients from the printed opening menus and the Observer''s review (March 2026).',
     NULL),
    ('cocktail_omakase_nyc', 'Tomatillo Shiso',
     'Lemongrass shochu with tomatillo, lime and citrus.',
     'Second course on the opening spirited menu, served with a miso baked clam. The press also calls it the Tomatillo Shiso Sour. Ingredients from the printed menu; the Observer described a gin version.',
     NULL),
    ('cocktail_omakase_nyc', 'Tomatillo Shiso Sour',
     'Low-ABV sour of lemongrass shochu, tomatillo, shiso and citrus.',
     'Second course on the opening low-ABV menu. Ingredients from the printed menu.',
     NULL),
    ('cocktail_omakase_nyc', 'Tomatillo Shiso (non-alcoholic)',
     'Non-alcoholic tomatillo and shiso with citrus, topped with soda.',
     'Second course on the opening non-alcoholic menu, which prints it as Tomatillo Shiso; named apart here from the shochu version. Ingredients from the printed menu.',
     NULL),
    ('cocktail_omakase_nyc', 'Sushi Sazerac',
     'Barley and sweet potato shochu with rye, nori, an aperitivo and soy demerara, seasoned with bonito bitters and scented with absinthe and melon.',
     'Third course on the opening spirited menu, poured into the glass from a fish-shaped vessel (The Spirits Business). Eater: fortified with shochu and whisky, layered with nori, soy and bonito, finished with melon bitters.',
     'Sazerac'),
    ('cocktail_omakase_nyc', 'Mizunara Negroni',
     'Negroni of London dry gin, sweet vermouth and Campari with Japanese mizunara oak and ume.',
     'Closing course on the opening spirited menu, poured from a silver fish flask (Resy, April 2026).',
     'Negroni'),
    ('cocktail_omakase_nyc', 'Bamboo Tonic',
     'Low-ABV Bamboo of fino and amontillado sherry with dry vermouth, lengthened with tonic.',
     'Third course on the opening low-ABV menu. Ingredients from the printed menu.',
     'Bamboo'),
    ('cocktail_omakase_nyc', 'Kogashi and Grain',
     'Low-ABV drink of Choya ume liqueur, an amaro aperitivo and genmaicha tea with pineapple frond, lime and celery.',
     'Closing course on the opening low-ABV menu. Kogashi is Japanese for scorching or toasting. Ingredients from the printed menu.',
     NULL),
    ('cocktail_omakase_nyc', 'Kurenai',
     'Non-alcoholic red shiso and black currant with oba (green shiso).',
     'Third course on the opening non-alcoholic menu; kurenai means crimson. Ingredients from the printed menu.',
     NULL),
    ('cocktail_omakase_nyc', 'N/A Groni',
     'Non-alcoholic Negroni of Origami Zero, Lyre''s vermouth and Monin bitter.',
     'Closing course on the opening non-alcoholic menu. Ingredients from the printed menu.',
     'Negroni'),
    ('bar7.cocktailomakase', 'Hojicha Espresso Martini',
     'Espresso Martini built on roasted hojicha tea: hojicha-infused vodka, vanilla coffee concentrate, honey and imo shochu.',
     'On Bar 7''s list from opening in March 2026. Mathew Resler built it around layers of roast: toasted tea leaves, roasted sweet potato, coffee and cacao (Forbes, July 2026). Eater''s opening report described shochu in place of the vodka.',
     'Espresso Martini'),
    ('bar7.cocktailomakase', 'Apple Chrysanthemum',
     'White port with apple, Bénédictine and anise.',
     'One of Bar 7''s seven drinks in spring 2026 (Kathryn Maier, Good Taste, May 2026).',
     NULL),
    ('bar7.cocktailomakase', 'Bar 7 Gibson',
     'Gibson brightened with rice vinegar.',
     'Bar 7''s menu name for it isn''t published. Eater (March 2026) described a Gibson brightened with rice vinegar, and Robert Simonson (April 2026) noted Resler has a Gibson at Bar 7.',
     'Gibson'),
    ('bar7.cocktailomakase', 'Charred Lemon Sour',
     'Sour of charred lemon with soba.',
     'Bar 7''s menu name for it isn''t published; Time Out (March 2026) described a charred lemon sour with soba at opening.',
     NULL);

INSERT INTO "co_lines" VALUES
    ('cocktail_omakase_nyc', 'Yōkoso', 0, 'Donko Shiitake'),
    ('cocktail_omakase_nyc', 'Yōkoso', 1, 'Tomato'),
    ('cocktail_omakase_nyc', 'Yōkoso', 2, 'Celery'),
    ('cocktail_omakase_nyc', 'Yōkoso', 3, 'Cabbage'),
    ('cocktail_omakase_nyc', 'Yōkoso', 4, 'Garlic'),
    ('cocktail_omakase_nyc', 'Yōkoso', 5, 'Onion'),
    ('cocktail_omakase_nyc', 'Yōkoso', 6, 'Smoked Salt'),
    ('cocktail_omakase_nyc', 'Yōkoso', 7, 'Liquid Shio Koji'),
    ('cocktail_omakase_nyc', 'Ember Highball', 0, 'Lapsang Souchong'),
    ('cocktail_omakase_nyc', 'Ember Highball', 1, 'Cedar'),
    ('cocktail_omakase_nyc', 'Ember Highball', 2, 'Honey'),
    ('cocktail_omakase_nyc', 'Ember Highball', 3, 'Plum Soda'),
    ('cocktail_omakase_nyc', 'Tomatillo Shiso', 0, 'Lemongrass Shochu'),
    ('cocktail_omakase_nyc', 'Tomatillo Shiso', 1, 'Tomatillo'),
    ('cocktail_omakase_nyc', 'Tomatillo Shiso', 2, 'Lime'),
    ('cocktail_omakase_nyc', 'Tomatillo Shiso', 3, 'Citrus'),
    ('cocktail_omakase_nyc', 'Tomatillo Shiso Sour', 0, 'Lemongrass Shochu'),
    ('cocktail_omakase_nyc', 'Tomatillo Shiso Sour', 1, 'Tomatillo'),
    ('cocktail_omakase_nyc', 'Tomatillo Shiso Sour', 2, 'Shiso'),
    ('cocktail_omakase_nyc', 'Tomatillo Shiso Sour', 3, 'Citrus'),
    ('cocktail_omakase_nyc', 'Tomatillo Shiso (non-alcoholic)', 0, 'Tomatillo'),
    ('cocktail_omakase_nyc', 'Tomatillo Shiso (non-alcoholic)', 1, 'Shiso'),
    ('cocktail_omakase_nyc', 'Tomatillo Shiso (non-alcoholic)', 2, 'Citrus'),
    ('cocktail_omakase_nyc', 'Tomatillo Shiso (non-alcoholic)', 3, 'Soda Water'),
    ('cocktail_omakase_nyc', 'Sushi Sazerac', 0, 'Barley Shochu'),
    ('cocktail_omakase_nyc', 'Sushi Sazerac', 1, 'Sweet Potato Shochu'),
    ('cocktail_omakase_nyc', 'Sushi Sazerac', 2, 'Rye Whiskey'),
    ('cocktail_omakase_nyc', 'Sushi Sazerac', 3, 'Nori'),
    ('cocktail_omakase_nyc', 'Sushi Sazerac', 4, 'Aperitivo'),
    ('cocktail_omakase_nyc', 'Sushi Sazerac', 5, 'Soy Demerara'),
    ('cocktail_omakase_nyc', 'Sushi Sazerac', 6, 'Bonito Bitters'),
    ('cocktail_omakase_nyc', 'Sushi Sazerac', 7, 'Absinthe'),
    ('cocktail_omakase_nyc', 'Sushi Sazerac', 8, 'Melon'),
    ('cocktail_omakase_nyc', 'Mizunara Negroni', 0, 'London Dry Gin'),
    ('cocktail_omakase_nyc', 'Mizunara Negroni', 1, 'Mizunara'),
    ('cocktail_omakase_nyc', 'Mizunara Negroni', 2, 'Ume'),
    ('cocktail_omakase_nyc', 'Mizunara Negroni', 3, 'Sweet Vermouth'),
    ('cocktail_omakase_nyc', 'Mizunara Negroni', 4, 'Campari'),
    ('cocktail_omakase_nyc', 'Bamboo Tonic', 0, 'Fino Sherry'),
    ('cocktail_omakase_nyc', 'Bamboo Tonic', 1, 'Amontillado Sherry'),
    ('cocktail_omakase_nyc', 'Bamboo Tonic', 2, 'Dry Vermouth'),
    ('cocktail_omakase_nyc', 'Bamboo Tonic', 3, 'Tonic Water'),
    ('cocktail_omakase_nyc', 'Kogashi and Grain', 0, 'Choya'),
    ('cocktail_omakase_nyc', 'Kogashi and Grain', 1, 'Amaro Aperitivo'),
    ('cocktail_omakase_nyc', 'Kogashi and Grain', 2, 'Genmaicha'),
    ('cocktail_omakase_nyc', 'Kogashi and Grain', 3, 'Pineapple Frond'),
    ('cocktail_omakase_nyc', 'Kogashi and Grain', 4, 'Lime'),
    ('cocktail_omakase_nyc', 'Kogashi and Grain', 5, 'Celery'),
    ('cocktail_omakase_nyc', 'Kurenai', 0, 'Red Shiso'),
    ('cocktail_omakase_nyc', 'Kurenai', 1, 'Black Currant'),
    ('cocktail_omakase_nyc', 'Kurenai', 2, 'Oba'),
    ('cocktail_omakase_nyc', 'N/A Groni', 0, 'Origami Zero'),
    ('cocktail_omakase_nyc', 'N/A Groni', 1, 'Lyre''s Vermouth'),
    ('cocktail_omakase_nyc', 'N/A Groni', 2, 'Monin Bitter'),
    ('bar7.cocktailomakase', 'Hojicha Espresso Martini', 0, 'Hojicha-Infused Vodka'),
    ('bar7.cocktailomakase', 'Hojicha Espresso Martini', 1, 'Vanilla Coffee Concentrate'),
    ('bar7.cocktailomakase', 'Hojicha Espresso Martini', 2, 'Honey'),
    ('bar7.cocktailomakase', 'Hojicha Espresso Martini', 3, 'Imo Shochu'),
    ('bar7.cocktailomakase', 'Apple Chrysanthemum', 0, 'White Port'),
    ('bar7.cocktailomakase', 'Apple Chrysanthemum', 1, 'Apple'),
    ('bar7.cocktailomakase', 'Apple Chrysanthemum', 2, 'Bénédictine'),
    ('bar7.cocktailomakase', 'Apple Chrysanthemum', 3, 'Anise'),
    ('bar7.cocktailomakase', 'Bar 7 Gibson', 0, 'Rice Vinegar'),
    ('bar7.cocktailomakase', 'Charred Lemon Sour', 0, 'Charred Lemon'),
    ('bar7.cocktailomakase', 'Charred Lemon Sour', 1, 'Soba');

INSERT INTO "co_menu" VALUES
    ('cocktail_omakase_nyc', 'Opening menu: Spirited', 0, 'Yōkoso'),
    ('cocktail_omakase_nyc', 'Opening menu: Spirited', 1, 'Ember Highball'),
    ('cocktail_omakase_nyc', 'Opening menu: Spirited', 2, 'Tomatillo Shiso'),
    ('cocktail_omakase_nyc', 'Opening menu: Spirited', 3, 'Sushi Sazerac'),
    ('cocktail_omakase_nyc', 'Opening menu: Spirited', 4, 'Mizunara Negroni'),
    ('cocktail_omakase_nyc', 'Opening menu: Low ABV', 0, 'Yōkoso'),
    ('cocktail_omakase_nyc', 'Opening menu: Low ABV', 1, 'Ember Highball'),
    ('cocktail_omakase_nyc', 'Opening menu: Low ABV', 2, 'Tomatillo Shiso Sour'),
    ('cocktail_omakase_nyc', 'Opening menu: Low ABV', 3, 'Bamboo Tonic'),
    ('cocktail_omakase_nyc', 'Opening menu: Low ABV', 4, 'Kogashi and Grain'),
    ('cocktail_omakase_nyc', 'Opening menu: Non-alcoholic', 0, 'Yōkoso'),
    ('cocktail_omakase_nyc', 'Opening menu: Non-alcoholic', 1, 'Ember Highball'),
    ('cocktail_omakase_nyc', 'Opening menu: Non-alcoholic', 2, 'Tomatillo Shiso (non-alcoholic)'),
    ('cocktail_omakase_nyc', 'Opening menu: Non-alcoholic', 3, 'Kurenai'),
    ('cocktail_omakase_nyc', 'Opening menu: Non-alcoholic', 4, 'N/A Groni'),
    ('bar7.cocktailomakase', 'Spring 2026', 0, 'Hojicha Espresso Martini'),
    ('bar7.cocktailomakase', 'Spring 2026', 1, 'Apple Chrysanthemum'),
    ('bar7.cocktailomakase', 'Spring 2026', 2, 'Bar 7 Gibson'),
    ('bar7.cocktailomakase', 'Spring 2026', 3, 'Charred Lemon Sour');

CREATE TEMP TABLE "co_bars" AS
SELECT DISTINCT ON (p.handle) p.handle, p.id FROM "public"."profiles" p
WHERE p.kind = 'bar' AND p.handle IN ('cocktail_omakase_nyc', 'bar7.cocktailomakase')
ORDER BY p.handle, p.created_at;

-- Nor flavour jobs: with CATALOG_AI_FILL=on each one is a paid AI fill for a
-- drink with no venue (same rule as 20261007190000_bar_history). Note the
-- queue for these bars' drinks now and put it back at the end.
CREATE TEMP TABLE "co_flavor_jobs" AS
SELECT j.* FROM "private"."item_flavor_jobs" j
JOIN "public"."items" i ON i.id = j.item_id
WHERE i.item_type = 'cocktail' AND i.bar_id IS NULL AND i.origin_bar_profile_id IN (SELECT id FROM "co_bars");

INSERT INTO "public"."items" ("name", "item_type", "description", "notes", "origin", "riff_of_id", "origin_bar_profile_id",
                              "origin_year")
SELECT d.name, 'cocktail', d.description, d.notes, CASE WHEN c.id IS NULL THEN 'Original' ELSE 'Varient' END, c.id, p.id, 2026
FROM "co_drinks" d
JOIN "co_bars" p ON p.handle = d.handle
LEFT JOIN LATERAL (
    SELECT c.id FROM "public"."items" c
    WHERE c.is_catalog AND c.item_type = 'cocktail' AND lower(btrim(c.name)) = lower(d.riff_of)
    ORDER BY c.created_at LIMIT 1
) c ON true
WHERE NOT EXISTS (
    SELECT 1 FROM "public"."items" i
    WHERE i.item_type = 'cocktail' AND i.bar_id IS NULL AND i.origin_bar_profile_id = p.id
      AND public.menu_name_key(i.name) = public.menu_name_key(d.name)
);

ALTER TABLE "co_drinks" ADD COLUMN "item_id" uuid;
UPDATE "co_drinks" d SET "item_id" = (
    SELECT i.id FROM "public"."items" i JOIN "co_bars" p ON p.handle = d.handle
    WHERE i.item_type = 'cocktail' AND i.bar_id IS NULL AND i.origin_bar_profile_id = p.id
      AND public.menu_name_key(i.name) = public.menu_name_key(d.name)
    ORDER BY (i.name = d.name) DESC, i.created_at, i.id LIMIT 1
);
DELETE FROM "co_drinks" WHERE "item_id" IS NULL;

-- --- Ingredient lines, only for drinks that have none ---

ALTER TABLE "co_lines" ADD COLUMN "item_id" uuid;
UPDATE "co_lines" l SET "item_id" = d.item_id
FROM "co_drinks" d
WHERE d.handle = l.handle AND d.name = l.drink
  AND NOT EXISTS (SELECT 1 FROM "public"."recipes" r WHERE r.recipe_item_id = d.item_id);
DELETE FROM "co_lines" WHERE "item_id" IS NULL;

-- Shared ingredients, reusing one with the same name. New ones are a menu's
-- wording ("Soy Demerara", "Pineapple Frond"), so they stay out of
-- ingredient search; drink pages still show them.
CREATE TEMP TABLE "co_ingredients" AS
SELECT DISTINCT ON (lower(l.ingredient)) l.ingredient AS name, NULL::uuid AS id
FROM "co_lines" l ORDER BY lower(l.ingredient);

UPDATE "co_ingredients" x SET "id" = (
    SELECT i.id FROM "public"."items" i
    WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL AND lower(i.name) = lower(x.name)
    ORDER BY i.is_catalog DESC, i.created_at LIMIT 1
);

-- ponytail: once "one of each ingredient" (public.ingredient_key and
-- ingredient_aliases) is in, a name it counts as the same ingredient
-- ("Aperitivo", "Bitter Aperitivo") reuses that one, since its guard refuses
-- a second. Without it, exact names only.
DO $$
BEGIN
    IF to_regproc('public.ingredient_key') IS NOT NULL THEN
        EXECUTE $sql$
            UPDATE co_ingredients x SET id = coalesce(
                (SELECT i.id FROM public.items i
                 WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL
                   AND public.ingredient_key(i.name) = public.ingredient_key(x.name)
                 ORDER BY i.is_core DESC, i.created_at LIMIT 1),
                (SELECT a.item_id FROM public.ingredient_aliases a WHERE a.key = public.ingredient_key(x.name) LIMIT 1))
            WHERE x.id IS NULL
        $sql$;
    END IF;
END $$;

WITH "added" AS (
    INSERT INTO "public"."items" ("name", "item_type", "hide_from_search")
    SELECT x.name, 'ingredient', true FROM "co_ingredients" x WHERE x.id IS NULL
    RETURNING "id", "name"
)
UPDATE "co_ingredients" x SET "id" = a.id FROM "added" a WHERE x.id IS NULL AND a.name = x.name;

INSERT INTO "public"."recipes" ("recipe_item_id", "ingredient_item_id", "parent_ingredient_id", "amount", "unit",
                                "is_optional", "sort_order")
SELECT l.item_id, i.id, i.generic_id, NULL, NULL, false, l.pos
FROM "co_lines" l
JOIN "co_ingredients" x ON lower(x.name) = lower(l.ingredient)
JOIN "public"."items" i ON i.id = x.id;

-- --- Menus ---

INSERT INTO "public"."profile_menu_editions" ("profile_id", "name", "year", "month", "end_year", "end_month", "is_current",
                                              "source_url")
SELECT p.id, v.name, 2026, 3, v.end_year, v.end_month, v.is_current, v.source_url
FROM (VALUES
    ('cocktail_omakase_nyc', 'Opening menu: Spirited', 2026, 4, false, 'https://www.crowhilldesign.com/case-studies/cocktailomakase'),
    ('cocktail_omakase_nyc', 'Opening menu: Low ABV', 2026, 4, false, 'https://www.crowhilldesign.com/case-studies/cocktailomakase'),
    ('cocktail_omakase_nyc', 'Opening menu: Non-alcoholic', 2026, 4, false, 'https://www.crowhilldesign.com/case-studies/cocktailomakase'),
    ('bar7.cocktailomakase', 'Spring 2026', NULL, NULL, false, 'https://ny.eater.com/news/410272/cocktail-omakase-bar-7-open-lower-east-side')
) AS v("handle", "name", "end_year", "end_month", "is_current", "source_url")
JOIN "co_bars" p ON p.handle = v.handle
ON CONFLICT ON CONSTRAINT "profile_menu_editions_once" DO NOTHING;

INSERT INTO "public"."profile_menu_edition_drinks" ("edition_id", "item_id", "sort_order")
SELECT m.id, d.item_id, x.pos
FROM "co_menu" x
JOIN "co_bars" p ON p.handle = x.handle
JOIN "public"."profile_menu_editions" m ON m.profile_id = p.id AND m.name = x.edition AND m.year = 2026 AND m.month = 3
JOIN "co_drinks" d ON d.handle = x.handle AND d.name = x.drink
WHERE NOT EXISTS (
    SELECT 1 FROM "public"."profile_menu_edition_drinks" o WHERE o.edition_id = m.id AND o.item_id = d.item_id
);

-- --- Put these drinks' flavour jobs back ---

DELETE FROM "private"."item_flavor_jobs" j
USING "co_drinks" d
WHERE j.item_id = d.item_id AND NOT EXISTS (SELECT 1 FROM "co_flavor_jobs" o WHERE o.item_id = j.item_id);
UPDATE "private"."item_flavor_jobs" j SET
    "status" = o.status, "revision" = o.revision, "attempts" = o.attempts, "run_after" = o.run_after,
    "lease_until" = o.lease_until, "last_error" = o.last_error, "updated_at" = o.updated_at
FROM "co_flavor_jobs" o
WHERE j.item_id = o.item_id AND j.revision <> o.revision;

DROP TABLE "co_flavor_jobs", "co_ingredients", "co_bars", "co_menu", "co_lines", "co_drinks";

RESET "app.image_worker";
