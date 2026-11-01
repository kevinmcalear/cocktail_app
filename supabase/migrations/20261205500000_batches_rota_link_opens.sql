-- Batches, the rota and link opens: the data Tonight's boards draw (GWBCX,
-- Prod-today-staff) and the house-made page's Log batch (Item-page).
--
--   * batch_logs: a batch of house-made someone made (item, amount, unit,
--     when, who, optionally where it went on the back bar map). What's on
--     hand is the last count plus the batches logged since (lib/stock.ts),
--     so "200 ml left" and "1.2 L, enough for tonight" are real. Written by
--     anyone who makes the drinks (Specs: bartenders up; the board gives a
--     bartender Log batch), their own rows only; ids are made on the phone,
--     so a batch logged with no signal sends later without doubling. Read
--     with Specs or Locations, like stock counts.
--   * shifts: the rota. Who works when, and who opens and closes ("Ana, Theo
--     and you · Theo opens · you close"). Everyone at the bar reads it; people
--     with Staff (who run My team) write it.
--   * share opens: each time a shared drink or menu link is opened, through
--     record_share_open(kind, key) (definer; no table grants to anon or
--     authenticated). bar_share_opens(bar, since) counts a bar's for its own
--     people with Menus ("Shared links this week").

-- --- 1. Batches ---

CREATE TABLE "public"."batch_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "bar_id" "uuid" NOT NULL REFERENCES "public"."bars"("id") ON DELETE CASCADE,
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "amount" numeric NOT NULL CHECK ("amount" > 0),
    "unit" "text" NOT NULL CHECK (length("unit") BETWEEN 1 AND 20),
    "made_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "made_by" "uuid" DEFAULT "auth"."uid"() REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "location_id" "uuid" REFERENCES "public"."item_locations"("id") ON DELETE SET NULL,
    "note" "text" CHECK (length("note") <= 500),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

COMMENT ON TABLE "public"."batch_logs" IS
    'A batch of house-made made at a bar. On hand = the last count plus batches since (lib/stock.ts).';

CREATE INDEX "batch_logs_bar_made" ON "public"."batch_logs" ("bar_id", "made_at" DESC);
CREATE INDEX "batch_logs_item" ON "public"."batch_logs" ("item_id");

ALTER TABLE "public"."batch_logs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "batch_logs_select" ON "public"."batch_logs" FOR SELECT TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."bars_with_capability"('specs'))
        OR "bar_id" IN (SELECT "private"."bars_with_capability"('locations')));
CREATE POLICY "batch_logs_insert" ON "public"."batch_logs" FOR INSERT TO "authenticated"
    WITH CHECK ("bar_id" IN (SELECT "private"."bars_with_capability"('specs')) AND "made_by" = (SELECT "auth"."uid"()));
CREATE POLICY "batch_logs_update" ON "public"."batch_logs" FOR UPDATE TO "authenticated"
    USING ("made_by" = (SELECT "auth"."uid"()) AND "bar_id" IN (SELECT "private"."bars_with_capability"('specs')))
    WITH CHECK ("made_by" = (SELECT "auth"."uid"()) AND "bar_id" IN (SELECT "private"."bars_with_capability"('specs')));
CREATE POLICY "batch_logs_delete" ON "public"."batch_logs" FOR DELETE TO "authenticated"
    USING ("made_by" = (SELECT "auth"."uid"()) AND "bar_id" IN (SELECT "private"."bars_with_capability"('specs')));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."batch_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."batch_logs" TO "service_role";

-- --- 2. The rota ---

CREATE TABLE "public"."shifts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "bar_id" "uuid" NOT NULL REFERENCES "public"."bars"("id") ON DELETE CASCADE,
    "user_id" "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "opens" boolean DEFAULT false NOT NULL,
    "closes" boolean DEFAULT false NOT NULL,
    "note" "text" CHECK (length("note") <= 200),
    "created_by" "uuid" DEFAULT "auth"."uid"() REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CHECK ("ends_at" > "starts_at")
);

COMMENT ON TABLE "public"."shifts" IS
    'The rota: who works at a bar when, and who opens and closes. The bar reads it; people with Staff write it.';

CREATE INDEX "shifts_bar_starts" ON "public"."shifts" ("bar_id", "starts_at");
CREATE INDEX "shifts_user" ON "public"."shifts" ("user_id");

ALTER TABLE "public"."shifts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shifts_select" ON "public"."shifts" FOR SELECT TO "authenticated"
    USING ("bar_id" IN (SELECT "ub"."bar_id" FROM "public"."user_bars" "ub" WHERE "ub"."user_id" = (SELECT "auth"."uid"())));
CREATE POLICY "shifts_write" ON "public"."shifts" FOR ALL TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."bars_with_capability"('staff')))
    -- Only people who work there go on its rota.
    WITH CHECK ("bar_id" IN (SELECT "private"."bars_with_capability"('staff'))
        AND EXISTS (SELECT 1 FROM "public"."user_bars" "ub" WHERE "ub"."bar_id" = "shifts"."bar_id" AND "ub"."user_id" = "shifts"."user_id"));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."shifts" TO "authenticated";
GRANT ALL ON TABLE "public"."shifts" TO "service_role";

-- --- 3. Link opens ---

CREATE TABLE "private"."share_opens" (
    "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "kind" "text" NOT NULL CHECK ("kind" IN ('d', 'm')),
    "target_id" "uuid" NOT NULL,
    "bar_id" "uuid" REFERENCES "public"."bars"("id") ON DELETE CASCADE,
    "opened_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE INDEX "share_opens_bar_opened" ON "private"."share_opens" ("bar_id", "opened_at" DESC);

ALTER TABLE "private"."share_opens" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "private"."share_opens" FROM PUBLIC, "anon", "authenticated";
GRANT ALL ON TABLE "private"."share_opens" TO "service_role";

-- Someone opened a shared link: a slug or an id, for a drink ('d') or a menu
-- ('m') that is public (share_target_is_public). Anything else is ignored.
-- The app calls it once per link per session (hooks/useShareSlug.ts).
CREATE FUNCTION "public"."record_share_open"("p_kind" "text", "p_key" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_id uuid;
    v_bar uuid;
BEGIN
    IF p_kind NOT IN ('d', 'm') OR p_key IS NULL OR length(p_key) > 100 THEN
        RETURN;
    END IF;
    IF p_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        v_id := p_key::uuid;
    ELSE
        SELECT coalesce(s.item_id, s.menu_id) INTO v_id FROM private.share_slugs s WHERE s.kind = p_kind AND s.slug = lower(p_key);
    END IF;
    IF v_id IS NULL OR NOT private.share_target_is_public(p_kind, v_id) THEN
        RETURN;
    END IF;
    IF p_kind = 'd' THEN
        SELECT i.bar_id INTO v_bar FROM public.items i WHERE i.id = v_id;
    ELSE
        SELECT m.bar_id INTO v_bar FROM public.menus m WHERE m.id = v_id;
    END IF;
    INSERT INTO private.share_opens ("kind", "target_id", "bar_id") VALUES (p_kind, v_id, v_bar);
END;
$$;

REVOKE ALL ON FUNCTION "public"."record_share_open"("text", "text") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."record_share_open"("text", "text") TO "anon", "authenticated", "service_role";

-- How many times a bar's shared links were opened since a time. Its own people with Menus only.
CREATE FUNCTION "public"."bar_share_opens"("p_bar" "uuid", "p_since" timestamp with time zone) RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT CASE WHEN p_bar IN (SELECT private.bars_with_capability('menus'))
    THEN (SELECT count(*)::integer FROM private.share_opens o WHERE o.bar_id = p_bar AND o.opened_at >= p_since)
  END;
$$;

REVOKE ALL ON FUNCTION "public"."bar_share_opens"("uuid", timestamp with time zone) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."bar_share_opens"("uuid", timestamp with time zone) TO "authenticated", "service_role";
