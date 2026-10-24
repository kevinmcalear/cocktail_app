-- A drink's year can be our best guess at a range, and can go back past 1600.
--
--   * items.origin_year_guess   null, or the range origin_year is our best
--                               guess inside: 'decade' (the 1920s), 'early',
--                               'mid' or 'late' (the mid 1930s). Apps show it
--                               as "mid 1930s (best guess)"; origin_year stays
--                               the year it sits at on the timeline. Kevin
--                               asked for it on 24 Oct 2026, for classics no
--                               source dates.
--   * items_origin_year_check   1300 to 2100 (was 1600), so a drink first
--                               recorded in the Middle Ages, like mulled wine
--                               in 1390, keeps its real year.
--
-- No RLS or grant changes: the column follows the items row's policies.

ALTER TABLE "public"."items" ADD COLUMN "origin_year_guess" "text"
    CONSTRAINT "items_origin_year_guess_check"
    CHECK ("origin_year_guess" IS NULL OR ("origin_year_guess" IN ('decade', 'early', 'mid', 'late') AND "origin_year" IS NOT NULL));

COMMENT ON COLUMN "public"."items"."origin_year_guess" IS
    'Null, or the range origin_year is our best guess inside: decade (the 1920s), early, mid or late (the mid 1930s).';

ALTER TABLE "public"."items" DROP CONSTRAINT "items_origin_year_check";
ALTER TABLE "public"."items" ADD CONSTRAINT "items_origin_year_check" CHECK ("origin_year" >= 1300 AND "origin_year" <= 2100);
