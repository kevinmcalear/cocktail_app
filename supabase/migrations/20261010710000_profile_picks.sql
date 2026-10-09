-- DRAFT. Local stack only. Not applied to production; needs Kevin's review first.
--
-- What a person's public profile shows, section by section and item by item.
-- Each section (drinks they've had, bars they've been to, drinks they've
-- made) has a mode:
--
--   all     everything shows, new ones too; they can hide single ones.
--   picked  nothing shows until they pick it.
--   none    the section is off. Their picks are kept for when it's back on.
--
--   profiles.had_mode, bars_mode, made_mode
--                         New people: picked, picked, all (nothing they've had
--                         shows until they pick it; what they've made shows).
--                         Everyone else keeps what they show today: a section
--                         they showed is all, one they didn't is picked (had,
--                         bars) or none (made).
--   profiles.shows_dates  whether the drinks they show say when they had
--                         them. Off for new people: a list of bars with dates
--                         can place someone. On for people already showing
--                         drinks, since theirs show dates today.
--   profiles.shares_*     kept for app builds from before this, and kept in
--                         step with the modes by a trigger both ways: on is
--                         all; an old build turning a switch on or off sets
--                         all or none. (An old build doesn't show a picked
--                         section; the app update does.)
--
--   rank_entries.on_profile   a drink they've had: shown (true), hidden
--                             (false) or following the mode (null).
--   rank_entries.profile_pin  1 to 4: their top four, in order.
--   profile_picks             the same choice for a bar ('bars', the bar's
--                             profile id) or a drink they made ('originals',
--                             the item id). Bar picks are private (only the
--                             functions below read them); originals picks are
--                             public, since the app filters a profile's
--                             originals with them. A credit still shows on the
--                             drink's own page either way.
--
--   get_profile_drinks, get_profile_bars
--                         as 20261009970000, but by mode and pick. A bar a
--                         person hides is never named, on its own or beside a
--                         drink ("At a bar"). Dates come back only when they
--                         show them. Drinks come back with their pin.

ALTER TABLE "public"."profiles"
    ADD COLUMN "had_mode" "text" DEFAULT 'picked' NOT NULL,
    ADD COLUMN "bars_mode" "text" DEFAULT 'picked' NOT NULL,
    ADD COLUMN "made_mode" "text" DEFAULT 'all' NOT NULL,
    ADD COLUMN "shows_dates" boolean DEFAULT false NOT NULL,
    ADD CONSTRAINT "profiles_had_mode" CHECK ("had_mode" IN ('all', 'picked', 'none')),
    ADD CONSTRAINT "profiles_bars_mode" CHECK ("bars_mode" IN ('all', 'picked', 'none')),
    ADD CONSTRAINT "profiles_made_mode" CHECK ("made_mode" IN ('all', 'picked', 'none'));

UPDATE "public"."profiles" SET
    "had_mode" = CASE WHEN "shares_rankings" THEN 'all' ELSE 'picked' END,
    "bars_mode" = CASE WHEN "shares_bars" THEN 'all' ELSE 'picked' END,
    "made_mode" = CASE WHEN "shares_made" THEN 'all' ELSE 'none' END,
    "shows_dates" = "shares_rankings"
WHERE "kind" = 'person';

-- Signed-out visitors read profiles by column (20260927000000); the profile
-- page picks its tabs from these.
GRANT SELECT ("had_mode", "bars_mode", "made_mode") ON "public"."profiles" TO "anon";

CREATE FUNCTION "private"."sync_profile_sharing"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.kind <> 'person' THEN
        RETURN NEW;
    END IF;
    -- An app build from before the modes made a profile with a switch moved
    -- from its default: follow it.
    IF TG_OP = 'INSERT' THEN
        IF NEW.shares_rankings AND NEW.had_mode = 'picked' THEN NEW.had_mode := 'all'; END IF;
        IF NEW.shares_bars AND NEW.bars_mode = 'picked' THEN NEW.bars_mode := 'all'; END IF;
        IF NOT NEW.shares_made AND NEW.made_mode = 'all' THEN NEW.made_mode := 'none'; END IF;
    END IF;
    -- Or moved a switch: follow it.
    IF TG_OP = 'UPDATE' THEN
        IF NEW.had_mode = OLD.had_mode AND NEW.shares_rankings IS DISTINCT FROM OLD.shares_rankings THEN
            NEW.had_mode := CASE WHEN NEW.shares_rankings THEN 'all' ELSE 'none' END;
        END IF;
        IF NEW.bars_mode = OLD.bars_mode AND NEW.shares_bars IS DISTINCT FROM OLD.shares_bars THEN
            NEW.bars_mode := CASE WHEN NEW.shares_bars THEN 'all' ELSE 'none' END;
        END IF;
        IF NEW.made_mode = OLD.made_mode AND NEW.shares_made IS DISTINCT FROM OLD.shares_made THEN
            NEW.made_mode := CASE WHEN NEW.shares_made THEN 'all' ELSE 'none' END;
        END IF;
    END IF;
    NEW.shares_rankings := NEW.had_mode = 'all';
    NEW.shares_bars := NEW.bars_mode = 'all';
    NEW.shares_made := NEW.made_mode = 'all';
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."sync_profile_sharing"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "sync_profile_sharing" BEFORE INSERT OR UPDATE OF "had_mode", "bars_mode", "made_mode", "shares_rankings", "shares_bars", "shares_made" ON "public"."profiles"
    FOR EACH ROW EXECUTE FUNCTION "private"."sync_profile_sharing"();

-- --- A drink they've had ---

ALTER TABLE "public"."rank_entries"
    ADD COLUMN "on_profile" boolean,
    ADD COLUMN "profile_pin" smallint,
    ADD CONSTRAINT "rank_entries_profile_pin" CHECK ("profile_pin" BETWEEN 1 AND 4),
    -- A pinned drink is one they show.
    ADD CONSTRAINT "rank_entries_pin_shown" CHECK ("profile_pin" IS NULL OR "on_profile");

CREATE UNIQUE INDEX "rank_entries_profile_pin_key" ON "public"."rank_entries" ("user_id", "profile_pin") WHERE "profile_pin" IS NOT NULL;

-- --- A bar they've been to, or a drink they made ---

CREATE TABLE "public"."profile_picks" (
    "profile_id" "uuid" NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    "section" "text" NOT NULL,
    -- A bar's profile id ('bars') or an item id ('originals').
    "target_id" "uuid" NOT NULL,
    "shown" boolean NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    PRIMARY KEY ("profile_id", "section", "target_id"),
    CONSTRAINT "profile_picks_section" CHECK ("section" IN ('bars', 'originals'))
);

ALTER TABLE "public"."profile_picks" ENABLE ROW LEVEL SECURITY;

-- The person, on their own profile.
CREATE POLICY "profile_picks_own" ON "public"."profile_picks" FOR ALL TO "authenticated"
    USING ("profile_id" IN (SELECT "id" FROM "public"."profiles" WHERE "user_id" = (SELECT "auth"."uid"()) AND "kind" = 'person'))
    WITH CHECK ("profile_id" IN (SELECT "id" FROM "public"."profiles" WHERE "user_id" = (SELECT "auth"."uid"()) AND "kind" = 'person'));

-- Everyone: which drinks a profile they can see shows or hides.
-- No private.* helper here: anon has no USAGE on private.
CREATE POLICY "profile_picks_originals" ON "public"."profile_picks" FOR SELECT TO "anon", "authenticated"
    USING ("section" = 'originals' AND EXISTS (SELECT 1 FROM "public"."profiles" "p" WHERE "p"."id" = "profile_id"));

REVOKE ALL ON "public"."profile_picks" FROM "anon", "authenticated";
GRANT SELECT ON "public"."profile_picks" TO "anon";
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."profile_picks" TO "authenticated";

-- --- What others see ---

-- Whether one item shows in a section, by its mode and the person's pick.
CREATE FUNCTION "private"."picked_shown"("p_mode" "text", "p_pick" boolean) RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT CASE p_mode WHEN 'all' THEN p_pick IS NOT FALSE WHEN 'picked' THEN p_pick IS TRUE ELSE false END;
$$;

DROP FUNCTION "public"."get_profile_drinks"("uuid");

CREATE FUNCTION "public"."get_profile_drinks"("p_profile_id" "uuid")
    RETURNS TABLE(
        "id" "uuid", "item_id" "uuid", "name" "text", "list_name" "text",
        "image_url" "text", "image_is_generated" boolean,
        "at_bar" boolean,
        "venue_id" "uuid", "venue_handle" "text", "venue_name" "text", "venue_avatar_url" "text",
        "venue_locality" "text", "venue_city" "text",
        "sentiment" "public"."rank_sentiment", "score" numeric, "had_on" "date", "created_at" timestamp with time zone,
        "pin" smallint
    )
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  WITH sharer AS (
    SELECT p.id, p.user_id, p.had_mode, p.bars_mode, p.shows_dates
    FROM public.profiles p
    WHERE p.id = p_profile_id
      AND p.kind = 'person' AND p.user_id IS NOT NULL
      AND p.is_public AND p.moderated_at IS NULL AND p.had_mode <> 'none'
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
         s.sentiment, s.score,
         CASE WHEN sharer.shows_dates THEN s.had_on END,
         CASE WHEN sharer.shows_dates THEN s.created_at END,
         e.profile_pin
  FROM sharer
  JOIN public.rank_entry_scores s ON s.user_id = sharer.user_id
  JOIN public.rank_entries e ON e.id = s.id
  LEFT JOIN nameable item ON item.id = s.item_id
  LEFT JOIN nameable list ON list.id = s.ranked_as_item_id
  LEFT JOIN public.profiles v
         ON v.id = s.venue_profile_id AND v.kind = 'bar' AND v.is_public AND v.moderated_at IS NULL
  -- The bar is named only when it shows in their Bars too.
  LEFT JOIN public.profiles shown
         ON shown.id = v.id
        AND private.picked_shown(sharer.bars_mode, (
              SELECT pk.shown FROM public.profile_picks pk
              WHERE pk.profile_id = sharer.id AND pk.section = 'bars' AND pk.target_id = v.id))
  LEFT JOIN LATERAL (
    SELECT im.url, ii.is_generated
    FROM public.item_images ii JOIN public.images im ON im.id = ii.image_id
    WHERE ii.item_id = item.id AND ii.angle = 'hero'
    ORDER BY ii.is_generated, ii.sort_order NULLS LAST, ii.created_at
    LIMIT 1
  ) img ON true
  WHERE COALESCE(item.id, list.id) IS NOT NULL
    AND (s.venue_profile_id IS NULL OR v.id IS NOT NULL)
    AND private.picked_shown(sharer.had_mode, e.on_profile)
  ORDER BY s.score DESC, s.created_at DESC
  LIMIT 500;
$$;

REVOKE EXECUTE ON FUNCTION "public"."get_profile_drinks"("p_profile_id" "uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."get_profile_drinks"("p_profile_id" "uuid") TO "authenticated", "service_role";

CREATE OR REPLACE FUNCTION "public"."get_profile_bars"("p_profile_id" "uuid")
    RETURNS TABLE(
        "venue_id" "uuid", "venue_handle" "text", "venue_name" "text", "venue_avatar_url" "text",
        "venue_locality" "text", "venue_city" "text",
        "drinks" integer, "average" numeric, "best_name" "text", "best_score" numeric
    )
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  WITH sharer AS (
    SELECT p.id, p.user_id, p.had_mode, p.bars_mode
    FROM public.profiles p
    WHERE p.id = p_profile_id
      AND p.kind = 'person' AND p.user_id IS NOT NULL
      AND p.is_public AND p.moderated_at IS NULL AND p.bars_mode <> 'none'
      AND p.user_id NOT IN (SELECT private.blocked_user_ids())
      AND EXISTS (SELECT 1 FROM private.age_checks a WHERE a.user_id = p.user_id AND a.confirmed_at IS NOT NULL)
  ), nameable AS (
    -- As get_profile_drinks: only entries it could show count here.
    SELECT i.id, i.name
    FROM public.items i
    WHERE i.moderated_at IS NULL
      AND (
        (i.bar_id IS NULL AND i.created_by IS NULL)
        OR i.id IN (SELECT pi.id FROM public.published_items pi WHERE NOT pi.is_reference)
      )
  ), had AS (
    SELECT v.id AS venue_id, COALESCE(item.name, list.name) AS name, s.score, s.created_at,
           private.picked_shown(sharer.had_mode, e.on_profile) AS drink_shown
    FROM sharer
    JOIN public.rank_entry_scores s ON s.user_id = sharer.user_id
    JOIN public.rank_entries e ON e.id = s.id
    JOIN public.profiles v
      ON v.id = s.venue_profile_id AND v.kind = 'bar' AND v.is_public AND v.moderated_at IS NULL
    LEFT JOIN nameable item ON item.id = s.item_id
    LEFT JOIN nameable list ON list.id = s.ranked_as_item_id
    WHERE COALESCE(item.id, list.id) IS NOT NULL
      AND private.picked_shown(sharer.bars_mode, (
            SELECT pk.shown FROM public.profile_picks pk
            WHERE pk.profile_id = sharer.id AND pk.section = 'bars' AND pk.target_id = v.id))
  ), tally AS (
    SELECT venue_id, count(*)::integer AS drinks, round(avg(score), 1) AS average
    FROM had GROUP BY venue_id
  ), best AS (
    -- Named only when that drink shows in their Had too.
    SELECT DISTINCT ON (venue_id) venue_id, name, score
    FROM had WHERE drink_shown
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
