-- Mulled Wine becomes its own root in the family tree, with no parent drink
-- and no parent style. 20261106100000 put it under the Punch style, so the
-- tree read "Riff of Punch, 1632" under a drink from about 1390. Kevin's pick
-- on the Open decisions page (d51, 25 Oct 2026): no parent, shown as
-- "c. 1390" with no riff line. Its family, year and note are unchanged.
UPDATE "public"."items"
SET "lineage_style_id" = NULL,
    "lineage_parent_id" = NULL
WHERE "is_catalog"
  AND "item_type" = 'cocktail'
  AND "lineage_family" IS NOT NULL
  AND lower("name") = 'mulled wine'
  AND ("lineage_style_id" IS NOT NULL OR "lineage_parent_id" IS NOT NULL);
