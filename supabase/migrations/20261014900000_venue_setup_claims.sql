-- Venue setup carries on while a bar claim is checked (decisions b19, b03).
-- Local stack only until Kevin's OK.
--
-- How setup works with a claim: the app makes the person a private venue of
-- their own first (create_new_bar, as Settings › Venues always could), then
-- claims the bar page for that venue (start_bar_claim with p_bar_id). They are
-- Admin of that private venue straight away and set it up. The public page is
-- untouched until a moderator approves the claim, which links the two.
--
-- What changes here, in plain words:
--   1. start_bar_claim takes the six-digit code the app showed before sending
--      (p_code). Without one the database still makes it, as before.
--   2. New Instagram claims are checked by a message from the bar's account,
--      not a code in its bio. The claim's evidence says so (instagram_dm), so
--      moderators know which to look for on older claims.
--   3. Invites to a venue whose claim is waiting are held: the invite still
--      goes out, and tapping Join marks it accepted, but they join the venue
--      only when the claim is approved. If no claim is waiting any more
--      (withdrawn or turned down), Join works as it always has.
--   4. A claimant can keep page settings on their own waiting claim (who sees
--      the page, hours, time zone, phone, website): save_claim_setup. They
--      are applied to the page when the claim is approved. Nothing on the
--      public page changes before that.
--   5. Approving a claim (private.hand_over_claim) applies those settings
--      (Locked stays the default when none were chosen) and lets the held
--      invitees in.

-- --- Settings kept on a waiting claim ---

ALTER TABLE "public"."profile_claims"
    ADD COLUMN "setup" "jsonb",
    ADD CONSTRAINT "profile_claims_setup_object" CHECK ("setup" IS NULL OR jsonb_typeof("setup") = 'object');

COMMENT ON COLUMN "public"."profile_claims"."setup" IS
    'Page settings chosen during venue setup while the claim waits: page_visibility, hours, timezone, phone, website. Applied when the claim is approved.';

-- --- Held invites ---

ALTER TABLE "public"."bar_invites"
    ADD COLUMN "accepted_by" "uuid" REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    ADD COLUMN "accepted_at" timestamp with time zone;

COMMENT ON COLUMN "public"."bar_invites"."accepted_by" IS
    'Who tapped Join while the venue''s claim was waiting. They join the venue when the claim is approved.';

-- A venue waiting on a claim: someone claimed a bar page for it, and it has
-- no page yet.
CREATE FUNCTION "private"."venue_claim_pending"("p_bar_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT EXISTS (SELECT 1 FROM public.profile_claims c WHERE c.bar_id = p_bar_id AND c.status = 'pending')
       AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.bar_id = p_bar_id);
$$;
REVOKE EXECUTE ON FUNCTION "private"."venue_claim_pending"("uuid") FROM PUBLIC, "anon", "authenticated";

-- Same as 20260929200000, except a venue waiting on its claim holds the invite.
CREATE OR REPLACE FUNCTION "public"."accept_bar_invite"("p_bar_id" "uuid") RETURNS "public"."user_bars"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_email TEXT;
    v_invite public.bar_invites;
    v_member public.user_bars;
BEGIN
    SELECT lower(email) INTO v_email
    FROM auth.users
    WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL;

    IF private.venue_claim_pending(p_bar_id) THEN
        UPDATE public.bar_invites
        SET accepted_by = auth.uid(), accepted_at = coalesce(accepted_at, now())
        WHERE bar_id = p_bar_id AND email = v_email
        RETURNING * INTO v_invite;
        IF v_invite.id IS NULL THEN
            RAISE EXCEPTION 'There''s no invite to this venue for your email.';
        END IF;
        -- Held: they join when the claim is approved. No member row yet.
        RETURN NULL;
    END IF;

    DELETE FROM public.bar_invites
    WHERE bar_id = p_bar_id AND email = v_email
    RETURNING * INTO v_invite;

    IF v_invite.id IS NULL THEN
        RAISE EXCEPTION 'There''s no invite to this venue for your email.';
    END IF;

    INSERT INTO public.user_bars (user_id, bar_id, role_level)
    VALUES (auth.uid(), p_bar_id, v_invite.role_level)
    ON CONFLICT (user_id, bar_id) DO UPDATE SET role_level = EXCLUDED.role_level
    RETURNING * INTO v_member;

    RETURN v_member;
END;
$$;

-- Same as 20261007160000 plus "held": they said yes and wait on the claim.
DROP FUNCTION "public"."my_bar_invites"();
CREATE FUNCTION "public"."my_bar_invites"() RETURNS TABLE (
    "id" "uuid",
    "bar_id" "uuid",
    "bar_name" "text",
    "bar_slug" "text",
    "bar_logo_url" "text",
    "bar_color" "text",
    "bar_display_face" "text",
    "bar_ground_tint" "text",
    "bar_profile_id" "uuid",
    "role_level" integer,
    "name" "text",
    "invited_by_name" "text",
    "created_at" timestamp with time zone,
    "held" boolean
)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT i.id, i.bar_id, b.name, b.slug, b.logo_url, b.primary_color, b.display_face::text, b.ground_tint,
        p.id, i.role_level, i.name,
        COALESCE(nullif(btrim(ip.display_name), ''), nullif(btrim(iu.raw_user_meta_data ->> 'full_name'), '')),
        i.created_at,
        i.accepted_by IS NOT NULL AND private.venue_claim_pending(i.bar_id)
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
REVOKE EXECUTE ON FUNCTION "public"."my_bar_invites"() FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."my_bar_invites"() TO "authenticated", "service_role";

-- --- Starting a claim ---

-- Same as 20261011152100 plus p_code (the code shown before sending) and
-- instagram_dm in the evidence.
DROP FUNCTION "public"."start_bar_claim"("uuid", "public"."claim_method", "uuid", "text");
CREATE FUNCTION "public"."start_bar_claim"("p_profile_id" "uuid", "p_method" "public"."claim_method", "p_bar_id" "uuid" DEFAULT NULL, "p_note" "text" DEFAULT NULL, "p_code" "text" DEFAULT NULL) RETURNS "public"."profile_claims"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_user uuid := auth.uid();
    v_profile public.profiles;
    v_claim public.profile_claims;
    v_instagram text;
    v_evidence jsonb;
    v_noun text;
BEGIN
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'Sign in to claim a bar.' USING ERRCODE = '42501';
    END IF;
    IF p_method IS NULL OR p_method = 'note' THEN
        RAISE EXCEPTION 'Pick how we can check it''s your bar.' USING ERRCODE = '22023';
    END IF;
    IF p_code IS NOT NULL AND p_code !~ '^[0-9]{6}$' THEN
        RAISE EXCEPTION 'The code should be six digits.' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_profile FROM public.profiles WHERE id = p_profile_id AND kind IN ('bar', 'maker');
    IF v_profile.id IS NULL THEN
        RAISE EXCEPTION 'There''s no bar page with that id.' USING ERRCODE = 'P0001';
    END IF;
    v_noun := CASE WHEN v_profile.kind = 'maker' THEN 'maker' ELSE 'bar' END;
    IF v_profile.user_id IS NOT NULL OR v_profile.bar_id IS NOT NULL THEN
        RAISE EXCEPTION 'This page has already been claimed.' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.profile_claims WHERE profile_id = p_profile_id AND user_id = v_user AND status = 'pending') THEN
        RAISE EXCEPTION 'You already have a claim waiting on this %.', v_noun USING ERRCODE = '23505';
    END IF;
    IF p_bar_id IS NOT NULL THEN
        IF p_bar_id NOT IN (SELECT private.my_bar_ids(40)) THEN
            RAISE EXCEPTION 'Only an Admin of that venue can link it to this page.' USING ERRCODE = '42501';
        END IF;
        IF EXISTS (SELECT 1 FROM public.profiles WHERE bar_id = p_bar_id) THEN
            RAISE EXCEPTION 'That venue already has a page of its own.' USING ERRCODE = 'P0001';
        END IF;
    END IF;

    v_instagram := private.page_instagram(v_profile.instagram, v_profile.website, v_profile.social_links);
    v_evidence := jsonb_build_object('website', v_profile.website, 'instagram', v_instagram, 'is_closed', v_profile.is_closed);
    IF p_method = 'email' THEN
        v_evidence := v_evidence || private.claim_email_evidence(v_user, v_profile.website, v_profile.is_closed);
        IF NOT (v_evidence ->> 'matches')::boolean THEN
            RAISE EXCEPTION 'Your sign-in email isn''t at this %''s website domain. Pick another way.', v_noun USING ERRCODE = 'P0001';
        END IF;
    ELSIF p_method = 'instagram' THEN
        IF v_instagram IS NULL THEN
            RAISE EXCEPTION 'This page has no Instagram to check. Pick another way.' USING ERRCODE = 'P0001';
        END IF;
        -- The code comes in a message from the bar's account, not its bio.
        v_evidence := v_evidence || jsonb_build_object('instagram_dm', true);
    END IF;

    INSERT INTO public.profile_claims (profile_id, user_id, bar_id, message, method, code, evidence)
    VALUES (p_profile_id, v_user, p_bar_id, nullif(btrim(left(p_note, 1000)), ''), p_method,
            CASE WHEN p_method IN ('instagram', 'phone') THEN coalesce(p_code, private.claim_code()) END, v_evidence)
    RETURNING * INTO v_claim;

    IF (v_evidence ->> 'auto')::boolean THEN
        PERFORM private.hand_over_claim(v_claim.id, NULL);
        SELECT * INTO v_claim FROM public.profile_claims WHERE id = v_claim.id;
    END IF;
    RETURN v_claim;
END;
$$;
REVOKE EXECUTE ON FUNCTION "public"."start_bar_claim"("uuid", "public"."claim_method", "uuid", "text", "text") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."start_bar_claim"("uuid", "public"."claim_method", "uuid", "text", "text") TO "authenticated", "service_role";

-- --- Keeping page settings on a waiting claim ---

-- The claimant's own waiting bar claim, merged key by key. A JSON null clears
-- a key. Each value is checked the way the page's own columns check it, so
-- approving never trips on them.
CREATE FUNCTION "public"."save_claim_setup"("p_claim_id" "uuid", "p_setup" "jsonb") RETURNS "public"."profile_claims"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_claim public.profile_claims;
    v_key text;
    v_value jsonb;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
    END IF;
    SELECT c.* INTO v_claim
    FROM public.profile_claims c JOIN public.profiles p ON p.id = c.profile_id
    WHERE c.id = p_claim_id AND c.user_id = auth.uid() AND c.status = 'pending' AND p.kind = 'bar'
    FOR UPDATE OF c;
    IF v_claim.id IS NULL THEN
        RAISE EXCEPTION 'There''s no waiting claim of yours with that id.' USING ERRCODE = '42501';
    END IF;
    IF p_setup IS NULL OR jsonb_typeof(p_setup) <> 'object' THEN
        RAISE EXCEPTION 'Nothing to save.' USING ERRCODE = '22023';
    END IF;

    FOR v_key, v_value IN SELECT key, value FROM jsonb_each(p_setup) LOOP
        CONTINUE WHEN jsonb_typeof(v_value) = 'null';
        IF v_key = 'page_visibility' THEN
            IF NOT (v_value #>> '{}') = ANY (enum_range(NULL::public.bar_page_visibility)::text[]) THEN
                RAISE EXCEPTION 'Pick Locked, Names and descriptions, or Open.' USING ERRCODE = '22023';
            END IF;
        ELSIF v_key = 'hours' THEN
            IF NOT private.bar_hours_ok(v_value) THEN
                RAISE EXCEPTION 'Those opening hours don''t look right.' USING ERRCODE = '22023';
            END IF;
        ELSIF v_key = 'timezone' THEN
            IF jsonb_typeof(v_value) <> 'string' OR NOT ((v_value #>> '{}') ~ '^[A-Za-z]+(/[A-Za-z0-9_+-]+){0,2}$' AND char_length(v_value #>> '{}') <= 64) THEN
                RAISE EXCEPTION 'That time zone doesn''t look right.' USING ERRCODE = '22023';
            END IF;
        ELSIF v_key = 'phone' THEN
            -- Same as profiles_phone_shape (20261013100000).
            IF jsonb_typeof(v_value) <> 'string' OR NOT (
                (v_value #>> '{}') ~ '^\+?[0-9 ().-]{5,29}$'
                AND (v_value #>> '{}') = btrim(v_value #>> '{}')
                AND char_length(regexp_replace(v_value #>> '{}', '[^0-9]', '', 'g')) >= 6
            ) THEN
                RAISE EXCEPTION 'That phone number doesn''t look right.' USING ERRCODE = '22023';
            END IF;
        ELSIF v_key = 'website' THEN
            IF jsonb_typeof(v_value) <> 'string' OR char_length(v_value #>> '{}') > 300 OR NOT (v_value #>> '{}') ~ '^(https?://)?[^\s/]+\.[^\s]+$' THEN
                RAISE EXCEPTION 'That website doesn''t look right.' USING ERRCODE = '22023';
            END IF;
        ELSE
            RAISE EXCEPTION 'Setup can''t keep "%".', v_key USING ERRCODE = '22023';
        END IF;
    END LOOP;

    UPDATE public.profile_claims
    SET setup = jsonb_strip_nulls(coalesce(setup, '{}'::jsonb) || p_setup)
    WHERE id = v_claim.id
    RETURNING * INTO v_claim;
    RETURN v_claim;
END;
$$;
REVOKE EXECUTE ON FUNCTION "public"."save_claim_setup"("uuid", "jsonb") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."save_claim_setup"("uuid", "jsonb") TO "authenticated", "service_role";

-- --- Approving ---

-- Same as 20261010130000, plus: the page's visibility is the one chosen during
-- setup (else Locked), the settings kept on the claim go onto the page, and
-- invitees who said yes while it waited join the venue.
CREATE OR REPLACE FUNCTION "private"."hand_over_claim"("p_claim_id" "uuid", "p_reviewer" "uuid") RETURNS "public"."profiles"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_claim public.profile_claims;
    v_profile public.profiles;
    v_bar_id uuid;
    v_visibility public.bar_page_visibility;
BEGIN
    SELECT * INTO v_claim FROM public.profile_claims WHERE id = p_claim_id AND status = 'pending' FOR UPDATE;
    IF v_claim.id IS NULL THEN
        RAISE EXCEPTION 'No pending claim with that id.';
    END IF;
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_claim.profile_id FOR UPDATE;
    IF v_profile.user_id IS NOT NULL OR v_profile.bar_id IS NOT NULL THEN
        RAISE EXCEPTION 'That profile has already been claimed.';
    END IF;

    IF v_profile.kind = 'person' THEN
        -- Made a profile (or was approved for another) after claiming this one.
        IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = v_claim.user_id) THEN
            RAISE EXCEPTION 'This person already has a profile. Merge them by hand, or turn the claim down.';
        END IF;
        UPDATE public.profiles SET user_id = v_claim.user_id, claimed_at = now()
        WHERE id = v_profile.id RETURNING * INTO v_profile;
    ELSE
        v_visibility := coalesce((v_claim.setup ->> 'page_visibility')::public.bar_page_visibility, 'locked');
        v_bar_id := v_claim.bar_id;
        IF v_bar_id IS NULL THEN
            INSERT INTO public.bars (name, logo_url, page_visibility)
            VALUES (v_profile.display_name, v_profile.avatar_url, v_visibility)
            RETURNING id INTO v_bar_id;
            INSERT INTO public.user_bars (bar_id, user_id, role_level) VALUES (v_bar_id, v_claim.user_id, 40);
        ELSE
            IF EXISTS (SELECT 1 FROM public.profiles WHERE bar_id = v_bar_id) THEN
                RAISE EXCEPTION 'This bar already has a profile. Merge them by hand, or turn the claim down.';
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM public.user_bars ub
                WHERE ub.bar_id = v_bar_id AND ub.user_id = v_claim.user_id AND ub.role_level >= 40
                  AND NOT EXISTS (SELECT 1 FROM public.venue_roles vr WHERE vr.id = ub.venue_role_id AND vr.ends_at <= now())
            ) THEN
                RAISE EXCEPTION 'They''re no longer an Admin of the venue they chose. Turn the claim down so they can claim again.';
            END IF;
            UPDATE public.bars SET page_visibility = v_visibility WHERE id = v_bar_id;
        END IF;
        UPDATE public.profiles SET bar_id = v_bar_id, claimed_at = now()
        WHERE id = v_profile.id RETURNING * INTO v_profile;

        -- Settings kept on the claim. save_claim_setup checked them; if the
        -- page's rules moved on since, approving still goes through without them.
        IF v_claim.setup IS NOT NULL THEN
            BEGIN
                UPDATE public.profiles SET
                    hours = CASE WHEN v_claim.setup ? 'hours' THEN v_claim.setup -> 'hours' ELSE hours END,
                    timezone = CASE WHEN v_claim.setup ? 'timezone' THEN v_claim.setup ->> 'timezone' ELSE timezone END,
                    phone = CASE WHEN v_claim.setup ? 'phone' THEN v_claim.setup ->> 'phone' ELSE phone END,
                    website = CASE WHEN v_claim.setup ? 'website' THEN v_claim.setup ->> 'website' ELSE website END
                WHERE id = v_profile.id RETURNING * INTO v_profile;
            EXCEPTION WHEN check_violation THEN
                NULL;
            END;
        END IF;

        -- Invitees who said yes while the claim waited.
        INSERT INTO public.user_bars (user_id, bar_id, role_level)
        SELECT i.accepted_by, i.bar_id, i.role_level FROM public.bar_invites i
        WHERE i.bar_id = v_bar_id AND i.accepted_by IS NOT NULL
        ON CONFLICT (user_id, bar_id) DO NOTHING;
        DELETE FROM public.bar_invites WHERE bar_id = v_bar_id AND accepted_by IS NOT NULL;
    END IF;

    UPDATE public.profile_claims
    SET status = CASE WHEN id = p_claim_id THEN 'approved' ELSE 'rejected' END::public.claim_status,
        decline_reason = CASE WHEN id = p_claim_id THEN NULL ELSE 'Someone else claimed this page first.' END,
        reviewed_by = p_reviewer,
        reviewed_at = now()
    WHERE profile_id = v_claim.profile_id AND status = 'pending';

    RETURN v_profile;
END;
$$;
