-- Signed-out visitors read profiles by column (20260927000000), and each
-- migration that adds a column the profile page shows grants it to anon.
-- 20261001124323 added instagram without that grant, so useProfile's select
-- failed for anon (42501) and no public profile opened while signed out.
-- An Instagram name is public profile info, shown on the page like website.
-- supabase/tests/profile-columns.test.mjs now checks every column useProfile
-- selects.

GRANT SELECT ("instagram") ON "public"."profiles" TO "anon";
