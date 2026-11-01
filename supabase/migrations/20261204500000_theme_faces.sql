-- The theme faces: six more faces a bar can pick for names on Settings › Theme
-- (Kevin, 31 Oct 2026, one per style on the type picker). Bricolage Grotesque
-- (Modern) is already here; the app's own face is still instrument_serif, the
-- column's default. The app's names are in lib/brand.ts.
--
--   newsreader        Book: Newsreader 400 and italic
--   im_fell_english   Worn: IM Fell English 400 and italic
--   imbue             Deco: Imbue 400
--   besley            Tavern: Besley 500 and italic
--   belleza           Poster: Belleza 400, in capitals
--   big_shoulders     Sign: Big Shoulders 800, in capitals
--
-- Only new enum values: no table, policy or function changes, and no row is
-- rewritten. The faces bars picked before (fraunces, playfair_display,
-- josefin_sans, tenor_sans) stay valid; the app draws each as the nearest new
-- face (faceFromDb) until the bar picks again. Postgres allows ADD VALUE inside
-- the migration's transaction as long as nothing in the same transaction uses
-- the new value, and nothing here does. An app that offers a face before this
-- runs saves everything else and keeps the bar's old face (useSaveVenueBrand).

ALTER TYPE "public"."venue_display_face" ADD VALUE IF NOT EXISTS 'newsreader';
ALTER TYPE "public"."venue_display_face" ADD VALUE IF NOT EXISTS 'im_fell_english';
ALTER TYPE "public"."venue_display_face" ADD VALUE IF NOT EXISTS 'imbue';
ALTER TYPE "public"."venue_display_face" ADD VALUE IF NOT EXISTS 'besley';
ALTER TYPE "public"."venue_display_face" ADD VALUE IF NOT EXISTS 'belleza';
ALTER TYPE "public"."venue_display_face" ADD VALUE IF NOT EXISTS 'big_shoulders';
