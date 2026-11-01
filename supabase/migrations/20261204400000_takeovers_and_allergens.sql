-- Takeovers, allergens checked by the bar, and private guest allergies
-- (decision page, 1 Nov 2026: takeovers, allergen-check, guest-allergies,
-- guest-allergen-read).
--
-- Takeovers: one page both bars share.
--   * A takeover is a list (menus.list_type 'takeover', 20261203100000) at
--     the host bar, on beside the house list for its nights. Its nights are
--     events rows (kind 'takeover', menu_id the list, house_menu_on), so they
--     reach This week and calendars as before. The guest bar is the list's
--     run sheet guest party, its one home.
--   * The guest bar's team reads the takeover list and its run sheet while
--     it runs (and 14 days after); guest bartenders work on it through a
--     role at the host that ends (menus.change_role_id: a venue role with an
--     end, below Admin). They change that list directly, without the menus
--     permission (which would open every house list and costs). An invite
--     can now carry that role (invite_to_role, bar_invites.venue_role_id),
--     and accepting it never moves an existing member onto it.
--   * A run-sheet link for each party with no account: the app saves the
--     party's list (who brings what, the margin, bottles to buy; no specs)
--     behind a secret token; run_sheet_link(token) reads it signed out until
--     14 days after the list ends. menus.run_margin_pct is the margin's one
--     home (10 by default; it was screen state).
--
-- Allergens checked by the bar, with a date:
--   * items.allergens_checked_at, _by and _spec: "Checked by the bar, date"
--     for a venue drink, with a fingerprint of what was checked (the spec's
--     lines down through house-made ingredients, and every declaration that
--     applies). A check counts only while the fingerprint still matches, so
--     any change to the spec or what it is made of clears it.
--   * The roll-up drink_allergens did has one home (private.allergen_rollup);
--     drink_allergens adds the check for staff, and guest_drink_allergens
--     gives anyone, signed out too, every allergen of a drink they may see,
--     the unchecked count and the check's date (never who checked).
--
-- Private guest allergies: user_prefs.allergies, read and written by its
-- owner only; the app matches on the phone and keeps a copy there for a
-- guest who hasn't signed in.

-- --- 1. Takeovers ---

ALTER TABLE "public"."menus" ADD COLUMN "run_margin_pct" smallint DEFAULT 10 NOT NULL;
ALTER TABLE "public"."menus" ADD CONSTRAINT "menus_run_margin_pct_check" CHECK ("run_margin_pct" BETWEEN 0 AND 100);
COMMENT ON COLUMN "public"."menus"."run_margin_pct" IS 'The run sheet''s margin on what to buy, in percent (10 by default).';

-- A takeover's guest role ends, and is never an Admin's.
CREATE FUNCTION "private"."guard_takeover_list"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.list_type = 'takeover' AND NEW.change_role_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.venue_roles vr
        WHERE vr.id = NEW.change_role_id AND vr.ends_at IS NOT NULL AND vr.base_level < 40
    ) THEN
        RAISE EXCEPTION 'A takeover''s guest role needs an end date, and can''t be an Admin role.' USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."guard_takeover_list"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "guard_takeover_list" BEFORE INSERT OR UPDATE OF "list_type", "change_role_id" ON "public"."menus"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_takeover_list"();

-- A takeover list's nights are takeover events.
CREATE FUNCTION "private"."guard_takeover_night"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.menu_id IS NOT NULL AND NEW.kind IS DISTINCT FROM 'takeover'
       AND EXISTS (SELECT 1 FROM public.menus m WHERE m.id = NEW.menu_id AND m.list_type = 'takeover') THEN
        RAISE EXCEPTION 'A takeover list''s nights are takeover events.' USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."guard_takeover_night"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "guard_takeover_night" BEFORE INSERT OR UPDATE OF "menu_id", "kind" ON "public"."events"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_takeover_night"();

-- The caller is a guest bartender on this takeover: their role at the host
-- is the list's, and it hasn't ended.
CREATE FUNCTION "private"."is_takeover_guest"("p_menu_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.menus m
        JOIN public.user_bars ub ON ub.bar_id = m.bar_id AND ub.user_id = auth.uid() AND ub.venue_role_id = m.change_role_id
        JOIN public.venue_roles vr ON vr.id = ub.venue_role_id
        WHERE m.id = p_menu_id AND m.list_type = 'takeover'
          AND (vr.ends_at IS NULL OR vr.ends_at > now())
    );
$$;

REVOKE ALL ON FUNCTION "private"."is_takeover_guest"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."is_takeover_guest"("uuid") TO "authenticated", "service_role";

-- The takeover lists the caller shares as the guest: their bar is the
-- list's guest party (linked to its page), or they are a guest bartender on
-- it. While it runs, and 14 days after.
CREATE FUNCTION "private"."my_takeover_menu_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT m.id
    FROM public.menus m
    JOIN public.menu_run_parties p ON p.menu_id = m.id AND p.kind = 'guest'
    JOIN public.profiles g ON g.id = p.profile_id AND g.kind = 'bar'
    WHERE m.list_type = 'takeover'
      AND (m.ends_at IS NULL OR m.ends_at > now() - interval '14 days')
      AND g.bar_id IN (SELECT private.my_bar_ids(0))
    UNION
    SELECT m.id
    FROM public.menus m
    JOIN public.user_bars ub ON ub.bar_id = m.bar_id AND ub.user_id = auth.uid() AND ub.venue_role_id = m.change_role_id
    JOIN public.venue_roles vr ON vr.id = ub.venue_role_id
    WHERE m.list_type = 'takeover' AND (vr.ends_at IS NULL OR vr.ends_at > now());
$$;

REVOKE ALL ON FUNCTION "private"."my_takeover_menu_ids"() FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."my_takeover_menu_ids"() TO "authenticated", "service_role";

-- As 20261203100000, and a takeover list is also its guests'.
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
        OR ("list_type" = 'takeover' AND "id" IN (SELECT "private"."my_takeover_menu_ids"() AS "ids"))
    );

-- Guest bartenders edit their takeover's list and run sheet.
CREATE OR REPLACE FUNCTION "private"."can_edit_menu"("p_menu_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT COALESCE(
    (SELECT private.can_build_menu(bar_id, created_by) FROM public.menus WHERE id = p_menu_id),
    false
  ) OR private.is_takeover_guest(p_menu_id);
$$;

-- As 20261203100000, and a guest bartender changes their takeover's list
-- without approval.
CREATE OR REPLACE FUNCTION "private"."may_change_list"("p_menu_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT auth.uid() IS NULL OR private.is_takeover_guest(p_menu_id) OR coalesce((
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

-- --- Inviting a guest bartender onto a role that ends ---

ALTER TABLE "public"."bar_invites" ADD COLUMN "venue_role_id" "uuid";
ALTER TABLE "public"."bar_invites" ADD CONSTRAINT "bar_invites_venue_role_fkey"
    FOREIGN KEY ("venue_role_id", "bar_id") REFERENCES "public"."venue_roles"("id", "bar_id") ON DELETE CASCADE;
CREATE INDEX "bar_invites_venue_role_id_idx" ON "public"."bar_invites" ("venue_role_id") WHERE "venue_role_id" IS NOT NULL;
COMMENT ON COLUMN "public"."bar_invites"."venue_role_id" IS
    'The venue role the invite gives (a takeover''s guest bartenders). Accepting puts them on it; it never moves an existing member.';

-- Invite someone onto a venue role (a takeover's guest bartenders). Same
-- rules as add_user_to_bar_by_email: the staff permission, nothing beyond
-- the inviter's own, the daily limits. An existing member keeps their role.
CREATE FUNCTION "public"."invite_to_role"("p_email" "text", "p_role_id" "uuid", "p_name" "text" DEFAULT NULL, "p_note" "text" DEFAULT NULL) RETURNS void
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_email text := lower(btrim(p_email));
    v_name text := nullif(btrim(p_name), '');
    v_note text := nullif(btrim(p_note), '');
    v_role public.venue_roles%ROWTYPE;
BEGIN
    SELECT * INTO v_role FROM public.venue_roles WHERE id = p_role_id;
    IF NOT FOUND OR v_role.bar_id NOT IN (SELECT private.bars_with_capability('staff')) THEN
        RAISE EXCEPTION 'You need the invite and manage staff permission to add members.' USING ERRCODE = '42501';
    END IF;
    IF v_role.ends_at IS NOT NULL AND v_role.ends_at <= now() THEN
        RAISE EXCEPTION 'That role has ended.' USING ERRCODE = '22023';
    END IF;
    IF v_role.base_level >= 40 THEN
        RAISE EXCEPTION 'Invite an Admin with add_user_to_bar_by_email.' USING ERRCODE = '22023';
    END IF;
    IF NOT (v_role.bar_id IN (SELECT private.my_bar_ids(40)) OR private.is_app_admin()) AND EXISTS (
        SELECT unnest(private.member_capabilities(v_role.bar_id, v_role.base_level, v_role.id))
        EXCEPT SELECT unnest(private.capabilities(v_role.bar_id))
    ) THEN
        RAISE EXCEPTION 'You can only invite someone to a role that does no more than yours.' USING ERRCODE = '42501';
    END IF;
    IF v_email IS NULL OR v_email !~ '^[^@\s]+@[^@\s]+$' THEN
        RAISE EXCEPTION 'Enter an email address.' USING ERRCODE = '22023';
    END IF;
    IF char_length(v_name) > 80 OR char_length(v_note) > 500 THEN
        RAISE EXCEPTION 'Keep the name to 80 characters and the note to 500.' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.user_bars ub JOIN auth.users au ON au.id = ub.user_id
        WHERE ub.bar_id = v_role.bar_id AND lower(au.email) = v_email
    ) THEN
        RAISE EXCEPTION 'They''re already on your team.' USING ERRCODE = '22023';
    END IF;

    IF NOT private.is_app_admin() THEN
        PERFORM pg_advisory_xact_lock(hashtextextended('invite:' || auth.uid()::text, 0));
        PERFORM pg_advisory_xact_lock(hashtextextended('invite-bar:' || v_role.bar_id::text, 0));
        IF private.rate_count('invite', auth.uid(), NULL, NULL) >= private.daily_limit('invite_per_inviter') THEN
            RAISE EXCEPTION 'You''ve sent % invites today. Try again tomorrow.', private.daily_limit('invite_per_inviter');
        END IF;
        IF private.rate_count('invite', NULL, v_role.bar_id, NULL) >= private.daily_limit('invite_per_venue') THEN
            RAISE EXCEPTION 'This venue has sent % invites today. Try again tomorrow.', private.daily_limit('invite_per_venue');
        END IF;
    END IF;
    INSERT INTO private.rate_events (kind, user_id, bar_id) VALUES ('invite', auth.uid(), v_role.bar_id);

    INSERT INTO public.bar_invites (bar_id, email, role_level, venue_role_id, invited_by, name, note)
    VALUES (v_role.bar_id, v_email, v_role.base_level, v_role.id, auth.uid(), v_name, v_note)
    ON CONFLICT (bar_id, email)
    DO UPDATE SET role_level = EXCLUDED.role_level, venue_role_id = EXCLUDED.venue_role_id, invited_by = EXCLUDED.invited_by,
        created_at = now(), name = COALESCE(EXCLUDED.name, public.bar_invites.name), note = COALESCE(EXCLUDED.note, public.bar_invites.note)
    WHERE public.bar_invites.role_level < 40;
END;
$$;

REVOKE ALL ON FUNCTION "public"."invite_to_role"("text", "uuid", "text", "text") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."invite_to_role"("text", "uuid", "text", "text") TO "authenticated", "service_role";

-- An invite to the Admin level by add_user_to_bar_by_email is a plain
-- invite again: it drops any role an earlier invite named.
CREATE FUNCTION "private"."plain_invite_drops_role"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.venue_role_id IS NOT NULL AND NEW.role_level IS DISTINCT FROM OLD.role_level
       AND NEW.venue_role_id IS NOT DISTINCT FROM OLD.venue_role_id THEN
        NEW.venue_role_id := NULL;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."plain_invite_drops_role"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "plain_invite_drops_role" BEFORE UPDATE ON "public"."bar_invites"
    FOR EACH ROW EXECUTE FUNCTION "private"."plain_invite_drops_role"();

-- --- 2. Allergens checked by the bar, with a date ---

ALTER TABLE "public"."items"
    ADD COLUMN "allergens_checked_at" timestamp with time zone,
    ADD COLUMN "allergens_checked_by" "uuid" REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    ADD COLUMN "allergens_checked_spec" "text";
ALTER TABLE "public"."items" ADD CONSTRAINT "items_allergens_check_whole" CHECK (("allergens_checked_at" IS NULL) = ("allergens_checked_spec" IS NULL));
ALTER TABLE "public"."items" ADD CONSTRAINT "items_allergens_check_bar" CHECK ("allergens_checked_at" IS NULL OR "bar_id" IS NOT NULL);
CREATE INDEX "items_allergens_checked_by_idx" ON "public"."items" ("allergens_checked_by") WHERE "allergens_checked_by" IS NOT NULL;
COMMENT ON COLUMN "public"."items"."allergens_checked_at" IS
    'The bar checked this drink''s allergen list at this time (allergen-check). It counts only while allergens_checked_spec matches private.allergen_fingerprint: any change to the spec, a house-made ingredient under it or a declaration clears it.';
COMMENT ON COLUMN "public"."items"."allergens_checked_spec" IS 'private.allergen_fingerprint(id) when the bar checked it.';

-- What a drink's allergen list is made of: its lines down through house-made
-- ingredients (four levels, as the roll-up walks) and every declaration and
-- ingredient check that applies at its bar. Amounts and notes are left out.
CREATE FUNCTION "private"."allergen_fingerprint"("p_item_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    WITH RECURSIVE drink AS (
        SELECT bar_id FROM public.items WHERE id = p_item_id
    ), walk AS (
        SELECT r.recipe_item_id, r.ingredient_item_id, r.parent_ingredient_id, 1 AS depth, ARRAY[r.recipe_item_id] AS seen
        FROM public.recipes r
        WHERE r.recipe_item_id = p_item_id
        UNION ALL
        SELECT r.recipe_item_id, r.ingredient_item_id, r.parent_ingredient_id, w.depth + 1, w.seen || r.recipe_item_id
        FROM walk w
        JOIN public.recipes r ON r.recipe_item_id IN (w.ingredient_item_id, w.parent_ingredient_id)
        WHERE w.depth < 4 AND NOT (r.recipe_item_id = ANY (w.seen))
    ), parts AS (
        SELECT DISTINCT x.item_id
        FROM walk w
        CROSS JOIN LATERAL (VALUES (w.ingredient_item_id), (w.parent_ingredient_id)) AS x(item_id)
        WHERE x.item_id IS NOT NULL
    ), lines AS (
        SELECT concat_ws(':', w.depth, w.recipe_item_id, w.ingredient_item_id, w.parent_ingredient_id) AS k FROM walk w
    ), declared AS (
        SELECT concat_ws(':', 'a', ia.item_id, ia.bar_id, ia.allergen) AS k
        FROM public.item_allergens ia, drink d
        WHERE ia.item_id IN (SELECT p.item_id FROM parts p) AND (ia.bar_id = d.bar_id OR ia.bar_id IS NULL)
        UNION ALL
        SELECT concat_ws(':', 'c', c.item_id, c.bar_id)
        FROM public.item_allergen_checks c, drink d
        WHERE c.item_id IN (SELECT p.item_id FROM parts p) AND (c.bar_id = d.bar_id OR c.bar_id IS NULL)
    )
    SELECT md5(
        coalesce((SELECT string_agg(l.k, ',' ORDER BY l.k) FROM lines l), '') || '|' ||
        coalesce((SELECT string_agg(d.k, ',' ORDER BY d.k) FROM declared d), '')
    );
$$;

REVOKE ALL ON FUNCTION "private"."allergen_fingerprint"("uuid") FROM PUBLIC, "anon", "authenticated";

-- Checking is for those who declare allergens at the drink's bar (edit_drinks
-- there): it stamps who, when and what was checked, whatever the client
-- sends; null clears all three. A script's check as it sends it.
CREATE FUNCTION "private"."stamp_allergen_check"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    -- Sent back unchanged (a whole-row save): nothing to stamp, so a stale
    -- check never comes back fresh. Deleting the checker's account nulls
    -- who, and that's all.
    IF NEW.allergens_checked_by IS NULL AND private.user_gone(OLD.allergens_checked_by) THEN
        RETURN NEW;
    END IF;
    IF NEW.allergens_checked_at IS NOT DISTINCT FROM OLD.allergens_checked_at
       AND NEW.allergens_checked_by IS NOT DISTINCT FROM OLD.allergens_checked_by
       AND NEW.allergens_checked_spec IS NOT DISTINCT FROM OLD.allergens_checked_spec THEN
        RETURN NEW;
    END IF;
    IF NEW.allergens_checked_at IS NULL THEN
        NEW.allergens_checked_by := NULL;
        NEW.allergens_checked_spec := NULL;
    ELSIF auth.uid() IS NOT NULL THEN
        IF NOT private.can_declare_allergens(NEW.id, NEW.bar_id) THEN
            RAISE EXCEPTION 'Only someone who edits drinks here can check its allergens.' USING ERRCODE = '42501';
        END IF;
        NEW.allergens_checked_at := now();
        NEW.allergens_checked_by := auth.uid();
        NEW.allergens_checked_spec := private.allergen_fingerprint(NEW.id);
    END IF;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."stamp_allergen_check"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "stamp_allergen_check" BEFORE UPDATE OF "allergens_checked_at", "allergens_checked_by", "allergens_checked_spec" ON "public"."items"
    FOR EACH ROW EXECUTE FUNCTION "private"."stamp_allergen_check"();

-- The roll-up (20261001100000_allergens.sql), with no gate: its one home.
-- Names on the way down follow what the caller may see of each line.
CREATE FUNCTION "private"."allergen_rollup"("p_item_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  WITH RECURSIVE drink AS (
    SELECT bar_id FROM public.items WHERE id = p_item_id
  ),
  walk AS (
    SELECT r.id AS row_id, r.ingredient_item_id, r.parent_ingredient_id, 1 AS depth,
           ARRAY[r.recipe_item_id] AS seen,
           ARRAY[di.name] AS via
    FROM drink, public.recipes r
    LEFT JOIN public.app_recipe_presentation ap ON ap.id = r.id
    LEFT JOIN public.items di ON di.id = ap.display_ingredient_id
    WHERE r.recipe_item_id = p_item_id
    UNION ALL
    SELECT r.id, r.ingredient_item_id, r.parent_ingredient_id, w.depth + 1,
           w.seen || r.recipe_item_id,
           w.via || di.name
    FROM walk w
    JOIN public.recipes r ON r.recipe_item_id IN (w.ingredient_item_id, w.parent_ingredient_id)
    LEFT JOIN public.app_recipe_presentation ap ON ap.id = r.id
    LEFT JOIN public.items di ON di.id = ap.display_ingredient_id
    WHERE w.depth < 4 AND NOT (r.recipe_item_id = ANY (w.seen))
  ),
  parts AS (
    SELECT w.row_id, w.via, p.item_id,
           (SELECT c.bar_id FROM public.item_allergen_checks c, drink d
            WHERE c.item_id = p.item_id AND (c.bar_id = d.bar_id OR c.bar_id IS NULL)
            ORDER BY c.bar_id NULLS LAST LIMIT 1) AS scope,
           EXISTS (SELECT 1 FROM public.item_allergen_checks c, drink d
                   WHERE c.item_id = p.item_id AND (c.bar_id = d.bar_id OR c.bar_id IS NULL)) AS checked
    FROM walk w
    CROSS JOIN LATERAL (VALUES (w.ingredient_item_id), (w.parent_ingredient_id)) AS p(item_id)
    WHERE p.item_id IS NOT NULL
  ),
  leaves AS (
    SELECT w.row_id, bool_or(p.checked) AS checked
    FROM walk w JOIN parts p ON p.row_id = w.row_id
    WHERE NOT EXISTS (SELECT 1 FROM public.recipes s WHERE s.recipe_item_id IN (w.ingredient_item_id, w.parent_ingredient_id))
    GROUP BY w.row_id
  ),
  found AS (
    SELECT DISTINCT ia.allergen, array_remove(p.via, NULL) AS via
    FROM parts p
    JOIN public.item_allergens ia ON ia.item_id = p.item_id AND ia.bar_id IS NOT DISTINCT FROM p.scope
  ),
  grouped AS (
    SELECT allergen, jsonb_agg(to_jsonb(via) ORDER BY via) AS via
    FROM found
    GROUP BY allergen
  )
  SELECT jsonb_build_object(
    'allergens', COALESCE((SELECT jsonb_agg(jsonb_build_object('allergen', allergen, 'via', via) ORDER BY allergen) FROM grouped), '[]'::jsonb),
    'unchecked', (SELECT count(*) FROM leaves WHERE NOT checked),
    'lines', (SELECT count(*) FROM walk WHERE depth = 1)
  );
$$;

REVOKE ALL ON FUNCTION "private"."allergen_rollup"("uuid") FROM PUBLIC, "anon", "authenticated";

-- When the bar's check still holds: its time, else null.
CREATE FUNCTION "private"."allergen_check_holds"("p_item_id" "uuid") RETURNS timestamp with time zone
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT i.allergens_checked_at
    FROM public.items i
    WHERE i.id = p_item_id AND i.allergens_checked_at IS NOT NULL
      AND i.allergens_checked_spec = private.allergen_fingerprint(i.id);
$$;

REVOKE ALL ON FUNCTION "private"."allergen_check_holds"("uuid") FROM PUBLIC, "anon", "authenticated";

-- Staff: as before, plus the bar's check ('checked': when, while it holds)
-- and 'stale' when the spec changed since it was checked.
CREATE OR REPLACE FUNCTION "public"."drink_allergens"("p_item_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT CASE WHEN private.can_view_item(p_item_id) THEN
        private.allergen_rollup(p_item_id) || jsonb_build_object(
            'checked', private.allergen_check_holds(p_item_id),
            'stale', (SELECT i.allergens_checked_at IS NOT NULL FROM public.items i WHERE i.id = p_item_id)
                     AND private.allergen_check_holds(p_item_id) IS NULL
        )
    END;
$$;

-- Guests, signed in or out (guest-allergen-read): every allergen of each
-- drink they may see (listed publicly, or visible to them), always with the
-- unchecked count, and the bar's check date while it holds (never who
-- checked). Up to 200 drinks a call, for a list.
CREATE FUNCTION "public"."guest_drink_allergens"("p_item_ids" "uuid"[])
    RETURNS TABLE("item_id" "uuid", "allergens" "jsonb", "unchecked" integer, "lines" integer, "checked_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT x.id, r->'allergens', (r->>'unchecked')::integer, (r->>'lines')::integer, private.allergen_check_holds(x.id)
    FROM (
        SELECT DISTINCT u.id
        FROM unnest(p_item_ids[1:200]) AS u(id)
        WHERE EXISTS (SELECT 1 FROM public.published_items p WHERE p.id = u.id)
           OR (auth.uid() IS NOT NULL AND private.can_view_item(u.id))
    ) x
    CROSS JOIN LATERAL private.allergen_rollup(x.id) AS r;
$$;

REVOKE ALL ON FUNCTION "public"."guest_drink_allergens"("uuid"[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."guest_drink_allergens"("uuid"[]) TO "anon", "authenticated", "service_role";

-- --- 3. Private guest allergies ---

-- A guest's own allergies (the 14 declared allergens): on their account
-- only (user_prefs is its owner's alone, and no view or function returns
-- it), never on a profile. The app matches on the phone, so they are never
-- sent anywhere, and keeps a copy there for a guest who hasn't signed in.
-- NULL: never set; empty: none.
ALTER TABLE "public"."user_prefs" ADD COLUMN "allergies" "public"."allergen"[];
ALTER TABLE "public"."user_prefs" ADD CONSTRAINT "user_prefs_allergies_check" CHECK (
    "allergies" IS NULL OR (cardinality("allergies") <= 14 AND array_position("allergies", NULL) IS NULL)
);
COMMENT ON COLUMN "public"."user_prefs"."allergies" IS
    'Your allergies, private: only you read them. Drink pages warn on a match, only on drinks the bar has checked. NULL: never set; empty: none.';

-- --- A run-sheet link for each party with no account ---

-- The party's list as the app works it out (lib/runSheet.ts partyList: the
-- drinks they make, serves, who brings what, what to buy with the margin;
-- no specs), saved behind a secret token. Re-saving keeps the token; ending
-- it deletes the row, so the next one gets a new token. Nobody reads the
-- table directly.
CREATE TABLE "private"."run_sheet_links" (
    "party_id" "uuid" NOT NULL PRIMARY KEY REFERENCES "public"."menu_run_parties"("id") ON DELETE CASCADE,
    "token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL UNIQUE,
    "list" "jsonb" NOT NULL,
    "saved_by" "uuid" DEFAULT "auth"."uid"() REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "saved_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "run_sheet_links_list_check" CHECK (jsonb_typeof("list") = 'object' AND pg_column_size("list") <= 65536)
);

COMMENT ON TABLE "private"."run_sheet_links" IS 'A run-sheet party''s list, saved for a link that needs no account (run_sheet_link). Read and written only through its functions.';
CREATE INDEX "run_sheet_links_saved_by_idx" ON "private"."run_sheet_links" ("saved_by") WHERE "saved_by" IS NOT NULL;

ALTER TABLE "private"."run_sheet_links" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "private"."run_sheet_links" FROM PUBLIC, "anon", "authenticated";
GRANT ALL ON "private"."run_sheet_links" TO "service_role";

-- Save (or re-save) a party's list; returns the link's token. For those who
-- edit the list (its menu team, or its guest bartenders).
CREATE FUNCTION "public"."save_run_sheet_link"("p_party_id" "uuid", "p_list" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_menu uuid;
    v_token uuid;
BEGIN
    SELECT p.menu_id INTO v_menu FROM public.menu_run_parties p WHERE p.id = p_party_id;
    IF v_menu IS NULL OR NOT private.can_edit_menu(v_menu) THEN
        RAISE EXCEPTION 'menu not found or not yours to edit' USING ERRCODE = '42501';
    END IF;
    IF jsonb_typeof(p_list) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'the list must be an object' USING ERRCODE = '22023';
    END IF;
    INSERT INTO private.run_sheet_links (party_id, list, saved_by, saved_at)
    VALUES (p_party_id, p_list, auth.uid(), now())
    ON CONFLICT (party_id) DO UPDATE SET list = EXCLUDED.list, saved_by = EXCLUDED.saved_by, saved_at = EXCLUDED.saved_at
    RETURNING token INTO v_token;
    RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION "public"."save_run_sheet_link"("uuid", "jsonb") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."save_run_sheet_link"("uuid", "jsonb") TO "authenticated", "service_role";

-- Stop a party's link (a new save starts a new token).
CREATE FUNCTION "public"."end_run_sheet_link"("p_party_id" "uuid") RETURNS void
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.menu_run_parties p WHERE p.id = p_party_id AND private.can_edit_menu(p.menu_id)) THEN
        RAISE EXCEPTION 'menu not found or not yours to edit' USING ERRCODE = '42501';
    END IF;
    DELETE FROM private.run_sheet_links WHERE party_id = p_party_id;
END;
$$;

REVOKE ALL ON FUNCTION "public"."end_run_sheet_link"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."end_run_sheet_link"("uuid") TO "authenticated", "service_role";

-- For the editors: whether a party has a link, and its token.
CREATE FUNCTION "public"."run_sheet_link_token"("p_party_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT l.token
    FROM private.run_sheet_links l
    JOIN public.menu_run_parties p ON p.id = l.party_id
    WHERE l.party_id = p_party_id AND private.can_edit_menu(p.menu_id);
$$;

REVOKE ALL ON FUNCTION "public"."run_sheet_link_token"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."run_sheet_link_token"("uuid") TO "authenticated", "service_role";

-- The link, signed out: the party's list, the list's name and when it was
-- saved, while the list exists, isn't hidden, and ended less than 14 days
-- ago. Nothing for a wrong or old token.
CREATE FUNCTION "public"."run_sheet_link"("p_token" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT jsonb_build_object('list', l.list, 'saved_at', l.saved_at, 'menu_name', m.name, 'party_name', p.name)
    FROM private.run_sheet_links l
    JOIN public.menu_run_parties p ON p.id = l.party_id
    JOIN public.menus m ON m.id = p.menu_id
    WHERE l.token = p_token
      AND m.hidden_at IS NULL
      AND (m.ends_at IS NULL OR m.ends_at > now() - interval '14 days');
$$;

REVOKE ALL ON FUNCTION "public"."run_sheet_link"("uuid") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."run_sheet_link"("uuid") TO "anon", "authenticated", "service_role";

-- Accepting an invite onto a role (invite_to_role) puts the person on it;
-- it refuses a role that has ended, and never moves an existing member onto
-- one (their row stays as it is). Otherwise as 20261101200000.
CREATE OR REPLACE FUNCTION "public"."accept_bar_invite"("p_bar_id" "uuid") RETURNS "public"."user_bars"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_email TEXT;
    v_invite public.bar_invites;
    v_member public.user_bars;
BEGIN
    SELECT lower(email) INTO v_email
    FROM auth.users
    WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL;

    IF private.venue_claim_pending(p_bar_id) THEN
        UPDATE public.bar_invites
        SET accepted_by = auth.uid(), accepted_at = coalesce(accepted_at, now())
        WHERE bar_id = p_bar_id AND email = v_email
        RETURNING * INTO v_invite;
        IF v_invite.id IS NULL THEN
            RAISE EXCEPTION 'There''s no invite to this venue for your email.';
        END IF;
        -- Held: they join when the claim is approved. No member row yet.
        RETURN NULL;
    END IF;

    DELETE FROM public.bar_invites
    WHERE bar_id = p_bar_id AND email = v_email
    RETURNING * INTO v_invite;

    IF v_invite.id IS NULL THEN
        RAISE EXCEPTION 'There''s no invite to this venue for your email.';
    END IF;

    IF v_invite.venue_role_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.venue_roles vr WHERE vr.id = v_invite.venue_role_id AND vr.ends_at <= now()
    ) THEN
        RAISE EXCEPTION 'That invite was for a role that has ended.';
    END IF;

    PERFORM set_config('cocktail.accepting_invite', 'on', true);
    INSERT INTO public.user_bars (user_id, bar_id, role_level, venue_role_id)
    VALUES (auth.uid(), p_bar_id, v_invite.role_level, v_invite.venue_role_id)
    ON CONFLICT (user_id, bar_id) DO UPDATE SET role_level = EXCLUDED.role_level
        WHERE EXCLUDED.venue_role_id IS NULL
    RETURNING * INTO v_member;
    PERFORM set_config('cocktail.accepting_invite', 'off', true);

    IF v_member.id IS NULL THEN
        -- Already on the team: a role invite leaves their role as it is.
        SELECT * INTO v_member FROM public.user_bars WHERE user_id = auth.uid() AND bar_id = p_bar_id;
    END IF;
    RETURN v_member;
END;
$$;
