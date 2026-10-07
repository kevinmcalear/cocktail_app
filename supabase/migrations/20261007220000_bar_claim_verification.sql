-- Bar claim verification (Eddie and Kevin's 7 Oct jam). Local stack only
-- until Kevin's OK. Needs 20261007130000_bar_page_visibility.
--
-- Until now a bar claimed its page by sending a note ("here's our
-- Instagram") from a venue it already ran, and a moderator approved it by
-- eye. A claimed page gets an owning venue and Admin rights over its drinks,
-- which are the bar's IP, so the claim now has to prove something. Every
-- check is against contact details that were on the page before the claim
-- (unclaimed pages are edited by moderators only), never against details the
-- claimant types in:
--
--   email      the claimant's sign-in email is at the bar's own website
--              domain. Supabase confirmed that address when they signed in,
--              so nothing is sent. Approved on the spot when the website is
--              the bar's own (its home page, not a page on a bigger site like
--              a hotel group's, not a shared host or a social network) and
--              the bar isn't closed; otherwise it waits for a moderator with
--              the reason attached.
--   instagram  a six-digit code the claimant puts in the bar's Instagram bio.
--              A moderator opens the handle already on the page and looks.
--   phone      a six-digit code a moderator asks for when they ring the bar
--              on a number they look up themselves. They type what they hear
--              and approval only goes through if it matches.
--
-- Not built: a photo behind the bar (a guest can take one, and it means
-- storing pictures of people) and vouching by verified staff (an unclaimed
-- bar has nobody verified to vouch). Once a bar is claimed, staff join by
-- invite as before.
--
-- Claims also get:
--   * one entry point for bar claims, start_bar_claim(): a bar claim no
--     longer needs the claimant to run a venue already. Direct inserts are
--     for person claims only;
--   * a daily limit of three claims per person (any kind), on top of the
--     existing one pending claim per profile per person;
--   * a reason when a moderator turns one down, which the claimant sees.
--
-- On approval a bar claim makes a new venue named after the page, with the
-- claimant as its Admin, or links the venue the claimant chose (they must be
-- its Admin). Either way the page starts Locked: nothing opens up until the
-- bar chooses in Publishing.
--
-- Evidence (method, code, email domain, the website and handle at the time)
-- lives on the claim row, which only the claimant and moderators can read.
-- Only the email's domain is kept, not the address.

CREATE TYPE "public"."claim_method" AS ENUM ('note', 'email', 'instagram', 'phone');

ALTER TABLE "public"."profile_claims"
    ADD COLUMN "method" "public"."claim_method" DEFAULT 'note' NOT NULL,
    ADD COLUMN "code" "text" CHECK ("code" ~ '^[0-9]{6}$'),
    ADD COLUMN "evidence" "jsonb",
    ADD COLUMN "decline_reason" "text" CHECK (char_length("decline_reason") <= 300);

-- --- Reading a page's contact details ---

-- 'https://www.palemoth.com/en?x=1' -> 'palemoth.com'. NULL for nothing usable.
CREATE FUNCTION "private"."site_host"("p_url" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT nullif(regexp_replace(lower(substring(btrim(p_url) FROM '^(?:[a-zA-Z][a-zA-Z0-9+.-]*://)?([^/:?#@[:space:]]+)')), '^www\.', ''), '');
$$;

-- True when the link is a site's home page ('palemoth.com', '.../'), not a
-- page on it ('fourseasons.com/hongkong/bars').
CREATE FUNCTION "private"."site_is_root"("p_url" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT coalesce(substring(btrim(p_url) FROM '^(?:[a-zA-Z][a-zA-Z0-9+.-]*://)?[^/?#]+(/[^?#]*)?'), '/') ~ '^/?$';
$$;

-- Hosts where anyone can have a page, so an address there proves nothing
-- about a bar. Same list as SHARED_HOSTS in lib/claimVerification.ts.
CREATE FUNCTION "private"."is_shared_host"("p_host" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM unnest(ARRAY[
      'instagram.com', 'facebook.com', 'tiktok.com', 'x.com', 'twitter.com', 'threads.net', 'youtube.com',
      'linktr.ee', 'linkin.bio', 'lnk.bio', 'bento.me', 'beacons.ai', 'taplink.cc', 'carrd.co',
      'google.com', 'business.site', 'wixsite.com', 'wix.com', 'squarespace.com', 'square.site', 'godaddysites.com',
      'weebly.com', 'wordpress.com', 'blogspot.com', 'webflow.io', 'notion.site', 'jimdosite.com', 'strikingly.com',
      'resy.com', 'opentable.com', 'sevenrooms.com', 'exploretock.com', 'toasttab.com', 'yelp.com', 'tripadvisor.com',
      'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'yahoo.com', 'icloud.com', 'me.com',
      'aol.com', 'proton.me', 'protonmail.com', 'gmx.com', 'gmx.de', 'web.de', 'qq.com', '163.com', 'naver.com'
    ]) AS s(h)
    WHERE p_host = s.h OR p_host LIKE '%.' || s.h
  );
$$;

-- The bar's Instagram handle: the column, else an instagram.com website or
-- social link.
CREATE FUNCTION "private"."page_instagram"("p_instagram" "text", "p_website" "text", "p_social_links" "text"[]) RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT lower(coalesce(
    nullif(btrim(p_instagram), ''),
    substring(p_website FROM 'instagram\.com/([A-Za-z0-9._]+)'),
    (SELECT substring(u FROM 'instagram\.com/([A-Za-z0-9._]+)') FROM unnest(p_social_links) u WHERE u ~* 'instagram\.com/[A-Za-z0-9._]' LIMIT 1)
  ));
$$;

-- What the claimant's sign-in email says about this bar: its domain (never
-- the address), whether it's the website's, and whether that's enough on
-- its own. Only a confirmed address counts.
CREATE FUNCTION "private"."claim_email_evidence"("p_user_id" "uuid", "p_website" "text", "p_is_closed" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_domain text;
    v_host text := private.site_host(p_website);
    v_matches boolean;
    v_reason text;
BEGIN
    SELECT nullif(split_part(lower(u.email), '@', 2), '') INTO v_domain
    FROM auth.users u WHERE u.id = p_user_id AND u.email_confirmed_at IS NOT NULL;
    v_matches := v_domain IS NOT NULL AND v_domain = v_host;
    v_reason := CASE
        WHEN NOT v_matches THEN NULL
        WHEN private.is_shared_host(v_host) THEN 'shared_site'
        WHEN NOT private.site_is_root(p_website) THEN 'page_on_larger_site'
        WHEN p_is_closed THEN 'closed_bar'
    END;
    RETURN jsonb_build_object('email_domain', v_domain, 'site_host', v_host, 'matches', v_matches,
                              'auto', v_matches AND v_reason IS NULL, 'review_reason', v_reason);
END;
$$;

-- Six digits, easy to read out on the phone or type into a bio.
CREATE FUNCTION "private"."claim_code"() RETURNS "text"
    LANGUAGE "sql" VOLATILE
    SET "search_path" TO ''
    AS $$
  SELECT lpad((('x' || lpad(substr(md5(gen_random_uuid()::text), 1, 8), 16, '0'))::bit(64)::bigint % 1000000)::text, 6, '0');
$$;

-- --- Limits ---

-- Three claims a day per person, any kind, made any way.
CREATE FUNCTION "private"."limit_profile_claims"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF (SELECT count(*) FROM public.profile_claims
        WHERE user_id = NEW.user_id AND created_at > now() - interval '1 day') >= 3 THEN
        RAISE EXCEPTION 'You''ve sent three claims today. Try again tomorrow.' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "limit_profile_claims" BEFORE INSERT ON "public"."profile_claims"
    FOR EACH ROW EXECUTE FUNCTION "private"."limit_profile_claims"();

-- Direct inserts are for person claims: a note, no code or evidence. Bar
-- claims go through start_bar_claim().
DROP POLICY "profile_claims_insert" ON "public"."profile_claims";
CREATE POLICY "profile_claims_insert" ON "public"."profile_claims" FOR INSERT TO "authenticated"
    WITH CHECK (
        "user_id" = (SELECT "auth"."uid"())
        AND "status" = 'pending' AND "reviewed_by" IS NULL AND "reviewed_at" IS NULL
        AND "method" = 'note' AND "code" IS NULL AND "evidence" IS NULL AND "decline_reason" IS NULL
        AND "bar_id" IS NULL
        AND EXISTS (
            SELECT 1 FROM "public"."profiles" "p"
            WHERE "p"."id" = "profile_claims"."profile_id" AND "p"."user_id" IS NULL AND "p"."bar_id" IS NULL
              AND "p"."kind" = 'person'
              AND NOT EXISTS (SELECT 1 FROM "public"."profiles" "own" WHERE "own"."user_id" = (SELECT "auth"."uid"()))
        )
    );

-- --- Handing a page over ---

-- Moderators (approving a claim) may set a page's visibility too. Same as
-- 20261007130000 otherwise.
CREATE OR REPLACE FUNCTION "private"."guard_bar_page_visibility"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.page_visibility IS NOT DISTINCT FROM OLD.page_visibility OR auth.uid() IS NULL OR private.is_app_admin() THEN
        RETURN NEW;
    END IF;
    IF NEW.id NOT IN (SELECT private.bars_with_capability('publish')) THEN
        RAISE EXCEPTION 'Changing who sees the bar''s page needs the publish permission.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

-- Approves a pending claim: a person gets their profile; a bar's page gets a
-- new venue (the claimant its Admin) or the venue they chose, and starts
-- Locked. Other pending claims on the profile are turned down. Callers check
-- who may approve.
CREATE FUNCTION "private"."hand_over_claim"("p_claim_id" "uuid", "p_reviewer" "uuid") RETURNS "public"."profiles"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_claim public.profile_claims;
    v_profile public.profiles;
    v_bar_id uuid;
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
        v_bar_id := v_claim.bar_id;
        IF v_bar_id IS NULL THEN
            INSERT INTO public.bars (name, logo_url, page_visibility)
            VALUES (v_profile.display_name, v_profile.avatar_url, 'locked')
            RETURNING id INTO v_bar_id;
            INSERT INTO public.user_bars (bar_id, user_id, role_level) VALUES (v_bar_id, v_claim.user_id, 40);
        ELSE
            IF EXISTS (SELECT 1 FROM public.profiles WHERE bar_id = v_bar_id) THEN
                RAISE EXCEPTION 'This bar already has a profile. Merge them by hand, or turn the claim down.';
            END IF;
            IF NOT EXISTS (SELECT 1 FROM public.user_bars WHERE bar_id = v_bar_id AND user_id = v_claim.user_id AND role_level >= 40) THEN
                RAISE EXCEPTION 'They''re no longer an Admin of the venue they chose. Turn the claim down so they can claim again.';
            END IF;
            UPDATE public.bars SET page_visibility = 'locked' WHERE id = v_bar_id;
        END IF;
        UPDATE public.profiles SET bar_id = v_bar_id, claimed_at = now()
        WHERE id = v_profile.id RETURNING * INTO v_profile;
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

-- --- Starting a bar claim ---

-- Checks, records and (for a strong email match) approves a claim on an
-- unclaimed bar page. p_bar_id links a venue the claimant is Admin of
-- instead of making a new one. Returns the claim, with its code for
-- 'instagram' and 'phone'.
CREATE FUNCTION "public"."start_bar_claim"("p_profile_id" "uuid", "p_method" "public"."claim_method", "p_bar_id" "uuid" DEFAULT NULL, "p_note" "text" DEFAULT NULL) RETURNS "public"."profile_claims"
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
        RAISE EXCEPTION 'Sign in to claim a bar.' USING ERRCODE = '42501';
    END IF;
    IF p_method IS NULL OR p_method = 'note' THEN
        RAISE EXCEPTION 'Pick how we can check it''s your bar.' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_profile FROM public.profiles WHERE id = p_profile_id AND kind = 'bar';
    IF v_profile.id IS NULL THEN
        RAISE EXCEPTION 'There''s no bar page with that id.' USING ERRCODE = 'P0001';
    END IF;
    IF v_profile.user_id IS NOT NULL OR v_profile.bar_id IS NOT NULL THEN
        RAISE EXCEPTION 'This page has already been claimed.' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.profile_claims WHERE profile_id = p_profile_id AND user_id = v_user AND status = 'pending') THEN
        RAISE EXCEPTION 'You already have a claim waiting on this bar.' USING ERRCODE = '23505';
    END IF;
    IF p_bar_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.user_bars WHERE bar_id = p_bar_id AND user_id = v_user AND role_level >= 40) THEN
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
            RAISE EXCEPTION 'Your sign-in email isn''t at this bar''s website domain. Pick another way.' USING ERRCODE = 'P0001';
        END IF;
    ELSIF p_method = 'instagram' AND v_instagram IS NULL THEN
        RAISE EXCEPTION 'This page has no Instagram to check. Pick another way.' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.profile_claims (profile_id, user_id, bar_id, message, method, code, evidence)
    VALUES (p_profile_id, v_user, p_bar_id, nullif(btrim(left(p_note, 1000)), ''), p_method,
            CASE WHEN p_method IN ('instagram', 'phone') THEN private.claim_code() END, v_evidence)
    RETURNING * INTO v_claim;

    IF (v_evidence ->> 'auto')::boolean THEN
        PERFORM private.hand_over_claim(v_claim.id, NULL);
        SELECT * INTO v_claim FROM public.profile_claims WHERE id = v_claim.id;
    END IF;
    RETURN v_claim;
END;
$$;

-- --- Moderators approving ---

-- Same as 20260927000000, plus: a phone claim needs the code the bar read
-- out, and nobody approves their own claim.
DROP FUNCTION "public"."approve_profile_claim"("p_claim_id" "uuid");
CREATE FUNCTION "public"."approve_profile_claim"("p_claim_id" "uuid", "p_code" "text" DEFAULT NULL) RETURNS "public"."profiles"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_claim public.profile_claims;
BEGIN
    IF NOT private.is_app_admin() THEN
        RAISE EXCEPTION 'Only moderators can approve claims.';
    END IF;
    SELECT * INTO v_claim FROM public.profile_claims WHERE id = p_claim_id AND status = 'pending';
    IF v_claim.id IS NULL THEN
        RAISE EXCEPTION 'No pending claim with that id.';
    END IF;
    IF v_claim.user_id = auth.uid() THEN
        RAISE EXCEPTION 'Someone else has to approve your own claim.';
    END IF;
    IF v_claim.method = 'phone' AND v_claim.code IS DISTINCT FROM regexp_replace(coalesce(p_code, ''), '\D', '', 'g') THEN
        RAISE EXCEPTION 'That code doesn''t match. Ask them to read it out again.';
    END IF;
    RETURN private.hand_over_claim(p_claim_id, auth.uid());
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."site_host"("p_url" "text") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."site_is_root"("p_url" "text") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."is_shared_host"("p_host" "text") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."page_instagram"("p_instagram" "text", "p_website" "text", "p_social_links" "text"[]) FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."claim_email_evidence"("p_user_id" "uuid", "p_website" "text", "p_is_closed" boolean) FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."claim_code"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."limit_profile_claims"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."hand_over_claim"("p_claim_id" "uuid", "p_reviewer" "uuid") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."start_bar_claim"("p_profile_id" "uuid", "p_method" "public"."claim_method", "p_bar_id" "uuid", "p_note" "text") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."start_bar_claim"("p_profile_id" "uuid", "p_method" "public"."claim_method", "p_bar_id" "uuid", "p_note" "text") TO "authenticated", "service_role";
REVOKE EXECUTE ON FUNCTION "public"."approve_profile_claim"("p_claim_id" "uuid", "p_code" "text") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."approve_profile_claim"("p_claim_id" "uuid", "p_code" "text") TO "authenticated", "service_role";
