-- Step asides and notes (Kevin, 1 Nov 2026: their own table). Steps view on
-- the drink page groups a drink's lines into steps; each step carries a short
-- aside beside its heading ("hard, with ice") and a note under its lines
-- ("Strain over one large cube in a rocks glass"), as drawn on
-- Decided-spec-groups-* and the who boards and their twins.
--
--   * drink_step_notes, one row per step of a drink that has words. A step
--     has no row of its own, so step_key names it the way lib/specView.ts
--     specGroups does: main (the first pour or the first part), float,
--     part-2 and on, garnish. A step with neither word has no row.
--   * Who reads it: whoever the server gives this drink's amounts to, as the
--     Steps view only opens with amounts (app_recipe_presentation decides,
--     so a bar's permissions, View as and a published spec all carry over),
--     and whoever can edit the drink, who needs them to write. Signed-out
--     visitors read nothing.
--   * Who writes it: whoever can edit the drink.

CREATE TABLE "public"."drink_step_notes" (
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "step_key" "text" NOT NULL CHECK ("step_key" ~ '^(main|float|garnish|part-[2-9][0-9]*)$'),
    "aside" "text" CHECK (char_length(btrim("aside")) BETWEEN 1 AND 60),
    "note" "text" CHECK (char_length(btrim("note")) BETWEEN 1 AND 500),
    PRIMARY KEY ("item_id", "step_key"),
    CONSTRAINT "drink_step_notes_has_words" CHECK ("aside" IS NOT NULL OR "note" IS NOT NULL)
);

COMMENT ON TABLE "public"."drink_step_notes" IS 'The words on a step of a drink''s Steps view: the aside beside its heading and the note under its lines. step_key is lib/specView.ts specGroups'' key.';

ALTER TABLE "public"."drink_step_notes" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drink_step_notes_select" ON "public"."drink_step_notes" FOR SELECT TO "authenticated"
    USING (
        "private"."can_edit_item"("item_id")
        OR EXISTS (
            SELECT 1 FROM "public"."app_recipe_presentation" "r"
            WHERE "r"."recipe_item_id" = "drink_step_notes"."item_id"
              AND "r"."amount" IS NOT NULL
        )
    );

CREATE POLICY "drink_step_notes_write" ON "public"."drink_step_notes" FOR ALL TO "authenticated"
    USING ("private"."can_edit_item"("item_id"))
    WITH CHECK ("private"."can_edit_item"("item_id"));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."drink_step_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."drink_step_notes" TO "service_role";
