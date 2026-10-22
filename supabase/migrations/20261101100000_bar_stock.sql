-- What a venue stocks (22 Oct 2026, Eddie; board eddie-oct22-wave2, fix 12
-- "Put a bottle on the back bar from the line"). Until now the app counted a
-- bottle as on the back bar if the bar made it, a spec poured it or it had a
-- spot on the map, so there was no way to say "we stock this" on its own, and
-- a spot needs a zone. This is that list: one row per bottle the bar has,
-- whether or not it has a spot yet.
--
--   on the back bar   = a row here, or a spot in item_locations
--   waiting for a spot = a row here (or a bottle the menus pour) with no spot
--
-- Rows come from the bottle on a spec line (tap to put it on, tap again to
-- take it off). Placing a bottle on the plan doesn't need a row here: the
-- spot already says it's on the back bar.
--
-- Read: the venue's staff (Employee and up). Add and take off: whoever can
-- place items on the back bar, the same rule as item_locations (Drink
-- Creators and up, plus roles that grant 'prep').

CREATE TABLE "public"."bar_stock" (
    "bar_id" "uuid" NOT NULL REFERENCES "public"."bars"("id") ON DELETE CASCADE,
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    -- The drink it was added from, by name, for "Added from Ash Garden" on
    -- the back bar. A name, not a link: the drink may not be saved yet.
    "added_from" "text" CHECK (char_length("added_from") <= 120),
    "added_by" "uuid" DEFAULT "auth"."uid"() REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "added_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    PRIMARY KEY ("bar_id", "item_id")
);

CREATE INDEX "bar_stock_item_id_idx" ON "public"."bar_stock" ("item_id");

COMMENT ON TABLE "public"."bar_stock" IS
    'Bottles a venue stocks, with or without a spot on its back bar plan. A spot in item_locations also counts as stocked.';

ALTER TABLE "public"."bar_stock" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bar_stock_select" ON "public"."bar_stock" FOR SELECT TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."my_bar_ids"(20)));
-- added_by is always the person adding it, so the back bar never shows a
-- bottle as added by someone who didn't.
CREATE POLICY "bar_stock_insert" ON "public"."bar_stock" FOR INSERT TO "authenticated"
    WITH CHECK (
        ("bar_id" IN (SELECT "private"."my_bar_ids"(35)) OR "bar_id" IN (SELECT "private"."bars_with_capability"('prep')))
        AND "added_by" = "auth"."uid"()
        AND "private"."item_usable_at_bar"("item_id", "bar_id")
    );
CREATE POLICY "bar_stock_delete" ON "public"."bar_stock" FOR DELETE TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."my_bar_ids"(35)) OR "bar_id" IN (SELECT "private"."bars_with_capability"('prep')));

-- No UPDATE: a row is there or it isn't. Anon reads nothing.
REVOKE ALL ON TABLE "public"."bar_stock" FROM "anon";
REVOKE UPDATE ON TABLE "public"."bar_stock" FROM "authenticated";
