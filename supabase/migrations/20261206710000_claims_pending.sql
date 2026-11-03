-- Claims wait for a person (Kevin, 3 Nov 2026). Starting a claim on a bar,
-- maker or supplier page now only records a pending claim: it never makes a
-- venue and never makes anyone an Admin. A moderator approves one claim in
-- the claims review, and only then is the venue made (or the claimant's own
-- venue linked) with the claimant as its Admin, on the page that was already
-- there, not a second listing.
--
--   1. start_bar_claim: a work email at the page's own domain no longer
--      approves on the spot. It waits like every other way. The strong match
--      is kept as evidence.strong_match, and evidence.auto is now always
--      false, so the claim-email trigger (20261128800000) emails moderators
--      that it arrived, as for any other waiting claim. Several
--      people can each have a claim waiting on one page (unchanged); approving
--      one turns the others down (hand_over_claim, unchanged there).
--   2. A bar page the claimant added themselves (created_by is them: not a
--      known, listed bar) goes hidden while their claim waits, and the claim
--      notes it (evidence.hid_page). hand_over_claim shows it again on
--      approval. The claimant and moderators can still read a page with a
--      pending claim on it (profiles_select_pending_claim). If the claim is
--      withdrawn or turned down instead, the page is shown again, as it was
--      before the claim (private.show_page_after_claim).
--   3. bar_claim_pending(): whether anyone has a claim waiting on a page, so
--      the page's claim button can say so. Yes or no, nothing about who.
--   4. guard_bar_page_visibility: who sees a bar's page can only change on a
--      venue that has a page, that is once its claim is approved. Moderators
--      and approval itself (run as the moderator) are unaffected.
-- Nothing here changes or removes existing rows.

-- --- Starting a claim ---

-- 20261031200000's start_bar_claim, without the instant approval, and hiding
-- a page the claimant added themselves while the claim waits.
CREATE OR REPLACE FUNCTION "public"."start_bar_claim"("p_profile_id" "uuid", "p_method" "public"."claim_method", "p_bar_id" "uuid" DEFAULT NULL, "p_note" "text" DEFAULT NULL, "p_code" "text" DEFAULT NULL, "p_instagram" "text" DEFAULT NULL, "p_website" "text" DEFAULT NULL, "p_phone" "text" DEFAULT NULL) RETURNS "public"."profile_claims"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_user uuid := auth.uid();
    v_profile public.profiles;
    v_claim public.profile_claims;
    v_instagram text;
    v_website text;
    v_phone text;
    v_typed jsonb := '{}'::jsonb;
    v_setup jsonb;
    v_evidence jsonb;
    v_noun text;
    v_hide boolean;
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

    SELECT * INTO v_profile FROM public.profiles WHERE id = p_profile_id AND kind IN ('bar', 'maker', 'supplier') FOR UPDATE;
    IF v_profile.id IS NULL THEN
        RAISE EXCEPTION 'There''s no bar page with that id.' USING ERRCODE = 'P0001';
    END IF;
    v_noun := CASE v_profile.kind WHEN 'maker' THEN 'maker' WHEN 'supplier' THEN 'supplier' ELSE 'bar' END;
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

    -- What the page says wins; a typed detail only fills a gap.
    v_instagram := private.page_instagram(v_profile.instagram, v_profile.website, v_profile.social_links);
    v_website := nullif(btrim(v_profile.website), '');
    v_phone := nullif(btrim(v_profile.phone), '');

    IF p_method = 'instagram' AND v_instagram IS NULL AND nullif(btrim(p_instagram), '') IS NOT NULL THEN
        -- '@harbourroom' or an instagram.com link -> 'harbourroom'.
        v_instagram := lower(coalesce(substring(btrim(p_instagram) FROM '(?i)instagram\.com/([a-z0-9._]+)'), ltrim(btrim(p_instagram), '@')));
        -- Same as profiles_instagram_format, or approving would fail to put it on the page.
        IF v_instagram !~ '^[a-z0-9._]{1,30}$' OR v_instagram ~ '^\.|\.$|\.\.' THEN
            RAISE EXCEPTION 'That doesn''t look like an Instagram handle.' USING ERRCODE = '22023';
        END IF;
        v_typed := v_typed || jsonb_build_object('instagram', v_instagram);
    ELSIF p_method = 'email' AND v_website IS NULL AND nullif(btrim(p_website), '') IS NOT NULL THEN
        -- Same shape as save_claim_setup's website (20261014900000).
        v_website := btrim(p_website);
        IF char_length(v_website) > 300 OR v_website !~* '^(https?://)?[^\s/]+\.[^\s]+$' THEN
            RAISE EXCEPTION 'That website doesn''t look right.' USING ERRCODE = '22023';
        END IF;
        IF v_website !~* '^https?://' THEN
            v_website := 'https://' || v_website;
        END IF;
        v_typed := v_typed || jsonb_build_object('website', v_website);
    ELSIF p_method = 'phone' AND v_phone IS NULL AND nullif(btrim(p_phone), '') IS NOT NULL THEN
        -- Same as profiles_phone_shape (20261014300000).
        v_phone := btrim(p_phone);
        IF NOT (v_phone ~ '^\+?[0-9 ().-]{5,29}$' AND char_length(regexp_replace(v_phone, '[^0-9]', '', 'g')) >= 6) THEN
            RAISE EXCEPTION 'That phone number doesn''t look right.' USING ERRCODE = '22023';
        END IF;
        v_typed := v_typed || jsonb_build_object('phone', v_phone);
    END IF;

    v_evidence := jsonb_build_object('website', v_profile.website, 'instagram', v_instagram, 'is_closed', v_profile.is_closed);
    IF v_typed <> '{}'::jsonb THEN
        v_evidence := v_evidence || jsonb_build_object('typed', v_typed);
    END IF;

    IF p_method = 'email' THEN
        IF v_website IS NULL THEN
            RAISE EXCEPTION 'This page has no website to match an email against. Add the %''s website, or pick another way.', v_noun USING ERRCODE = 'P0001';
        END IF;
        v_evidence := v_evidence || private.claim_email_evidence(v_user, v_website, v_profile.is_closed);
        IF NOT (v_evidence ->> 'matches')::boolean THEN
            RAISE EXCEPTION 'Your sign-in email isn''t at this %''s website domain. Pick another way.', v_noun USING ERRCODE = 'P0001';
        END IF;
        -- A website they typed is checked by a person, however well it matches.
        -- A stronger reason (a shared host, a page on a bigger site) stays.
        IF v_typed ? 'website' THEN
            v_evidence := v_evidence || jsonb_build_object('auto', false, 'review_reason', coalesce(v_evidence ->> 'review_reason', 'site_typed'));
        END IF;
        -- Nothing is approved on the spot: a strong match is a note for the reviewer.
        v_evidence := v_evidence || jsonb_build_object('strong_match', coalesce((v_evidence ->> 'auto')::boolean, false), 'auto', false);
    ELSIF p_method = 'instagram' THEN
        IF v_instagram IS NULL THEN
            RAISE EXCEPTION 'This page has no Instagram to check. Add the %''s Instagram, or pick another way.', v_noun USING ERRCODE = 'P0001';
        END IF;
        -- The code comes in a message from the bar's account, not its bio.
        v_evidence := v_evidence || jsonb_build_object('instagram_dm', true);
    ELSIF p_method = 'phone' THEN
        IF v_phone IS NULL THEN
            RAISE EXCEPTION 'This page has no phone number to ring. Add the %''s number, or pick another way.', v_noun USING ERRCODE = 'P0001';
        END IF;
    END IF;

    -- A bar page the claimant added themselves isn't a known bar: hidden until a person approves the claim.
    v_hide := v_profile.kind = 'bar' AND v_profile.is_public AND v_profile.created_by = v_user;
    IF v_hide THEN
        v_evidence := v_evidence || jsonb_build_object('hid_page', true);
    END IF;

    -- Setup's Where and when shows a typed website or phone, and approval puts it on the page.
    v_setup := nullif(jsonb_strip_nulls(jsonb_build_object('website', v_typed ->> 'website', 'phone', v_typed ->> 'phone')), '{}'::jsonb);

    INSERT INTO public.profile_claims (profile_id, user_id, bar_id, message, method, code, evidence, setup)
    VALUES (p_profile_id, v_user, p_bar_id, nullif(btrim(left(p_note, 1000)), ''), p_method,
            CASE WHEN p_method IN ('instagram', 'phone') THEN coalesce(p_code, private.claim_code()) END, v_evidence, v_setup)
    RETURNING * INTO v_claim;

    IF v_hide THEN
        UPDATE public.profiles SET is_public = false WHERE id = p_profile_id;
    END IF;
    -- Every claim waits for a moderator (approve_profile_claim): no venue, no Admin until then.
    RETURN v_claim;
END;
$$;

-- A page start_bar_claim hid shows again when its claim is withdrawn or
-- turned down: hidden only while the claim waits, public once approved.
CREATE FUNCTION "private"."show_page_after_claim"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    UPDATE public.profiles SET is_public = true
    WHERE id = OLD.profile_id AND NOT is_public AND moderated_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.profile_claims c WHERE c.profile_id = OLD.profile_id AND c.status = 'pending' AND c.id <> OLD.id);
    RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION "private"."show_page_after_claim"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "show_page_after_claim_withdrawn" AFTER DELETE ON "public"."profile_claims"
    FOR EACH ROW
    WHEN (OLD.status = 'pending' AND (OLD.evidence ->> 'hid_page') = 'true')
    EXECUTE FUNCTION "private"."show_page_after_claim"();

CREATE TRIGGER "show_page_after_claim_declined" AFTER UPDATE OF "status" ON "public"."profile_claims"
    FOR EACH ROW
    WHEN (OLD.status = 'pending' AND NEW.status = 'rejected' AND (OLD.evidence ->> 'hid_page') = 'true')
    EXECUTE FUNCTION "private"."show_page_after_claim"();

-- --- Reading a page with a claim waiting ---

-- Pages the caller may read because of a pending claim: their own claims, or
-- every pending one for a moderator. Definer, so the profiles policy below
-- doesn't loop through profile_claims' own policies.
CREATE FUNCTION "private"."pending_claim_profile_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT c.profile_id FROM public.profile_claims c
  WHERE c.status = 'pending'
    AND (c.user_id = auth.uid() OR EXISTS (SELECT 1 FROM private.app_admins aa WHERE aa.user_id = auth.uid()));
$$;
REVOKE EXECUTE ON FUNCTION "private"."pending_claim_profile_ids"() FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."pending_claim_profile_ids"() TO "authenticated";

CREATE POLICY "profiles_select_pending_claim" ON "public"."profiles" FOR SELECT TO "authenticated"
    USING ("id" IN (SELECT "private"."pending_claim_profile_ids"()));

-- Whether anyone has a claim waiting on this page. Only yes or no.
CREATE FUNCTION "public"."bar_claim_pending"("p_profile_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profile_claims c JOIN public.profiles p ON p.id = c.profile_id
    WHERE c.profile_id = p_profile_id AND c.status = 'pending' AND p.kind IN ('bar', 'maker', 'supplier')
  );
$$;
REVOKE EXECUTE ON FUNCTION "public"."bar_claim_pending"("uuid") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."bar_claim_pending"("uuid") TO "anon", "authenticated", "service_role";

-- --- Handing a page over ---

-- 20261103510000's hand_over_claim, plus: a page start_bar_claim hid comes back on approval.
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
        UPDATE public.profiles SET bar_id = v_bar_id, claimed_at = now(),
            is_public = CASE WHEN (v_claim.evidence ->> 'hid_page')::boolean THEN true ELSE is_public END
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

-- --- Who sees the page: only once it's theirs ---

-- 20261024200000's guard, plus: the venue must have a bar page (a claim on it was approved).
CREATE OR REPLACE FUNCTION private.guard_bar_page_visibility()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_next timestamptz;
BEGIN
    IF auth.uid() IS NULL OR private.is_app_admin() THEN
        RETURN NEW;
    END IF;
    -- Only this trigger stamps the date.
    NEW.page_visibility_changed_at := OLD.page_visibility_changed_at;
    IF NEW.page_visibility IS NOT DISTINCT FROM OLD.page_visibility THEN
        RETURN NEW;
    END IF;
    IF NEW.id NOT IN (SELECT private.bars_with_capability('publish')) THEN
        RAISE EXCEPTION 'Changing who sees the bar''s page needs the publish permission.' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.bar_id = NEW.id AND p.kind = 'bar') THEN
        RAISE EXCEPTION 'Who sees the page opens once your claim on it is approved.' USING ERRCODE = '42501';
    END IF;
    IF NEW.page_visibility = 'private' AND NOT public.bar_claim_verified(NEW.id) THEN
        RAISE EXCEPTION 'Private opens once your claim on this page is verified.' USING ERRCODE = '42501';
    END IF;
    v_next := OLD.page_visibility_changed_at + interval '30 days';
    IF v_next > now() THEN
        RAISE EXCEPTION 'You can change who sees your page once every 30 days. Next change from %.', to_char(v_next, 'FMDD Mon YYYY')
            USING ERRCODE = '23514';
    END IF;
    NEW.page_visibility_changed_at := now();
    RETURN NEW;
END;
$function$;
