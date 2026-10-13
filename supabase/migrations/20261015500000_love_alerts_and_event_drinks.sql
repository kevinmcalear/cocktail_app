-- Three pieces of the This week page of the whole-app canvas
-- (https://claude.ai/artifact/KRE17t8L8SC8f4M4KFLgZe):
--
--   loved_bars.alerts     Loving a bar asks what it may tell you about
--                         (board week-love-alerts): everything, events only,
--                         menus and drinks only, or no alerts. The bar stays
--                         in This week and Collection whatever you pick. The
--                         one change a person makes to their own love row,
--                         so UPDATE is opened for that column only.
--   week_event_drinks()   An event page's "On the takeover menu" (board
--                         week-event-guest): the drinks on the event's menu,
--                         for whoever may open the event. Guests read only
--                         published drinks, through week_event's own rule, so
--                         nothing here widens what a guest sees of a bar.
--   week_event_brand()    The look an event page wears (board
--                         week-event-guest): the host bar's accent, display
--                         face and ground tint, and the guest bar's on a
--                         takeover (from the guest's public bar page). Only
--                         for an event week_event opens to the caller, and
--                         only what a bar's public page already shows.

-- --- What a loved bar may tell you about ---

ALTER TABLE "public"."loved_bars"
    ADD COLUMN "alerts" "text" DEFAULT 'everything' NOT NULL
        CHECK ("alerts" IN ('everything', 'events', 'menus', 'none'));

-- Your own row, and only its alerts: the bar and the user never change.
REVOKE UPDATE ON TABLE "public"."loved_bars" FROM "anon", "authenticated";
GRANT UPDATE ("alerts") ON TABLE "public"."loved_bars" TO "authenticated";

CREATE POLICY "loved_bars_update_own" ON "public"."loved_bars"
    FOR UPDATE TO "authenticated"
    USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")))
    WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));

-- --- The drinks on an event's menu ---

-- Members of the bar read every drink on the event's menu; everyone else
-- reads the published ones, and only of an event week_event opens for them
-- (a public event at a bar with a public page). Menu order.
CREATE FUNCTION "public"."week_event_drinks"("p_event_id" "uuid")
    RETURNS TABLE (
        "id" "uuid",
        "name" "text",
        "description" "text",
        "image_url" "text",
        "glass_key" "text"
    )
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT i.id, i.name, i.description, img.url, g.icon_key
  FROM public.week_event(p_event_id) wk
  JOIN public.menu_drinks md ON md.menu_id = wk.menu_id
  JOIN public.items i ON i.id = md.item_id
  LEFT JOIN public.items g ON g.id = i.glassware_id
  LEFT JOIN LATERAL (
    SELECT im.url FROM public.item_images ii JOIN public.images im ON im.id = ii.image_id
    WHERE ii.item_id = i.id
    ORDER BY (ii.angle = 'hero') DESC, ii.sort_order, ii.created_at
    LIMIT 1
  ) img ON true
  WHERE i.item_type = 'cocktail'
    AND i.moderated_at IS NULL
    AND (
      wk.bar_id IN (SELECT private.my_bar_ids(0))
      OR i.id IN (SELECT pi.id FROM public.published_items pi)
    )
  ORDER BY md.sort_order NULLS LAST, md.created_at
  LIMIT 50;
$$;

REVOKE EXECUTE ON FUNCTION "public"."week_event_drinks"("uuid") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."week_event_drinks"("uuid") TO "anon", "authenticated", "service_role";

-- --- The look an event page wears ---

-- The host's brand, and the guest bar's when the guest is a bar with a public
-- page. bars is members only under RLS, so this reads it as the definer, for
-- an event the caller may open (week_event) and nothing more.
CREATE FUNCTION "public"."week_event_brand"("p_event_id" "uuid")
    RETURNS TABLE (
        "host_accent" "text",
        "host_face" "text",
        "host_tint" "text",
        "guest_accent" "text",
        "guest_face" "text",
        "guest_tint" "text"
    )
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT hb.primary_color, hb.display_face::text, hb.ground_tint,
         gb.primary_color, gb.display_face::text, gb.ground_tint
  FROM public.week_event(p_event_id) wk
  JOIN public.events e ON e.id = wk.id
  JOIN public.bars hb ON hb.id = e.bar_id
  LEFT JOIN public.profiles gp ON gp.id = e.guest_profile_id AND gp.kind = 'bar' AND gp.is_public AND gp.moderated_at IS NULL
  LEFT JOIN public.bars gb ON gb.id = gp.bar_id
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION "public"."week_event_brand"("uuid") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."week_event_brand"("uuid") TO "anon", "authenticated", "service_role";
