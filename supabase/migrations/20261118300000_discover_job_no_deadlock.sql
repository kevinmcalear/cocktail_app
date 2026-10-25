-- Discover's 30-second job no longer deadlocks with a save that deletes drinks.
--
-- run_discover_dirty took the marked drinks off private.discover_dirty, then
-- rebuilt their facts. Rebuilding a drink's facts checks its items row and bar
-- profile (the facts' foreign keys), so it waited on any transaction deleting
-- that drink. If that transaction then deleted a second marked drink, its
-- trigger marked it again and waited on the job's delete of the same
-- discover_dirty key: a deadlock (40P01). It failed a security test run on
-- 25 Oct 2026, and the same thing can fail a real delete of two drinks.
--
-- Now the job first takes a key-share lock on each drink and its bar profile,
-- skipping any that another transaction is deleting, so it never waits on a
-- save. Skipped drinks stay marked for the next run, 30 seconds later. Most
-- edits take a lighter lock than a delete, so they are not skipped.
-- supabase/tests/discover-job-deadlock.test.mjs replays the deadlock.
CREATE OR REPLACE FUNCTION "private"."run_discover_dirty"("p_batch" integer DEFAULT 2000)
    RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_picked uuid[];
    v_held uuid[];
    v_profiles uuid[];
    v_ids uuid[];
BEGIN
    v_picked := ARRAY(
        SELECT d.item_id FROM private.discover_dirty d
        ORDER BY d.marked_at
        LIMIT p_batch
        FOR UPDATE SKIP LOCKED
    );
    IF v_picked = '{}' THEN
        RETURN 0;
    END IF;

    v_held := ARRAY(SELECT i.id FROM public.items i WHERE i.id = ANY (v_picked) FOR KEY SHARE SKIP LOCKED);
    v_profiles := ARRAY(
        SELECT p.id FROM public.profiles p
        WHERE p.id IN (SELECT i.origin_bar_profile_id FROM public.items i WHERE i.id = ANY (v_held))
        FOR KEY SHARE OF p SKIP LOCKED
    );
    -- A drink that is gone only needs its facts dropped; one that is still here needs it and its bar profile held.
    v_ids := ARRAY(
        SELECT x FROM unnest(v_picked) x LEFT JOIN public.items i ON i.id = x
        WHERE i.id IS NULL
           OR (x = ANY (v_held) AND (i.origin_bar_profile_id IS NULL OR i.origin_bar_profile_id = ANY (v_profiles)))
    );
    IF v_ids = '{}' THEN
        RETURN 0;
    END IF;

    DELETE FROM private.discover_dirty d WHERE d.item_id = ANY (v_ids);
    RETURN private.refresh_discover_facts(v_ids);
END;
$$;
