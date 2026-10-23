-- Indexes for the foreign keys on big tables that had none, and the constraint
-- names left over from a rename (database audit, 22 Oct, 4.5 and 5.4).
--
-- 1. Five foreign keys on tables over 1,000 rows had no index, so deleting the
--    row they point at (a drink, a person) scanned the whole table:
--    items.spec_from_id (36k rows), profiles.created_by, profile_awards.added_by,
--    item_prep.updated_by and private.item_spec_matches.override_by. The
--    other unindexed keys are on small tables and wait until those grow.
-- 2. recipes and menu_drinks were built as new_recipes and new_menu_drinks
--    and renamed, but their keys kept the old names. Six now match their
--    tables. Two stay for now: recipes' recipe_item_id and ingredient_item_id
--    keys, because PostgREST embeds name a key by constraint and installed
--    apps (hooks/usePrepCard.ts) and the image-worker edge function
--    (_shared/itemPrompts.ts) named those two. Both now name the column
--    instead, which works with either name; the last two renames follow once
--    every installed app has that update.

-- --- Indexes ---

CREATE INDEX IF NOT EXISTS "items_spec_from_id_idx" ON "public"."items" ("spec_from_id") WHERE "spec_from_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "profiles_created_by_idx" ON "public"."profiles" ("created_by") WHERE "created_by" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "profile_awards_added_by_idx" ON "public"."profile_awards" ("added_by") WHERE "added_by" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "item_prep_updated_by_idx" ON "public"."item_prep" ("updated_by") WHERE "updated_by" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "item_spec_matches_override_by_idx" ON "private"."item_spec_matches" ("override_by") WHERE "override_by" IS NOT NULL;

-- --- Names ---

ALTER TABLE "public"."recipes" RENAME CONSTRAINT "new_recipes_pkey" TO "recipes_pkey";
ALTER TABLE "public"."recipes" RENAME CONSTRAINT "new_recipes_parent_ingredient_id_fkey" TO "recipes_parent_ingredient_id_fkey";
ALTER TABLE "public"."menu_drinks" RENAME CONSTRAINT "new_menu_drinks_pkey" TO "menu_drinks_pkey";
ALTER TABLE "public"."menu_drinks" RENAME CONSTRAINT "new_menu_drinks_item_id_fkey" TO "menu_drinks_item_id_fkey";
ALTER TABLE "public"."menu_drinks" RENAME CONSTRAINT "new_menu_drinks_menu_id_fkey" TO "menu_drinks_menu_id_fkey";
ALTER TABLE "public"."menu_drinks" RENAME CONSTRAINT "new_menu_drinks_template_section_id_fkey" TO "menu_drinks_template_section_id_fkey";
