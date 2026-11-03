-- The staff link door for someone signed in who isn't on the team (boards
-- Miss-door and Miss-door-desk), so the link's settings (bars.staff_link_on,
-- staff_link_role, staff_link_approve, 20261206300000) change what it does.
-- The door takes the link's secret (bar_staff_links.token, 20261206300000),
-- never the bar's slug: a wrong token, or one New link replaced, is refused
-- exactly as a link that's off.
--
--   venue_join_requests.via_link   New column. The ask came through the staff
--                                  link, so Team says "Through your staff
--                                  link" instead of "From your bar's page".
--   staff_link_door(token)         New definer read for the door: is the link
--                                  on, the role it joins at, whether an Admin
--                                  approves, the first name of the Admin who
--                                  answers (the owner, else the longest-serving
--                                  Admin), how many Admins there are, and the
--                                  caller's own name. Signed-in only, and the
--                                  Admin's name only while the link is on.
--                                  No row for a wrong or replaced token.
--   join_by_staff_link(token)      New. Approval on: asks (a join request
--                                  through the link). Approval off: joins at
--                                  the link's role straight away. Link off,
--                                  a wrong or replaced token, or a bar with
--                                  no Admin: refuses. Never
--                                  Admin: staff_link_role is 10 to 35
--                                  (bars_staff_link_role_check).
--   take_back_join_request(bar)    New. The asker withdraws a waiting ask. A
--                                  declined one stays, so they can't ask again.
--   join_requests(bar)             Changed (existing function): also returns
--                                  via_link.
--   request_join_email()           New trigger on venue_join_requests: when an
--                                  Admin says yes to an ask through the link
--                                  (the row goes and the person is on the
--                                  team, at answer_join_request's role, which
--                                  #1083 makes the link's), claim-email tells them
--                                  they're in ("We'll tell you when you're
--                                  in"). Same Vault secrets as the claim
--                                  emails; does nothing until they exist, and
--                                  never blocks the answer.

ALTER TABLE "public"."venue_join_requests"
    ADD COLUMN "via_link" boolean DEFAULT false NOT NULL;

-- --- The door ---

CREATE FUNCTION "public"."staff_link_door"("p_token" "text") RETURNS TABLE (
    "bar_id" uuid,
    "link_on" boolean,
    "join_role" integer,
    "approve" boolean,
    "admin_name" text,
    "admin_count" integer,
    "me" text
)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  WITH bar AS (
    SELECT b.id, b.staff_link_on, b.staff_link_role, b.staff_link_approve
    FROM public.bars b JOIN public.bar_staff_links l ON l.bar_id = b.id
    WHERE l.token = p_token AND auth.uid() IS NOT NULL
  ), admins AS (
    SELECT ub.user_id, ub.created_at,
           EXISTS (SELECT 1 FROM public.profile_claims c
                   WHERE c.bar_id = ub.bar_id AND c.user_id = ub.user_id AND c.status = 'approved') AS owner
    FROM public.user_bars ub JOIN bar ON bar.id = ub.bar_id
    WHERE ub.role_level >= 40
      AND NOT EXISTS (SELECT 1 FROM public.venue_roles vr WHERE vr.id = ub.venue_role_id AND vr.ends_at <= now())
  ), lead AS (
    -- Never the email: the account's name, else their person page's.
    SELECT split_part(coalesce(
        nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
        nullif(btrim(u.raw_user_meta_data ->> 'first_name'), ''),
        (SELECT nullif(btrim(p.display_name), '') FROM public.profiles p WHERE p.user_id = u.id AND p.kind = 'person' LIMIT 1)
    ), ' ', 1) AS name
    FROM admins a JOIN auth.users u ON u.id = a.user_id
    ORDER BY a.owner DESC, a.created_at
    LIMIT 1
  )
  SELECT bar.id, bar.staff_link_on, bar.staff_link_role, bar.staff_link_approve,
         CASE WHEN bar.staff_link_on THEN nullif((SELECT name FROM lead), '') END,
         CASE WHEN bar.staff_link_on THEN (SELECT count(*)::integer FROM admins) END,
         private.member_display_name(auth.uid())
  FROM bar;
$$;

-- Through the staff link: ask, or join straight in when nobody approves.
-- Returns 'asked' or 'joined'.
CREATE FUNCTION "public"."join_by_staff_link"("p_token" "text") RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_bar public.bars;
    v_row public.venue_join_requests;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sign in to join a team.' USING ERRCODE = '42501';
    END IF;
    SELECT b.* INTO v_bar FROM public.bars b JOIN public.bar_staff_links l ON l.bar_id = b.id WHERE l.token = p_token;
    -- A wrong or replaced token says the same as a link that's off.
    IF v_bar.id IS NULL OR NOT v_bar.staff_link_on THEN
        RAISE EXCEPTION 'This link is off. Ask someone on the team to invite you by email, or for the new link.';
    END IF;
    -- A bar with no Admin has nobody to answer, and nobody chose its link's settings.
    IF NOT EXISTS (SELECT 1 FROM public.user_bars WHERE bar_id = v_bar.id AND role_level >= 40) THEN
        RAISE EXCEPTION 'This bar has no team on Cocktail yet.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.user_bars WHERE user_id = auth.uid() AND bar_id = v_bar.id) THEN
        RETURN 'joined';
    END IF;

    -- One at a time per person, so a double tap can't pass the cap twice.
    PERFORM pg_advisory_xact_lock(hashtextextended('request_to_join_venue:' || auth.uid()::text, 0));
    SELECT * INTO v_row FROM public.venue_join_requests WHERE bar_id = v_bar.id AND user_id = auth.uid();
    IF v_row.declined_at IS NOT NULL THEN
        RAISE EXCEPTION 'The team said no last time. Ask its Admin for an invite.';
    END IF;

    IF NOT v_bar.staff_link_approve THEN
        -- The ask goes first, so its removal isn't taken for an Admin's yes (request_join_email).
        DELETE FROM public.venue_join_requests WHERE id = v_row.id;
        INSERT INTO public.user_bars (user_id, bar_id, role_level) VALUES (auth.uid(), v_bar.id, v_bar.staff_link_role)
        ON CONFLICT (user_id, bar_id) DO NOTHING;
        RETURN 'joined';
    END IF;

    IF v_row.id IS NOT NULL THEN
        RETURN 'asked';
    END IF;
    IF (SELECT count(*) FROM public.venue_join_requests WHERE user_id = auth.uid() AND declined_at IS NULL) >= 5 THEN
        RAISE EXCEPTION 'You''ve asked five teams already. Wait for one to answer.';
    END IF;
    INSERT INTO public.venue_join_requests (bar_id, user_id, via_link) VALUES (v_bar.id, auth.uid(), true);
    RETURN 'asked';
END;
$$;

-- Take back a waiting ask. A declined one stays declined.
CREATE FUNCTION "public"."take_back_join_request"("p_bar_id" uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  DELETE FROM public.venue_join_requests
  WHERE bar_id = p_bar_id AND user_id = auth.uid() AND declined_at IS NULL;
$$;

-- As 20261113300000_venue_join_requests.sql, plus via_link.
DROP FUNCTION "public"."join_requests"(uuid);
CREATE FUNCTION "public"."join_requests"("p_bar_id" uuid) RETURNS TABLE (
    "id" uuid,
    "created_at" timestamp with time zone,
    "user_id" uuid,
    "name" text,
    "avatar_url" text,
    "profile_handle" text,
    "via_link" boolean
)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT r.id, r.created_at, r.user_id,
         COALESCE(NULLIF(btrim(p.display_name), ''), private.member_display_name(r.user_id)),
         p.avatar_url, p.handle, r.via_link
  FROM public.venue_join_requests r
  LEFT JOIN LATERAL (
    SELECT pp.display_name, pp.avatar_url, pp.handle FROM public.profiles pp
    WHERE pp.user_id = r.user_id AND pp.kind = 'person' LIMIT 1
  ) p ON true
  WHERE r.bar_id = p_bar_id AND r.declined_at IS NULL
    AND p_bar_id IN (SELECT private.bars_with_capability('staff'))
  ORDER BY r.created_at;
$$;

REVOKE ALL ON FUNCTION "public"."staff_link_door"(text) FROM "public", "anon";
REVOKE ALL ON FUNCTION "public"."join_by_staff_link"(text) FROM "public", "anon";
REVOKE ALL ON FUNCTION "public"."take_back_join_request"(uuid) FROM "public", "anon";
REVOKE ALL ON FUNCTION "public"."join_requests"(uuid) FROM "public", "anon";
GRANT EXECUTE ON FUNCTION "public"."staff_link_door"(text) TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."join_by_staff_link"(text) TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."take_back_join_request"(uuid) TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."join_requests"(uuid) TO "authenticated", "service_role";

-- --- "We'll tell you when you're in" ---

-- An ask leaves venue_join_requests three ways: an Admin's yes
-- (answer_join_request adds them, then deletes it), the asker taking it back,
-- and joining straight in (join_by_staff_link deletes it before adding them).
-- Only the first leaves them on the team as the row goes, so only it emails.
-- Only asks through the staff link: that door promises it, and the email
-- links back to it. An ask from the bar's page is answered as before.
CREATE FUNCTION "private"."request_join_email"() RETURNS trigger
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_url text;
    v_secret text;
    v_role integer;
    v_slug text;
BEGIN
    IF OLD.declined_at IS NOT NULL OR NOT OLD.via_link THEN
        RETURN NULL;
    END IF;
    SELECT ub.role_level INTO v_role FROM public.user_bars ub WHERE ub.bar_id = OLD.bar_id AND ub.user_id = OLD.user_id;
    IF v_role IS NULL THEN
        RETURN NULL;
    END IF;
    SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'claim_email_url';
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'claim_email_secret';
    IF v_url IS NULL OR v_secret IS NULL THEN
        RETURN NULL;
    END IF;
    SELECT b.slug INTO v_slug FROM public.bars b WHERE b.id = OLD.bar_id;

    PERFORM net.http_post(
        url := v_url,
        body := jsonb_build_object('event', 'joined', 'to', jsonb_build_array(OLD.user_id), 'venue_id', OLD.bar_id, 'slug', v_slug, 'role', v_role),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-claim-email-secret', v_secret),
        timeout_milliseconds := 10000
    );
    RETURN NULL;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'request_join_email: %', SQLERRM;
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION "private"."request_join_email"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "venue_join_requests_email_joined"
    AFTER DELETE ON "public"."venue_join_requests"
    FOR EACH ROW
    EXECUTE FUNCTION "private"."request_join_email"();
