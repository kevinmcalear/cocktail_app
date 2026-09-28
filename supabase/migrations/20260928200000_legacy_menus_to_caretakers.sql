-- The menus made before venues existed belong to no venue and have no
-- creator, so the redesigned Menus list (a venue's menus plus your own)
-- never shows them. They're Caretaker's Cottage's menus: give them to it.
--
-- Matches by slug, so on a database without that venue (local, tests) this
-- changes nothing.

UPDATE "public"."menus"
SET "bar_id" = (SELECT "id" FROM "public"."bars" WHERE "slug" = 'caretakers-cottage')
WHERE "bar_id" IS NULL
  AND "created_by" IS NULL
  AND EXISTS (SELECT 1 FROM "public"."bars" WHERE "slug" = 'caretakers-cottage');
