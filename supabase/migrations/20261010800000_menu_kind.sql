-- R&D collections.
--
-- A bar's spec book holds work in progress next to what it pours: trials,
-- flights tasted against a control, staff assignments. Until now the only
-- way to group drinks was a menu, so a flight's "Control" sat in the Library
-- beside the house menu. A menu row can now say it is R&D:
--
--   menus.kind   'menu' (default) a menu: draft, coming up, on, previous.
--                'rnd'            an R&D collection. Never dated, so it never
--                                 goes live or shows on a public page; the
--                                 app files it, and drinks only on R&D
--                                 collections, under R&D.
--
-- Writes go through the existing menus policies; nothing else changes.

ALTER TABLE "public"."menus"
    ADD COLUMN "kind" "text" DEFAULT 'menu' NOT NULL,
    ADD CONSTRAINT "menus_kind_check" CHECK ("kind" IN ('menu', 'rnd')),
    ADD CONSTRAINT "menus_rnd_undated" CHECK ("kind" <> 'rnd' OR ("starts_at" IS NULL AND "ends_at" IS NULL));

COMMENT ON COLUMN "public"."menus"."kind" IS
    'menu, or rnd: an R&D collection (trials, flights, assignments). R&D is never dated, so it never goes live.';
