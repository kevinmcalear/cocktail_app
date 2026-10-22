-- Tell us (Eddie wave 2, fix 16; board approved by Kevin on 22 Oct 2026).
-- Local stack only until Kevin's OK and the human-approved label.
--
-- Notes people send the Cocktail team from the app: "Doing something
-- different? Tell us" under the ice, method and technique lists, and Report a
-- problem in Settings. Each note says who sent it, the bar it came from (if
-- any), the screen and drink it was sent from, what kind of note it is, the
-- words, an optional photo, and the app version and device.
--
-- Who sees what:
--   * the sender reads their own notes;
--   * the Cocktail team (catalog admins, private.is_app_admin()) reads all;
--   * nobody else reads any.
-- Notes are written once: there is no update or delete for senders, like
-- reports. They go with the sender's account when it is deleted.
--
-- Photos go in a new private bucket, `feedback`, under <sender id>/. The
-- sender and the Cocktail team can read them; nobody else can. Uploads count
-- against a daily limit like the other buckets. A sender may remove a photo
-- no note points at (a send that failed); one that went with a note stays.
--
-- Later (not here): Claude drafts the change from a note, it ships to that
-- bar first, and the bar sees "We added this".

-- --- Table ---

CREATE TABLE "public"."feedback_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    -- The bar it was sent from; NULL at home or in Settings. Kept if the bar goes.
    "bar_id" "uuid" REFERENCES "public"."bars"("id") ON DELETE SET NULL,
    -- Where it was sent from, as the sheet shows it: "Adding a drink › Ice".
    "screen" "text" NOT NULL CHECK (char_length(btrim("screen")) BETWEEN 1 AND 120),
    -- The drink being added or edited, by name (a new drink has no id yet).
    "drink_name" "text" CHECK (char_length("drink_name") <= 200),
    -- tell_us: "Doing something different?". The rest are Report a problem's kinds.
    "kind" "text" NOT NULL CHECK ("kind" IN ('tell_us', 'broken', 'wrong', 'slow', 'data', 'other')),
    -- What they wrote. Optional for a problem report; a Tell us note needs words.
    "body" "text" DEFAULT '' NOT NULL CHECK (char_length("body") <= 2000),
    -- In the feedback bucket, always under the sender's own folder.
    "photo_path" "text" CHECK (
        "photo_path" IS NULL
        OR (char_length("photo_path") <= 200 AND "photo_path" LIKE "user_id"::"text" || '/%' AND "photo_path" NOT LIKE '%..%')
    ),
    "app_version" "text" CHECK (char_length("app_version") <= 40),
    "device" "text" CHECK (char_length("device") <= 300),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "feedback_notes_tell_us_has_words" CHECK ("kind" <> 'tell_us' OR char_length(btrim("body")) > 0)
);

CREATE INDEX "feedback_notes_user_id_idx" ON "public"."feedback_notes" ("user_id", "created_at" DESC);
CREATE INDEX "feedback_notes_bar_id_idx" ON "public"."feedback_notes" ("bar_id");
CREATE INDEX "feedback_notes_created_at_idx" ON "public"."feedback_notes" ("created_at" DESC);

-- At most 20 notes a day per person. A trigger, not the insert policy: a
-- policy's check can't see rows from the same statement or from requests
-- running at the same time, so one multi-row insert or a burst of parallel
-- ones could all pass. One at a time per person (an advisory lock held to the
-- end of the transaction), counting what's already committed, as
-- count_rank_event does. The service role (no auth.uid()) isn't limited. RLS
-- still decides who may insert. Counted by the caller, not the row's user_id,
-- so it never says anything about someone else's notes.
CREATE FUNCTION "private"."limit_feedback_notes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('feedback_notes:' || auth.uid()::text, 0));
    IF (SELECT count(*) FROM public.feedback_notes
         WHERE user_id = auth.uid() AND created_at > now() - interval '1 day') >= 20 THEN
        -- The hint is what the app looks for to say "that's a lot for one day".
        RAISE EXCEPTION 'That''s a lot of notes for one day. Try again tomorrow.'
            USING ERRCODE = 'P0001', HINT = 'notes_daily_limit';
    END IF;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."limit_feedback_notes"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "limit_feedback_notes" BEFORE INSERT ON "public"."feedback_notes"
    FOR EACH ROW EXECUTE FUNCTION "private"."limit_feedback_notes"();

-- --- Policies ---

ALTER TABLE "public"."feedback_notes" ENABLE ROW LEVEL SECURITY;

-- The sender reads their own; the Cocktail team reads all.
CREATE POLICY "feedback_notes_select" ON "public"."feedback_notes" FOR SELECT TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()) OR (SELECT "private"."is_app_admin"()));

-- Sent as yourself, from a bar you belong to (or none). The daily limit is
-- the trigger above.
CREATE POLICY "feedback_notes_insert" ON "public"."feedback_notes" FOR INSERT TO "authenticated"
    WITH CHECK (
        "user_id" = (SELECT "auth"."uid"())
        AND ("bar_id" IS NULL OR "bar_id" IN (SELECT "private"."my_bar_ids"(0)))
    );

-- Signed-in people send and read (RLS above decides which rows). The id and
-- created_at aren't theirs to set, so the daily limit can't be dodged with an
-- old date. No updates or deletes.
REVOKE ALL ON "public"."feedback_notes" FROM "anon", "authenticated";
GRANT SELECT ON "public"."feedback_notes" TO "authenticated";
GRANT INSERT ("user_id", "bar_id", "screen", "drink_name", "kind", "body", "photo_path", "app_version", "device")
    ON "public"."feedback_notes" TO "authenticated";

-- --- Photos ---

INSERT INTO "storage"."buckets" ("id", "name", "public", "file_size_limit", "allowed_mime_types")
VALUES ('feedback', 'feedback', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif'])
ON CONFLICT ("id") DO NOTHING;

-- As 20261010120000, plus feedback uploads: 20 a day per person.
CREATE OR REPLACE FUNCTION "private"."daily_limit"("p_kind" "text") RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT CASE p_kind
    WHEN 'invite_per_inviter' THEN 20
    WHEN 'invite_per_venue' THEN 50
    WHEN 'invite_email_per_invite' THEN 3
    WHEN 'invite_email_per_sender' THEN 30
    WHEN 'venue_create' THEN 3
    WHEN 'ai_project' THEN 2000
    WHEN 'ai_project_new_accounts' THEN 1000
    WHEN 'rank' THEN 300
    WHEN 'rank_comparison' THEN 3000
    WHEN 'drinks_upload' THEN 300
    WHEN 'avatars_upload' THEN 30
    WHEN 'feedback_upload' THEN 20
  END;
$$;

-- Into your own folder, within the daily limit. No updates.
CREATE POLICY "feedback_insert_own_folder" ON "storage"."objects" FOR INSERT TO "authenticated"
    WITH CHECK (
        "bucket_id" = 'feedback'
        AND ("storage"."foldername"("name"))[1] = (SELECT "auth"."uid"())::"text"
        AND "private"."has_upload_room"('feedback')
    );

-- Your own photos, or any for the Cocktail team.
CREATE POLICY "feedback_select_own_or_team" ON "storage"."objects" FOR SELECT TO "authenticated"
    USING (
        "bucket_id" = 'feedback'
        AND (("storage"."foldername"("name"))[1] = (SELECT "auth"."uid"())::"text" OR (SELECT "private"."is_app_admin"()))
    );

-- A photo whose note never went in (the send failed and was given up): the
-- sender may remove it from their own folder. Once a note points at it, it
-- stays, like the note.
CREATE POLICY "feedback_delete_own_unsent" ON "storage"."objects" FOR DELETE TO "authenticated"
    USING (
        "bucket_id" = 'feedback'
        AND ("storage"."foldername"("name"))[1] = (SELECT "auth"."uid"())::"text"
        AND NOT EXISTS (SELECT 1 FROM "public"."feedback_notes" "n" WHERE "n"."photo_path" = "objects"."name")
    );
