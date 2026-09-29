-- DRAFT (step 10b-3, open question 1 on the safety PR). Local stack only.
-- Not applied to production; needs Kevin's review first.
--
-- Ranking needs a confirmed age, on the server as well as in the app, the
-- same as collecting (20260930000200). Adding or changing a ranking entry or
-- a comparison needs private.is_age_confirmed(); reading and deleting your
-- own don't, so nobody loses access to what they already made.
--
-- Rankings made before this stay, and still count in the area scores.
-- Someone who hasn't answered the age check is asked the next time they
-- rank (the app's age gate); someone who answered under age can't add more.
--
-- The policies are 20260926150600's, unchanged apart from the age check.
-- WITH CHECK only applies to INSERT and UPDATE, so SELECT and DELETE still
-- need only USING (the owner).

DROP POLICY "rank_entries_own" ON "public"."rank_entries";
CREATE POLICY "rank_entries_own" ON "public"."rank_entries" FOR ALL TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()))
    WITH CHECK (
        "user_id" = (SELECT "auth"."uid"())
        AND (SELECT "private"."is_age_confirmed"())
        AND "item_id" IN (SELECT "id" FROM "public"."items")
        AND "ranked_as_item_id" IN (SELECT "id" FROM "public"."items")
        AND ("venue_profile_id" IS NULL OR EXISTS (
            SELECT 1 FROM "public"."profiles" "p"
            WHERE "p"."id" = "venue_profile_id" AND "p"."kind" = 'bar' AND "p"."is_public"
        ))
    );

DROP POLICY "rank_comparisons_own" ON "public"."rank_comparisons";
CREATE POLICY "rank_comparisons_own" ON "public"."rank_comparisons" FOR ALL TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()))
    WITH CHECK (
        "user_id" = (SELECT "auth"."uid"())
        AND (SELECT "private"."is_age_confirmed"())
        AND EXISTS (
            SELECT 1 FROM "public"."rank_entries" "w", "public"."rank_entries" "l"
            WHERE "w"."id" = "winner_entry_id" AND "l"."id" = "loser_entry_id"
              AND "w"."user_id" = (SELECT "auth"."uid"()) AND "l"."user_id" = (SELECT "auth"."uid"())
              AND "w"."ranked_as_item_id" = "l"."ranked_as_item_id"
        )
    );
