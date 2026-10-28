-- Every Cocktail Omakase and Bar 7 drink the web shows since they opened in
-- March 2026, so Mathew Resler finds them all when he claims the bars
-- (28 Oct 2026). Read from the printed menus guests photographed (Yelp), the
-- bars' own Instagram posts and story highlights, and the press. Ingredients
-- as the menus print them, no measures (none are published), descriptions in
-- our own words.
--
-- 1. Fixes to 20261008000000, which read the opening menus from the design
--    studio's mockups. The menus as served show one Tomatillo Shiso Sour on
--    both the spirited and low-ABV menus, so the mockup's "Tomatillo Shiso"
--    goes. Bar 7's printed list names the "Gibson" and gives full ingredients
--    and prices for its drinks.
-- 2. New drinks: the summer spirited and low-ABV menus, the autumn spirited
--    menu, the Matcha Coconut, Bar 7's other three drinks, and Bar Libre's
--    menu from its June residency at Bar 7 (credited to Bar Libre).
-- 3. The menus, as menu editions: Bar 7's list in its printed order, three
--    later tasting menus, and the residency on Bar Libre's page (a bar's
--    menus hold its own drinks). No low-ABV or non-alcoholic
--    cards turned up for the autumn menu, nor anything for the other
--    two-week rotations.
--
-- Fixes apply only while a bar is unclaimed, and lines are replaced only
-- while a drink has no measures, so nothing a person changed is touched.
-- Safe to re-run.

-- Seeded drinks don't queue automatic sketches (nobody to bill for them).
SET "app.image_worker" = 'on';

CREATE TEMP TABLE "om_bars" AS
SELECT DISTINCT ON (p.handle) p.handle, p.id, p.claimed_at FROM "public"."profiles" p
WHERE p.kind = 'bar' AND p.handle IN ('cocktail_omakase_nyc', 'bar7.cocktailomakase', 'barlibre_ikebukuro')
ORDER BY p.handle, p.created_at;

-- Nor flavour jobs: with CATALOG_AI_FILL=on each one is a paid AI fill for a
-- drink with no venue (same rule as 20261008000000). Note the queue for these
-- bars' drinks now and put it back at the end.
CREATE TEMP TABLE "om_flavor_jobs" AS
SELECT j.* FROM "private"."item_flavor_jobs" j
JOIN "public"."items" i ON i.id = j.item_id
WHERE i.item_type = 'cocktail' AND i.bar_id IS NULL AND i.origin_bar_profile_id IN (SELECT id FROM "om_bars");

-- --- 1. Fixes ---

-- The served spirited menu pours the Tomatillo Shiso Sour, not the mockup's
-- Tomatillo Shiso (Yelp photo of the printed menus, 18 Apr 2026).
UPDATE "public"."profile_menu_edition_drinks" d SET "item_id" = sour.id
FROM "public"."profile_menu_editions" e, "om_bars" b, "public"."items" shiso, "public"."items" sour
WHERE e.id = d.edition_id AND e.profile_id = b.id AND e.name = 'Opening menu: Spirited'
  AND b.handle = 'cocktail_omakase_nyc' AND b.claimed_at IS NULL
  AND shiso.id = d.item_id AND shiso.origin_bar_profile_id = b.id AND shiso.item_type = 'cocktail'
  AND shiso.bar_id IS NULL AND shiso.name = 'Tomatillo Shiso'
  AND sour.origin_bar_profile_id = b.id AND sour.item_type = 'cocktail' AND sour.bar_id IS NULL
  AND sour.name = 'Tomatillo Shiso Sour'
  AND NOT EXISTS (SELECT 1 FROM "public"."profile_menu_edition_drinks" x WHERE x.edition_id = e.id AND x.item_id = sour.id);

DELETE FROM "public"."items" i USING "om_bars" b
WHERE b.handle = 'cocktail_omakase_nyc' AND b.claimed_at IS NULL
  AND i.origin_bar_profile_id = b.id AND i.item_type = 'cocktail' AND i.bar_id IS NULL
  AND i.name = 'Tomatillo Shiso' AND i.description = 'Lemongrass shochu with tomatillo, lime and citrus.';

CREATE TEMP TABLE "om_fixes" ("handle" text, "name" text, "old_name" text, "old_description" text, "description" text,
                              "price" text, "old_notes" text, "notes" text);
INSERT INTO "om_fixes" VALUES
    ('cocktail_omakase_nyc', 'Tomatillo Shiso Sour', NULL,
     'Low-ABV sour of lemongrass shochu, tomatillo, shiso and citrus.',
     'Sour of lemongrass shochu with shiso, tomatillo and citrus, topped with soda.',
     NULL,
     'Second course on the opening low-ABV menu. Ingredients from the printed menu.',
     'Second course on both the opening spirited and low-ABV menus, paired with a miso baked clam (sake, ginger, lemon, breadcrumbs). Ingredients from the printed menus as served (Yelp photo, April 2026). The Observer described a gin version; reviewers name the citrus as yuzu or lime.'),
    ('bar7.cocktailomakase', 'Gibson', 'Bar 7 Gibson',
     'Gibson brightened with rice vinegar.',
     'Gibson of London dry gin and a blend of vermouths, brightened with rice vinegar.',
     '22.50',
     'Bar 7''s menu name for it isn''t published. Eater (March 2026) described a Gibson brightened with rice vinegar, and Robert Simonson (April 2026) noted Resler has a Gibson at Bar 7.',
     'On Bar 7''s printed list from opening, $22.50 (Yelp photo, April 2026). Eater (March 2026) and Robert Simonson (April 2026) wrote about it.'),
    ('bar7.cocktailomakase', 'Charred Lemon Sour', NULL,
     'Sour of charred lemon with soba.',
     'Sour of mugi (barley) shochu with charred lemon and soba.',
     '19.50',
     'Bar 7''s menu name for it isn''t published; Time Out (March 2026) described a charred lemon sour with soba at opening.',
     'On Bar 7''s printed list from opening, $19.50 (Yelp photo, April 2026); Time Out described it at opening, and a guest called it a smoked lemon sour.'),
    ('bar7.cocktailomakase', 'Hojicha Espresso Martini', NULL, NULL, NULL, '21.50', NULL,
     'Bar 7''s printed list in April 2026 gives imo shochu, coffee, vanilla and hojicha, $21.50, with no vodka; Forbes (July 2026) lists a hojicha-infused vodka as well.'),
    ('bar7.cocktailomakase', 'Apple Chrysanthemum', NULL, NULL, NULL, '21.50', NULL,
     'On Bar 7''s printed list from opening, $21.50.'),
    ('cocktail_omakase_nyc', 'Mizunara Negroni', NULL, NULL, NULL, NULL, NULL,
     'Also poured full size at Bar 7. Resy calls the mizunara an oak liqueur. It came back on the autumn 2026 spirited menu with umeshu in place of the ume and sweet vermouth.'),
    ('cocktail_omakase_nyc', 'Sushi Sazerac', NULL, NULL, NULL, NULL, NULL,
     'The menu as served prints soy and soba cha demerara, and "absinthe and melon aromatics". Whisky Advocate (October 2026) printed Resler''s home version, inspired by a Sushi Sour the owners brought back from Japan: nori-infused rye, demerara, Campari, barley shochu and aromatic bitters over one large cube, with lemon oils.');

UPDATE "public"."items" i SET
    "name" = f.name,
    "description" = coalesce(f.description, i.description),
    "price" = coalesce(i.price, f.price)
FROM "om_fixes" f JOIN "om_bars" b ON b.handle = f.handle
WHERE b.claimed_at IS NULL AND i.origin_bar_profile_id = b.id AND i.item_type = 'cocktail' AND i.bar_id IS NULL
  AND i.name = coalesce(f.old_name, f.name)
  AND (f.old_description IS NULL OR i.description = f.old_description);

-- Notes: replace the old wording, or add to notes nobody has rewritten.
UPDATE "public"."item_notes" n SET "body" = CASE WHEN n.body = f.old_notes THEN f.notes ELSE n.body || ' ' || f.notes END
FROM "om_fixes" f JOIN "om_bars" b ON b.handle = f.handle, "public"."items" i
WHERE b.claimed_at IS NULL AND i.origin_bar_profile_id = b.id AND i.item_type = 'cocktail' AND i.bar_id IS NULL
  AND i.name = f.name AND n.item_id = i.id AND n.read_level IS NULL
  AND (n.body = f.old_notes OR (f.old_notes IS NULL AND position(f.notes IN n.body) = 0));

-- --- 2. Drinks ---

CREATE TEMP TABLE "om_drinks" ("handle" text, "name" text, "description" text, "notes" text, "riff_of" text,
                               "glass" text, "price" text);
CREATE TEMP TABLE "om_lines" ("handle" text, "drink" text, "pos" int, "ingredient" text);

INSERT INTO "om_drinks" VALUES
    -- Summer menus (a guest's Instagram story from early August 2026 and a
    -- Yelp photo of the spirited menu, posted 6 Oct 2026).
    ('cocktail_omakase_nyc', 'Mukaebi Dashi',
     'Cold welcome dashi of grilled tomato and lemongrass with a savoury "umami bomb".',
     'Poured first on the summer 2026 menus, served cold, where the opening menus began with the hot Yōkoso. Mukaebi is the fire lit to welcome spirits home at Obon. Ingredients from the printed spirited menu.',
     NULL, NULL, NULL),
    ('cocktail_omakase_nyc', 'Raspberry Sansho Fizz',
     'Fizz of rum and raspberry shrub with sansho pepper.',
     'First course on the summer 2026 spirited menu, with a soy-marinated jammy egg (shiso and nasturtium salsa verde, zucchini chip). Ingredients from the printed menu.',
     NULL, NULL, NULL),
    ('cocktail_omakase_nyc', 'Wakayama Spritz',
     'Spritz of yuzu vodka and Aperol topped with sparkling plum.',
     'Second course on the summer 2026 spirited menu, with octopus carpaccio (radish, citrus zests, ginger, sesame, herbs, wasabi pea crumble). Wakayama is Japan''s ume country. Ingredients from the printed menu.',
     NULL, NULL, NULL),
    ('cocktail_omakase_nyc', 'Lemongrass Negroni',
     'Clear, stirred Negroni twist of lemongrass shochu and gin with white verjus and Lillet.',
     'Third course on the summer 2026 spirited menu, with an inari lettuce cup (corn and prosciutto fried rice, negi, black garlic tofu crema, togarashi oil). Served on the rocks with a leaf. Ingredients from the printed menu.',
     'Negroni', 'Rocks', NULL),
    ('cocktail_omakase_nyc', 'Midori Gimlet',
     'Gimlet of gin and Midori seasoned with li hing (salty dried plum).',
     'Closing course on the summer 2026 spirited menu, with koji-marinated super-crunch chicken in a li hing mui sweet and sour sauce. Ingredients from the printed menu.',
     'Gimlet', NULL, NULL),
    ('cocktail_omakase_nyc', 'SerenTea',
     'Low-ABV tea drink.',
     'First course on the summer 2026 low-ABV menu, with the soy-marinated jammy egg. The only photo of the printed menu is too small to read its ingredients.',
     NULL, NULL, NULL),
    ('cocktail_omakase_nyc', 'Rising Sun Sour',
     'Low-ABV sour with habanero and agave.',
     'Second course on the summer 2026 low-ABV menu, with a crab cake. The photo of the printed menu hides the first letters of the name and most of the ingredients; habanero and agave are legible.',
     NULL, NULL, NULL),
    ('cocktail_omakase_nyc', '19/24',
     'Low-ABV drink of white port and lychee shochu, served up.',
     'Third course on the summer 2026 low-ABV menu, with the inari lettuce cup. Served in a coupe. Ingredients from a guest''s story and the printed menu.',
     NULL, 'Coupe', NULL),
    ('cocktail_omakase_nyc', 'Apricot & Basil Cooler',
     'Long cooler of gin, lemon and Thai basil, topped with apricot soda.',
     'Closing course on the summer 2026 low-ABV menu, with koji-marinated super-crunch chicken and white miso honey mustard. Ingredients from a guest''s story and the printed menu.',
     NULL, 'Highball', NULL),
    ('cocktail_omakase_nyc', 'Cucumber Melon',
     'Long drink of gin and yellow watermelon with wasabi.',
     'Poured for a guest on the same summer 2026 visit as the low-ABV menu (Instagram story, early August); which menu it was on isn''t shown.',
     NULL, 'Highball', NULL),
    -- Autumn spirited menu (Yelp photo of the printed menu, posted 16 Oct 2026).
    ('cocktail_omakase_nyc', 'Ember Highball (calvados)',
     'The Ember Highball made with calvados: lapsang souchong tea and cedar, lengthened with plum soda.',
     'First course on the autumn 2026 spirited menu, with a soy-marinated jammy egg (charred tomatillo, sudachi lime and shiso salsa verde). The opening menus poured it without alcohol, with local honey where this has calvados.',
     NULL, NULL, NULL),
    ('cocktail_omakase_nyc', 'Little Osaka',
     'Rye with Amaro Ciociaro and kokuto (Okinawan black sugar) rum.',
     'Second course on the autumn 2026 spirited menu, with a seafood salad (scallop, squid, shrimp, yuzu herb dressing, caper breadcrumbs). Ingredients from the printed menu.',
     NULL, NULL, NULL),
    ('cocktail_omakase_nyc', 'Mizunara Negroni (umeshu)',
     'Negroni of London dry gin, Campari and mizunara oak, with umeshu in place of the sweet vermouth.',
     'Third course on the autumn 2026 spirited menu, with avocado crispy rice (taré, yuzu and wasabi tobiko). The opening version closed the first menus with ume and sweet vermouth.',
     'Negroni', NULL, NULL),
    ('cocktail_omakase_nyc', 'Shochu Slipper',
     'Kome (rice) shochu with Midori and a citrus blend.',
     'Closing course on the autumn 2026 spirited menu, with koji-marinated super-crunch chicken and hot maple mustard. Ingredients from the printed menu.',
     NULL, NULL, NULL),
    ('cocktail_omakase_nyc', 'Matcha Coconut',
     'Non-alcoholic ceremonial-grade matcha whisked with coconut.',
     'From the non-alcoholic menu; the bar called it a fan favourite on Instagram in September 2026.',
     NULL, NULL, NULL),
    -- Bar 7's printed list (Yelp photo, April 2026).
    ('bar7.cocktailomakase', '7&7',
     'Bar 7''s Seven and Seven: Seagram''s 7 lengthened with original ramune.',
     'First on Bar 7''s printed list from opening, $19.50. Eater''s opening photo shows it tall, on ice.',
     NULL, 'Highball', '19.50'),
    ('bar7.cocktailomakase', 'Highball',
     'Whisky highball of a Japanese and Scotch blend with kinkan (kumquat).',
     'On Bar 7''s printed list from opening, $19.50.',
     'Whisky Highball', NULL, '19.50'),
    ('bar7.cocktailomakase', 'Mizunara Negroni',
     'Full-size Negroni of London dry gin, sweet vermouth and Campari with Japanese mizunara oak and ume.',
     'On Bar 7''s printed list from opening, $22.50: the Negroni that closed the counter''s opening spirited menu, poured full size.',
     'Negroni', NULL, '22.50'),
    -- Bar Libre's menu at its Bar 7 residency, 23 to 26 June 2026 (the
    -- printed menu in the bars' Instagram highlights, and guests' posts).
    ('barlibre_ikebukuro', 'Wa-Tini',
     'Martini of Roku gin and Kubota sake with Japanese bitters and a pickled plum.',
     'On Bar Libre''s menu for its four-night residency at Bar 7 in New York, June 2026, $21.50. Made by Yujiro Kiyosaki and Kazuaki Nagao.',
     'Martini', NULL, '21.50'),
    ('barlibre_ikebukuro', 'Fresarita',
     'Strawberry Margarita built on Don Julio Reposado.',
     'On Bar Libre''s menu for its residency at Bar 7 in New York, June 2026. The photo of the menu shows only the start of the ingredients.',
     'Margarita', NULL, NULL),
    ('barlibre_ikebukuro', 'Edo Manhattan',
     'Bar Libre''s Manhattan, named for old Tokyo.',
     'On Bar Libre''s menu for its residency at Bar 7 in New York, June 2026. No ingredients published.',
     'Manhattan', NULL, NULL),
    ('barlibre_ikebukuro', 'Fresh Fruit Cocktail',
     'Made to order from the fruit the guest picks from a basket on the bar.',
     'The special of Bar Libre''s residency at Bar 7 in New York, June 2026, in limited numbers each night. Guests posted fig, plum (a gimlet), kumquat and raspberry, mango, strawberry with basil and starfruit, pomegranate (a Jack Rose), gooseberry, grape with sansho pepper and Nikka gin, banana, passion fruit, blackberry, watermelon and kiwi (a coffee fizz) versions.',
     NULL, NULL, NULL);

INSERT INTO "om_lines" VALUES
    ('cocktail_omakase_nyc', 'Mukaebi Dashi', 0, 'Grilled Tomato'),
    ('cocktail_omakase_nyc', 'Mukaebi Dashi', 1, 'Lemongrass'),
    ('cocktail_omakase_nyc', 'Mukaebi Dashi', 2, 'Umami Bomb'),
    ('cocktail_omakase_nyc', 'Raspberry Sansho Fizz', 0, 'Rum'),
    ('cocktail_omakase_nyc', 'Raspberry Sansho Fizz', 1, 'Raspberry Shrub'),
    ('cocktail_omakase_nyc', 'Raspberry Sansho Fizz', 2, 'Sansho Pepper'),
    ('cocktail_omakase_nyc', 'Wakayama Spritz', 0, 'Yuzu Vodka'),
    ('cocktail_omakase_nyc', 'Wakayama Spritz', 1, 'Aperol'),
    ('cocktail_omakase_nyc', 'Wakayama Spritz', 2, 'Sparkling Plum'),
    ('cocktail_omakase_nyc', 'Lemongrass Negroni', 0, 'Lemongrass Shochu'),
    ('cocktail_omakase_nyc', 'Lemongrass Negroni', 1, 'Gin'),
    ('cocktail_omakase_nyc', 'Lemongrass Negroni', 2, 'White Verjus'),
    ('cocktail_omakase_nyc', 'Lemongrass Negroni', 3, 'Lillet'),
    ('cocktail_omakase_nyc', 'Midori Gimlet', 0, 'Gin'),
    ('cocktail_omakase_nyc', 'Midori Gimlet', 1, 'Midori'),
    ('cocktail_omakase_nyc', 'Midori Gimlet', 2, 'Li Hing'),
    ('cocktail_omakase_nyc', 'Rising Sun Sour', 0, 'Habanero'),
    ('cocktail_omakase_nyc', 'Rising Sun Sour', 1, 'Agave'),
    ('cocktail_omakase_nyc', '19/24', 0, 'White Port'),
    ('cocktail_omakase_nyc', '19/24', 1, 'Lychee Shochu'),
    ('cocktail_omakase_nyc', 'Apricot & Basil Cooler', 0, 'Gin'),
    ('cocktail_omakase_nyc', 'Apricot & Basil Cooler', 1, 'Lemon'),
    ('cocktail_omakase_nyc', 'Apricot & Basil Cooler', 2, 'Thai Basil'),
    ('cocktail_omakase_nyc', 'Apricot & Basil Cooler', 3, 'Apricot Soda'),
    ('cocktail_omakase_nyc', 'Cucumber Melon', 0, 'Gin'),
    ('cocktail_omakase_nyc', 'Cucumber Melon', 1, 'Yellow Watermelon'),
    ('cocktail_omakase_nyc', 'Cucumber Melon', 2, 'Wasabi'),
    ('cocktail_omakase_nyc', 'Ember Highball (calvados)', 0, 'Lapsang Souchong'),
    ('cocktail_omakase_nyc', 'Ember Highball (calvados)', 1, 'Cedar'),
    ('cocktail_omakase_nyc', 'Ember Highball (calvados)', 2, 'Calvados'),
    ('cocktail_omakase_nyc', 'Ember Highball (calvados)', 3, 'Plum Soda'),
    ('cocktail_omakase_nyc', 'Little Osaka', 0, 'Rye Whiskey'),
    ('cocktail_omakase_nyc', 'Little Osaka', 1, 'Amaro Ciociaro'),
    ('cocktail_omakase_nyc', 'Little Osaka', 2, 'Kokuto Rum'),
    ('cocktail_omakase_nyc', 'Mizunara Negroni (umeshu)', 0, 'London Dry Gin'),
    ('cocktail_omakase_nyc', 'Mizunara Negroni (umeshu)', 1, 'Mizunara'),
    ('cocktail_omakase_nyc', 'Mizunara Negroni (umeshu)', 2, 'Campari'),
    ('cocktail_omakase_nyc', 'Mizunara Negroni (umeshu)', 3, 'Umeshu'),
    ('cocktail_omakase_nyc', 'Shochu Slipper', 0, 'Kome Shochu'),
    ('cocktail_omakase_nyc', 'Shochu Slipper', 1, 'Midori'),
    ('cocktail_omakase_nyc', 'Shochu Slipper', 2, 'Citrus Blend'),
    ('cocktail_omakase_nyc', 'Matcha Coconut', 0, 'Matcha'),
    ('cocktail_omakase_nyc', 'Matcha Coconut', 1, 'Coconut'),
    ('bar7.cocktailomakase', '7&7', 0, 'Seagram''s 7'),
    ('bar7.cocktailomakase', '7&7', 1, 'Ramune'),
    ('bar7.cocktailomakase', 'Highball', 0, 'Japanese Whisky'),
    ('bar7.cocktailomakase', 'Highball', 1, 'Scotch Whisky'),
    ('bar7.cocktailomakase', 'Highball', 2, 'Kinkan'),
    ('bar7.cocktailomakase', 'Mizunara Negroni', 0, 'London Dry Gin'),
    ('bar7.cocktailomakase', 'Mizunara Negroni', 1, 'Mizunara'),
    ('bar7.cocktailomakase', 'Mizunara Negroni', 2, 'Campari'),
    ('bar7.cocktailomakase', 'Mizunara Negroni', 3, 'Sweet Vermouth'),
    ('bar7.cocktailomakase', 'Mizunara Negroni', 4, 'Ume'),
    ('barlibre_ikebukuro', 'Wa-Tini', 0, 'Roku Gin'),
    ('barlibre_ikebukuro', 'Wa-Tini', 1, 'Kubota Sake'),
    ('barlibre_ikebukuro', 'Wa-Tini', 2, 'Japanese Bitters'),
    ('barlibre_ikebukuro', 'Wa-Tini', 3, 'Pickled Plum'),
    ('barlibre_ikebukuro', 'Fresarita', 0, 'Don Julio Reposado');

INSERT INTO "public"."items" ("name", "item_type", "description", "origin", "riff_of_id", "origin_bar_profile_id",
                              "origin_year", "credit_status", "price", "glassware_id")
SELECT d.name, 'cocktail', d.description, CASE WHEN c.id IS NULL THEN 'Original' ELSE 'Varient' END, c.id, p.id,
       2026, 'suggested', d.price,
       (SELECT g.id FROM "public"."items" g WHERE g.item_type = 'glassware' AND g.bar_id IS NULL AND g.name = d.glass
        ORDER BY g.created_at LIMIT 1)
FROM "om_drinks" d
JOIN "om_bars" p ON p.handle = d.handle
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

ALTER TABLE "om_drinks" ADD COLUMN "item_id" uuid;
UPDATE "om_drinks" d SET "item_id" = (
    SELECT i.id FROM "public"."items" i JOIN "om_bars" p ON p.handle = d.handle
    WHERE i.item_type = 'cocktail' AND i.bar_id IS NULL AND i.origin_bar_profile_id = p.id
      AND public.menu_name_key(i.name) = public.menu_name_key(d.name)
    ORDER BY (i.name = d.name) DESC, i.created_at, i.id LIMIT 1
);
DELETE FROM "om_drinks" WHERE "item_id" IS NULL;

INSERT INTO "public"."item_notes" ("item_id", "body")
SELECT d.item_id, d.notes FROM "om_drinks" d
WHERE NOT EXISTS (SELECT 1 FROM "public"."item_notes" n WHERE n.item_id = d.item_id);

-- --- Ingredient lines ---

-- The fixed drinks get the menus' full lines, replacing the old ones while
-- they carry no measures (nobody has written a spec over them).
INSERT INTO "om_lines" VALUES
    ('cocktail_omakase_nyc', 'Tomatillo Shiso Sour', 0, 'Lemongrass Shochu'),
    ('cocktail_omakase_nyc', 'Tomatillo Shiso Sour', 1, 'Shiso'),
    ('cocktail_omakase_nyc', 'Tomatillo Shiso Sour', 2, 'Tomatillo'),
    ('cocktail_omakase_nyc', 'Tomatillo Shiso Sour', 3, 'Citrus'),
    ('cocktail_omakase_nyc', 'Tomatillo Shiso Sour', 4, 'Soda Water'),
    ('bar7.cocktailomakase', 'Gibson', 0, 'London Dry Gin'),
    ('bar7.cocktailomakase', 'Gibson', 1, 'Vermouth Blend'),
    ('bar7.cocktailomakase', 'Gibson', 2, 'Rice Vinegar'),
    ('bar7.cocktailomakase', 'Charred Lemon Sour', 0, 'Mugi Shochu'),
    ('bar7.cocktailomakase', 'Charred Lemon Sour', 1, 'Charred Lemon'),
    ('bar7.cocktailomakase', 'Charred Lemon Sour', 2, 'Soba');

ALTER TABLE "om_lines" ADD COLUMN "item_id" uuid;
UPDATE "om_lines" l SET "item_id" = i.id
FROM "om_bars" b, "public"."items" i
WHERE b.handle = l.handle AND b.claimed_at IS NULL AND l.drink IN ('Tomatillo Shiso Sour', 'Gibson', 'Charred Lemon Sour')
  AND i.origin_bar_profile_id = b.id AND i.item_type = 'cocktail' AND i.bar_id IS NULL AND i.name = l.drink
  AND NOT EXISTS (SELECT 1 FROM "public"."recipes" r WHERE r.recipe_item_id = i.id AND r.amount IS NOT NULL);
DELETE FROM "public"."recipes" r USING (SELECT DISTINCT "item_id" FROM "om_lines" WHERE "item_id" IS NOT NULL) x
WHERE r.recipe_item_id = x.item_id;

-- New drinks get lines only while they have none.
UPDATE "om_lines" l SET "item_id" = d.item_id
FROM "om_drinks" d
WHERE l.item_id IS NULL AND d.handle = l.handle AND d.name = l.drink
  AND NOT EXISTS (SELECT 1 FROM "public"."recipes" r WHERE r.recipe_item_id = d.item_id);
DELETE FROM "om_lines" WHERE "item_id" IS NULL;

-- Shared ingredients, reusing one with the same name key (or alias). New
-- ones are a menu's wording ("Umami Bomb", "Citrus Blend"), so they stay out
-- of ingredient search; drink pages still show them.
CREATE TEMP TABLE "om_ingredients" AS
SELECT DISTINCT ON (lower(l.ingredient)) l.ingredient AS name, NULL::uuid AS id
FROM "om_lines" l ORDER BY lower(l.ingredient);

UPDATE "om_ingredients" x SET "id" = coalesce(
    (SELECT i.id FROM "public"."items" i
     WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL AND public.ingredient_key(i.name) = public.ingredient_key(x.name)
     ORDER BY i.is_core DESC, i.created_at LIMIT 1),
    (SELECT a.item_id FROM "public"."ingredient_aliases" a WHERE a.key = public.ingredient_key(x.name) LIMIT 1));

WITH "added" AS (
    INSERT INTO "public"."items" ("name", "item_type", "hide_from_search")
    SELECT x.name, 'ingredient', true FROM "om_ingredients" x WHERE x.id IS NULL
    RETURNING "id", "name"
)
UPDATE "om_ingredients" x SET "id" = a.id FROM "added" a WHERE x.id IS NULL AND a.name = x.name;

INSERT INTO "public"."recipes" ("recipe_item_id", "ingredient_item_id", "parent_ingredient_id", "amount", "unit",
                                "is_optional", "sort_order")
SELECT l.item_id, i.id, i.generic_id, NULL, NULL, false, l.pos
FROM "om_lines" l
JOIN "om_ingredients" x ON lower(x.name) = lower(l.ingredient)
JOIN "public"."items" i ON i.id = x.id;

-- --- 3. Menus ---

-- Bar 7's list in print is just "Cocktails"; 20261008000000 called it
-- Spring 2026.
UPDATE "public"."profile_menu_editions" e SET
    "name" = 'Cocktails',
    "source_url" = 'https://www.yelp.com/biz_photos/cocktail-omakase-new-york?select=H5ro1JI_gJNRXs-n0UkSyw'
FROM "om_bars" b
WHERE e.profile_id = b.id AND b.handle = 'bar7.cocktailomakase' AND b.claimed_at IS NULL
  AND e.name = 'Spring 2026' AND e.year = 2026 AND e.month = 3;

INSERT INTO "public"."profile_menu_editions" ("profile_id", "name", "theme", "year", "month", "end_year", "end_month",
                                              "is_current", "source_url")
SELECT p.id, v.name, v.theme, 2026, v.month, v.end_year, v.end_month, false, v.source_url
FROM (VALUES
    ('cocktail_omakase_nyc', 'Summer menu: Spirited', 'Opens with a cold dashi', 8, NULL::int, NULL::int,
     'https://www.yelp.com/biz_photos/cocktail-omakase-new-york?select=VOtuNkSngbNzFG7kYKXHcg'),
    ('cocktail_omakase_nyc', 'Summer menu: Low ABV', 'Opens with a cold dashi', 8, NULL, NULL,
     'https://www.instagram.com/stories/highlights/18142875952533375/'),
    ('cocktail_omakase_nyc', 'Autumn menu: Spirited', NULL, 10, NULL, NULL,
     'https://www.yelp.com/biz_photos/cocktail-omakase-new-york?select=mzaCm0kO11n6GOlKYz7v2w'),
    ('barlibre_ikebukuro', 'Residency at Bar 7, New York', 'Four nights at Bar 7 in New York, 23 to 26 June', 6, 2026, 6,
     'https://www.instagram.com/p/DZ5WyTsxP4o/')
) AS v("handle", "name", "theme", "month", "end_year", "end_month", "source_url")
JOIN "om_bars" p ON p.handle = v.handle
ON CONFLICT ON CONSTRAINT "profile_menu_editions_once" DO NOTHING;

CREATE TEMP TABLE "om_menu" ("handle" text, "edition" text, "month" int, "pos" int, "drink_handle" text, "drink" text);
INSERT INTO "om_menu" VALUES
    ('bar7.cocktailomakase', 'Cocktails', 3, 0, 'bar7.cocktailomakase', '7&7'),
    ('bar7.cocktailomakase', 'Cocktails', 3, 1, 'bar7.cocktailomakase', 'Highball'),
    ('bar7.cocktailomakase', 'Cocktails', 3, 2, 'bar7.cocktailomakase', 'Charred Lemon Sour'),
    ('bar7.cocktailomakase', 'Cocktails', 3, 3, 'bar7.cocktailomakase', 'Hojicha Espresso Martini'),
    ('bar7.cocktailomakase', 'Cocktails', 3, 4, 'bar7.cocktailomakase', 'Apple Chrysanthemum'),
    ('bar7.cocktailomakase', 'Cocktails', 3, 5, 'bar7.cocktailomakase', 'Mizunara Negroni'),
    ('bar7.cocktailomakase', 'Cocktails', 3, 6, 'bar7.cocktailomakase', 'Gibson'),
    ('barlibre_ikebukuro', 'Residency at Bar 7, New York', 6, 0, 'barlibre_ikebukuro', 'Wa-Tini'),
    ('barlibre_ikebukuro', 'Residency at Bar 7, New York', 6, 1, 'barlibre_ikebukuro', 'Fresarita'),
    ('barlibre_ikebukuro', 'Residency at Bar 7, New York', 6, 2, 'barlibre_ikebukuro', 'Edo Manhattan'),
    ('barlibre_ikebukuro', 'Residency at Bar 7, New York', 6, 3, 'barlibre_ikebukuro', 'Fresh Fruit Cocktail'),
    ('cocktail_omakase_nyc', 'Summer menu: Spirited', 8, 0, 'cocktail_omakase_nyc', 'Mukaebi Dashi'),
    ('cocktail_omakase_nyc', 'Summer menu: Spirited', 8, 1, 'cocktail_omakase_nyc', 'Raspberry Sansho Fizz'),
    ('cocktail_omakase_nyc', 'Summer menu: Spirited', 8, 2, 'cocktail_omakase_nyc', 'Wakayama Spritz'),
    ('cocktail_omakase_nyc', 'Summer menu: Spirited', 8, 3, 'cocktail_omakase_nyc', 'Lemongrass Negroni'),
    ('cocktail_omakase_nyc', 'Summer menu: Spirited', 8, 4, 'cocktail_omakase_nyc', 'Midori Gimlet'),
    ('cocktail_omakase_nyc', 'Summer menu: Low ABV', 8, 0, 'cocktail_omakase_nyc', 'Mukaebi Dashi'),
    ('cocktail_omakase_nyc', 'Summer menu: Low ABV', 8, 1, 'cocktail_omakase_nyc', 'SerenTea'),
    ('cocktail_omakase_nyc', 'Summer menu: Low ABV', 8, 2, 'cocktail_omakase_nyc', 'Rising Sun Sour'),
    ('cocktail_omakase_nyc', 'Summer menu: Low ABV', 8, 3, 'cocktail_omakase_nyc', '19/24'),
    ('cocktail_omakase_nyc', 'Summer menu: Low ABV', 8, 4, 'cocktail_omakase_nyc', 'Apricot & Basil Cooler'),
    ('cocktail_omakase_nyc', 'Autumn menu: Spirited', 10, 0, 'cocktail_omakase_nyc', 'Ember Highball (calvados)'),
    ('cocktail_omakase_nyc', 'Autumn menu: Spirited', 10, 1, 'cocktail_omakase_nyc', 'Little Osaka'),
    ('cocktail_omakase_nyc', 'Autumn menu: Spirited', 10, 2, 'cocktail_omakase_nyc', 'Mizunara Negroni (umeshu)'),
    ('cocktail_omakase_nyc', 'Autumn menu: Spirited', 10, 3, 'cocktail_omakase_nyc', 'Shochu Slipper');

ALTER TABLE "om_menu" ADD COLUMN "edition_id" uuid, ADD COLUMN "item_id" uuid;
UPDATE "om_menu" x SET
    "edition_id" = (SELECT e.id FROM "public"."profile_menu_editions" e JOIN "om_bars" p ON p.id = e.profile_id
                    WHERE p.handle = x.handle AND e.name = x.edition AND e.year = 2026 AND e.month = x.month),
    "item_id" = (SELECT i.id FROM "public"."items" i JOIN "om_bars" p ON p.id = i.origin_bar_profile_id
                 WHERE p.handle = x.drink_handle AND i.item_type = 'cocktail' AND i.bar_id IS NULL AND i.name = x.drink
                 ORDER BY i.created_at LIMIT 1);
DELETE FROM "om_menu" WHERE "edition_id" IS NULL OR "item_id" IS NULL;

-- Bar 7's list follows the printed order: out of the way first, since a
-- position holds one drink.
UPDATE "public"."profile_menu_edition_drinks" d SET "sort_order" = d.sort_order + 1000
FROM "om_menu" x JOIN "om_bars" b ON b.handle = x.handle
WHERE d.edition_id = x.edition_id AND d.item_id = x.item_id AND b.claimed_at IS NULL AND d.sort_order <> x.pos;
UPDATE "public"."profile_menu_edition_drinks" d SET "sort_order" = x.pos
FROM "om_menu" x
WHERE d.edition_id = x.edition_id AND d.item_id = x.item_id AND d.sort_order >= 1000;

INSERT INTO "public"."profile_menu_edition_drinks" ("edition_id", "item_id", "sort_order")
SELECT x.edition_id, x.item_id, x.pos FROM "om_menu" x
WHERE NOT EXISTS (
    SELECT 1 FROM "public"."profile_menu_edition_drinks" o WHERE o.edition_id = x.edition_id AND o.item_id = x.item_id
);

-- --- Put these drinks' flavour jobs back ---

DELETE FROM "private"."item_flavor_jobs" j
USING "public"."items" i
WHERE j.item_id = i.id AND i.item_type = 'cocktail' AND i.bar_id IS NULL
  AND i.origin_bar_profile_id IN (SELECT id FROM "om_bars")
  AND NOT EXISTS (SELECT 1 FROM "om_flavor_jobs" o WHERE o.item_id = j.item_id);
UPDATE "private"."item_flavor_jobs" j SET
    "status" = o.status, "revision" = o.revision, "attempts" = o.attempts, "run_after" = o.run_after,
    "lease_until" = o.lease_until, "last_error" = o.last_error, "updated_at" = o.updated_at
FROM "om_flavor_jobs" o
WHERE j.item_id = o.item_id AND j.revision <> o.revision;

DROP TABLE "om_menu", "om_ingredients", "om_lines", "om_drinks", "om_fixes", "om_flavor_jobs", "om_bars";

RESET "app.image_worker";
