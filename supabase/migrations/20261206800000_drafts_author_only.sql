-- Drafts belong to their author: only the person who wrote a draft reads,
-- changes or removes it. Inserting stays as it is (your own drafts, at no bar
-- or at a bar you belong to). Signed-out requests have no drafts policy at all.
--
-- Whether a bar's managers should also see their team's drafts is an open
-- product question; this is the default until it is decided.

ALTER POLICY "drafts_select" ON "public"."drafts"
    USING ("user_id" = (SELECT "auth"."uid"()));

ALTER POLICY "drafts_update" ON "public"."drafts"
    USING ("user_id" = (SELECT "auth"."uid"()))
    WITH CHECK (
        "user_id" = (SELECT "auth"."uid"())
        AND ("bar_id" IS NULL OR "bar_id" IN (SELECT "private"."my_bar_ids"(0)))
    );

ALTER POLICY "drafts_delete" ON "public"."drafts"
    USING ("user_id" = (SELECT "auth"."uid"()));
