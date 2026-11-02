-- save_menu writes the cover's credit with the cover (Kevin, 1 Nov 2026), so
-- one save writes the name, cover, credit and layout in one transaction. The
-- editor used to write menus.cover_credit (20261205920000) in a second call
-- after save_menu, and a failed second call left the cover without its credit.
--
--   * p_cover_credit: the credit as typed ("Jess Rowe"); '' for none; NULL
--     (the default, and what apps from before this send) leaves it as it is,
--     so a new cover still drops the old credit, as the trigger does.
--   * Everything else as 20261103530000_menu_drink_price.sql: runs as the
--     caller, so menus' policies decide who may save; search_path ''.
--
-- A new argument is a new signature, so the five-argument function is
-- dropped and made again with the same grants.

DROP FUNCTION "public"."save_menu"("uuid", "text", "text", real, "jsonb");

CREATE FUNCTION "public"."save_menu"(
    "p_menu_id" "uuid",
    "p_name" "text",
    "p_cover_url" "text",
    "p_cover_position" real,
    "p_sections" "jsonb",
    "p_cover_credit" "text" DEFAULT NULL
) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  sec jsonb;
  sec_id uuid;
  sec_index integer := 0;
  drink_index integer := 0;
  item_id uuid;
  item_kind text;
  types text[];
  kept uuid[] := '{}';
  kept_drinks uuid[] := '{}';
  row_id uuid;
  this_item uuid;
  menu_bar uuid;
  has_prices boolean;
  item_ord bigint;
  menu_price text;
BEGIN
  IF jsonb_typeof(p_sections) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'sections must be a list' USING ERRCODE = '22023';
  END IF;

  UPDATE public.menus
  SET name = btrim(p_name), cover_url = p_cover_url, cover_position = COALESCE(p_cover_position, 50)
  WHERE id = p_menu_id
  RETURNING bar_id INTO menu_bar;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'menu not found or not yours to edit' USING ERRCODE = '42501';
  END IF;

  -- The cover's credit, after the cover: a new cover has just dropped the old
  -- credit (private.menu_cover_credit), and a credit sent here is the new
  -- photo's, even when it reads the same as the old one.
  IF p_cover_credit IS NOT NULL THEN
    UPDATE public.menus SET cover_credit = NULLIF(btrim(p_cover_credit), '') WHERE id = p_menu_id;
  END IF;

  FOR sec IN SELECT value FROM jsonb_array_elements(p_sections) LOOP
    types := COALESCE(
      (SELECT array_agg(t) FROM jsonb_array_elements_text(sec->'allowed_types') t),
      ARRAY['cocktail', 'beer', 'wine']
    );
    sec_id := NULLIF(sec->>'id', '')::uuid;
    IF sec_id IS NOT NULL THEN
      UPDATE public.menu_sections
      SET name = btrim(sec->>'name'),
          sort_order = sec_index,
          min_items = COALESCE((sec->>'min_items')::integer, 1),
          max_items = (sec->>'max_items')::integer,
          allowed_types = types
      WHERE id = sec_id AND menu_id = p_menu_id;
      IF NOT FOUND THEN
        sec_id := NULL;
      END IF;
    END IF;
    IF sec_id IS NULL THEN
      INSERT INTO public.menu_sections (menu_id, name, sort_order, min_items, max_items, allowed_types)
      VALUES (p_menu_id, btrim(sec->>'name'), sec_index, COALESCE((sec->>'min_items')::integer, 1),
              (sec->>'max_items')::integer, types)
      RETURNING id INTO sec_id;
    END IF;
    kept := kept || sec_id;
    -- This menu's prices, one for each of item_ids, when the app sends them.
    has_prices := jsonb_typeof(sec->'prices') = 'array';

    FOR item_id, item_ord IN SELECT value::uuid, ordinality FROM jsonb_array_elements_text(COALESCE(sec->'item_ids', '[]'::jsonb)) WITH ORDINALITY LOOP
      SELECT i.item_type::text INTO item_kind FROM public.items i WHERE i.id = item_id;
      IF item_kind IS NULL AND menu_bar IS NULL THEN
        SELECT p.item_type::text INTO item_kind FROM public.published_items p WHERE p.id = item_id AND NOT p.is_reference;
      END IF;
      IF item_kind IS NULL THEN
        RAISE EXCEPTION 'drink % not found', item_id USING ERRCODE = '22023';
      END IF;
      IF NOT item_kind = ANY (types) THEN
        RAISE EXCEPTION '% is not allowed in section %', item_kind, sec->>'name' USING ERRCODE = '22023';
      END IF;
      menu_price := CASE WHEN has_prices THEN NULLIF(btrim(sec->'prices'->>(item_ord - 1)::integer), '') END;
      -- The drink's row from before the save, if it's still on the menu: its
      -- serves, run sheet swaps and (with no prices sent) price stay with it.
      this_item := item_id;
      SELECT md.id INTO row_id FROM public.menu_drinks md
      WHERE md.menu_id = p_menu_id AND md.item_id = this_item AND NOT (md.id = ANY (kept_drinks))
      ORDER BY md.sort_order, md.id
      LIMIT 1;
      IF row_id IS NOT NULL THEN
        UPDATE public.menu_drinks
        SET menu_section_id = sec_id, sort_order = drink_index,
            price = CASE WHEN has_prices THEN menu_price ELSE price END
        WHERE id = row_id;
      ELSE
        INSERT INTO public.menu_drinks (menu_id, menu_section_id, item_id, sort_order, price)
        VALUES (p_menu_id, sec_id, item_id, drink_index, menu_price)
        RETURNING id INTO row_id;
      END IF;
      kept_drinks := kept_drinks || row_id;
      drink_index := drink_index + 1;
    END LOOP;
    sec_index := sec_index + 1;
  END LOOP;

  DELETE FROM public.menu_drinks WHERE menu_id = p_menu_id AND NOT (id = ANY (kept_drinks));
  DELETE FROM public.menu_sections WHERE menu_id = p_menu_id AND NOT (id = ANY (kept));
END;
$$;

REVOKE EXECUTE ON FUNCTION "public"."save_menu"("uuid", "text", "text", real, "jsonb", "text") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."save_menu"("uuid", "text", "text", real, "jsonb", "text") TO "authenticated", "service_role";
