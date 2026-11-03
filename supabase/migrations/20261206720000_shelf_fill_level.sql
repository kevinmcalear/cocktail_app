-- How much is left in a bottle on the shelf (Kevin, 3 Nov 2026, Drinks board:
-- "Full", "Half left", "Running low"). One nullable column on home_bar_items;
-- null means the person has not said. The table's existing "home_bar_items_own"
-- policy already limits every read and write to the owner, so nothing changes
-- there.

ALTER TABLE "public"."home_bar_items"
    ADD COLUMN "fill_level" "text" CONSTRAINT "home_bar_items_fill_level_check" CHECK ("fill_level" IN ('full', 'half', 'low'));
