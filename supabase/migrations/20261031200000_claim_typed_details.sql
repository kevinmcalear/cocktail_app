-- A claim can bring the bar's Instagram, website or phone when its page has
-- none (decided 22 Oct, canvas make-venue-claim states 2 to 4).
--
-- A bar added a minute ago has only a name and an address, so the claim step
-- greyed out Instagram and Work email and offered a call with no number to
-- ring. Now the claimant types the missing one in. What they type proves
-- nothing on its own, so:
--   1. A claim that leans on anything typed always waits for a person. Only a
--      website already on the page can approve a work email on the spot.
--   2. The claim records what was typed (evidence.typed), so the moderator
--      sees it apart from what the page says.
--   3. A call needs a number: the page's, or one typed in.
--   4. Once approved, the typed details go onto the page where it has none.
--      The website and phone ride on the claim's setup (so venue setup's
--      Where and when shows them and hand_over_claim applies them); the
--      Instagram goes on in a trigger here.

-- --- Starting a claim ---

DROP FUNCTION "public"."start_bar_claim"("uuid", "public"."claim_method", "uuid", "text", "text");

-- 20261017720100's start_bar_claim, plus p_instagram, p_website and p_phone.
CREATE FUNCTION "public"."start_bar_claim"("p_profile_id" "uuid", "p_method" "public"."claim_method", "p_bar_id" "uuid" DEFAULT NULL, "p_note" "text" DEFAULT NULL, "p_code" "text" DEFAULT NULL, "p_instagram" "text" DEFAULT NULL, "p_website" "text" DEFAULT NULL, "p_phone" "text" DEFAULT NULL) RETURNS "public"."profile_claims"
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

    SELECT * INTO v_profile FROM public.profiles WHERE id = p_profile_id AND kind IN ('bar', 'maker', 'supplier');
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
        IF v_instagram !~ '^[a-z0-9._]{1,30}$' THEN
            RAISE EXCEPTION 'That doesn''t look like an Instagram handle.' USING ERRCODE = '22023';
        END IF;
        v_typed := v_typed || jsonb_build_object('instagram', v_instagram);
    ELSIF p_method = 'email' AND v_website IS NULL AND nullif(btrim(p_website), '') IS NOT NULL THEN
        -- Same shape as save_claim_setup's website (20261014900000).
        v_website := btrim(p_website);
        IF char_length(v_website) > 300 OR v_website !~ '^(https?://)?[^\s/]+\.[^\s]+$' THEN
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
        IF v_typed ? 'website' THEN
            v_evidence := v_evidence || jsonb_build_object('auto', false, 'review_reason', 'site_typed');
        END IF;
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

    -- Setup's Where and when shows a typed website or phone, and approval puts it on the page.
    v_setup := nullif(jsonb_strip_nulls(jsonb_build_object('website', v_typed ->> 'website', 'phone', v_typed ->> 'phone')), '{}'::jsonb);

    INSERT INTO public.profile_claims (profile_id, user_id, bar_id, message, method, code, evidence, setup)
    VALUES (p_profile_id, v_user, p_bar_id, nullif(btrim(left(p_note, 1000)), ''), p_method,
            CASE WHEN p_method IN ('instagram', 'phone') THEN coalesce(p_code, private.claim_code()) END, v_evidence, v_setup)
    RETURNING * INTO v_claim;

    IF (v_evidence ->> 'auto')::boolean THEN
        PERFORM private.hand_over_claim(v_claim.id, NULL);
        SELECT * INTO v_claim FROM public.profile_claims WHERE id = v_claim.id;
    END IF;
    RETURN v_claim;
END;
$$;
REVOKE EXECUTE ON FUNCTION "public"."start_bar_claim"("uuid", "public"."claim_method", "uuid", "text", "text", "text", "text", "text") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."start_bar_claim"("uuid", "public"."claim_method", "uuid", "text", "text", "text", "text", "text") TO "authenticated", "service_role";

-- --- Approving ---

-- A typed Instagram goes onto the page once a person approved the claim, if
-- the page still has none. (A typed website or phone is in the claim's setup,
-- which hand_over_claim applies.)
CREATE FUNCTION "private"."fill_page_from_typed_claim"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    UPDATE public.profiles
    SET instagram = NEW.evidence #>> '{typed,instagram}'
    WHERE id = NEW.profile_id AND nullif(btrim(instagram), '') IS NULL;
    RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION "private"."fill_page_from_typed_claim"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "fill_page_from_typed_claim" AFTER UPDATE OF "status" ON "public"."profile_claims"
    FOR EACH ROW
    WHEN (NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' AND NEW.evidence #>> '{typed,instagram}' IS NOT NULL)
    EXECUTE FUNCTION "private"."fill_page_from_typed_claim"();
