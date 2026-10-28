-- Mat Resler's Instagram (@drink_smith, from Kevin, 28 Oct 2026) and
-- Cocktail Omakase as his headline job, on his page while it's unclaimed and
-- has none. With the Instagram he can claim the page by a code sent from it,
-- the quickest way; the headline job makes the claim and You offer Cocktail
-- Omakase rather than Bar 7. 20261128100000 had shipped before these were
-- added, so they come here.

UPDATE "public"."profiles" SET "instagram" = 'drink_smith'
WHERE "kind" = 'person' AND "handle" = 'mathew.resler' AND "user_id" IS NULL AND coalesce("instagram", '') = '';

UPDATE "public"."profiles" p SET "headline_position_id" = j.id
FROM "public"."profile_positions" j JOIN "public"."profiles" b ON b.id = j.bar_profile_id AND b.handle = 'cocktail_omakase_nyc'
WHERE p.kind = 'person' AND p.handle = 'mathew.resler' AND p.user_id IS NULL AND p.headline_position_id IS NULL
  AND j.person_profile_id = p.id AND j.is_current;
