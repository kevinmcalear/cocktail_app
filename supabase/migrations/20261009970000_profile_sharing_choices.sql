-- DRAFT. Local stack only. Not applied to production; needs Kevin's review first.
--
-- A person picks what their public profile shows, one switch each:
--
--   profiles.shares_rankings  the drinks they've had, with scores (20261001220000).
--   profiles.shares_bars      the bars they've had drinks at, with their average
--                             there. New, off by default. Everyone already
--                             showing their drinks showed their bars with them,
--                             so it starts on for them.
--   profiles.shares_made      the drinks they've made (Originals, menu credits).
--                             New, on by default: that's what profiles show today.
--                             Display only: a credit is public on the drink's own
--                             page whatever this says.
--
--   get_profile_drinks(id)    as 20261001220000, but the bar each drink was had
--                             at is named only when they share bars. A drink had
--                             at a bar they don't name says "at a bar" (at_bar).
--   get_profile_bars(id)      new: one row per public bar, with how many drinks
--                             and their average score there, for someone who
--                             shares bars. The best drink there is named only
--                             when they share drinks too. Same gates as
--                             get_profile_drinks: a person's public profile, not
--                             on hold, owner age-confirmed, nobody blocked,
--                             signed-in readers only.

ALTER TABLE "public"."profiles"
    ADD COLUMN "shares_bars" boolean DEFAULT false NOT NULL,
    ADD COLUMN "shares_made" boolean DEFAULT true NOT NULL,
    ADD CONSTRAINT "profiles_shares_bars_person" CHECK (NOT "shares_bars" OR "kind" = 'person'),
    ADD CONSTRAINT "profiles_shares_made_person" CHECK ("shares_made" OR "kind" = 'person');

UPDATE "public"."profiles" SET "shares_bars" = true WHERE "shares_rankings";

-- Signed-out visitors read profiles by column (20260927000000); the profile
-- page selects these too.
GRANT SELECT ("shares_bars", "shares_made") ON "public"."profiles" TO "anon";

DROP FUNCTION "public"."get_profile_drinks"("uuid");

CREATE FUNCTION "public"."get_profile_drinks"("p_profile_id" "uuid")
    RETURNS TABLE(
        "id" "uuid", "item_id" "uuid", "name" "text", "list_name" "text",
        "image_url" "text", "image_is_generated" boolean,
        "at_bar" boolean,
        "venue_id" "uuid", "venue_handle" "text", "venue_name" "text", "venue_avatar_url" "text",
        "venue_locality" "text", "venue_city" "text",
        "sentiment" "public"."rank_sentiment", "score" numeric, "had_on" "date", "created_at" timestamp with time zone
    )
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  WITH sharer AS (
    SELECT p.user_id, p.shares_bars
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
         s.venue_profile_id IS NOT NULL,
         shown.id, shown.handle, shown.display_name, shown.avatar_url, shown.locality, shown.city,
         s.sentiment, s.score, s.had_on, s.created_at
  FROM sharer
  JOIN public.rank_entry_scores s ON s.user_id = sharer.user_id
  LEFT JOIN nameable item ON item.id = s.item_id
  LEFT JOIN nameable list ON list.id = s.ranked_as_item_id
  LEFT JOIN public.profiles v
         ON v.id = s.venue_profile_id AND v.kind = 'bar' AND v.is_public AND v.moderated_at IS NULL
  LEFT JOIN public.profiles shown ON shown.id = v.id AND sharer.shares_bars
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

CREATE FUNCTION "public"."get_profile_bars"("p_profile_id" "uuid")
    RETURNS TABLE(
        "venue_id" "uuid", "venue_handle" "text", "venue_name" "text", "venue_avatar_url" "text",
        "venue_locality" "text", "venue_city" "text",
        "drinks" integer, "average" numeric, "best_name" "text", "best_score" numeric
    )
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  WITH sharer AS (
    SELECT p.user_id, p.shares_rankings
    FROM public.profiles p
    WHERE p.id = p_profile_id
      AND p.kind = 'person' AND p.user_id IS NOT NULL
      AND p.is_public AND p.moderated_at IS NULL AND p.shares_bars
      AND p.user_id NOT IN (SELECT private.blocked_user_ids())
      AND EXISTS (SELECT 1 FROM private.age_checks a WHERE a.user_id = p.user_id AND a.confirmed_at IS NOT NULL)
  ), nameable AS (
    -- As get_profile_drinks: only entries it would show count here.
    SELECT i.id, i.name
    FROM public.items i
    WHERE i.moderated_at IS NULL
      AND (
        (i.bar_id IS NULL AND i.created_by IS NULL)
        OR i.id IN (SELECT pi.id FROM public.published_items pi WHERE NOT pi.is_reference)
      )
  ), had AS (
    SELECT v.id AS venue_id, COALESCE(item.name, list.name) AS name, s.score, s.created_at, sharer.shares_rankings
    FROM sharer
    JOIN public.rank_entry_scores s ON s.user_id = sharer.user_id
    JOIN public.profiles v
      ON v.id = s.venue_profile_id AND v.kind = 'bar' AND v.is_public AND v.moderated_at IS NULL
    LEFT JOIN nameable item ON item.id = s.item_id
    LEFT JOIN nameable list ON list.id = s.ranked_as_item_id
    WHERE COALESCE(item.id, list.id) IS NOT NULL
  ), tally AS (
    SELECT venue_id, count(*)::integer AS drinks, round(avg(score), 1) AS average
    FROM had GROUP BY venue_id
  ), best AS (
    SELECT DISTINCT ON (venue_id) venue_id, name, score
    FROM had WHERE shares_rankings
    ORDER BY venue_id, score DESC, created_at DESC
  )
  SELECT v.id, v.handle, v.display_name, v.avatar_url, v.locality, v.city,
         t.drinks, t.average, b.name, b.score
  FROM tally t
  JOIN public.profiles v ON v.id = t.venue_id
  LEFT JOIN best b ON b.venue_id = t.venue_id
  ORDER BY t.average DESC, t.drinks DESC, v.display_name
  LIMIT 200;
$$;

REVOKE EXECUTE ON FUNCTION "public"."get_profile_bars"("p_profile_id" "uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."get_profile_bars"("p_profile_id" "uuid") TO "authenticated", "service_role";
