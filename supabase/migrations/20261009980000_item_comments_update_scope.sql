-- DRAFT. Local stack only until Kevin's OK.
--
-- Tighten who can edit a staff note (item_comments) and what they can change.
--
--   The update check now matches the insert check: the note must stay at a
--   venue where the author has talking points, on a drink of that venue.
--   Members edit only the text. The venue, drink, version and the name shown
--   on the note are set when it is posted and stay that way; the trigger still
--   stamps updated_at.

DROP POLICY "item_comments_update" ON "public"."item_comments";
CREATE POLICY "item_comments_update" ON "public"."item_comments" FOR UPDATE TO "authenticated"
    USING ("author_id" = (SELECT "auth"."uid"()))
    WITH CHECK (
        "author_id" = (SELECT "auth"."uid"())
        AND "bar_id" IN (SELECT "private"."bars_with_capability"('talking_points'))
        AND EXISTS (SELECT 1 FROM "public"."items" "i" WHERE "i"."id" = "item_id" AND "i"."bar_id" = "item_comments"."bar_id")
    );

REVOKE UPDATE ON "public"."item_comments" FROM "anon", "authenticated";
GRANT UPDATE ("body") ON "public"."item_comments" TO "authenticated";
