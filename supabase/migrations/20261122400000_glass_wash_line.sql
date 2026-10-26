-- Fit it to the glass (QA Q38, 25 Oct 2026; Kevin picked "Scale it" on the
-- design calls canvas, 26 Oct): each of a venue's glasses has a wash line, the
-- volume a drink should fill it to, just under the rim. The drink page and the
-- editor say when a spec, with its dilution, falls short of it or goes over,
-- and Fit it scales the spec's amounts to land on it (lib/glassFill.ts).
--
--   bar_glassware.wash_line_ml   what the venue says its glass is filled to,
--                                in ml. Null means not said: the app then
--                                takes it from the glass's capacity (the real
--                                glass's catalog capacity, else the capacity
--                                the venue typed when it drew the glass),
--                                about 90% of it to the brim. That default is
--                                worked out when it's read, never stored, so
--                                it follows the glass if the venue changes
--                                which real glass it is.
--
-- Who may change it is who may change the glass already: the venue's Prep
-- (bar_glassware_write, private.can_edit_bar_glassware, 20261007100000).
-- Anyone signed in reads it, as they read the rest of a venue's glassware.

ALTER TABLE "public"."bar_glassware"
    ADD COLUMN "wash_line_ml" numeric
        CONSTRAINT "bar_glassware_wash_line_ml_check" CHECK ("wash_line_ml" IS NULL OR ("wash_line_ml" >= 10 AND "wash_line_ml" < 5000));

-- A wash line is under the rim, so never more than the glass holds when the
-- venue has said what it holds.
ALTER TABLE "public"."bar_glassware"
    ADD CONSTRAINT "bar_glassware_wash_line_under_brim" CHECK ("wash_line_ml" IS NULL OR "capacity_ml" IS NULL OR "wash_line_ml" <= "capacity_ml");

COMMENT ON COLUMN "public"."bar_glassware"."wash_line_ml" IS
    'What a drink fills this glass to, in ml (the wash line, just under the rim). Null: not said, read as about 90% of its capacity (lib/glassFill.ts).';
