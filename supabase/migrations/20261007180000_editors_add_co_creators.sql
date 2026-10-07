-- Whoever can edit a drink can name the people who made it with them: the
-- upgrade item_co_creators' first migration (20260929700000_bar_people.sql)
-- left for later. Adding a drink asks for its co-creators, so the person
-- adding it (or the venue's editors) writes them, not a moderator.
--
-- Same rule as the drink's own spec (private.can_edit_item): a venue drink's
-- editors (role 35 and up), a home drink's creator, and app admins. The
-- trigger still insists on a person's profile. A co-creator can still take
-- themselves off.

DROP POLICY "item_co_creators_insert" ON "public"."item_co_creators";
CREATE POLICY "item_co_creators_insert" ON "public"."item_co_creators" FOR INSERT TO "authenticated"
    WITH CHECK ("private"."is_app_admin"() OR "private"."can_edit_item"("item_id"));

DROP POLICY "item_co_creators_delete" ON "public"."item_co_creators";
CREATE POLICY "item_co_creators_delete" ON "public"."item_co_creators" FOR DELETE TO "authenticated"
    USING (
        "private"."is_app_admin"()
        OR "private"."can_edit_item"("item_id")
        OR "profile_id" IN (SELECT "id" FROM "public"."profiles" WHERE "user_id" = (SELECT "auth"."uid"()))
    );
