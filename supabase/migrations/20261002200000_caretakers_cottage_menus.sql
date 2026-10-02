-- Caretaker's Cottage: the monthly menus on record, and the drinks on them.
--
-- The bar changes its whole cocktail list every month (weekly for its first
-- two months, from late February 2022), with a new menu design each time.
-- Only the House Martini stays. Researched on 2 Oct 2026 from the bar's own
-- site, Boothby, Australian Bartender, Broadsheet, Tatler Asia, Forbes
-- Australia, The World's 50 Best and dated visitor posts; every edition and
-- every drink keeps the page it came from. Months the web does not record
-- are left out rather than guessed.
--
--   editions: 11 menus with month and year, a line on each in our words,
--     and the drinks a source names for that month. The 'Opening menu'
--     row from 20260930900100 gains its month and a fuller line.
--   drinks: the bar's shared cocktails (origin_bar_profile_id), new where
--     the bar had none of that name, with the catalog classic as the riff
--     where one exists. Ingredient lines only where a source lists them,
--     in menu order, with no measures: the bar has not published any, and
--     Boothby's Doublethink recipe is cited, not copied. A named bottle is
--     the line's ingredient and its generic the parent, as in the other
--     bar seeds. Six drinks no source dates (Original Pirate Material,
--     Winter Rob Roy, Hail Santa, Malibu Stormy, El Diablo Milk Punch,
--     Champ Stamp) are credited to the bar but sit on no edition.
--
-- Safe to re-run: editions insert once (profile_menu_editions_once), a
-- drink the bar already has keeps its row and only gains empty fields, lines
-- land only on a drink that has none, and a drink is put on a menu once.
-- On a database without the bar's profile (local, tests) this does nothing.

-- Seeded drinks don't queue automatic sketches (nobody to bill for them).
SET "app.image_worker" = 'on';

CREATE TEMP TABLE "cc_profile" AS
SELECT p.id FROM "public"."profiles" p WHERE p.kind = 'bar' AND p.handle = 'caretakers.cottage' LIMIT 1;

CREATE TEMP TABLE "cc_editions" ("name" text, "year" int, "month" int, "theme" text, "source_url" text);
CREATE TEMP TABLE "cc_drinks" ("name" text, "description" text, "notes" text, "riff_of" text, "origin_year" int, "glass" text);
CREATE TEMP TABLE "cc_lines" ("drink" text, "pos" int, "ingredient" text, "generic" text, "prep" text);
CREATE TEMP TABLE "cc_menu" ("edition" text, "year" int, "month" int, "pos" int, "drink" text);

INSERT INTO "cc_editions" VALUES
    ('Opening menu', 2022, 2, 'Three classics, three house creations and the House Martini, plus a clarified berry milk punch of vermouth, Jameson, framboise and Earl Grey tea, with Guinness on tap. The list changed weekly for the first two months.', 'https://www.broadsheet.com.au/melbourne/food-and-drink/article/first-look-bluestone-beauty-caretakers-cottage-probably-victorias-smallest-pub-fancy-free-team'),
    ('Second-year list', 2023, 2, 'The list for the bar''s second year, on a square-grid menu by Ryan Noreiks: a stirred boozy drink (the Martini), a punch, two tall drinks, two coupes and one on the rocks or in its own glass. From here the design changed with the drinks each month.', 'https://www.boothby.com.au/caretakers-cottage-drinks-menu/'),
    ('July 2023 menu', 2023, 7, 'Winter list with a Pimm''s milk punch and a Painkiller alongside the House Martini.', 'https://www.tripadvisor.com/ShowUserReviews-g255100-d25089019-r902188870-Caretaker_s_Cottage-Melbourne_Victoria.html'),
    ('Sun Goes Down, Music Goes Up', 2023, 10, 'Travel-themed October list written by Rob Libecans and Kitty Gardner, each drink carrying a story; The Snail & The Whale took its name from a children''s picture book.', 'https://australianbartender.com.au/2023/11/30/creativity-cocktails-caretakers-cottage-how-to-interweave-a-story-through-cocktails-featuring-hendricks-flora-adora/'),
    ('January 2024 menu', 2024, 1, 'Eight cocktails: three classics, three contemporary drinks, the House Martini and a Zombie milk punch, as Tatler Asia described the list in early February 2024.', 'https://www.tatlerasia.com/dining/drinks/caretakers-cottage-the-cocktail-pub'),
    ('May 2024 menu', 2024, 5, 'Matcha vodka and miso caramel on the list, a Clover Club among the classics and a cider and peach Stone Fence.', 'https://www.lemon8-app.com/@rxsquare/7371982638187348481?region=sg'),
    ('June 2024 menu', 2024, 6, 'The month of the June Bug Milk Punch, the clarified coconut rum, banana, melon, pineapple and lime punch that 50 Best called the bar''s 2024 star.', 'https://www.theworlds50best.com/stories/News/caretakers-cottage-art-of-hospitality-the-worlds-50-best-bars-2024.html'),
    ('July 2025 menu', 2025, 7, 'New list from the start of July 2025 with a mezcal and oolong Fire Drill Milk Punch and a tequila, pineapple and celery highball, Up & At Them.', 'https://www.tiktok.com/@alexsfoodieadventures/video/7522382268711587079'),
    ('November 2025 menu', 2025, 11, 'Eight cocktails, among them a Bitter Mai Tai, the Nightbird and a Miami Vice Milk Punch.', 'https://wanderlog.com/place/details/2516534/caretakers-cottage'),
    ('January 2026 menu', 2026, 1, 'The list on the bar''s site for January 2026, with cocktail, wine, beer and zero-proof sections; the page also carries Fancy Free, the name of the owners'' pop-up.', 'https://www.caretakerscottage.bar/ccmenu'),
    ('September 2026 menu', 2026, 9, 'Seven new drinks at $27 beside the House Martini: Café Coldada, Bubble Fiction, Caravan #2, Thrills & Chills, Nature''s Radio, Alter Ego and a Clover Club Milk Punch, with allergens flagged on the list.', 'https://www.caretakerscottage.bar/ccbwmenu');

-- Drinks the bar already has are listed with no text, so they resolve to
-- their existing rows and keep what they have. Doublethink gains its lines.
INSERT INTO "cc_drinks" VALUES
    ('House Martini', NULL, NULL, NULL, NULL, NULL),
    ('Home Comforts', NULL, NULL, NULL, NULL, NULL),
    ('Frantic Atlantic', NULL, NULL, NULL, NULL, NULL),
    ('The Snail & The Whale', NULL, NULL, NULL, NULL, NULL),
    ('June Bug Milk Punch', NULL, NULL, NULL, NULL, NULL),
    ('Mr Blonde', NULL, NULL, NULL, NULL, NULL),
    ('Doublethink', NULL, 'Created by Kitty Gardner, Darren Leaney and Tom McHugh from a crème caramel and passionfruit dessert, and the wish to put purple carrot in a drink. Boothby''s Drink of the Year 2025, No. 1 of Australia''s 50 best drinks.

Ingredients from Boothby (https://www.boothby.com.au/doublethink-from-caretakers-cottage/), which publishes the bar''s full recipe. No measures are kept here.', NULL, 2025, NULL),
    ('Chrysanthemum', 'The dry vermouth, Bénédictine and absinthe classic, one of the lesser-known classics on the opening list.', 'Australian Bartender''s April 2022 review of the half-page opening list named it beside the House Martini.

Named in Australian Bartender (https://australianbartender.com.au/2022/04/14/caretakers-cottage-a-mini-pub-in-the-melbourne-cbd-with-a-veteran-hospo-crew-who-are-sharing-the-love/). The bar''s build has not been published.', NULL, 2022, NULL),
    ('Painkiller', 'The rum, pineapple, orange and coconut classic, in the classics slot of the July 2023 list.', 'Named in a July 2023 visitor review (https://www.tripadvisor.com/ShowUserReviews-g255100-d25089019-r902188870-Caretaker_s_Cottage-Melbourne_Victoria.html). The bar''s build has not been published.', NULL, 2023, NULL),
    ('Pimm''s Winter Milk Punch', 'The winter 2023 clarified milk punch, built on Pimm''s.', 'The rotating milk punch for July 2023, named in a visitor review (https://www.tripadvisor.com/ShowUserReviews-g255100-d25089019-r902188870-Caretaker_s_Cottage-Melbourne_Victoria.html). No further ingredients have been published.', NULL, 2023, NULL),
    ('Zombie Milk Punch', 'Clarified milk punch of dark rum, chamomile-infused mezcal and amaretto, topped with a toasted Campari gel.', 'The milk punch on the eight-drink list Tatler Asia described in February 2024.

Ingredients from Tatler Asia (https://www.tatlerasia.com/dining/drinks/caretakers-cottage-the-cocktail-pub). No measures have been published.', NULL, 2024, NULL),
    ('DTF', 'Matcha-infused vodka with lime and almond, dusted with matcha.', 'On the May 2024 list.

Ingredients from a visitor''s Lemon8 post (https://www.lemon8-app.com/@rxsquare/7371982638187348481?region=sg). No measures have been published.', NULL, 2024, NULL),
    ('Koji Hardshake', 'Miso caramel and cream, served with a torched marshmallow.', 'On the May 2024 list; it shares its name with Dandelyan''s modern classic.

Ingredients from a visitor''s Lemon8 post (https://www.lemon8-app.com/@rxsquare/7371982638187348481?region=sg). No measures have been published.', NULL, 2024, NULL),
    ('Clover Club', 'The gin, raspberry, lemon and egg white classic, in the classics slot of the May 2024 list.', 'Named in a visitor''s Lemon8 post (https://www.lemon8-app.com/@rxsquare/7371982638187348481?region=sg). The bar''s build has not been published.', 'Clover Club', 2024, NULL),
    ('Stone Fence', 'Cider with a peach and chamomile wine.', 'On the May 2024 list.

Ingredients from a visitor''s Lemon8 post (https://www.lemon8-app.com/@rxsquare/7371982638187348481?region=sg). No measures have been published.', NULL, 2024, NULL),
    ('Fire Drill Milk Punch', 'Clarified milk punch of mezcal, elderflower, Aperol, oolong tea and lime.', 'The punch on the list that launched at the start of July 2025.

Ingredients from a visitor''s TikTok post (https://www.tiktok.com/@alexsfoodieadventures/video/7522382268711587079). No measures have been published.', NULL, 2025, NULL),
    ('Up & At Them', 'Ocho blanco tequila with pineapple, celery and rhubarb bitters, topped with Fever-Tree elderflower tonic.', 'The tall drink on the list that launched at the start of July 2025.

Ingredients from a visitor''s TikTok post (https://www.tiktok.com/@alexsfoodieadventures/video/7522382268711587079). No measures have been published.', NULL, 2025, NULL),
    ('Bitter Mai Tai', 'The bitter take on the Mai Tai, on the November 2025 list.', 'Named among that month''s favourites in a visitor review (https://wanderlog.com/place/details/2516534/caretakers-cottage). The bar''s build has not been published.', 'Mai Tai', 2025, NULL),
    ('Nightbird', 'A contemporary drink on the November 2025 list.', 'Named among that month''s favourites in a visitor review (https://wanderlog.com/place/details/2516534/caretakers-cottage). Its ingredients have not been published.', NULL, 2025, NULL),
    ('Miami Vice Milk Punch', 'Clarified milk punch take on the Miami Vice, the strawberry Daiquiri and Piña Colada swirl, on the November 2025 list.', 'Named among that month''s favourites in a visitor review (https://wanderlog.com/place/details/2516534/caretakers-cottage). The bar''s build has not been published.', NULL, 2025, NULL),
    ('Café Coldada', 'Dark rum with banana two ways, coconut, coffee and lime.', 'On the September 2026 list, where every cocktail is $27 and coconut is flagged for allergies.

Ingredients from the bar''s menu (https://www.caretakerscottage.bar/ccbwmenu). No measures have been published.', NULL, 2026, NULL),
    ('Bubble Fiction', 'Punch & Ladle Rhubarbero with grapefruit sherbet, ginger and hopped rice.', 'On the September 2026 list.

Ingredients from the bar''s menu (https://www.caretakerscottage.bar/ccbwmenu). No measures have been published.', NULL, 2026, NULL),
    ('Caravan #2', 'Olive oil-washed rye with Cynar, amontillado sherry and hazelnut, a second version of the bar''s Caravan.', 'On the September 2026 list.

Ingredients from the bar''s menu (https://www.caretakerscottage.bar/ccbwmenu). No measures have been published.', NULL, 2026, NULL),
    ('Thrills & Chills', 'Hendrick''s gin with jasmine tea, cantaloupe, fino sherry and yuzu.', 'On the September 2026 list.

Ingredients from the bar''s menu (https://www.caretakerscottage.bar/ccbwmenu). No measures have been published.', NULL, 2026, NULL),
    ('Nature''s Radio', 'Mezcal with green tea, St-Germain, lychee and mandarin, lengthened with Fever-Tree tonic.', 'On the September 2026 list.

Ingredients from the bar''s menu (https://www.caretakerscottage.bar/ccbwmenu). No measures have been published.', NULL, 2026, NULL),
    ('Alter Ego', 'Toki whisky with mango, charred corn, green capsicum and lime.', 'On the September 2026 list, where capsicum is flagged as a nightshade.

Ingredients from the bar''s menu (https://www.caretakerscottage.bar/ccbwmenu). No measures have been published.', NULL, 2026, NULL),
    ('Clover Club Milk Punch', 'Clarified milk punch take on the Clover Club, the punch on the September 2026 list.', 'Named on the bar''s menu (https://www.caretakerscottage.bar/ccbwmenu). The bar''s build has not been published.', 'Clover Club', 2026, NULL),
    ('Original Pirate Material', 'Applejack and whisky with cherry liqueur and absinthe.', 'A house cocktail from the bar''s first year.

Ingredients from The City Lane (https://thecitylane.com/caretakers-cottage-melbourne-cbd/). No measures have been published.', NULL, 2022, NULL),
    ('Winter Rob Roy', 'A winter take on the Rob Roy.', 'Named among the must-try drinks in Tatler Asia''s listing (https://www.tatlerasia.com/dining/caretakers-cottage). The month is not recorded and the bar''s build has not been published.', 'Rob Roy', NULL, NULL),
    ('Hail Santa', 'Four Pillars Christmas gin with peach and sparkling wine, a festive-season drink.', 'Named in visitor reviews gathered on Mindtrip (https://mindtrip.ai/attraction/melbourne-victoria/caretakers-cottage/at-Yd3K8o6A). The year is not recorded and no measures have been published.', NULL, NULL, NULL),
    ('Malibu Stormy', 'Served in a chilled coupette with dark fuchsia rose petals; the name points to Malibu and the Dark ''n'' Stormy.', 'Described by Forbes Australia (https://www.forbes.com.au/covers/lifestyle/why-melbournes-caretakers-cottage-is-a-must-visit-masterpiece/). The month is not recorded, and nothing beyond the name and garnish has been published.', NULL, NULL, 'Coupette'),
    ('El Diablo Milk Punch', 'Clarified milk punch take on the El Diablo, set around a cube of raspberry-infused ice.', 'Described by Forbes Australia (https://www.forbes.com.au/covers/lifestyle/why-melbournes-caretakers-cottage-is-a-must-visit-masterpiece/). The month is not recorded and the bar''s build has not been published.', 'El Diablo', NULL, NULL),
    ('Champ Stamp', 'A smoky, mezcal-forward strawberry drink.', 'Described in a visitor review on Postcard (https://www.postcard.inc/places/caretakers-cottage-melbourne-5OvceVqlBf7). The month is not recorded and no measures have been published.', NULL, NULL, NULL);

INSERT INTO "cc_lines" VALUES
    ('Doublethink', 0, 'Purple Carrot-Infused Tequila', 'Tequila', NULL),
    ('Doublethink', 1, 'Passion Fruit Syrup', 'Syrup', NULL),
    ('Doublethink', 2, 'Oat Dulce de Leche', 'Dulce de Leche', NULL),
    ('Doublethink', 3, 'Habanero Shochu', 'Shochu', NULL),
    ('Doublethink', 4, 'Lemon Juice', NULL, NULL),
    ('Doublethink', 5, 'Saline', NULL, NULL),
    ('Pimm''s Winter Milk Punch', 0, 'Pimm''s No. 1', 'Liqueur', NULL),
    ('Zombie Milk Punch', 0, 'Dark Rum', 'Rum', NULL),
    ('Zombie Milk Punch', 1, 'Chamomile-Infused Mezcal', 'Mezcal', NULL),
    ('Zombie Milk Punch', 2, 'Amaretto', 'Liqueur', NULL),
    ('Zombie Milk Punch', 3, 'Toasted Campari Gel', 'Campari', 'topping'),
    ('DTF', 0, 'Matcha-Infused Vodka', 'Vodka', NULL),
    ('DTF', 1, 'Lime Juice', NULL, NULL),
    ('DTF', 2, 'Almond', NULL, NULL),
    ('DTF', 3, 'Matcha', NULL, 'garnish, dusted on top'),
    ('Koji Hardshake', 0, 'Miso Caramel', NULL, NULL),
    ('Koji Hardshake', 1, 'Cream', NULL, NULL),
    ('Koji Hardshake', 2, 'Marshmallow', NULL, 'garnish, torched'),
    ('Stone Fence', 0, 'Cider', NULL, NULL),
    ('Stone Fence', 1, 'Peach and Chamomile Wine', 'Wine', NULL),
    ('Fire Drill Milk Punch', 0, 'Mezcal', NULL, NULL),
    ('Fire Drill Milk Punch', 1, 'Elderflower', NULL, NULL),
    ('Fire Drill Milk Punch', 2, 'Aperol', 'Bitter Aperitivo', NULL),
    ('Fire Drill Milk Punch', 3, 'Oolong Tea', 'Tea', NULL),
    ('Fire Drill Milk Punch', 4, 'Lime Juice', NULL, NULL),
    ('Up & At Them', 0, 'Ocho Blanco Tequila', 'Blanco Tequila', 'Ocho Plata'),
    ('Up & At Them', 1, 'Pineapple', NULL, NULL),
    ('Up & At Them', 2, 'Celery', NULL, NULL),
    ('Up & At Them', 3, 'Rhubarb Bitters', 'Bitters', NULL),
    ('Up & At Them', 4, 'Fever-Tree Elderflower Tonic Water', 'Tonic Water', 'top'),
    ('Café Coldada', 0, 'Dark Rum', 'Rum', NULL),
    ('Café Coldada', 1, 'Banana', NULL, 'two ways'),
    ('Café Coldada', 2, 'Coconut', NULL, NULL),
    ('Café Coldada', 3, 'Coffee', NULL, NULL),
    ('Café Coldada', 4, 'Lime Juice', NULL, NULL),
    ('Bubble Fiction', 0, 'Punch & Ladle Rhubarbero', 'Liqueur', NULL),
    ('Bubble Fiction', 1, 'Grapefruit Sherbet', 'Sherbet', NULL),
    ('Bubble Fiction', 2, 'Ginger', NULL, NULL),
    ('Bubble Fiction', 3, 'Hopped Rice', 'Rice', NULL),
    ('Caravan #2', 0, 'Olive Oil-Washed Rye', 'Rye', NULL),
    ('Caravan #2', 1, 'Cynar', 'Carciofo', NULL),
    ('Caravan #2', 2, 'Amontillado Sherry', 'Sherry', NULL),
    ('Caravan #2', 3, 'Hazelnut', NULL, NULL),
    ('Thrills & Chills', 0, 'Hendrick''s Gin', 'Gin', NULL),
    ('Thrills & Chills', 1, 'Jasmine Tea', 'Tea', NULL),
    ('Thrills & Chills', 2, 'Cantaloupe', 'Melon', NULL),
    ('Thrills & Chills', 3, 'Fino Sherry', 'Sherry', NULL),
    ('Thrills & Chills', 4, 'Yuzu', NULL, NULL),
    ('Nature''s Radio', 0, 'Mezcal', NULL, NULL),
    ('Nature''s Radio', 1, 'Green Tea', 'Tea', NULL),
    ('Nature''s Radio', 2, 'St-Germain Elderflower Liqueur', 'Elderflower Liqueur', NULL),
    ('Nature''s Radio', 3, 'Lychee', NULL, NULL),
    ('Nature''s Radio', 4, 'Mandarin', NULL, NULL),
    ('Nature''s Radio', 5, 'Tonic Water', NULL, 'Fever-Tree, top'),
    ('Alter Ego', 0, 'Suntory Toki', 'Japanese Whisky', NULL),
    ('Alter Ego', 1, 'Mango', NULL, NULL),
    ('Alter Ego', 2, 'Charred Corn', 'Corn', NULL),
    ('Alter Ego', 3, 'Green Capsicum', 'Capsicum', NULL),
    ('Alter Ego', 4, 'Lime Juice', NULL, NULL),
    ('Original Pirate Material', 0, 'Applejack', 'Apple Brandy', NULL),
    ('Original Pirate Material', 1, 'Whiskey', NULL, NULL),
    ('Original Pirate Material', 2, 'Cherry Liqueur', 'Liqueur', NULL),
    ('Original Pirate Material', 3, 'Absinthe', NULL, NULL),
    ('Hail Santa', 0, 'Four Pillars Christmas Gin', 'Gin', NULL),
    ('Hail Santa', 1, 'Peach', NULL, NULL),
    ('Hail Santa', 2, 'Sparkling Wine', NULL, 'top'),
    ('Champ Stamp', 0, 'Mezcal', NULL, NULL),
    ('Champ Stamp', 1, 'Strawberry', NULL, NULL);

-- The House Martini is the one drink that has never left the list.
INSERT INTO "cc_menu" VALUES
    ('Opening menu', 2022, 2, 0, 'House Martini'),
    ('Opening menu', 2022, 2, 1, 'Chrysanthemum'),
    ('Second-year list', 2023, 2, 0, 'House Martini'),
    ('Second-year list', 2023, 2, 1, 'Home Comforts'),
    ('Second-year list', 2023, 2, 2, 'Frantic Atlantic'),
    ('July 2023 menu', 2023, 7, 0, 'House Martini'),
    ('July 2023 menu', 2023, 7, 1, 'Pimm''s Winter Milk Punch'),
    ('July 2023 menu', 2023, 7, 2, 'Painkiller'),
    ('Sun Goes Down, Music Goes Up', 2023, 10, 0, 'House Martini'),
    ('Sun Goes Down, Music Goes Up', 2023, 10, 1, 'The Snail & The Whale'),
    ('January 2024 menu', 2024, 1, 0, 'House Martini'),
    ('January 2024 menu', 2024, 1, 1, 'Zombie Milk Punch'),
    ('May 2024 menu', 2024, 5, 0, 'House Martini'),
    ('May 2024 menu', 2024, 5, 1, 'DTF'),
    ('May 2024 menu', 2024, 5, 2, 'Koji Hardshake'),
    ('May 2024 menu', 2024, 5, 3, 'Stone Fence'),
    ('May 2024 menu', 2024, 5, 4, 'Clover Club'),
    ('June 2024 menu', 2024, 6, 0, 'House Martini'),
    ('June 2024 menu', 2024, 6, 1, 'June Bug Milk Punch'),
    ('July 2025 menu', 2025, 7, 0, 'House Martini'),
    ('July 2025 menu', 2025, 7, 1, 'Up & At Them'),
    ('July 2025 menu', 2025, 7, 2, 'Fire Drill Milk Punch'),
    ('November 2025 menu', 2025, 11, 0, 'House Martini'),
    ('November 2025 menu', 2025, 11, 1, 'Bitter Mai Tai'),
    ('November 2025 menu', 2025, 11, 2, 'Nightbird'),
    ('November 2025 menu', 2025, 11, 3, 'Miami Vice Milk Punch'),
    ('January 2026 menu', 2026, 1, 0, 'House Martini'),
    ('September 2026 menu', 2026, 9, 0, 'House Martini'),
    ('September 2026 menu', 2026, 9, 1, 'Café Coldada'),
    ('September 2026 menu', 2026, 9, 2, 'Bubble Fiction'),
    ('September 2026 menu', 2026, 9, 3, 'Caravan #2'),
    ('September 2026 menu', 2026, 9, 4, 'Thrills & Chills'),
    ('September 2026 menu', 2026, 9, 5, 'Nature''s Radio'),
    ('September 2026 menu', 2026, 9, 6, 'Alter Ego'),
    ('September 2026 menu', 2026, 9, 7, 'Clover Club Milk Punch');

-- --- Editions ---

-- The opening menu was seeded with only its year. Give it its month and the
-- fuller line before the insert below, so the insert finds it in place.
UPDATE "public"."profile_menu_editions" m
SET "month" = e.month::smallint, "theme" = e.theme, "source_url" = e.source_url
FROM "cc_editions" e, "cc_profile" b
WHERE m.profile_id = b.id AND m.name = 'Opening menu' AND m.year = 2022 AND m.month IS NULL
  AND e.name = 'Opening menu' AND e.year = 2022;

INSERT INTO "public"."profile_menu_editions" ("profile_id", "name", "year", "month", "theme", "source_url")
SELECT b.id, e.name, e.year::smallint, e.month::smallint, e.theme, e.source_url
FROM "cc_editions" e
CROSS JOIN "cc_profile" b
ON CONFLICT ON CONSTRAINT "profile_menu_editions_once" DO NOTHING;

-- --- The drinks ---

INSERT INTO "public"."items" ("name", "item_type", "description", "notes", "origin", "riff_of_id", "origin_bar_profile_id", "origin_year")
SELECT d.name, 'cocktail', d.description, d.notes, CASE WHEN c.id IS NULL THEN 'Original' ELSE 'Varient' END,
       c.id, b.id, d.origin_year::smallint
FROM "cc_drinks" d
CROSS JOIN "cc_profile" b
LEFT JOIN "public"."items" c ON c.is_catalog AND c.item_type = 'cocktail' AND lower(c.name) = lower(d.riff_of)
WHERE NOT EXISTS (
    SELECT 1 FROM "public"."items" i
    WHERE i.item_type = 'cocktail' AND i.bar_id IS NULL AND i.origin_bar_profile_id = b.id AND lower(i.name) = lower(d.name)
);

-- The drink each row now points at (new, or already there).
ALTER TABLE "cc_drinks" ADD COLUMN "item_id" uuid;
UPDATE "cc_drinks" d SET "item_id" = (
    SELECT i.id FROM "public"."items" i, "cc_profile" b
    WHERE i.item_type = 'cocktail' AND i.bar_id IS NULL AND i.origin_bar_profile_id = b.id AND lower(i.name) = lower(d.name)
    ORDER BY i.created_at LIMIT 1
);
DELETE FROM "cc_drinks" WHERE "item_id" IS NULL;

-- Fill gaps on drinks that were already there; never overwrite.
UPDATE "public"."items" i SET
    "description" = coalesce(i.description, d.description),
    "notes" = coalesce(i.notes, d.notes),
    "origin_year" = coalesce(i.origin_year, d.origin_year::smallint),
    "glassware_id" = coalesce(i.glassware_id, (
        SELECT g.id FROM "public"."items" g
        WHERE g.item_type = 'glassware' AND g.bar_id IS NULL AND lower(g.name) = lower(d.glass)
        ORDER BY g.created_at LIMIT 1
    ))
FROM "cc_drinks" d
WHERE i.id = d.item_id;

-- The classic it's a version of, where the drink has none yet.
UPDATE "public"."items" i SET
    "riff_of_id" = c.id,
    "origin" = CASE WHEN i.origin = 'Original' THEN 'Varient' ELSE i.origin END
FROM "cc_drinks" d
JOIN "public"."items" c ON c.is_catalog AND c.item_type = 'cocktail' AND lower(c.name) = lower(d.riff_of)
WHERE i.id = d.item_id AND i.riff_of_id IS NULL AND i.id <> c.id;

-- --- Ingredient lines, only for drinks that have none ---

ALTER TABLE "cc_lines" ADD COLUMN "item_id" uuid;
UPDATE "cc_lines" l SET "item_id" = d.item_id
FROM "cc_drinks" d
WHERE lower(d.name) = lower(l.drink)
  AND NOT EXISTS (SELECT 1 FROM "public"."recipes" r WHERE r.recipe_item_id = d.item_id);
DELETE FROM "cc_lines" WHERE "item_id" IS NULL;

-- Shared ingredients, reusing one with the same name. A line's named bottle
-- or house prep (it has a generic) stays out of ingredient search; a line
-- that is itself the generic is searchable, as in the other bar seeds.
INSERT INTO "public"."items" ("name", "item_type", "hide_from_search")
SELECT DISTINCT ON (lower(x.n)) x.n, 'ingredient', x.hidden
FROM (
    SELECT l.ingredient AS n, (l.generic IS NOT NULL) AS hidden FROM "cc_lines" l
    UNION ALL
    SELECT l.generic, false FROM "cc_lines" l WHERE l.generic IS NOT NULL
) x
WHERE NOT EXISTS (
    SELECT 1 FROM "public"."items" i WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL AND lower(i.name) = lower(x.n)
)
ORDER BY lower(x.n), x.hidden;

CREATE TEMP TABLE "cc_ingredients" AS
SELECT DISTINCT ON (lower(name)) lower(name) AS key, id
FROM "public"."items" WHERE item_type = 'ingredient' AND bar_id IS NULL
ORDER BY lower(name), created_at;

INSERT INTO "public"."recipes" ("recipe_item_id", "ingredient_item_id", "parent_ingredient_id", "amount", "unit",
                                "preparation_notes", "is_optional", "sort_order")
SELECT l.item_id, i.id, g.id, NULL, NULL, l.prep, false, l.pos
FROM "cc_lines" l
JOIN "cc_ingredients" i ON i.key = lower(l.ingredient)
LEFT JOIN "cc_ingredients" g ON g.key = lower(l.generic);

-- --- The drinks on each menu ---

CREATE TEMP TABLE "cc_menu_rows" AS
SELECT DISTINCT ON (m.id, d.item_id) m.id AS edition_id, d.item_id, x.pos
FROM "cc_menu" x
CROSS JOIN "cc_profile" b
JOIN "public"."profile_menu_editions" m
  ON m.profile_id = b.id AND m.name = x.edition AND m.year = x.year AND m.month IS NOT DISTINCT FROM x.month
JOIN "cc_drinks" d ON lower(d.name) = lower(x.drink)
ORDER BY m.id, d.item_id, x.pos;

-- After anything already on the menu, in the order listed above.
INSERT INTO "public"."profile_menu_edition_drinks" ("edition_id", "item_id", "sort_order")
SELECT r.edition_id, r.item_id, coalesce(o.next, 0) + r.pos
FROM "cc_menu_rows" r
LEFT JOIN (
    SELECT edition_id, max(sort_order) + 1 AS next FROM "public"."profile_menu_edition_drinks" GROUP BY edition_id
) o ON o.edition_id = r.edition_id
WHERE NOT EXISTS (
    SELECT 1 FROM "public"."profile_menu_edition_drinks" x WHERE x.edition_id = r.edition_id AND x.item_id = r.item_id
);

DROP TABLE "cc_menu_rows", "cc_ingredients", "cc_menu", "cc_lines", "cc_drinks", "cc_editions", "cc_profile";

RESET "app.image_worker";
