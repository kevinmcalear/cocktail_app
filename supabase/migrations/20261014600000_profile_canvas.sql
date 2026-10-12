-- DRAFT. Local stack only. Needs Kevin's review (human-approved) first.
--
-- Profiles as the whole-app canvas draws them (decisions of 10 Oct 2026).
--
-- 1. Dates on jobs (b09). profile_positions.start_year/start_month and
--    end_year/end_month: "Little Rye · 2023 to now", "Pale Moth · 2019 to
--    2023". Months are optional; a current job has no end. Onboarding reuses
--    them. Changing the title still asks the bar again; dates don't.
--
-- 2. A Shown switch on every job, the current one too (b55).
--    profile_positions.is_hidden is the person's off switch and wins over
--    everything: others read a job only when it isn't hidden and is current or
--    switched on (is_shown, 20261007120000). Anyone who can edit the row can
--    hide it; only the person can show it again.
--
-- 3. People add their own awards (b21). profile_awards gains:
--      status          'confirmed' (every award today), 'pending' (one a
--                      person sent, until a moderator checks the source) or
--                      'declined'. Only confirmed ones are public.
--      added_by        who sent it; null for the ones we researched.
--      is_finalist     "Finalist" instead of a win.
--      bar_profile_id  the bar they were at: "at Little Rye".
--      on_profile      the person's pick: shown, hidden, or following
--                      profiles.awards_mode (null), like rank_entries.
--    profiles.awards_mode: all / picked / none, as the other sections
--    (20261010710000). A person sends an award for their own profile; it
--    comes in pending, at most 10 waiting at once, screened like other public
--    text. They can show or hide it, and remove one they sent. Moderators (the
--    existing admin policy) confirm, decline or fix.
--
-- 4. Privacy (b39).
--      profiles.shows_city   Off: the city and locality leave the public row
--                            and wait in private.profile_hidden_places until
--                            it's back on. my_hidden_city() tells the person
--                            which one is waiting.
--      rank_entries.says_where   Off: that drink shows "At a bar" on their
--                            profile; the bar isn't named beside it, nor as
--                            its best drink on their Bars tab.
--
-- 5. Top four (b56). pin_profile_drink() pins or unpins one of your drinks.
--    Pins stay numbered 1 to 4 oldest first, so pinning a fifth takes the
--    place of pin 1 and returns that entry, for the "made room" line.
--
-- 6. Drinks on worked menus (b62). profile_worked_menu_drinks links the
--    drinks a person made to a menu they worked on (profile_worked_menus,
--    from onboarding), so "On the menu at" can list them. Readable with the
--    menu; written by whoever can write the menu. Drink names still come
--    through items' own RLS.

-- --- 1 and 2: jobs ---

ALTER TABLE "public"."profile_positions"
    ADD COLUMN "start_year" smallint,
    ADD COLUMN "start_month" smallint,
    ADD COLUMN "end_year" smallint,
    ADD COLUMN "end_month" smallint,
    ADD COLUMN "is_hidden" boolean DEFAULT false NOT NULL,
    ADD CONSTRAINT "profile_positions_years" CHECK (
        ("start_year" IS NULL OR "start_year" BETWEEN 1950 AND 2100)
        AND ("end_year" IS NULL OR "end_year" BETWEEN 1950 AND 2100)
    ),
    ADD CONSTRAINT "profile_positions_months" CHECK (
        ("start_month" IS NULL OR ("start_month" BETWEEN 1 AND 12 AND "start_year" IS NOT NULL))
        AND ("end_month" IS NULL OR ("end_month" BETWEEN 1 AND 12 AND "end_year" IS NOT NULL))
    ),
    ADD CONSTRAINT "profile_positions_current_has_no_end" CHECK (NOT "is_current" OR "end_year" IS NULL),
    ADD CONSTRAINT "profile_positions_end_after_start" CHECK (
        "start_year" IS NULL OR "end_year" IS NULL
        OR ("end_year" * 12 + coalesce("end_month", 12)) >= ("start_year" * 12 + coalesce("start_month", 1))
    );

-- Showing a job is the person's call: a past one switched on, or one they hid
-- shown again. SQL with no signed-in user is trusted.
CREATE OR REPLACE FUNCTION "private"."guard_position_shown"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF auth.uid() IS NOT NULL
       AND (
         (NEW.is_shown AND (TG_OP = 'INSERT' OR NOT OLD.is_shown))
         OR (TG_OP = 'UPDATE' AND OLD.is_hidden AND NOT NEW.is_hidden)
       )
       AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.person_profile_id AND user_id = auth.uid()) THEN
        RAISE EXCEPTION 'Only the person can show a job on their profile.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER "guard_position_shown" ON "public"."profile_positions";
CREATE TRIGGER "guard_position_shown" BEFORE INSERT OR UPDATE OF "is_shown", "is_hidden" ON "public"."profile_positions"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_position_shown"();

-- Written like the other job columns (20261008720000 grants by column).
GRANT INSERT ("start_year", "start_month", "end_year", "end_month", "is_hidden") ON "public"."profile_positions" TO "authenticated";
GRANT UPDATE ("start_year", "start_month", "end_year", "end_month", "is_hidden") ON "public"."profile_positions" TO "authenticated";

-- As 20261010700000, plus the person's off switch.
-- No private.* helper here: anon has no USAGE on private.
DROP POLICY "profile_positions_select" ON "public"."profile_positions";
CREATE POLICY "profile_positions_select" ON "public"."profile_positions" FOR SELECT TO "anon", "authenticated"
    USING (
        "person_accepted"
        AND NOT "is_hidden"
        AND ("is_current" OR "is_shown")
        AND EXISTS (SELECT 1 FROM "public"."profiles" "p" WHERE "p"."id" = "person_profile_id")
        AND EXISTS (SELECT 1 FROM "public"."profiles" "b" WHERE "b"."id" = "bar_profile_id")
    );

-- --- 3: awards ---

ALTER TABLE "public"."profiles"
    ADD COLUMN "awards_mode" "text" DEFAULT 'all' NOT NULL,
    ADD CONSTRAINT "profiles_awards_mode" CHECK ("awards_mode" IN ('all', 'picked', 'none'));

-- Signed-out visitors read profiles by column (20260927000000); the awards
-- policy below reads this one as them.
GRANT SELECT ("awards_mode") ON "public"."profiles" TO "anon";

ALTER TABLE "public"."profile_awards"
    ADD COLUMN "status" "text" DEFAULT 'confirmed' NOT NULL,
    ADD COLUMN "added_by" "uuid" REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    ADD COLUMN "is_finalist" boolean DEFAULT false NOT NULL,
    ADD COLUMN "bar_profile_id" "uuid" REFERENCES "public"."profiles"("id") ON DELETE SET NULL,
    ADD COLUMN "on_profile" boolean,
    ADD CONSTRAINT "profile_awards_status" CHECK ("status" IN ('confirmed', 'pending', 'declined'));

CREATE INDEX "profile_awards_pending_idx" ON "public"."profile_awards" ("created_at") WHERE "status" = 'pending';
CREATE INDEX "profile_awards_bar_profile_id_idx" ON "public"."profile_awards" ("bar_profile_id");

-- What a person sends comes in pending, theirs, screened and checkable. After
-- that only their show/hide pick is theirs to change. Moderators and SQL with
-- no signed-in user are trusted.
CREATE FUNCTION "private"."guard_profile_award"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.bar_profile_id IS NOT NULL
       AND (TG_OP = 'INSERT' OR NEW.bar_profile_id IS DISTINCT FROM OLD.bar_profile_id)
       AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.bar_profile_id AND kind = 'bar') THEN
        RAISE EXCEPTION 'The bar on an award has to be a bar''s profile.' USING ERRCODE = '23514';
    END IF;
    IF auth.uid() IS NULL OR private.is_app_admin() THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'INSERT' THEN
        NEW.added_by := auth.uid();
        NEW.status := 'pending';
        NEW.position := NULL;
        IF NEW.title IS NULL OR NEW.source_url IS NULL THEN
            RAISE EXCEPTION 'An award needs its title and a link to where it was announced.' USING ERRCODE = '23514';
        END IF;
        IF (SELECT count(*) FROM public.profile_awards
            WHERE profile_id = NEW.profile_id AND status = 'pending') >= 10 THEN
            RAISE EXCEPTION 'You have 10 awards waiting to be checked. Add more once those are done.' USING ERRCODE = '54000';
        END IF;
        PERFORM private.refuse_screened(NEW.award, 'award name', 'award');
        PERFORM private.refuse_screened(NEW.title, 'award title', 'title');
        RETURN NEW;
    END IF;
    IF (NEW.profile_id, NEW.award, NEW.year, NEW.position, NEW.title, NEW.source_url, NEW.status, NEW.added_by, NEW.is_finalist, NEW.bar_profile_id)
       IS DISTINCT FROM
       (OLD.profile_id, OLD.award, OLD.year, OLD.position, OLD.title, OLD.source_url, OLD.status, OLD.added_by, OLD.is_finalist, OLD.bar_profile_id) THEN
        RAISE EXCEPTION 'Only a moderator can change an award. Remove yours and send it again.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION "private"."guard_profile_award"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "guard_profile_award" BEFORE INSERT OR UPDATE ON "public"."profile_awards"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_profile_award"();

-- Everyone: a confirmed award on a public profile that shows it (a person's
-- awards follow their mode and picks; a bar's always show).
-- No private.* helper here: anon has no USAGE on private.
DROP POLICY "profile_awards_select" ON "public"."profile_awards";
CREATE POLICY "profile_awards_select" ON "public"."profile_awards" FOR SELECT TO "anon", "authenticated"
    USING (
        "status" = 'confirmed'
        AND EXISTS (
            SELECT 1 FROM "public"."profiles" "p"
            WHERE "p"."id" = "profile_id" AND "p"."is_public"
              AND ("p"."kind" <> 'person' OR CASE "p"."awards_mode"
                  WHEN 'all' THEN "on_profile" IS NOT FALSE
                  WHEN 'picked' THEN "on_profile" IS TRUE
                  ELSE false END)
        )
    );

-- The person: every award on their own profile, waiting, declined or hidden.
CREATE POLICY "profile_awards_own_select" ON "public"."profile_awards" FOR SELECT TO "authenticated"
    USING ("profile_id" IN (SELECT "id" FROM "public"."profiles" WHERE "user_id" = (SELECT "auth"."uid"()) AND "kind" = 'person'));
CREATE POLICY "profile_awards_own_insert" ON "public"."profile_awards" FOR INSERT TO "authenticated"
    WITH CHECK ("profile_id" IN (SELECT "id" FROM "public"."profiles" WHERE "user_id" = (SELECT "auth"."uid"()) AND "kind" = 'person'));
CREATE POLICY "profile_awards_own_update" ON "public"."profile_awards" FOR UPDATE TO "authenticated"
    USING ("profile_id" IN (SELECT "id" FROM "public"."profiles" WHERE "user_id" = (SELECT "auth"."uid"()) AND "kind" = 'person'))
    WITH CHECK ("profile_id" IN (SELECT "id" FROM "public"."profiles" WHERE "user_id" = (SELECT "auth"."uid"()) AND "kind" = 'person'));
-- Only one they sent themselves: a researched award stays (they can hide it).
CREATE POLICY "profile_awards_own_delete" ON "public"."profile_awards" FOR DELETE TO "authenticated"
    USING (
        "added_by" = (SELECT "auth"."uid"())
        AND "profile_id" IN (SELECT "id" FROM "public"."profiles" WHERE "user_id" = (SELECT "auth"."uid"()) AND "kind" = 'person')
    );

-- --- 4: privacy ---

ALTER TABLE "public"."profiles"
    ADD COLUMN "shows_city" boolean DEFAULT true NOT NULL;

CREATE TABLE "private"."profile_hidden_places" (
    "profile_id" "uuid" PRIMARY KEY REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    "locality" "text",
    "city" "text"
);
REVOKE ALL ON "private"."profile_hidden_places" FROM PUBLIC, "anon", "authenticated";

CREATE FUNCTION "private"."hide_profile_city"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_kept private.profile_hidden_places%ROWTYPE;
BEGIN
    IF NEW.kind <> 'person' THEN
        RETURN NEW;
    END IF;
    IF NOT NEW.shows_city THEN
        -- A new place while hidden replaces the one waiting.
        IF TG_OP = 'UPDATE' AND (NEW.city IS NOT NULL OR NEW.locality IS NOT NULL) THEN
            INSERT INTO private.profile_hidden_places (profile_id, locality, city)
            VALUES (NEW.id, NEW.locality, NEW.city)
            ON CONFLICT (profile_id) DO UPDATE SET locality = EXCLUDED.locality, city = EXCLUDED.city;
        END IF;
        NEW.city := NULL;
        NEW.locality := NULL;
    ELSIF TG_OP = 'UPDATE' AND NOT OLD.shows_city THEN
        DELETE FROM private.profile_hidden_places WHERE profile_id = NEW.id RETURNING * INTO v_kept;
        NEW.locality := coalesce(NEW.locality, v_kept.locality);
        NEW.city := coalesce(NEW.city, v_kept.city);
    END IF;
    RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION "private"."hide_profile_city"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "hide_profile_city" BEFORE INSERT OR UPDATE OF "shows_city", "city", "locality" ON "public"."profiles"
    FOR EACH ROW EXECUTE FUNCTION "private"."hide_profile_city"();

-- The city waiting on your own profile while Show my city is off.
CREATE FUNCTION "public"."my_hidden_city"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT coalesce(h.city, h.locality)
  FROM public.profiles p
  JOIN private.profile_hidden_places h ON h.profile_id = p.id
  WHERE p.user_id = (SELECT auth.uid()) AND p.kind = 'person';
$$;
REVOKE EXECUTE ON FUNCTION "public"."my_hidden_city"() FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."my_hidden_city"() TO "authenticated", "service_role";

ALTER TABLE "public"."rank_entries"
    ADD COLUMN "says_where" boolean DEFAULT true NOT NULL;

-- As 20261010710000, but a drink whose where is off names no bar.
CREATE OR REPLACE FUNCTION "public"."get_profile_drinks"("p_profile_id" "uuid")
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
  -- The bar is named only when it shows in their Bars too, and they say where
  -- they had this one.
  LEFT JOIN public.profiles shown
         ON shown.id = v.id
        AND e.says_where
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

-- As 20261010710000, but a drink whose where is off is never named as a bar's best.
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
    SELECT i.id, i.name
    FROM public.items i
    WHERE i.moderated_at IS NULL
      AND (
        (i.bar_id IS NULL AND i.created_by IS NULL)
        OR i.id IN (SELECT pi.id FROM public.published_items pi WHERE NOT pi.is_reference)
      )
  ), had AS (
    SELECT v.id AS venue_id, COALESCE(item.name, list.name) AS name, s.score, s.created_at,
           private.picked_shown(sharer.had_mode, e.on_profile) AND e.says_where AS drink_shown
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

-- --- 5: top four ---

-- Pins or unpins one of your drinks. Pinning shows it. With four pinned, the
-- oldest (pin 1) makes room and its entry id comes back; otherwise null.
-- Runs as you: rank_entries' own-rows policy applies.
CREATE FUNCTION "public"."pin_profile_drink"("p_entry_id" "uuid", "p_pin" boolean) RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_bumped uuid;
    v_row record;
    v_n integer := 0;
BEGIN
    IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.rank_entries WHERE id = p_entry_id AND user_id = v_uid) THEN
        RAISE EXCEPTION 'That isn''t one of your drinks.' USING ERRCODE = '42501';
    END IF;
    IF p_pin AND EXISTS (SELECT 1 FROM public.rank_entries WHERE id = p_entry_id AND profile_pin IS NOT NULL) THEN
        RETURN NULL;
    END IF;
    UPDATE public.rank_entries SET profile_pin = NULL WHERE id = p_entry_id;
    IF p_pin AND (SELECT count(*) FROM public.rank_entries WHERE user_id = v_uid AND profile_pin IS NOT NULL) >= 4 THEN
        UPDATE public.rank_entries SET profile_pin = NULL
        WHERE id = (SELECT id FROM public.rank_entries WHERE user_id = v_uid AND profile_pin IS NOT NULL ORDER BY profile_pin LIMIT 1)
        RETURNING id INTO v_bumped;
    END IF;
    -- Close the gaps, oldest first, so pin 1 is always the oldest.
    FOR v_row IN SELECT id, profile_pin FROM public.rank_entries WHERE user_id = v_uid AND profile_pin IS NOT NULL ORDER BY profile_pin LOOP
        v_n := v_n + 1;
        IF v_row.profile_pin <> v_n THEN
            UPDATE public.rank_entries SET profile_pin = v_n WHERE id = v_row.id;
        END IF;
    END LOOP;
    IF p_pin THEN
        UPDATE public.rank_entries SET on_profile = true, profile_pin = v_n + 1 WHERE id = p_entry_id;
    END IF;
    RETURN v_bumped;
END;
$$;
REVOKE EXECUTE ON FUNCTION "public"."pin_profile_drink"("uuid", boolean) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."pin_profile_drink"("uuid", boolean) TO "authenticated", "service_role";

-- --- 6: drinks on worked menus ---

CREATE TABLE "public"."profile_worked_menu_drinks" (
    "worked_menu_id" "uuid" NOT NULL REFERENCES "public"."profile_worked_menus"("id") ON DELETE CASCADE,
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    PRIMARY KEY ("worked_menu_id", "item_id")
);
CREATE INDEX "profile_worked_menu_drinks_item_idx" ON "public"."profile_worked_menu_drinks" ("item_id");

ALTER TABLE "public"."profile_worked_menu_drinks" ENABLE ROW LEVEL SECURITY;

-- With the menu: whoever reads it reads which drinks it lists (their names
-- come through items' own RLS).
CREATE POLICY "profile_worked_menu_drinks_select" ON "public"."profile_worked_menu_drinks" FOR SELECT TO "anon", "authenticated"
    USING (EXISTS (SELECT 1 FROM "public"."profile_worked_menus" "m" WHERE "m"."id" = "worked_menu_id"));

-- As profile_worked_menus_write: the person, the bar's publishers, moderators.
CREATE POLICY "profile_worked_menu_drinks_write" ON "public"."profile_worked_menu_drinks" FOR ALL TO "authenticated"
    USING (EXISTS (
        SELECT 1 FROM "public"."profile_worked_menus" "m"
        WHERE "m"."id" = "worked_menu_id"
          AND ("private"."is_app_admin"()
            OR "m"."person_profile_id" IN (SELECT "id" FROM "public"."profiles" WHERE "user_id" = (SELECT "auth"."uid"()))
            OR "m"."bar_profile_id" IN (SELECT "id" FROM "public"."profiles" WHERE "bar_id" IN (SELECT "private"."bars_with_capability"('publish'))))
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM "public"."profile_worked_menus" "m"
        WHERE "m"."id" = "worked_menu_id"
          AND ("private"."is_app_admin"()
            OR "m"."person_profile_id" IN (SELECT "id" FROM "public"."profiles" WHERE "user_id" = (SELECT "auth"."uid"()))
            OR "m"."bar_profile_id" IN (SELECT "id" FROM "public"."profiles" WHERE "bar_id" IN (SELECT "private"."bars_with_capability"('publish'))))
    ));

GRANT SELECT ON TABLE "public"."profile_worked_menu_drinks" TO "anon", "authenticated";
GRANT INSERT, DELETE ON TABLE "public"."profile_worked_menu_drinks" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_worked_menu_drinks" TO "service_role";
