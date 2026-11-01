-- Living lists: a bartender's asks, the team's notices and Off tonight
-- (2027 canvas, Menu-l-ask, Menu-l-swap, Menu-l-swapped, Menu-l-swap-sheet).
--
-- Three new tables. Nothing here changes menu_drinks, its trigger, its
-- policies or swap_menu_drink: an ask becomes a menu row only when the menu
-- team puts it on with the calls they already have, and then deletes the ask.
--
-- menu_drink_asks: a drink someone on the team wants on a list, or in place of
--   one on it. While asked_at is empty it is a draft only its writer reads
--   ("Only you see this"); Ask sets asked_at and the menu team see it
--   ("Waiting for you"). The writer edits, asks and withdraws their own; the
--   menu team turn it down or approve it (delete).
-- menu_list_notices: Tell the team. One row per change (on, off, swap, off
--   tonight, back), read by everyone who reads the list, written by whoever
--   made the change. Never edited.
-- menu_off_tonight: a drink pulled for tonight's service only. Not a change
--   to the list or its runs; `until` is the bar's close, after which the row
--   no longer counts. The menu team set and clear it here.
--
-- Every policy reads the list through public.menus' own row security (or
-- private.can_edit_menu), so nobody sees or writes more than the list they
-- can already see. Nothing for anon.

-- --- asks ---

CREATE TABLE "public"."menu_drink_asks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "menu_id" "uuid" NOT NULL REFERENCES "public"."menus"("id") ON DELETE CASCADE,
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "menu_section_id" "uuid" REFERENCES "public"."menu_sections"("id") ON DELETE SET NULL,
    "replaces_item_id" "uuid" REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "price" "text",
    "note" "text",
    "asked_at" timestamp with time zone,
    "created_by" "uuid" DEFAULT "auth"."uid"() NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "menu_drink_asks_price_check" CHECK ("price" IS NULL OR char_length("price") <= 20),
    CONSTRAINT "menu_drink_asks_note_check" CHECK ("note" IS NULL OR char_length("note") <= 280),
    CONSTRAINT "menu_drink_asks_not_itself" CHECK ("replaces_item_id" IS NULL OR "replaces_item_id" <> "item_id")
);

CREATE INDEX "menu_drink_asks_menu_idx" ON "public"."menu_drink_asks" ("menu_id");
CREATE INDEX "menu_drink_asks_created_by_idx" ON "public"."menu_drink_asks" ("created_by");
CREATE INDEX "menu_drink_asks_item_idx" ON "public"."menu_drink_asks" ("item_id");
CREATE INDEX "menu_drink_asks_replaces_idx" ON "public"."menu_drink_asks" ("replaces_item_id");
CREATE INDEX "menu_drink_asks_section_idx" ON "public"."menu_drink_asks" ("menu_section_id");

ALTER TABLE "public"."menu_drink_asks" ENABLE ROW LEVEL SECURITY;

-- A draft is its writer's alone; an ask is theirs and the menu team's.
CREATE POLICY "menu_drink_asks_select" ON "public"."menu_drink_asks" FOR SELECT TO "authenticated"
    USING ("created_by" = (SELECT "auth"."uid"()) OR ("asked_at" IS NOT NULL AND "private"."can_edit_menu"("menu_id")));
-- Anyone who reads the list may write their own, as a draft or asked now.
CREATE POLICY "menu_drink_asks_insert" ON "public"."menu_drink_asks" FOR INSERT TO "authenticated"
    WITH CHECK (
      "created_by" = (SELECT "auth"."uid"())
      AND "menu_id" IN (SELECT "menus"."id" FROM "public"."menus")
      AND ("asked_at" IS NULL OR "asked_at" <= "now"() + interval '1 minute')
    );
CREATE POLICY "menu_drink_asks_update" ON "public"."menu_drink_asks" FOR UPDATE TO "authenticated"
    USING ("created_by" = (SELECT "auth"."uid"()))
    WITH CHECK (
      "created_by" = (SELECT "auth"."uid"())
      AND "menu_id" IN (SELECT "menus"."id" FROM "public"."menus")
      AND ("asked_at" IS NULL OR "asked_at" <= "now"() + interval '1 minute')
    );
-- Withdraw (the writer), or turned down or approved (the menu team).
CREATE POLICY "menu_drink_asks_delete" ON "public"."menu_drink_asks" FOR DELETE TO "authenticated"
    USING ("created_by" = (SELECT "auth"."uid"()) OR ("asked_at" IS NOT NULL AND "private"."can_edit_menu"("menu_id")));

REVOKE ALL ON "public"."menu_drink_asks" FROM PUBLIC, "anon", "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."menu_drink_asks" TO "authenticated";

-- --- notices ---

CREATE TABLE "public"."menu_list_notices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "menu_id" "uuid" NOT NULL REFERENCES "public"."menus"("id") ON DELETE CASCADE,
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "kind" "text" NOT NULL,
    "to_item_id" "uuid" REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "told_by" "uuid" DEFAULT "auth"."uid"() NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "menu_list_notices_kind_check" CHECK ("kind" IN ('on', 'off', 'swap', 'off_tonight', 'back')),
    CONSTRAINT "menu_list_notices_swap_check" CHECK (("kind" = 'swap') = ("to_item_id" IS NOT NULL))
);

CREATE INDEX "menu_list_notices_menu_at_idx" ON "public"."menu_list_notices" ("menu_id", "at" DESC);
CREATE INDEX "menu_list_notices_item_idx" ON "public"."menu_list_notices" ("item_id");
CREATE INDEX "menu_list_notices_to_item_idx" ON "public"."menu_list_notices" ("to_item_id");
CREATE INDEX "menu_list_notices_told_by_idx" ON "public"."menu_list_notices" ("told_by");

ALTER TABLE "public"."menu_list_notices" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menu_list_notices_select" ON "public"."menu_list_notices" FOR SELECT TO "authenticated"
    USING ("menu_id" IN (SELECT "menus"."id" FROM "public"."menus"));
CREATE POLICY "menu_list_notices_insert" ON "public"."menu_list_notices" FOR INSERT TO "authenticated"
    WITH CHECK (
      "told_by" = (SELECT "auth"."uid"())
      AND "menu_id" IN (SELECT "menus"."id" FROM "public"."menus")
      AND "at" <= "now"() + interval '1 minute'
    );

REVOKE ALL ON "public"."menu_list_notices" FROM PUBLIC, "anon", "authenticated";
GRANT SELECT, INSERT ON "public"."menu_list_notices" TO "authenticated";

-- --- off tonight ---

CREATE TABLE "public"."menu_off_tonight" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "menu_id" "uuid" NOT NULL REFERENCES "public"."menus"("id") ON DELETE CASCADE,
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "until" timestamp with time zone NOT NULL,
    "set_by" "uuid" DEFAULT "auth"."uid"() NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "menu_off_tonight_once" UNIQUE ("menu_id", "item_id", "until")
);

CREATE INDEX "menu_off_tonight_menu_until_idx" ON "public"."menu_off_tonight" ("menu_id", "until");
CREATE INDEX "menu_off_tonight_item_idx" ON "public"."menu_off_tonight" ("item_id");
CREATE INDEX "menu_off_tonight_set_by_idx" ON "public"."menu_off_tonight" ("set_by");

ALTER TABLE "public"."menu_off_tonight" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menu_off_tonight_select" ON "public"."menu_off_tonight" FOR SELECT TO "authenticated"
    USING ("menu_id" IN (SELECT "menus"."id" FROM "public"."menus"));
-- Tonight only: until the bar's close, never more than a day and a half ahead.
CREATE POLICY "menu_off_tonight_insert" ON "public"."menu_off_tonight" FOR INSERT TO "authenticated"
    WITH CHECK (
      "set_by" = (SELECT "auth"."uid"())
      AND "private"."can_edit_menu"("menu_id")
      AND "until" > "now"()
      AND "until" <= "now"() + interval '36 hours'
    );
CREATE POLICY "menu_off_tonight_delete" ON "public"."menu_off_tonight" FOR DELETE TO "authenticated"
    USING ("private"."can_edit_menu"("menu_id"));

REVOKE ALL ON "public"."menu_off_tonight" FROM PUBLIC, "anon", "authenticated";
GRANT SELECT, INSERT, DELETE ON "public"."menu_off_tonight" TO "authenticated";
