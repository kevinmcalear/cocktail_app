-- Frágil Cocktail Bar in Porto, its founder António Rosário, and one of its
-- drinks. Found through a reel by @driftersjoint (instagram.com/reel/DezUQEkovhp,
-- co-posted by António) and checked against the bar's and António's own public
-- Instagram profiles and the bar's Google Maps listing, 24 Oct 2026.
--
-- 1. The bar: a public, unclaimed bar profile on the map, like any added bar.
--    Skipped when the same bar is already here (add_venue's rule).
-- 2. António: a public, unclaimed person profile, linked to the bar as its
--    founder. Professional facts only, in our own words, no photos: his
--    avatar stays initials until he claims it.
-- 3. The Cherry Blossom Negroni, which the bar posted for Negroni Week 2026:
--    a shared drink credited to the bar at 'suggested', as a version of the
--    Negroni. No spec: the post names the ingredients but not amounts.
--
-- Idempotent: taken handles are skipped, and the drink isn't added twice.

-- --- The bar ---

INSERT INTO "public"."profiles" ("kind", "handle", "display_name", "bio", "is_public", "instagram", "locality", "address_line",
                                 "postcode", "city", "region", "country_code", "latitude", "longitude", "timezone")
SELECT 'bar', v.handle, v.name, v.bio, true, v.instagram, v.locality, v.address_line,
       v.postcode, v.city, v.region, v.country_code, v.latitude, v.longitude, v.timezone
FROM (VALUES
    ('fragilbar', 'Frágil Cocktail Bar', 'Small two-storey cocktail bar in Bonfim, just east of Porto''s centre, founded and run by bartender António Rosário. You say what you like and the bar takes it from there, usually with a house take on a classic. Known for guest shifts and bartender takeovers.', 'fragilbar', 'Bonfim', 'Rua de Latino Coelho 84, Loja 5', '4000-039', 'Porto', 'Porto', 'PT', 41.15923::double precision, -8.59963::double precision, 'Europe/Lisbon')
) AS v("handle", "name", "bio", "instagram", "locality", "address_line", "postcode", "city", "region", "country_code",
       "latitude", "longitude", "timezone")
WHERE NOT EXISTS (
    SELECT 1 FROM "public"."profiles" p
    WHERE p.kind = 'bar' AND p.latitude BETWEEN v.latitude - 0.002 AND v.latitude + 0.002
      AND private.venue_name_key(p.display_name) = private.venue_name_key(v.name)
      AND private.distance_km(v.latitude, v.longitude, p.latitude, p.longitude) <= 0.15
)
ON CONFLICT ("handle") DO NOTHING;

-- --- António ---

INSERT INTO "public"."profiles" ("kind", "handle", "display_name", "bio", "is_public", "instagram", "city")
SELECT 'person', v.handle, v.name, v.bio, true, v.instagram, v.city
FROM (VALUES
    ('antonio.rosario', 'António Rosário', 'Porto bartender who founded Frágil Cocktail Bar and is its creative director. He also runs cocktail workshops, bar consulting and events with Shake & Stir Oporto.', 'antonio.rosario.barman', 'Porto')
) AS v("handle", "name", "bio", "instagram", "city")
ON CONFLICT ("handle") DO NOTHING;

INSERT INTO "public"."profile_positions" ("person_profile_id", "bar_profile_id", "title", "is_current", "source_url")
SELECT p.id, b.id, v.title, v.is_current, v.source_url
FROM (VALUES
    ('antonio.rosario', 'fragilbar', 'Founder and creative director', true, 'https://www.instagram.com/antonio.rosario.barman/')
) AS v("person", "bar", "title", "is_current", "source_url")
JOIN "public"."profiles" p ON p.handle = v.person AND p.kind = 'person'
JOIN "public"."profiles" b ON b.handle = v.bar AND b.kind = 'bar'
ON CONFLICT DO NOTHING;

-- --- The drink ---

-- Seeded drinks don't queue automatic sketches (nobody to bill for them).
SET "app.image_worker" = 'on';

INSERT INTO "public"."items" ("name", "item_type", "description", "origin", "riff_of_id", "origin_bar_profile_id", "origin_year", "credit_status")
SELECT v.name, 'cocktail', v.description, CASE WHEN c.id IS NULL THEN 'Original' ELSE 'Varient' END,
       c.id, p.id, v.origin_year, 'suggested'
FROM (VALUES
    ('fragilbar', 'Cherry Blossom Negroni', 'Frágil''s drink for Negroni Week 2026: Campari and vermouth with cherry blossom, black tea and green tea, keeping the Negroni''s bitter backbone with a lighter, floral lift.', 'Negroni', 2026::smallint)
) AS v("handle", "name", "description", "riff_of", "origin_year")
JOIN "public"."profiles" p ON p.handle = v.handle AND p.kind = 'bar'
LEFT JOIN LATERAL (
    SELECT c.id FROM "public"."items" c
    WHERE c.is_catalog AND c.item_type = 'cocktail' AND lower(c.name) = lower(v.riff_of)
    ORDER BY c.created_at LIMIT 1
) c ON true
-- Once per bar and name, so re-running adds nothing.
WHERE NOT EXISTS (
    SELECT 1 FROM "public"."items" i
    WHERE i.origin_bar_profile_id = p.id AND lower(i.name) = lower(v.name)
);
