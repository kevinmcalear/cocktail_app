-- A brand's own photos on its catalogue bottles (board ppl-maker on the
-- whole-app canvas, Kevin's calls of 25 Oct). The team of a claimed maker
-- page (Drink Creator and up at the venue its claim made) sets the picture of
-- the shared bottles that name it (items.maker_profile_id): its drawing or
-- its photo, never None. Everyone else's rules from 20261103520000 stand: a
-- venue editor or an app admin still can't give a shared item a photo.
--
--   * item_images.checked_at: a shared bottle's photo shows once it's set. A
--     team's first photo waits for a moderator (check_maker_photo); once one
--     of its photos has been checked, the next ones are checked as they land.
--   * set_maker_bottle_picture: the only way in. The photo must be one the
--     app uploaded for that bottle (drinks/ingredients/<item id>/).
--   * maker_bottle_photos: the team's own view of its photos, waiting ones
--     included (the presentation view shows only checked ones).
--   * maker_photos_waiting / check_maker_photo: the moderators' queue.
--   * app_item_presentation: a shared bottle reads as its photo once checked,
--     else drawn, wherever it shows. A bar's own copy of a bottle doesn't
--     link to it, so it keeps its own picture.

ALTER TABLE public.item_images ADD COLUMN checked_at timestamptz;
COMMENT ON COLUMN public.item_images.checked_at IS 'A shared bottle''s photo (is_picture) shows once set: by a moderator for a maker team''s first photo, at once after that. Unused on a bar''s or a person''s own ingredient.';

-- Whether the caller is on the team that runs this maker page.
CREATE FUNCTION private.on_maker_team(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_profile_id AND p.kind = 'maker'
      AND p.bar_id IN (SELECT private.my_bar_ids(35))
  );
$$;
REVOKE ALL ON FUNCTION private.on_maker_team(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.on_maker_team(uuid) TO authenticated;

-- A shared bottle the caller's maker team may give a picture.
CREATE FUNCTION private.can_picture_maker_bottle(p_item_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.items i
    WHERE i.id = p_item_id AND i.item_type = 'ingredient'
      AND i.bar_id IS NULL AND i.created_by IS NULL
      AND i.maker_profile_id IS NOT NULL
      AND private.on_maker_team(i.maker_profile_id)
  );
$$;
REVOKE ALL ON FUNCTION private.can_picture_maker_bottle(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.can_picture_maker_bottle(uuid) TO authenticated;

-- As 20261103520000, plus: the maker's team may picture its shared bottles
-- (drawing or photo; set_maker_bottle_picture refuses None).
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
    IF v_item.item_type = 'ingredient' AND v_item.bar_id IS NULL AND v_item.created_by IS NULL
       AND private.can_picture_maker_bottle(v_item.id) THEN
        RETURN NEW;
    END IF;
    IF v_item.item_type IS DISTINCT FROM 'ingredient' OR (v_item.bar_id IS NULL AND v_item.created_by IS NULL) THEN
        RAISE EXCEPTION 'Only a bar''s or a person''s own ingredient can have its own picture.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

-- As 20261103520000, plus a shared bottle's checked photo while its picture
-- is Photo. Waiting photos never show here (maker_bottle_photos has them).
CREATE OR REPLACE FUNCTION private.item_picture_url(p_item_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT im.url
  FROM public.items i
  JOIN public.item_images ii ON ii.item_id = i.id AND ii.is_picture
  JOIN public.images im ON im.id = ii.image_id
  WHERE i.id = p_item_id
    AND i.item_type = 'ingredient'
    AND CASE
      WHEN i.bar_id IS NOT NULL OR i.created_by IS NOT NULL THEN i.picture = 'photo' OR private.can_edit_item(i.id)
      ELSE i.picture = 'photo' AND ii.checked_at IS NOT NULL
    END
  LIMIT 1;
$$;

-- The team sets one of its bottles to its drawing or its photo. With an
-- image (an images row the app just uploaded for this bottle) it becomes the
-- photo, replacing the last one; checked at once if a moderator has checked
-- one of this maker's photos before, else waiting. Without one, Photo goes
-- back to the photo already there.
CREATE FUNCTION public.set_maker_bottle_picture(p_item_id uuid, p_picture public.item_picture, p_image_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_maker uuid;
    v_trusted boolean;
BEGIN
    IF NOT private.can_picture_maker_bottle(p_item_id) THEN
        RAISE EXCEPTION 'Only the maker''s own team can change this bottle''s picture.' USING ERRCODE = '42501';
    END IF;
    IF p_picture = 'none' THEN
        RAISE EXCEPTION 'A bottle shows its drawing or a photo.' USING ERRCODE = '22023';
    END IF;
    SELECT maker_profile_id INTO v_maker FROM public.items WHERE id = p_item_id;

    IF p_image_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.images im
            WHERE im.id = p_image_id AND NOT im.is_generated
              AND private.is_drinks_bucket_url(im.url)
              AND position('/storage/v1/object/public/drinks/ingredients/' || p_item_id::text || '/' IN im.url) > 0
        ) THEN
            RAISE EXCEPTION 'That photo wasn''t uploaded for this bottle.' USING ERRCODE = '22023';
        END IF;
        v_trusted := EXISTS (
            SELECT 1 FROM public.item_images ii
            JOIN public.items i ON i.id = ii.item_id
            WHERE ii.is_picture AND ii.checked_at IS NOT NULL
              AND i.maker_profile_id = v_maker AND i.bar_id IS NULL AND i.created_by IS NULL
        );
        DELETE FROM public.item_images WHERE item_id = p_item_id AND is_picture;
        INSERT INTO public.item_images (item_id, image_id, is_picture, checked_at)
        VALUES (p_item_id, p_image_id, true, CASE WHEN v_trusted THEN now() END);
    ELSIF p_picture = 'photo' AND NOT EXISTS (SELECT 1 FROM public.item_images WHERE item_id = p_item_id AND is_picture) THEN
        RAISE EXCEPTION 'Choose a photo first.' USING ERRCODE = '22023';
    END IF;

    UPDATE public.items SET picture = p_picture WHERE id = p_item_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_maker_bottle_picture(uuid, public.item_picture, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_maker_bottle_picture(uuid, public.item_picture, uuid) TO authenticated;

-- The team's photos on its bottles, waiting ones included. Nobody else gets
-- rows: a page's waiting photos are its team's and the moderators' business.
CREATE FUNCTION public.maker_bottle_photos(p_profile_id uuid)
RETURNS TABLE (item_id uuid, url text, checked boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT i.id, im.url, ii.checked_at IS NOT NULL
  FROM public.items i
  JOIN public.item_images ii ON ii.item_id = i.id AND ii.is_picture
  JOIN public.images im ON im.id = ii.image_id
  WHERE i.maker_profile_id = p_profile_id
    AND i.item_type = 'ingredient' AND i.bar_id IS NULL AND i.created_by IS NULL
    AND i.picture = 'photo'
    AND (private.on_maker_team(p_profile_id) OR private.is_app_admin());
$$;
REVOKE ALL ON FUNCTION public.maker_bottle_photos(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.maker_bottle_photos(uuid) TO authenticated;

-- Moderators: the photos waiting for a check, oldest first. Empty for
-- everyone else, so Settings can ask without knowing who's a moderator.
CREATE FUNCTION public.maker_photos_waiting()
RETURNS TABLE (item_id uuid, name text, maker_id uuid, maker_name text, maker_handle text, url text, added_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT i.id, i.name, p.id, p.display_name, p.handle, im.url, ii.created_at
  FROM public.item_images ii
  JOIN public.items i ON i.id = ii.item_id
  JOIN public.images im ON im.id = ii.image_id
  JOIN public.profiles p ON p.id = i.maker_profile_id
  WHERE ii.is_picture AND ii.checked_at IS NULL
    AND i.item_type = 'ingredient' AND i.bar_id IS NULL AND i.created_by IS NULL
    AND i.picture = 'photo'
    AND private.is_app_admin()
  ORDER BY ii.created_at
  LIMIT 200;
$$;
REVOKE ALL ON FUNCTION public.maker_photos_waiting() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.maker_photos_waiting() TO authenticated;

-- Moderators keep a waiting photo (it shows, and the maker's next photos
-- show at once) or take it off (the bottle goes back to its drawing).
CREATE FUNCTION public.check_maker_photo(p_item_id uuid, p_keep boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
    IF NOT private.is_app_admin() THEN
        RAISE EXCEPTION 'Only moderators check bottle photos.' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.items i
        WHERE i.id = p_item_id AND i.item_type = 'ingredient' AND i.bar_id IS NULL AND i.created_by IS NULL
    ) THEN
        RAISE EXCEPTION 'That isn''t a catalogue bottle.' USING ERRCODE = '22023';
    END IF;
    IF p_keep THEN
        UPDATE public.item_images SET checked_at = now() WHERE item_id = p_item_id AND is_picture AND checked_at IS NULL;
    ELSE
        DELETE FROM public.item_images WHERE item_id = p_item_id AND is_picture;
        UPDATE public.items SET picture = 'drawing' WHERE id = p_item_id;
    END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.check_maker_photo(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_maker_photo(uuid, boolean) TO authenticated;

-- As 20261103520000, with a shared bottle's picture read through: Photo once
-- its photo is checked (item_picture_url decides), else drawn. A shared item
-- never reads as None. Every function the view calls is granted to anon.
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
    c.price_minor,
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
