-- Every glassware maker in the glass catalog has a page, after
-- 20261108100000. Kevin, 25 Oct 2026: "every company should have a page,
-- and every one of those company pages should have their actual logo on it,
-- just like bars do."
--
--   * 15 new maker pages for the makers whose glasses are being traced
--     (rona.glass to tikifarm.com): public and unclaimed, a name, a site and
--     a country only, as a glass load adds them (scripts/glass-models.ts).
--     A page of that handle, or a maker of that name, is left alone and
--     marked as making glassware.
--   * Arc is the group (Arques, France); its foodservice brands Arcoroc and
--     Chef&Sommelier, which already have pages, are part of it.
--   * Five tiki bars that sell their own mugs get bar pages, like any bar
--     added by hand: Tonga Hut, Hale Pele, False Idol, Max's South Seas
--     Hideaway, and Pacific Seas at Clifton's (closed in 2025). Addresses
--     from the bars' own sites or the press, map points from OpenStreetMap;
--     a bar already on Cocktail with the same name within 150 m is left
--     alone (add_venue's rule). The other tiki bars (Smuggler's Cove, Three
--     Dots and a Dash, Latitude 29, Lost Lake, Trader Vic's) have pages.
--   * Logos aren't in this migration. As for bars, they're files in the
--     avatars bucket (makers/<handle>.<edge>.png, a bar's under venues/),
--     put there once per database by scripts/maker-logos.mjs from
--     supabase/seeds/maker-logos.json, which cites each company's own page.
--   * No page: Kigura (no company or official site could be found behind
--     the name).

-- --- Maker pages ---

CREATE TEMP TABLE maker_in (handle text PRIMARY KEY, name text NOT NULL, website text NOT NULL, country text NOT NULL);
INSERT INTO maker_in VALUES
('arc', 'Arc', 'https://www.arc-intl.com/', 'FR'),
('rona', 'Rona', 'https://rona.glass/', 'SK'),
('rastal', 'Rastal', 'https://rastal.com/', 'DE'),
('sahm', 'Sahm', 'https://sahm.de/', 'DE'),
('zalto', 'Zalto', 'https://www.zaltoglas.at/', 'AT'),
('gabriel.glas', 'Gabriel-Glas', 'https://www.gabriel-glas.at/', 'AT'),
('richard.brendon', 'Richard Brendon', 'https://richardbrendon.com/', 'GB'),
('sophienwald', 'Sophienwald', 'https://www.sophienwald.com/', 'AT'),
('grassl', 'Grassl Glass', 'https://grasslglass.com/', 'CH'),
('josephinenhutte', 'Josephinenhütte', 'https://josephinen.com/', 'DE'),
('sertodo', 'Sertodo Copper', 'https://sertodo.com/', 'US'),
('obakki', 'Obakki', 'https://obakki.com/', 'CA'),
('umezawa', 'Umezawa', 'https://umezawa-u.co.jp/', 'JP'),
('tiki.farm', 'Tiki Farm', 'https://tikifarm.com/', 'US'),
('munktiki', 'Munktiki', 'https://www.munktiki.com/', 'US');

UPDATE public.profiles p SET makes = array_append(p.makes, 'glassware')
  FROM maker_in m
 WHERE p.kind = 'maker' AND (p.handle = m.handle OR lower(p.display_name) = lower(m.name)) AND NOT ('glassware' = ANY (p.makes));

INSERT INTO public.profiles (kind, handle, display_name, website, country_code, makes, is_public)
SELECT 'maker', m.handle, m.name, m.website, m.country, ARRAY['glassware'], true
  FROM maker_in m
 WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.handle = m.handle)
   AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.kind = 'maker' AND lower(p.display_name) = lower(m.name));

DROP TABLE maker_in;

-- Arc's brands. Moderators set a maker's group; a migration may.
UPDATE public.profiles b SET part_of_profile_id = g.id
  FROM public.profiles g
 WHERE g.handle = 'arc' AND g.kind = 'maker'
   AND b.handle IN ('arcoroc', 'chef.sommelier') AND b.kind = 'maker' AND b.part_of_profile_id IS NULL;

-- --- Tiki bars ---

INSERT INTO public.profiles ("kind", "handle", "display_name", "bio", "website", "is_public", "locality", "address_line",
                             "postcode", "city", "region", "country_code", "latitude", "longitude", "is_closed", "closed_year")
SELECT 'bar', v.handle, v.name, v.bio, v.website, true, v.locality, v.address_line,
       v.postcode, v.city, v.region, 'US', v.latitude, v.longitude, v.closed_year IS NOT NULL, v.closed_year::smallint
FROM (VALUES
    ('tonga.hut', 'Tonga Hut', 'Opened in 1958 by brothers Ace and Ed Libby, the oldest tiki bar still pouring in Los Angeles, in the San Fernando Valley. A second Tonga Hut is in Palm Springs.', 'https://www.tongahut.com/', 'North Hollywood', '12808 Victory Blvd', '91606', 'Los Angeles', 'CA', 34.1864924, -118.4121953, NULL),
    ('hale.pele', 'Hale Pele', 'A tiki bar on NE Broadway pouring more than 50 classic and modern exotic drinks with island-style small plates, in a room staged with storm and volcano effects.', 'https://www.halepele.com/', 'Grant Park', '2733 NE Broadway', '97232', 'Portland', 'OR', 45.5352926, -122.6373428, NULL),
    ('false.idol', 'False Idol', 'A hidden tiki bar in Little Italy, reached through a walk-in cooler inside the Craft & Commerce restaurant. Opened in 2016, known for its deep rum list.', 'https://www.falseidoltiki.com/', 'Little Italy', '675 W Beech St', '92101', 'San Diego', 'CA', 32.7207214, -117.168871, NULL),
    ('maxs.south.seas.hideaway', 'Max''s South Seas Hideaway', 'A two-storey tiki restaurant and bar in downtown Grand Rapids, opened in 2019 by HopCat founder Mark Sellers and filled with his collection of tiki art.', 'https://www.maxstiki.com/', 'Downtown', '58 Ionia Ave SW', '49503', 'Grand Rapids', 'MI', 42.9615707, -85.6700773, NULL),
    ('cliftons.pacific.seas', 'Pacific Seas at Clifton''s', 'The tiki bar inside Clifton''s Republic on Broadway, named after Clifton''s original Pacific Seas cafeteria. Clifton''s closed in 2025.', NULL, 'Historic Core', '648 S Broadway', '90014', 'Los Angeles', 'CA', 34.0453657, -118.252907, 2025)
) AS v("handle", "name", "bio", "website", "locality", "address_line", "postcode", "city", "region", "latitude", "longitude", "closed_year")
WHERE NOT EXISTS (
    SELECT 1 FROM "public"."profiles" p
    WHERE p.kind = 'bar' AND p.latitude BETWEEN v.latitude - 0.002 AND v.latitude + 0.002
      AND private.venue_name_key(p.display_name) = private.venue_name_key(v.name)
      AND private.distance_km(v.latitude, v.longitude, p.latitude, p.longitude) <= 0.15
)
ON CONFLICT ("handle") DO NOTHING;
