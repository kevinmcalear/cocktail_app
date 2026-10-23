-- Old links to a merged person page land on the claimant's profile.
--
-- When someone with a profile claims the page we seeded for them, approval
-- merges the page into theirs and deletes it (20261030100000). Its handle and
-- id lived on in shared links, menus and search results, and now led nowhere.
-- The old row is kept in private.profile_merges, so /p/<old handle> and
-- /p/<old id> can ask merged_profile_handle() where the person is now, and the
-- page route goes there.
--
-- It answers with the claimant's current handle and nothing else, and only
-- when the caller could read that profile anyway (the profiles_select rules:
-- public, not taken down, not someone who blocked you or you blocked; or your
-- own). A handle that was never merged, or whose claimant is hidden from you,
-- gets null, like any link to nothing.

-- ponytail: matches the snapshot's handle with no index; there is one row per
-- merged page, a few hundred at most. Index (snapshot ->> 'handle') if it grows.
CREATE FUNCTION "public"."merged_profile_handle"("p_ref" "text") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT p.handle
    FROM private.profile_merges m
    JOIN public.profiles p ON p.id = m.into_profile_id
    -- A handle is at most 30 characters, so it never reads as an id.
    WHERE (m.from_profile_id::text = lower(btrim(p_ref))
           OR m.snapshot ->> 'handle' = lower(ltrim(btrim(p_ref), '@')))
      AND (
          p.user_id = auth.uid()
          OR (p.is_public AND p.moderated_at IS NULL
              AND (auth.uid() IS NULL OR p.user_id IS NULL OR p.user_id NOT IN (SELECT private.blocked_user_ids())))
      )
    -- A handle freed and merged again: the latest merge wins.
    ORDER BY m.merged_at DESC
    LIMIT 1;
$$;

COMMENT ON FUNCTION "public"."merged_profile_handle"("text") IS
    'The current handle of the profile a merged person page (by old handle or id) went into, when the caller can see it; null otherwise (20261103300000).';

REVOKE EXECUTE ON FUNCTION "public"."merged_profile_handle"("text") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."merged_profile_handle"("text") TO "anon", "authenticated", "service_role";
