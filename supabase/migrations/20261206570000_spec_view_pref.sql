-- Ingredients | Steps follows the person across devices (decision spec-toggle:
-- sticky). user_prefs.spec_view holds the last pick; null until they make one,
-- when the page opens on the default for who they are (Steps for people who
-- make the drink, Ingredients for everyone else). user_prefs' own policy
-- applies: each person reads and writes only their row.

ALTER TABLE "public"."user_prefs"
    ADD COLUMN "spec_view" "text",
    ADD CONSTRAINT "user_prefs_spec_view_check" CHECK ("spec_view" IN ('ingredients', 'steps'));

COMMENT ON COLUMN "public"."user_prefs"."spec_view" IS 'The spec''s Ingredients | Steps pick, null until they make one.';
