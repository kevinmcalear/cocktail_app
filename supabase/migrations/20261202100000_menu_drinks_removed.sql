-- A drink taken off a menu that is on now, and when.
--
-- Most bars change their menus by swapping one to three drinks on a list
-- that stays on (menus research, 31 Oct 2026). save_menu keeps a staying
-- drink's row and deletes the rows of drinks taken off
-- (20261103530000_menu_drink_price.sql), so a swap on a live menu was dated
-- on the way in (menu_drinks.created_at) and lost on the way out. This
-- starts the record; nothing reads it yet (a drink's runs will).
--
--   * menu_drinks_removed: one row per drink taken off a menu while it was
--     on: the menu, the drink, its section's name and the price the menu
--     printed for it (its own, else the drink's), when it went on
--     (greatest(menu_drinks.created_at, menus.starts_at)), when it came off
--     (now()) and who took it off (auth.uid(); null for a script, or once
--     that account is deleted).
--   * Written by an AFTER DELETE trigger on menu_drinks, only when the menu
--     is on now (private.menu_on_now). Drafts, coming-up menus and fixes to
--     a past menu write nothing. Deleting a menu or a drink writes nothing:
--     its menu_drinks rows go by cascade after the menu or drink row is
--     gone. An item merge (private.merge_item) moves menu_drinks.item_id
--     with an UPDATE, which doesn't fire it, and moves these rows' item_id
--     as it does every foreign key to items.
--   * Read as menu_drinks is (whoever can read the menu). Nobody writes it
--     but the trigger, and anon has nothing.

CREATE TABLE "public"."menu_drinks_removed" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "menu_id" "uuid" NOT NULL REFERENCES "public"."menus"("id") ON DELETE CASCADE,
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "section_name" "text",
    "price" "text",
    "went_on" timestamp with time zone NOT NULL,
    "came_off" timestamp with time zone DEFAULT "now"() NOT NULL,
    "taken_off_by" "uuid" REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    CONSTRAINT "menu_drinks_removed_came_off_after_on" CHECK ("came_off" >= "went_on")
);

COMMENT ON TABLE "public"."menu_drinks_removed" IS 'Each drink taken off a menu while it was on: when it went on and came off, and who took it off. Written by a trigger on menu_drinks; read as menu_drinks is.';
COMMENT ON COLUMN "public"."menu_drinks_removed"."price" IS 'The price the menu printed for it when it came off: the menu''s own, else the drink''s. Null when neither had one.';
COMMENT ON COLUMN "public"."menu_drinks_removed"."went_on" IS 'When it went on this menu: its menu_drinks row''s created_at, or the menu''s start if the row is older.';

CREATE INDEX "menu_drinks_removed_menu_id_idx" ON "public"."menu_drinks_removed" ("menu_id");
CREATE INDEX "menu_drinks_removed_item_id_idx" ON "public"."menu_drinks_removed" ("item_id");
CREATE INDEX "menu_drinks_removed_taken_off_by_idx" ON "public"."menu_drinks_removed" ("taken_off_by") WHERE "taken_off_by" IS NOT NULL;

ALTER TABLE "public"."menu_drinks_removed" ENABLE ROW LEVEL SECURITY;

-- As menu_drinks_select (20260923000100_security_lockdown.sql).
CREATE POLICY "menu_drinks_removed_select" ON "public"."menu_drinks_removed" FOR SELECT TO "authenticated"
    USING ("menu_id" IN (SELECT "id" FROM "public"."menus"));

-- New tables are no longer exposed by default (Supabase, 30 Oct 2026), so
-- every grant is spelled out.
REVOKE ALL ON "public"."menu_drinks_removed" FROM PUBLIC, "anon", "authenticated";
GRANT SELECT ON "public"."menu_drinks_removed" TO "authenticated";
GRANT ALL ON "public"."menu_drinks_removed" TO "service_role";

-- --- The trigger ---

CREATE FUNCTION "private"."record_menu_drink_removed"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    -- The joins find nothing when the menu or the drink is the row being
    -- deleted (a cascade), so only a drink taken off a live menu is kept.
    INSERT INTO public.menu_drinks_removed (menu_id, item_id, section_name, price, went_on, taken_off_by)
    SELECT m.id, i.id, s.name, coalesce(OLD.price, nullif(btrim(i.price), '')),
           -- A row dated ahead (a script, a skewed clock) went on no later than now.
           least(greatest(OLD.created_at, m.starts_at), now()), auth.uid()
    FROM public.menus m
    JOIN public.items i ON i.id = OLD.item_id
    LEFT JOIN public.menu_sections s ON s.id = OLD.menu_section_id
    WHERE m.id = OLD.menu_id
      AND private.menu_on_now(m.starts_at, m.ends_at);
    RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."record_menu_drink_removed"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "record_menu_drink_removed" AFTER DELETE ON "public"."menu_drinks"
    FOR EACH ROW EXECUTE FUNCTION "private"."record_menu_drink_removed"();
