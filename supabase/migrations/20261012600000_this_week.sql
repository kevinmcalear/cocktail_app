-- This week: what's on at a bar over the next seven days, for its team, its
-- guests and the people who love it. Design: the "This week" page of
-- https://claude.ai/artifact/KRE17t8L8SC8f4M4KFLgZe (option B of
-- https://claude.ai/artifact/PC3E6CuH7JStjPHN71yKeS).
--
-- The week is built from three things a bar already does, read together:
--   events        a takeover, guest shift, tasting or launch. Events were
--                 members-only (20260926150500); they gain a kind, a
--                 public switch, a public description, a ticket link, a
--                 guest by name and whether the house menu is still on.
--   menus         a menu going on (starts_at in the week).
--   drinks        cocktails added (members) or published (everyone) in the
--                 seven days before the week starts and during it.
-- At home the week is the bars someone loves, plus their own dated home
-- menus.
--
-- Reads go through three SECURITY DEFINER functions, so guests and signed-out
-- visitors see only the public columns of public things:
--   bar_week(bar, from, days)   members: everything; others: public events,
--                               published menus and published drinks, and
--                               only when the bar has a public page.
--   my_week(from, days)         loved bars' public weeks plus own home menus.
--   week_event(id)              one event, with the same rule as bar_week.
-- The events table keeps its member policies; nothing here widens them.
--
-- Public event text goes through the content filter (20260930600000), like
-- releases: name and description, once the event is public.

-- --- Events ---

ALTER TABLE "public"."events"
    -- takeover, guest_shift, tasting, launch, private, other
    ADD COLUMN "kind" "text" DEFAULT 'other' NOT NULL
        CHECK ("kind" IN ('takeover', 'guest_shift', 'tasting', 'launch', 'private', 'other')),
    -- Team only until someone opens it up.
    ADD COLUMN "is_public" boolean DEFAULT false NOT NULL,
    -- Guests asked: is the usual menu still there during a takeover?
    ADD COLUMN "house_menu_on" boolean DEFAULT true NOT NULL,
    -- What guests read. notes stays the team's.
    ADD COLUMN "description" "text" CHECK (char_length("description") <= 500),
    -- Resy, Eventbrite, Luma or any page; https only.
    ADD COLUMN "ticket_url" "text" CHECK ("ticket_url" ~ '^https://[^\s]+$' AND char_length("ticket_url") <= 500),
    -- A guest who isn't a bar page here: "Mara Q. from The Lantern Room".
    ADD COLUMN "guest_name" "text" CHECK (char_length(btrim("guest_name")) BETWEEN 1 AND 120);

-- Private events never go public.
ALTER TABLE "public"."events"
    ADD CONSTRAINT "events_private_kind_check" CHECK (NOT ("kind" = 'private' AND "is_public"));

CREATE INDEX "events_public_starts_at_idx" ON "public"."events" ("bar_id", "starts_at") WHERE "is_public";

CREATE FUNCTION "private"."screen_event_text"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_all boolean;
BEGIN
    IF NOT NEW.is_public THEN
        RETURN NEW;
    END IF;
    v_all := TG_OP = 'INSERT' OR NOT OLD.is_public;
    IF v_all OR NEW.name IS DISTINCT FROM OLD.name THEN
        PERFORM private.refuse_screened(NEW.name, 'name', 'name');
    END IF;
    IF v_all OR NEW.description IS DISTINCT FROM OLD.description THEN
        PERFORM private.refuse_screened(NEW.description, 'description', 'description');
    END IF;
    IF v_all OR NEW.guest_name IS DISTINCT FROM OLD.guest_name THEN
        PERFORM private.refuse_screened(NEW.guest_name, 'guest', 'guest_name');
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "screen_text" BEFORE INSERT OR UPDATE OF "name", "description", "guest_name", "is_public" ON "public"."events"
    FOR EACH ROW EXECUTE FUNCTION "private"."screen_event_text"();

REVOKE EXECUTE ON FUNCTION "private"."screen_event_text"() FROM PUBLIC, "anon", "authenticated";

-- --- The week ---

-- The bar's public page, when it has one that isn't taken down.
CREATE FUNCTION "private"."public_bar_profile"("p_bar_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT p.id FROM public.profiles p
  WHERE p.bar_id = p_bar_id AND p.kind = 'bar' AND p.is_public AND p.moderated_at IS NULL
  ORDER BY p.created_at
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION "private"."public_bar_profile"("uuid") FROM PUBLIC, "anon", "authenticated";

-- One row per thing in the week. kind: event, menu, drink or home_menu.
-- Events overlapping [from, from + days); menus starting in it; drinks from
-- seven days before it. Members see team-only events, unpublished menus and
-- every cocktail they may read; everyone else the public ones, and nothing at
-- all for a bar without a public page.
CREATE FUNCTION "public"."bar_week"("p_bar_id" "uuid", "p_from" timestamp with time zone, "p_days" integer DEFAULT 7)
    RETURNS TABLE (
        "kind" "text",
        "id" "uuid",
        "bar_id" "uuid",
        "bar_profile_id" "uuid",
        "bar_name" "text",
        "bar_color" "text",
        "starts_at" timestamp with time zone,
        "ends_at" timestamp with time zone,
        "name" "text",
        "event_kind" "text",
        "is_public" boolean,
        "house_menu_on" boolean,
        "description" "text",
        "ticket_url" "text",
        "guest_profile_id" "uuid",
        "guest_name" "text",
        "menu_id" "uuid",
        "drink_count" integer,
        "image_url" "text",
        "glass_key" "text",
        "guest_count" integer
    )
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  WITH w AS (
    SELECT p_from AS f,
           p_from + make_interval(days => LEAST(GREATEST(COALESCE(p_days, 7), 1), 31)) AS t,
           p_from - interval '7 days' AS since,
           p_bar_id IN (SELECT private.my_bar_ids(0)) AS member,
           private.public_bar_profile(p_bar_id) AS profile_id
  ),
  b AS (
    SELECT bars.id, COALESCE(bars.short_name, bars.name) AS name, bars.primary_color FROM public.bars WHERE bars.id = p_bar_id
  )
  SELECT 'event'::"text", e.id, e.bar_id, w.profile_id, b.name, b.primary_color,
         e.starts_at, e.ends_at, e.name, e.kind, e.is_public, e.house_menu_on, e.description, e.ticket_url,
         e.guest_profile_id, COALESCE(e.guest_name, gp.display_name), e.menu_id,
         (SELECT count(*)::integer FROM public.menu_drinks md WHERE md.menu_id = e.menu_id),
         NULL::"text", NULL::"text", NULL::integer
  FROM public.events e
  CROSS JOIN w CROSS JOIN b
  LEFT JOIN public.profiles gp ON gp.id = e.guest_profile_id AND gp.is_public AND gp.moderated_at IS NULL
  WHERE e.bar_id = p_bar_id
    AND e.starts_at < w.t
    AND COALESCE(e.ends_at, e.starts_at + interval '6 hours') > w.f
    AND (w.member OR (e.is_public AND w.profile_id IS NOT NULL))
  UNION ALL
  SELECT 'menu', m.id, m.bar_id, w.profile_id, b.name, b.primary_color,
         m.starts_at, m.ends_at, m.name, NULL::"text", m.publish_mode IS NOT NULL, NULL::boolean, NULL::"text", NULL::"text",
         NULL::"uuid", NULL::"text", m.id,
         (SELECT count(*)::integer FROM public.menu_drinks md WHERE md.menu_id = m.id),
         NULL::"text", NULL::"text", NULL::integer
  FROM public.menus m
  CROSS JOIN w CROSS JOIN b
  WHERE m.bar_id = p_bar_id
    AND m.starts_at >= w.f AND m.starts_at < w.t
    AND (w.member OR (m.publish_mode IS NOT NULL AND w.profile_id IS NOT NULL))
  UNION ALL
  SELECT 'drink', i.id, i.bar_id, w.profile_id, b.name, b.primary_color,
         COALESCE(CASE WHEN w.member THEN i.created_at END, i.published_at), NULL::timestamp with time zone, i.name, NULL::"text",
         i.publish_mode <> 'private', NULL::boolean, NULL::"text", NULL::"text",
         NULL::"uuid", NULL::"text", NULL::"uuid", NULL::integer,
         img.url, g.icon_key, NULL::integer
  FROM public.items i
  CROSS JOIN w CROSS JOIN b
  LEFT JOIN public.items g ON g.id = i.glassware_id
  LEFT JOIN LATERAL (
    SELECT im.url FROM public.item_images ii JOIN public.images im ON im.id = ii.image_id
    WHERE ii.item_id = i.id
    ORDER BY (ii.angle = 'hero') DESC, ii.sort_order, ii.created_at
    LIMIT 1
  ) img ON true
  WHERE i.bar_id = p_bar_id
    AND i.item_type = 'cocktail'
    AND i.moderated_at IS NULL
    AND (
      (w.member AND i.created_at >= w.since AND i.created_at < w.t
        AND private.can_view_bar_item(i.bar_id, i.override_visibility_level))
      OR (NOT w.member AND w.profile_id IS NOT NULL
        AND i.published_at >= w.since AND i.published_at < w.t
        AND i.id IN (SELECT pi.id FROM public.published_items pi WHERE pi.bar_id = p_bar_id AND pi.published_at >= w.since))
    )
  ORDER BY 7
  LIMIT 200;
$$;

-- The week at home: the public part of the weeks of the bars someone loves
-- (team-only events stay at work, even for staff), plus their own home menus.
-- A home menu has a date, not a time: it comes back at noon UTC on that date,
-- from a day either side of the window, and the app keeps the local days it
-- wants.
CREATE FUNCTION "public"."my_week"("p_from" timestamp with time zone, "p_days" integer DEFAULT 7)
    RETURNS TABLE (
        "kind" "text",
        "id" "uuid",
        "bar_id" "uuid",
        "bar_profile_id" "uuid",
        "bar_name" "text",
        "bar_color" "text",
        "starts_at" timestamp with time zone,
        "ends_at" timestamp with time zone,
        "name" "text",
        "event_kind" "text",
        "is_public" boolean,
        "house_menu_on" boolean,
        "description" "text",
        "ticket_url" "text",
        "guest_profile_id" "uuid",
        "guest_name" "text",
        "menu_id" "uuid",
        "drink_count" integer,
        "image_url" "text",
        "glass_key" "text",
        "guest_count" integer
    )
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT wk.*
  FROM (
    SELECT DISTINCT p.bar_id
    FROM public.loved_bars lb
    JOIN public.profiles p ON p.id = lb.profile_id AND p.kind = 'bar' AND p.bar_id IS NOT NULL
    WHERE lb.user_id = auth.uid()
    LIMIT 50
  ) lb
  CROSS JOIN LATERAL public.bar_week(lb.bar_id, p_from, p_days) wk
  WHERE wk.is_public
  UNION ALL
  SELECT 'home_menu'::"text", m.id, NULL::"uuid", NULL::"uuid", NULL::"text", NULL::"text",
         ((m.menu_date + time '12:00') AT TIME ZONE 'UTC'), NULL::timestamp with time zone, m.name, NULL::"text", false, NULL::boolean, NULL::"text", NULL::"text",
         NULL::"uuid", NULL::"text", m.id,
         (SELECT count(*)::integer FROM public.menu_drinks md WHERE md.menu_id = m.id),
         NULL::"text", NULL::"text", m.guest_count
  FROM public.menus m
  WHERE m.bar_id IS NULL
    AND m.created_by = auth.uid()
    AND m.menu_date >= (p_from AT TIME ZONE 'UTC')::date - 1
    AND m.menu_date <= ((p_from AT TIME ZONE 'UTC') + make_interval(days => LEAST(GREATEST(COALESCE(p_days, 7), 1), 31)))::date + 1
  ORDER BY 7
  LIMIT 300;
$$;

-- One event, for its page: what bar_week would show of it.
CREATE FUNCTION "public"."week_event"("p_event_id" "uuid")
    RETURNS TABLE (
        "kind" "text",
        "id" "uuid",
        "bar_id" "uuid",
        "bar_profile_id" "uuid",
        "bar_name" "text",
        "bar_color" "text",
        "starts_at" timestamp with time zone,
        "ends_at" timestamp with time zone,
        "name" "text",
        "event_kind" "text",
        "is_public" boolean,
        "house_menu_on" boolean,
        "description" "text",
        "ticket_url" "text",
        "guest_profile_id" "uuid",
        "guest_name" "text",
        "menu_id" "uuid",
        "drink_count" integer,
        "image_url" "text",
        "glass_key" "text",
        "guest_count" integer
    )
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT wk.*
  FROM public.events e
  CROSS JOIN LATERAL public.bar_week(e.bar_id, e.starts_at, 1) wk
  WHERE e.id = p_event_id AND wk.kind = 'event' AND wk.id = e.id;
$$;

REVOKE EXECUTE ON FUNCTION "public"."bar_week"("uuid", timestamp with time zone, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION "public"."my_week"(timestamp with time zone, integer) FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "public"."week_event"("uuid") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."bar_week"("uuid", timestamp with time zone, integer) TO "anon", "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."my_week"(timestamp with time zone, integer) TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."week_event"("uuid") TO "anon", "authenticated", "service_role";
