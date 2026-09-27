-- Two follow-ups to 20260926150400_profiles_and_credit.
--
-- 1. A claim that could never be approved. A person owns at most one profile
--    and a bar at most one (unique profiles.user_id and profiles.bar_id), so
--    approving a claim from someone who already has one failed on the unique
--    constraint. Such claims are now turned away when they're made, and
--    approval says so in words if one slips through.
--    ponytail: no merging. Someone with a profile who is also a historic one
--    (or a bar with an old venue profile) needs a moderator to merge them by
--    hand; a merge flow is the upgrade if that becomes common.
--
-- 2. Signed-out visitors could read profiles.user_id and created_by, which tie
--    a public profile to an account. They now get every column but those, plus
--    is_claimed, which is all the app needs from them. Signed-in users keep
--    full rows: moderators look claimants up by user_id.

-- --- Claimed or not, without the ids ---

ALTER TABLE "public"."profiles"
    ADD COLUMN "is_claimed" boolean GENERATED ALWAYS AS ("user_id" IS NOT NULL OR "bar_id" IS NOT NULL) STORED;

REVOKE SELECT ON "public"."profiles" FROM "anon";
GRANT SELECT (
    "id", "kind", "handle", "display_name", "bio", "avatar_url", "website", "bar_id", "is_public",
    "locality", "address_line", "postcode", "city", "region", "country_code", "latitude", "longitude",
    "claimed_at", "created_at", "is_claimed"
) ON "public"."profiles" TO "anon";

-- --- Only claims that can be approved ---

DROP POLICY "profile_claims_insert" ON "public"."profile_claims";
CREATE POLICY "profile_claims_insert" ON "public"."profile_claims" FOR INSERT TO "authenticated"
    WITH CHECK (
        "user_id" = (SELECT "auth"."uid"())
        AND "status" = 'pending' AND "reviewed_by" IS NULL AND "reviewed_at" IS NULL
        AND EXISTS (
            SELECT 1 FROM "public"."profiles" "p"
            WHERE "p"."id" = "profile_claims"."profile_id" AND "p"."user_id" IS NULL AND "p"."bar_id" IS NULL
              AND (("p"."kind" = 'person' AND "profile_claims"."bar_id" IS NULL
                    AND NOT EXISTS (SELECT 1 FROM "public"."profiles" "own" WHERE "own"."user_id" = (SELECT "auth"."uid"())))
                   OR ("p"."kind" = 'bar'
                       AND "profile_claims"."bar_id" IN (SELECT "private"."bars_with_capability"('publish'))
                       AND NOT EXISTS (SELECT 1 FROM "public"."profiles" "own" WHERE "own"."bar_id" = "profile_claims"."bar_id")))
        )
    );

CREATE OR REPLACE FUNCTION "public"."approve_profile_claim"("p_claim_id" "uuid") RETURNS "public"."profiles"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_claim public.profile_claims;
    v_profile public.profiles;
BEGIN
    IF NOT private.is_app_admin() THEN
        RAISE EXCEPTION 'Only moderators can approve claims.';
    END IF;

    SELECT * INTO v_claim FROM public.profile_claims WHERE id = p_claim_id AND status = 'pending' FOR UPDATE;
    IF v_claim.id IS NULL THEN
        RAISE EXCEPTION 'No pending claim with that id.';
    END IF;

    -- Made a profile (or was approved for another) after claiming this one.
    IF v_claim.bar_id IS NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE user_id = v_claim.user_id) THEN
        RAISE EXCEPTION 'This person already has a profile. Merge them by hand, or turn the claim down.';
    END IF;
    IF v_claim.bar_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE bar_id = v_claim.bar_id) THEN
        RAISE EXCEPTION 'This bar already has a profile. Merge them by hand, or turn the claim down.';
    END IF;

    UPDATE public.profiles
    SET user_id = CASE WHEN kind = 'person' THEN v_claim.user_id END,
        bar_id = CASE WHEN kind = 'bar' THEN v_claim.bar_id END,
        claimed_at = now()
    WHERE id = v_claim.profile_id AND user_id IS NULL AND bar_id IS NULL
    RETURNING * INTO v_profile;
    IF v_profile.id IS NULL THEN
        RAISE EXCEPTION 'That profile has already been claimed.';
    END IF;

    UPDATE public.profile_claims
    SET status = CASE WHEN id = p_claim_id THEN 'approved' ELSE 'rejected' END::public.claim_status,
        reviewed_by = auth.uid(),
        reviewed_at = now()
    WHERE profile_id = v_claim.profile_id AND status = 'pending';

    RETURN v_profile;
END;
$$;
