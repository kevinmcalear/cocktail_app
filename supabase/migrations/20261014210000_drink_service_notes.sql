-- DRAFT. Local stack only until Kevin's OK (decision b24, 10 Oct 2026).
--
-- What the floor needs on a shift, per venue drink: how the garnish goes on,
-- the hand-off in steps, and the talking points ("Talking point", "Sell it
-- as"). Dietary is read from the spec in the app (decision b52), so it has no
-- column here.
--
--   item_service_notes  one row per venue drink. Read with the talking_points
--                       capability (Employee and up by default, the same rule
--                       as team notes and allergens), so guests and outsiders
--                       never see it. Written by whoever may edit the drink.
--                       Never public: published_items doesn't read it.

CREATE TABLE "public"."item_service_notes" (
    "item_id" "uuid" PRIMARY KEY REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "bar_id" "uuid" NOT NULL REFERENCES "public"."bars"("id") ON DELETE CASCADE,
    -- "Candied ginger on a pick, laid across the rim."
    "garnish" "text" CHECK ("garnish" IS NULL OR char_length("garnish") <= 500),
    -- "Coaster down first, logo facing the guest", one step per entry.
    "handoff" "text"[] DEFAULT '{}' NOT NULL
        CHECK (cardinality("handoff") <= 8 AND char_length(array_to_string("handoff", '')) <= 1200),
    "talking_point" "text" CHECK ("talking_point" IS NULL OR char_length("talking_point") <= 1000),
    "sell_it_as" "text" CHECK ("sell_it_as" IS NULL OR char_length("sell_it_as") <= 300),
    "updated_by" "uuid" DEFAULT "auth"."uid"() REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
CREATE INDEX "item_service_notes_bar_id_idx" ON "public"."item_service_notes" ("bar_id");

ALTER TABLE "public"."item_service_notes" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "item_service_notes_select" ON "public"."item_service_notes" FOR SELECT TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."bars_with_capability"('talking_points')));

-- The drink must be this bar's, and the writer must be able to edit it.
CREATE POLICY "item_service_notes_insert" ON "public"."item_service_notes" FOR INSERT TO "authenticated"
    WITH CHECK (
        "private"."can_edit_item"("item_id")
        AND EXISTS (SELECT 1 FROM "public"."items" "i" WHERE "i"."id" = "item_id" AND "i"."bar_id" = "item_service_notes"."bar_id")
    );
CREATE POLICY "item_service_notes_update" ON "public"."item_service_notes" FOR UPDATE TO "authenticated"
    USING ("private"."can_edit_item"("item_id"))
    WITH CHECK (
        "private"."can_edit_item"("item_id")
        AND EXISTS (SELECT 1 FROM "public"."items" "i" WHERE "i"."id" = "item_id" AND "i"."bar_id" = "item_service_notes"."bar_id")
    );
CREATE POLICY "item_service_notes_delete" ON "public"."item_service_notes" FOR DELETE TO "authenticated"
    USING ("private"."can_edit_item"("item_id"));

-- Who and when, from the server, whatever the client sends.
CREATE FUNCTION "private"."item_service_notes_stamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER "item_service_notes_stamp" BEFORE INSERT OR UPDATE ON "public"."item_service_notes"
    FOR EACH ROW EXECUTE FUNCTION "private"."item_service_notes_stamp"();

REVOKE ALL ON "public"."item_service_notes" FROM "anon";
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."item_service_notes" TO "authenticated";
GRANT ALL ON "public"."item_service_notes" TO "service_role";
REVOKE EXECUTE ON FUNCTION "private"."item_service_notes_stamp"() FROM PUBLIC, "anon";
