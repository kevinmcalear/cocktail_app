-- Whether a drink's drawing still shows on its page once it has a photo
-- (Eddie's E26, board w2-wizard-finish, Kevin's call B on 26 Oct: a hero
-- photo replaces the drawing by default, with Keep it to keep both).
--
--   items.show_sketch   true: the drawing stays, last in the drink page's
--                       pictures, after the photos (every drink until now).
--                       false: the photos only. With no photo the drawing
--                       shows whatever this says, so deleting every photo
--                       brings it back.
--
-- The add wizard saves false for a new drink with a hero photo unless Keep it
-- was picked. Menus and tiles already lead with the hero photo, so only the
-- drink page reads it. Who may set it: anyone items_update lets edit the
-- drink (can_write); no new policy.

ALTER TABLE "public"."items" ADD COLUMN "show_sketch" boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN "public"."items"."show_sketch" IS 'False: the drawing is left off the drink page while it has a photo (E26).';
