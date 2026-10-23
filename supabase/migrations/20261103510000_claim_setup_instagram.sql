-- A waiting bar claim keeps the bar's Instagram too, so a handle typed in
-- venue setup reaches the page whichever way the claim is checked.
--
-- Venue setup (#718) holds step 3's hours, phone, website and Instagram on the
-- device until the claim is sent, then keeps them on the claim with
-- save_claim_setup. That took everything but the Instagram, and
-- start_bar_claim only records a typed handle for an Instagram claim, so on a
-- work-email or phone claim waiting for a person the handle never got to the
-- page. Now:
--   1. save_claim_setup takes an `instagram` key: '@handle' or an
--      instagram.com link becomes the handle, checked like
--      profiles_instagram_format (as start_bar_claim does). Same security as
--      before: only the claimant, on their own waiting bar claim.
--   2. hand_over_claim puts the claim's Instagram on the page when it's
--      approved, and only where the page has none (what the page says wins).
--      A handle typed into the claim itself (evidence.typed.instagram) wins
--      over one kept from setup.
--   3. That makes hand_over_claim the one place an Instagram goes on, so the
--      fill_page_from_typed_claim trigger (20261031200000) is dropped. Every
--      approval runs through hand_over_claim (approve_profile_claim, and
--      start_bar_claim's instant approval).

-- --- Keeping page settings on a waiting claim ---

-- 20261014900000's save_claim_setup, plus 'instagram'.
CREATE OR REPLACE FUNCTION "public"."save_claim_setup"("p_claim_id" "uuid", "p_setup" "jsonb") RETURNS "public"."profile_claims"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_claim public.profile_claims;
    v_setup jsonb := p_setup;
    v_key text;
    v_value jsonb;
    v_instagram text;
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
        ELSIF v_key = 'instagram' THEN
            IF jsonb_typeof(v_value) <> 'string' THEN
                RAISE EXCEPTION 'That doesn''t look like an Instagram handle.' USING ERRCODE = '22023';
            END IF;
            -- '@harbourroom' or an instagram.com link -> 'harbourroom', as start_bar_claim does.
            v_instagram := lower(coalesce(substring(btrim(v_value #>> '{}') FROM '(?i)instagram\.com/([a-z0-9._]+)'), ltrim(btrim(v_value #>> '{}'), '@')));
            IF v_instagram = '' THEN
                -- Blank clears it, like a JSON null.
                v_setup := v_setup || jsonb_build_object('instagram', NULL);
                CONTINUE;
            END IF;
            -- Same as profiles_instagram_format, or approving would fail to put it on the page.
            IF v_instagram !~ '^[a-z0-9._]{1,30}$' OR v_instagram ~ '^\.|\.$|\.\.' THEN
                RAISE EXCEPTION 'That doesn''t look like an Instagram handle.' USING ERRCODE = '22023';
            END IF;
            v_setup := v_setup || jsonb_build_object('instagram', v_instagram);
        ELSE
            RAISE EXCEPTION 'Setup can''t keep "%".', v_key USING ERRCODE = '22023';
        END IF;
    END LOOP;

    UPDATE public.profile_claims
    SET setup = jsonb_strip_nulls(coalesce(setup, '{}'::jsonb) || v_setup)
    WHERE id = v_claim.id
    RETURNING * INTO v_claim;
    RETURN v_claim;
END;
$$;
REVOKE EXECUTE ON FUNCTION "public"."save_claim_setup"("uuid", "jsonb") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."save_claim_setup"("uuid", "jsonb") TO "authenticated", "service_role";

-- --- Handing a page over ---

-- Same as 20261030100000, plus the claim's Instagram (typed into the claim,
-- else kept from setup) goes on the page when the page has none.
CREATE OR REPLACE FUNCTION "private"."hand_over_claim"("p_claim_id" "uuid", "p_reviewer" "uuid") RETURNS "public"."profiles"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_claim public.profile_claims;
    v_profile public.profiles;
    v_own uuid;
    v_bar_id uuid;
    v_visibility public.bar_page_visibility;
    v_instagram text;
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
        SELECT id INTO v_own FROM public.profiles WHERE user_id = v_claim.user_id;
        -- No profile yet: the page becomes theirs. Otherwise it merges into
        -- theirs once the claims are settled, below.
        IF v_own IS NULL THEN
            UPDATE public.profiles SET user_id = v_claim.user_id, claimed_at = now()
            WHERE id = v_profile.id RETURNING * INTO v_profile;
        END IF;
    ELSE
        v_visibility := coalesce((v_claim.setup ->> 'page_visibility')::public.bar_page_visibility, 'description');
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

        -- The claim's Instagram, only where the page says none (in its
        -- Instagram, website or links). Checked when it was typed; the same
        -- fallback as above if the rule moved on.
        v_instagram := coalesce(v_claim.evidence #>> '{typed,instagram}', v_claim.setup ->> 'instagram');
        IF v_instagram IS NOT NULL AND private.page_instagram(v_profile.instagram, v_profile.website, v_profile.social_links) IS NULL THEN
            BEGIN
                UPDATE public.profiles SET instagram = v_instagram
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

    IF v_profile.kind = 'person' AND v_own IS NOT NULL THEN
        v_profile := private.merge_person_profile(v_claim.profile_id, v_own, p_claim_id, p_reviewer);
    END IF;
    RETURN v_profile;
END;
$$;
REVOKE EXECUTE ON FUNCTION "private"."hand_over_claim"("uuid", "uuid") FROM PUBLIC, "anon", "authenticated";

-- --- One path for the Instagram ---

-- hand_over_claim puts a typed Instagram on the page now.
DROP TRIGGER "fill_page_from_typed_claim" ON "public"."profile_claims";
DROP FUNCTION "private"."fill_page_from_typed_claim"();
