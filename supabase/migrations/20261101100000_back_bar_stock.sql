-- DRAFT. Local stack only until Kevin's OK.
--
-- The back bar's stock list: what a venue says it stocks, apart from where
-- each bottle lives. Until now a bottle counted as on the back bar only when
-- the bar made it, a spec poured it or it had a spot on the map, and a spot
-- needs a zone (item_locations.zone_id is required). So "we stock this" had
-- nowhere to go on its own (Eddie, 22 Oct: the bottle on the line, board
-- fix 12). Fix 13's "take it off the back bar" and fix 15's brands step read
-- and write the same list.
--
--   back_bar_items   one row per item a venue stocks: who added it, when,
--                    and where from ('drink' with the drink's name, 'setup',
--                    'back_bar').
--
-- Members of the venue read it (the line shows everyone the state). Adding
-- and removing goes with placing items on the map: Create and edit drinks,
-- or Prep list and orders. Both checks go through
-- private.bars_with_capability, so they follow a role's permissions as the
-- Roles screen sets them, not a fixed level. Never public.

CREATE TABLE "public"."back_bar_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "bar_id" "uuid" NOT NULL REFERENCES "public"."bars"("id") ON DELETE CASCADE,
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "source" "text" NOT NULL CHECK ("source" IN ('drink', 'setup', 'back_bar')),
    -- The drink it was added from, as it was named then: a drink being added
    -- has no id until it's saved. ponytail: a name, not a link; add a
    -- from_drink_id if the waiting list ever needs to open that drink.
    "from_name" "text" CHECK (char_length("from_name") <= 200),
    "added_by" "uuid" DEFAULT "auth"."uid"() REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "added_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    UNIQUE ("bar_id", "item_id")
);
CREATE INDEX "back_bar_items_item_id_idx" ON "public"."back_bar_items" ("item_id");
CREATE INDEX "back_bar_items_added_by_idx" ON "public"."back_bar_items" ("added_by");

ALTER TABLE "public"."back_bar_items" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "back_bar_items_select" ON "public"."back_bar_items" FOR SELECT TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."my_bar_ids"(0)));
CREATE POLICY "back_bar_items_insert" ON "public"."back_bar_items" FOR INSERT TO "authenticated"
    WITH CHECK (
        ("bar_id" IN (SELECT "private"."bars_with_capability"('edit_drinks')) OR "bar_id" IN (SELECT "private"."bars_with_capability"('prep')))
        AND "private"."item_usable_at_bar"("item_id", "bar_id")
        AND "added_by" = (SELECT "auth"."uid"())
    );
CREATE POLICY "back_bar_items_delete" ON "public"."back_bar_items" FOR DELETE TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."bars_with_capability"('edit_drinks')) OR "bar_id" IN (SELECT "private"."bars_with_capability"('prep')));

-- No updates: a bottle is on the list or it isn't.
REVOKE ALL ON "public"."back_bar_items" FROM PUBLIC, "anon", "authenticated";
GRANT SELECT, INSERT, DELETE ON "public"."back_bar_items" TO "authenticated";
GRANT ALL ON "public"."back_bar_items" TO "service_role";
