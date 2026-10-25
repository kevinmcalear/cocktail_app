-- My Bar's glassware and ice (Kit and ice, step 13): the glasses and the ice
-- someone has at home, optional, private to them like home_kit_items. The
-- same facts a venue keeps (bar_glassware, item_ice), less suppliers: at home
-- a glass or an ice is bought from a shop, already ours, from our machine, or
-- made here. A home glass of a type is the one its drinks are drawn in when
-- it's the main one (is_default, one per type).

CREATE TABLE "public"."home_glassware" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "glass" "text" NOT NULL CHECK ("glass" = ANY (ARRAY['coupe', 'nick', 'martini', 'rocks', 'highball', 'collins', 'fizz', 'flute', 'wine', 'spritz', 'snifter', 'julep', 'tiki', 'mug', 'ceramic', 'beer'])),
    "variant" "text" CHECK ("variant" IS NULL OR "private"."valid_glass_variant"("glass", "variant")),
    "name" "text" CHECK ("name" IS NULL OR char_length(btrim("name")) BETWEEN 1 AND 80),
    -- The real glass, from the makers' catalogs.
    "model_id" "uuid" REFERENCES "public"."glass_models"("id") ON DELETE SET NULL,
    "source" "text" CHECK ("source" IN ('bought', 'ours')),
    "count" integer CHECK ("count" BETWEEN 1 AND 9999),
    "is_default" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE INDEX "home_glassware_user_id_idx" ON "public"."home_glassware" ("user_id");
CREATE UNIQUE INDEX "home_glassware_one_main_idx" ON "public"."home_glassware" ("user_id", "glass") WHERE "is_default";

ALTER TABLE "public"."home_glassware" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "home_glassware_own" ON "public"."home_glassware" FOR ALL TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()))
    WITH CHECK ("user_id" = (SELECT "auth"."uid"()));

REVOKE ALL ON "public"."home_glassware" FROM PUBLIC, "anon";
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."home_glassware" TO "authenticated";
GRANT ALL ON "public"."home_glassware" TO "service_role";

CREATE TABLE "public"."home_ice" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "name" "text" NOT NULL CHECK (char_length(btrim("name")) BETWEEN 1 AND 80),
    -- As item_ice.shape: the drawings' kinds, cut to size, something else, and the block and slab to cut from.
    "shape" "text" NOT NULL CHECK ("shape" IN ('cubes', 'large', 'spear', 'sphere', 'cut', 'crushed', 'pebble', 'shaved', 'other', 'block', 'slab')),
    "draw_as" "text" CHECK ("draw_as" IN ('cubes', 'large', 'spear', 'crushed', 'pebble', 'shaved', 'sphere')),
    "size_mm" integer CHECK ("size_mm" BETWEEN 5 AND 2000),
    "length_mm" integer CHECK ("length_mm" BETWEEN 5 AND 2000),
    -- Null is not sure.
    "clear" boolean,
    "stamped" boolean DEFAULT false NOT NULL,
    "frozen_inside" "text" CHECK ("frozen_inside" IS NULL OR char_length(btrim("frozen_inside")) BETWEEN 1 AND 60),
    -- Bought (from a shop), our machine (a Klaris, the freezer's ice maker) or made here; null is not said.
    "source" "text" CHECK ("source" IN ('bought', 'machine', 'made')),
    "machine" "text" CHECK ("machine" IS NULL OR char_length(btrim("machine")) BETWEEN 1 AND 60),
    "note" "text" CHECK ("note" IS NULL OR char_length(btrim("note")) BETWEEN 1 AND 120),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "home_ice_draw_as_cut_or_other" CHECK ("draw_as" IS NULL OR "shape" IN ('cut', 'other')),
    CONSTRAINT "home_ice_machine_when_machine" CHECK ("machine" IS NULL OR "source" = 'machine')
);

CREATE INDEX "home_ice_user_id_idx" ON "public"."home_ice" ("user_id");

ALTER TABLE "public"."home_ice" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "home_ice_own" ON "public"."home_ice" FOR ALL TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()))
    WITH CHECK ("user_id" = (SELECT "auth"."uid"()));

REVOKE ALL ON "public"."home_ice" FROM PUBLIC, "anon";
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."home_ice" TO "authenticated";
GRANT ALL ON "public"."home_ice" TO "service_role";
