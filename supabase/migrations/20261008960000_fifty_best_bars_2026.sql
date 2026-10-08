-- The World's 50 Best Bars 2026, announced in Milan on 7 October 2026.
--
-- Every bar on this year's list already has a profile here: the 51-100
-- places came with the decade seed (20260930100000), and the top 50 bars came
-- with the earlier seeds. This adds what the ceremony announced:
--
-- 1. Places 1 to 50 for 2026.
-- 2. The 2026 titled awards: the Best Bar in each region, Highest New Entry,
--    Best New Opening, Highest Climber, Legend of the List, One To Watch,
--    Sustainable Bar, Best Cocktail Menu, Best Bar Design, and Industry Icon
--    (to Shingo Gokan's person profile). Art of Hospitality and Bartenders'
--    Bartender were announced before the night and are already here. Titles
--    drop the sponsor, as in the earlier seeds.
-- 3. Saikindō in Abu Dhabi, winner of Best Bar Design, as a public,
--    unclaimed venue profile (the one award winner that wasn't here yet).
-- 4. Bios that quote a place ("No. 7 on The World's 50 Best Bars 2025.")
--    now quote the 2026 place, for the 100 bars on this year's list. Bars
--    that dropped off keep their last place.
--
-- Same rules as the earlier seeds: a bar already here (same name within
-- 150 m, or the handle taken) is left alone, and running this again adds
-- nothing.

-- --- Saikindō ---

INSERT INTO "public"."profiles" ("kind", "handle", "display_name", "bio", "website", "is_public", "locality", "address_line",
                                 "city", "country_code", "latitude", "longitude", "instagram")
SELECT 'bar', v.handle, v.name, v.bio, v.website, true, v.locality, v.address_line, v.city, v.country_code, v.latitude, v.longitude, v.handle
FROM (VALUES
    ('saikindo', 'Saikindō',
     'Japanese-style hi-fi listening bar inside Four Seasons Hotel Abu Dhabi on Al Maryah Island, opened in November 2025. Guests walk in through a fashion atelier shopfront to a room built around a hidden sound system, with speaker-shaped timber in the walls and a cocktail menu that changes with the music. It won Best Bar Design at The World''s 50 Best Bars 2026.',
     'https://www.saikindo.com/', 'Al Maryah Island', 'Four Seasons Hotel Abu Dhabi, Al Maryah Island', 'Abu Dhabi', 'AE', 24.50305, 54.38807)
) AS v("handle", "name", "bio", "website", "locality", "address_line", "city", "country_code", "latitude", "longitude")
-- Not a second copy of a bar someone already added (add_venue's rule).
WHERE NOT EXISTS (
    SELECT 1 FROM "public"."profiles" p
    WHERE p.kind = 'bar' AND p.latitude BETWEEN v.latitude - 0.002 AND v.latitude + 0.002
      AND private.venue_name_key(p.display_name) = private.venue_name_key(v.name)
      AND private.distance_km(v.latitude, v.longitude, p.latitude, p.longitude) <= 0.15
)
ON CONFLICT ("handle") DO NOTHING;

-- --- Places and awards ---

INSERT INTO "public"."profile_awards" ("profile_id", "award", "year", "position", "title", "source_url")
SELECT p.id, 'The World''s 50 Best Bars', 2026, v.position::smallint, v.title::text, v.source_url
FROM (VALUES
    ('barleonehk', 1, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('moebiusmilano', 2, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('alquimicocartagena', 3, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('bar.us.bkk', 4, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('line.athens', 5, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('handshake_bar', 6, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('zest.seoul', 7, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('connaughtbar', 8, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('ladybee.lima', 9, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('barmauromx', 10, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('schmuck.ny', 11, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('hopeandsesame', 12, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('thecambridge_paris', 13, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('sipandguzzlenyc', 14, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('barnouveau', 15, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('sips.barcelona', 16, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('paradiso_barcelona', 17, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('jiggerandponysg', 18, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('the.bar.in.front.of.the.bar', 19, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('eximiabar', 20, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('3monosbar', 21, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('mambanegra.22', 22, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('devie.bar', 23, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('himkok.oslo', 24, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('argobarhk', 25, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('danicoparis', 26, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('drywavecocktailstudio', 27, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('elgalloaltanero', 28, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('satans_whiskers', 29, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('bkksocialclub', 30, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('victoraudiobar', 31, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('waltzbar', 32, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('localefirenze', 33, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('mirrorbarcarlton', 34, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('tantannb', 35, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('montanabarhk', 36, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('sastreriamartinezlima', 37, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('nutmegandclove', 38, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('carmenrestaurante', 39, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('barronegroathens', 40, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('gokan.hk', 41, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('mimikakushi', 42, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('nouvellevague_tirana', 43, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('benfiddich_tokyo', 44, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('caretakers.cottage', 45, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('martinys_nyc', 46, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('tlecan', 47, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('virtutokyo', 48, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('barsnack.nyc', 49, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('madridangelita', 50, NULL, 'https://www.theworlds50best.com/bars/best-in-the-world/list/1-50'),
    ('barleonehk', NULL, 'Best Bar in Asia', 'https://www.prnewswire.com/news-releases/bar-leone-hong-kong-is-named-the-worlds-best-bar-as-the-list-of-the-50-best-bars-2026-is-revealed-302901694.html'),
    ('moebiusmilano', NULL, 'Best Bar in Europe', 'https://www.prnewswire.com/news-releases/bar-leone-hong-kong-is-named-the-worlds-best-bar-as-the-list-of-the-50-best-bars-2026-is-revealed-302901694.html'),
    ('handshake_bar', NULL, 'Best Bar in North America', 'https://www.prnewswire.com/news-releases/bar-leone-hong-kong-is-named-the-worlds-best-bar-as-the-list-of-the-50-best-bars-2026-is-revealed-302901694.html'),
    ('alquimicocartagena', NULL, 'Best Bar in South America', 'https://www.prnewswire.com/news-releases/bar-leone-hong-kong-is-named-the-worlds-best-bar-as-the-list-of-the-50-best-bars-2026-is-revealed-302901694.html'),
    ('mimikakushi', NULL, 'Best Bar in Middle East', 'https://www.prnewswire.com/news-releases/bar-leone-hong-kong-is-named-the-worlds-best-bar-as-the-list-of-the-50-best-bars-2026-is-revealed-302901694.html'),
    ('caretakers.cottage', NULL, 'Best Bar in Australasia', 'https://www.prnewswire.com/news-releases/bar-leone-hong-kong-is-named-the-worlds-best-bar-as-the-list-of-the-50-best-bars-2026-is-revealed-302901694.html'),
    ('frontbackaccra', NULL, 'Best Bar in Africa', 'https://www.prnewswire.com/news-releases/bar-leone-hong-kong-is-named-the-worlds-best-bar-as-the-list-of-the-50-best-bars-2026-is-revealed-302901694.html'),
    ('barmauromx', NULL, 'Highest New Entry', 'https://www.prnewswire.com/news-releases/bar-leone-hong-kong-is-named-the-worlds-best-bar-as-the-list-of-the-50-best-bars-2026-is-revealed-302901694.html'),
    ('schmuck.ny', NULL, 'Best New Opening', 'https://www.prnewswire.com/news-releases/bar-leone-hong-kong-is-named-the-worlds-best-bar-as-the-list-of-the-50-best-bars-2026-is-revealed-302901694.html'),
    ('the.bar.in.front.of.the.bar', NULL, 'Highest Climber', 'https://www.prnewswire.com/news-releases/bar-leone-hong-kong-is-named-the-worlds-best-bar-as-the-list-of-the-50-best-bars-2026-is-revealed-302901694.html'),
    ('paradiso_barcelona', NULL, 'Legend of the List', 'https://www.prnewswire.com/news-releases/bar-leone-hong-kong-is-named-the-worlds-best-bar-as-the-list-of-the-50-best-bars-2026-is-revealed-302901694.html'),
    ('threehorsesbar', NULL, 'One To Watch', 'https://www.prnewswire.com/news-releases/bar-leone-hong-kong-is-named-the-worlds-best-bar-as-the-list-of-the-50-best-bars-2026-is-revealed-302901694.html'),
    ('line.athens', NULL, 'Sustainable Bar', 'https://www.prnewswire.com/news-releases/bar-leone-hong-kong-is-named-the-worlds-best-bar-as-the-list-of-the-50-best-bars-2026-is-revealed-302901694.html'),
    ('pandaandsons', NULL, 'Best Cocktail Menu', 'https://www.prnewswire.com/news-releases/bar-leone-hong-kong-is-named-the-worlds-best-bar-as-the-list-of-the-50-best-bars-2026-is-revealed-302901694.html'),
    ('saikindo', NULL, 'Best Bar Design', 'https://www.prnewswire.com/news-releases/bar-leone-hong-kong-is-named-the-worlds-best-bar-as-the-list-of-the-50-best-bars-2026-is-revealed-302901694.html'),
    ('shingo.gokan', NULL, 'Industry Icon', 'https://www.prnewswire.com/news-releases/bar-leone-hong-kong-is-named-the-worlds-best-bar-as-the-list-of-the-50-best-bars-2026-is-revealed-302901694.html')
) AS v("handle", "position", "title", "source_url")
JOIN "public"."profiles" p ON p.handle = v.handle
ON CONFLICT DO NOTHING;

-- --- Bios ---

UPDATE "public"."profiles" p
SET "bio" = regexp_replace(p.bio, 'No\. \d+ on The World''s 50 Best Bars 20(24|25|26)( \(51-100\))?\.', 'No. ' || v.position || ' on The World''s 50 Best Bars 2026.')
FROM (VALUES
    ('barleonehk', 1),
    ('moebiusmilano', 2),
    ('alquimicocartagena', 3),
    ('bar.us.bkk', 4),
    ('line.athens', 5),
    ('handshake_bar', 6),
    ('zest.seoul', 7),
    ('connaughtbar', 8),
    ('ladybee.lima', 9),
    ('barmauromx', 10),
    ('schmuck.ny', 11),
    ('hopeandsesame', 12),
    ('thecambridge_paris', 13),
    ('sipandguzzlenyc', 14),
    ('barnouveau', 15),
    ('sips.barcelona', 16),
    ('paradiso_barcelona', 17),
    ('jiggerandponysg', 18),
    ('the.bar.in.front.of.the.bar', 19),
    ('eximiabar', 20),
    ('3monosbar', 21),
    ('mambanegra.22', 22),
    ('devie.bar', 23),
    ('himkok.oslo', 24),
    ('argobarhk', 25),
    ('danicoparis', 26),
    ('drywavecocktailstudio', 27),
    ('elgalloaltanero', 28),
    ('satans_whiskers', 29),
    ('bkksocialclub', 30),
    ('victoraudiobar', 31),
    ('waltzbar', 32),
    ('localefirenze', 33),
    ('mirrorbarcarlton', 34),
    ('tantannb', 35),
    ('montanabarhk', 36),
    ('sastreriamartinezlima', 37),
    ('nutmegandclove', 38),
    ('carmenrestaurante', 39),
    ('barronegroathens', 40),
    ('gokan.hk', 41),
    ('mimikakushi', 42),
    ('nouvellevague_tirana', 43),
    ('benfiddich_tokyo', 44),
    ('caretakers.cottage', 45),
    ('martinys_nyc', 46),
    ('tlecan', 47),
    ('virtutokyo', 48),
    ('barsnack.nyc', 49),
    ('madridangelita', 50),
    ('tjoget', 51),
    ('boadascocktails', 52),
    ('doublechickenpleasenyc', 53),
    ('coahongkong', 54),
    ('baba_au_rum', 55),
    ('cochinchina.bar', 56),
    ('boilermaker.goa', 57),
    ('lpmdubai', 58),
    ('fomabar.mx', 59),
    ('mobarshenzhen', 60),
    ('superbuenonyc', 61),
    ('freniefrizioni', 62),
    ('limantourmx', 63),
    ('jewelnola', 64),
    ('svanen.oslo', 65),
    ('salmonguru', 66),
    ('arcatulum', 67),
    ('bargabriel.ist', 68),
    ('penicillin_bar', 69),
    ('barkumiko', 70),
    ('bar.cham', 71),
    ('pandaandsons', 72),
    ('threesheetssoho', 73),
    ('bar_trench', 74),
    ('maybe_sammy_sydney', 75),
    ('naked.athens', 76),
    ('scarfesbar', 77),
    ('employeesonlyny', 78),
    ('venderbar', 79),
    ('frontbackaccra', 80),
    ('mius.hongkong', 81),
    ('otro___bar', 82),
    ('rodahusetsthlm', 83),
    ('threehorsesbar', 84),
    ('god_bkk', 85),
    ('smokeandbitters', 86),
    ('laborrachagh', 87),
    ('the_sg_club', 88),
    ('offtrack.sg', 89),
    ('foco.bcn', 90),
    ('guccigiardino', 91),
    ('drinkkongbar', 92),
    ('littlereddoor_paris', 93),
    ('1930cocktailbar', 94),
    ('lasaladelaura', 95),
    ('thesavoryproject', 96),
    ('opm.bkk', 97),
    ('1661bar', 98),
    ('vesperbkk', 99),
    ('the_bellwood', 100)
) AS v("handle", "position")
WHERE p.handle = v.handle AND p.kind = 'bar' AND p.bio ~ 'No\. \d+ on The World''s 50 Best Bars 20(24|25|26)( \(51-100\))?\.'
  AND p.bio IS DISTINCT FROM regexp_replace(p.bio, 'No\. \d+ on The World''s 50 Best Bars 20(24|25|26)( \(51-100\))?\.', 'No. ' || v.position || ' on The World''s 50 Best Bars 2026.');
