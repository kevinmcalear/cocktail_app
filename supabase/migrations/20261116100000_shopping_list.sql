-- The shopping list (design B, picked 25 Oct): what someone means to buy for
-- their home bar, private to them like home_bar_items.
--
-- A row is a catalog or house ingredient (item_id) or something typed
-- ("Limes"), with why it's there: added by hand, for a drink or a home menu
-- (for_item_id is the drink), the bottle that opens the most drinks, a bottle
-- running low, or bought again after finishing it. Ticking it in the shop
-- (got_at) puts it on the shelf; the app does that in the same tap. Clear
-- takes ticked rows off the list (cleared_at) and keeps them for "Bought
-- before". A bottle is on the open list once.

CREATE TABLE "public"."shopping_list_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "item_id" "uuid" REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "name" "text" NOT NULL CHECK ("char_length"("btrim"("name")) BETWEEN 1 AND 120),
    "source" "text" DEFAULT 'hand' NOT NULL CHECK ("source" IN ('hand', 'drink', 'menu', 'one_away', 'running_low', 'again')),
    "for_item_id" "uuid" REFERENCES "public"."items"("id") ON DELETE SET NULL,
    "added_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "got_at" timestamp with time zone,
    "cleared_at" timestamp with time zone,
    CHECK ("cleared_at" IS NULL OR "got_at" IS NOT NULL)
);

CREATE UNIQUE INDEX "shopping_list_items_open_item" ON "public"."shopping_list_items" ("user_id", "item_id") WHERE "cleared_at" IS NULL AND "item_id" IS NOT NULL;
CREATE UNIQUE INDEX "shopping_list_items_open_name" ON "public"."shopping_list_items" ("user_id", "lower"("name")) WHERE "cleared_at" IS NULL AND "item_id" IS NULL;
CREATE INDEX "shopping_list_items_for_item_id" ON "public"."shopping_list_items" ("for_item_id");
CREATE INDEX "shopping_list_items_item_id" ON "public"."shopping_list_items" ("item_id");

ALTER TABLE "public"."shopping_list_items" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shopping_list_items_own" ON "public"."shopping_list_items" FOR ALL TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()))
    WITH CHECK ("user_id" = (SELECT "auth"."uid"()));

REVOKE ALL ON "public"."shopping_list_items" FROM "anon";
