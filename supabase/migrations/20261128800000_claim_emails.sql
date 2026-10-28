-- Emails about claims on a person's or a bar's page. Until now a claim told
-- nobody: moderators found it on Review claims, and claimants saw the answer
-- only by opening the app.
--
-- A trigger on profile_claims wakes the claim-email edge function through
-- pg_net (as images wakes image-palette):
--   a claim arrives (insert, pending)
--       to every app moderator (private.app_admins), or, for a person who
--       asked a bar to confirm them (evidence.confirm_bar), to that venue's
--       current Admins, when the bar can confirm it (no rival claim waiting,
--       as bar_can_confirm asks). Moderators get it when there is nobody else.
--   a claim is approved (pending to approved)
--       to the claimant: the page is theirs.
--   a claim is turned down (pending to rejected)
--       to the claimant, with the reason. The rival claims hand_over_claim
--       closes when another claim on the page is approved are emailed too.
-- A bar claim approved on the spot (a work email at the bar's own website,
-- evidence.auto) emails nobody: the claimant sees it at once in the app.
--
-- The trigger sends who to email (user ids; the function reads their
-- addresses) and the claim as it is now, because approving a person who has
-- a profile merges the page into theirs and deletes it. It needs two Vault
-- secrets, claim_email_url and claim_email_secret; until they exist it does
-- nothing. It never blocks a claim, an approval or a decline: any failure is
-- a warning and the claim is saved as before.

CREATE FUNCTION "private"."request_claim_email"() RETURNS trigger
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_url text;
    v_secret text;
    v_event text;
    v_page public.profiles;
    v_confirm public.profiles;
    v_to uuid[];
    v_to_bar boolean := false;
    v_claimant text;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.status <> 'pending' OR coalesce((NEW.evidence ->> 'auto')::boolean, false) THEN
            RETURN NULL;
        END IF;
        v_event := 'arrived';
    ELSIF OLD.status = 'pending' AND NEW.status = 'approved' THEN
        IF NEW.reviewed_by IS NULL AND coalesce((NEW.evidence ->> 'auto')::boolean, false) THEN
            RETURN NULL;
        END IF;
        v_event := 'approved';
    ELSIF OLD.status = 'pending' AND NEW.status = 'rejected' THEN
        v_event := 'rejected';
    ELSE
        RETURN NULL;
    END IF;

    SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'claim_email_url';
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'claim_email_secret';
    IF v_url IS NULL OR v_secret IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT * INTO v_page FROM public.profiles WHERE id = NEW.profile_id;
    IF v_page.id IS NULL THEN
        RETURN NULL;
    END IF;
    IF NEW.evidence ? 'confirm_bar' THEN
        SELECT * INTO v_confirm FROM public.profiles
        WHERE id = (NEW.evidence ->> 'confirm_bar')::uuid AND kind = 'bar' AND bar_id IS NOT NULL;
    END IF;

    IF v_event = 'arrived' THEN
        -- The bar confirms, when it can: no other claim on the page waiting.
        IF v_confirm.id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.profile_claims o
            WHERE o.profile_id = NEW.profile_id AND o.status = 'pending' AND o.id <> NEW.id
        ) THEN
            SELECT array_agg(DISTINCT ub.user_id) INTO v_to
            FROM public.user_bars ub
            WHERE ub.bar_id = v_confirm.bar_id AND ub.role_level >= 40 AND ub.user_id <> NEW.user_id
              AND NOT EXISTS (SELECT 1 FROM public.venue_roles vr WHERE vr.id = ub.venue_role_id AND vr.ends_at <= now());
            v_to_bar := v_to IS NOT NULL;
        END IF;
        IF v_to IS NULL THEN
            SELECT array_agg(a.user_id) INTO v_to FROM private.app_admins a WHERE a.user_id <> NEW.user_id;
        END IF;
        -- Their account's name, else their person page's. Never the email.
        SELECT coalesce(
            nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
            nullif(btrim(concat_ws(' ', nullif(btrim(u.raw_user_meta_data ->> 'first_name'), ''), nullif(btrim(u.raw_user_meta_data ->> 'last_name'), ''))), ''),
            (SELECT nullif(btrim(p.display_name), '') FROM public.profiles p WHERE p.user_id = u.id AND p.kind = 'person' LIMIT 1)
        ) INTO v_claimant
        FROM auth.users u WHERE u.id = NEW.user_id;
    ELSE
        v_to := ARRAY[NEW.user_id];
    END IF;
    IF v_to IS NULL THEN
        RETURN NULL;
    END IF;

    PERFORM net.http_post(
        url := v_url,
        body := jsonb_build_object(
            'event', v_event,
            'claim_id', NEW.id,
            'to', to_jsonb(v_to),
            'to_bar', v_to_bar,
            'page', jsonb_build_object('id', v_page.id, 'kind', v_page.kind, 'name', v_page.display_name, 'handle', v_page.handle, 'venue_id', v_page.bar_id),
            'claimant', v_claimant,
            'method', NEW.method,
            'instagram', CASE WHEN NEW.method = 'instagram' THEN NEW.evidence ->> 'instagram' END,
            'note', NEW.message,
            'confirm_bar', CASE WHEN v_confirm.id IS NOT NULL THEN jsonb_build_object('name', v_confirm.display_name, 'venue_id', v_confirm.bar_id) END,
            'confirmed_by_bar', NEW.evidence ? 'confirmed_by_bar',
            'decline_reason', NEW.decline_reason,
            -- Closed because another claim on the page was approved (hand_over_claim).
            'rival', v_event = 'rejected' AND EXISTS (
                SELECT 1 FROM public.profile_claims o WHERE o.profile_id = NEW.profile_id AND o.status = 'approved' AND o.id <> NEW.id
            )
        ),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-claim-email-secret', v_secret),
        timeout_milliseconds := 10000
    );
    RETURN NULL;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'request_claim_email: %', SQLERRM;
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION "private"."request_claim_email"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "profile_claims_email_arrived"
    AFTER INSERT ON "public"."profile_claims"
    FOR EACH ROW
    EXECUTE FUNCTION "private"."request_claim_email"();

CREATE TRIGGER "profile_claims_email_decided"
    AFTER UPDATE OF "status" ON "public"."profile_claims"
    FOR EACH ROW
    WHEN (OLD."status" = 'pending' AND NEW."status" <> 'pending')
    EXECUTE FUNCTION "private"."request_claim_email"();
