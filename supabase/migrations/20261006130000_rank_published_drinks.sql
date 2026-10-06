-- Anyone can rank a drink a bar has published, not only the bar's own staff.
--
-- rank_entries_own (20260930500600) only took drinks the ranker can read in
-- `items`, and a bar's drinks are hidden there from everyone outside the bar.
-- So a guest at the bar could collect its published drink (that check also
-- looks at published_items) but not rank it. This takes a published drink
-- the same way, for the drink and for the list it's ranked in.
--
-- Unchanged: the owner, the age check, and the venue being a public bar.
-- Entries stay when a bar unpublishes a drink later, the same as collected
-- drinks: USING is still the owner alone, so you can read and delete yours.

DROP POLICY "rank_entries_own" ON "public"."rank_entries";
CREATE POLICY "rank_entries_own" ON "public"."rank_entries" FOR ALL TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()))
    WITH CHECK (
        "user_id" = (SELECT "auth"."uid"())
        AND (SELECT "private"."is_age_confirmed"())
        AND (
            "item_id" IN (SELECT "id" FROM "public"."items")
            OR "item_id" IN (SELECT "p"."id" FROM "public"."published_items" "p" WHERE NOT "p"."is_reference")
        )
        AND (
            "ranked_as_item_id" IN (SELECT "id" FROM "public"."items")
            OR "ranked_as_item_id" IN (SELECT "p"."id" FROM "public"."published_items" "p" WHERE NOT "p"."is_reference")
        )
        AND ("venue_profile_id" IS NULL OR EXISTS (
            SELECT 1 FROM "public"."profiles" "p"
            WHERE "p"."id" = "venue_profile_id" AND "p"."kind" = 'bar' AND "p"."is_public"
        ))
    );
