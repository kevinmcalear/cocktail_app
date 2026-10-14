-- Three more display faces a venue can pick on its Brand screen (Eddie, 13 Oct:
-- "a couple of very sleek ones"). The app's names are in lib/brand.ts.
--
--   playfair_display   a high-contrast serif (Playfair Display 400 and italic)
--   josefin_sans       an art deco geometric sans (Josefin Sans 600)
--   tenor_sans         a fine humanist sans (Tenor Sans 400)
--
-- Only new enum values: no table, policy or function changes. Postgres allows
-- ADD VALUE inside the migration's transaction as long as nothing in the same
-- transaction uses the new value, and nothing here does. An app that doesn't
-- know a face yet draws it as Instrument Serif (faceFromDb). An app that
-- offers a face before this runs saves everything else and keeps the venue's
-- old face (useSaveVenueBrand).

ALTER TYPE "public"."venue_display_face" ADD VALUE IF NOT EXISTS 'playfair_display';
ALTER TYPE "public"."venue_display_face" ADD VALUE IF NOT EXISTS 'josefin_sans';
ALTER TYPE "public"."venue_display_face" ADD VALUE IF NOT EXISTS 'tenor_sans';
