-- A job on a profile ("Bartender at Little Rye") shows only once both sides
-- have said yes.
--
--   person_accepted   the person agrees. Automatic when they add it
--                     themselves, or when their profile is unclaimed (no one
--                     to ask). When a bar or a moderator adds a claimed
--                     person, that person accepts it.
--   bar_accepted      the bar agrees: a current Admin of the bar's venue
--                     (private.my_bar_ids(40), as the bars policies use), or a
--                     moderator when the bar has no venue on Cocktail yet.
--                     Automatic when such a person adds it, or when the person
--                     adds a job at a venue whose team they're already on (an
--                     Admin put them there).
--
-- Until both are true, only the person, the bar's Admins (or, for a bar with
-- no venue, moderators) and moderators read the row. Existing rows, and rows
-- written by SQL with no signed-in user (migrations, the service role), are
-- accepted.
--
-- Changing a job's title asks the other side again. Accepting or declining
-- goes through accept_profile_position() / decline_profile_position();
-- position_requests() lists what's waiting for the caller's side as a bar.
-- The flags and which profiles a row joins can't be changed directly.

ALTER TABLE "public"."profile_positions"
    ADD COLUMN "person_accepted" boolean DEFAULT true NOT NULL,
    ADD COLUMN "bar_accepted" boolean DEFAULT true NOT NULL;

CREATE INDEX "profile_positions_waiting_idx" ON "public"."profile_positions" ("bar_profile_id")
    WHERE NOT "bar_accepted";

-- --- Who answers for each side ---

-- Bar profiles the caller answers for: their venue's, as a current Admin, or
-- any bar with no venue on Cocktail, as a moderator. Used as
-- "bar_profile_id IN (SELECT private.bar_profiles_i_confirm())".
CREATE FUNCTION "private"."bar_profiles_i_confirm"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT b.id FROM public.profiles b
  WHERE b.kind = 'bar'
    AND (b.bar_id IN (SELECT private.my_bar_ids(40)) OR (b.bar_id IS NULL AND private.is_app_admin()));
$$;

-- Whether the signed-in caller answers for the person: it's their profile, or
-- the profile is unclaimed.
CREATE FUNCTION "private"."answers_for_person"("p_person_profile_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_person_profile_id AND (p.user_id IS NULL OR p.user_id = auth.uid())
  );
$$;

-- The person is on the bar's venue team (Employee or above), so its Admin
-- already vouched for them.
CREATE FUNCTION "private"."on_bar_team"("p_person_profile_id" "uuid", "p_bar_profile_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.profiles b ON b.id = p_bar_profile_id AND b.kind = 'bar' AND b.bar_id IS NOT NULL
    WHERE p.id = p_person_profile_id AND p.user_id = auth.uid()
      AND b.bar_id IN (SELECT private.my_bar_ids(20))
  );
$$;

REVOKE EXECUTE ON FUNCTION "private"."bar_profiles_i_confirm"() FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "private"."answers_for_person"("uuid") FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "private"."on_bar_team"("uuid", "uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."bar_profiles_i_confirm"() TO "authenticated";

-- Sets both flags from who is writing, on a new row or a new title.
CREATE FUNCTION "private"."set_position_acceptance"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'INSERT' OR NEW.title IS DISTINCT FROM OLD.title THEN
        NEW.person_accepted := private.answers_for_person(NEW.person_profile_id);
        NEW.bar_accepted := NEW.bar_profile_id IN (SELECT private.bar_profiles_i_confirm())
            OR private.on_bar_team(NEW.person_profile_id, NEW.bar_profile_id);
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "set_position_acceptance" BEFORE INSERT OR UPDATE OF "title" ON "public"."profile_positions"
    FOR EACH ROW EXECUTE FUNCTION "private"."set_position_acceptance"();

REVOKE EXECUTE ON FUNCTION "private"."set_position_acceptance"() FROM PUBLIC, "anon", "authenticated";

-- --- Who reads and writes ---

-- Everyone: a confirmed job that is current, or past and switched on.
-- No private.* helper here: anon has no USAGE on private.
DROP POLICY "profile_positions_select" ON "public"."profile_positions";
CREATE POLICY "profile_positions_select" ON "public"."profile_positions" FOR SELECT TO "anon", "authenticated"
    USING (
        "person_accepted" AND "bar_accepted"
        AND ("is_current" OR "is_shown")
        AND EXISTS (SELECT 1 FROM "public"."profiles" "p" WHERE "p"."id" = "person_profile_id")
        AND EXISTS (SELECT 1 FROM "public"."profiles" "b" WHERE "b"."id" = "bar_profile_id")
    );

-- The two sides and moderators read every row, waiting or not.
CREATE POLICY "profile_positions_select_parties" ON "public"."profile_positions" FOR SELECT TO "authenticated"
    USING (
        "person_profile_id" IN (SELECT "id" FROM "public"."profiles" WHERE "user_id" = (SELECT "auth"."uid"()))
        OR "bar_profile_id" IN (SELECT "private"."bar_profiles_i_confirm"())
        OR (SELECT "private"."is_app_admin"())
    );

-- Writers as before (the person, the bar's publishers, moderators), but no
-- longer FOR ALL, so writing doesn't widen who reads a waiting row.
DROP POLICY "profile_positions_write" ON "public"."profile_positions";
CREATE POLICY "profile_positions_insert" ON "public"."profile_positions" FOR INSERT TO "authenticated"
    WITH CHECK (
        "private"."is_app_admin"()
        OR "person_profile_id" IN (SELECT "id" FROM "public"."profiles" WHERE "user_id" = (SELECT "auth"."uid"()))
        OR "bar_profile_id" IN (SELECT "id" FROM "public"."profiles" WHERE "bar_id" IN (SELECT "private"."bars_with_capability"('publish')))
    );
CREATE POLICY "profile_positions_update" ON "public"."profile_positions" FOR UPDATE TO "authenticated"
    USING (
        "private"."is_app_admin"()
        OR "person_profile_id" IN (SELECT "id" FROM "public"."profiles" WHERE "user_id" = (SELECT "auth"."uid"()))
        OR "bar_profile_id" IN (SELECT "id" FROM "public"."profiles" WHERE "bar_id" IN (SELECT "private"."bars_with_capability"('publish')))
    )
    WITH CHECK (
        "private"."is_app_admin"()
        OR "person_profile_id" IN (SELECT "id" FROM "public"."profiles" WHERE "user_id" = (SELECT "auth"."uid"()))
        OR "bar_profile_id" IN (SELECT "id" FROM "public"."profiles" WHERE "bar_id" IN (SELECT "private"."bars_with_capability"('publish')))
    );
CREATE POLICY "profile_positions_delete" ON "public"."profile_positions" FOR DELETE TO "authenticated"
    USING (
        "private"."is_app_admin"()
        OR "person_profile_id" IN (SELECT "id" FROM "public"."profiles" WHERE "user_id" = (SELECT "auth"."uid"()))
        OR "bar_profile_id" IN (SELECT "id" FROM "public"."profiles" WHERE "bar_id" IN (SELECT "private"."bars_with_capability"('publish')))
    );

-- The flags, and which person and bar a row joins, only change through the
-- functions below (or SQL).
REVOKE INSERT, UPDATE ON "public"."profile_positions" FROM "anon", "authenticated";
GRANT INSERT ("person_profile_id", "bar_profile_id", "title", "is_current", "is_shown", "source_url") ON "public"."profile_positions" TO "authenticated";
GRANT UPDATE ("title", "is_current", "is_shown", "source_url") ON "public"."profile_positions" TO "authenticated";

-- --- Answering ---

-- Says yes for whichever side the caller answers for and hasn't yet.
CREATE FUNCTION "public"."accept_profile_position"("p_id" "uuid") RETURNS "public"."profile_positions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_row public.profile_positions;
    v_person boolean;
    v_bar boolean;
BEGIN
    SELECT * INTO v_row FROM public.profile_positions WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'That job isn''t waiting for you.';
    END IF;
    v_person := NOT v_row.person_accepted
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = v_row.person_profile_id AND user_id = auth.uid());
    v_bar := NOT v_row.bar_accepted AND v_row.bar_profile_id IN (SELECT private.bar_profiles_i_confirm());
    IF NOT (v_person OR v_bar) THEN
        RAISE EXCEPTION 'That job isn''t waiting for you.';
    END IF;

    UPDATE public.profile_positions
    SET person_accepted = person_accepted OR v_person, bar_accepted = bar_accepted OR v_bar
    WHERE id = p_id
    RETURNING * INTO v_row;
    RETURN v_row;
END;
$$;

-- Says no for a side still waiting on the caller: the job is removed.
CREATE FUNCTION "public"."decline_profile_position"("p_id" "uuid") RETURNS void
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_row public.profile_positions;
BEGIN
    SELECT * INTO v_row FROM public.profile_positions WHERE id = p_id FOR UPDATE;
    IF NOT FOUND OR NOT (
        (NOT v_row.person_accepted AND EXISTS (SELECT 1 FROM public.profiles WHERE id = v_row.person_profile_id AND user_id = auth.uid()))
        OR (NOT v_row.bar_accepted AND v_row.bar_profile_id IN (SELECT private.bar_profiles_i_confirm()))
    ) THEN
        RAISE EXCEPTION 'That job isn''t waiting for you.';
    END IF;
    DELETE FROM public.profile_positions WHERE id = p_id;
END;
$$;

-- Jobs waiting on the caller's yes as a bar: their venues' (venue_id set),
-- and for moderators, bars with no venue (venue_id NULL). The person's name
-- shows even when their profile is private: they asked this bar.
CREATE FUNCTION "public"."position_requests"() RETURNS TABLE (
    "id" "uuid",
    "title" "text",
    "is_current" boolean,
    "created_at" timestamp with time zone,
    "venue_id" "uuid",
    "bar_profile_id" "uuid",
    "bar_name" "text",
    "person_profile_id" "uuid",
    "person_handle" "text",
    "person_name" "text",
    "person_avatar_url" "text",
    "person_is_public" boolean
)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT pp.id, pp.title, pp.is_current, pp.created_at, b.bar_id, b.id, b.display_name,
         p.id, p.handle, p.display_name, p.avatar_url, p.is_public
  FROM public.profile_positions pp
  JOIN public.profiles b ON b.id = pp.bar_profile_id
  JOIN public.profiles p ON p.id = pp.person_profile_id
  WHERE NOT pp.bar_accepted AND pp.bar_profile_id IN (SELECT private.bar_profiles_i_confirm())
  ORDER BY pp.created_at
  LIMIT 200;
$$;

REVOKE EXECUTE ON FUNCTION "public"."accept_profile_position"("uuid") FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "public"."decline_profile_position"("uuid") FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "public"."position_requests"() FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."accept_profile_position"("uuid") TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."decline_profile_position"("uuid") TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."position_requests"() TO "authenticated", "service_role";
