-- Drafts in your account (Making anything, one flow, PR 5; board
-- make-anything-steps-3, step 9: "Kept in your account, so your other phone
-- and the web see it too").
--
-- A drink being added in the step-by-step wizard is kept in the account as
-- well as on the device, with the recipes still to finish inside it, so
-- another phone or the web picks it up where it was left. Each is a row of
-- `drafts` with entity_type 'drink_wizard' and its slot (lib/wizardSlots:
-- the place, then the menu section, drink or name it was started from), one
-- row per person and slot.
--
-- Who can see and change a draft is unchanged (20260923000100,
-- 20261101200000): its author, and for a venue's draft the people whose role
-- edits the venue's drinks. The app only reads back its own.

ALTER TABLE "public"."drafts" DROP CONSTRAINT "drafts_entity_type_check";
ALTER TABLE "public"."drafts" ADD CONSTRAINT "drafts_entity_type_check"
    CHECK ("entity_type" = ANY (ARRAY['cocktail'::"text", 'ingredient'::"text", 'beer'::"text", 'wine'::"text", 'menu'::"text", 'drink_wizard'::"text"]));

ALTER TABLE "public"."drafts" ADD COLUMN "slot" "text";
COMMENT ON COLUMN "public"."drafts"."slot" IS 'A wizard draft''s slot (lib/wizardSlots); set for drink_wizard rows only.';
ALTER TABLE "public"."drafts" ADD CONSTRAINT "drafts_slot_for_wizard" CHECK (("entity_type" = 'drink_wizard') = ("slot" IS NOT NULL));

-- One per person and slot: the app upserts on it.
CREATE UNIQUE INDEX "drafts_user_slot_key" ON "public"."drafts" ("user_id", "entity_type", "slot");
