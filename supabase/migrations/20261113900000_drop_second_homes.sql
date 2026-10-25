-- Drops what merged PRs left behind for a later migration, so each fact has
-- one home (AGENTS.md), and finishes the constraint renames of 20261103200000.
--
-- 1. items.price_minor (#764, 20261103100000). items.price, as the bar typed
--    it, is the drink's price; the number was kept in step by the
--    items_price_in_step trigger only so older apps kept working. The
--    trigger, its helpers (private.price_minor_of, price_text_of,
--    minor_per_major) and the column go, and app_item_presentation is made
--    again without the column (a view can't lose a column in place).
-- 2. The old menu creator's template links (#369). Nothing writes
--    menus.template_id, menu_drinks.template_section_id or
--    menu_sections.template_section_id any more, so the
--    menu_drinks_fill_section trigger loses its template half. It keeps the
--    other: a drink added with no section lands in the menu's first one (or
--    a new "Drinks"), so no drink is on a menu but missing from its page
--    (seed_demo.sql and older scripts add drinks that way). menu_templates
--    and template_sections stay: they are the saved layouts. Their
--    menu_templates.description, which layouts never show, goes too.
-- 3. public.get_my_taste, unused since #345 (taste is worked out in the app).
-- 4. recipes' last two keys keep the names they had as new_recipes. The app
--    (hooks/usePrepCard.ts) and image-worker name the column in their embeds
--    since #757, so the names can match the table now.
--
-- Apply only once installed apps have the update that stops reading
-- menus.template_id and writing items.price_minor, and the image functions
-- run the _shared/itemPrompts.ts from #757: the deployed ones still name
-- new_recipes_recipe_item_id_fkey.

-- --- 1. items.price_minor ---

DROP TRIGGER IF EXISTS "items_price_in_step" ON "public"."items";
DROP FUNCTION IF EXISTS private.items_price_in_step();
DROP FUNCTION IF EXISTS private.price_minor_of(text, text);
DROP FUNCTION IF EXISTS private.price_text_of(integer, text);
DROP FUNCTION IF EXISTS private.minor_per_major(text);

-- A credited drink's price stays out of sight (20261103100000), now
-- watching the price alone.
DROP TRIGGER IF EXISTS keep_credited_price ON public.items;
CREATE TRIGGER keep_credited_price
    BEFORE INSERT OR UPDATE OF price ON public.items
    FOR EACH ROW
    WHEN (NEW.bar_id IS NULL AND NOT NEW.is_catalog AND NEW.created_by IS NULL AND NEW.origin_bar_profile_id IS NOT NULL)
    EXECUTE FUNCTION private.keep_credited_drink_detail('price');

DROP VIEW "public"."app_item_presentation";
ALTER TABLE "public"."items" DROP COLUMN "price_minor";

-- As 20261108100000, without price_minor.
CREATE VIEW "public"."app_item_presentation" WITH ("security_invoker" = true) AS
 SELECT c.id,
    c.name,
    c.item_type,
    c.description,
    c.created_at,
    c.glassware_id,
    c.family_id,
    c.ice_id,
    COALESCE(c.notes, (SELECT n.notes FROM public.credited_drink_notes n WHERE n.item_id = c.id)) AS notes,
    c.origin,
    COALESCE(c.price, (SELECT cd.price FROM public.credited_drink_details cd WHERE cd.item_id = c.id)) AS price,
    c.status,
    c.brand_maker,
    c.abv,
    c.bar_id,
    c.icon_key,
    c.icon_url,
    c.hide_from_search,
    c.origin_bar_profile_id,
    c.created_by,
    c.creator_profile_id,
    c.generic_id,
    c.service_style,
    c.density_g_ml,
    COALESCE(c.dilution_pct, (SELECT cd.dilution_pct FROM public.credited_drink_details cd WHERE cd.item_id = c.id)) AS dilution_pct,
    COALESCE(c.serve_ml, (SELECT cd.serve_ml FROM public.credited_drink_details cd WHERE cd.item_id = c.id)) AS serve_ml,
    COALESCE(c.serve_abv, (SELECT cd.serve_abv FROM public.credited_drink_details cd WHERE cd.item_id = c.id)) AS serve_abv,
    c.abv_source,
    c.capacity_ml,
    c.iced_capacity_ml,
    c.ice_per_serve_g,
    c.is_core,
    c.ingredient_role,
    c.made_from_id,
    c.method_ice_id,
    c.ice_build,
    CASE
      WHEN c.bar_id IS NOT NULL OR c.created_by IS NOT NULL THEN c.picture
      WHEN c.item_type = 'ingredient' AND c.picture = 'photo' AND private.item_picture_url(c.id) IS NOT NULL THEN 'photo'::public.item_picture
      ELSE 'drawing'::public.item_picture
    END AS picture,
    CASE WHEN c.item_type = 'ingredient' THEN private.item_picture_url(c.id) END AS picture_url
   FROM public.items c
     LEFT JOIN public.bars b ON c.bar_id = b.id
     LEFT JOIN public.user_bars ub ON ub.bar_id = c.bar_id AND ub.user_id = auth.uid()
     LEFT JOIN public.venue_roles vr ON vr.id = ub.venue_role_id
     LEFT JOIN public.venue_level_overrides lo ON ub.venue_role_id IS NULL AND lo.bar_id = ub.bar_id AND lo.base_level = ub.role_level
     CROSS JOIN LATERAL (SELECT public.effective_bar_role(ub.role_level) AS role) er
  WHERE c.bar_id IS NULL
     OR private.cap_open('menu', er.role >= COALESCE(c.override_visibility_level, b.default_visibility_level),
                         CASE WHEN er.role = ub.role_level THEN COALESCE(vr.granted, lo.granted) END,
                         CASE WHEN er.role = ub.role_level THEN COALESCE(vr.revoked, lo.revoked) END)
     OR (ub.user_id IS NOT NULL
         AND private.cap_open('edit_drinks', 'edit_drinks' = ANY (private.base_capabilities(er.role)),
                              CASE WHEN er.role = ub.role_level THEN COALESCE(vr.granted, lo.granted) END,
                              CASE WHEN er.role = ub.role_level THEN COALESCE(vr.revoked, lo.revoked) END));

-- A view reads, nothing more (the rows' own RLS decides what).
REVOKE ALL ON TABLE "public"."app_item_presentation" FROM PUBLIC, "anon", "authenticated";
GRANT SELECT ON TABLE "public"."app_item_presentation" TO "anon", "authenticated";
GRANT ALL ON TABLE "public"."app_item_presentation" TO "service_role";

-- --- 2. The old menu creator's template links ---

-- As 20260927100000, without the template sections.
CREATE OR REPLACE FUNCTION private.menu_drinks_fill_section()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.menu_section_id IS NOT NULL OR NEW.menu_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT s.id INTO NEW.menu_section_id
  FROM public.menu_sections s
  WHERE s.menu_id = NEW.menu_id
  ORDER BY s.sort_order, s.created_at
  LIMIT 1;
  IF NEW.menu_section_id IS NULL THEN
    INSERT INTO public.menu_sections (menu_id, name, min_items)
    VALUES (NEW.menu_id, 'Drinks', 0)
    RETURNING id INTO NEW.menu_section_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "menu_drinks_fill_section" ON "public"."menu_drinks";

ALTER TABLE "public"."menu_drinks" DROP COLUMN "template_section_id";
CREATE TRIGGER "menu_drinks_fill_section"
  BEFORE INSERT ON "public"."menu_drinks"
  FOR EACH ROW EXECUTE FUNCTION private.menu_drinks_fill_section();
ALTER TABLE "public"."menu_sections" DROP COLUMN "template_section_id";
ALTER TABLE "public"."menus" DROP COLUMN "template_id";
ALTER TABLE "public"."menu_templates" DROP COLUMN "description";

-- --- 3. get_my_taste ---

DROP FUNCTION IF EXISTS public.get_my_taste();

-- --- 4. recipes' last two key names ---

ALTER TABLE "public"."recipes" RENAME CONSTRAINT "new_recipes_recipe_item_id_fkey" TO "recipes_recipe_item_id_fkey";
ALTER TABLE "public"."recipes" RENAME CONSTRAINT "new_recipes_ingredient_item_id_fkey" TO "recipes_ingredient_item_id_fkey";
