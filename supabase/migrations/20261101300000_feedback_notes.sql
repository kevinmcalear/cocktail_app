-- DRAFT. Local stack only until Kevin's OK.
--
-- Tell us (Eddie call, 22 Oct, wave 2 board fix 16): a note from inside the
-- app that knows where it came from. "Doing something different? Tell us"
-- under the ice, method and technique lists, and Report a problem, write here
-- instead of opening an email.
--
--   feedback  one row per note: who sent it, the bar they were working at (if
--             any), the screen and route it came from, what it's about (a
--             drink or a bottle), the kind, the words, the app version and
--             device, and where we've got to with it (status, 'new' to start).
--
-- Who reads it: the sender, and the Cocktail team (app admins, as for
-- reports). Nobody else, not even the bar's own team. Nobody edits or deletes
-- a note from the app; the team moves its status by hand for now.
-- ponytail: no photo yet (the board's "Add a photo"). Upgrade path: a
-- private storage bucket and a photo_path column, in their own gated PR.
-- Limits: 2,000 characters a note, 20 notes a person a day.

CREATE TABLE "public"."feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    -- Goes with the account.
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    -- The bar they were working at, when there was one; kept if the bar goes.
    "bar_id" "uuid" REFERENCES "public"."bars"("id") ON DELETE SET NULL,
    -- 'different': we do it differently (a method, ice or technique the app
    -- lacks). The rest are Report a problem's kinds.
    "kind" "text" NOT NULL CHECK ("kind" IN ('different', 'broken', 'wrong', 'slow', 'data', 'other')),
    -- Where it came from, in words ("Adding a drink › Ice") and as a route.
    "screen" "text" NOT NULL CHECK (char_length(btrim("screen")) BETWEEN 1 AND 200),
    "route" "text" CHECK (char_length("route") <= 300),
    -- What it's about there: the drink being added, the bottle being made house.
    "subject" "text" CHECK (char_length("subject") <= 200),
    -- A new method needs words; a problem report may have none.
    "body" "text" DEFAULT '' NOT NULL CHECK (char_length("body") <= 2000),
    "device" "text" CHECK (char_length("device") <= 200),
    "status" "text" DEFAULT 'new' NOT NULL CHECK ("status" IN ('new', 'seen', 'added', 'closed')),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "feedback_different_says_what" CHECK ("kind" <> 'different' OR btrim("body") <> '')
);
CREATE INDEX "feedback_user_id_idx" ON "public"."feedback" ("user_id", "created_at" DESC);
CREATE INDEX "feedback_queue_idx" ON "public"."feedback" ("status", "created_at");
CREATE INDEX "feedback_bar_id_idx" ON "public"."feedback" ("bar_id") WHERE "bar_id" IS NOT NULL;

-- Notes the caller sent in the last day, for the insert policy's daily limit.
-- A helper because a policy can't query its own table.
CREATE FUNCTION "private"."my_feedback_today"() RETURNS bigint
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT count(*) FROM public.feedback WHERE user_id = auth.uid() AND created_at > now() - interval '1 day';
$$;

ALTER TABLE "public"."feedback" ENABLE ROW LEVEL SECURITY;

-- The sender reads their own; the Cocktail team reads them all.
CREATE POLICY "feedback_select" ON "public"."feedback" FOR SELECT TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()) OR "private"."is_app_admin"());

-- A new note of your own, at a bar you belong to (or none), at most 20 a day.
CREATE POLICY "feedback_insert" ON "public"."feedback" FOR INSERT TO "authenticated"
    WITH CHECK (
        "user_id" = (SELECT "auth"."uid"())
        AND "status" = 'new'
        AND ("bar_id" IS NULL OR "bar_id" IN (SELECT "private"."my_bar_ids"(0)))
        AND "private"."my_feedback_today"() < 20
    );

REVOKE ALL ON "public"."feedback" FROM PUBLIC, "anon", "authenticated";
GRANT SELECT ON "public"."feedback" TO "authenticated";
-- Not created_at or status: a note can't backdate itself past the daily limit.
GRANT INSERT ("user_id", "bar_id", "kind", "screen", "route", "subject", "body", "device") ON "public"."feedback" TO "authenticated";
GRANT ALL ON "public"."feedback" TO "service_role";

REVOKE EXECUTE ON FUNCTION "private"."my_feedback_today"() FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."my_feedback_today"() TO "authenticated", "service_role";
