-- Mathew Resler's whole career on his profile, so he finds it all when he
-- claims it (28 Oct 2026). He goes by Mat; press also spells him Matt,
-- Matthew and Ressler. Everything here is from public press, linked on each
-- job; professional facts only, in our own words.
--
-- 1. Four bars he worked at that weren't here: Empellón Taqueria (open, on
--    the map), and Empellón Cocina, Golden Cadillac and Bar Sardine (closed,
--    off the map). A bar already here under the same name in the same city
--    is used instead.
-- 2. His jobs: five new ones (Empellón Taqueria, Empellón Cocina, Golden
--    Cadillac, Bar Sardine, Bar Goto Niban), and years on the three from
--    20261008000000. Bar Goto becomes head bartender (Time Out, 2016).
--    Past jobs at closed bars are public record and shown; the rest wait
--    for him to switch them on.
-- 3. His bio, rewritten to cover all of it, only while nobody has claimed or
--    edited it.
-- 4. Drinks the press credits to him: the Hojicha Espresso Martini at Bar 7
--    (Forbes, July 2026) gets him as creator, and his pork-fat mezcal drink
--    at Empellón Cocina (Food Republic) is added with its published spec.
--    The Cocktail Omakase menus stay credited to the bar: the press says
--    they were built with Bar Libre and names no one drink as his.
--
-- No awards: none for him turned up in the Spirited Awards, World Class,
-- Bacardi Legacy or brand competitions.
--
-- Safe to re-run: bars, jobs, drinks, lines and notes already present are
-- left alone.

-- Seeded drinks don't queue automatic sketches (nobody to bill for them).
SET "app.image_worker" = 'on';

-- --- 1. Bars ---

CREATE TEMP TABLE "mr_bars" ("handle" text, "name" text, "bio" text, "website" text, "locality" text, "address_line" text,
                             "postcode" text, "latitude" double precision, "longitude" double precision,
                             "is_closed" boolean, "closed_year" smallint, "id" uuid);
INSERT INTO "mr_bars" VALUES
    ('empellon.taqueria.nyc', 'Empellón Taqueria',
     'Alex Stupak''s first Empellón, opened in March 2011 at West 4th and West 10th Streets in the West Village, first as Empellón and now as Empellón Taqueria: tacos and salsas with a bar known for tequila and mezcal.',
     'https://www.empellon.com/', 'West Village', '230 W 4th St', '10014', 40.7341405, -74.0030338, false, NULL, NULL),
    ('empellon.cocina.nyc', 'Empellón Cocina',
     'Alex Stupak''s more ambitious Mexican restaurant on First Avenue in the East Village, opened in 2012. It closed after service on 20 May 2017, when Stupak chose not to renew the lease.',
     NULL, 'East Village', '105 1st Ave', '10003', NULL, NULL, true, 2017, NULL),
    ('goldencadillac.nyc', 'Golden Cadillac',
     '1970s-styled East Village cocktail bar at First Avenue and East 1st Street from Greg Boehm of Cocktail Kingdom and bartender Giuseppe Gonzalez. Open from November 2013 to July 2014; the space became Boilermaker.',
     NULL, 'East Village', '13 1st Ave', '10003', NULL, NULL, true, 2014, NULL),
    ('barsardine.nyc', 'Bar Sardine',
     'Gabriel Stulman''s corner cocktail bar on West 10th Street in the West Village, which took over from Chez Sardine in 2014 and was known for its Fedora burger. It closed in August 2020.',
     NULL, 'West Village', '183 W 10th St', '10014', NULL, NULL, true, 2020, NULL);

-- The same bar already here (by handle, or by name in New York) is used.
UPDATE "mr_bars" b SET "id" = coalesce(
    (SELECT p.id FROM "public"."profiles" p WHERE p.kind = 'bar' AND p.handle = b.handle),
    (SELECT p.id FROM "public"."profiles" p
     WHERE p.kind = 'bar' AND p.city = 'New York' AND private.venue_name_key(p.display_name) = private.venue_name_key(b.name)
     ORDER BY p.created_at LIMIT 1));

WITH "added" AS (
    INSERT INTO "public"."profiles" ("kind", "handle", "display_name", "bio", "website", "is_public", "locality", "address_line",
                                     "postcode", "city", "region", "country_code", "latitude", "longitude", "timezone",
                                     "is_closed", "closed_year")
    SELECT 'bar', b.handle, b.name, b.bio, b.website, true, b.locality, b.address_line,
           b.postcode, 'New York', 'New York', 'US', b.latitude, b.longitude, 'America/New_York',
           b.is_closed, b.closed_year
    FROM "mr_bars" b WHERE b.id IS NULL
    ON CONFLICT ("handle") DO NOTHING
    RETURNING "id", "handle"
)
UPDATE "mr_bars" b SET "id" = a.id FROM "added" a WHERE b.handle = a.handle;

-- --- 2. Jobs ---

CREATE TEMP TABLE "mr_jobs" ("bar" text, "title" text, "is_current" boolean, "is_shown" boolean,
                             "start_year" smallint, "start_month" smallint, "end_year" smallint, "source_url" text);
INSERT INTO "mr_jobs" VALUES
    ('empellon.taqueria.nyc', 'Bar manager', false, false, 2011, 3, NULL,
     'https://www.restaurantgirl.com/sneak_peek_at_alex_stupaks_emp.html'),
    ('empellon.cocina.nyc', 'Beverage director', false, true, NULL, NULL, NULL,
     'https://www.foodrepublic.com/recipes/weekend-project-how-to-infuse-mezcal-with-pork-fat/'),
    ('goldencadillac.nyc', 'Bartender', false, true, 2013, 11, 2014,
     'https://www.vice.com/en/article/test-driving-the-new-action-bronson-cocktail-at-pouring-ribbons/'),
    ('barsardine.nyc', 'Bartender', false, true, NULL, NULL, NULL,
     'https://www.villagevoice.com/bar-goto-is-a-go-to-for-okonomiyaki-and-edgy-cocktails/'),
    ('bargoto_niban', 'Bartender', false, false, NULL, NULL, NULL,
     'https://robertsimonson.substack.com/p/on-a-tootlabor-day-weekend-edition');

INSERT INTO "public"."profile_positions" ("person_profile_id", "bar_profile_id", "title", "is_current", "is_shown",
                                          "start_year", "start_month", "end_year", "source_url")
SELECT a.id, coalesce(b.id, p.id), j.title, j.is_current, j.is_shown, j.start_year, j.start_month, j.end_year, j.source_url
FROM "mr_jobs" j
JOIN "public"."profiles" a ON a.kind = 'person' AND a.handle = 'mathew.resler'
LEFT JOIN "mr_bars" b ON b.handle = j.bar
LEFT JOIN "public"."profiles" p ON p.kind = 'bar' AND p.handle = j.bar
WHERE coalesce(b.id, p.id) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "public"."profile_positions" x WHERE x.person_profile_id = a.id AND x.bar_profile_id = coalesce(b.id, p.id)
);

-- Years on the jobs 20261008000000 added, while still as seeded.
UPDATE "public"."profile_positions" pp SET
    "title" = coalesce(v.title, pp.title),
    "start_year" = v.start_year, "start_month" = v.start_month,
    "source_url" = coalesce(v.source_url, pp.source_url)
FROM (VALUES
    ('cocktail_omakase_nyc', 'Head bartender', NULL, 2026::smallint, 3::smallint, NULL),
    ('bar7.cocktailomakase', 'Head bartender', NULL, 2026::smallint, 3::smallint, NULL),
    ('bargoto_nyc', 'Bartender (opening team)', 'Head bartender', 2015::smallint, NULL::smallint,
     'https://www.timeout.com/usa/bars/how-to-make-a-sazerac')
) AS v("bar", "seeded_title", "title", "start_year", "start_month", "source_url"),
     "public"."profiles" a, "public"."profiles" b
WHERE a.kind = 'person' AND a.handle = 'mathew.resler' AND pp.person_profile_id = a.id
  AND b.kind = 'bar' AND b.handle = v.bar AND pp.bar_profile_id = b.id
  AND NOT pp.added_in_app AND pp.title = v.seeded_title AND pp.start_year IS NULL;

-- --- 3. Bio ---

UPDATE "public"."profiles" SET "bio" = 'New York bartender, known as Mat, who runs the bar at Cocktail Omakase and Bar 7 on the Lower East Side, opened in 2026 with Tokyo''s Bar Libre, where he trained first. He came from Los Angeles in 2011 as bar manager of Alex Stupak''s first Empellón (now Empellón Taqueria), then was beverage director at Empellón Cocina. He worked at Golden Cadillac and Bar Sardine, helped Kenta Goto open Bar Goto in 2015 and became its head bartender, and later tended bar at Bar Goto Niban.'
WHERE "kind" = 'person' AND "handle" = 'mathew.resler' AND "user_id" IS NULL AND "claimed_at" IS NULL
  AND "bio" = 'New York bartender, also known as Mat, who leads the bar at Cocktail Omakase and Bar 7 on the Lower East Side. He helped open Bar Goto, worked at Bar Goto Niban in Brooklyn and ran the bar at Empellón Taqueria, and spent time at Bar Libre in Tokyo before Cocktail Omakase opened in 2026.';

-- --- 4. Drinks ---

-- Nor flavour jobs: each is a paid AI fill for a drink with no venue. Note
-- these drinks' queue now and put it back at the end.
CREATE TEMP TABLE "mr_flavor_jobs" AS
SELECT j.* FROM "private"."item_flavor_jobs" j
JOIN "public"."items" i ON i.id = j.item_id
WHERE i.item_type = 'cocktail' AND i.bar_id IS NULL
  AND i.origin_bar_profile_id IN (SELECT id FROM "mr_bars" UNION SELECT id FROM "public"."profiles" WHERE handle = 'bar7.cocktailomakase');

-- Forbes (28 Jul 2026): he built it around layers of roast.
UPDATE "public"."items" i SET "creator_profile_id" = a.id
FROM "public"."profiles" a, "public"."profiles" b
WHERE a.kind = 'person' AND a.handle = 'mathew.resler'
  AND b.kind = 'bar' AND b.handle = 'bar7.cocktailomakase'
  AND i.item_type = 'cocktail' AND i.bar_id IS NULL AND i.origin_bar_profile_id = b.id
  AND i.name = 'Hojicha Espresso Martini' AND i.creator_profile_id IS NULL;

INSERT INTO "public"."items" ("name", "item_type", "description", "origin", "creator_profile_id", "origin_bar_profile_id",
                              "credit_status", "glassware_id")
SELECT 'Pork Fat Mezcal', 'cocktail',
       'Stirred mezcal drink of Ilegal Joven and Ilegal Joven washed with pork rib fat, with white chocolate liqueur, a layer of coffee liqueur and drops of habanero tincture.',
       'Original', a.id, b.id, 'suggested',
       (SELECT g.id FROM "public"."items" g WHERE g.item_type = 'glassware' AND g.bar_id IS NULL AND g.name = 'Coupe' ORDER BY g.created_at LIMIT 1)
FROM "public"."profiles" a, "mr_bars" b
WHERE a.kind = 'person' AND a.handle = 'mathew.resler' AND b.handle = 'empellon.cocina.nyc' AND b.id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "public"."items" i
    WHERE i.item_type = 'cocktail' AND i.origin_bar_profile_id = b.id AND lower(i.name) = 'pork fat mezcal'
);

CREATE TEMP TABLE "mr_drink" AS
SELECT i.id FROM "public"."items" i JOIN "mr_bars" b ON b.id = i.origin_bar_profile_id
WHERE b.handle = 'empellon.cocina.nyc' AND i.item_type = 'cocktail' AND lower(i.name) = 'pork fat mezcal'
ORDER BY i.created_at LIMIT 1;

INSERT INTO "public"."item_notes" ("item_id", "body")
SELECT d.id, 'Food Republic printed his recipe without a name, so it has a plain one here. The fat comes from the kitchen''s adobo ribs; the drink ran as a one-night special and sold out that night. Steep two sliced habaneros in plain Ilegal Joven overnight for the tincture. Stir the two mezcals with Marie Brizard white chocolate liqueur for 45 seconds, strain into a chilled coupe, pour the coffee liqueur down a spoon so it sinks, and finish with five drops of tincture.'
FROM "mr_drink" d
WHERE NOT EXISTS (SELECT 1 FROM "public"."item_notes" n WHERE n.item_id = d.id);

INSERT INTO "public"."item_methods" ("item_id", "method_item_id", "sort_order")
SELECT d.id, m.id, 0
FROM "mr_drink" d
JOIN LATERAL (SELECT x.id FROM "public"."items" x WHERE x.item_type = 'method' AND x.bar_id IS NULL AND x.name = 'Stir' ORDER BY x.created_at LIMIT 1) m ON true
WHERE NOT EXISTS (SELECT 1 FROM "public"."item_methods" x WHERE x.item_id = d.id);

-- The spec, only while it has none. Ingredients reuse a shared one with the
-- same name key (or alias); the fat-washed mezcal is new, out of search.
CREATE TEMP TABLE "mr_lines" ("pos" int, "ingredient" text, "amount" numeric, "unit" text, "id" uuid);
INSERT INTO "mr_lines" VALUES
    (0, 'Ilegal Joven', 2, 'oz', NULL),
    (1, 'Pork Rib Fat-Washed Ilegal Joven', 2, 'oz', NULL),
    (2, 'White chocolate liqueur', 0.75, 'oz', NULL),
    (3, 'Coffee liqueur', 0.5, 'oz', NULL),
    (4, 'Habanero tincture', 5, 'drop', NULL);
DELETE FROM "mr_lines" WHERE EXISTS (SELECT 1 FROM "public"."recipes" r JOIN "mr_drink" d ON d.id = r.recipe_item_id);

UPDATE "mr_lines" l SET "id" = coalesce(
    (SELECT i.id FROM "public"."items" i
     WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL AND public.ingredient_key(i.name) = public.ingredient_key(l.ingredient)
     ORDER BY i.is_core DESC, i.created_at LIMIT 1),
    (SELECT a.item_id FROM "public"."ingredient_aliases" a WHERE a.key = public.ingredient_key(l.ingredient) LIMIT 1));

WITH "added" AS (
    INSERT INTO "public"."items" ("name", "item_type", "hide_from_search")
    SELECT l.ingredient, 'ingredient', true FROM "mr_lines" l WHERE l.id IS NULL
    RETURNING "id", "name"
)
UPDATE "mr_lines" l SET "id" = a.id FROM "added" a WHERE l.id IS NULL AND a.name = l.ingredient;

INSERT INTO "public"."recipes" ("recipe_item_id", "ingredient_item_id", "parent_ingredient_id", "amount", "unit",
                                "is_optional", "sort_order")
SELECT d.id, i.id, i.generic_id, l.amount, l.unit, false, l.pos
FROM "mr_lines" l
CROSS JOIN "mr_drink" d
JOIN "public"."items" i ON i.id = l.id;

-- --- Put these drinks' flavour jobs back ---

DELETE FROM "private"."item_flavor_jobs" j
USING "public"."items" i
WHERE j.item_id = i.id AND i.item_type = 'cocktail' AND i.bar_id IS NULL
  AND i.origin_bar_profile_id IN (SELECT id FROM "mr_bars" UNION SELECT id FROM "public"."profiles" WHERE handle = 'bar7.cocktailomakase')
  AND NOT EXISTS (SELECT 1 FROM "mr_flavor_jobs" o WHERE o.item_id = j.item_id);
UPDATE "private"."item_flavor_jobs" j SET
    "status" = o.status, "revision" = o.revision, "attempts" = o.attempts, "run_after" = o.run_after,
    "lease_until" = o.lease_until, "last_error" = o.last_error, "updated_at" = o.updated_at
FROM "mr_flavor_jobs" o
WHERE j.item_id = o.item_id AND j.revision <> o.revision;

DROP TABLE "mr_flavor_jobs", "mr_lines", "mr_drink", "mr_jobs", "mr_bars";
RESET "app.image_worker";
