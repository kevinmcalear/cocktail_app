-- follow_people(): the names and pictures of the people who follow you,
-- including those with no public page (People › Followers, Kept-people).
-- Without it People can only count them ("1 more person without a public
-- page follows you").
--
--   * Only people who follow you: they chose to, so you may know who they
--     are. Never the people you follow (anyone can follow anyone by id, so
--     that would name a private person to a stranger).
--   * Their name as they gave it: their person page's name (not one held by
--     moderation), else their account's full name, else first and last name.
--     Never anything from their email: a name nobody gave comes back null and
--     the app says "Someone".
--   * Their picture only from their own account upload (private.account_photo),
--     and not when their page hides it (shows_photo off).
--   * Leaves out people you've blocked or who blocked you.
-- New function only: no table, column or policy changes.

CREATE FUNCTION "public"."follow_people"()
    RETURNS TABLE ("user_id" "uuid", "display_name" "text", "avatar_url" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT
    f.follower_id,
    COALESCE(
      (SELECT NULLIF(btrim(pr.display_name), '') FROM public.profiles pr
        WHERE pr.user_id = f.follower_id AND pr.kind = 'person' AND pr.moderated_at IS NULL
        ORDER BY pr.created_at, pr.id LIMIT 1),
      NULLIF(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
      NULLIF(btrim(concat_ws(' ', NULLIF(btrim(u.raw_user_meta_data ->> 'first_name'), ''), NULLIF(btrim(u.raw_user_meta_data ->> 'last_name'), ''))), '')
    ),
    CASE WHEN EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.user_id = f.follower_id AND pr.kind = 'person' AND NOT pr.shows_photo)
      THEN NULL ELSE private.account_photo(f.follower_id) END
  FROM public.follows f
  JOIN auth.users u ON u.id = f.follower_id
  WHERE f.followee_id = auth.uid()
    AND f.follower_id NOT IN (SELECT private.blocked_user_ids());
$$;

COMMENT ON FUNCTION "public"."follow_people"() IS
    'The people who follow you: the name they gave and their own picture, never from their email. Yours only.';

REVOKE ALL ON FUNCTION "public"."follow_people"() FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."follow_people"() TO "authenticated", "service_role";
