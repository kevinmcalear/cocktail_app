-- An ingredient's picture (Eddie's call, 22 Oct, fix 17; board
-- eddie-oct22-ingredient-picture on the whole-app canvas): its drawing (the
-- default), the bar's own photo, or none.
--
-- items.picture holds the choice. The photo is an item_images link like a
-- drink's, marked is_picture, so the old catalogue photos still sitting in
-- item_images for ingredients never surface: only a photo picked through
-- set_item_picture shows. Both are written under the rule that edits the
-- ingredient (items_update, item_images_insert/delete: can_edit_item).
--
-- Only what a bar or a person owns gets the choice (a house prep, a bottle a
-- bar added itself). Shared catalogue items stay drawn for everyone: the
-- guard refuses a photo or None on them, and app_item_presentation reads them
-- as drawn. Who sees the photo is who sees the ingredient: the view shows its
-- URL only on rows the caller can already read.

CREATE TYPE public.item_picture AS ENUM ('drawing', 'photo', 'none');

ALTER TABLE public.items ADD COLUMN picture public.item_picture NOT NULL DEFAULT 'drawing';
COMMENT ON COLUMN public.items.picture IS 'An ingredient''s picture: its drawing, its own photo (the item_images link marked is_picture), or none.';

ALTER TABLE public.item_images ADD COLUMN is_picture boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.item_images.is_picture IS 'The photo an ingredient''s editor chose for it (items.picture = photo). Other ingredient links are old catalogue photos and stay hidden.';
CREATE UNIQUE INDEX item_images_one_picture ON public.item_images (item_id) WHERE is_picture;

-- Shared (no bar, no creator) and non-ingredient items keep the drawing.
CREATE OR REPLACE FUNCTION private.guard_item_picture()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_item public.items%ROWTYPE;
BEGIN
    IF TG_TABLE_NAME = 'items' THEN
        IF NEW.picture = 'drawing' THEN RETURN NEW; END IF;
        v_item := NEW;
    ELSE
        IF NOT NEW.is_picture THEN RETURN NEW; END IF;
        SELECT * INTO v_item FROM public.items WHERE id = NEW.item_id;
    END IF;
    IF v_item.item_type IS DISTINCT FROM 'ingredient' OR (v_item.bar_id IS NULL AND v_item.created_by IS NULL) THEN
        RAISE EXCEPTION 'Only a bar''s or a person''s own ingredient can have its own picture.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER guard_item_picture BEFORE INSERT OR UPDATE OF picture ON public.items
    FOR EACH ROW EXECUTE FUNCTION private.guard_item_picture();
CREATE TRIGGER guard_item_picture BEFORE INSERT OR UPDATE OF is_picture, item_id ON public.item_images
    FOR EACH ROW EXECUTE FUNCTION private.guard_item_picture();

-- The chosen photo's URL. The view calls it only for rows the caller can
-- read, so it reads past item_images' row checks (one index lookup a row).
CREATE OR REPLACE FUNCTION private.item_picture_url(p_item_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT im.url FROM public.item_images ii JOIN public.images im ON im.id = ii.image_id
  WHERE ii.item_id = p_item_id AND ii.is_picture
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION private.item_picture_url(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.item_picture_url(uuid) TO authenticated, anon;

-- Sets the choice in one step. With an image (an images row the caller just
-- uploaded), it becomes the photo, replacing the last one; without, Your
-- photo goes back to the photo already chosen. Security invoker: the items
-- and item_images row checks decide, so someone who can't edit the
-- ingredient changes nothing.
CREATE OR REPLACE FUNCTION public.set_item_picture(p_item_id uuid, p_picture public.item_picture, p_image_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
BEGIN
    UPDATE public.items SET picture = p_picture WHERE id = p_item_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'You can''t change this ingredient''s picture.' USING ERRCODE = '42501';
    END IF;
    IF p_image_id IS NOT NULL THEN
        DELETE FROM public.item_images WHERE item_id = p_item_id AND is_picture;
        INSERT INTO public.item_images (item_id, image_id, is_picture) VALUES (p_item_id, p_image_id, true);
    END IF;
    IF p_picture = 'photo' AND private.item_picture_url(p_item_id) IS NULL THEN
        RAISE EXCEPTION 'Choose a photo first.' USING ERRCODE = '22023';
    END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.set_item_picture(uuid, public.item_picture, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_item_picture(uuid, public.item_picture, uuid) TO authenticated;

-- As 20261101200000_role_permissions_per_role.sql, with picture and
-- picture_url at the end. A shared item reads as drawn whatever it holds.
CREATE OR REPLACE VIEW "public"."app_item_presentation" WITH ("security_invoker" = true) AS
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
    COALESCE(c.price_minor, (SELECT cd.price_minor FROM public.credited_drink_details cd WHERE cd.item_id = c.id)) AS price_minor,
    c.is_core,
    c.ingredient_role,
    c.made_from_id,
    c.method_ice_id,
    c.ice_build,
    CASE WHEN c.bar_id IS NULL AND c.created_by IS NULL THEN 'drawing'::public.item_picture ELSE c.picture END AS picture,
    CASE WHEN c.picture = 'photo' AND (c.bar_id IS NOT NULL OR c.created_by IS NOT NULL) THEN private.item_picture_url(c.id) END AS picture_url
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
