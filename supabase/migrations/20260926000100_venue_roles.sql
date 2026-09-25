-- DRAFT (schema proposal, docs/schema_proposal.md section 2). Local stack only.
--
-- Venue roles: each bar can name its own roles on top of the five global
-- levels (Guest 10, Employee 20, Bartender 30, Drink Creator 35, Admin 40).
-- A role has a base level, capability overrides, and an optional end date for
-- guest staff.
--
-- The base level stays the source of truth for every existing policy:
-- assigning a role copies its base level into user_bars.role_level, so
-- my_bar_ids(), can_write() and the presentation views see exactly what they
-- see today. Capabilities add finer rules on top, and only new tables and the
-- app read them.
--
-- Capabilities come in two kinds:
--   * level-bound: already enforced by existing policies or views from the
--     role level (menu, specs, edit_drinks, menus, staff, brand). They follow
--     the base level and can't be overridden, so the app never shows a
--     permission the database would refuse, or hides one it would allow.
--   * overridable: new, and enforced by the new tables' policies (locations,
--     costs, prep, house_made, talking_points, photos, publish). A role can
--     grant or revoke these.
--
-- The one change to existing helpers: a membership whose role has ended stops
-- counting in my_bar_ids(), can_write() and get_my_bars() straight away, and
-- a pg_cron job removes it within 15 minutes.

CREATE TYPE "public"."venue_capability" AS ENUM (
    -- Seeing
    'menu',            -- menu and descriptions
    'talking_points',  -- talking points and allergens
    'specs',
    'house_made',      -- house-made recipes and their prep metadata
    'locations',       -- where things live
    'costs',           -- costs and pour cost
    -- Making
    'edit_drinks',
    'prep',            -- prep list and orders
    'photos',
    'menus',           -- build menus and events
    -- Running the venue
    'publish',
    'staff',
    'brand'
);

CREATE FUNCTION "private"."level_bound_capabilities"() RETURNS "public"."venue_capability"[]
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT '{menu,specs,edit_drinks,menus,staff,brand}'::public.venue_capability[];
$$;

-- What each base level can do before any override. Mirrors the brief's roles
-- matrix, except where today's policies already decide (see the proposal).
CREATE FUNCTION "private"."base_capabilities"("p_level" integer) RETURNS "public"."venue_capability"[]
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT (CASE
    WHEN p_level >= 40 THEN enum_range(NULL::public.venue_capability)::text[]
    WHEN p_level >= 35 THEN '{menu,talking_points,locations,specs,photos,house_made,edit_drinks,prep,menus}'
    WHEN p_level >= 30 THEN '{menu,talking_points,locations,specs,photos}'
    WHEN p_level >= 20 THEN '{menu,talking_points,locations}'
    WHEN p_level >= 10 THEN '{menu}'
    ELSE '{}'
  END)::public.venue_capability[];
$$;

-- The capabilities of a level with overrides, at a bar with these visibility
-- and measurement levels (the bar settings that already gate menu and specs).
CREATE FUNCTION "private"."role_capabilities"(
    "p_level" integer,
    "p_granted" "public"."venue_capability"[],
    "p_revoked" "public"."venue_capability"[],
    "p_visibility_level" integer,
    "p_measurement_level" integer
) RETURNS "public"."venue_capability"[]
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT COALESCE(array_agg(c ORDER BY c), '{}')
  FROM unnest(enum_range(NULL::public.venue_capability)) AS c
  WHERE CASE
    WHEN c = 'menu' THEN p_level >= p_visibility_level
    WHEN c = 'specs' THEN p_level >= p_measurement_level
    WHEN c = ANY (private.level_bound_capabilities()) THEN c = ANY (private.base_capabilities(p_level))
    ELSE (c = ANY (private.base_capabilities(p_level)) OR c = ANY (COALESCE(p_granted, '{}')))
         AND NOT c = ANY (COALESCE(p_revoked, '{}'))
  END;
$$;

-- --- Tables ---

CREATE TABLE "public"."venue_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "bar_id" "uuid" NOT NULL REFERENCES "public"."bars"("id") ON DELETE CASCADE,
    "name" "text" NOT NULL CHECK (char_length(btrim("name")) BETWEEN 1 AND 40),
    "base_level" integer NOT NULL CHECK ("base_level" = ANY (ARRAY[10, 20, 30, 35, 40])),
    "granted" "public"."venue_capability"[] DEFAULT '{}' NOT NULL,
    "revoked" "public"."venue_capability"[] DEFAULT '{}' NOT NULL,
    -- Guest staff: members holding this role lose access at this moment.
    "ends_at" timestamp with time zone,
    "created_by" "uuid" DEFAULT "auth"."uid"() REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    UNIQUE ("id", "bar_id"),
    CONSTRAINT "venue_roles_overrides_disjoint" CHECK (NOT ("granted" && "revoked")),
    CONSTRAINT "venue_roles_overrides_not_level_bound" CHECK (
        NOT ("granted" && "private"."level_bound_capabilities"())
        AND NOT ("revoked" && "private"."level_bound_capabilities"())
    ),
    -- An admin role can't expire, so a bar can't lose its last admin on a timer.
    CONSTRAINT "venue_roles_admins_do_not_expire" CHECK ("ends_at" IS NULL OR "base_level" < 40)
);

CREATE UNIQUE INDEX "venue_roles_bar_id_name_key" ON "public"."venue_roles" ("bar_id", lower(btrim("name")));

ALTER TABLE "public"."user_bars" ADD COLUMN "venue_role_id" "uuid";
-- The role must belong to the same bar as the membership.
ALTER TABLE "public"."user_bars" ADD CONSTRAINT "user_bars_venue_role_fkey"
    FOREIGN KEY ("venue_role_id", "bar_id") REFERENCES "public"."venue_roles"("id", "bar_id")
    ON DELETE SET NULL ("venue_role_id");
CREATE INDEX "user_bars_venue_role_id_idx" ON "public"."user_bars" ("venue_role_id");

-- --- Keep role_level in step with the role ---

-- Assigning a role sets the member's level to its base level. Changing the
-- level by hand (the existing add_user_to_bar_by_email path, or an admin edit)
-- moves the member back to a plain base role.
CREATE FUNCTION "private"."sync_member_role_level"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_base INT;
BEGIN
    IF NEW.venue_role_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT base_level INTO v_base FROM public.venue_roles WHERE id = NEW.venue_role_id;

    IF TG_OP = 'UPDATE'
       AND NEW.venue_role_id IS NOT DISTINCT FROM OLD.venue_role_id
       AND NEW.role_level IS DISTINCT FROM OLD.role_level
       AND NEW.role_level <> v_base THEN
        NEW.venue_role_id := NULL;
    ELSE
        NEW.role_level := v_base;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "sync_member_role_level" BEFORE INSERT OR UPDATE ON "public"."user_bars"
    FOR EACH ROW EXECUTE FUNCTION "private"."sync_member_role_level"();

-- Changing a role's base level moves everyone who holds it.
CREATE FUNCTION "private"."cascade_role_base_level"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    UPDATE public.user_bars SET role_level = NEW.base_level WHERE venue_role_id = NEW.id;
    RETURN NULL;
END;
$$;

CREATE TRIGGER "cascade_role_base_level" AFTER UPDATE OF "base_level" ON "public"."venue_roles"
    FOR EACH ROW WHEN (NEW.base_level IS DISTINCT FROM OLD.base_level)
    EXECUTE FUNCTION "private"."cascade_role_base_level"();

-- --- Expired guest staff stop counting everywhere ---

CREATE OR REPLACE FUNCTION "private"."my_bar_ids"("p_min_role" integer) RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT ub.bar_id FROM public.user_bars ub
  WHERE ub.user_id = auth.uid() AND ub.role_level >= p_min_role
    AND NOT EXISTS (
      SELECT 1 FROM public.venue_roles vr WHERE vr.id = ub.venue_role_id AND vr.ends_at <= now()
    );
$$;

CREATE OR REPLACE FUNCTION "private"."can_write"("p_bar_id" "uuid", "p_created_by" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN p_bar_id IS NULL THEN p_created_by = auth.uid() OR private.is_app_admin()
    ELSE p_bar_id IN (SELECT private.my_bar_ids(35))
  END;
$$;

CREATE OR REPLACE FUNCTION "public"."get_my_bars"() RETURNS SETOF "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT private.my_bar_ids(0);
$$;

CREATE FUNCTION "private"."sweep_expired_memberships"() RETURNS integer
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
  WITH gone AS (
    DELETE FROM public.user_bars ub
    USING public.venue_roles vr
    WHERE vr.id = ub.venue_role_id AND vr.ends_at <= now()
    RETURNING 1
  )
  SELECT count(*)::int FROM gone;
$$;

-- --- Capability checks ---

-- The caller's capabilities at a bar: empty when they aren't a member or
-- their role has ended. Real role, not view-as, like my_bar_ids().
CREATE FUNCTION "private"."capabilities"("p_bar_id" "uuid") RETURNS "public"."venue_capability"[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT COALESCE((
    SELECT private.role_capabilities(
      ub.role_level, vr.granted, vr.revoked, b.default_visibility_level, b.default_measurement_level
    )
    FROM public.user_bars ub
    JOIN public.bars b ON b.id = ub.bar_id
    LEFT JOIN public.venue_roles vr ON vr.id = ub.venue_role_id
    WHERE ub.bar_id = p_bar_id AND ub.user_id = auth.uid()
      AND (vr.ends_at IS NULL OR vr.ends_at > now())
  ), '{}');
$$;

-- Bars where the caller has a capability. Policies use it as
-- "bar_id IN (SELECT private.bars_with_capability('x'))" so it runs once per
-- query, like my_bar_ids().
CREATE FUNCTION "private"."bars_with_capability"("p_cap" "public"."venue_capability") RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT ub.bar_id FROM public.user_bars ub
  WHERE ub.user_id = auth.uid() AND p_cap = ANY (private.capabilities(ub.bar_id));
$$;

-- For the app: what the signed-in member can do at a bar.
CREATE FUNCTION "public"."my_capabilities"("p_bar_id" "uuid") RETURNS "public"."venue_capability"[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT private.capabilities(p_bar_id);
$$;

-- For the Roles screen: the five base levels and the bar's own roles, each
-- with what it can do, so the matrix is never re-implemented in the app.
-- Members only.
CREATE FUNCTION "public"."get_venue_role_matrix"("p_bar_id" "uuid")
    RETURNS TABLE("role_id" "uuid", "name" "text", "base_level" integer, "ends_at" timestamp with time zone,
                  "granted" "public"."venue_capability"[], "revoked" "public"."venue_capability"[],
                  "capabilities" "public"."venue_capability"[])
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT NULL::uuid, NULL::text, l, NULL::timestamptz, '{}'::public.venue_capability[], '{}'::public.venue_capability[],
         private.role_capabilities(l, '{}', '{}', b.default_visibility_level, b.default_measurement_level)
  FROM public.bars b, unnest(ARRAY[10, 20, 30, 35, 40]) AS l
  WHERE b.id = p_bar_id AND b.id IN (SELECT private.my_bar_ids(0))
  UNION ALL
  SELECT vr.id, vr.name, vr.base_level, vr.ends_at, vr.granted, vr.revoked,
         private.role_capabilities(vr.base_level, vr.granted, vr.revoked, b.default_visibility_level, b.default_measurement_level)
  FROM public.venue_roles vr
  JOIN public.bars b ON b.id = vr.bar_id
  WHERE vr.bar_id = p_bar_id AND b.id IN (SELECT private.my_bar_ids(0))
  ORDER BY 3, 2 NULLS FIRST;
$$;

-- --- Policies ---

ALTER TABLE "public"."venue_roles" ENABLE ROW LEVEL SECURITY;

-- Members see their bar's roles (they need their own, and the Roles screen
-- shows them); only the bar's admins change them, like the roster itself.
CREATE POLICY "venue_roles_select" ON "public"."venue_roles" FOR SELECT TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."my_bar_ids"(0)));
CREATE POLICY "venue_roles_insert" ON "public"."venue_roles" FOR INSERT TO "authenticated"
    WITH CHECK ("bar_id" IN (SELECT "private"."my_bar_ids"(40)));
CREATE POLICY "venue_roles_update" ON "public"."venue_roles" FOR UPDATE TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."my_bar_ids"(40)))
    WITH CHECK ("bar_id" IN (SELECT "private"."my_bar_ids"(40)));
CREATE POLICY "venue_roles_delete" ON "public"."venue_roles" FOR DELETE TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."my_bar_ids"(40)));

-- --- Schedule ---

CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";
SELECT "cron"."schedule"('sweep-expired-memberships', '*/15 * * * *', 'SELECT private.sweep_expired_memberships()');

-- --- Grants ---

REVOKE EXECUTE ON FUNCTION "private"."level_bound_capabilities"() FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "private"."base_capabilities"("p_level" integer) FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "private"."role_capabilities"("p_level" integer, "p_granted" "public"."venue_capability"[], "p_revoked" "public"."venue_capability"[], "p_visibility_level" integer, "p_measurement_level" integer) FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "private"."sync_member_role_level"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."cascade_role_base_level"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."sweep_expired_memberships"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."capabilities"("p_bar_id" "uuid") FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "private"."bars_with_capability"("p_cap" "public"."venue_capability") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."level_bound_capabilities"() TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "private"."base_capabilities"("p_level" integer) TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "private"."role_capabilities"("p_level" integer, "p_granted" "public"."venue_capability"[], "p_revoked" "public"."venue_capability"[], "p_visibility_level" integer, "p_measurement_level" integer) TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "private"."capabilities"("p_bar_id" "uuid") TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "private"."bars_with_capability"("p_cap" "public"."venue_capability") TO "authenticated", "service_role";

REVOKE EXECUTE ON FUNCTION "public"."my_capabilities"("p_bar_id" "uuid") FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "public"."get_venue_role_matrix"("p_bar_id" "uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."my_capabilities"("p_bar_id" "uuid") TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."get_venue_role_matrix"("p_bar_id" "uuid") TO "authenticated", "service_role";
