-- Calendars, part D of This week: a venue's calendar settings and a review
-- step for what its calendars bring in. Design: "Next: Calendars in venue
-- settings" and "Next: review synced events" on the This week page of
-- https://claude.ai/artifact/KRE17t8L8SC8f4M4KFLgZe.
--
--   events.reviewed_at     when someone on the team looked at an event. Events
--                          people add are reviewed as they're made; events a
--                          calendar brings in arrive unreviewed (and Team only,
--                          since 20261012610000's sync change) and wait on
--                          "N new from your calendars".
--   events.duplicate_of    an imported event that matches one the team already
--                          added ("Pale Moth x LR" and "Pale Moth × Little
--                          Rye"). Left out of the week; Undo clears it, Remove
--                          deletes the import and skips it from then on.
--   venue_calendar_settings
--                          a venue's team-only words: imported events whose
--                          names hold one stay with the team.
--
-- bar_week is as 20261012600000, plus: duplicates are left out.

-- --- Events ---

ALTER TABLE "public"."events"
    ADD COLUMN "reviewed_at" timestamp with time zone DEFAULT "now"(),
    ADD COLUMN "duplicate_of" "uuid" REFERENCES "public"."events"("id") ON DELETE CASCADE,
    ADD CONSTRAINT "events_duplicate_check" CHECK ("duplicate_of" IS NULL OR ("source_id" IS NOT NULL AND "duplicate_of" <> "id"));

-- Everything already here was added by people or seen on the week.
UPDATE "public"."events" SET "reviewed_at" = "created_at" WHERE "reviewed_at" IS NULL;

CREATE INDEX "events_unreviewed_idx" ON "public"."events" ("bar_id", "starts_at") WHERE "reviewed_at" IS NULL;
CREATE INDEX "events_duplicate_of_idx" ON "public"."events" ("duplicate_of") WHERE "duplicate_of" IS NOT NULL;

-- --- Team-only words ---

CREATE TABLE "public"."venue_calendar_settings" (
    "bar_id" "uuid" PRIMARY KEY REFERENCES "public"."bars"("id") ON DELETE CASCADE,
    "team_words" "text"[] DEFAULT '{staff,team,training,clean,delivery,stocktake,inventory,meeting,rota,interview}'::"text"[] NOT NULL
        CHECK (cardinality("team_words") <= 40),
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."venue_calendar_settings" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "venue_calendar_settings_select" ON "public"."venue_calendar_settings" FOR SELECT TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."bars_with_capability"('menus')));
CREATE POLICY "venue_calendar_settings_insert" ON "public"."venue_calendar_settings" FOR INSERT TO "authenticated"
    WITH CHECK ("bar_id" IN (SELECT "private"."bars_with_capability"('menus')));
CREATE POLICY "venue_calendar_settings_update" ON "public"."venue_calendar_settings" FOR UPDATE TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."bars_with_capability"('menus')))
    WITH CHECK ("bar_id" IN (SELECT "private"."bars_with_capability"('menus')));

REVOKE ALL ON "public"."venue_calendar_settings" FROM "anon";
REVOKE DELETE, TRUNCATE, TRIGGER, REFERENCES ON "public"."venue_calendar_settings" FROM "authenticated";

-- Each word one to forty characters, kept lower case and trimmed.
CREATE FUNCTION "private"."clean_team_words"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    NEW.team_words := ARRAY(
        SELECT DISTINCT lower(btrim(w)) FROM unnest(NEW.team_words) w
        WHERE char_length(btrim(w)) BETWEEN 1 AND 40
        ORDER BY 1
    );
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER "clean_team_words" BEFORE INSERT OR UPDATE ON "public"."venue_calendar_settings"
    FOR EACH ROW EXECUTE FUNCTION "private"."clean_team_words"();

REVOKE EXECUTE ON FUNCTION "private"."clean_team_words"() FROM PUBLIC, "anon", "authenticated";

-- --- The week leaves duplicates out ---

CREATE OR REPLACE FUNCTION "public"."bar_week"("p_bar_id" "uuid", "p_from" timestamp with time zone, "p_days" integer DEFAULT 7)
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
    AND e.duplicate_of IS NULL
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

