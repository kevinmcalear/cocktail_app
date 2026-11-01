-- Scores as the published method says (Loop-ladder "How scores work",
-- Red-score, Kept-score, Loop-reasons):
--
--   * Older ranks count less: a person's rank counts in full for 180 days,
--     then half (private.score_weight).
--   * A new spec starts a new score: a drink's score comes from ranks of its
--     current spec (item_versions; version 1 is the first spec, so a drink
--     never changed has one score). Until anyone ranks the new spec, the score
--     carries the old one, so a bar doesn't drop off a list the hour it tweaks
--     a spec. The floor (20 people) still counts every spec.
--   * A bar's score comes from its drinks, each weighted by how many people
--     ranked it and how recently, and shows once 20 people and 50 ranks are
--     in: on its page (get_venue_score, get_bar_score) and in Discover
--     (discover_top_bars), the same rule everywhere.
--
-- Recreates the three score views (private.venue_drink_scores, item_scores,
-- venue_scores) with the same columns plus new ones, so every existing read
-- keeps working, and adds new reads: a drink's score and history (anyone),
-- a bar's score and best drinks (anyone), what guests say about a drink
-- (its bar's Drink Creators), a bartender's own drinks (just them) and the
-- room (the bar's Admins).
--
-- Floors: people 20 (private.ranking_min_rankers, unchanged), a bar's drinks
-- together 50 ranks, reasons and room 20 people. The 50 and the list floor
-- (5 bars, applied by the app) are the canvas's placeholders until Kevin sets
-- them; lib/scoreLadder.ts holds the same numbers and its check reads them
-- from here.

-- --- the rules ---

CREATE FUNCTION "private"."score_floor"("p_name" "text") RETURNS integer
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT CASE p_name
    WHEN 'people' THEN private.ranking_min_rankers()
    WHEN 'bar_ranks' THEN 50
    WHEN 'list_bars' THEN 5
    WHEN 'reasons' THEN 20
    WHEN 'room' THEN 20
  END;
$$;

COMMENT ON FUNCTION "private"."score_floor"("text") IS
    'The score ladder''s floors by name. Mirrors FLOORS in lib/scoreLadder.ts (checked by lib/scoreLadder.check.ts).';

-- A rank counts in full for 180 days after the drink was had, then half.
CREATE FUNCTION "private"."score_weight"("p_on" "date", "p_at" "date" DEFAULT CURRENT_DATE) RETURNS numeric
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT CASE WHEN p_on >= p_at - 180 THEN 1.0 ELSE 0.5 END;
$$;

-- When a drink's current spec began, as of a day: the newest version on or
-- before it, and null for version 1 (the first spec, nothing before it).
CREATE FUNCTION "private"."spec_since"("p_item_id" "uuid", "p_at" timestamp with time zone DEFAULT "now"()) RETURNS TABLE("version" integer, "since" timestamp with time zone)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT v.version, CASE WHEN v.version > 1 THEN v.created_at END
  FROM public.item_versions v
  WHERE v.item_id = p_item_id AND v.created_at <= p_at
  ORDER BY v.version DESC
  LIMIT 1;
$$;

-- Every counted rank (confirmed age) with the day it was had and whether it
-- was given to its drink's current spec. Staff at their own bar are left out
-- by each score, as before.
CREATE VIEW "private"."counted_ranks" AS
  SELECT s.id, s.user_id, s.item_id, s.ranked_as_item_id, s.venue_profile_id, s.sentiment, s.score, s.created_at,
         COALESCE(s.had_on, s.created_at::date) AS on_date,
         (sp.since IS NULL OR COALESCE(s.had_on, s.created_at::date) >= sp.since::date) AS is_current
  FROM private.counted_rank_scores s
  LEFT JOIN LATERAL private.spec_since(s.item_id) sp ON true;

-- --- the score views, same columns plus new ones ---

DROP MATERIALIZED VIEW "private"."venue_scores";
DROP MATERIALIZED VIEW "private"."venue_drink_scores";
DROP MATERIALIZED VIEW "private"."item_scores";

-- One drink at one bar. rankers: people, every spec (the floor). score: from
-- ranks of the current spec when there are any, else every spec; each
-- person's best, weighted by their newest rank's age, pulled towards the
-- drink's mean by 10 ranks' worth. weight: the people behind the score,
-- weighted by age (the bar score uses it).
CREATE MATERIALIZED VIEW "private"."venue_drink_scores" AS
  WITH per_user AS (
    SELECT s.ranked_as_item_id, s.venue_profile_id, s.user_id,
           max(s.score) AS score_all,
           max(s.score) FILTER (WHERE s.is_current) AS score_now,
           max(private.score_weight(s.on_date)) AS w_all,
           max(private.score_weight(s.on_date)) FILTER (WHERE s.is_current) AS w_now
    FROM private.counted_ranks s
    JOIN public.profiles p ON p.id = s.venue_profile_id
    WHERE NOT EXISTS (SELECT 1 FROM public.user_bars ub WHERE ub.user_id = s.user_id AND ub.bar_id = p.bar_id)
    GROUP BY s.ranked_as_item_id, s.venue_profile_id, s.user_id
  ), drink_mean AS (
    SELECT ranked_as_item_id, avg(score_all) AS mean FROM per_user GROUP BY ranked_as_item_id
  )
  SELECT pu.ranked_as_item_id, pu.venue_profile_id,
         count(*)::integer AS rankers,
         round(CASE WHEN count(pu.score_now) > 0
           THEN (sum(pu.w_now * pu.score_now) + 10 * dm.mean) / (sum(pu.w_now) + 10)
           ELSE (sum(pu.w_all * pu.score_all) + 10 * dm.mean) / (sum(pu.w_all) + 10)
         END, 1) AS score,
         count(pu.score_now)::integer AS current_rankers,
         COALESCE(sum(pu.w_now), sum(pu.w_all)) AS weight
  FROM per_user pu
  JOIN drink_mean dm USING (ranked_as_item_id)
  GROUP BY pu.ranked_as_item_id, pu.venue_profile_id, dm.mean;

CREATE UNIQUE INDEX "venue_drink_scores_key" ON "private"."venue_drink_scores" ("ranked_as_item_id", "venue_profile_id");

-- One drink anywhere, by the people who didn't make it. Same rules.
CREATE MATERIALIZED VIEW "private"."item_scores" AS
  WITH per_user AS (
    SELECT s.item_id, s.user_id,
           max(s.score) AS score_all,
           max(s.score) FILTER (WHERE s.is_current) AS score_now,
           max(private.score_weight(s.on_date)) AS w_all,
           max(private.score_weight(s.on_date)) FILTER (WHERE s.is_current) AS w_now
    FROM private.counted_ranks s
    JOIN public.items i ON i.id = s.item_id
    LEFT JOIN public.profiles c ON c.id = i.creator_profile_id
    WHERE c.user_id IS DISTINCT FROM s.user_id
    GROUP BY s.item_id, s.user_id
  ), overall AS (
    SELECT avg(score_all) AS mean FROM per_user
  )
  SELECT pu.item_id,
         count(*)::integer AS rankers,
         round(CASE WHEN count(pu.score_now) > 0
           THEN (sum(pu.w_now * pu.score_now) + 10 * o.mean) / (sum(pu.w_now) + 10)
           ELSE (sum(pu.w_all * pu.score_all) + 10 * o.mean) / (sum(pu.w_all) + 10)
         END, 1) AS score,
         count(pu.score_now)::integer AS current_rankers
  FROM per_user pu, overall o
  GROUP BY pu.item_id, o.mean;

CREATE UNIQUE INDEX "item_scores_key" ON "private"."item_scores" ("item_id");

-- A bar: its drinks' scores, each weighted by its people and their ranks' age.
-- rankers: distinct people (the 20 floor, as before); ranks: people summed
-- over its drinks (the 50 floor for a bar's drinks together).
CREATE MATERIALIZED VIEW "private"."venue_scores" AS
  WITH people AS (
    SELECT s.venue_profile_id, count(DISTINCT s.user_id)::integer AS rankers, min(s.on_date) AS since
    FROM private.counted_ranks s
    JOIN public.profiles p ON p.id = s.venue_profile_id
    WHERE NOT EXISTS (SELECT 1 FROM public.user_bars ub WHERE ub.user_id = s.user_id AND ub.bar_id = p.bar_id)
    GROUP BY s.venue_profile_id
  )
  SELECT v.venue_profile_id,
         round(sum(v.score * v.weight) / sum(v.weight), 1) AS score,
         pe.rankers,
         count(*)::integer AS drinks,
         sum(v.rankers)::integer AS ranks,
         pe.since
  FROM private.venue_drink_scores v
  JOIN people pe USING (venue_profile_id)
  GROUP BY v.venue_profile_id, pe.rankers, pe.since;

CREATE UNIQUE INDEX "venue_scores_key" ON "private"."venue_scores" ("venue_profile_id");

-- --- shared helpers for the reads ---

-- A public bar page anyone may read scores on (as get_drink_rankings).
CREATE FUNCTION "private"."is_scored_bar"("p_profile_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_profile_id AND p.kind = 'bar' AND p.is_public AND p.moderated_at IS NULL
      AND p.id NOT IN (SELECT private.private_page_profile_ids())
  );
$$;

-- A drink's place: its bar's page, and what it's ranked as there (the list it
-- sits in). A bar's own drink, or a signature added for the bar's page.
CREATE FUNCTION "private"."drink_place"("p_item_id" "uuid") RETURNS TABLE("venue_profile_id" "uuid", "ranked_as_item_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT v.id,
         COALESCE(
           (SELECT e.ranked_as_item_id FROM public.rank_entries e
             WHERE e.item_id = i.id AND e.venue_profile_id = v.id
             GROUP BY e.ranked_as_item_id ORDER BY count(*) DESC, e.ranked_as_item_id LIMIT 1),
           CASE WHEN i.riff_of_id IS NOT NULL AND (riff.is_catalog OR i.origin = 'Classic') THEN i.riff_of_id ELSE i.id END
         )
  FROM public.items i
  LEFT JOIN public.items riff ON riff.id = i.riff_of_id
  JOIN public.profiles v ON v.kind = 'bar' AND (
         (i.bar_id IS NOT NULL AND v.bar_id = i.bar_id)
      OR (i.bar_id IS NULL AND i.created_by IS NULL AND v.id = i.origin_bar_profile_id))
  WHERE i.id = p_item_id
  LIMIT 1;
$$;

-- One drink at one bar as of a day: each person's best rank by then, given to
-- the spec in force then, weighted by its age then. The history and the
-- room's "since" use it; the live score is venue_drink_scores.
-- ponytail: a rank's 0 to 10 score is where it sits in the person's list now,
-- not then; keeping each day's list would need a snapshot table.
CREATE FUNCTION "private"."drink_score_at"("p_ranked_as_item_id" "uuid", "p_venue_profile_id" "uuid", "p_at" "date") RETURNS TABLE("score" numeric, "rankers" integer, "version" integer)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  WITH every_bar AS (
    -- Every bar's ranks of this drink by then: the mean a score is pulled towards.
    SELECT rs.user_id, rs.venue_profile_id, rs.score, COALESCE(rs.had_on, rs.created_at::date) AS on_date, rs.item_id
    FROM private.counted_rank_scores rs
    JOIN public.profiles p ON p.id = rs.venue_profile_id
    WHERE rs.ranked_as_item_id = p_ranked_as_item_id
      AND rs.created_at::date <= p_at AND COALESCE(rs.had_on, rs.created_at::date) <= p_at
      AND NOT EXISTS (SELECT 1 FROM public.user_bars ub WHERE ub.user_id = rs.user_id AND ub.bar_id = p.bar_id)
  ), drink_mean AS (
    SELECT avg(best) AS mean FROM (SELECT max(score) AS best FROM every_bar GROUP BY venue_profile_id, user_id) b
  ), ranks AS (
    SELECT * FROM every_bar WHERE venue_profile_id = p_venue_profile_id
  ), tagged AS (
    SELECT r.*, sp.version, (sp.since IS NULL OR r.on_date >= sp.since::date) AS is_current
    FROM ranks r
    LEFT JOIN LATERAL private.spec_since(r.item_id, (p_at + 1)::timestamptz) sp ON true
  ), per_user AS (
    SELECT user_id, max(score) AS score_all, max(score) FILTER (WHERE is_current) AS score_now,
           max(private.score_weight(on_date, p_at)) AS w_all,
           max(private.score_weight(on_date, p_at)) FILTER (WHERE is_current) AS w_now,
           max(version) AS version
    FROM tagged GROUP BY user_id
  )
  SELECT round(CASE WHEN count(score_now) > 0
           THEN (sum(w_now * score_now) + 10 * dm.mean) / (sum(w_now) + 10)
           ELSE (sum(w_all * score_all) + 10 * dm.mean) / (sum(w_all) + 10) END, 1),
         count(*)::integer,
         max(version)
  FROM per_user, drink_mean dm
  GROUP BY dm.mean
  HAVING count(*) > 0;
$$;

-- --- a drink's score: the ladder on its page, and its score page ---

CREATE FUNCTION "public"."get_drink_score"("p_item_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_place record;
  v_bar public.profiles;
  v_floor integer := private.score_floor('people');
  v_row private.venue_drink_scores;
  v_bar_score private.venue_scores;
  v_spec record;
  v_prev jsonb;
  v_history jsonb;
  v_recent integer;
  v_older integer;
  v_city jsonb;
  v_postcode jsonb;
BEGIN
  SELECT * INTO v_place FROM private.drink_place(p_item_id);
  IF v_place.venue_profile_id IS NULL OR NOT private.is_scored_bar(v_place.venue_profile_id)
     OR NOT private.is_listed_drink(p_item_id) THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_bar FROM public.profiles WHERE id = v_place.venue_profile_id;
  SELECT * INTO v_row FROM private.venue_drink_scores
    WHERE ranked_as_item_id = v_place.ranked_as_item_id AND venue_profile_id = v_place.venue_profile_id;
  SELECT * INTO v_bar_score FROM private.venue_scores WHERE venue_profile_id = v_place.venue_profile_id;
  SELECT * INTO v_spec FROM private.spec_since(p_item_id);

  -- People whose newest rank here is within 180 days, and the rest.
  SELECT count(*) FILTER (WHERE newest >= CURRENT_DATE - 180), count(*) FILTER (WHERE newest < CURRENT_DATE - 180)
    INTO v_recent, v_older
  FROM (
    SELECT s.user_id, max(s.on_date) AS newest
    FROM private.counted_ranks s
    WHERE s.ranked_as_item_id = v_place.ranked_as_item_id AND s.venue_profile_id = v_place.venue_profile_id
      AND NOT EXISTS (SELECT 1 FROM public.user_bars ub WHERE ub.user_id = s.user_id AND ub.bar_id = v_bar.bar_id)
    GROUP BY s.user_id
  ) n;

  IF COALESCE(v_row.rankers, 0) >= v_floor THEN
    -- The score before this spec: as it stood the day before the change.
    IF v_spec.since IS NOT NULL THEN
      SELECT jsonb_build_object(
               'version', v_spec.version - 1,
               'score', a.score,
               'rankers', a.rankers,
               'from', (SELECT min(v.created_at)::date FROM public.item_versions v WHERE v.item_id = p_item_id AND v.version = v_spec.version - 1),
               'to', v_spec.since::date)
        INTO v_prev
      FROM private.drink_score_at(v_place.ranked_as_item_id, v_place.venue_profile_id, v_spec.since::date - 1) a
      WHERE a.rankers >= v_floor;
    END IF;

    -- The last six months, each as it stood at the month's end (or today).
    SELECT jsonb_agg(jsonb_build_object('month', m.month, 'score', a.score, 'version', a.version) ORDER BY m.month)
      INTO v_history
    FROM (
      SELECT d::date AS month, least((d + interval '1 month - 1 day')::date, CURRENT_DATE) AS at
      FROM generate_series(date_trunc('month', CURRENT_DATE) - interval '5 months', date_trunc('month', CURRENT_DATE), interval '1 month') d
    ) m
    CROSS JOIN LATERAL private.drink_score_at(v_place.ranked_as_item_id, v_place.venue_profile_id, m.at) a
    WHERE a.rankers >= v_floor;

    -- Where it sits in its city's and postcode's lists, and how many bars are on them.
    SELECT jsonb_build_object('name', v_bar.city, 'bars', count(*),
             'position', count(*) FILTER (WHERE o.score > v_row.score OR (o.score = v_row.score AND o.rankers > v_row.rankers)) + 1)
      INTO v_city
    FROM private.venue_drink_scores o JOIN public.profiles op ON op.id = o.venue_profile_id
    WHERE v_bar.city IS NOT NULL AND o.ranked_as_item_id = v_place.ranked_as_item_id AND o.rankers >= v_floor
      AND lower(op.city) = lower(v_bar.city) AND op.country_code = v_bar.country_code AND private.is_scored_bar(op.id);
    SELECT jsonb_build_object('name', v_bar.postcode, 'bars', count(*),
             'position', count(*) FILTER (WHERE o.score > v_row.score OR (o.score = v_row.score AND o.rankers > v_row.rankers)) + 1)
      INTO v_postcode
    FROM private.venue_drink_scores o JOIN public.profiles op ON op.id = o.venue_profile_id
    WHERE v_bar.postcode IS NOT NULL AND o.ranked_as_item_id = v_place.ranked_as_item_id AND o.rankers >= v_floor
      AND op.postcode = v_bar.postcode AND op.country_code = v_bar.country_code AND private.is_scored_bar(op.id);
  END IF;

  RETURN jsonb_build_object(
    'name', (SELECT i.name FROM public.items i WHERE i.id = p_item_id),
    'ranked_as_name', (SELECT i.name FROM public.items i WHERE i.id = v_place.ranked_as_item_id),
    'venue_profile_id', v_bar.id,
    'bar_name', v_bar.display_name,
    'city', v_bar.city,
    'postcode', v_bar.postcode,
    'country_code', v_bar.country_code,
    'ranked_as_item_id', v_place.ranked_as_item_id,
    'floor', v_floor,
    'rankers', COALESCE(v_row.rankers, 0),
    'score', CASE WHEN v_row.rankers >= v_floor THEN v_row.score END,
    'current_rankers', CASE WHEN v_row.rankers >= v_floor THEN v_row.current_rankers END,
    'version', v_spec.version,
    'spec_since', v_spec.since::date,
    'recent', CASE WHEN v_row.rankers >= v_floor THEN v_recent END,
    'older', CASE WHEN v_row.rankers >= v_floor THEN v_older END,
    'previous', v_prev,
    'history', COALESCE(v_history, '[]'::jsonb),
    'city_list', v_city,
    'postcode_list', v_postcode,
    'bar', jsonb_build_object(
      'floor', private.score_floor('bar_ranks'),
      'ranks', COALESCE(v_bar_score.ranks, 0),
      'since', v_bar_score.since,
      'score', CASE WHEN v_bar_score.ranks >= private.score_floor('bar_ranks') AND v_bar_score.rankers >= v_floor THEN v_bar_score.score END),
    'list_floor', private.score_floor('list_bars')
  );
END;
$$;

COMMENT ON FUNCTION "public"."get_drink_score"("uuid") IS
    'A bar drink''s public score: people so far against the floor, the score once past it (current spec, recency weighted), the score before this spec, six months of history, its place in the city and postcode lists, and its bar''s pooled score once 50 ranks are in. Null for a drink with no public bar page.';

-- --- a bar's score and its best drinks (Kept-score) ---

CREATE FUNCTION "public"."get_bar_score"("p_profile_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  WITH bar AS (
    SELECT p.* FROM public.profiles p WHERE p.id = p_profile_id AND private.is_scored_bar(p.id)
  ), s AS (
    SELECT v.* FROM private.venue_scores v JOIN bar ON bar.id = v.venue_profile_id
  ), drinks AS (
    SELECT v.ranked_as_item_id, v.score, v.rankers,
           (SELECT count(*) + 1 FROM private.venue_drink_scores o JOIN public.profiles op ON op.id = o.venue_profile_id
             WHERE o.ranked_as_item_id = v.ranked_as_item_id AND o.rankers >= private.score_floor('people')
               AND (o.score > v.score OR (o.score = v.score AND o.rankers > v.rankers))
               AND lower(op.city) = lower(bar.city) AND op.country_code = bar.country_code AND private.is_scored_bar(op.id))::integer AS city_position,
           (SELECT count(*) FROM private.venue_drink_scores o JOIN public.profiles op ON op.id = o.venue_profile_id
             WHERE o.ranked_as_item_id = v.ranked_as_item_id AND o.rankers >= private.score_floor('people')
               AND lower(op.city) = lower(bar.city) AND op.country_code = bar.country_code AND private.is_scored_bar(op.id))::integer AS city_bars
    FROM private.venue_drink_scores v CROSS JOIN bar
    WHERE v.venue_profile_id = bar.id AND v.rankers >= private.score_floor('people')
  ), named AS (
    -- The bar's own drink in that list, as get_bar_top_drinks picks it.
    SELECT d.*, t.item_id, t.name, t.ranked_as_name, t.image_url, t.image_is_generated
    FROM drinks d
    JOIN public.get_bar_top_drinks(p_profile_id, 100) t ON t.ranked_as_item_id = d.ranked_as_item_id AND t.score IS NOT NULL
  )
  SELECT CASE WHEN EXISTS (SELECT 1 FROM bar) THEN jsonb_build_object(
    'floor', private.score_floor('bar_ranks'),
    'ranks', COALESCE((SELECT ranks FROM s), 0),
    'rankers', COALESCE((SELECT rankers FROM s), 0),
    'drinks', (SELECT count(*) FROM drinks),
    'city', (SELECT city FROM bar),
    'score', (SELECT CASE WHEN s.ranks >= private.score_floor('bar_ranks') AND s.rankers >= private.score_floor('people') THEN s.score END FROM s),
    'best', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'item_id', n.item_id, 'name', n.name, 'ranked_as_item_id', n.ranked_as_item_id, 'ranked_as_name', n.ranked_as_name,
        'image_url', n.image_url, 'image_is_generated', n.image_is_generated,
        'score', n.score, 'rankers', n.rankers, 'city_position', n.city_position, 'city_bars', n.city_bars)
        ORDER BY n.score DESC, n.rankers DESC) FROM (SELECT * FROM named ORDER BY score DESC, rankers DESC LIMIT 3) n), '[]'::jsonb)
  ) END;
$$;

COMMENT ON FUNCTION "public"."get_bar_score"("uuid") IS
    'A public bar''s score from its drinks (once 50 ranks and 20 people are in), its ranks, people and scored drinks, and its best three with their place in the city list.';

-- --- what guests say: a drink, for its bar's Drink Creators (Loop-reasons) ---

-- Each person's newest rank of a drink, with the spec version it was given to.
CREATE FUNCTION "private"."drink_ranks_by_version"("p_item_id" "uuid") RETURNS TABLE("user_id" "uuid", "version" integer, "sentiment" "public"."rank_sentiment", "reasons" "text"[], "on_date" "date")
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT DISTINCT ON (e.user_id, ver.version) e.user_id, COALESCE(ver.version, 1), e.sentiment, e.reasons, COALESCE(e.had_on, e.created_at::date)
  FROM public.rank_entries e
  JOIN private.age_checks a ON a.user_id = e.user_id AND a.confirmed_at IS NOT NULL
  JOIN public.items i ON i.id = e.item_id
  LEFT JOIN LATERAL (
    SELECT max(v.version) AS version FROM public.item_versions v
    WHERE v.item_id = e.item_id AND (v.version = 1 OR v.created_at::date <= COALESCE(e.had_on, e.created_at::date))
  ) ver ON true
  WHERE e.item_id = p_item_id
    AND NOT EXISTS (SELECT 1 FROM public.user_bars ub WHERE ub.user_id = e.user_id AND ub.bar_id = i.bar_id)
  ORDER BY e.user_id, ver.version, e.created_at DESC;
$$;

CREATE FUNCTION "public"."get_drink_guest_says"("p_item_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_bar uuid;
  v_floor integer := private.score_floor('reasons');
BEGIN
  SELECT bar_id INTO v_bar FROM public.items WHERE id = p_item_id;
  IF v_bar IS NULL OR NOT ('edit_drinks' = ANY (private.capabilities(v_bar)) OR private.is_app_admin()) THEN
    RAISE EXCEPTION 'Only the bar''s Drink Creators see what guests say' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object('floor', v_floor, 'versions', COALESCE((
    SELECT jsonb_agg(x ORDER BY (x->>'version')::integer DESC) FROM (
      SELECT jsonb_build_object(
        'version', r.version,
        'since', (SELECT v.created_at::date FROM public.item_versions v WHERE v.item_id = p_item_id AND v.version = r.version),
        'rankers', count(*),
        'liked', CASE WHEN count(*) >= v_floor THEN count(*) FILTER (WHERE r.sentiment = 'loved') END,
        'fine', CASE WHEN count(*) >= v_floor THEN count(*) FILTER (WHERE r.sentiment = 'fine') END,
        'not_for_me', CASE WHEN count(*) >= v_floor THEN count(*) FILTER (WHERE r.sentiment = 'disliked') END,
        'reasons', CASE WHEN count(*) >= v_floor THEN (
          SELECT COALESCE(jsonb_object_agg(k, n), '{}'::jsonb) FROM (
            SELECT k, count(*) AS n FROM private.drink_ranks_by_version(p_item_id) rr, unnest(rr.reasons) k
            WHERE rr.version = r.version GROUP BY k) t) END
      ) AS x
      FROM private.drink_ranks_by_version(p_item_id) r
      GROUP BY r.version
      ORDER BY r.version DESC
      LIMIT 3
    ) l), '[]'::jsonb));
END;
$$;

COMMENT ON FUNCTION "public"."get_drink_guest_says"("uuid") IS
    'What guests say about one of a bar''s drinks, by spec version, for its Drink Creators: people, and once 20 have ranked that version, liked / fine / not for me and reason totals. Never who said it.';

-- --- your drinks: what guests say about the drinks credited to you ---

CREATE FUNCTION "public"."get_my_drinks_guest_says"() RETURNS TABLE("item_id" "uuid", "name" "text", "rankers" integer, "liked" integer, "reasons" "jsonb", "floor" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  WITH mine AS (
    SELECT DISTINCT i.id, i.name, (SELECT max(v.version) FROM public.item_versions v WHERE v.item_id = i.id) AS version
    FROM public.item_credits c
    JOIN public.profiles me ON me.id = c.profile_id AND me.user_id = auth.uid()
    JOIN public.items i ON i.id = c.item_id
    WHERE c.what = 'drink' AND c.role IN ('creator', 'co_creator') AND c.status IN ('accepted', 'verified')
  ), counted AS (
    SELECT m.id, m.name, r.sentiment, r.reasons
    FROM mine m
    CROSS JOIN LATERAL private.drink_ranks_by_version(m.id) r
    WHERE r.version = COALESCE(m.version, 1)
  ), fl AS (SELECT private.score_floor('reasons') AS n)
  SELECT m.id, m.name,
         count(c.sentiment)::integer,
         CASE WHEN count(c.sentiment) >= f.n THEN (count(*) FILTER (WHERE c.sentiment = 'loved'))::integer END,
         CASE WHEN count(c.sentiment) >= f.n THEN (
           SELECT COALESCE(jsonb_object_agg(k, n), '{}'::jsonb) FROM (
             SELECT k, count(*) AS n FROM counted c2, unnest(c2.reasons) k WHERE c2.id = m.id GROUP BY k) t) END,
         f.n
  FROM mine m CROSS JOIN fl f
  LEFT JOIN counted c ON c.id = m.id
  GROUP BY m.id, m.name, f.n
  ORDER BY count(c.sentiment) DESC, m.name;
$$;

COMMENT ON FUNCTION "public"."get_my_drinks_guest_says"() IS
    'The drinks credited to the caller, with what guests say about each one''s current spec: people, and once 20, liked and reason totals. Only the caller''s own.';

-- --- the room: what guests say about a bar, for its Admins (Kept-score) ---

CREATE FUNCTION "public"."get_bar_guest_says"("p_bar_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_profile uuid;
  v_floor integer := private.score_floor('room');
  v_menu record;
  v_people integer;
  v_room_people integer;
  v_score numeric;
  v_then numeric;
BEGIN
  IF NOT ('staff' = ANY (private.capabilities(p_bar_id)) OR private.is_app_admin()) THEN
    RAISE EXCEPTION 'Only the bar''s Admins see what guests say about it' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO v_profile FROM public.profiles WHERE bar_id = p_bar_id AND kind = 'bar' LIMIT 1;
  SELECT m.name, m.starts_at::date AS since INTO v_menu FROM public.menus m
    WHERE m.bar_id = p_bar_id AND m.is_active AND m.starts_at IS NOT NULL AND m.starts_at <= now()
    ORDER BY m.starts_at DESC LIMIT 1;

  SELECT count(DISTINCT e.user_id), count(DISTINCT e.user_id) FILTER (WHERE cardinality(e.room_reasons) > 0)
    INTO v_people, v_room_people
  FROM public.rank_entries e
  JOIN private.age_checks a ON a.user_id = e.user_id AND a.confirmed_at IS NOT NULL
  WHERE e.venue_profile_id = v_profile AND COALESCE(e.had_on, e.created_at::date) >= CURRENT_DATE - 90
    AND NOT EXISTS (SELECT 1 FROM public.user_bars ub WHERE ub.user_id = e.user_id AND ub.bar_id = p_bar_id);

  SELECT score INTO v_score FROM private.venue_scores WHERE venue_profile_id = v_profile;
  IF v_menu.since IS NOT NULL THEN
    -- The bar's score the day before the menu went on: its drinks then, weighted the same way.
    SELECT round(sum(a.score * a.rankers) / NULLIF(sum(a.rankers), 0), 1) INTO v_then
    FROM (SELECT DISTINCT ranked_as_item_id FROM private.venue_drink_scores WHERE venue_profile_id = v_profile) d
    CROSS JOIN LATERAL private.drink_score_at(d.ranked_as_item_id, v_profile, v_menu.since - 1) a;
  END IF;

  RETURN jsonb_build_object(
    'floor', v_floor,
    'people', v_people,
    'room_people', v_room_people,
    'score', v_score,
    'menu', v_menu.name,
    'change', CASE WHEN v_score IS NOT NULL AND v_then IS NOT NULL THEN v_score - v_then END,
    'room', CASE WHEN v_room_people >= v_floor THEN (
      SELECT COALESCE(jsonb_object_agg(k, n), '{}'::jsonb) FROM (
        SELECT k, count(DISTINCT e.user_id) AS n
        FROM public.rank_entries e
        JOIN private.age_checks a ON a.user_id = e.user_id AND a.confirmed_at IS NOT NULL
        CROSS JOIN LATERAL unnest(e.room_reasons) k
        WHERE e.venue_profile_id = v_profile AND COALESCE(e.had_on, e.created_at::date) >= CURRENT_DATE - 90
          AND NOT EXISTS (SELECT 1 FROM public.user_bars ub WHERE ub.user_id = e.user_id AND ub.bar_id = p_bar_id)
        GROUP BY k) t) END
  );
END;
$$;

COMMENT ON FUNCTION "public"."get_bar_guest_says"("uuid") IS
    'What guests say about a bar, for its Admins: its drinks'' score and the change since the current menu went on, people in the last 90 days, and once 20 of them said something about the room, the room''s totals. Never who said it.';

-- --- a bar's score everywhere: 20 people and 50 ranks, as its page says ---

-- The bar's own page header, as before, with the 50 ranks.
CREATE OR REPLACE FUNCTION "public"."get_venue_score"("p_venue_profile_id" "uuid") RETURNS TABLE("score" numeric, "rankers" integer, "drinks" integer, "is_early" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT CASE WHEN s.rankers >= private.score_floor('people') AND s.ranks >= private.score_floor('bar_ranks') THEN s.score END,
         s.rankers, s.drinks, NOT (s.rankers >= private.score_floor('people') AND s.ranks >= private.score_floor('bar_ranks'))
  FROM private.venue_scores s
  JOIN public.profiles p ON p.id = s.venue_profile_id
  WHERE s.venue_profile_id = p_venue_profile_id AND p.kind = 'bar' AND p.is_public
    AND p.id NOT IN (SELECT private.private_page_profile_ids());
$$;

-- Discover's bars, as before, ranked once a bar has 20 people and 50 ranks.
CREATE OR REPLACE FUNCTION "public"."discover_top_bars"("p_latitude" double precision DEFAULT NULL::double precision, "p_longitude" double precision DEFAULT NULL::double precision, "p_radius_km" double precision DEFAULT 10, "p_country_code" "text" DEFAULT NULL::"text", "p_city" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 20) RETURNS TABLE("position" bigint, "venue_profile_id" "uuid", "handle" "text", "display_name" "text", "locality" "text", "city" "text", "latitude" double precision, "longitude" double precision, "distance_km" double precision, "score" numeric, "rankers" integer, "drinks" integer, "is_early" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  WITH area AS MATERIALIZED (
    SELECT * FROM private.bars_in_area(p_latitude, p_longitude, p_radius_km, p_country_code, p_city)
  ), rows AS (
    SELECT a.id AS venue_profile_id, s.score, coalesce(s.rankers, 0) AS rankers, coalesce(s.drinks, 0) AS drinks,
           a.distance_km,
           coalesce(s.rankers, 0) >= private.score_floor('people') AND coalesce(s.ranks, 0) >= private.score_floor('bar_ranks') AS ranked,
           r.loved, r.stale, r.relevance
    FROM area a
    JOIN private.bar_relevance(ARRAY(SELECT area.id FROM area)) r ON r.id = a.id
    -- A Private bar stays on the map, unscored.
    LEFT JOIN private.venue_scores s ON s.venue_profile_id = a.id AND a.id NOT IN (SELECT private.private_page_profile_ids())
  ), numbered AS (
    SELECT r.*, row_number() OVER (
      PARTITION BY r.ranked
      ORDER BY CASE WHEN r.ranked THEN r.score END DESC NULLS LAST,
               CASE WHEN NOT r.ranked THEN r.loved END DESC,
               r.rankers DESC, r.relevance DESC, r.distance_km NULLS LAST,
               lower(p.display_name), r.venue_profile_id
    ) AS n
    FROM rows r
    JOIN public.profiles p ON p.id = r.venue_profile_id
    -- Stale bars drop off, unless loved by the viewer or ranked there.
    WHERE r.ranked OR r.loved OR r.rankers > 0 OR NOT r.stale
  )
  SELECT CASE WHEN x.ranked THEN x.n END, p.id, p.handle, p.display_name, p.locality, p.city, p.latitude, p.longitude,
         x.distance_km, CASE WHEN x.ranked THEN x.score END, x.rankers, x.drinks, NOT x.ranked
  FROM numbered x
  JOIN public.profiles p ON p.id = x.venue_profile_id
  WHERE x.n <= least(greatest(coalesce(p_limit, 20), 1), 100)
  ORDER BY x.ranked DESC, x.n;
$$;

-- --- grants ---

REVOKE ALL ON FUNCTION "private"."score_floor"("text") FROM PUBLIC, "anon", "authenticated";
REVOKE ALL ON FUNCTION "private"."score_weight"("date", "date") FROM PUBLIC, "anon", "authenticated";
REVOKE ALL ON FUNCTION "private"."spec_since"("uuid", timestamp with time zone) FROM PUBLIC, "anon", "authenticated";
REVOKE ALL ON FUNCTION "private"."is_scored_bar"("uuid") FROM PUBLIC, "anon", "authenticated";
REVOKE ALL ON FUNCTION "private"."drink_place"("uuid") FROM PUBLIC, "anon", "authenticated";
REVOKE ALL ON FUNCTION "private"."drink_score_at"("uuid", "uuid", "date") FROM PUBLIC, "anon", "authenticated";
REVOKE ALL ON FUNCTION "private"."drink_ranks_by_version"("uuid") FROM PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."get_drink_score"("uuid") FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."get_bar_score"("uuid") FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."get_drink_guest_says"("uuid") FROM PUBLIC, "anon";
REVOKE ALL ON FUNCTION "public"."get_my_drinks_guest_says"() FROM PUBLIC, "anon";
REVOKE ALL ON FUNCTION "public"."get_bar_guest_says"("uuid") FROM PUBLIC, "anon";

GRANT EXECUTE ON FUNCTION "public"."get_drink_score"("uuid") TO "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_bar_score"("uuid") TO "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_drink_guest_says"("uuid") TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_my_drinks_guest_says"() TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_bar_guest_says"("uuid") TO "authenticated";
