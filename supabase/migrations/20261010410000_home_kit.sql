-- My Bar's Kit, on the person's account instead of one device.
--
-- The equipment someone has (a fine scale, an iSi whipper) lived in the
-- app's local storage (store/useKitStore.ts), so it didn't follow them to
-- another phone or the web, and My Bar's Projects couldn't count on it.
-- Equipment is the technique library's built-in list (lib/techniques/
-- equipment.ts), not catalog items, so rows hold its short ids. Private to
-- the owner, like home_bar_items.

CREATE TABLE "public"."home_kit_items" (
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "equipment_id" "text" NOT NULL CHECK ("equipment_id" ~ '^[a-z0-9-]{1,40}$'),
    "added_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    PRIMARY KEY ("user_id", "equipment_id")
);

ALTER TABLE "public"."home_kit_items" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "home_kit_items_own" ON "public"."home_kit_items" FOR ALL TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()))
    WITH CHECK ("user_id" = (SELECT "auth"."uid"()));

REVOKE ALL ON "public"."home_kit_items" FROM "anon";
