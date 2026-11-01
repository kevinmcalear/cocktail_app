-- The staff link's settings on the bar (Kept-team, Invite): whether the link
-- is on, the role new people join as, and whether someone approves each one.
-- New columns only. The existing bars_update policy decides who may change
-- them (Admins and the brand capability), as for the bar's other settings.

ALTER TABLE "public"."bars"
    ADD COLUMN "staff_link_on" boolean DEFAULT true NOT NULL,
    ADD COLUMN "staff_link_role" integer DEFAULT 30 NOT NULL,
    ADD COLUMN "staff_link_approve" boolean DEFAULT true NOT NULL,
    ADD CONSTRAINT "bars_staff_link_role_check" CHECK ("staff_link_role" IN (10, 20, 30, 35));
