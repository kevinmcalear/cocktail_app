-- The handover note (canvas Loop-handover, decided 1 Nov 2026: one note per
-- close). Whoever closes leaves a note for whoever opens next: what ran out,
-- what to prep, anything broken. A second closer adds to it. The note sits on
-- top of Tonight until each person has read it.
--
--   * handover_notes: one row per person per close (the bar, the service day
--     it closes, the person). A closer's row holds what they wrote; anyone's
--     row says when they read that close's note. So "one note per close" is
--     every row for that bar and day, and "Read by you, Theo and Maya" is the
--     rows with read_at. Written by bar and day and person, so a write saved
--     with no signal sends later without doubling.
--   * Everyone at the bar reads its rows; each person writes only their own.
--     Every policy is on this table only.

CREATE TABLE "public"."handover_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "bar_id" "uuid" NOT NULL REFERENCES "public"."bars"("id") ON DELETE CASCADE,
    -- The service day the bar closed (it turns over at 6am, lib/serviceDay.ts).
    "close_date" "date" NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "ran_out" "text"[] DEFAULT '{}'::"text"[] NOT NULL CHECK (cardinality("ran_out") <= 30 AND length(array_to_string("ran_out", '')) <= 1000),
    -- "Anything else": a line for the whole night ("Quiet after 11").
    "note" "text" CHECK (length("note") <= 1000),
    "prep" "text" CHECK (length("prep") <= 1000),
    "broken" "text" CHECK (length("broken") <= 1000),
    "written_at" timestamp with time zone,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    UNIQUE ("bar_id", "close_date", "user_id")
);

COMMENT ON TABLE "public"."handover_notes" IS
    'The handover note: one row per person per close; what a closer wrote, and when each person read it. The bar reads; each person writes their own.';

CREATE INDEX "handover_notes_bar_close" ON "public"."handover_notes" ("bar_id", "close_date" DESC);
CREATE INDEX "handover_notes_user" ON "public"."handover_notes" ("user_id");

ALTER TABLE "public"."handover_notes" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "handover_notes_select" ON "public"."handover_notes" FOR SELECT TO "authenticated"
    USING ("bar_id" IN (SELECT "ub"."bar_id" FROM "public"."user_bars" "ub" WHERE "ub"."user_id" = (SELECT "auth"."uid"())));
CREATE POLICY "handover_notes_insert" ON "public"."handover_notes" FOR INSERT TO "authenticated"
    WITH CHECK ("user_id" = (SELECT "auth"."uid"())
        AND "bar_id" IN (SELECT "ub"."bar_id" FROM "public"."user_bars" "ub" WHERE "ub"."user_id" = (SELECT "auth"."uid"())));
CREATE POLICY "handover_notes_update" ON "public"."handover_notes" FOR UPDATE TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()))
    WITH CHECK ("user_id" = (SELECT "auth"."uid"())
        AND "bar_id" IN (SELECT "ub"."bar_id" FROM "public"."user_bars" "ub" WHERE "ub"."user_id" = (SELECT "auth"."uid"())));
CREATE POLICY "handover_notes_delete" ON "public"."handover_notes" FOR DELETE TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."handover_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."handover_notes" TO "service_role";
