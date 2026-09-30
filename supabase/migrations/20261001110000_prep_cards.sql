-- DRAFT. Local stack only until Kevin's OK.
--
-- The prep card for a house-made ingredient: what one batch makes and how
-- long it keeps (item_prep, which already exists), where it's kept and how
-- it's made (storage, actions), and the steps to make it, each with an
-- optional timer (item_steps). The bench scales the recipe from these;
-- nothing here changes the recipe rows themselves.

ALTER TABLE "public"."item_prep"
    -- "Fridge, sealed", "Freezer", "Ambient, dark".
    ADD COLUMN "storage" "text" CHECK (char_length("storage") <= 60),
    -- How it's made, from a short fixed list (blend, infuse, clarify ...), for
    -- filters and the card's tags.
    ADD COLUMN "actions" "text"[] DEFAULT '{}' NOT NULL;

CREATE TABLE "public"."item_steps" (
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "position" integer NOT NULL CHECK ("position" >= 0),
    "body" "text" NOT NULL CHECK (char_length(btrim("body")) BETWEEN 1 AND 500),
    -- "Steep 10 min": a countdown the bench can start.
    "timer_seconds" integer CHECK ("timer_seconds" > 0 AND "timer_seconds" <= 86400),
    PRIMARY KEY ("item_id", "position")
);

ALTER TABLE "public"."item_steps" ENABLE ROW LEVEL SECURITY;

-- Same rules as item_prep: read with the item when it's shared or personal,
-- or by members who see house-made recipes or run prep; written by the prep
-- crew, or by whoever can edit the item and see house-made recipes.
CREATE POLICY "item_steps_select" ON "public"."item_steps" FOR SELECT TO "authenticated"
    USING (EXISTS (
        SELECT 1 FROM "public"."items" "i"
        WHERE "i"."id" = "item_id"
          AND ("i"."bar_id" IS NULL
               OR "i"."bar_id" IN (SELECT "private"."bars_with_capability"('house_made'))
               OR "i"."bar_id" IN (SELECT "private"."bars_with_capability"('prep')))
    ));
CREATE POLICY "item_steps_write" ON "public"."item_steps" FOR ALL TO "authenticated"
    USING (EXISTS (
        SELECT 1 FROM "public"."items" "i"
        WHERE "i"."id" = "item_id"
          AND ("i"."bar_id" IN (SELECT "private"."bars_with_capability"('prep'))
               OR ("private"."can_edit_item"("i"."id")
                   AND ("i"."bar_id" IS NULL OR "i"."bar_id" IN (SELECT "private"."bars_with_capability"('house_made')))))
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM "public"."items" "i"
        WHERE "i"."id" = "item_id"
          AND ("i"."bar_id" IN (SELECT "private"."bars_with_capability"('prep'))
               OR ("private"."can_edit_item"("i"."id")
                   AND ("i"."bar_id" IS NULL OR "i"."bar_id" IN (SELECT "private"."bars_with_capability"('house_made')))))
    ));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."item_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."item_steps" TO "service_role";
