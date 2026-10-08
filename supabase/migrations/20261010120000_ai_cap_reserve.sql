-- Half the project's daily AI calls are kept for venues and established
-- accounts. Local stack only until Kevin's OK.
--
-- 20261008740000 caps paid AI calls at 2,000 a day for the whole project, on
-- top of each person's 40 and each venue's own. New accounts are free to make,
-- so a batch of them could use the whole 2,000 and leave nothing for anyone.
--
-- Now a call from a new account (made in the last 7 days, not a current
-- member of any venue, not a catalog admin) also has to fit in a 1,000-a-day
-- pool shared by all new accounts. Calls a venue pays for, and calls from
-- anyone a week old or on a venue's team, only need the overall 2,000. So new
-- accounts can at most use up the new-account half; venues and everyone
-- established always have at least 1,000.
--
-- Why these numbers: a real new person makes a few AI calls on day one (a
-- bottle photo, a menu), so 1,000 covers a busy launch day's signups; a week
-- is long enough that making accounts in bulk to wait them out isn't worth
-- it, and short enough that real people graduate quickly. Joining a venue
-- (an invite, or making one, itself limited to 3 a day) counts as established
-- straight away.

-- As 20261010110000, plus the new-account pool.
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
  END;
$$;

-- Whether a call came from a new account, so the pool can be counted.
ALTER TABLE "private"."ai_usage" ADD COLUMN "is_new_account" boolean DEFAULT false NOT NULL;

-- A person whose AI calls come out of the new-account pool: signed up in the
-- last 7 days, with no current venue role, and not a catalog admin.
CREATE FUNCTION "private"."ai_is_new_account"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_user_id AND u.created_at > now() - interval '7 days')
     AND NOT EXISTS (SELECT 1 FROM private.app_admins aa WHERE aa.user_id = p_user_id)
     AND NOT EXISTS (
         SELECT 1 FROM public.user_bars ub
         WHERE ub.user_id = p_user_id
           AND NOT EXISTS (SELECT 1 FROM public.venue_roles vr WHERE vr.id = ub.venue_role_id AND vr.ends_at <= now()));
$$;

REVOKE EXECUTE ON FUNCTION "private"."ai_is_new_account"("uuid") FROM PUBLIC, "anon", "authenticated";

-- As 20261008740000, plus the pool for a new account's call. Takes a lock so
-- concurrent callers can't all squeeze past either ceiling.
DROP FUNCTION "private"."ai_project_has_room"();
CREATE FUNCTION "private"."ai_project_has_room"("p_new_account" boolean DEFAULT false) RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended('ai-usage:project', 0));
    RETURN (SELECT count(*) < private.daily_limit('ai_project')
                   AND (NOT p_new_account OR count(*) FILTER (WHERE is_new_account) < private.daily_limit('ai_project_new_accounts'))
              FROM private.ai_usage WHERE created_at > now() - interval '24 hours');
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."ai_project_has_room"(boolean) FROM PUBLIC, "anon", "authenticated";

-- As 20261008740000, with the new-account pool. consume_item_ai_quota calls
-- this for a personal item, and checks a venue's calls against the overall
-- ceiling only.
CREATE OR REPLACE FUNCTION "public"."consume_ai_quota"("p_user_id" "uuid", "p_fn" "text", "p_daily_limit" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_count INT;
    v_new boolean := private.ai_is_new_account(p_user_id);
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
    SELECT count(*) INTO v_count
    FROM private.ai_usage
    WHERE user_id = p_user_id AND created_at > now() - interval '24 hours';
    IF v_count >= p_daily_limit OR NOT private.ai_project_has_room(v_new) THEN
        RETURN false;
    END IF;
    INSERT INTO private.ai_usage (user_id, fn, is_new_account) VALUES (p_user_id, p_fn, v_new);
    RETURN true;
END;
$$;
