-- Kit and Buying, in a venue's settings (decided 14 Oct 2026; canvas
-- "Cocktail: the whole app", Venue tools, Kit and Buying):
--
--   * bar_kit             the ice a venue pours and the tools it has, each made
--                         here or from one of its suppliers. Its team reads it;
--                         anyone with Prep changes it.
--   * suppliers           what each brings, when to order by and when it
--                         delivers. Still private to Prep and Costs.
--   * bar_glassware       anyone with Prep changes the venue's glasses now
--                         (it was Brand), since Glassware sits in Kit.
--
-- No supplier rep contact details, by decision.

-- --- The venue's kit: ice and tools ---

CREATE TABLE "public"."bar_kit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "bar_id" "uuid" NOT NULL REFERENCES "public"."bars"("id") ON DELETE CASCADE,
    "kind" "text" NOT NULL CHECK ("kind" IN ('ice', 'tool')),
    -- Ice: a kind the drawings know (supabase/functions/_shared/sketchRules.ts
    -- ICES, less 'none'). Tool: an id from lib/techniques/equipment.ts, as in
    -- home_kit_items.
    "key" "text" NOT NULL,
    -- "Hoshizaki under the well", "50 mm clear cubes".
    "note" "text" CHECK ("note" IS NULL OR char_length(btrim("note")) BETWEEN 1 AND 120),
    "made_here" boolean DEFAULT false NOT NULL,
    "supplier_id" "uuid",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    UNIQUE ("bar_id", "kind", "key"),
    FOREIGN KEY ("supplier_id", "bar_id") REFERENCES "public"."suppliers"("id", "bar_id") ON DELETE SET NULL ("supplier_id"),
    CONSTRAINT "bar_kit_key_check" CHECK (
        ("kind" = 'ice' AND "key" IN ('cubes', 'large', 'spear', 'crushed', 'pebble', 'shaved', 'sphere'))
        OR ("kind" = 'tool' AND "key" ~ '^[a-z0-9-]{1,40}$')
    ),
    -- Made here, or brought by a supplier, or not said; never both.
    CONSTRAINT "bar_kit_source_check" CHECK (NOT ("made_here" AND "supplier_id" IS NOT NULL))
);

CREATE INDEX "bar_kit_supplier_id_idx" ON "public"."bar_kit" ("supplier_id") WHERE "supplier_id" IS NOT NULL;

COMMENT ON TABLE "public"."bar_kit" IS
    'A venue''s ice and tools (Kit in venue settings). Its team reads it; anyone with the prep capability writes it.';

ALTER TABLE "public"."bar_kit" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bar_kit_select" ON "public"."bar_kit" FOR SELECT TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."my_bar_ids"(0)) OR "private"."is_app_admin"());
CREATE POLICY "bar_kit_write" ON "public"."bar_kit" FOR ALL TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."bars_with_capability"('prep')) OR "private"."is_app_admin"())
    WITH CHECK ("bar_id" IN (SELECT "private"."bars_with_capability"('prep')) OR "private"."is_app_admin"());

REVOKE ALL ON "public"."bar_kit" FROM PUBLIC, "anon";
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."bar_kit" TO "authenticated", "service_role";

CREATE FUNCTION "private"."touch_bar_kit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER "touch_bar_kit" BEFORE UPDATE ON "public"."bar_kit"
    FOR EACH ROW EXECUTE FUNCTION "private"."touch_bar_kit"();

-- --- Suppliers: what they bring, order by, delivers ---

ALTER TABLE "public"."suppliers"
    ADD COLUMN "supplies" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    ADD COLUMN "order_by" "text",
    ADD COLUMN "delivers" "text",
    -- The same list as a supplier page's (profiles.supplies).
    ADD CONSTRAINT "suppliers_supplies_known" CHECK (
        "supplies" <@ ARRAY['bottles', 'ice', 'produce', 'garnish', 'glassware', 'barware', 'equipment']::"text"[]
    ),
    ADD CONSTRAINT "suppliers_order_by_check" CHECK ("order_by" IS NULL OR char_length(btrim("order_by")) BETWEEN 1 AND 60),
    ADD CONSTRAINT "suppliers_delivers_check" CHECK ("delivers" IS NULL OR char_length(btrim("delivers")) BETWEEN 1 AND 60);

COMMENT ON COLUMN "public"."suppliers"."supplies" IS 'What the venue gets from them: bottles, ice, produce, garnish, glassware, barware, equipment.';
COMMENT ON COLUMN "public"."suppliers"."order_by" IS 'When to order by, as the venue writes it: "Tue 2 pm".';
COMMENT ON COLUMN "public"."suppliers"."delivers" IS 'When they deliver, as the venue writes it: "Wed and Fri".';
COMMENT ON COLUMN "public"."suppliers"."order_notes" IS 'How to order: account, portal, where deliveries go.';

-- --- Glassware: Prep edits it now ---

CREATE OR REPLACE FUNCTION "private"."can_edit_bar_glassware"("p_profile_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT private.is_app_admin()
      OR EXISTS (SELECT 1 FROM public.profiles p
                 WHERE p.id = p_profile_id AND p.bar_id IN (SELECT private.bars_with_capability('prep')));
$$;
