-- DRAFT. Local stack only. Not applied to production; needs Kevin's review.
--
-- A drink photo someone posted can be reported. Its own migration because a
-- new enum value can't be used in the transaction that adds it, and the next
-- migration (20261008500100_drink_photos) uses it.

ALTER TYPE "public"."report_target" ADD VALUE IF NOT EXISTS 'photo';
