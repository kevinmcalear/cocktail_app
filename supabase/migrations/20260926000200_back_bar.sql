-- DRAFT (schema proposal, docs/schema_proposal.md section 3). Local stack only.
--
-- The back bar map: a venue draws its zones once (shelves, fridges, freezer,
-- speed rail, garnish tray), then gives every ingredient a place, a container
-- description, a photo and a par level. The phone's "Where it lives" card and
-- the web map read the same rows.
--
-- Read: members with the 'locations' capability (Employee and up by default).
-- Draw the plan: Drink Creators and up. Place and restock items: Drink
-- Creators and up, plus anyone whose role grants 'prep' (a barback).

CREATE TYPE "public"."bar_zone_kind" AS ENUM (
    'shelf',
    'fridge',
    'freezer',
    'speed_rail',
    'well',
    'garnish',
    'glass_rack',
    'sink',
    'bar_top',
    'storeroom',
    'other'
);

CREATE TABLE "public"."bar_zones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "bar_id" "uuid" NOT NULL REFERENCES "public"."bars"("id") ON DELETE CASCADE,
    "name" "text" NOT NULL CHECK (char_length(btrim("name")) BETWEEN 1 AND 60),
    "kind" "public"."bar_zone_kind" DEFAULT 'shelf' NOT NULL,
    -- "Under the back bar, second from the left. 4 °C."
    "description" "text" CHECK (char_length("description") <= 500),
    -- ponytail: a plain URL like bars.logo_url and menus.cover_url. Moves onto
    -- the shared photo pipeline if that lands with a non-item photo table.
    "photo_url" "text",
    -- Position on the venue plan as fractions of its width and height, so the
    -- phone and web draw it at any size. NULL until the zone is drawn.
    "plan_x" real,
    "plan_y" real,
    "plan_w" real,
    "plan_h" real,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"() REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    UNIQUE ("id", "bar_id"),
    CONSTRAINT "bar_zones_plan_check" CHECK (
        ("plan_x" IS NULL AND "plan_y" IS NULL AND "plan_w" IS NULL AND "plan_h" IS NULL)
        OR ("plan_x" >= 0 AND "plan_y" >= 0 AND "plan_w" > 0 AND "plan_h" > 0
            AND "plan_x" + "plan_w" <= 1 AND "plan_y" + "plan_h" <= 1)
    )
);

CREATE UNIQUE INDEX "bar_zones_bar_id_name_key" ON "public"."bar_zones" ("bar_id", lower(btrim("name")));

-- One row per place an item lives. An item can live in more than one place
-- (two bottles on the speed rail, six in the storeroom). Items the bar uses
-- with no row here are the ones "waiting for a spot".
CREATE TABLE "public"."item_locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "bar_id" "uuid" NOT NULL REFERENCES "public"."bars"("id") ON DELETE CASCADE,
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "zone_id" "uuid" NOT NULL,
    -- "Top shelf · left"
    "shelf" "text" CHECK (char_length("shelf") <= 60),
    -- "1 L squeeze bottle, blue tape, date on the cap"
    "container" "text" CHECK (char_length("container") <= 200),
    "photo_url" "text",
    -- How much should be at this spot when it's stocked.
    "par_amount" numeric CHECK ("par_amount" > 0),
    "par_unit" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"() REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    FOREIGN KEY ("zone_id", "bar_id") REFERENCES "public"."bar_zones"("id", "bar_id") ON DELETE CASCADE,
    CONSTRAINT "item_locations_par_check" CHECK (("par_amount" IS NULL) = ("par_unit" IS NULL))
);

CREATE INDEX "item_locations_bar_id_item_id_idx" ON "public"."item_locations" ("bar_id", "item_id");
CREATE INDEX "item_locations_zone_id_idx" ON "public"."item_locations" ("zone_id");
CREATE INDEX "item_locations_item_id_idx" ON "public"."item_locations" ("item_id");

-- Whether an item can be stocked at a bar: a shared item, or the bar's own.
-- Reads items as the caller, so the item must also be visible to them.
CREATE FUNCTION "private"."item_usable_at_bar"("p_item_id" "uuid", "p_bar_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.items i
    WHERE i.id = p_item_id AND (i.bar_id IS NULL OR i.bar_id = p_bar_id)
  );
$$;

ALTER TABLE "public"."bar_zones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."item_locations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bar_zones_select" ON "public"."bar_zones" FOR SELECT TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."bars_with_capability"('locations')));
CREATE POLICY "bar_zones_insert" ON "public"."bar_zones" FOR INSERT TO "authenticated"
    WITH CHECK ("bar_id" IN (SELECT "private"."my_bar_ids"(35)));
CREATE POLICY "bar_zones_update" ON "public"."bar_zones" FOR UPDATE TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."my_bar_ids"(35)))
    WITH CHECK ("bar_id" IN (SELECT "private"."my_bar_ids"(35)));
CREATE POLICY "bar_zones_delete" ON "public"."bar_zones" FOR DELETE TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."my_bar_ids"(35)));

CREATE POLICY "item_locations_select" ON "public"."item_locations" FOR SELECT TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."bars_with_capability"('locations')));
CREATE POLICY "item_locations_insert" ON "public"."item_locations" FOR INSERT TO "authenticated"
    WITH CHECK (
        ("bar_id" IN (SELECT "private"."my_bar_ids"(35)) OR "bar_id" IN (SELECT "private"."bars_with_capability"('prep')))
        AND "private"."item_usable_at_bar"("item_id", "bar_id")
    );
CREATE POLICY "item_locations_update" ON "public"."item_locations" FOR UPDATE TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."my_bar_ids"(35)) OR "bar_id" IN (SELECT "private"."bars_with_capability"('prep')))
    WITH CHECK (
        ("bar_id" IN (SELECT "private"."my_bar_ids"(35)) OR "bar_id" IN (SELECT "private"."bars_with_capability"('prep')))
        AND "private"."item_usable_at_bar"("item_id", "bar_id")
    );
CREATE POLICY "item_locations_delete" ON "public"."item_locations" FOR DELETE TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."my_bar_ids"(35)) OR "bar_id" IN (SELECT "private"."bars_with_capability"('prep')));

REVOKE EXECUTE ON FUNCTION "private"."item_usable_at_bar"("p_item_id" "uuid", "p_bar_id" "uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."item_usable_at_bar"("p_item_id" "uuid", "p_bar_id" "uuid") TO "authenticated", "service_role";
