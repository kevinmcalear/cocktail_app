-- Lists and runs: a bar's living lists, every drink going on or coming off
-- dated with who did it (decision page, 1 Nov 2026: menu-unit, swap, lists,
-- daily-list, approval-states, menu-draft-bartenders, menu-delete,
-- record-now, run-names).
--
-- A menu is now a list a bar keeps on (main, specials, a tasting track,
-- happy hour, no and low, beer, wine, a takeover, a daily list). A whole new
-- menu is still a draft published as before; between launches, drinks go on
-- and come off the list one at a time, each dated.
--
--   * menu_drinks is a drink's time on a list ("its dates on the list"):
--     on_from (null: it went on with the list; a future date: from the next
--     service), off_at (a planned take-off; when it passes the row goes to
--     the record), added_by, off_by, replaces_item_id (the drink it was
--     swapped in for), slot_name (a slot that keeps its place while its
--     drink rotates), waiting ('on' or 'off': a change waiting for
--     approval) and team_shared_at (a planned drink shared with the team to
--     learn). Rows already on a list went on with it, or when they were
--     added if that was later (backfilled below).
--   * The record of a drink taken off a live list stays menu_drinks_removed
--     (20261202100000): a run that ended is never lost. It now keeps who
--     added the drink, its slot and what it replaced, and dates the end from
--     off_at. A drink still waiting to go on, or planned and not on yet,
--     leaves nothing when it goes.
--   * swap_menu_drink(row, drink, at): Swap on the row, now or from a date.
--   * Who may change a list: menus.change_level and change_role_id (null:
--     anyone with the menus permission, as today; 40: Admins; a venue role:
--     that role and Admins). Anyone else with the menus permission, and
--     anyone in a department (#1023), makes changes that wait ('Waiting for
--     approval'); someone who may change the list approves them.
--   * items.approved_by and approved_at: 'Tasted and approved by X, date'.
--     Clearing awaiting_approval (#1023) stamps them, and an approver may
--     approve any drink of their bar.
--   * Drafts are shared with the team per change (menus.team_shared_at, and
--     menu_drinks.team_shared_at for a planned drink). A list that hasn't
--     started is read by the people who build menus, its creator, the prep
--     team once it has a date (they prep before the night), and the rest of
--     the bar once it is shared. A planned or waiting drink, likewise.
--   * Delete: a list that never ran (no start, or a start still to come) is
--     deleted by its creator or an Admin. A list that ran is ended and hidden
--     (menus.hidden_at), never deleted: it carries credit, runs and the bar's
--     timeline. Home menus (no bar) as before.
--   * The daily list: menu_days keeps each day's author and the names
--     printed on it; list_on_day(list, day) rebuilds the list on any day from
--     the record. bars.timezone dates a bar's day (null: the phone's own).
--   * menu_sections.stays marks a section that stays (the classics page).
--   * menus.list_type says what kind of list it is.
--   * drink_list_dates(item ids) replaces menu_drink_runs (a view) for every
--     caller. This carries #1030 (20261202200000, superseded and closed),
--     named as decided ('dates on the list'; 'run' stays with the run sheet),
--     and reads the new columns: a planned or waiting drink isn't on, a
--     hidden list isn't shown. menu_drink_runs stays until 2.0 is on every
--     phone (old builds read it), then drops with the other old fields.

-- --- 1. The columns ---

-- A time zone Postgres knows (IANA names such as Australia/Sydney).
CREATE FUNCTION "private"."is_time_zone"("p_zone" "text") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
BEGIN
    PERFORM now() AT TIME ZONE p_zone;
    RETURN true;
EXCEPTION WHEN OTHERS THEN
    RETURN false;
END;
$$;

ALTER TABLE "public"."bars" ADD COLUMN "timezone" "text";
ALTER TABLE "public"."bars" ADD CONSTRAINT "bars_timezone_check" CHECK ("timezone" IS NULL OR "private"."is_time_zone"("timezone"));
COMMENT ON COLUMN "public"."bars"."timezone" IS
    'The bar''s time zone (IANA, for example Australia/Sydney): when its day starts for the daily list and Off tonight. NULL: the phone''s own.';

ALTER TABLE "public"."menus"
    ADD COLUMN "list_type" "text" DEFAULT 'main' NOT NULL,
    ADD COLUMN "change_level" smallint,
    ADD COLUMN "change_role_id" "uuid",
    ADD COLUMN "team_shared_at" timestamp with time zone,
    ADD COLUMN "team_shared_by" "uuid" REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    ADD COLUMN "hidden_at" timestamp with time zone;
ALTER TABLE "public"."menus" ADD CONSTRAINT "menus_list_type_check" CHECK (
    "list_type" = ANY (ARRAY['main', 'specials', 'tasting', 'happy_hour', 'no_low', 'beer', 'wine', 'takeover', 'daily'])
);
ALTER TABLE "public"."menus" ADD CONSTRAINT "menus_change_level_check" CHECK ("change_level" IS NULL OR "change_level" = ANY (ARRAY[30, 35, 40]));
ALTER TABLE "public"."menus" ADD CONSTRAINT "menus_change_role_fkey"
    FOREIGN KEY ("change_role_id", "bar_id") REFERENCES "public"."venue_roles"("id", "bar_id") ON DELETE SET NULL ("change_role_id");
ALTER TABLE "public"."menus" ADD CONSTRAINT "menus_hidden_ran" CHECK ("hidden_at" IS NULL OR "starts_at" IS NOT NULL);
CREATE INDEX "menus_change_role_id_idx" ON "public"."menus" ("change_role_id") WHERE "change_role_id" IS NOT NULL;
CREATE INDEX "menus_team_shared_by_idx" ON "public"."menus" ("team_shared_by") WHERE "team_shared_by" IS NOT NULL;
COMMENT ON COLUMN "public"."menus"."list_type" IS
    'What kind of list: main, specials, tasting, happy_hour, no_low, beer, wine, takeover or daily (changed each morning).';
COMMENT ON COLUMN "public"."menus"."change_level" IS
    'Who may change this list, by role: 40 Admins only, 35 Drink Creators and up, 30 Bartenders and up (each still needs the menus permission). NULL with no change_role_id: anyone with the menus permission. Others'' changes wait for approval.';
COMMENT ON COLUMN "public"."menus"."change_role_id" IS
    'A venue role that may change this list (the beer lead for beer), besides Admins. Others'' changes wait for approval.';
COMMENT ON COLUMN "public"."menus"."team_shared_at" IS
    'A list that hasn''t started, shared with the whole bar to learn its specs (menu-draft-bartenders). NULL: only those who build menus, its creator and (once dated) the prep team read it.';
COMMENT ON COLUMN "public"."menus"."hidden_at" IS
    'A list that ran, hidden from the bar page and drink pages instead of deleted. Its members still read it.';

ALTER TABLE "public"."menu_sections" ADD COLUMN "stays" boolean DEFAULT false NOT NULL;
COMMENT ON COLUMN "public"."menu_sections"."stays" IS 'A section that stays while the rest of the list changes (the classics page, the house Martini).';

ALTER TABLE "public"."menu_drinks"
    ADD COLUMN "on_from" timestamp with time zone,
    ADD COLUMN "off_at" timestamp with time zone,
    ADD COLUMN "added_by" "uuid" DEFAULT "auth"."uid"() REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    ADD COLUMN "off_by" "uuid" REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    ADD COLUMN "replaces_item_id" "uuid" REFERENCES "public"."items"("id") ON DELETE SET NULL,
    ADD COLUMN "slot_name" "text",
    ADD COLUMN "waiting" "text",
    ADD COLUMN "team_shared_at" timestamp with time zone;
ALTER TABLE "public"."menu_drinks" ADD CONSTRAINT "menu_drinks_waiting_check" CHECK ("waiting" IS NULL OR "waiting" = ANY (ARRAY['on', 'off']));
ALTER TABLE "public"."menu_drinks" ADD CONSTRAINT "menu_drinks_off_after_on" CHECK ("on_from" IS NULL OR "off_at" IS NULL OR "off_at" > "on_from");
ALTER TABLE "public"."menu_drinks" ADD CONSTRAINT "menu_drinks_off_waits" CHECK ("waiting" IS DISTINCT FROM 'off' OR "off_at" IS NOT NULL);
ALTER TABLE "public"."menu_drinks" ADD CONSTRAINT "menu_drinks_slot_name_check" CHECK (
    "slot_name" IS NULL OR (char_length(btrim("slot_name")) BETWEEN 1 AND 60 AND "slot_name" = btrim("slot_name"))
);
CREATE INDEX "menu_drinks_added_by_idx" ON "public"."menu_drinks" ("added_by") WHERE "added_by" IS NOT NULL;
CREATE INDEX "menu_drinks_off_by_idx" ON "public"."menu_drinks" ("off_by") WHERE "off_by" IS NOT NULL;
CREATE INDEX "menu_drinks_replaces_item_id_idx" ON "public"."menu_drinks" ("replaces_item_id") WHERE "replaces_item_id" IS NOT NULL;
-- The sweep's two reads: take-offs that are due, and planned drinks going on.
CREATE INDEX "menu_drinks_off_at_idx" ON "public"."menu_drinks" ("off_at") WHERE "off_at" IS NOT NULL;
CREATE INDEX "menu_drinks_on_from_idx" ON "public"."menu_drinks" ("on_from") WHERE "on_from" IS NOT NULL;
COMMENT ON COLUMN "public"."menu_drinks"."on_from" IS
    'When it went on, or goes on (a future date: from the next service). NULL: with the list, from its start.';
COMMENT ON COLUMN "public"."menu_drinks"."off_at" IS
    'When it comes off. When that passes (and nothing waits), the row moves to menu_drinks_removed with its dates.';
COMMENT ON COLUMN "public"."menu_drinks"."added_by" IS 'Who put it on the list. NULL for rows from before 1 Nov 2026, scripts and deleted accounts.';
COMMENT ON COLUMN "public"."menu_drinks"."replaces_item_id" IS 'The drink it was swapped in for (Swap on the row).';
COMMENT ON COLUMN "public"."menu_drinks"."slot_name" IS 'A slot that keeps its place while its drink rotates (the seasonal Daiquiri). A swap carries it over.';
COMMENT ON COLUMN "public"."menu_drinks"."waiting" IS
    '''on'': its going on waits for approval (it isn''t on yet). ''off'': its coming off waits (it stays on). NULL: nothing waits.';
COMMENT ON COLUMN "public"."menu_drinks"."team_shared_at" IS 'A planned or waiting drink shared with the whole bar to learn its spec.';

ALTER TABLE "public"."menu_drinks_removed"
    ADD COLUMN "added_by" "uuid" REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    ADD COLUMN "replaces_item_id" "uuid" REFERENCES "public"."items"("id") ON DELETE SET NULL,
    ADD COLUMN "slot_name" "text";
CREATE INDEX "menu_drinks_removed_added_by_idx" ON "public"."menu_drinks_removed" ("added_by") WHERE "added_by" IS NOT NULL;
CREATE INDEX "menu_drinks_removed_replaces_item_id_idx" ON "public"."menu_drinks_removed" ("replaces_item_id") WHERE "replaces_item_id" IS NOT NULL;

ALTER TABLE "public"."items"
    ADD COLUMN "approved_by" "uuid" REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    ADD COLUMN "approved_at" timestamp with time zone;
CREATE INDEX "items_approved_by_idx" ON "public"."items" ("approved_by") WHERE "approved_by" IS NOT NULL;
COMMENT ON COLUMN "public"."items"."approved_at" IS 'Tasted and approved: when, by approved_by. Set when awaiting_approval clears, or by an approver at any time.';

-- --- 2. Backfill: rows already on a list ---

-- A drink added while its list was on went on then; added before it
-- started, or to fix it after it ended, it ran with the list (as #1030 read
-- it). Rows saved before 20261016900000 carry their last re-insert's date.
UPDATE "public"."menu_drinks" md
SET "on_from" = md."created_at"
FROM "public"."menus" m
WHERE m."id" = md."menu_id"
  AND m."starts_at" IS NOT NULL
  AND md."created_at" > m."starts_at"
  AND (m."ends_at" IS NULL OR md."created_at" < m."ends_at");

-- --- 3. Who may change a list ---

-- Deleting an account nulls the "who" columns above that name it (their
-- foreign keys are ON DELETE SET NULL). The stamp triggers below let that
-- through: it is the account that's gone, not a client rewriting history.
CREATE FUNCTION "private"."user_gone"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT p_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_user_id);
$$;

REVOKE ALL ON FUNCTION "private"."user_gone"("uuid") FROM PUBLIC, "anon", "authenticated";


-- The caller may change this list without approval: they build menus there,
-- aren't in a department (#1023), and the list's owner rule lets them. A
-- home menu (no bar) is its owner's. Scripts (no caller) may.
CREATE FUNCTION "private"."may_change_list"("p_menu_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT auth.uid() IS NULL OR coalesce((
        SELECT private.can_build_menu(m.bar_id, m.created_by)
           AND (
               m.bar_id IS NULL
               OR (
                   m.bar_id NOT IN (SELECT d.bar_id FROM private.my_departments() d)
                   AND (
                       (m.change_level IS NULL AND m.change_role_id IS NULL)
                       OR EXISTS (
                           SELECT 1 FROM public.user_bars ub
                           WHERE ub.bar_id = m.bar_id AND ub.user_id = auth.uid()
                             AND (
                                 ub.role_level >= 40
                                 OR (m.change_role_id IS NOT NULL AND ub.venue_role_id = m.change_role_id)
                                 OR (m.change_level IS NOT NULL AND ub.role_level >= m.change_level)
                             )
                       )
                   )
               )
           )
        FROM public.menus m
        WHERE m.id = p_menu_id
    ), false);
$$;

REVOKE ALL ON FUNCTION "private"."may_change_list"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."may_change_list"("uuid") TO "authenticated", "service_role";

-- For the app: whether the caller's changes to this list go straight on.
CREATE FUNCTION "public"."may_change_list"("p_menu_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
    SELECT private.can_edit_menu(p_menu_id) AND private.may_change_list(p_menu_id);
$$;

REVOKE ALL ON FUNCTION "public"."may_change_list"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."may_change_list"("uuid") TO "authenticated", "service_role";

-- --- 4. Dating each change ---

-- Before a row is written: who did it, when it goes on, and whether it
-- waits. A client never sets added_by, off_by or waiting itself.
CREATE FUNCTION "private"."stamp_menu_drink"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_menu public.menus%ROWTYPE;
    v_user uuid := auth.uid();
    v_started boolean;
    v_owner boolean;
BEGIN
    SELECT * INTO v_menu FROM public.menus WHERE id = NEW.menu_id;
    -- On now, or coming up with a date: changes to it are dated changes.
    -- A draft (no start) and a past list (a fix) aren't.
    v_started := v_menu.starts_at IS NOT NULL AND (v_menu.ends_at IS NULL OR v_menu.ends_at > now());
    v_owner := v_user IS NULL OR private.may_change_list(NEW.menu_id);

    IF TG_OP = 'INSERT' THEN
        IF v_user IS NOT NULL THEN
            NEW.added_by := v_user;
            NEW.off_by := NULL;
            NEW.waiting := NULL;
        END IF;
        IF v_started AND v_menu.starts_at <= now() THEN
            -- Added to a list that is on: from now, or from the date given.
            -- A script's row went on when it was made (as the backfill reads
            -- it), and may be dated back.
            IF v_user IS NULL THEN
                NEW.on_from := coalesce(NEW.on_from, CASE WHEN NEW.created_at > v_menu.starts_at THEN least(NEW.created_at, now()) END);
            ELSIF NEW.on_from IS NULL OR NEW.on_from < now() THEN
                NEW.on_from := now();
            END IF;
        ELSIF NOT v_started AND v_user IS NOT NULL THEN
            -- A draft or a past list: it runs with the list.
            NEW.on_from := NULL;
        END IF;
        IF v_started AND NOT v_owner THEN
            NEW.waiting := 'on';
        END IF;
        IF NEW.off_at IS NOT NULL AND v_user IS NOT NULL THEN
            NEW.off_by := v_user;
        END IF;
        RETURN NEW;
    END IF;

    -- UPDATE
    IF v_user IS NULL
       OR (NEW.added_by IS NULL AND private.user_gone(OLD.added_by))
       OR (NEW.off_by IS NULL AND private.user_gone(OLD.off_by)) THEN
        RETURN NEW;
    END IF;
    NEW.added_by := OLD.added_by;
    IF NEW.on_from IS DISTINCT FROM OLD.on_from AND v_started AND v_menu.starts_at <= now()
       AND (OLD.on_from IS NULL OR OLD.on_from <= now()) AND OLD.waiting IS DISTINCT FROM 'on' THEN
        -- A drink already on keeps the day it went on.
        NEW.on_from := OLD.on_from;
    ELSIF NEW.on_from IS DISTINCT FROM OLD.on_from AND NEW.on_from < now() AND v_started THEN
        NEW.on_from := now();
    END IF;

    IF NEW.waiting IS DISTINCT FROM OLD.waiting THEN
        IF NOT v_owner OR NEW.waiting IS NOT NULL THEN
            -- Only someone who may change the list clears a wait (approves);
            -- nobody sets one by hand.
            NEW.waiting := OLD.waiting;
        ELSIF OLD.waiting = 'on' THEN
            -- Approved: it goes on now, or on its planned date.
            NEW.on_from := CASE WHEN v_menu.starts_at <= now() THEN greatest(coalesce(NEW.on_from, now()), now()) END;
        END IF;
    END IF;

    IF NEW.off_at IS DISTINCT FROM OLD.off_at THEN
        NEW.off_by := CASE WHEN NEW.off_at IS NULL THEN NULL ELSE v_user END;
        IF NEW.off_at IS NOT NULL AND NEW.off_at < now() THEN
            NEW.off_at := now();
        END IF;
        IF NEW.off_at IS NULL AND NEW.waiting = 'off' THEN
            -- The take-off was withdrawn or turned down.
            NEW.waiting := NULL;
        ELSIF NEW.off_at IS NOT NULL AND v_started AND NOT v_owner AND NEW.waiting IS NULL THEN
            NEW.waiting := 'off';
        END IF;
    ELSE
        NEW.off_by := OLD.off_by;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."stamp_menu_drink"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "stamp_menu_drink" BEFORE INSERT OR UPDATE ON "public"."menu_drinks"
    FOR EACH ROW EXECUTE FUNCTION "private"."stamp_menu_drink"();

-- After: a take-off that is due, with nothing waiting, ends the run now (the
-- record trigger keeps it). A later one waits for the five-minute sweep.
CREATE FUNCTION "private"."end_due_menu_drink"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.off_at IS NOT NULL AND NEW.off_at <= now() AND NEW.waiting IS NULL THEN
        DELETE FROM public.menu_drinks WHERE id = NEW.id;
    END IF;
    RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."end_due_menu_drink"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "end_due_menu_drink" AFTER INSERT OR UPDATE OF "off_at", "waiting" ON "public"."menu_drinks"
    FOR EACH ROW EXECUTE FUNCTION "private"."end_due_menu_drink"();

-- The record (20261202100000), now dated from the row: it went on at
-- on_from (or with the list), came off at off_at (or now), and keeps who
-- added it, what it replaced and its slot. A drink that never went on (still
-- waiting, or planned for later) leaves nothing.
CREATE OR REPLACE FUNCTION "private"."record_menu_drink_removed"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    -- The joins find nothing when the menu or the drink is the row being
    -- deleted (a cascade), so only a drink taken off a live list is kept.
    INSERT INTO public.menu_drinks_removed (
        menu_id, item_id, section_name, price, went_on, came_off, taken_off_by, added_by, replaces_item_id, slot_name
    )
    SELECT m.id, i.id, s.name, coalesce(OLD.price, nullif(btrim(i.price), '')),
           x.went_on, greatest(x.went_on, least(coalesce(OLD.off_at, now()), now())),
           coalesce(OLD.off_by, auth.uid()), OLD.added_by, OLD.replaces_item_id, OLD.slot_name
    FROM public.menus m
    JOIN public.items i ON i.id = OLD.item_id
    LEFT JOIN public.menu_sections s ON s.id = OLD.menu_section_id
    -- A row dated ahead (a script, a skewed clock) went on no later than now.
    CROSS JOIN LATERAL (SELECT least(greatest(coalesce(OLD.on_from, m.starts_at), m.starts_at), now()) AS went_on) x
    WHERE m.id = OLD.menu_id
      AND private.menu_on_now(m.starts_at, m.ends_at)
      AND OLD.waiting IS DISTINCT FROM 'on'
      AND coalesce(OLD.on_from, m.starts_at) <= now();
    RETURN NULL;
END;
$$;

-- The five-minute sweep (20260927100000) also ends the take-offs that came
-- due, and tells Discover about planned drinks that went on since the last
-- sweep.
CREATE OR REPLACE FUNCTION "private"."sweep_menu_dates"() RETURNS integer
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
  DELETE FROM public.menu_drinks WHERE off_at <= now() AND waiting IS NULL;
  SELECT private.discover_mark(ARRAY(
      SELECT DISTINCT md.item_id FROM public.menu_drinks md
      WHERE md.on_from > now() - interval '10 minutes' AND md.on_from <= now()
  ));
  WITH changed AS (
    UPDATE public.menus
    SET is_active = private.menu_on_now(starts_at, ends_at)
    WHERE COALESCE(is_active, false) IS DISTINCT FROM private.menu_on_now(starts_at, ends_at)
    RETURNING 1
  )
  SELECT count(*)::integer FROM changed;
$$;

-- --- 5. Swap on the row ---

-- Swap a drink on a list for another, now or from a date (the next
-- service): the old one comes off then and the new one goes on in its place
-- (section, order, slot), remembering what it replaced. Someone who may not
-- change the list without approval makes both changes wait. Returns the new
-- row.
CREATE FUNCTION "public"."swap_menu_drink"("p_row_id" "uuid", "p_item_id" "uuid", "p_at" timestamp with time zone DEFAULT NULL) RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
    v_old public.menu_drinks%ROWTYPE;
    v_types text[];
    v_kind text;
    v_new uuid;
BEGIN
    SELECT * INTO v_old FROM public.menu_drinks WHERE id = p_row_id;
    IF NOT FOUND OR NOT private.can_edit_menu(v_old.menu_id) THEN
        RAISE EXCEPTION 'menu not found or not yours to edit' USING ERRCODE = '42501';
    END IF;
    IF p_item_id = v_old.item_id THEN
        RAISE EXCEPTION 'that drink is already in this place' USING ERRCODE = '22023';
    END IF;
    SELECT s.allowed_types INTO v_types FROM public.menu_sections s WHERE s.id = v_old.menu_section_id;
    SELECT i.item_type::text INTO v_kind FROM public.items i WHERE i.id = p_item_id;
    IF v_kind IS NULL THEN
        RAISE EXCEPTION 'drink % not found', p_item_id USING ERRCODE = '22023';
    END IF;
    IF v_types IS NOT NULL AND NOT v_kind = ANY (v_types) THEN
        RAISE EXCEPTION '% is not allowed in this section', v_kind USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.menu_drinks (menu_id, menu_section_id, item_id, sort_order, slot_name, replaces_item_id, on_from)
    VALUES (v_old.menu_id, v_old.menu_section_id, p_item_id, v_old.sort_order, v_old.slot_name, v_old.item_id, p_at)
    RETURNING id INTO v_new;
    UPDATE public.menu_drinks SET off_at = coalesce(p_at, now()) WHERE id = p_row_id;
    RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION "public"."swap_menu_drink"("uuid", "uuid", timestamp with time zone) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."swap_menu_drink"("uuid", "uuid", timestamp with time zone) TO "authenticated", "service_role";

-- --- 6. Tasted and approved ---

-- Clearing awaiting_approval (#1023's guard decides who may) stamps who and
-- when; an approver of the bar may also approve a drink that never waited,
-- or clear the stamp. Nobody else touches it. Scripts and app admins as
-- they send it. Runs after guard_item_approval (triggers fire by name).
CREATE FUNCTION "private"."stamp_item_approval"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF auth.uid() IS NULL OR private.is_app_admin()
       OR (NEW.approved_by IS NULL AND private.user_gone(OLD.approved_by)) THEN
        RETURN NEW;
    END IF;
    IF OLD.awaiting_approval AND NOT NEW.awaiting_approval THEN
        NEW.approved_by := auth.uid();
        NEW.approved_at := now();
    ELSIF NEW.approved_at IS DISTINCT FROM OLD.approved_at OR NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN
        IF NEW.bar_id IS NULL OR NEW.bar_id NOT IN (SELECT private.my_approver_bar_ids()) THEN
            RAISE EXCEPTION 'Only someone who edits every kind of drink here can approve it.' USING ERRCODE = '42501';
        END IF;
        IF NEW.approved_at IS NULL THEN
            NEW.approved_by := NULL;
        ELSE
            NEW.approved_by := auth.uid();
            NEW.approved_at := now();
            NEW.awaiting_approval := false;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."stamp_item_approval"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "stamp_item_approval" BEFORE UPDATE OF "awaiting_approval", "approved_at", "approved_by" ON "public"."items"
    FOR EACH ROW EXECUTE FUNCTION "private"."stamp_item_approval"();

-- Drinks approved before today have no stamp: their approval wasn't recorded.

-- --- 7. Who reads a list, and who deletes one ---

-- A list that hasn't started is read by those who build menus, its creator,
-- the prep team once it has a date, and the whole bar once it's shared. A
-- list on now or past, by the whole bar, as before. Home menus as before.
DROP POLICY "menus_select" ON "public"."menus";
CREATE POLICY "menus_select" ON "public"."menus" FOR SELECT TO "authenticated"
    USING (
        (
            "bar_id" IN (SELECT "private"."my_bar_ids"(0) AS "my_bar_ids")
            AND (
                "starts_at" <= "now"()
                OR "team_shared_at" IS NOT NULL
                OR "created_by" = (SELECT "auth"."uid"() AS "uid")
                OR "bar_id" IN (SELECT "private"."bars_with_capability"('menus'::"public"."venue_capability") AS "b")
                OR ("starts_at" IS NOT NULL AND "bar_id" IN (SELECT "private"."bars_with_capability"('prep'::"public"."venue_capability") AS "b"))
            )
        )
        OR ("bar_id" IS NULL AND ("created_by" IS NULL OR "created_by" = (SELECT "auth"."uid"() AS "uid")))
    );

-- A drink planned for later, or waiting to go on, is read like a list that
-- hasn't started: by those who build menus there, the list's creator, who
-- added it, and the whole bar once it's shared.
DROP POLICY "menu_drinks_select" ON "public"."menu_drinks";
CREATE POLICY "menu_drinks_select" ON "public"."menu_drinks" FOR SELECT TO "authenticated"
    USING (
        "menu_id" IN (SELECT "menus"."id" FROM "public"."menus")
        AND (
            (("on_from" IS NULL OR "on_from" <= "now"()) AND "waiting" IS DISTINCT FROM 'on')
            OR "team_shared_at" IS NOT NULL
            OR "added_by" = (SELECT "auth"."uid"() AS "uid")
            OR "menu_id" IN (
                SELECT "m"."id" FROM "public"."menus" "m"
                WHERE "m"."bar_id" IN (SELECT "private"."bars_with_capability"('menus'::"public"."venue_capability") AS "b")
                   OR "m"."created_by" = (SELECT "auth"."uid"() AS "uid")
            )
        )
    );

-- Taking a drink off a list that is on is a dated change: someone who may
-- change the list does it directly; anyone else sets off_at and waits.
-- Drafts, coming-up and past lists as before.
DROP POLICY "menu_drinks_delete" ON "public"."menu_drinks";
CREATE POLICY "menu_drinks_delete" ON "public"."menu_drinks" FOR DELETE TO "authenticated"
    USING (
        "private"."can_edit_menu"("menu_id")
        AND ("private"."may_change_list"("menu_id") OR "waiting" = 'on' AND "added_by" = (SELECT "auth"."uid"() AS "uid")
             OR "menu_id" NOT IN (SELECT "m"."id" FROM "public"."menus" "m" WHERE "private"."menu_on_now"("m"."starts_at", "m"."ends_at")))
    );

-- Only a list that never ran is deleted: by its creator or an Admin. One
-- that ran is ended and hidden. Home menus (no bar) as before.
DROP POLICY "menus_delete" ON "public"."menus";
CREATE POLICY "menus_delete" ON "public"."menus" FOR DELETE TO "authenticated"
    USING (
        "private"."can_build_menu"("bar_id", "created_by")
        AND (
            "bar_id" IS NULL
            OR (
                ("starts_at" IS NULL OR "starts_at" > "now"())
                AND ("created_by" = (SELECT "auth"."uid"() AS "uid") OR "bar_id" IN (SELECT "private"."my_bar_ids"(40) AS "my_bar_ids"))
            )
        )
    );

-- Sharing a list stamps who shared it; unsharing clears it.
CREATE FUNCTION "private"."stamp_menu_team_share"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.team_shared_at IS DISTINCT FROM OLD.team_shared_at THEN
        NEW.team_shared_by := CASE WHEN NEW.team_shared_at IS NULL THEN NULL ELSE coalesce(auth.uid(), NEW.team_shared_by) END;
        IF NEW.team_shared_at IS NOT NULL AND auth.uid() IS NOT NULL THEN
            NEW.team_shared_at := now();
        END IF;
    ELSIF NOT (NEW.team_shared_by IS NULL AND private.user_gone(OLD.team_shared_by)) THEN
        NEW.team_shared_by := OLD.team_shared_by;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."stamp_menu_team_share"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "stamp_menu_team_share" BEFORE UPDATE ON "public"."menus"
    FOR EACH ROW EXECUTE FUNCTION "private"."stamp_menu_team_share"();

-- Touching the lists whose rows changed (20261014500000) bumps only their
-- updated_at, so it runs with the definer's rights: deleting an account
-- nulls added_by and off_by on menu_drinks as the auth service, which may
-- not write menus itself.
CREATE OR REPLACE FUNCTION "private"."touch_menus_of_rows"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    UPDATE public.menus SET updated_at = now()
     WHERE id IN (SELECT DISTINCT changed.menu_id FROM changed WHERE changed.menu_id IS NOT NULL);
    RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."touch_menus_of_rows"() FROM PUBLIC, "anon", "authenticated";

-- --- 8. The daily list ---

-- Each day a daily list is written: who wrote it and the names printed on
-- it (the bartenders on, at Satan's Whiskers). The drinks on it that day
-- come from the record (list_on_day).
CREATE TABLE "public"."menu_days" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "menu_id" "uuid" NOT NULL REFERENCES "public"."menus"("id") ON DELETE CASCADE,
    "day" "date" NOT NULL,
    "written_by" "uuid" DEFAULT "auth"."uid"() REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "names" "text",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "menu_days_one_a_day" UNIQUE ("menu_id", "day"),
    CONSTRAINT "menu_days_names_check" CHECK ("names" IS NULL OR char_length("names") <= 200),
    CONSTRAINT "menu_days_note_check" CHECK ("note" IS NULL OR char_length("note") <= 280)
);

COMMENT ON TABLE "public"."menu_days" IS 'A daily list''s day: who wrote it and the names printed on it. Its drinks that day come from list_on_day.';
CREATE INDEX "menu_days_written_by_idx" ON "public"."menu_days" ("written_by") WHERE "written_by" IS NOT NULL;

ALTER TABLE "public"."menu_days" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menu_days_select" ON "public"."menu_days" FOR SELECT TO "authenticated"
    USING ("menu_id" IN (SELECT "menus"."id" FROM "public"."menus"));
CREATE POLICY "menu_days_insert" ON "public"."menu_days" FOR INSERT TO "authenticated"
    WITH CHECK ("private"."can_edit_menu"("menu_id") AND "written_by" = (SELECT "auth"."uid"() AS "uid"));
CREATE POLICY "menu_days_update" ON "public"."menu_days" FOR UPDATE TO "authenticated"
    USING ("private"."can_edit_menu"("menu_id"))
    WITH CHECK ("private"."can_edit_menu"("menu_id"));
CREATE POLICY "menu_days_delete" ON "public"."menu_days" FOR DELETE TO "authenticated"
    USING ("private"."may_change_list"("menu_id") AND "private"."can_edit_menu"("menu_id"));

REVOKE ALL ON "public"."menu_days" FROM PUBLIC, "anon", "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."menu_days" TO "authenticated";
GRANT ALL ON "public"."menu_days" TO "service_role";

-- The drinks on a list on a day (the bar's day, in its time zone; UTC when
-- it has none): what was on at any moment of it, from the rows on it and the
-- record. Read with the caller's own rights.
CREATE FUNCTION "public"."list_on_day"("p_menu_id" "uuid", "p_day" "date")
    RETURNS TABLE(
        "item_id" "uuid",
        "section_name" "text",
        "slot_name" "text",
        "price" "text",
        "went_on" timestamp with time zone,
        "came_off" timestamp with time zone,
        "added_by" "uuid",
        "replaces_item_id" "uuid"
    )
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
    WITH m AS (
        SELECT m.id, m.starts_at, m.ends_at,
               (p_day::timestamp AT TIME ZONE coalesce(b.timezone, 'UTC')) AS day_start,
               ((p_day + 1)::timestamp AT TIME ZONE coalesce(b.timezone, 'UTC')) AS day_end
        FROM public.menus m
        LEFT JOIN public.bars b ON b.id = m.bar_id
        WHERE m.id = p_menu_id AND m.starts_at IS NOT NULL
    ), rows AS (
        SELECT md.item_id, s.name AS section_name, md.slot_name, coalesce(md.price, nullif(btrim(i.price), '')) AS price,
               greatest(coalesce(md.on_from, m.starts_at), m.starts_at) AS went_on,
               least(md.off_at, m.ends_at) AS came_off,
               md.added_by, md.replaces_item_id, s.sort_order AS s_order, md.sort_order AS d_order
        FROM m
        JOIN public.menu_drinks md ON md.menu_id = m.id AND md.waiting IS DISTINCT FROM 'on'
        JOIN public.items i ON i.id = md.item_id
        LEFT JOIN public.menu_sections s ON s.id = md.menu_section_id
        UNION ALL
        SELECT r.item_id, r.section_name, r.slot_name, r.price, r.went_on, r.came_off, r.added_by, r.replaces_item_id, NULL, NULL
        FROM m
        JOIN public.menu_drinks_removed r ON r.menu_id = m.id
    )
    SELECT r.item_id, r.section_name, r.slot_name, r.price, r.went_on, r.came_off, r.added_by, r.replaces_item_id
    FROM rows r, m
    WHERE r.went_on < m.day_end AND (r.came_off IS NULL OR r.came_off > m.day_start)
    ORDER BY r.s_order NULLS LAST, r.d_order NULLS LAST, r.went_on;
$$;

REVOKE ALL ON FUNCTION "public"."list_on_day"("uuid", "date") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."list_on_day"("uuid", "date") TO "authenticated", "service_role";

-- --- 9. A drink's dates on its lists (#1030, superseded) ---

-- --- Whose menus the caller sees ---

-- A bar page whose menus the caller can see: as get_menu_editions has
-- decided since 20261024200000_page_visibility_ladder.sql (not Private
-- unless it's their team's; public, not moderated and its owner not
-- blocked, or theirs, their bar's or an app admin's). Signed out, or from a
-- job with no caller, that's the public pages.
CREATE FUNCTION "private"."menu_page_shown"("p_profile_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT EXISTS (
        SELECT 1
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
    );
$$;

REVOKE EXECUTE ON FUNCTION "private"."menu_page_shown"("p_profile_id" "uuid") FROM PUBLIC, "anon", "authenticated";

-- --- A drink's dates on its lists ---

CREATE FUNCTION "public"."drink_list_dates"("p_item_ids" "uuid"[])
    RETURNS TABLE(
        "item_id" "uuid",
        "profile_id" "uuid",
        "edition_id" "uuid",
        "edition_name" "text",
        "start_year" smallint,
        "start_month" smallint,
        "starts_on" "date",
        "end_year" smallint,
        "end_month" smallint,
        "ends_on" "date",
        "is_current" boolean
    )
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    WITH asked AS (
        SELECT i.id, i.bar_id, i.created_by
        FROM public.items i
        WHERE i.id = ANY (p_item_ids) AND i.moderated_at IS NULL
    ), venue AS (
        -- On a venue's list now or before, from when it went on (on_from, or
        -- with the list). A drink planned for later, or waiting for approval,
        -- isn't on yet. A planned take-off still to come keeps it on.
        SELECT md.item_id, md.menu_id,
               greatest(coalesce(md.on_from, m.starts_at), m.starts_at) AS went_on,
               CASE WHEN m.ends_at <= now() THEN m.ends_at END AS came_off
        FROM asked a
        JOIN public.menu_drinks md ON md.item_id = a.id
        JOIN public.menus m ON m.id = md.menu_id
        WHERE md.waiting IS DISTINCT FROM 'on'
          AND coalesce(md.on_from, m.starts_at) <= now()
        UNION ALL
        -- Taken off one while it was on (20261202100000).
        SELECT r.item_id, r.menu_id, r.went_on, r.came_off
        FROM asked a
        JOIN public.menu_drinks_removed r ON r.item_id = a.id
    ), stints AS MATERIALIZED (
        -- s: the first day on; e: the day after the last (null while on, or
        -- when nobody knows). Researched menus (bars with no staff yet) are
        -- known to the month; a venue's own, to the day (UTC, as
        -- get_menu_editions dates them).
        SELECT d.item_id, e.profile_id, e.id AS menu_id, e.name AS menu_name, e.is_current AS on_now,
               make_date(e.year, coalesce(e.month, 1), 1) AS s,
               CASE WHEN e.end_year IS NOT NULL THEN (make_date(e.end_year, coalesce(e.end_month, 12), 1) + interval '1 month')::date END AS e,
               e.year AS s_year, e.month AS s_month, NULL::date AS s_day,
               e.end_year AS e_year, e.end_month AS e_month, NULL::date AS e_day
        FROM asked a
        JOIN public.profile_menu_edition_drinks d ON d.item_id = a.id
        JOIN public.profile_menu_editions e ON e.id = d.edition_id
        UNION ALL
        SELECT x.item_id, x.profile_id, x.menu_id, x.menu_name, x.e IS NULL, x.s, x.e,
               extract(year FROM x.s)::smallint, extract(month FROM x.s)::smallint, x.s,
               extract(year FROM x.e - 1)::smallint, extract(month FROM x.e - 1)::smallint, x.e - 1
        FROM (
            SELECT v.item_id, p.id AS profile_id, m.id AS menu_id, m.name AS menu_name,
                   (v.went_on AT TIME ZONE 'UTC')::date AS s,
                   ((v.came_off - interval '1 microsecond') AT TIME ZONE 'UTC')::date + 1 AS e
            FROM venue v
            -- A menu the bar page lists: started, not R&D, and the drink one it shows.
            JOIN public.menus m ON m.id = v.menu_id AND m.kind = 'menu' AND m.starts_at <= now() AND m.hidden_at IS NULL
            JOIN public.profiles p ON p.bar_id = m.bar_id AND p.kind = 'bar'
            JOIN asked a ON a.id = v.item_id AND (a.bar_id = m.bar_id OR (a.bar_id IS NULL AND a.created_by IS NULL))
        ) x
    ), shown AS MATERIALIZED (
        SELECT DISTINCT st.profile_id FROM stints st
    ), reached AS (
        -- How far the bar's earlier stints with the drink reach: one that
        -- starts by then (the same day, or the day after) carries on their run.
        SELECT st.*,
               max(coalesce(st.e, 'infinity')) OVER (
                   PARTITION BY st.item_id, st.profile_id ORDER BY st.s, st.e NULLS LAST, st.menu_id
                   ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
               ) AS reach
        FROM stints st
        WHERE st.profile_id IN (SELECT sh.profile_id FROM shown sh WHERE private.menu_page_shown(sh.profile_id))
    ), numbered AS (
        SELECT r.*,
               count(*) FILTER (WHERE r.reach IS NULL OR r.s > r.reach) OVER (
                   PARTITION BY r.item_id, r.profile_id ORDER BY r.s, r.e NULLS LAST, r.menu_id
                   ROWS UNBOUNDED PRECEDING
               ) AS run
        FROM reached r
    )
    SELECT n.item_id, n.profile_id,
           -- The menu to open: the one on now, else the run's latest.
           (array_agg(n.menu_id ORDER BY n.on_now DESC, n.s DESC, n.menu_name, n.menu_id))[1],
           (array_agg(n.menu_name ORDER BY n.on_now DESC, n.s DESC, n.menu_name, n.menu_id))[1],
           -- From its first menu: to the day when that's known; a year-only start
           -- tied with a month in it stays year-only, as before.
           (array_agg(n.s_year ORDER BY n.s, n.s_day NULLS LAST, n.s_month NULLS FIRST))[1],
           (array_agg(n.s_month ORDER BY n.s, n.s_day NULLS LAST, n.s_month NULLS FIRST))[1],
           (array_agg(n.s_day ORDER BY n.s, n.s_day NULLS LAST, n.s_month NULLS FIRST))[1],
           -- ... to its last, unless one is on now or has no known end.
           CASE WHEN bool_and(n.e IS NOT NULL) THEN (array_agg(n.e_year ORDER BY n.e DESC, n.e_day NULLS LAST))[1] END,
           CASE WHEN bool_and(n.e IS NOT NULL) THEN (array_agg(n.e_month ORDER BY n.e DESC, n.e_day NULLS LAST))[1] END,
           CASE WHEN bool_and(n.e IS NOT NULL) THEN (array_agg(n.e_day ORDER BY n.e DESC, n.e_day NULLS LAST))[1] END,
           bool_or(n.on_now)
    FROM numbered n
    GROUP BY n.item_id, n.profile_id, n.run
    ORDER BY n.item_id, bool_or(n.on_now) DESC, min(n.s) DESC;
$$;

REVOKE ALL ON FUNCTION "public"."drink_list_dates"("p_item_ids" "uuid"[]) FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."drink_list_dates"("p_item_ids" "uuid"[]) TO "anon", "authenticated", "service_role";

-- --- The bar page: its rule now has one home ---

-- As 20261103530000_menu_drink_price.sql; who sees the page is
-- private.menu_page_shown. A hidden list isn't listed, and a list's drinks
-- are the ones on it (not planned for later or waiting to go on).
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
          AND private.menu_page_shown(p.id)
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
          AND m.hidden_at IS NULL
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
                  AND md.waiting IS DISTINCT FROM 'on'
                  AND (md.on_from IS NULL OR md.on_from <= now())
            ), '[]'::jsonb),
            true
        FROM venue v
    )
    SELECT * FROM rows
    ORDER BY year DESC, month DESC NULLS LAST, name
    LIMIT 200;
$function$;

-- --- Discover: venue menus count, read through drink_list_dates ---

-- As 20261024200000_page_visibility_ladder.sql; the menu tier comes from drink_list_dates.
CREATE OR REPLACE FUNCTION private.refresh_discover_facts(p_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_count integer;
BEGIN
    DELETE FROM public.discover_drink_facts f
    WHERE (p_ids IS NULL OR f.item_id = ANY (p_ids))
      AND NOT EXISTS (
          SELECT 1 FROM public.items i JOIN public.profiles p ON p.id = i.origin_bar_profile_id AND p.kind = 'bar'
          LEFT JOIN public.bars ob ON ob.id = p.bar_id
          WHERE i.id = f.item_id AND i.item_type = 'cocktail' AND i.bar_id IS NULL
            AND coalesce(ob.page_visibility, 'description') <> 'private'
      );

    -- Set-wise, one rule at a time over every drink (the LATERALs keep each
    -- rule's patterns hot): Postgres caches 32 compiled patterns, and drink by
    -- drink the 45 rules would recompile every pattern on every row.
    INSERT INTO public.discover_drink_facts AS t ("item_id", "bar_profile_id", "name", "styles", "spirits", "notes", "haystack", "base_rank", "refreshed_at")
    WITH src AS MATERIALIZED (
        SELECT i.id, i.name, i.description, i.origin_bar_profile_id, rf.name AS riff_name,
               CASE WHEN (i.created_by IS NULL AND coalesce(ob.page_visibility, 'description') = 'open') OR ps.id IS NOT NULL THEN (
                   SELECT array_agg(n.name ORDER BY r.sort_order)
                   FROM public.recipes r JOIN public.items n ON n.id = r.ingredient_item_id
                   WHERE r.recipe_item_id = i.id
               ) END AS lines
        FROM public.items i
        JOIN public.profiles p ON p.id = i.origin_bar_profile_id AND p.kind = 'bar'
        LEFT JOIN public.bars ob ON ob.id = p.bar_id
        LEFT JOIN public.items rf ON rf.id = i.riff_of_id
        LEFT JOIN private.published_listing ps ON ps.id = i.id AND ps.effective_mode = 'spec'
        WHERE i.item_type = 'cocktail' AND i.bar_id IS NULL
          AND coalesce(ob.page_visibility, 'description') <> 'private'
          AND (p_ids IS NULL OR i.id = ANY (p_ids))
    ), folded AS MATERIALIZED (
        -- As lib/drinkStyles.ts: the folded name, description, classic, and lines joined by " | ".
        SELECT src.*,
               private.discover_fold_ws(src.name) AS n,
               private.discover_fold_ws(src.description) AS t,
               private.discover_fold_ws(src.riff_name) AS r,
               coalesce((SELECT string_agg(private.discover_fold_ws(x), ' | ' ORDER BY o) FROM unnest(src.lines) WITH ORDINALITY u(x, o)), '') AS i,
               coalesce(cardinality(src.lines), 0) > 0 AS has_lines
        FROM src
    ), d AS MATERIALIZED (
        -- The builds' ingredient tests (stylesOf's CITRUS, SWEET, LONG, BUBBLES, APERITIVO).
        SELECT f.*,
               f.i ~ '\y(lemon|lime|grapefruit|yuzu|citrus|sudachi|calamansi|verjus)\y(?! (twist|peel|zest|wheel|wedge|coin|leaf|oil))|\yacid\y' AS citrus,
               f.i ~ 'syrup|sugar|honey|agave nectar|orgeat|grenadine|cordial|liqueur|triple sec|cointreau|cura[cç]ao|maraschino|falernum|oleo' AS sweet,
               f.i ~ 'soda|\ytonic\y|ginger beer|ginger ale|\ycola\y|seltzer|sparkling water|lemonade|kombucha' AS long,
               f.i ~ 'champagne|prosecco|cava|cremant|sparkling wine|\ysekt\y|lambrusco|franciacorta|pet[- ]nat' AS bubbles,
               f.i ~ 'aperol|campari|aperitiv|select aperitivo|bitter|vermouth|lillet|cocchi|amaro|suze' AS aperitivo,
               f.i ~ 'espresso|coffee|cold brew' AS coffee,
               f.i ~ 'cream|milk' AS cream,
               f.i ~ 'soda' AS soda
        FROM folded f
    ), styled AS (
        -- stylesOf: by the classic it's a version of, its name, its description, or its build (only with lines).
        SELECT x.id, array_agg(s.id ORDER BY s.ord) AS styles
        FROM private.discover_style_rules s
        CROSS JOIN LATERAL (
            SELECT d.id FROM d
            WHERE (d.r <> '' AND d.r = ANY (s.classics))
               OR (s.name_re IS NOT NULL AND d.n ~ s.name_re)
               OR (s.text_re IS NOT NULL AND d.t ~ s.text_re)
               OR (s.riff_re IS NOT NULL AND d.t ~ s.riff_re)
               OR (d.has_lines AND CASE s.id
                      WHEN 'espresso-martini' THEN d.coffee
                      WHEN 'sour' THEN d.citrus AND d.sweet AND NOT d.long AND NOT d.bubbles AND NOT d.cream
                      WHEN 'highball' THEN d.long AND NOT d.bubbles
                      WHEN 'spritz' THEN d.bubbles OR (d.aperitivo AND d.soda)
                      ELSE false
                   END)
        ) x
        GROUP BY x.id
    ), spirited AS (
        -- spiritsOf: from the lines when any match, else the name and description.
        SELECT x.id,
               array_agg(s.id ORDER BY s.ord) FILTER (WHERE x.from_lines) AS from_lines,
               array_agg(s.id ORDER BY s.ord) FILTER (WHERE x.from_words) AS from_words
        FROM private.discover_spirit_rules s
        CROSS JOIN LATERAL (
            SELECT d.id, d.i ~ s.match_re AS from_lines, (d.n || ' | ' || d.t) ~ s.match_re AS from_words FROM d
        ) x
        GROUP BY x.id
    ), run AS (
        -- Its run on its own bar's menus first, as the public sees them (the
        -- 30-second job has no caller): the one on now, else the latest.
        SELECT DISTINCT ON (r.item_id) r.item_id, r.end_year, r.is_current
        FROM public.drink_list_dates(ARRAY(SELECT d.id FROM d)) r
        JOIN d ON d.id = r.item_id
        ORDER BY r.item_id, (r.profile_id = d.origin_bar_profile_id) DESC, r.is_current DESC,
                 r.start_year DESC, r.start_month DESC NULLS LAST
    )
    SELECT d.id, d.origin_bar_profile_id, d.name,
           coalesce(st.styles, '{}'),
           coalesce(sp.from_lines, sp.from_words, '{}'),
           coalesce(fl.notes, '{}'),
           private.discover_fold_ws(concat_ws(' | ', d.name, d.riff_name, d.description, array_to_string(d.lines, ' | '))),
           (CASE WHEN run.is_current THEN 0 WHEN run.end_year IS NOT NULL THEN 2 ELSE 1 END) * 4
             + CASE WHEN hero.has THEN 0 ELSE 2 END
             + CASE WHEN d.name ~ '^[[:alpha:]]' THEN 0 ELSE 1 END,
           now()
    FROM d
    LEFT JOIN styled st ON st.id = d.id
    LEFT JOIN spirited sp ON sp.id = d.id
    LEFT JOIN LATERAL (
        SELECT true AS has FROM public.item_images ii WHERE ii.item_id = d.id AND ii.angle = 'hero' LIMIT 1
    ) hero ON true
    LEFT JOIN run ON run.item_id = d.id
    LEFT JOIN LATERAL (
        SELECT array_remove(ARRAY[
            CASE WHEN f.sweet >= 0.4 THEN 'sweet' END,
            CASE WHEN f.sour >= 0.4 THEN 'sour' END,
            CASE WHEN f.bitter >= 0.4 THEN 'bitter' END,
            CASE WHEN f.botanical >= 0.4 THEN 'botanical' END,
            CASE WHEN f.herbal >= 0.4 THEN 'herbal' END,
            CASE WHEN f.fruity >= 0.4 THEN 'fruity' END,
            CASE WHEN f.spiced >= 0.4 THEN 'spiced' END,
            CASE WHEN f.spicy >= 0.4 THEN 'spicy' END,
            CASE WHEN f.smoky >= 0.4 THEN 'smoky' END,
            CASE WHEN f.savory >= 0.4 THEN 'savory' END,
            CASE WHEN f.creamy >= 0.4 THEN 'creamy' END
        ], NULL) AS notes
        FROM public.item_flavors f
        WHERE f.item_id = d.id AND f.coverage >= 0.5
    ) fl ON true
    ON CONFLICT ("item_id") DO UPDATE SET
        "bar_profile_id" = EXCLUDED."bar_profile_id",
        "name" = EXCLUDED."name",
        "styles" = EXCLUDED."styles",
        "spirits" = EXCLUDED."spirits",
        "notes" = EXCLUDED."notes",
        "haystack" = EXCLUDED."haystack",
        "base_rank" = EXCLUDED."base_rank",
        "refreshed_at" = EXCLUDED."refreshed_at";
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$function$;

-- As 20261028100000_discover_mixed.sql; menu_run comes from drink_list_dates.
CREATE OR REPLACE FUNCTION "public"."discover_list"(
    "p_latitude" double precision DEFAULT NULL,
    "p_longitude" double precision DEFAULT NULL,
    "p_radius_km" double precision DEFAULT 10,
    "p_country_code" "text" DEFAULT NULL,
    "p_city" "text" DEFAULT NULL,
    "p_bar_id" "uuid" DEFAULT NULL,
    "p_styles" "text"[] DEFAULT NULL,
    "p_spirits" "text"[] DEFAULT NULL,
    "p_notes" "text"[] DEFAULT NULL,
    "p_query" "text" DEFAULT NULL,
    "p_after_rank" smallint DEFAULT NULL,
    "p_after_name" "text" DEFAULT NULL,
    "p_after_id" "uuid" DEFAULT NULL,
    "p_limit" integer DEFAULT 30,
    "p_from_latitude" double precision DEFAULT NULL,
    "p_from_longitude" double precision DEFAULT NULL,
    "p_after_distance" integer DEFAULT NULL,
    "p_on_now" boolean DEFAULT false,
    "p_mix" boolean DEFAULT false,
    "p_after_pos" integer DEFAULT NULL
) RETURNS TABLE(
    "id" "uuid",
    "name" "text",
    "description" "text",
    "image_url" "text",
    "bar_profile_id" "uuid",
    "bar_handle" "text",
    "bar_name" "text",
    "bar_logo" "text",
    "bar_locality" "text",
    "bar_city" "text",
    "menu_run" smallint[],
    "rank" smallint,
    "total_drinks" integer,
    "total_bars" integer,
    "match_kind" "text",
    "match_text" "text",
    "distance_m" integer,
    "styles" "text"[],
    "mix_pos" integer
)
    LANGUAGE "plpgsql" STABLE SECURITY INVOKER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_point boolean := p_latitude IS NOT NULL;
    v_from boolean := p_from_latitude IS NOT NULL;
    -- Mixed: a bar at a time (not for Nearest, or one bar's own list).
    v_mix boolean := coalesce(p_mix, false) AND p_from_latitude IS NULL AND p_bar_id IS NULL;
    v_radius double precision := least(greatest(coalesce(p_radius_km, 10), 0.1), 200);
    v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 500);
    v_words text[];
    v_dlat double precision;
    v_dlng double precision;
BEGIN
    IF (p_latitude IS NULL) <> (p_longitude IS NULL) THEN
        RAISE EXCEPTION 'A point needs both a latitude and a longitude.' USING ERRCODE = '22023';
    END IF;
    IF v_point AND (p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180) THEN
        RAISE EXCEPTION 'That point is off the map.' USING ERRCODE = '22023';
    END IF;
    IF (p_after_id IS NULL) <> (p_after_rank IS NULL) OR (p_after_id IS NULL) <> (p_after_name IS NULL) THEN
        RAISE EXCEPTION 'A cursor needs its rank, name and id.' USING ERRCODE = '22023';
    END IF;
    IF (p_from_latitude IS NULL) <> (p_from_longitude IS NULL)
       OR (v_from AND (p_from_latitude NOT BETWEEN -90 AND 90 OR p_from_longitude NOT BETWEEN -180 AND 180)) THEN
        RAISE EXCEPTION 'Nearest needs a point on the map.' USING ERRCODE = '22023';
    END IF;
    IF v_from AND p_after_id IS NOT NULL AND p_after_distance IS NULL THEN
        RAISE EXCEPTION 'A nearest cursor needs its distance.' USING ERRCODE = '22023';
    END IF;
    IF p_after_pos IS NOT NULL AND NOT v_mix THEN
        RAISE EXCEPTION 'A mixed cursor needs the mixed list.' USING ERRCODE = '22023';
    END IF;
    IF v_point THEN
        v_dlat := v_radius / 111.045;
        v_dlng := v_radius / (111.045 * greatest(cos(radians(p_latitude)), 0.01));
    END IF;
    SELECT array_agg(w) INTO v_words
    FROM regexp_split_to_table(private.discover_fold_ws(p_query), '\s+') w
    WHERE w <> '';

    RETURN QUERY
    WITH bars AS (
        SELECT p.id, p.handle, p.display_name, p.avatar_url, p.locality, p.city,
               CASE WHEN v_words IS NOT NULL THEN private.discover_fold_ws(p.display_name) END AS folded,
               CASE WHEN v_from THEN round(1000 * 2 * 6371.0088 * asin(least(1, sqrt(
                   power(sin(radians(p.latitude - p_from_latitude) / 2), 2)
                   + cos(radians(p_from_latitude)) * cos(radians(p.latitude)) * power(sin(radians(p.longitude - p_from_longitude) / 2), 2)
               ))))::integer END AS distance_m,
               -- Mixed: how far from the area's middle, so the nearer of two equal bars goes first.
               CASE WHEN v_mix AND v_point AND p.latitude IS NOT NULL THEN round(1000 * 2 * 6371.0088 * asin(least(1, sqrt(
                   power(sin(radians(p.latitude - p_latitude) / 2), 2)
                   + cos(radians(p_latitude)) * cos(radians(p.latitude)) * power(sin(radians(p.longitude - p_longitude) / 2), 2)
               ))))::integer END AS mix_m
        FROM public.profiles p
        WHERE p.kind = 'bar' AND p.is_public AND NOT p.is_closed
          -- A bar the viewer hid keeps its drinks off the list, except on its own page.
          AND (p_bar_id IS NOT NULL OR NOT EXISTS (SELECT 1 FROM public.hidden_bars h WHERE h.profile_id = p.id AND h.user_id = (SELECT auth.uid())))
          AND (NOT v_from OR (p.latitude IS NOT NULL AND p.longitude IS NOT NULL))
          AND (p_bar_id IS NULL OR p.id = p_bar_id)
          AND (p_bar_id IS NOT NULL OR p_country_code IS NULL OR v_point OR p.country_code = upper(p_country_code))
          AND (p_bar_id IS NOT NULL OR p_city IS NULL OR v_point OR lower(p.city) = lower(p_city))
          AND (p_bar_id IS NOT NULL OR NOT v_point OR (
              p.latitude BETWEEN p_latitude - v_dlat AND p_latitude + v_dlat
              AND (
                  v_dlng >= 180
                  OR p.longitude BETWEEN p_longitude - v_dlng AND p_longitude + v_dlng
                  OR p.longitude >= p_longitude - v_dlng + 360
                  OR p.longitude <= p_longitude + v_dlng - 360
              )
              AND 2 * 6371.0088 * asin(least(1, sqrt(
                  power(sin(radians(p.latitude - p_latitude) / 2), 2)
                  + cos(radians(p_latitude)) * cos(radians(p.latitude)) * power(sin(radians(p.longitude - p_longitude) / 2), 2)
              ))) <= v_radius
          ))
    ), standing AS MATERIALIZED (
        -- Each bar's standing for the drinks' ties (not needed for Nearest): 0 the viewer loves it,
        -- 1 relevance 40 or more, 3 stale, else 2.
        SELECT r.id, CASE WHEN r.loved THEN 0 WHEN r.relevance >= 40 THEN 1 WHEN r.stale THEN 3 ELSE 2 END AS bucket
        FROM private.bar_relevance(ARRAY(SELECT bars.id FROM bars WHERE NOT v_from)) r
    ), matched AS MATERIALIZED (
        SELECT f.item_id, f.name, f.bar_profile_id, f.base_rank, f.haystack, f.styles, b.folded AS bar_folded, b.distance_m, b.mix_m,
               coalesce(st.bucket, 2) AS bucket
        FROM public.discover_drink_facts f
        JOIN bars b ON b.id = f.bar_profile_id
        LEFT JOIN standing st ON st.id = f.bar_profile_id
        WHERE (NOT coalesce(p_on_now, false) OR f.base_rank < 4)
          AND (p_styles IS NULL OR f.styles && p_styles)
          AND (p_spirits IS NULL OR f.spirits && p_spirits)
          AND (p_notes IS NULL OR f.notes && p_notes)
          AND (v_words IS NULL OR NOT EXISTS (
              SELECT 1 FROM unnest(v_words) w
              WHERE strpos(f.haystack, w) = 0 AND strpos(b.folded, w) = 0
          ))
    ), hits AS MATERIALIZED (
        -- With a search: the name holds every word (tier 0), else the classic's name does (12), else 24.
        -- Then, within that, its bar's standing: rank = (base_rank + tier) x 4 + bucket. The app
        -- only hands rank back as the cursor, so old builds page through this order unchanged.
        SELECT m.item_id, m.name, m.bar_profile_id, m.distance_m, m.styles, m.mix_m,
               ((m.base_rank + CASE
                   WHEN v_words IS NULL OR private.discover_has_all(private.discover_fold_ws(m.name), v_words) THEN 0
                   -- Looked up only for drinks whose own name missed.
                   WHEN coalesce((
                       SELECT private.discover_has_all(private.discover_fold_ws(rf.name), v_words)
                       FROM public.items i JOIN public.items rf ON rf.id = i.riff_of_id
                       WHERE i.id = m.item_id
                   ), false) THEN 12
                   ELSE 24
               END) * 4 + m.bucket)::smallint AS rank
        FROM matched m
    ), spread AS (
        -- Mixed: each bar's drinks take turns by style (its first Martini, its first Sour, then its second Martini),
        -- best tier first, and a fixed shuffle rather than A to Z among equals.
        SELECT h.item_id, h.bar_profile_id, h.rank, h.mix_m,
               row_number() OVER (PARTITION BY h.bar_profile_id, coalesce(h.styles[1], '') ORDER BY h.rank, md5(h.item_id::text)) AS style_turn
        FROM hits h
        WHERE v_mix
    ), rounds AS (
        SELECT s.*, row_number() OVER (PARTITION BY s.bar_profile_id ORDER BY s.rank, s.style_turn, md5(s.item_id::text)) AS round
        FROM spread s
    ), mixed AS (
        -- Round 1 is one drink from every bar, round 2 the next, and so on. Within a round, nearer bars
        -- first in bands that double (under 1.6 km, then 3.2, 6.4...), so a famous bar across town
        -- doesn't come before the one on the corner; within a band the better rank (tier and the
        -- bar's standing), then the nearer bar.
        -- ponytail: the cursor is a position in this order, so a drink added between two pages can shift
        -- the second page by a row. Fine for a browse list; a keyset on (round, rank, mix_m, bar) if it isn't.
        SELECT r.item_id, row_number() OVER (
                   ORDER BY r.round,
                            CASE WHEN r.mix_m IS NULL THEN 99 ELSE floor(log(2, greatest(r.mix_m, 800) / 800.0))::integer END,
                            r.rank, r.mix_m NULLS LAST, md5(r.bar_profile_id::text), r.item_id
               )::integer AS pos
        FROM rounds r
    ), keyed AS (
        -- What the page sorts on: the position when mixed, the distance for Nearest, else the rank.
        SELECT h.*, CASE WHEN v_from THEN h.distance_m ELSE h.rank END AS sort_key, x.pos
        FROM hits h LEFT JOIN mixed x ON x.item_id = h.item_id
    ), totals AS (
        SELECT count(*)::integer AS drinks, count(DISTINCT h.bar_profile_id)::integer AS bars
        FROM hits h
        WHERE p_after_id IS NULL AND p_after_pos IS NULL
    ), page AS (
        SELECT k.* FROM keyed k
        WHERE CASE WHEN v_mix THEN p_after_pos IS NULL OR k.pos > p_after_pos
                   ELSE p_after_id IS NULL
                     OR (k.sort_key, k.name, k.item_id) > (CASE WHEN v_from THEN p_after_distance ELSE p_after_rank END, p_after_name, p_after_id)
              END
        ORDER BY k.pos, k.sort_key, k.name, k.item_id
        LIMIT v_limit
    )
    SELECT pg.item_id, i.name, i.description, hero.url, pg.bar_profile_id,
           b.handle, b.display_name, b.avatar_url, b.locality, b.city,
           CASE WHEN run.start_year IS NOT NULL THEN
               ARRAY[run.start_year, run.start_month, run.end_year, run.end_month, run.is_current::integer::smallint]
           END,
           pg.rank,
           CASE WHEN p_after_id IS NULL AND p_after_pos IS NULL THEN (SELECT t.drinks FROM totals t) END,
           CASE WHEN p_after_id IS NULL AND p_after_pos IS NULL THEN (SELECT t.bars FROM totals t) END,
           why.kind,
           why.text,
           pg.distance_m,
           pg.styles,
           pg.pos
    FROM page pg
    JOIN public.items i ON i.id = pg.item_id
    JOIN bars b ON b.id = pg.bar_profile_id
    JOIN matched m ON m.item_id = pg.item_id
    LEFT JOIN public.items rf ON rf.id = i.riff_of_id
    -- The hero: photos before sketches, then their saved order (lib/itemImages.ts orderedPictures).
    LEFT JOIN LATERAL (
        SELECT im.url
        FROM public.item_images ii JOIN public.images im ON im.id = ii.image_id
        WHERE ii.item_id = pg.item_id AND ii.angle = 'hero'
        ORDER BY ii.is_generated, coalesce(ii.sort_order, 0)
        LIMIT 1
    ) hero ON true
    LEFT JOIN LATERAL (
        SELECT r.start_year, r.start_month, r.end_year, r.end_month, r.is_current
        FROM public.drink_list_dates(ARRAY[pg.item_id]) r
        ORDER BY (r.profile_id = pg.bar_profile_id) DESC, r.is_current DESC, r.start_year DESC, r.start_month DESC NULLS LAST
        LIMIT 1
    ) run ON true
    LEFT JOIN LATERAL (
        SELECT * FROM private.discover_match_why(v_words, i.name, rf.name, i.description, m.haystack, m.bar_folded)
    ) why ON v_words IS NOT NULL
    ORDER BY pg.pos, pg.sort_key, pg.name, pg.item_id;
END;
$$;


-- As 20261024200000_page_visibility_ladder.sql; menu_run comes from drink_list_dates.
CREATE OR REPLACE FUNCTION public.discover_drinks(p_latitude double precision DEFAULT NULL::double precision, p_longitude double precision DEFAULT NULL::double precision, p_radius_km double precision DEFAULT 10, p_country_code text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_query text DEFAULT NULL::text, p_after uuid DEFAULT NULL::uuid, p_before uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 1000)
 RETURNS TABLE(id uuid, name text, description text, riff_of text, ingredients text[], image_url text, bar_profile_id uuid, menu_run smallint[], notes text[])
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE
    v_point boolean := p_latitude IS NOT NULL;
    v_radius double precision := least(greatest(coalesce(p_radius_km, 10), 0.1), 200);
    v_limit integer := least(greatest(coalesce(p_limit, 1000), 1), 1000);
    v_words text[];
    v_dlat double precision;
    v_dlng double precision;
BEGIN
    IF (p_latitude IS NULL) <> (p_longitude IS NULL) THEN
        RAISE EXCEPTION 'A point needs both a latitude and a longitude.' USING ERRCODE = '22023';
    END IF;
    IF v_point AND (p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180) THEN
        RAISE EXCEPTION 'That point is off the map.' USING ERRCODE = '22023';
    END IF;
    IF v_point THEN
        v_dlat := v_radius / 111.045;
        v_dlng := v_radius / (111.045 * greatest(cos(radians(p_latitude)), 0.01));
    END IF;
    SELECT array_agg(w) INTO v_words
    FROM regexp_split_to_table(public.discover_fold(p_query), '\s+') w
    WHERE w <> '';

    RETURN QUERY
    WITH bars AS (
        SELECT p.id, p.display_name
        FROM public.profiles p
        WHERE p.kind = 'bar' AND p.is_public AND NOT p.is_closed
          AND p.id NOT IN (SELECT private.private_page_profile_ids())
          AND (p_country_code IS NULL OR v_point OR p.country_code = upper(p_country_code))
          AND (p_city IS NULL OR v_point OR lower(p.city) = lower(p_city))
          AND (NOT v_point OR (
              p.latitude BETWEEN p_latitude - v_dlat AND p_latitude + v_dlat
              AND (
                  v_dlng >= 180
                  OR p.longitude BETWEEN p_longitude - v_dlng AND p_longitude + v_dlng
                  -- Across the antimeridian.
                  OR p.longitude >= p_longitude - v_dlng + 360
                  OR p.longitude <= p_longitude + v_dlng - 360
              )
              -- Haversine, as private.distance_km.
              AND 2 * 6371.0088 * asin(least(1, sqrt(
                  power(sin(radians(p.latitude - p_latitude) / 2), 2)
                  + cos(radians(p_latitude)) * cos(radians(p.latitude)) * power(sin(radians(p.longitude - p_longitude) / 2), 2)
              ))) <= v_radius
          ))
    ), drinks AS (
        SELECT i.id, i.name, i.description, i.riff_of_id, i.origin_bar_profile_id, b.display_name AS bar_name
        FROM public.items i
        JOIN bars b ON b.id = i.origin_bar_profile_id
        WHERE i.item_type = 'cocktail' AND i.bar_id IS NULL
          AND (p_after IS NULL OR i.id > p_after)
          AND (p_before IS NULL OR i.id < p_before)
    ), described AS (
        SELECT d.*, rf.name AS riff_name, ing.names
        FROM drinks d
        LEFT JOIN public.items rf ON rf.id = d.riff_of_id
        -- Ingredients through the role-masked recipe view, as the app read
        -- them. Ids first, then names by id: joining items inside the view's
        -- lateral planned a scan of every item per drink.
        LEFT JOIN LATERAL (
            SELECT array_agg(r.display_ingredient_id ORDER BY r.sort_order) AS ids
            FROM public.app_recipe_presentation r
            WHERE r.recipe_item_id = d.id AND r.display_ingredient_id IS NOT NULL
        ) rec ON true
        LEFT JOIN LATERAL (
            SELECT array_agg(n.name ORDER BY u.ord) AS names
            FROM unnest(rec.ids) WITH ORDINALITY u(id, ord)
            JOIN public.items n ON n.id = u.id
        ) ing ON true
        WHERE v_words IS NULL OR NOT EXISTS (
            SELECT 1 FROM unnest(v_words) w
            WHERE strpos(
                public.discover_fold(concat_ws(' | ', d.name, rf.name, d.description, array_to_string(ing.names, ' | '), d.bar_name)),
                w
            ) = 0
        )
        ORDER BY d.id
        LIMIT v_limit
    ), heroes AS MATERIALIZED (
        -- The hero: photos before sketches, then their saved order
        -- (lib/itemImages.ts orderedPictures). One read for the page: a
        -- lateral per drink scanned item_images each time.
        SELECT DISTINCT ON (ii.item_id) ii.item_id, im.url
        FROM public.item_images ii
        JOIN public.images im ON im.id = ii.image_id
        WHERE ii.item_id IN (SELECT x.id FROM described x) AND ii.angle = 'hero'
        ORDER BY ii.item_id, ii.is_generated, coalesce(ii.sort_order, 0)
    )
    SELECT x.id, x.name, x.description, x.riff_name, coalesce(x.names, '{}'), img.url, x.origin_bar_profile_id,
           CASE WHEN run.start_year IS NOT NULL THEN
               ARRAY[run.start_year, run.start_month, run.end_year, run.end_month, run.is_current::integer::smallint]
           END,
           coalesce(fl.notes, '{}')
    FROM described x
    LEFT JOIN heroes img ON img.item_id = x.id
    -- Its run on its own bar's menus first.
    LEFT JOIN LATERAL (
        SELECT r.start_year, r.start_month, r.end_year, r.end_month, r.is_current
        FROM public.drink_list_dates(ARRAY[x.id]) r
        ORDER BY (r.profile_id = x.origin_bar_profile_id) DESC, r.is_current DESC, r.start_year DESC, r.start_month DESC NULLS LAST
        LIMIT 1
    ) run ON true
    LEFT JOIN LATERAL (
        SELECT array_remove(ARRAY[
            CASE WHEN f.sweet >= 0.4 THEN 'sweet' END,
            CASE WHEN f.sour >= 0.4 THEN 'sour' END,
            CASE WHEN f.bitter >= 0.4 THEN 'bitter' END,
            CASE WHEN f.botanical >= 0.4 THEN 'botanical' END,
            CASE WHEN f.herbal >= 0.4 THEN 'herbal' END,
            CASE WHEN f.fruity >= 0.4 THEN 'fruity' END,
            CASE WHEN f.spiced >= 0.4 THEN 'spiced' END,
            CASE WHEN f.spicy >= 0.4 THEN 'spicy' END,
            CASE WHEN f.smoky >= 0.4 THEN 'smoky' END,
            CASE WHEN f.savory >= 0.4 THEN 'savory' END,
            CASE WHEN f.creamy >= 0.4 THEN 'creamy' END
        ], NULL) AS notes
        FROM public.item_flavors f
        WHERE f.item_id = x.id AND f.coverage >= 0.5
    ) fl ON true
    ORDER BY x.id;
END;
$function$;

-- --- Search over bars' drinks (no screen calls it since 8 Oct; kept for old builds) ---

-- As 20261008800000_db_indexes.sql, with the matches' runs read once.
CREATE OR REPLACE FUNCTION "public"."search_bar_drinks"("p_query" "text", "p_limit" integer DEFAULT 48)
RETURNS TABLE("item_id" "uuid", "credit" "text", "edition_id" "uuid", "edition_name" "text", "start_year" smallint, "start_month" smallint, "end_year" smallint, "end_month" smallint, "is_current" boolean)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
    WITH q AS (
        SELECT lower(btrim(p_query)) AS text,
               replace(replace(replace(lower(btrim(p_query)), '\', '\\'), '%', '\%'), '_', '\_') AS pat
    ), matched AS MATERIALIZED (
        SELECT i.id, i.name, coalesce(b.display_name, c.display_name) AS credit, lower(i.name) LIKE q.pat || '%' AS starts
        FROM public.items i
        CROSS JOIN q
        LEFT JOIN public.profiles b ON b.id = i.origin_bar_profile_id
        LEFT JOIN public.profiles c ON c.id = i.creator_profile_id
        WHERE i.item_type = 'cocktail'
          AND i.bar_id IS NULL
          AND i.moderated_at IS NULL
          -- Credited to a bar or bartender the reader can see (a hidden profile's
          -- drinks stay out, as on Discover).
          AND (b.id IS NOT NULL OR c.id IS NOT NULL)
          AND q.text <> ''
          AND (
              lower(i.name) LIKE '%' || q.pat || '%'
              OR lower(i.description) LIKE '%' || q.pat || '%'
              OR lower(b.display_name) LIKE '%' || q.pat || '%'
              OR lower(c.display_name) LIKE '%' || q.pat || '%'
              OR (
                  -- Only the drink's editors can read its lines.
                  (coalesce(i.created_by = auth.uid(), false) OR (SELECT private.is_app_admin()))
                  AND EXISTS (
                      SELECT 1 FROM public.recipes rc
                      JOIN public.items ing ON ing.id = rc.ingredient_item_id
                      WHERE rc.recipe_item_id = i.id AND lower(ing.name) LIKE '%' || q.pat || '%'
                  )
              )
          )
    )
    SELECT m.id, m.credit, r.edition_id, r.edition_name, r.start_year, r.start_month, r.end_year, r.end_month, r.is_current
    FROM matched m
    LEFT JOIN (
        -- One row a bar, as before: its run on now, else its latest.
        SELECT DISTINCT ON (x.item_id, x.profile_id) x.*
        FROM public.drink_list_dates(ARRAY(SELECT y.id FROM matched y)) x
        ORDER BY x.item_id, x.profile_id, x.is_current DESC, x.start_year DESC, x.start_month DESC NULLS LAST
    ) r ON r.item_id = m.id
    ORDER BY
        CASE WHEN r.is_current THEN 0 WHEN r.item_id IS NULL THEN 1 WHEN r.end_year IS NULL THEN 2 ELSE 3 END,
        m.starts DESC,
        m.name, m.id
    LIMIT least(greatest(coalesce(p_limit, 48), 1), 100);
$$;


-- --- Discover hears about venue menus ---

-- As 20261009700000_discover_index.sql, plus a venue's menus: a drink put
-- on or taken off one, and a menu going on, coming off or moving, marks
-- its drinks for the 30-second job.
CREATE OR REPLACE FUNCTION "private"."discover_mark_trigger"()
    RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_new jsonb := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;
    v_old jsonb := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
BEGIN
    IF TG_TABLE_NAME = 'items' THEN
        -- Only bar drinks, before or after; a drink edit that changes nothing Discover reads is still cheap to redo.
        IF (v_new IS NOT NULL AND v_new->>'item_type' = 'cocktail' AND v_new->>'bar_id' IS NULL AND v_new->>'origin_bar_profile_id' IS NOT NULL)
           OR (v_old IS NOT NULL AND v_old->>'item_type' = 'cocktail' AND v_old->>'bar_id' IS NULL AND v_old->>'origin_bar_profile_id' IS NOT NULL) THEN
            PERFORM private.discover_mark(ARRAY[(coalesce(v_new, v_old)->>'id')::uuid]);
        END IF;
    ELSIF TG_TABLE_NAME = 'recipes' THEN
        PERFORM private.discover_mark(ARRAY[(v_new->>'recipe_item_id')::uuid, (v_old->>'recipe_item_id')::uuid]);
    ELSIF TG_TABLE_NAME IN ('item_flavors', 'item_images', 'profile_menu_edition_drinks', 'menu_drinks', 'menu_drinks_removed') THEN
        PERFORM private.discover_mark(ARRAY[(v_new->>'item_id')::uuid, (v_old->>'item_id')::uuid]);
    ELSIF TG_TABLE_NAME = 'profile_menu_editions' THEN
        PERFORM private.discover_mark(ARRAY(
            SELECT d.item_id FROM public.profile_menu_edition_drinks d
            WHERE d.edition_id IN ((v_new->>'id')::uuid, (v_old->>'id')::uuid)
        ));
    ELSIF TG_TABLE_NAME = 'menus' THEN
        PERFORM private.discover_mark(ARRAY(
            SELECT md.item_id FROM public.menu_drinks md WHERE md.menu_id = (v_new->>'id')::uuid
            UNION
            SELECT r.item_id FROM public.menu_drinks_removed r WHERE r.menu_id = (v_new->>'id')::uuid
        ));
    ELSIF TG_TABLE_NAME = 'bars' THEN
        IF v_new->>'page_visibility' IS DISTINCT FROM v_old->>'page_visibility' THEN
            PERFORM private.discover_mark(ARRAY(
                SELECT i.id FROM public.items i JOIN public.profiles p ON p.id = i.origin_bar_profile_id
                WHERE p.bar_id = (v_new->>'id')::uuid AND i.item_type = 'cocktail' AND i.bar_id IS NULL
            ));
        END IF;
    END IF;
    RETURN NULL;
END;
$$;

-- save_menu rewrites the order of the drinks that stay: only a drink moving
-- to another menu, or swapped for another, counts. A deleted menu's drinks
-- go by cascade, which the delete triggers see.
CREATE TRIGGER "discover_mark" AFTER INSERT OR DELETE OR UPDATE OF "item_id", "menu_id", "on_from", "waiting" ON "public"."menu_drinks"
    FOR EACH ROW EXECUTE FUNCTION "private"."discover_mark_trigger"();
CREATE TRIGGER "discover_mark" AFTER DELETE ON "public"."menu_drinks_removed"
    FOR EACH ROW EXECUTE FUNCTION "private"."discover_mark_trigger"();
-- Going on, coming off (the five-minute sweep flips is_active), going back
-- to a draft or R&D, or moving to another venue.
CREATE TRIGGER "discover_mark" AFTER UPDATE OF "starts_at", "ends_at", "is_active", "kind", "bar_id", "hidden_at" ON "public"."menus"
    FOR EACH ROW EXECUTE FUNCTION "private"."discover_mark_trigger"();

-- The drinks on venue menus today, so a staffed bar's menu on now counts
-- without waiting for its next change.
SELECT private.discover_mark(ARRAY(
    SELECT DISTINCT md.item_id
    FROM public.menu_drinks md
    JOIN public.menus m ON m.id = md.menu_id
    JOIN public.items i ON i.id = md.item_id
    WHERE m.bar_id IS NOT NULL AND m.kind = 'menu' AND m.starts_at IS NOT NULL
      AND i.item_type = 'cocktail' AND i.bar_id IS NULL
));
