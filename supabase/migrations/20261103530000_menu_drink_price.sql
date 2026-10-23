-- A menu can print its own price for a drink (canvas "Every drink has one
-- price", steps 5 to 8, 23 Oct 2026). The drink keeps its one price
-- (items.price, 20261103100000_one_drink_price.sql); a menu line can carry
-- another, typed the same way ("22", "22.50", "MP"). Empty means the menu
-- prints the drink's price.
--
--   * menu_drinks.price: the menu's price for that drink, or NULL. Read and
--     written under menu_drinks' policies, so whoever can edit the menu can
--     set it and whoever can read the menu can read it.
--   * save_menu: a section may send `prices`, a list beside `item_ids`
--     ("22" or null for each). With it, each drink's row takes that price
--     (blank is NULL). Without it (app versions from before this change),
--     a row that stays keeps its price and a new row has none.
--   * get_menu_editions (the bar page's Menus) prints the menu's price,
--     else the drink's.

-- --- The column ---

ALTER TABLE "public"."menu_drinks" ADD COLUMN "price" "text";
ALTER TABLE "public"."menu_drinks" ADD CONSTRAINT "menu_drinks_price_check"
    CHECK ("price" IS NULL OR (char_length("price") BETWEEN 1 AND 40 AND "price" = btrim("price")));

COMMENT ON COLUMN "public"."menu_drinks"."price" IS 'This menu''s price for the drink, as typed; NULL prints the drink''s own (items.price).';

-- --- save_menu: as 20261016900000_menu_run_sheets.sql, plus prices ---

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

-- --- get_menu_editions: as 20261024200000_page_visibility_ladder.sql, the menu's price first ---

CREATE OR REPLACE FUNCTION public.get_menu_editions(p_profile_id uuid)
 RETURNS TABLE(id uuid, name text, year smallint, month smallint, end_year smallint, end_month smallint, is_current boolean, theme text, source_url text, drinks jsonb, from_venue boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
    WITH shown AS (
        SELECT p.id, p.kind, p.bar_id
        FROM public.profiles p
        WHERE p.id = p_profile_id
          -- A Private page's menus are its team's.
          AND p.id NOT IN (SELECT private.private_page_profile_ids())
          AND (
              (
                  p.is_public AND p.moderated_at IS NULL
                  AND (
                      auth.uid() IS NULL
                      OR p.user_id IS NULL
                      OR p.user_id = auth.uid()
                      OR p.user_id NOT IN (SELECT private.blocked_user_ids())
                  )
              )
              OR (
                  auth.uid() IS NOT NULL
                  AND (
                      p.user_id = auth.uid()
                      OR p.bar_id IN (SELECT private.my_bar_ids(0))
                      OR private.is_app_admin()
                  )
              )
          )
    ), venue AS (
        -- A started menu's dates, in UTC. It ran up to the moment before ends_at.
        SELECT m.id, m.name, m.description, m.bar_id,
            m.ends_at IS NOT NULL AND m.ends_at <= now() AS ended,
            m.starts_at AT TIME ZONE 'UTC' AS started_on,
            (m.ends_at - interval '1 microsecond') AT TIME ZONE 'UTC' AS ended_on
        FROM public.menus m
        JOIN shown s ON s.kind = 'bar' AND s.bar_id IS NOT NULL AND m.bar_id = s.bar_id
        WHERE m.kind = 'menu'
          AND m.starts_at IS NOT NULL
          AND m.starts_at <= now()
    ), rows AS (
        SELECT e.id, e.name, e.year, e.month, e.end_year, e.end_month, e.is_current, e.theme, e.source_url,
            COALESCE((
                SELECT jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name) ORDER BY d.sort_order)
                FROM public.profile_menu_edition_drinks d
                JOIN public.items i ON i.id = d.item_id AND i.moderated_at IS NULL
                WHERE d.edition_id = e.id
            ), '[]'::jsonb) AS drinks,
            false AS from_venue
        FROM public.profile_menu_editions e
        JOIN shown s ON s.id = e.profile_id
        UNION ALL
        SELECT v.id, v.name,
            extract(year FROM v.started_on)::smallint,
            extract(month FROM v.started_on)::smallint,
            CASE WHEN v.ended THEN extract(year FROM v.ended_on)::smallint END,
            CASE WHEN v.ended THEN extract(month FROM v.ended_on)::smallint END,
            NOT v.ended,
            v.description,
            NULL::text,
            COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object('id', i.id, 'name', i.name, 'price', COALESCE(md.price, NULLIF(btrim(i.price), '')), 'section', ms.name)
                    ORDER BY ms.sort_order NULLS LAST, md.sort_order, md.id
                )
                FROM public.menu_drinks md
                JOIN public.items i ON i.id = md.item_id AND i.moderated_at IS NULL
                    AND (i.bar_id = v.bar_id OR (i.bar_id IS NULL AND i.created_by IS NULL))
                LEFT JOIN public.menu_sections ms ON ms.id = md.menu_section_id
                WHERE md.menu_id = v.id
            ), '[]'::jsonb),
            true
        FROM venue v
    )
    SELECT * FROM rows
    ORDER BY year DESC, month DESC NULLS LAST, name
    LIMIT 200;
$function$;
