-- Find yourself, step 4 (board find-yourself.dc.html, approved 20 Oct 2026).
-- Local stack only until Kevin's OK.
--
-- A bartender with an account finds the seeded page we made for them (their
-- credited drinks, where they worked) and taps "This is me". Until now that
-- only worked inside onboarding: the insert policy wanted a claimant with no
-- profile, and approval refused to merge. Now:
--
--   1. Person claims go through start_person_claim(), like bar claims go
--      through start_bar_claim(). Nobody inserts into profile_claims directly
--      any more. The three-a-day limit (limit_profile_claims) still applies.
--   2. A person claim can be checked by an Instagram message code when the
--      page has an Instagram handle, the same way as a bar's: the app shows
--      six digits, the claimant messages them from that account, and a
--      moderator looks. 'note' stays for "Something else".
--   3. Approving a claim from someone who already has a profile merges the
--      seeded page into theirs (private.merge_person_profile), then deletes
--      the seeded row. Someone without a profile is handed the page, as before.
--
-- What the merge does with everything that points at a profile, column by
-- column (every foreign key to profiles on 30 Oct 2026). "Dropped" rows are
-- exact duplicates of a row the claimant already has; they're kept in
-- private.profile_merges.dropped, with the seeded row itself in .snapshot.
--
--   Moved to the claimant's profile:
--     items.creator_profile_id            their drinks ("Made by")
--     item_co_creators.profile_id         drinks they made with others; a
--                                         duplicate, or a co-credit on a drink
--                                         they're now the creator of, is dropped
--     profile_positions.person_profile_id jobs; the same job at the same bar
--                                         keeps the claimant's row, taking the
--                                         page's dates when it has none, its
--                                         link, and the bar's yes from either
--     profile_worked_menus.person_profile_id  menu credits; on a duplicate the
--                                         drinks linked to it move to the
--                                         claimant's row first
--     profile_awards.profile_id           awards; a duplicate is dropped
--     event_staff.profile_id              behind the bar at events
--     profile_picks.profile_id            what the page shows; duplicates dropped
--     loved_bars, hidden_bars .profile_id people who loved or hid the page
--     reports.profile_id                  reports about the page; an open one
--                                         the same person also made about the
--                                         claimant's profile is dropped
--     private.profile_hidden_places       kept only when the claimant has none
--     profile_claims.profile_id           every claim on the page, so the
--                                         claimant still sees theirs approved
--   Point only at bars, makers or suppliers (their own triggers refuse a
--   person), so a person page has none: items.maker_profile_id,
--   items.origin_bar_profile_id, profile_positions.bar_profile_id,
--   profile_worked_menus.bar_profile_id, profile_awards.bar_profile_id,
--   profile_menu_editions, events.guest_profile_id, rank_entries,
--   discover_drink_facts, bar_glassware, item_maker_credits,
--   menu_run_parties, suppliers, supplier_lines, profiles.part_of_profile_id.
--   Left alone; the check below refuses the merge if one ever does.
--   The page's own fields: the claimant's win. Their blank bio, tagline,
--   Instagram, website and links are filled from the page. The photo stays
--   their account photo (set_profile_photo). Handle and name stay theirs.
--   Not foreign keys, left as they are: item_versions.snapshot (history),
--   drafts.draft_data (unsent edits).
--
-- Before deleting the seeded row, the merge checks every foreign key to
-- profiles, including any added after this migration, and stops (nothing
-- changes) if a row still points at it. Running it again for a page already
-- merged returns the claimant's profile and changes nothing.

-- --- What a merge kept ---

CREATE TABLE "private"."profile_merges" (
    "from_profile_id" "uuid" PRIMARY KEY,
    "into_profile_id" "uuid" NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    "claim_id" "uuid" REFERENCES "public"."profile_claims"("id") ON DELETE SET NULL,
    "merged_by" "uuid",
    "merged_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    -- The seeded profile row as it was, and the duplicates dropped, by table.
    "snapshot" "jsonb" NOT NULL,
    "dropped" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);
CREATE INDEX "profile_merges_into_idx" ON "private"."profile_merges" ("into_profile_id");
REVOKE ALL ON "private"."profile_merges" FROM PUBLIC, "anon", "authenticated";

COMMENT ON TABLE "private"."profile_merges" IS
    'Seeded person pages merged into a claimant''s profile (20261030100000): the old row, and any duplicate rows dropped. Old handles can redirect from here.';

-- --- Merging a seeded person into a claimant's profile ---

CREATE FUNCTION "private"."merge_person_profile"("p_from" "uuid", "p_into" "uuid", "p_claim_id" "uuid", "p_reviewer" "uuid") RETURNS "public"."profiles"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_from public.profiles;
    v_into public.profiles;
    v_dropped jsonb := '{}'::jsonb;
    v_rows jsonb;
    v_ref record;
    v_left boolean;
    v_headline uuid;
BEGIN
    -- Already merged: nothing to do.
    IF EXISTS (SELECT 1 FROM private.profile_merges WHERE from_profile_id = p_from AND into_profile_id = p_into)
       AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_from) THEN
        SELECT * INTO v_into FROM public.profiles WHERE id = p_into;
        RETURN v_into;
    END IF;

    -- Lock both, in a fixed order so two merges can't deadlock.
    PERFORM 1 FROM public.profiles WHERE id IN (p_from, p_into) ORDER BY id FOR UPDATE;
    SELECT * INTO v_from FROM public.profiles WHERE id = p_from;
    SELECT * INTO v_into FROM public.profiles WHERE id = p_into;
    IF v_from.id IS NULL OR v_into.id IS NULL OR p_from = p_into THEN
        RAISE EXCEPTION 'Merging profiles needs two different profiles.';
    END IF;
    IF v_from.kind <> 'person' OR v_from.user_id IS NOT NULL OR v_from.bar_id IS NOT NULL THEN
        RAISE EXCEPTION 'Only an unclaimed person''s page can be merged into a profile.';
    END IF;
    IF v_into.kind <> 'person' OR v_into.user_id IS NULL THEN
        RAISE EXCEPTION 'A page can only be merged into someone''s own profile.';
    END IF;

    -- Drinks.
    UPDATE public.items SET creator_profile_id = p_into WHERE creator_profile_id = p_from;

    WITH gone AS (
        DELETE FROM public.item_co_creators f
        WHERE f.profile_id = p_from
          AND (EXISTS (SELECT 1 FROM public.item_co_creators t WHERE t.item_id = f.item_id AND t.profile_id = p_into)
               OR EXISTS (SELECT 1 FROM public.items i WHERE i.id = f.item_id AND i.creator_profile_id = p_into))
        RETURNING f.*
    ) SELECT jsonb_agg(to_jsonb(gone)) INTO v_rows FROM gone;
    v_dropped := v_dropped || CASE WHEN v_rows IS NULL THEN '{}' ELSE jsonb_build_object('item_co_creators', v_rows) END;
    UPDATE public.item_co_creators SET profile_id = p_into WHERE profile_id = p_from;

    -- Jobs. The same job twice keeps the claimant's row: it takes the page's
    -- dates when it has none (an end only if it isn't current), its link, and
    -- the bar's yes from either. Dates that don't fit stay off; the page's row
    -- is kept in dropped.
    BEGIN
        UPDATE public.profile_positions t SET
            start_year = CASE WHEN t.start_year IS NULL AND t.end_year IS NULL THEN f.start_year ELSE t.start_year END,
            start_month = CASE WHEN t.start_year IS NULL AND t.end_year IS NULL THEN f.start_month ELSE t.start_month END,
            end_year = CASE WHEN t.start_year IS NULL AND t.end_year IS NULL AND NOT t.is_current THEN f.end_year ELSE t.end_year END,
            end_month = CASE WHEN t.start_year IS NULL AND t.end_year IS NULL AND NOT t.is_current THEN f.end_month ELSE t.end_month END,
            source_url = coalesce(t.source_url, f.source_url),
            bar_accepted = t.bar_accepted OR f.bar_accepted
        FROM public.profile_positions f
        WHERE f.person_profile_id = p_from AND t.person_profile_id = p_into
          AND t.bar_profile_id = f.bar_profile_id AND t.title = f.title;
    EXCEPTION WHEN check_violation THEN
        UPDATE public.profile_positions t SET
            source_url = coalesce(t.source_url, f.source_url),
            bar_accepted = t.bar_accepted OR f.bar_accepted
        FROM public.profile_positions f
        WHERE f.person_profile_id = p_from AND t.person_profile_id = p_into
          AND t.bar_profile_id = f.bar_profile_id AND t.title = f.title;
    END;
    -- The page's headline job, as the claimant's row when they have the same one.
    IF v_into.headline_position_id IS NULL AND v_from.headline_position_id IS NOT NULL THEN
        v_headline := coalesce(
            (SELECT t.id FROM public.profile_positions t
             JOIN public.profile_positions f ON f.id = v_from.headline_position_id
                 AND t.bar_profile_id = f.bar_profile_id AND t.title = f.title
             WHERE t.person_profile_id = p_into),
            v_from.headline_position_id);
    END IF;
    WITH gone AS (
        DELETE FROM public.profile_positions f
        USING public.profile_positions t
        WHERE f.person_profile_id = p_from AND t.person_profile_id = p_into
          AND t.bar_profile_id = f.bar_profile_id AND t.title = f.title
        RETURNING f.*
    ) SELECT jsonb_agg(to_jsonb(gone)) INTO v_rows FROM gone;
    v_dropped := v_dropped || CASE WHEN v_rows IS NULL THEN '{}' ELSE jsonb_build_object('profile_positions', v_rows) END;
    UPDATE public.profile_positions SET person_profile_id = p_into WHERE person_profile_id = p_from;

    -- Menu credits. A duplicate hands its drinks to the claimant's row first.
    INSERT INTO public.profile_worked_menu_drinks (worked_menu_id, item_id, created_at)
    SELECT t.id, d.item_id, d.created_at
    FROM public.profile_worked_menus f
    JOIN public.profile_worked_menus t ON t.person_profile_id = p_into AND t.bar_profile_id IS NOT DISTINCT FROM f.bar_profile_id
        AND t.name IS NOT DISTINCT FROM f.name AND t.year IS NOT DISTINCT FROM f.year
    JOIN public.profile_worked_menu_drinks d ON d.worked_menu_id = f.id
    WHERE f.person_profile_id = p_from
    ON CONFLICT DO NOTHING;
    WITH gone AS (
        DELETE FROM public.profile_worked_menus f
        USING public.profile_worked_menus t
        WHERE f.person_profile_id = p_from AND t.person_profile_id = p_into AND t.bar_profile_id IS NOT DISTINCT FROM f.bar_profile_id
          AND t.name IS NOT DISTINCT FROM f.name AND t.year IS NOT DISTINCT FROM f.year
        RETURNING f.*
    ) SELECT jsonb_agg(to_jsonb(gone)) INTO v_rows FROM gone;
    v_dropped := v_dropped || CASE WHEN v_rows IS NULL THEN '{}' ELSE jsonb_build_object('profile_worked_menus', v_rows) END;
    UPDATE public.profile_worked_menus SET person_profile_id = p_into WHERE person_profile_id = p_from;

    -- Awards.
    WITH gone AS (
        DELETE FROM public.profile_awards f
        USING public.profile_awards t
        WHERE f.profile_id = p_from AND t.profile_id = p_into
          AND t.award = f.award AND t.year = f.year AND coalesce(t.title, '') = coalesce(f.title, '')
        RETURNING f.*
    ) SELECT jsonb_agg(to_jsonb(gone)) INTO v_rows FROM gone;
    v_dropped := v_dropped || CASE WHEN v_rows IS NULL THEN '{}' ELSE jsonb_build_object('profile_awards', v_rows) END;
    UPDATE public.profile_awards SET profile_id = p_into WHERE profile_id = p_from;

    -- Events they worked.
    UPDATE public.event_staff SET profile_id = p_into WHERE profile_id = p_from;

    -- What the page picked to show.
    WITH gone AS (
        DELETE FROM public.profile_picks f
        USING public.profile_picks t
        WHERE f.profile_id = p_from AND t.profile_id = p_into AND t.section = f.section AND t.target_id = f.target_id
        RETURNING f.*
    ) SELECT jsonb_agg(to_jsonb(gone)) INTO v_rows FROM gone;
    v_dropped := v_dropped || CASE WHEN v_rows IS NULL THEN '{}' ELSE jsonb_build_object('profile_picks', v_rows) END;
    UPDATE public.profile_picks SET profile_id = p_into WHERE profile_id = p_from;

    -- People who loved or hid the page.
    WITH gone AS (
        DELETE FROM public.loved_bars f USING public.loved_bars t
        WHERE f.profile_id = p_from AND t.profile_id = p_into AND t.user_id = f.user_id
        RETURNING f.*
    ) SELECT jsonb_agg(to_jsonb(gone)) INTO v_rows FROM gone;
    v_dropped := v_dropped || CASE WHEN v_rows IS NULL THEN '{}' ELSE jsonb_build_object('loved_bars', v_rows) END;
    UPDATE public.loved_bars SET profile_id = p_into WHERE profile_id = p_from;
    WITH gone AS (
        DELETE FROM public.hidden_bars f USING public.hidden_bars t
        WHERE f.profile_id = p_from AND t.profile_id = p_into AND t.user_id = f.user_id
        RETURNING f.*
    ) SELECT jsonb_agg(to_jsonb(gone)) INTO v_rows FROM gone;
    v_dropped := v_dropped || CASE WHEN v_rows IS NULL THEN '{}' ELSE jsonb_build_object('hidden_bars', v_rows) END;
    UPDATE public.hidden_bars SET profile_id = p_into WHERE profile_id = p_from;

    -- Reports about the page.
    WITH gone AS (
        DELETE FROM public.reports f USING public.reports t
        WHERE f.profile_id = p_from AND t.profile_id = p_into AND f.status = 'open' AND t.status = 'open'
          AND t.reporter_id = f.reporter_id AND t.target_kind = f.target_kind
          AND t.item_id IS NOT DISTINCT FROM f.item_id AND t.release_id IS NOT DISTINCT FROM f.release_id
          AND t.comment_id IS NOT DISTINCT FROM f.comment_id AND t.photo_id IS NOT DISTINCT FROM f.photo_id
        RETURNING f.*
    ) SELECT jsonb_agg(to_jsonb(gone)) INTO v_rows FROM gone;
    v_dropped := v_dropped || CASE WHEN v_rows IS NULL THEN '{}' ELSE jsonb_build_object('reports', v_rows) END;
    UPDATE public.reports SET profile_id = p_into WHERE profile_id = p_from;

    -- A hidden city waiting on the page: the claimant's own wins.
    INSERT INTO private.profile_hidden_places (profile_id, locality, city)
    SELECT p_into, h.locality, h.city FROM private.profile_hidden_places h WHERE h.profile_id = p_from
    ON CONFLICT (profile_id) DO NOTHING;
    WITH gone AS (
        DELETE FROM private.profile_hidden_places f WHERE f.profile_id = p_from RETURNING f.*
    ) SELECT jsonb_agg(to_jsonb(gone)) INTO v_rows FROM gone;
    v_dropped := v_dropped || CASE WHEN v_rows IS NULL THEN '{}' ELSE jsonb_build_object('profile_hidden_places', v_rows) END;

    -- Claims on the page, so the claimant still sees theirs.
    UPDATE public.profile_claims
    SET profile_id = p_into,
        evidence = coalesce(evidence, '{}'::jsonb) || jsonb_build_object('merged_from', jsonb_build_object('id', p_from, 'handle', v_from.handle))
    WHERE profile_id = p_from;

    -- The page's words fill the claimant's blanks.
    UPDATE public.profiles SET
        bio = coalesce(nullif(btrim(bio), ''), v_from.bio),
        tagline = coalesce(nullif(btrim(tagline), ''), v_from.tagline),
        instagram = coalesce(nullif(btrim(instagram), ''), v_from.instagram),
        website = coalesce(nullif(btrim(website), ''), v_from.website),
        social_links = CASE WHEN coalesce(cardinality(social_links), 0) = 0 THEN v_from.social_links ELSE social_links END,
        headline_position_id = coalesce(headline_position_id, v_headline)
    WHERE id = p_into;

    -- Anything still pointing at the page stops the merge: nothing is lost.
    FOR v_ref IN
        SELECT c.conrelid::regclass AS tbl, a.attname AS col
        FROM pg_catalog.pg_constraint c
        JOIN pg_catalog.pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
        WHERE c.contype = 'f' AND c.confrelid = 'public.profiles'::regclass AND cardinality(c.conkey) = 1
    LOOP
        EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s WHERE %I = $1)', v_ref.tbl, v_ref.col) INTO v_left USING p_from;
        IF v_left THEN
            RAISE EXCEPTION 'Can''t merge: %.% still points at the page. Nothing was changed.', v_ref.tbl, v_ref.col;
        END IF;
    END LOOP;

    INSERT INTO private.profile_merges (from_profile_id, into_profile_id, claim_id, merged_by, snapshot, dropped)
    VALUES (p_from, p_into, p_claim_id, p_reviewer, to_jsonb(v_from), v_dropped);
    DELETE FROM public.profiles WHERE id = p_from;

    SELECT * INTO v_into FROM public.profiles WHERE id = p_into;
    RETURN v_into;
END;
$$;

-- --- Handing a page over ---

-- Same as 20261024200000, except a person who already has a profile gets the
-- page merged into theirs instead of being refused.
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

-- --- Starting a person claim ---

-- Records a claim on an unclaimed person's page, from someone with or without
-- a profile of their own. 'instagram' (a six-digit code messaged from the
-- page's Instagram, when it has one) or 'note' ("Something else"). One person
-- claim waits at a time. Returns the claim, with its code for 'instagram'.
CREATE FUNCTION "public"."start_person_claim"("p_profile_id" "uuid", "p_method" "public"."claim_method" DEFAULT 'note', "p_note" "text" DEFAULT NULL, "p_code" "text" DEFAULT NULL) RETURNS "public"."profile_claims"
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
    END IF;

    INSERT INTO public.profile_claims (profile_id, user_id, message, method, code, evidence)
    VALUES (p_profile_id, v_user, nullif(btrim(left(p_note, 1000)), ''), p_method,
            CASE WHEN p_method = 'instagram' THEN coalesce(p_code, private.claim_code()) END, v_evidence)
    RETURNING * INTO v_claim;
    RETURN v_claim;
END;
$$;

-- Claims only start through start_person_claim() and start_bar_claim().
DROP POLICY "profile_claims_insert" ON "public"."profile_claims";
REVOKE INSERT ON TABLE "public"."profile_claims" FROM "anon", "authenticated";

REVOKE EXECUTE ON FUNCTION "private"."merge_person_profile"("uuid", "uuid", "uuid", "uuid") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."hand_over_claim"("uuid", "uuid") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."start_person_claim"("uuid", "public"."claim_method", "text", "text") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."start_person_claim"("uuid", "public"."claim_method", "text", "text") TO "authenticated", "service_role";
