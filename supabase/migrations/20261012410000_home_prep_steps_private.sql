-- A home prep's method stays with its maker. Local stack only until Kevin's OK.
--
-- A home item (no venue, made by someone, not a catalog row) is readable by
-- its creator and by anyone who can see a drink that uses it
-- (20261008830000_home_items_private.sql). Its prep card (item_prep: yield,
-- shelf life, lead time, storage) and its steps (item_steps) followed the item,
-- so whoever could see a published drink could read how its home preps are
-- made. Now those two read only for people who can edit the item
-- (private.can_edit_item: the creator, and app admins). Others still see the
-- prep's name with the drink.
--
-- Unchanged: shared catalog rows (no creator, or is_catalog) read for every
-- signed-in person; a venue's rows read for members of venues with the
-- house_made or prep capability; the write policies (which also grant reads to
-- whoever can write) stay as they are.

DROP POLICY IF EXISTS "item_prep_select" ON "public"."item_prep";
CREATE POLICY "item_prep_select" ON "public"."item_prep" FOR SELECT TO "authenticated"
    USING (EXISTS (
        SELECT 1 FROM "public"."items" "i"
        WHERE "i"."id" = "item_id"
          AND (("i"."bar_id" IS NULL
                AND ("i"."created_by" IS NULL OR "i"."is_catalog" OR "private"."can_edit_item"("i"."id")))
               OR "i"."bar_id" IN (SELECT "private"."bars_with_capability"('house_made'))
               OR "i"."bar_id" IN (SELECT "private"."bars_with_capability"('prep')))
    ));

DROP POLICY IF EXISTS "item_steps_select" ON "public"."item_steps";
CREATE POLICY "item_steps_select" ON "public"."item_steps" FOR SELECT TO "authenticated"
    USING (EXISTS (
        SELECT 1 FROM "public"."items" "i"
        WHERE "i"."id" = "item_id"
          AND (("i"."bar_id" IS NULL
                AND ("i"."created_by" IS NULL OR "i"."is_catalog" OR "private"."can_edit_item"("i"."id")))
               OR "i"."bar_id" IN (SELECT "private"."bars_with_capability"('house_made'))
               OR "i"."bar_id" IN (SELECT "private"."bars_with_capability"('prep')))
    ));
