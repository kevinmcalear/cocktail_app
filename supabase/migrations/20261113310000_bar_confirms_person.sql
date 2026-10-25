-- The bar confirms you (find-yourself step 4): someone claiming a person's
-- page can ask a bar the page lists them at, once that bar is claimed, and the
-- bar's Admin confirms them with one tap instead of a moderator checking.
--
--   profile_positions.added_in_app
--                        true for a job someone signed in added (a trigger
--                        sets it; nobody can). Every job already here, and
--                        every one a seed or migration writes, is history we
--                        found, so false.
--   start_person_claim   gains p_confirm_bar, a bar page. Only a claimed bar
--                        with a venue, at a job on this page that wasn't
--                        added in the app. Recorded in the claim's evidence
--                        as confirm_bar; the method stays a note.
--   person_claims_to_confirm(p_bar_id)
--                        claims waiting on the caller's venue: Admins only.
--   confirm_person_claim(p_claim_id)
--                        an Admin of that venue approves it, as a moderator
--                        would (hand_over_claim, so a claimant with a profile
--                        gets the page merged into theirs).
--
-- The job has to be history we found, not one added in the app, so an Admin
-- can't list someone at their bar and then confirm a friend's claim on that
-- page. And a bar can't settle a page someone else is also claiming: with
-- another claim waiting, a moderator decides. Moderators can still approve or
-- turn down any claim, this one included.

ALTER TABLE "public"."profile_positions" ADD COLUMN "added_in_app" boolean DEFAULT false NOT NULL;

CREATE FUNCTION "private"."mark_position_added_in_app"() RETURNS trigger
    LANGUAGE plpgsql
    SET "search_path" TO ''
    AS $$
BEGIN
    NEW.added_in_app := CASE WHEN TG_OP = 'INSERT' THEN auth.uid() IS NOT NULL ELSE OLD.added_in_app END;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "mark_position_added_in_app" BEFORE INSERT OR UPDATE ON "public"."profile_positions"
    FOR EACH ROW EXECUTE FUNCTION "private"."mark_position_added_in_app"();

DROP FUNCTION "public"."start_person_claim"("uuid", "public"."claim_method", "text", "text");

CREATE FUNCTION "public"."start_person_claim"("p_profile_id" "uuid", "p_method" "public"."claim_method" DEFAULT 'note', "p_note" "text" DEFAULT NULL, "p_code" "text" DEFAULT NULL, "p_confirm_bar" "uuid" DEFAULT NULL) RETURNS "public"."profile_claims"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_user uuid := auth.uid();
    v_profile public.profiles;
    v_claim public.profile_claims;
    v_instagram text;
    v_evidence jsonb;
BEGIN
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'Sign in to claim your page.' USING ERRCODE = '42501';
    END IF;
    IF p_method IS NULL OR p_method NOT IN ('instagram', 'note') THEN
        RAISE EXCEPTION 'Pick how we can check it''s you.' USING ERRCODE = '22023';
    END IF;
    IF p_code IS NOT NULL AND p_code !~ '^[0-9]{6}$' THEN
        RAISE EXCEPTION 'The code should be six digits.' USING ERRCODE = '22023';
    END IF;

    -- Only a page people can see: a hidden or taken-down one isn't claimable.
    SELECT * INTO v_profile FROM public.profiles
    WHERE id = p_profile_id AND kind = 'person' AND is_public AND moderated_at IS NULL;
    IF v_profile.id IS NULL THEN
        RAISE EXCEPTION 'There''s no person''s page with that id.' USING ERRCODE = 'P0001';
    END IF;
    IF v_profile.user_id IS NOT NULL OR v_profile.bar_id IS NOT NULL THEN
        RAISE EXCEPTION 'This page has already been claimed.' USING ERRCODE = 'P0001';
    END IF;
    -- One claimant at a time, so two taps can't both pass the checks below.
    PERFORM pg_advisory_xact_lock(hashtextextended('start_person_claim:' || v_user::text, 0));
    IF EXISTS (SELECT 1 FROM public.profile_claims WHERE profile_id = p_profile_id AND user_id = v_user AND status = 'pending') THEN
        RAISE EXCEPTION 'You already have a claim waiting on this page.' USING ERRCODE = '23505';
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.profile_claims c JOIN public.profiles p ON p.id = c.profile_id
        WHERE c.user_id = v_user AND c.status = 'pending' AND p.kind = 'person'
    ) THEN
        RAISE EXCEPTION 'You already have a claim waiting on another page. Wait for it, or withdraw it first.' USING ERRCODE = 'P0001';
    END IF;

    v_instagram := private.page_instagram(v_profile.instagram, v_profile.website, v_profile.social_links);
    v_evidence := jsonb_build_object('instagram', v_instagram);
    IF p_method = 'instagram' THEN
        IF v_instagram IS NULL THEN
            RAISE EXCEPTION 'This page has no Instagram to check. Pick another way.' USING ERRCODE = 'P0001';
        END IF;
        -- The code comes in a message from that account, as for a bar.
        v_evidence := v_evidence || jsonb_build_object('instagram_dm', true);
    ELSIF p_confirm_bar IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profile_positions pp JOIN public.profiles b ON b.id = pp.bar_profile_id
            WHERE pp.person_profile_id = p_profile_id AND pp.bar_profile_id = p_confirm_bar
              AND b.kind = 'bar' AND b.bar_id IS NOT NULL AND b.moderated_at IS NULL
              AND NOT pp.added_in_app
        ) THEN
            RAISE EXCEPTION 'That bar can''t confirm you yet. Pick another way.' USING ERRCODE = 'P0001';
        END IF;
        v_evidence := v_evidence || jsonb_build_object('confirm_bar', p_confirm_bar);
    END IF;

    INSERT INTO public.profile_claims (profile_id, user_id, message, method, code, evidence)
    VALUES (p_profile_id, v_user, nullif(btrim(left(p_note, 1000)), ''), p_method,
            CASE WHEN p_method = 'instagram' THEN coalesce(p_code, private.claim_code()) END, v_evidence)
    RETURNING * INTO v_claim;
    RETURN v_claim;
END;
$$;

-- Whether the caller, as a current Admin, can confirm this pending claim: it
-- asked their venue's bar, the page lists that bar from history we found, and
-- nobody else's claim on the page is waiting.
CREATE FUNCTION "private"."bar_can_confirm"("p_claim" "public"."profile_claims") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT p_claim.status = 'pending' AND p_claim.user_id <> auth.uid() AND EXISTS (
    SELECT 1 FROM public.profiles b
    JOIN public.profile_positions pp ON pp.bar_profile_id = b.id AND pp.person_profile_id = p_claim.profile_id
    WHERE b.id = (p_claim.evidence ->> 'confirm_bar')::uuid
      AND b.kind = 'bar' AND b.moderated_at IS NULL
      AND b.bar_id IN (SELECT private.my_bar_ids(40))
      AND NOT pp.added_in_app
  ) AND NOT EXISTS (
    SELECT 1 FROM public.profile_claims o
    WHERE o.profile_id = p_claim.profile_id AND o.status = 'pending' AND o.id <> p_claim.id
  );
$$;

-- Person claims waiting on the venue's Admins, with the page and who is claiming it.
CREATE FUNCTION "public"."person_claims_to_confirm"("p_bar_id" "uuid") RETURNS TABLE (
    "id" "uuid",
    "created_at" timestamp with time zone,
    "page_id" "uuid",
    "page_handle" "text",
    "page_name" "text",
    "claimant_name" "text",
    "claimant_handle" "text"
)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT c.id, c.created_at, p.id, p.handle, p.display_name,
         COALESCE(NULLIF(btrim(own.display_name), ''), private.member_display_name(c.user_id)), own.handle
  FROM public.profile_claims c
  JOIN public.profiles p ON p.id = c.profile_id AND p.kind = 'person'
  JOIN public.profiles b ON b.id = (c.evidence ->> 'confirm_bar')::uuid AND b.bar_id = p_bar_id
  LEFT JOIN LATERAL (
    SELECT o.display_name, o.handle FROM public.profiles o WHERE o.user_id = c.user_id AND o.kind = 'person' LIMIT 1
  ) own ON true
  WHERE c.status = 'pending' AND c.evidence ? 'confirm_bar' AND private.bar_can_confirm(c)
  ORDER BY c.created_at;
$$;

-- One tap: the page is theirs.
CREATE FUNCTION "public"."confirm_person_claim"("p_claim_id" "uuid") RETURNS "public"."profiles"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_claim public.profile_claims;
BEGIN
    SELECT * INTO v_claim FROM public.profile_claims WHERE id = p_claim_id FOR UPDATE;
    IF v_claim.id IS NULL OR NOT private.bar_can_confirm(v_claim) THEN
        RAISE EXCEPTION 'That claim isn''t waiting on you.';
    END IF;
    UPDATE public.profile_claims SET evidence = evidence || jsonb_build_object('confirmed_by_bar', auth.uid()) WHERE id = p_claim_id;
    RETURN private.hand_over_claim(p_claim_id, auth.uid());
END;
$$;

REVOKE EXECUTE ON FUNCTION "public"."start_person_claim"("uuid", "public"."claim_method", "text", "text", "uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."start_person_claim"("uuid", "public"."claim_method", "text", "text", "uuid") TO "authenticated", "service_role";
REVOKE ALL ON FUNCTION "private"."mark_position_added_in_app"() FROM PUBLIC, "anon", "authenticated";
REVOKE ALL ON FUNCTION "private"."bar_can_confirm"("public"."profile_claims") FROM PUBLIC, "anon", "authenticated";
REVOKE ALL ON FUNCTION "public"."person_claims_to_confirm"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."person_claims_to_confirm"("uuid") TO "authenticated", "service_role";
REVOKE ALL ON FUNCTION "public"."confirm_person_claim"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."confirm_person_claim"("uuid") TO "authenticated", "service_role";
