-- Menus own their sections, and carry the dates they run.
--
-- Before: sections lived on menu_templates, shared by every menu using the
-- template, and switching a menu's template silently dropped the drinks in
-- sections the new template didn't have. A menu was either current
-- (is_active) or not, with no dates, so "previous menus" had nothing to show.
--
-- After:
--   * menu_sections belong to one menu. Templates become layouts you copy
--     from. menu_drinks point at a menu section.
--   * menus.starts_at / menus.ends_at say when a menu is on. No dates is a
--     draft, a future start is coming up, a past end is previous.
--   * is_active stays, kept in step with the dates, so every screen that
--     still reads it keeps working. Legacy screens that toggle it move the
--     dates instead.
--   * save_menu() and schedule_menu() write a menu's layout, and put a menu
--     on (optionally replacing others), in one transaction each.

-- --- Sections ---

CREATE TABLE "public"."menu_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "menu_id" "uuid" NOT NULL REFERENCES "public"."menus"("id") ON DELETE CASCADE,
    "name" "text" NOT NULL CHECK (char_length(btrim("name")) BETWEEN 1 AND 80),
    "sort_order" integer DEFAULT 0 NOT NULL,
    "min_items" integer DEFAULT 1 NOT NULL CHECK ("min_items" >= 0),
    "max_items" integer,
    "allowed_types" "text"[] DEFAULT ARRAY['cocktail'::"text", 'beer'::"text", 'wine'::"text"] NOT NULL,
    -- The template section this was copied from, so legacy writes that still
    -- name a template section land in the right place.
    "template_section_id" "uuid" REFERENCES "public"."template_sections"("id") ON DELETE SET NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "menu_sections_max_check" CHECK ("max_items" IS NULL OR "max_items" >= GREATEST("min_items", 1)),
    CONSTRAINT "menu_sections_types_check" CHECK (
        cardinality("allowed_types") >= 1 AND "allowed_types" <@ ARRAY['cocktail'::"text", 'beer'::"text", 'wine'::"text"]
    ),
    CONSTRAINT "menu_sections_template_unique" UNIQUE ("menu_id", "template_section_id")
);

CREATE INDEX "menu_sections_menu_id_idx" ON "public"."menu_sections" ("menu_id", "sort_order");
CREATE INDEX "menu_sections_template_section_id_idx" ON "public"."menu_sections" ("template_section_id");

ALTER TABLE "public"."menu_drinks"
    ADD COLUMN "menu_section_id" "uuid" REFERENCES "public"."menu_sections"("id") ON DELETE CASCADE;
CREATE INDEX "menu_drinks_menu_section_id_idx" ON "public"."menu_drinks" ("menu_section_id");

ALTER TABLE "public"."menu_sections" ENABLE ROW LEVEL SECURITY;

-- Same model as menu_drinks: readable with the menu, written by its editors.
CREATE POLICY "menu_sections_select" ON "public"."menu_sections" FOR SELECT TO "authenticated"
    USING ("menu_id" IN (SELECT "id" FROM "public"."menus"));
CREATE POLICY "menu_sections_insert" ON "public"."menu_sections" FOR INSERT TO "authenticated"
    WITH CHECK ("private"."can_edit_menu"("menu_id"));
CREATE POLICY "menu_sections_update" ON "public"."menu_sections" FOR UPDATE TO "authenticated"
    USING ("private"."can_edit_menu"("menu_id"))
    WITH CHECK ("private"."can_edit_menu"("menu_id"));
CREATE POLICY "menu_sections_delete" ON "public"."menu_sections" FOR DELETE TO "authenticated"
    USING ("private"."can_edit_menu"("menu_id"));

GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."menu_sections" TO "authenticated";
GRANT ALL ON "public"."menu_sections" TO "service_role";

-- Backfill: every menu gets a copy of its template's sections, plus any
-- template section its drinks point at from another template.
INSERT INTO "public"."menu_sections" ("menu_id", "name", "sort_order", "min_items", "max_items", "allowed_types", "template_section_id")
SELECT DISTINCT "src"."menu_id", "ts"."name", "ts"."sort_order", COALESCE("ts"."min_items", 1),
       CASE WHEN "ts"."max_items" >= GREATEST(COALESCE("ts"."min_items", 1), 1) THEN "ts"."max_items" END,
       "ts"."allowed_types", "ts"."id"
FROM (
    SELECT "m"."id" AS "menu_id", "ts"."id" AS "template_section_id"
    FROM "public"."menus" "m"
    JOIN "public"."template_sections" "ts" ON "ts"."template_id" = "m"."template_id"
    UNION
    SELECT "md"."menu_id", "md"."template_section_id"
    FROM "public"."menu_drinks" "md"
    WHERE "md"."menu_id" IS NOT NULL AND "md"."template_section_id" IS NOT NULL
) "src"
JOIN "public"."template_sections" "ts" ON "ts"."id" = "src"."template_section_id"
JOIN "public"."menus" "m" ON "m"."id" = "src"."menu_id";

-- Drinks with no section at all get one plain section on their menu.
INSERT INTO "public"."menu_sections" ("menu_id", "name", "sort_order", "min_items")
SELECT DISTINCT "md"."menu_id", 'Drinks', 1000, 0
FROM "public"."menu_drinks" "md"
JOIN "public"."menus" "m" ON "m"."id" = "md"."menu_id"
WHERE "md"."template_section_id" IS NULL;

UPDATE "public"."menu_drinks" "md"
SET "menu_section_id" = "s"."id"
FROM "public"."menu_sections" "s"
WHERE "s"."menu_id" = "md"."menu_id"
  AND (
    "s"."template_section_id" = "md"."template_section_id"
    OR ("md"."template_section_id" IS NULL AND "s"."template_section_id" IS NULL AND "s"."name" = 'Drinks' AND "s"."sort_order" = 1000)
  );

-- Legacy screens still insert menu_drinks with only a template section. Put
-- those rows in the menu's copy of that section, making the copy if needed.
-- A row with no section at all goes in the menu's first section (or a plain
-- "Drinks" one), so no drink is ever on a menu but invisible.
-- Runs as the caller, so the menu_sections policies still apply.
CREATE FUNCTION "private"."menu_drinks_fill_section"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NEW.menu_section_id IS NOT NULL OR NEW.menu_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.template_section_id IS NULL THEN
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
  END IF;
  SELECT s.id INTO NEW.menu_section_id
  FROM public.menu_sections s
  WHERE s.menu_id = NEW.menu_id AND s.template_section_id = NEW.template_section_id;
  IF NEW.menu_section_id IS NULL THEN
    INSERT INTO public.menu_sections (menu_id, name, sort_order, min_items, max_items, allowed_types, template_section_id)
    SELECT NEW.menu_id, ts.name, ts.sort_order, COALESCE(ts.min_items, 1),
           CASE WHEN ts.max_items >= GREATEST(COALESCE(ts.min_items, 1), 1) THEN ts.max_items END,
           ts.allowed_types, ts.id
    FROM public.template_sections ts
    WHERE ts.id = NEW.template_section_id
    ON CONFLICT (menu_id, template_section_id) DO NOTHING
    RETURNING id INTO NEW.menu_section_id;
    IF NEW.menu_section_id IS NULL THEN
      SELECT s.id INTO NEW.menu_section_id
      FROM public.menu_sections s
      WHERE s.menu_id = NEW.menu_id AND s.template_section_id = NEW.template_section_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "menu_drinks_fill_section" BEFORE INSERT OR UPDATE OF "template_section_id" ON "public"."menu_drinks"
    FOR EACH ROW EXECUTE FUNCTION "private"."menu_drinks_fill_section"();

-- --- Dates ---

ALTER TABLE "public"."menus"
    ADD COLUMN "starts_at" timestamp with time zone,
    ADD COLUMN "ends_at" timestamp with time zone,
    ADD CONSTRAINT "menus_dates_check" CHECK ("starts_at" IS NULL OR "ends_at" IS NULL OR "ends_at" > "starts_at");

CREATE INDEX "menus_bar_id_starts_at_idx" ON "public"."menus" ("bar_id", "starts_at");

-- Current menus have been on since they were made (the best date we have).
-- Menus that weren't current are previous, taken off before dates were kept.
UPDATE "public"."menus" SET "starts_at" = "created_at" WHERE "is_active";
UPDATE "public"."menus" SET "ends_at" = "now"(), "is_active" = false WHERE NOT COALESCE("is_active", false);

CREATE FUNCTION "private"."menu_on_now"("p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone) RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT p_starts_at IS NOT NULL AND p_starts_at <= now() AND (p_ends_at IS NULL OR p_ends_at > now());
$$;

-- Keeps is_active and the dates in step. New code writes dates; legacy code
-- toggles is_active, which moves the dates to match.
CREATE FUNCTION "private"."menus_sync_active"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  on_now boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.starts_at IS NULL AND NEW.ends_at IS NULL AND COALESCE(NEW.is_active, false) THEN
      -- A legacy insert marked current: it starts now.
      NEW.starts_at := now();
    END IF;
  ELSIF (NEW.starts_at IS NOT DISTINCT FROM OLD.starts_at AND NEW.ends_at IS NOT DISTINCT FROM OLD.ends_at)
    AND COALESCE(NEW.is_active, false) IS DISTINCT FROM COALESCE(OLD.is_active, false)
    AND COALESCE(NEW.is_active, false) IS DISTINCT FROM private.menu_on_now(NEW.starts_at, NEW.ends_at) THEN
    -- A legacy toggle: move the dates to match.
    IF NEW.is_active THEN
      NEW.starts_at := CASE WHEN NEW.starts_at <= now() THEN NEW.starts_at ELSE now() END;
      NEW.ends_at := NULL;
    ELSIF NEW.starts_at IS NULL OR NEW.starts_at < now() THEN
      NEW.ends_at := now();
    ELSE
      -- Taking a menu off before it started: it's a draft again.
      NEW.starts_at := NULL;
      NEW.ends_at := NULL;
    END IF;
  END IF;

  -- The dates are the truth; is_active follows them.
  on_now := private.menu_on_now(NEW.starts_at, NEW.ends_at);
  NEW.is_active := on_now;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "menus_sync_active" BEFORE INSERT OR UPDATE ON "public"."menus"
    FOR EACH ROW EXECUTE FUNCTION "private"."menus_sync_active"();

-- Scheduled starts and ends flip is_active within five minutes. Screens that
-- read the dates themselves are exact.
CREATE FUNCTION "private"."sweep_menu_dates"() RETURNS integer
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
  WITH changed AS (
    UPDATE public.menus
    SET is_active = private.menu_on_now(starts_at, ends_at)
    WHERE COALESCE(is_active, false) IS DISTINCT FROM private.menu_on_now(starts_at, ends_at)
    RETURNING 1
  )
  SELECT count(*)::integer FROM changed;
$$;

SELECT "cron"."schedule"('sweep-menu-dates', '*/5 * * * *', 'SELECT private.sweep_menu_dates()');

-- --- Writes ---

-- Saves a menu's name, cover and whole layout in one go: sections in order,
-- each with its drinks in order. Sections not in the list are removed.
-- p_sections: [{ "id"?: uuid, "name", "min_items"?, "max_items"?,
--               "allowed_types"?: text[], "item_ids": uuid[] }]
-- Runs as the caller, so every policy still applies.
CREATE FUNCTION "public"."save_menu"(
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
BEGIN
  IF jsonb_typeof(p_sections) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'sections must be a list' USING ERRCODE = '22023';
  END IF;

  UPDATE public.menus
  SET name = btrim(p_name), cover_url = p_cover_url, cover_position = COALESCE(p_cover_position, 50)
  WHERE id = p_menu_id;
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

-- Puts a menu on at p_starts_at (now if NULL), optionally ending other menus
-- of the same venue at that moment. Every section must have its minimum.
CREATE FUNCTION "public"."schedule_menu"(
    "p_menu_id" "uuid",
    "p_starts_at" timestamp with time zone DEFAULT NULL,
    "p_replace_menu_ids" "uuid"[] DEFAULT '{}'
) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  v_menu public.menus%ROWTYPE;
  v_start timestamp with time zone := COALESCE(p_starts_at, now());
  v_short text;
BEGIN
  SELECT * INTO v_menu FROM public.menus WHERE id = p_menu_id;
  IF NOT FOUND OR NOT private.can_edit_menu(p_menu_id) THEN
    RAISE EXCEPTION 'menu not found or not yours to edit' USING ERRCODE = '42501';
  END IF;

  SELECT s.name INTO v_short
  FROM public.menu_sections s
  WHERE s.menu_id = p_menu_id
    AND (SELECT count(*) FROM public.menu_drinks d WHERE d.menu_section_id = s.id) < s.min_items
  ORDER BY s.sort_order
  LIMIT 1;
  IF v_short IS NOT NULL THEN
    RAISE EXCEPTION 'section % needs more drinks', v_short USING ERRCODE = '22023';
  END IF;

  -- Every menu being replaced must be another menu at the same venue that
  -- the caller can edit (one they can't even see counts as refused).
  IF EXISTS (
    SELECT 1 FROM unnest(COALESCE(p_replace_menu_ids, '{}')) AS r(id)
    WHERE r.id = p_menu_id
       OR NOT EXISTS (
         SELECT 1 FROM public.menus m
         WHERE m.id = r.id AND m.bar_id IS NOT DISTINCT FROM v_menu.bar_id AND private.can_edit_menu(m.id)
       )
  ) THEN
    RAISE EXCEPTION 'can only replace another menu at the same venue' USING ERRCODE = '22023';
  END IF;

  -- Menus being replaced end when this one starts; one that hasn't started
  -- by then goes back to being a draft.
  UPDATE public.menus
  SET starts_at = CASE WHEN starts_at < v_start THEN starts_at END,
      ends_at = CASE WHEN starts_at < v_start THEN v_start END
  WHERE id = ANY (COALESCE(p_replace_menu_ids, '{}'))
    AND (ends_at IS NULL OR ends_at > v_start);

  -- A menu already on keeps its start date unless a new one is given.
  UPDATE public.menus
  SET starts_at = CASE WHEN p_starts_at IS NULL AND private.menu_on_now(starts_at, ends_at) THEN starts_at ELSE v_start END,
      ends_at = NULL
  WHERE id = p_menu_id;
END;
$$;

-- Takes a menu off now. One that hasn't started yet goes back to a draft.
CREATE FUNCTION "public"."end_menu"("p_menu_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NOT private.can_edit_menu(p_menu_id) THEN
    RAISE EXCEPTION 'menu not found or not yours to edit' USING ERRCODE = '42501';
  END IF;
  UPDATE public.menus
  SET starts_at = CASE WHEN starts_at < now() THEN starts_at END,
      ends_at = CASE WHEN starts_at < now() THEN now() END
  WHERE id = p_menu_id
    AND (ends_at IS NULL OR ends_at > now());
END;
$$;

-- --- Grants ---

REVOKE EXECUTE ON FUNCTION "private"."menu_drinks_fill_section"() FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "private"."menus_sync_active"() FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "private"."menu_on_now"(timestamp with time zone, timestamp with time zone) FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "private"."sweep_menu_dates"() FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "private"."menu_on_now"(timestamp with time zone, timestamp with time zone) TO "authenticated", "service_role";
REVOKE EXECUTE ON FUNCTION "public"."save_menu"("uuid", "text", "text", real, "jsonb") FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "public"."schedule_menu"("uuid", timestamp with time zone, "uuid"[]) FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "public"."end_menu"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."save_menu"("uuid", "text", "text", real, "jsonb") TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."schedule_menu"("uuid", timestamp with time zone, "uuid"[]) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."end_menu"("uuid") TO "authenticated";
