-- Daily limits on rankings, ranking comparisons and picture uploads. Local
-- stack only until Kevin's OK.
--
-- Reports (20 a day, 20260930500300) and drink photos (20 a day,
-- 20261008850100) already have one. These didn't:
--
--   * rank_entries: 300 new rankings a day. Someone working through a menu
--     might rank 100 drinks in a night; moving a drink they'd ranked before
--     (the same id, an upsert) isn't counted.
--   * rank_comparisons: 3,000 a day. Placing a drink asks "which was better?"
--     a handful of times (a binary search over the list), so this is about
--     ten per ranking.
--   * drinks bucket uploads: 300 a day per person. A venue bringing in its
--     menu and pictures does a lot at once; catalog admins skip it. Uploads
--     can't be deleted by their owner, so counting today's objects is enough.
--   * avatars bucket uploads: 30 a day per person.
--
-- Rankings and comparisons are counted in private.rate_events (kept when an
-- entry is deleted, so deleting doesn't hand the allowance back), like
-- invites and new venues. Limit errors are P0001 with a message for people.

-- --- Limits ---

-- As 20261008740000, plus the four above.
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
    WHEN 'rank' THEN 300
    WHEN 'rank_comparison' THEN 3000
    WHEN 'drinks_upload' THEN 300
    WHEN 'avatars_upload' THEN 30
  END;
$$;

ALTER TABLE "private"."rate_events" DROP CONSTRAINT "rate_events_kind_check";
ALTER TABLE "private"."rate_events" ADD CONSTRAINT "rate_events_kind_check"
    CHECK ("kind" IN ('invite', 'invite_email', 'venue_create', 'rank', 'rank_comparison'));

-- --- Rankings ---

-- Before each new ranking or comparison: over today's limit raises, else the
-- event is counted. One at a time per person, so a burst can't all pass. An
-- upsert that moves an existing entry fires this too (BEFORE INSERT runs
-- before the conflict is found), so an id that's already there is let through
-- uncounted; the update policy still decides whether it's the caller's.
CREATE FUNCTION "private"."count_rank_event"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_kind text := TG_ARGV[0];
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;
    -- Nested: a comparison's id is a bigint, and the lookup is planned even
    -- when the first test fails.
    IF TG_TABLE_NAME = 'rank_entries' THEN
        IF EXISTS (SELECT 1 FROM public.rank_entries WHERE id = NEW.id) THEN
            RETURN NEW;
        END IF;
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(v_kind || ':' || auth.uid()::text, 0));
    IF private.rate_count(v_kind, auth.uid(), NULL, NULL) >= private.daily_limit(v_kind) THEN
        RAISE EXCEPTION '%', CASE v_kind
            WHEN 'rank' THEN format('You''ve ranked %s drinks today. Try again tomorrow.', private.daily_limit(v_kind))
            ELSE 'That''s a lot of comparing for one day. Try again tomorrow.'
        END;
    END IF;
    INSERT INTO private.rate_events (kind, user_id) VALUES (v_kind, auth.uid());
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."count_rank_event"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "count_rank_entry" BEFORE INSERT ON "public"."rank_entries"
    FOR EACH ROW EXECUTE FUNCTION "private"."count_rank_event"('rank');
CREATE TRIGGER "count_rank_comparison" BEFORE INSERT ON "public"."rank_comparisons"
    FOR EACH ROW EXECUTE FUNCTION "private"."count_rank_event"('rank_comparison');

-- --- Uploads ---

-- Whether the caller may upload another object to a bucket today. Catalog
-- admins always may.
-- ponytail: counts today's objects in the bucket with no index on owner_id
-- (storage.objects belongs to the storage service, so we can't add one). A
-- few thousand rows is a few ms per upload; keep a counter in rate_events
-- from an upload function if the buckets grow past ~100k objects.
CREATE FUNCTION "private"."has_upload_room"("p_bucket" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (SELECT 1 FROM private.app_admins WHERE user_id = auth.uid())
      OR (SELECT count(*) FROM storage.objects o
           WHERE o.bucket_id = p_bucket
             AND o.owner_id = auth.uid()::text
             AND o.created_at > now() - interval '1 day')
         < private.daily_limit(p_bucket || '_upload');
$$;

REVOKE EXECUTE ON FUNCTION "private"."has_upload_room"("text") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."has_upload_room"("text") TO "authenticated", "service_role";

-- As 20260923000100_security_lockdown.sql, with the daily limit.
DROP POLICY "drinks_insert_app_folders" ON "storage"."objects";
CREATE POLICY "drinks_insert_app_folders" ON "storage"."objects" FOR INSERT TO "authenticated"
    WITH CHECK (
        "bucket_id" = 'drinks'
        AND ("storage"."foldername"("name"))[1] = ANY (ARRAY['beers', 'cocktails', 'drafts', 'ingredients', 'menus', 'wines'])
        AND "private"."has_upload_room"('drinks')
    );

-- As the baseline's avatars insert policy (20260923000000), with the daily
-- limit. Signed in only: a signed-out caller never had a folder to match.
DROP POLICY "Give users access to own folder 1oj01fe_1" ON "storage"."objects";
CREATE POLICY "Give users access to own folder 1oj01fe_1" ON "storage"."objects" FOR INSERT TO "authenticated"
    WITH CHECK (
        "bucket_id" = 'avatars'
        AND (SELECT "auth"."uid"())::text = ("storage"."foldername"("name"))[1]
        AND "private"."has_upload_room"('avatars')
    );
