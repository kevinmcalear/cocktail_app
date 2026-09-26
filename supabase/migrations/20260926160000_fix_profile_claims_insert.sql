-- Fix profile_claims_insert (20260926150400_profiles_and_credit).
--
-- Inside its EXISTS on profiles, the unqualified "bar_id" resolved to
-- profiles.bar_id, which the same WHERE requires to be NULL, instead of the
-- claim's own bar_id. So every claim on a bar profile was refused, and a claim
-- on a person profile never checked that its own bar_id was empty. Same rule
-- as intended, with the claim's column named explicitly.

DROP POLICY "profile_claims_insert" ON "public"."profile_claims";
CREATE POLICY "profile_claims_insert" ON "public"."profile_claims" FOR INSERT TO "authenticated"
    WITH CHECK (
        "user_id" = (SELECT "auth"."uid"())
        AND "status" = 'pending' AND "reviewed_by" IS NULL AND "reviewed_at" IS NULL
        AND EXISTS (
            SELECT 1 FROM "public"."profiles" "p"
            WHERE "p"."id" = "profile_claims"."profile_id" AND "p"."user_id" IS NULL AND "p"."bar_id" IS NULL
              AND (("p"."kind" = 'person' AND "profile_claims"."bar_id" IS NULL)
                   OR ("p"."kind" = 'bar'
                       AND "profile_claims"."bar_id" IN (SELECT "private"."bars_with_capability"('publish'))))
        )
    );
