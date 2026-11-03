-- Guests see the drawings of the drinks on a bar's menu.
--
-- A guest (signed out, or signed in and not on the bar's team) reads a bar's
-- menus through get_menu_editions: every venue menu that has started and
-- isn't hidden, on a page they may see, with the drinks that are on it. A
-- drink the bar hasn't published as an item is listed by name, but its
-- drawing (item_sketches) stayed unreadable: anon reads only listed drinks'
-- drawings (is_card_public, 20261009300000) and signed-in users only drinks
-- they may read in items.
--
-- New: item_sketches_select_on_menu lets anon and authenticated read the
-- drawing of a drink on a menu that get_menu_editions would show them: the
-- same menu, drink and page checks. That includes a menu that has ended (the
-- board draws a past menu's drawings, faded, for guests). Not a draft or a
-- menu yet to start, a hidden menu, a drink waiting to go on or planned for
-- later, a moderated drink, another bar's drink, or a Private or moderated
-- page.
--
-- Only the drawing row: anon keeps its column grant (item_id, inputs). No
-- other table or column, and item_sketches stays unwritable by clients.
--
-- The check is SECURITY DEFINER because guests can't read menus or
-- menu_drinks (their policies are the team's), and in public because anon
-- has no USAGE on private, as is_card_public. Each lookup is by
-- menu_drinks.item_id (indexed), then menus and profiles by key.

CREATE FUNCTION "public"."is_on_shown_menu"("p_item_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.menu_drinks md
    JOIN public.menus m ON m.id = md.menu_id
    JOIN public.items i ON i.id = md.item_id
    WHERE md.item_id = p_item_id
      AND md.waiting IS DISTINCT FROM 'on'
      AND (md.on_from IS NULL OR md.on_from <= now())
      AND m.kind = 'menu'
      AND m.starts_at IS NOT NULL
      AND m.starts_at <= now()
      AND m.hidden_at IS NULL
      AND m.bar_id IS NOT NULL
      AND i.moderated_at IS NULL
      AND (i.bar_id = m.bar_id OR (i.bar_id IS NULL AND i.created_by IS NULL))
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.kind = 'bar' AND p.bar_id = m.bar_id AND private.menu_page_shown(p.id)
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION "public"."is_on_shown_menu"("uuid") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."is_on_shown_menu"("uuid") TO "anon", "authenticated", "service_role";

CREATE POLICY "item_sketches_select_on_menu" ON "public"."item_sketches" FOR SELECT TO "anon", "authenticated"
    USING ("public"."is_on_shown_menu"("item_id"));
