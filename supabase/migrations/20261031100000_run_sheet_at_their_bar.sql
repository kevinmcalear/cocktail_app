-- Run sheets say whose bar the night is at (21 Oct 2026, Kevin; canvas
-- https://claude.ai/artifact/7KusjjZLGZjbFd3B7oamZU, page "Our bar or theirs").
-- Until now the menu's own bar was always where the night happened and the
-- guest venue came to it. Now the menu's team can take their drinks to the
-- guest's bar instead, and the run sheet's defaults follow whose bar it is.
--
--   menu_run_parties.is_venue  true: the night is at this guest bar, and the
--                              menu's own team is visiting it. Only the guest
--                              can be the venue, and a menu has one guest, so
--                              there's at most one. Removing the guest puts
--                              the night back at the menu's own bar.
--
-- Access is unchanged: the column rides on menu_run_parties' row policies
-- (read with the menu, written by whoever can edit it).

ALTER TABLE "public"."menu_run_parties"
    ADD COLUMN "is_venue" boolean DEFAULT false NOT NULL,
    ADD CONSTRAINT "menu_run_parties_venue_is_guest" CHECK (NOT "is_venue" OR "kind" = 'guest');

COMMENT ON COLUMN "public"."menu_run_parties"."is_venue" IS
    'The night is at this guest bar and the menu''s own team visits it. Only a guest can be the venue.';
