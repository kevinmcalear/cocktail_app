-- Mathew Resler's Instagram and headline job (28 Oct 2026), the follow-up to
-- 20261128100000_mathew_resler_career.sql, which is already applied.
--
-- 1. His Instagram, @drink_smith (from Kevin), so he can claim the page with
--    a code sent from it.
-- 2. Cocktail Omakase as his headline job, so the claim offers it rather
--    than Bar 7.
--
-- Both apply only while the page is unclaimed and the field is empty.

UPDATE "public"."profiles" SET "instagram" = 'drink_smith'
WHERE "kind" = 'person' AND "handle" = 'mathew.resler' AND "user_id" IS NULL AND coalesce("instagram", '') = '';

UPDATE "public"."profiles" p SET "headline_position_id" = j.id
FROM "public"."profile_positions" j JOIN "public"."profiles" b ON b.id = j.bar_profile_id AND b.handle = 'cocktail_omakase_nyc'
WHERE p.kind = 'person' AND p.handle = 'mathew.resler' AND p.user_id IS NULL AND p.headline_position_id IS NULL
  AND j.person_profile_id = p.id AND j.is_current;
