-- Daily limits on invites, new venues and AI calls, and venue writes that
-- follow the same role rules as the bars policies.
--
--   * private.daily_limit(kind): every daily limit below, in one place.
--   * private.rate_events: one row per invite, invite email and new venue,
--     kept even when the invite or venue is later removed, so cancelling or
--     deleting doesn't hand the allowance back.
--   * add_user_to_bar_by_email: an Admin sends at most 20 invites a day, and
--     a venue gets at most 50 a day from all its Admins. Role changes for
--     current members aren't counted.
--   * take_invite_email_slot(): send-bar-invite asks before each email: 3 a
--     day for one invite, 30 a day from one Admin. Service role only.
--   * create_new_bar: at most 3 new venues a day per person.
--     App admins (catalog moderators) skip the invite and venue limits, as
--     they do add_venue's.
--   * consume_ai_quota / consume_item_ai_quota: a project-wide ceiling of
--     2,000 paid AI calls a day on top of each person's and venue's own.
--   * update_bar_settings and assign_item_to_bar check the caller with
--     private.my_bar_ids(40), as the bars policies do: a current Admin.
--   * user_bars: no direct inserts, so memberships come only from accepting an
--     invite, creating a venue or an approved claim. Direct updates may change
--     the role (role_level, venue_role_id) only, not whose or which venue's
--     row it is.
--
-- Limit errors are P0001 with a message written for people, which the app
-- shows as is.

-- --- Limits ---

CREATE FUNCTION "private"."daily_limit"("p_kind" "text") RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT CASE p_kind
    WHEN 'invite_per_inviter' THEN 20
    WHEN 'invite_per_venue' THEN 50
    WHEN 'invite_email_per_invite' THEN 3
    WHEN 'invite_email_per_sender' THEN 30
    WHEN 'venue_create' THEN 3
    WHEN 'ai_project' THEN 2000
  END;
$$;

CREATE TABLE "private"."rate_events" (
    "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "kind" "text" NOT NULL CHECK ("kind" IN ('invite', 'invite_email', 'venue_create')),
    "user_id" "uuid",
    "bar_id" "uuid",
    -- What the event was about beyond the venue (an invite email's address).
    "subject" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
CREATE INDEX "rate_events_user_idx" ON "private"."rate_events" ("kind", "user_id", "created_at" DESC);
CREATE INDEX "rate_events_bar_idx" ON "private"."rate_events" ("kind", "bar_id", "created_at" DESC) WHERE "bar_id" IS NOT NULL;
ALTER TABLE "private"."rate_events" ENABLE ROW LEVEL SECURITY;
-- ponytail: rows are never pruned; a few hundred a day at most. Add a cron
-- delete of rows older than a week if the table ever matters.

-- How many events of a kind in the last day, by person, venue and subject
-- (each NULL means any).
CREATE FUNCTION "private"."rate_count"("p_kind" "text", "p_user_id" "uuid", "p_bar_id" "uuid", "p_subject" "text") RETURNS integer
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT count(*)::integer FROM private.rate_events
  WHERE kind = p_kind AND created_at > now() - interval '1 day'
    AND (p_user_id IS NULL OR user_id = p_user_id)
    AND (p_bar_id IS NULL OR bar_id = p_bar_id)
    AND (p_subject IS NULL OR subject = p_subject);
$$;

-- --- Invites ---

CREATE OR REPLACE FUNCTION "public"."add_user_to_bar_by_email"("p_email" "text", "p_bar_id" "uuid", "p_role_level" integer, "p_name" "text" DEFAULT NULL) RETURNS "public"."user_bars"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_email TEXT := lower(btrim(p_email));
    v_name TEXT := nullif(btrim(p_name), '');
    v_member public.user_bars;
BEGIN
    IF p_bar_id IS NULL OR p_bar_id NOT IN (SELECT private.my_bar_ids(40)) THEN
        RAISE EXCEPTION 'You must be a bar Admin to add members.';
    END IF;

    IF p_role_level IS NULL OR NOT (p_role_level = ANY (ARRAY[10, 20, 30, 35, 40])) THEN
        RAISE EXCEPTION 'Invalid role level.';
    END IF;

    IF v_email IS NULL OR v_email !~ '^[^@\s]+@[^@\s]+$' THEN
        RAISE EXCEPTION 'Enter an email address.';
    END IF;

    IF char_length(v_name) > 80 THEN
        RAISE EXCEPTION 'Keep the name to 80 characters.';
    END IF;

    -- A current member: change their role. Admins already see members' emails.
    UPDATE public.user_bars ub
    SET role_level = p_role_level
    FROM auth.users au
    WHERE ub.bar_id = p_bar_id AND ub.user_id = au.id AND lower(au.email) = v_email
    RETURNING ub.* INTO v_member;

    IF FOUND THEN
        RETURN v_member;
    END IF;

    -- Anyone else: an invite, counted against the Admin's and the venue's
    -- day. One at a time per Admin and per venue, so quick taps can't both
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

    -- The same whether or not the email has an account.
    INSERT INTO public.bar_invites (bar_id, email, role_level, invited_by, name)
    VALUES (p_bar_id, v_email, p_role_level, auth.uid(), v_name)
    ON CONFLICT (bar_id, email)
    DO UPDATE SET role_level = EXCLUDED.role_level, invited_by = EXCLUDED.invited_by, created_at = now(),
        name = COALESCE(EXCLUDED.name, public.bar_invites.name);

    RETURN NULL;
END;
$$;

-- Takes one email from today's allowance for an invite, before
-- send-bar-invite emails it. Returns 'ok', 'invite' when that invite has been
-- emailed enough today, or 'sender' when the Admin has. Service role only:
-- the function has already checked that the sender may see the invite.
CREATE FUNCTION "public"."take_invite_email_slot"("p_sender" "uuid", "p_bar_id" "uuid", "p_email" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_email TEXT := lower(btrim(p_email));
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended('invite-email:' || p_sender::text, 0));
    IF private.rate_count('invite_email', NULL, p_bar_id, v_email) >= private.daily_limit('invite_email_per_invite') THEN
        RETURN 'invite';
    END IF;
    IF private.rate_count('invite_email', p_sender, NULL, NULL) >= private.daily_limit('invite_email_per_sender') THEN
        RETURN 'sender';
    END IF;
    INSERT INTO private.rate_events (kind, user_id, bar_id, subject) VALUES ('invite_email', p_sender, p_bar_id, v_email);
    RETURN 'ok';
END;
$$;

REVOKE EXECUTE ON FUNCTION "public"."take_invite_email_slot"("uuid", "uuid", "text") FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."take_invite_email_slot"("uuid", "uuid", "text") TO "service_role";

-- --- New venues ---

CREATE OR REPLACE FUNCTION "public"."create_new_bar"("p_name" "text", "p_visibility" integer, "p_generic" integer, "p_specific" integer, "p_measurement" integer, "p_prep" integer) RETURNS "public"."bars"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    new_bar public.bars;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'You must be signed in to create a bar.';
    END IF;

    IF NOT private.is_app_admin() THEN
        PERFORM pg_advisory_xact_lock(hashtextextended('venue-create:' || auth.uid()::text, 0));
        IF private.rate_count('venue_create', auth.uid(), NULL, NULL) >= private.daily_limit('venue_create') THEN
            RAISE EXCEPTION 'You''ve made % venues today. Try again tomorrow.', private.daily_limit('venue_create');
        END IF;
    END IF;

    INSERT INTO public.bars (
        name,
        default_visibility_level,
        default_generic_ingredient_level,
        default_specific_brand_level,
        default_measurement_level,
        default_prep_level
    ) VALUES (
        p_name,
        p_visibility,
        p_generic,
        p_specific,
        p_measurement,
        p_prep
    ) RETURNING * INTO new_bar;

    INSERT INTO public.user_bars (bar_id, user_id, role_level)
    VALUES (new_bar.id, auth.uid(), 40);

    INSERT INTO private.rate_events (kind, user_id, bar_id) VALUES ('venue_create', auth.uid(), new_bar.id);

    RETURN new_bar;
END;
$$;

-- --- AI ceiling ---

CREATE INDEX "ai_usage_created_at_idx" ON "private"."ai_usage" ("created_at" DESC);

-- Whether the whole project has a paid AI call left today. Takes a lock so
-- concurrent callers can't all squeeze past the ceiling.
CREATE FUNCTION "private"."ai_project_has_room"() RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended('ai-usage:project', 0));
    RETURN (SELECT count(*) FROM private.ai_usage WHERE created_at > now() - interval '24 hours')
        < private.daily_limit('ai_project');
END;
$$;

CREATE OR REPLACE FUNCTION "public"."consume_ai_quota"("p_user_id" "uuid", "p_fn" "text", "p_daily_limit" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_count INT;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

    SELECT count(*) INTO v_count
    FROM private.ai_usage
    WHERE user_id = p_user_id AND created_at > now() - interval '24 hours';

    IF v_count >= p_daily_limit OR NOT private.ai_project_has_room() THEN
        RETURN false;
    END IF;

    INSERT INTO private.ai_usage (user_id, fn) VALUES (p_user_id, p_fn);
    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."consume_item_ai_quota"("p_item_id" "uuid", "p_fn" "text", "p_venue_daily_limit" integer, "p_user_daily_limit" integer) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_bar_id uuid;
    v_user_id uuid;
    v_count int;
BEGIN
    SELECT bar_id, created_by INTO v_bar_id, v_user_id FROM public.items WHERE id = p_item_id;

    IF v_bar_id IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtextextended(v_bar_id::text, 0));
        SELECT count(*) INTO v_count FROM private.ai_usage
        WHERE bar_id = v_bar_id AND created_at > now() - interval '24 hours';
        IF v_count >= p_venue_daily_limit OR NOT private.ai_project_has_room() THEN
            RETURN 'limit';
        END IF;
        INSERT INTO private.ai_usage (bar_id, fn) VALUES (v_bar_id, p_fn);
        RETURN 'ok';
    END IF;

    IF v_user_id IS NOT NULL THEN
        RETURN CASE WHEN public.consume_ai_quota(v_user_id, p_fn, p_user_daily_limit) THEN 'ok' ELSE 'limit' END;
    END IF;

    RETURN 'no_payer';
END;
$$;

-- --- Venue writes by current Admins ---

CREATE OR REPLACE FUNCTION "public"."update_bar_settings"("p_bar_id" "uuid", "p_name" "text", "p_visibility" integer, "p_generic" integer, "p_specific" integer, "p_measurement" integer, "p_prep" integer, "p_logo_url" "text" DEFAULT NULL::"text", "p_primary_color" "text" DEFAULT NULL::"text", "p_secondary_color" "text" DEFAULT NULL::"text") RETURNS "public"."bars"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_updated_bar public.bars;
BEGIN
    IF p_bar_id IS NULL OR p_bar_id NOT IN (SELECT private.my_bar_ids(40)) THEN
        RAISE EXCEPTION 'You must be a bar Admin to update bar settings.';
    END IF;

    UPDATE public.bars
    SET
        name = p_name,
        default_visibility_level = p_visibility,
        default_generic_ingredient_level = p_generic,
        default_specific_brand_level = p_specific,
        default_measurement_level = p_measurement,
        default_prep_level = p_prep,
        logo_url = COALESCE(p_logo_url, logo_url),
        primary_color = p_primary_color,
        secondary_color = p_secondary_color
    WHERE id = p_bar_id
    RETURNING * INTO v_updated_bar;

    RETURN v_updated_bar;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."assign_item_to_bar"("p_item_id" "uuid", "p_bar_id" "uuid") RETURNS "public"."items"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_updated_item public.items;
BEGIN
    IF p_bar_id IS NULL OR p_bar_id NOT IN (SELECT private.my_bar_ids(40)) THEN
        RAISE EXCEPTION 'You must be a bar Admin to assign items to this bar.';
    END IF;

    -- Moving an item takes it away from wherever it lives now, so the caller
    -- must also be allowed to edit it there.
    IF NOT private.can_edit_item(p_item_id) THEN
        RAISE EXCEPTION 'You do not have permission to move this item.';
    END IF;

    UPDATE public.items
    SET bar_id = p_bar_id
    WHERE id = p_item_id
    RETURNING * INTO v_updated_item;

    RETURN v_updated_item;
END;
$$;

-- --- Memberships ---

DROP POLICY "user_bars_insert" ON "public"."user_bars";
REVOKE INSERT ON "public"."user_bars" FROM "anon", "authenticated";
REVOKE UPDATE ON "public"."user_bars" FROM "anon", "authenticated";
GRANT UPDATE ("role_level", "venue_role_id") ON "public"."user_bars" TO "authenticated";
