-- DRAFT. Local stack only. Not applied to production; needs Kevin's review first.
--
-- A person can show the drinks they've had on their public profile: every
-- drink they ranked, with their own 0 to 10 score and where they had it. It's
-- off until they turn it on (docs/schema_proposal.md: sharing rankings is an
-- explicit opt-in), and turning it off hides them again straight away.
--
--   profiles.shares_rankings   the opt-in, on a person's profile.
--   get_profile_drinks(id)     what a signed-in reader gets: nothing unless
--                              the profile is a person's, public, not on a
--                              moderation hold and sharing, its owner has
--                              confirmed their age, and neither side has
--                              blocked the other.
--
-- rank_entries and rank_comparisons stay the owner's alone (no policy
-- changes). The function runs as its owner and hands out only what's safe:
--
--   - A drink is named only when any signed-in person could already read its
--     name: it's published, or it's a shared drink with no venue and no owner
--     (a classic, or a bar's signature). A bar's unpublished drink falls back
--     to the list it was ranked in ("Martini") when that's such a drink, and
--     is left out otherwise, so a staff member's list can't leak a menu.
--   - A bar is named only while its profile is public and not on hold;
--     entries at other bars are left out.
--   - Scores are worked out over the whole list before anything is left out,
--     so a hidden entry never shifts the scores of the ones shown.
--   - Signed-out visitors get nothing: what someone drinks isn't for search
--     engines.

ALTER TABLE "public"."profiles"
    ADD COLUMN "shares_rankings" boolean DEFAULT false NOT NULL,
    ADD CONSTRAINT "profiles_shares_rankings_person" CHECK (NOT "shares_rankings" OR "kind" = 'person');

-- Signed-out visitors read profiles by column (20260927000000); the profile
-- page selects this one too.
GRANT SELECT ("shares_rankings") ON "public"."profiles" TO "anon";

CREATE FUNCTION "public"."get_profile_drinks"("p_profile_id" "uuid")
    RETURNS TABLE(
        "id" "uuid", "item_id" "uuid", "name" "text", "list_name" "text",
        "image_url" "text", "image_is_generated" boolean,
        "venue_id" "uuid", "venue_handle" "text", "venue_name" "text", "venue_avatar_url" "text",
        "venue_locality" "text", "venue_city" "text",
        "sentiment" "public"."rank_sentiment", "score" numeric, "had_on" "date", "created_at" timestamp with time zone
    )
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  WITH sharer AS (
    SELECT p.user_id
    FROM public.profiles p
    WHERE p.id = p_profile_id
      AND p.kind = 'person' AND p.user_id IS NOT NULL
      AND p.is_public AND p.moderated_at IS NULL AND p.shares_rankings
      AND p.user_id NOT IN (SELECT private.blocked_user_ids())
      AND EXISTS (SELECT 1 FROM private.age_checks a WHERE a.user_id = p.user_id AND a.confirmed_at IS NOT NULL)
  ), nameable AS (
    -- Drinks any signed-in reader may be told the name of.
    SELECT i.id, i.name
    FROM public.items i
    WHERE i.moderated_at IS NULL
      AND (
        (i.bar_id IS NULL AND i.created_by IS NULL)
        OR i.id IN (SELECT pi.id FROM public.published_items pi WHERE NOT pi.is_reference)
      )
  )
  SELECT s.id,
         COALESCE(item.id, list.id),
         COALESCE(item.name, list.name),
         CASE WHEN item.id IS NOT NULL AND list.name IS DISTINCT FROM item.name THEN list.name END,
         img.url, img.is_generated,
         v.id, v.handle, v.display_name, v.avatar_url, v.locality, v.city,
         s.sentiment, s.score, s.had_on, s.created_at
  FROM sharer
  JOIN public.rank_entry_scores s ON s.user_id = sharer.user_id
  LEFT JOIN nameable item ON item.id = s.item_id
  LEFT JOIN nameable list ON list.id = s.ranked_as_item_id
  LEFT JOIN public.profiles v
         ON v.id = s.venue_profile_id AND v.kind = 'bar' AND v.is_public AND v.moderated_at IS NULL
  LEFT JOIN LATERAL (
    SELECT im.url, ii.is_generated
    FROM public.item_images ii JOIN public.images im ON im.id = ii.image_id
    WHERE ii.item_id = item.id AND ii.angle = 'hero'
    ORDER BY ii.is_generated, ii.sort_order NULLS LAST, ii.created_at
    LIMIT 1
  ) img ON true
  WHERE COALESCE(item.id, list.id) IS NOT NULL
    AND (s.venue_profile_id IS NULL OR v.id IS NOT NULL)
  ORDER BY s.score DESC, s.created_at DESC
  LIMIT 500;
$$;

REVOKE EXECUTE ON FUNCTION "public"."get_profile_drinks"("p_profile_id" "uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."get_profile_drinks"("p_profile_id" "uuid") TO "authenticated", "service_role";
