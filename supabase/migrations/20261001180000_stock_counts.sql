-- DRAFT. Local stack only until Kevin's OK.
--
-- Stock counts on the back bar map. Ethyl tracks par, the current count and
-- a stock graph per bottle; we had par per location and no idea what was on
-- the shelf, so the prep list assumed the bar was starting from zero.
--
--   stock_counts        one count of one zone: who, when, a note.
--   stock_count_lines   what was counted at each spot: item, location, amount
--                       and unit (tenths of a bottle, litres, each).
--   stock_on_hand(bar)  the latest line per item and spot, so the prep list
--                       can subtract what's there and bring short items back
--                       to par.
--
-- Counts are the bar's own: members who can see where things live read
-- them (locations), the prep crew writes them (prep). Never public.

CREATE TABLE "public"."stock_counts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "bar_id" "uuid" NOT NULL REFERENCES "public"."bars"("id") ON DELETE CASCADE,
    "zone_id" "uuid" REFERENCES "public"."bar_zones"("id") ON DELETE SET NULL,
    "counted_by" "uuid" DEFAULT "auth"."uid"() REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "counted_by_name" "text",
    "counted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "note" "text" CHECK ("note" IS NULL OR char_length("note") <= 500)
);
CREATE INDEX "stock_counts_bar_id_idx" ON "public"."stock_counts" ("bar_id", "counted_at" DESC);

CREATE TABLE "public"."stock_count_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "count_id" "uuid" NOT NULL REFERENCES "public"."stock_counts"("id") ON DELETE CASCADE,
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "location_id" "uuid" REFERENCES "public"."item_locations"("id") ON DELETE SET NULL,
    "amount" numeric NOT NULL CHECK ("amount" >= 0),
    "unit" "text" NOT NULL CHECK (char_length(btrim("unit")) BETWEEN 1 AND 20)
);
CREATE UNIQUE INDEX "stock_count_lines_key" ON "public"."stock_count_lines" ("count_id", "item_id", "location_id") NULLS NOT DISTINCT;
CREATE INDEX "stock_count_lines_item_id_idx" ON "public"."stock_count_lines" ("item_id");

ALTER TABLE "public"."stock_counts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."stock_count_lines" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_counts_select" ON "public"."stock_counts" FOR SELECT TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."bars_with_capability"('locations')));
CREATE POLICY "stock_counts_write" ON "public"."stock_counts" FOR ALL TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."bars_with_capability"('prep')))
    WITH CHECK ("bar_id" IN (SELECT "private"."bars_with_capability"('prep')) AND "counted_by" = (SELECT "auth"."uid"()));

-- A line follows its count.
CREATE POLICY "stock_count_lines_select" ON "public"."stock_count_lines" FOR SELECT TO "authenticated"
    USING (EXISTS (SELECT 1 FROM "public"."stock_counts" "c" WHERE "c"."id" = "count_id"
                   AND "c"."bar_id" IN (SELECT "private"."bars_with_capability"('locations'))));
CREATE POLICY "stock_count_lines_write" ON "public"."stock_count_lines" FOR ALL TO "authenticated"
    USING (EXISTS (SELECT 1 FROM "public"."stock_counts" "c" WHERE "c"."id" = "count_id"
                   AND "c"."bar_id" IN (SELECT "private"."bars_with_capability"('prep'))))
    WITH CHECK (EXISTS (SELECT 1 FROM "public"."stock_counts" "c" WHERE "c"."id" = "count_id"
                        AND "c"."bar_id" IN (SELECT "private"."bars_with_capability"('prep'))
                        AND "private"."item_usable_at_bar"("item_id", "c"."bar_id")));

CREATE FUNCTION "private"."stock_counts_before_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    NEW.counted_by_name := private.member_display_name(NEW.counted_by);
    RETURN NEW;
END;
$$;
CREATE TRIGGER "stock_counts_before_insert" BEFORE INSERT ON "public"."stock_counts"
    FOR EACH ROW EXECUTE FUNCTION "private"."stock_counts_before_insert"();

-- What's on hand now: the latest line for each item at each spot. Runs as
-- the caller, so the tables' own policies decide who sees it.
CREATE FUNCTION "public"."stock_on_hand"("p_bar" "uuid")
    RETURNS TABLE ("item_id" "uuid", "location_id" "uuid", "amount" numeric, "unit" "text", "counted_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY INVOKER
    SET "search_path" TO ''
    AS $$
  SELECT DISTINCT ON (l.item_id, l.location_id) l.item_id, l.location_id, l.amount, l.unit, c.counted_at
  FROM public.stock_count_lines l
  JOIN public.stock_counts c ON c.id = l.count_id
  WHERE c.bar_id = p_bar
  ORDER BY l.item_id, l.location_id, c.counted_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION "public"."stock_on_hand"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."stock_on_hand"("uuid") TO "authenticated", "service_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."stock_counts", "public"."stock_count_lines" TO "authenticated", "service_role";
