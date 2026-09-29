-- DRAFT (docs/publishing_moderation_proposal.md, section 3). Local stack only.
-- Not applied to production; needs Kevin's review first.
--
-- A home menu (no bar) can hold drinks the person collected from bars. They
-- can't read another bar's items row, only its published_items row, so
-- save_menu (which runs as the caller) raised "drink not found" for them.
-- For a menu with no bar it now also accepts a published drink. A venue's
-- menus are unchanged: still only drinks the caller can read. The home menu
-- shows such a drink through published_items, and a drink the bar stops
-- publishing drops out of it, like everywhere else.

CREATE OR REPLACE FUNCTION "public"."save_menu"(
    "p_menu_id" "uuid",
    "p_name" "text",
    "p_cover_url" "text",
    "p_cover_position" real,
    "p_sections" "jsonb"
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
  menu_bar uuid;
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

  DELETE FROM public.menu_drinks WHERE menu_id = p_menu_id;

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

    FOR item_id IN SELECT value::uuid FROM jsonb_array_elements_text(COALESCE(sec->'item_ids', '[]'::jsonb)) LOOP
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
      INSERT INTO public.menu_drinks (menu_id, menu_section_id, item_id, sort_order)
      VALUES (p_menu_id, sec_id, item_id, drink_index);
      drink_index := drink_index + 1;
    END LOOP;
    sec_index := sec_index + 1;
  END LOOP;

  DELETE FROM public.menu_sections WHERE menu_id = p_menu_id AND NOT (id = ANY (kept));
END;
$$;
