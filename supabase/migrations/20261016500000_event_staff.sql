-- DRAFT. Local stack only. Not applied to production; needs Kevin's review first.
--
-- Behind the bar: who works an event (Kevin, 12 Oct: "build it"). The This
-- week boards of https://claude.ai/artifact/KRE17t8L8SC8f4M4KFLgZe draw it on
-- an event's page ("Jun A., Pale Moth", "Sam O., Little Rye") and in the week
-- ("Mara Q. from The Lantern Room").
--
--   event_staff          one person working one event: someone on the host
--                        bar's team (user_id), or a guest bartender by the
--                        name the venue typed (guest_name), who may not have
--                        an account, with an optional link to their person
--                        profile (profile_id).
--   event_staff_select   the host bar's team reads every row.
--   event_staff_write    the people who manage the bar's events (the 'menus'
--                        capability, as events_write) add, change and remove
--                        them. A guard checks the person is on the host team
--                        right now, a link is to a person's profile, guest
--                        names pass the content filter, and an event has at
--                        most 20.
--   week_event_staff()   what guests may read, for events they can open (the
--                        bar_week rule: the team, or a public event at a bar
--                        with a public page). Names follow each person's own
--                        choices, the same ones a bar page follows:
--                          * a teammate is named only when their person
--                            profile is public and shows their job at this
--                            bar (accepted, not hidden, current or a past job
--                            they switched on: 20261007120000, 20261014600000);
--                          * a guest by the typed name, unless the venue
--                            linked a profile that isn't public (or the reader
--                            and that person have blocked each other): then
--                            no name;
--                          * nobody else's name, ever. Their row comes back
--                            with no name, no profile and no account, so the
--                            app can say "Little Rye team" or "Guest bartender".
--                        The team reads names as on My team.
-- The events table and its policies don't change.

CREATE TABLE "public"."event_staff" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "event_id" "uuid" NOT NULL REFERENCES "public"."events"("id") ON DELETE CASCADE,
    -- Someone on the host bar's team.
    "user_id" "uuid" REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    -- A guest bartender, as the venue typed them: "Jun A.".
    "guest_name" "text" CHECK (char_length(btrim("guest_name")) BETWEEN 1 AND 60),
    -- The guest's person profile, when they have one here.
    "profile_id" "uuid" REFERENCES "public"."profiles"("id") ON DELETE SET NULL,
    "sort_order" smallint DEFAULT 0 NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"() REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_staff_who_check" CHECK (("user_id" IS NULL) <> ("guest_name" IS NULL)),
    -- A teammate's profile is found through their account.
    CONSTRAINT "event_staff_profile_check" CHECK ("profile_id" IS NULL OR "guest_name" IS NOT NULL)
);

CREATE INDEX "event_staff_event_id_idx" ON "public"."event_staff" ("event_id", "sort_order");
CREATE UNIQUE INDEX "event_staff_member_key" ON "public"."event_staff" ("event_id", "user_id") WHERE "user_id" IS NOT NULL;
CREATE INDEX "event_staff_user_id_idx" ON "public"."event_staff" ("user_id") WHERE "user_id" IS NOT NULL;
CREATE INDEX "event_staff_profile_id_idx" ON "public"."event_staff" ("profile_id") WHERE "profile_id" IS NOT NULL;

-- The person is on the host team today, a link is to a person, guest names are
-- screened, and an event has at most 20 people. SQL with no signed-in user
-- (migrations, the service role) is trusted with the team check.
CREATE FUNCTION "private"."guard_event_staff"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_bar "uuid";
BEGIN
    SELECT e.bar_id INTO v_bar FROM public.events e WHERE e.id = NEW.event_id;
    IF NEW.user_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.event_id IS DISTINCT FROM OLD.event_id)
       AND auth.uid() IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM public.user_bars ub
           WHERE ub.user_id = NEW.user_id AND ub.bar_id = v_bar
             AND NOT EXISTS (SELECT 1 FROM public.venue_roles vr WHERE vr.id = ub.venue_role_id AND vr.ends_at <= now())
       ) THEN
        RAISE EXCEPTION 'Only people on the bar''s team can be added by account. Add anyone else by name.' USING ERRCODE = '42501';
    END IF;
    IF NEW.profile_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.profile_id IS DISTINCT FROM OLD.profile_id)
       AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = NEW.profile_id AND p.kind = 'person') THEN
        RAISE EXCEPTION 'A guest links to a person''s profile.';
    END IF;
    IF TG_OP = 'INSERT' OR NEW.guest_name IS DISTINCT FROM OLD.guest_name THEN
        PERFORM private.refuse_screened(NEW.guest_name, 'name', 'guest_name');
    END IF;
    IF (TG_OP = 'INSERT' OR NEW.event_id IS DISTINCT FROM OLD.event_id)
       AND (SELECT count(*) FROM public.event_staff s WHERE s.event_id = NEW.event_id AND s.id <> NEW.id) >= 20 THEN
        RAISE EXCEPTION 'An event lists up to 20 people behind the bar.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "guard_event_staff" BEFORE INSERT OR UPDATE ON "public"."event_staff"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_event_staff"();

REVOKE EXECUTE ON FUNCTION "private"."guard_event_staff"() FROM PUBLIC, "anon", "authenticated";

ALTER TABLE "public"."event_staff" ENABLE ROW LEVEL SECURITY;

-- Guests read through week_event_staff, never the table.
REVOKE ALL ON "public"."event_staff" FROM "anon";

CREATE POLICY "event_staff_select" ON "public"."event_staff" FOR SELECT TO "authenticated"
    USING ("event_id" IN (SELECT "e"."id" FROM "public"."events" "e" WHERE "e"."bar_id" IN (SELECT "private"."my_bar_ids"(0))));

CREATE POLICY "event_staff_write" ON "public"."event_staff" FOR ALL TO "authenticated"
    USING ("event_id" IN (SELECT "e"."id" FROM "public"."events" "e" WHERE "e"."bar_id" IN (SELECT "private"."bars_with_capability"('menus'))))
    WITH CHECK ("event_id" IN (SELECT "e"."id" FROM "public"."events" "e" WHERE "e"."bar_id" IN (SELECT "private"."bars_with_capability"('menus'))));

-- --- Reading it ---

-- Behind the bar for up to 100 events, in order. Events the reader can't open
-- (team-only, a bar without a public page, a duplicate) return nothing.
-- user_id only for the team, who edit the list.
CREATE FUNCTION "public"."week_event_staff"("p_event_ids" "uuid"[])
    RETURNS TABLE (
        "event_id" "uuid",
        "id" "uuid",
        "user_id" "uuid",
        "name" "text",
        "is_guest" boolean,
        "profile_id" "uuid",
        "profile_handle" "text",
        "sort_order" smallint
    )
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  WITH ev AS (
    SELECT e.id, e.bar_id, e.is_public,
           e.bar_id IN (SELECT private.my_bar_ids(0)) AS member,
           private.public_bar_profile(e.bar_id) AS bar_page
    FROM public.events e
    WHERE e.id = ANY (p_event_ids[1:100]) AND e.duplicate_of IS NULL
  )
  SELECT s.event_id, s.id,
         CASE WHEN ev.member THEN s.user_id END,
         CASE
           WHEN s.guest_name IS NOT NULL THEN
             CASE WHEN ev.member OR s.profile_id IS NULL OR gp.id IS NOT NULL THEN s.guest_name END
           WHEN ev.member THEN private.member_display_name(s.user_id)
           ELSE mp.display_name
         END,
         s.guest_name IS NOT NULL,
         COALESCE(gp.id, mp.id, CASE WHEN ev.member THEN s.profile_id END),
         COALESCE(gp.handle, mp.handle),
         s.sort_order
  FROM ev
  JOIN public.event_staff s ON s.event_id = ev.id
  -- A guest's linked profile, while it's public.
  LEFT JOIN public.profiles gp
         ON gp.id = s.profile_id AND gp.kind = 'person' AND gp.is_public AND gp.moderated_at IS NULL
        AND (gp.user_id IS NULL OR gp.user_id NOT IN (SELECT private.blocked_user_ids()))
  -- A teammate's public profile, when it shows their job at this bar.
  LEFT JOIN LATERAL (
    SELECT p.id, p.display_name, p.handle
    FROM public.profiles p
    WHERE s.user_id IS NOT NULL
      AND p.user_id = s.user_id AND p.kind = 'person' AND p.is_public AND p.moderated_at IS NULL
      AND p.user_id NOT IN (SELECT private.blocked_user_ids())
      AND EXISTS (
        SELECT 1 FROM public.profile_positions pp
        JOIN public.profiles b ON b.id = pp.bar_profile_id AND b.bar_id = ev.bar_id AND b.kind = 'bar'
        WHERE pp.person_profile_id = p.id
          AND pp.person_accepted AND NOT pp.is_hidden AND (pp.is_current OR pp.is_shown)
      )
    ORDER BY p.created_at
    LIMIT 1
  ) mp ON true
  WHERE ev.member OR (ev.is_public AND ev.bar_page IS NOT NULL)
  ORDER BY s.event_id, s.sort_order, s.created_at;
$$;

REVOKE EXECUTE ON FUNCTION "public"."week_event_staff"("uuid"[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."week_event_staff"("uuid"[]) TO "anon", "authenticated", "service_role";
