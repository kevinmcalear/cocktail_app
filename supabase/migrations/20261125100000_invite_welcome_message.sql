-- The invite email's own words (invite-team-last, steps 3 to 6).
--
--   * bars.welcome_message: one paragraph an Admin writes once, sent in
--     every invite from the bar and signed with the sender's name. Null
--     until it's first saved; the app starts it filled in (call 3).
--   * bar_invites.note: an optional line for one person, only in their email.
--   * add_user_to_bar_by_email takes the note (p_note). An invite made
--     again keeps its note unless a new one is given, like the name.
--   * my_bar_invites returns the welcome message, for the invite welcome
--     screen (call 4). The note stays in the email.
-- Writing welcome_message follows bars_update: Admins only (guard_bar_brand
-- keeps every column but the brand to them).

ALTER TABLE "public"."bars" ADD COLUMN "welcome_message" "text"
    CONSTRAINT "bars_welcome_message_check" CHECK ("welcome_message" IS NULL OR char_length("welcome_message") <= 600);
COMMENT ON COLUMN "public"."bars"."welcome_message" IS 'The Admin''s welcome in every invite email from the bar, signed by whoever sends it. Null until first saved.';

ALTER TABLE "public"."bar_invites" ADD COLUMN "note" "text"
    CONSTRAINT "bar_invites_note_check" CHECK ("note" IS NULL OR ("note" = btrim("note") AND char_length("note") BETWEEN 1 AND 500));
COMMENT ON COLUMN "public"."bar_invites"."note" IS 'An optional note for this person, under the welcome message in their invite email.';

-- As 20261101200000, plus p_note.
DROP FUNCTION "public"."add_user_to_bar_by_email"("p_email" "text", "p_bar_id" "uuid", "p_role_level" integer, "p_name" "text");
CREATE FUNCTION "public"."add_user_to_bar_by_email"("p_email" "text", "p_bar_id" "uuid", "p_role_level" integer, "p_name" "text" DEFAULT NULL::"text", "p_note" "text" DEFAULT NULL::"text") RETURNS "public"."user_bars"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_email TEXT := lower(btrim(p_email));
    v_name TEXT := nullif(btrim(p_name), '');
    v_note TEXT := nullif(btrim(p_note), '');
    v_member public.user_bars;
    v_admin boolean;
    v_rows integer;
BEGIN
    IF p_bar_id IS NULL OR p_bar_id NOT IN (SELECT private.bars_with_capability('staff')) THEN
        RAISE EXCEPTION 'You need the invite and manage staff permission to add members.';
    END IF;

    IF p_role_level IS NULL OR NOT (p_role_level = ANY (ARRAY[10, 20, 30, 35, 40])) THEN
        RAISE EXCEPTION 'Invalid role level.';
    END IF;

    v_admin := p_bar_id IN (SELECT private.my_bar_ids(40)) OR private.is_app_admin();
    IF NOT v_admin THEN
        IF p_role_level >= 40 THEN
            RAISE EXCEPTION 'Only an Admin can invite an Admin.';
        END IF;
        IF EXISTS (
            SELECT unnest(private.member_capabilities(p_bar_id, p_role_level, NULL))
            EXCEPT SELECT unnest(private.capabilities(p_bar_id))
        ) THEN
            RAISE EXCEPTION 'You can only invite someone to a role that does no more than yours.';
        END IF;
    END IF;

    IF v_email IS NULL OR v_email !~ '^[^@\s]+@[^@\s]+$' THEN
        RAISE EXCEPTION 'Enter an email address.';
    END IF;

    IF char_length(v_name) > 80 THEN
        RAISE EXCEPTION 'Keep the name to 80 characters.';
    END IF;

    IF char_length(v_note) > 500 THEN
        RAISE EXCEPTION 'Keep the note to 500 characters.';
    END IF;

    -- A current member: change their role. People with staff already see members' emails.
    UPDATE public.user_bars ub
    SET role_level = p_role_level
    FROM auth.users au
    WHERE ub.bar_id = p_bar_id AND ub.user_id = au.id AND lower(au.email) = v_email
    RETURNING ub.* INTO v_member;

    IF FOUND THEN
        RETURN v_member;
    END IF;

    -- Anyone else: an invite, counted against the inviter's and the venue's
    -- day. One at a time per inviter and per venue, so quick taps can't both
    -- pass the limit.
    IF NOT private.is_app_admin() THEN
        PERFORM pg_advisory_xact_lock(hashtextextended('invite:' || auth.uid()::text, 0));
        PERFORM pg_advisory_xact_lock(hashtextextended('invite-bar:' || p_bar_id::text, 0));
        IF private.rate_count('invite', auth.uid(), NULL, NULL) >= private.daily_limit('invite_per_inviter') THEN
            RAISE EXCEPTION 'You''ve sent % invites today. Try again tomorrow.', private.daily_limit('invite_per_inviter');
        END IF;
        IF private.rate_count('invite', NULL, p_bar_id, NULL) >= private.daily_limit('invite_per_venue') THEN
            RAISE EXCEPTION 'This venue has sent % invites today. Try again tomorrow.', private.daily_limit('invite_per_venue');
        END IF;
    END IF;
    INSERT INTO private.rate_events (kind, user_id, bar_id) VALUES ('invite', auth.uid(), p_bar_id);

    -- The same whether or not the email has an account. A pending invite to
    -- Admin stays as it is unless an Admin changes it (the whole call,
    -- rate count included, is undone).
    INSERT INTO public.bar_invites (bar_id, email, role_level, invited_by, name, note)
    VALUES (p_bar_id, v_email, p_role_level, auth.uid(), v_name, v_note)
    ON CONFLICT (bar_id, email)
    DO UPDATE SET role_level = EXCLUDED.role_level, invited_by = EXCLUDED.invited_by, created_at = now(),
        name = COALESCE(EXCLUDED.name, public.bar_invites.name),
        note = COALESCE(EXCLUDED.note, public.bar_invites.note)
    WHERE v_admin OR public.bar_invites.role_level < 40;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
        RAISE EXCEPTION 'They''re already invited as an Admin. Only an Admin can change that invite.';
    END IF;

    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION "public"."add_user_to_bar_by_email"("p_email" "text", "p_bar_id" "uuid", "p_role_level" integer, "p_name" "text", "p_note" "text") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."add_user_to_bar_by_email"("p_email" "text", "p_bar_id" "uuid", "p_role_level" integer, "p_name" "text", "p_note" "text") TO "authenticated", "service_role";

-- As 20261014900000, plus the bar's welcome message.
DROP FUNCTION "public"."my_bar_invites"();
CREATE FUNCTION "public"."my_bar_invites"()
    RETURNS TABLE("id" "uuid", "bar_id" "uuid", "bar_name" "text", "bar_slug" "text", "bar_logo_url" "text", "bar_color" "text",
                  "bar_display_face" "text", "bar_ground_tint" "text", "bar_profile_id" "uuid", "role_level" integer, "name" "text",
                  "invited_by_name" "text", "created_at" timestamp with time zone, "held" boolean, "welcome_message" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT i.id, i.bar_id, b.name, b.slug, b.logo_url, b.primary_color, b.display_face::text, b.ground_tint,
        p.id, i.role_level, i.name,
        COALESCE(nullif(btrim(ip.display_name), ''), nullif(btrim(iu.raw_user_meta_data ->> 'full_name'), '')),
        i.created_at,
        i.accepted_by IS NOT NULL AND private.venue_claim_pending(i.bar_id),
        nullif(btrim(b.welcome_message), '')
    FROM public.bar_invites i
    JOIN public.bars b ON b.id = i.bar_id
    LEFT JOIN public.profiles p ON p.bar_id = i.bar_id AND p.kind = 'bar'
    LEFT JOIN auth.users iu ON iu.id = i.invited_by
    LEFT JOIN public.profiles ip ON ip.user_id = i.invited_by AND ip.kind = 'person'
    WHERE i.email = (
        SELECT lower(u.email) FROM auth.users u
        WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL
    )
    ORDER BY i.created_at;
$$;
REVOKE ALL ON FUNCTION "public"."my_bar_invites"() FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."my_bar_invites"() TO "authenticated", "service_role";
