-- A photo of what's broken, on the handover note (canvas Loop-handover:
-- "Anything broken" with a photo). Whoever closes can add one; everyone at
-- the bar sees it with the note.
--
--   * handover_notes.broken_photo: the photo's path in the handover bucket.
--   * A private handover bucket: <bar id>/<user id>/<file>. Everyone at the
--     bar reads its folder; each person adds and removes only their own, with
--     the daily upload limit every bucket has (30 a day).
--
-- The storage policies reach storage.objects, so this is Kevin's to approve
-- (the handover table itself is 20261206100000).

ALTER TABLE "public"."handover_notes" ADD COLUMN "broken_photo" "text"
    CHECK ("broken_photo" IS NULL OR "char_length"("broken_photo") <= 300);
COMMENT ON COLUMN "public"."handover_notes"."broken_photo" IS
    'A photo of what''s broken: its path in the private handover bucket (<bar id>/<user id>/<file>).';

INSERT INTO "storage"."buckets" ("id", "name", "public", "file_size_limit", "allowed_mime_types")
VALUES ('handover', 'handover', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT ("id") DO NOTHING;

-- As 20261118500000, plus handover photos: 30 a day per person.
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
    WHEN 'glass-photos_upload' THEN 30
    WHEN 'handover_upload' THEN 30
  END;
$$;

-- Your own folder, at a bar you work at.
CREATE POLICY "handover_photos_insert" ON "storage"."objects" FOR INSERT TO "authenticated"
    WITH CHECK (
        "bucket_id" = 'handover'
        AND ("storage"."foldername"("name"))[2] = (SELECT "auth"."uid"())::"text"
        AND ("storage"."foldername"("name"))[1] IN (SELECT "ub"."bar_id"::"text" FROM "public"."user_bars" "ub" WHERE "ub"."user_id" = (SELECT "auth"."uid"()))
        AND "private"."has_upload_room"('handover')
    );

-- Everyone at the bar sees the bar's handover photos.
CREATE POLICY "handover_photos_select" ON "storage"."objects" FOR SELECT TO "authenticated"
    USING (
        "bucket_id" = 'handover'
        AND ("storage"."foldername"("name"))[1] IN (SELECT "ub"."bar_id"::"text" FROM "public"."user_bars" "ub" WHERE "ub"."user_id" = (SELECT "auth"."uid"()))
    );

-- Remove your own photo. No updates: a new photo is a new file.
CREATE POLICY "handover_photos_delete" ON "storage"."objects" FOR DELETE TO "authenticated"
    USING (
        "bucket_id" = 'handover'
        AND ("storage"."foldername"("name"))[2] = (SELECT "auth"."uid"())::"text"
    );
