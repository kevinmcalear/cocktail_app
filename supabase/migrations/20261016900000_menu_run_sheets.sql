-- DRAFT. Local stack only. Not applied to production; needs Kevin's review first.
--
-- Run sheets (13 Oct, Eddie for Rob at Caretaker's Cottage; canvas
-- https://claude.ai/artifact/7KusjjZLGZjbFd3B7oamZU). A menu becomes a
-- takeover plan: how many of each drink, the bottles swapped for this night
-- only, everything the drinks need totalled, and who brings each thing.
--
--   menu_drinks.serves     how many of this drink the night needs, 1 or more
--                          (the app caps it at 6,969). NULL: not set yet.
--   menu_run_parties       who else is in it: the guest venue (at most one a
--                          menu) and brands (any number), each by the name the
--                          venue typed, optionally linked to the bar's or the
--                          maker's profile. The hosting venue is the menu's
--                          own bar and has no row.
--   menu_run_swaps         one bottle or garnish swapped for another in one
--                          drink, for this menu only. The library spec never
--                          changes.
--   menu_run_owners        who brings one thing (an ingredient, a glass, an
--                          ice): a party, or NULL for the hosting venue. No
--                          row: the app's default (lib/runSheet.ts). Removing
--                          a party hands its things back to the host.
--
-- Access mirrors menu_drinks exactly: whoever can read the menu reads all
-- four (menus RLS), whoever can edit it (private.can_edit_menu) writes them.
-- Nothing is open to anon.
--
-- save_menu used to delete and re-insert every menu_drinks row on each save,
-- which would wipe serves and swaps whenever someone edited the menu. It now
-- keeps the row of a drink that stays on the menu (moving it to its new
-- section and place), inserts new drinks and deletes the ones taken off.

ALTER TABLE "public"."menu_drinks"
    ADD COLUMN "serves" integer CHECK ("serves" IS NULL OR "serves" >= 1);

COMMENT ON COLUMN "public"."menu_drinks"."serves" IS
    'How many of this drink the run sheet plans for. NULL: not set. The app caps it at 6,969.';

CREATE TABLE "public"."menu_run_parties" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "menu_id" "uuid" NOT NULL REFERENCES "public"."menus"("id") ON DELETE CASCADE,
    "kind" "text" NOT NULL CHECK ("kind" IN ('guest', 'brand')),
    -- The guest bar's page or the brand's maker page, when it has one here.
    "profile_id" "uuid" REFERENCES "public"."profiles"("id") ON DELETE SET NULL,
    "name" "text" NOT NULL CHECK (char_length(btrim("name")) BETWEEN 1 AND 80),
    "sort_order" smallint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    -- For menu_run_owners' foreign key, so an owner is always a party of the same menu.
    UNIQUE ("id", "menu_id")
);

CREATE INDEX "menu_run_parties_menu_idx" ON "public"."menu_run_parties" ("menu_id", "sort_order");
CREATE UNIQUE INDEX "menu_run_parties_one_guest" ON "public"."menu_run_parties" ("menu_id") WHERE "kind" = 'guest';
CREATE INDEX "menu_run_parties_profile_idx" ON "public"."menu_run_parties" ("profile_id") WHERE "profile_id" IS NOT NULL;

CREATE TABLE "public"."menu_run_swaps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "menu_drink_id" "uuid" NOT NULL REFERENCES "public"."menu_drinks"("id") ON DELETE CASCADE,
    "from_item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "to_item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    UNIQUE ("menu_drink_id", "from_item_id"),
    CHECK ("from_item_id" <> "to_item_id")
);

CREATE INDEX "menu_run_swaps_from_idx" ON "public"."menu_run_swaps" ("from_item_id");
CREATE INDEX "menu_run_swaps_to_idx" ON "public"."menu_run_swaps" ("to_item_id");

CREATE TABLE "public"."menu_run_owners" (
    "menu_id" "uuid" NOT NULL REFERENCES "public"."menus"("id") ON DELETE CASCADE,
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    -- NULL: the hosting venue brings it.
    "party_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    PRIMARY KEY ("menu_id", "item_id"),
    FOREIGN KEY ("party_id", "menu_id") REFERENCES "public"."menu_run_parties"("id", "menu_id") ON DELETE SET NULL ("party_id")
);

CREATE INDEX "menu_run_owners_item_idx" ON "public"."menu_run_owners" ("item_id");
CREATE INDEX "menu_run_owners_party_idx" ON "public"."menu_run_owners" ("party_id") WHERE "party_id" IS NOT NULL;

-- A guest links to a bar's page and a brand to a maker's; a menu has at most
-- 20 parties. Party names are only ever shown to the menu's own team.
CREATE FUNCTION "private"."guard_menu_run_party"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.profile_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.profile_id IS DISTINCT FROM OLD.profile_id OR NEW.kind IS DISTINCT FROM OLD.kind)
       AND NOT EXISTS (
           SELECT 1 FROM public.profiles p
           WHERE p.id = NEW.profile_id AND p.kind::text = CASE NEW.kind WHEN 'guest' THEN 'bar' ELSE 'maker' END
       ) THEN
        RAISE EXCEPTION 'A guest venue links to a bar''s page, and a brand to a maker''s page.' USING ERRCODE = '22023';
    END IF;
    IF (TG_OP = 'INSERT' OR NEW.menu_id IS DISTINCT FROM OLD.menu_id)
       AND (SELECT count(*) FROM public.menu_run_parties x WHERE x.menu_id = NEW.menu_id AND x.id <> NEW.id) >= 20 THEN
        RAISE EXCEPTION 'A run sheet has up to 20 venues and brands.' USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "guard_menu_run_party" BEFORE INSERT OR UPDATE ON "public"."menu_run_parties"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_menu_run_party"();

REVOKE EXECUTE ON FUNCTION "private"."guard_menu_run_party"() FROM PUBLIC, "anon", "authenticated";

-- ---------------------------------------------------------------------------
-- Access: as menu_drinks
-- ---------------------------------------------------------------------------

ALTER TABLE "public"."menu_run_parties" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."menu_run_swaps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."menu_run_owners" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON "public"."menu_run_parties", "public"."menu_run_swaps", "public"."menu_run_owners" FROM "anon", "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."menu_run_parties", "public"."menu_run_swaps", "public"."menu_run_owners" TO "authenticated";
GRANT ALL ON "public"."menu_run_parties", "public"."menu_run_swaps", "public"."menu_run_owners" TO "service_role";

CREATE POLICY "menu_run_parties_select" ON "public"."menu_run_parties" FOR SELECT TO "authenticated"
    USING ("menu_id" IN (SELECT "id" FROM "public"."menus"));
CREATE POLICY "menu_run_parties_insert" ON "public"."menu_run_parties" FOR INSERT TO "authenticated"
    WITH CHECK ("private"."can_edit_menu"("menu_id"));
CREATE POLICY "menu_run_parties_update" ON "public"."menu_run_parties" FOR UPDATE TO "authenticated"
    USING ("private"."can_edit_menu"("menu_id"))
    WITH CHECK ("private"."can_edit_menu"("menu_id"));
CREATE POLICY "menu_run_parties_delete" ON "public"."menu_run_parties" FOR DELETE TO "authenticated"
    USING ("private"."can_edit_menu"("menu_id"));

-- A swap belongs to a menu drink: readable with it, written by its menu's editors.
CREATE POLICY "menu_run_swaps_select" ON "public"."menu_run_swaps" FOR SELECT TO "authenticated"
    USING ("menu_drink_id" IN (SELECT "id" FROM "public"."menu_drinks"));
CREATE POLICY "menu_run_swaps_insert" ON "public"."menu_run_swaps" FOR INSERT TO "authenticated"
    WITH CHECK ("private"."can_edit_menu"((SELECT "md"."menu_id" FROM "public"."menu_drinks" "md" WHERE "md"."id" = "menu_drink_id")));
CREATE POLICY "menu_run_swaps_update" ON "public"."menu_run_swaps" FOR UPDATE TO "authenticated"
    USING ("private"."can_edit_menu"((SELECT "md"."menu_id" FROM "public"."menu_drinks" "md" WHERE "md"."id" = "menu_drink_id")))
    WITH CHECK ("private"."can_edit_menu"((SELECT "md"."menu_id" FROM "public"."menu_drinks" "md" WHERE "md"."id" = "menu_drink_id")));
CREATE POLICY "menu_run_swaps_delete" ON "public"."menu_run_swaps" FOR DELETE TO "authenticated"
    USING ("private"."can_edit_menu"((SELECT "md"."menu_id" FROM "public"."menu_drinks" "md" WHERE "md"."id" = "menu_drink_id")));

CREATE POLICY "menu_run_owners_select" ON "public"."menu_run_owners" FOR SELECT TO "authenticated"
    USING ("menu_id" IN (SELECT "id" FROM "public"."menus"));
CREATE POLICY "menu_run_owners_insert" ON "public"."menu_run_owners" FOR INSERT TO "authenticated"
    WITH CHECK ("private"."can_edit_menu"("menu_id"));
CREATE POLICY "menu_run_owners_update" ON "public"."menu_run_owners" FOR UPDATE TO "authenticated"
    USING ("private"."can_edit_menu"("menu_id"))
    WITH CHECK ("private"."can_edit_menu"("menu_id"));
CREATE POLICY "menu_run_owners_delete" ON "public"."menu_run_owners" FOR DELETE TO "authenticated"
    USING ("private"."can_edit_menu"("menu_id"));

-- ---------------------------------------------------------------------------
-- save_menu keeps the rows of drinks that stay (20260930500800, plus that)
-- ---------------------------------------------------------------------------

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
      -- The drink's row from before the save, if it's still on the menu: its
      -- serves and run sheet swaps stay with it.
      this_item := item_id;
      SELECT md.id INTO row_id FROM public.menu_drinks md
      WHERE md.menu_id = p_menu_id AND md.item_id = this_item AND NOT (md.id = ANY (kept_drinks))
      ORDER BY md.sort_order, md.id
      LIMIT 1;
      IF row_id IS NOT NULL THEN
        UPDATE public.menu_drinks SET menu_section_id = sec_id, sort_order = drink_index WHERE id = row_id;
      ELSE
        INSERT INTO public.menu_drinks (menu_id, menu_section_id, item_id, sort_order)
        VALUES (p_menu_id, sec_id, item_id, drink_index)
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
