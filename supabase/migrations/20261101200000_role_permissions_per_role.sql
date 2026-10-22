-- Tap a dot to change what a role can do (board eddie-oct22-wave2-roles-setup-feedback, fix 14).
--
-- Until now six permissions (menu, specs, edit_drinks, menus, staff, brand)
-- followed the base level: a venue role could not grant or take them away
-- (private.level_bound_capabilities), and the policies behind them checked
-- the level straight from user_bars. This makes all thirteen per role:
--
--   * venue_roles may grant or revoke any permission.
--   * venue_level_overrides: a venue's own changes to a built-in role
--     (Guest ... Admin) for its members who hold that built-in role. No row
--     means the built-in role as it was, so every bar keeps exactly today's
--     access until someone taps a dot.
--   * Admin always keeps staff (invite and manage staff), so a venue can't
--     lock itself out: role_capabilities forces it, and a check refuses a
--     revoke.
--   * Every policy and function that checked a level for one of the six
--     checks the permission instead (listed below). Menu and specs also
--     depend on the venue's Who sees what levels and a drink's own override,
--     so for those the level rule stays and the role's grant or revoke moves
--     it, in both directions.
--   * Only people with staff change roles, and someone with staff who isn't
--     an Admin can't touch Admins and can only hand out what they can do.
--
-- Policies and functions changed (level check -> permission):
--   staff:       venue_roles insert/update/delete, user_bars_update,
--                user_bars_delete, bar_invites_select, bar_invites_delete,
--                add_user_to_bar_by_email, get_bar_members (emails)
--   brand:       bars_update (plus guard_bar_brand: brand columns need brand,
--                everything else still needs an Admin)
--   edit_drinks: can_write (items insert/update/delete, can_edit_item and
--                every policy that uses it), can_edit_credited,
--                guard_item_credit, items_select (now through
--                my_bar_item_access, once per query), can_view_bar_item,
--                can_view_item, app_item_presentation,
--                drafts select/update/delete
--   menus:       menus insert/update/delete, can_edit_menu (menu_drinks,
--                menu_sections, menu_run_* policies)
--   menu:        can_view_bar_item, can_view_item, app_item_presentation,
--                app_recipe_presentation
--   specs:       app_recipe_presentation (amounts, units, at service)
-- Already on bars_with_capability, so they follow on their own: bar_off_menu,
-- calendar_sources, events, event_staff, venue_calendar_settings,
-- item_allergens, item_allergen_checks, set_staff_list_order,
-- can_declare_allergens, can_view_versions.
-- Left on levels (not one of the six): bar_zones writes and item_locations
-- writes (drawing the back bar, Drink Creator), bars_delete,
-- item_comments_delete, assign_item_to_bar, start_bar_claim, hand_over_claim,
-- bar_profiles_i_confirm (Admin), on_bar_team (Employee),
-- keep_a_venue_admin and prepare_account_deletion (the last Admin).

-- --- What a role can do ---

-- Whether a permission is open: by the level rule, or granted, and not revoked.
CREATE FUNCTION "private"."cap_open"(
    "p_cap" "public"."venue_capability",
    "p_by_level" boolean,
    "p_granted" "public"."venue_capability"[],
    "p_revoked" "public"."venue_capability"[]
) RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT (COALESCE(p_by_level, false) OR p_cap = ANY (COALESCE(p_granted, '{}')))
         AND NOT p_cap = ANY (COALESCE(p_revoked, '{}'));
$$;

CREATE OR REPLACE FUNCTION "private"."role_capabilities"(
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
  WHERE (c = 'staff' AND p_level >= 40)
     OR private.cap_open(c, CASE
          WHEN c = 'menu' THEN p_level >= p_visibility_level
          WHEN c = 'specs' THEN p_level >= p_measurement_level
          ELSE c = ANY (private.base_capabilities(p_level))
        END, p_granted, p_revoked);
$$;

ALTER TABLE "public"."venue_roles" DROP CONSTRAINT "venue_roles_overrides_not_level_bound";
DROP FUNCTION "private"."level_bound_capabilities"();

ALTER TABLE "public"."venue_roles" ADD CONSTRAINT "venue_roles_admin_keeps_staff"
    CHECK ("base_level" < 40 OR NOT ('staff' = ANY ("revoked")));

-- A venue's changes to a built-in role, for its members on that role.
CREATE TABLE "public"."venue_level_overrides" (
    "bar_id" "uuid" NOT NULL REFERENCES "public"."bars"("id") ON DELETE CASCADE,
    "base_level" integer NOT NULL CHECK ("base_level" = ANY (ARRAY[10, 20, 30, 35, 40])),
    "granted" "public"."venue_capability"[] DEFAULT '{}' NOT NULL,
    "revoked" "public"."venue_capability"[] DEFAULT '{}' NOT NULL,
    "updated_by" "uuid" DEFAULT "auth"."uid"() REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    PRIMARY KEY ("bar_id", "base_level"),
    CONSTRAINT "venue_level_overrides_disjoint" CHECK (NOT ("granted" && "revoked")),
    CONSTRAINT "venue_level_overrides_admin_keeps_staff" CHECK ("base_level" < 40 OR NOT ('staff' = ANY ("revoked")))
);

-- What a member on this level (and venue role, if any) can do at a bar.
CREATE FUNCTION "private"."member_capabilities"("p_bar_id" "uuid", "p_level" integer, "p_role_id" "uuid") RETURNS "public"."venue_capability"[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT private.role_capabilities(
    p_level, COALESCE(vr.granted, lo.granted), COALESCE(vr.revoked, lo.revoked),
    b.default_visibility_level, b.default_measurement_level)
  FROM public.bars b
  LEFT JOIN public.venue_roles vr ON vr.id = p_role_id AND vr.bar_id = b.id
  LEFT JOIN public.venue_level_overrides lo ON p_role_id IS NULL AND lo.bar_id = b.id AND lo.base_level = p_level
  WHERE b.id = p_bar_id;
$$;

-- The caller's permissions at a bar: empty when they aren't a member or their
-- role has ended (a takeover role grants nothing after its end date).
CREATE OR REPLACE FUNCTION "private"."capabilities"("p_bar_id" "uuid") RETURNS "public"."venue_capability"[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT COALESCE((
    SELECT private.member_capabilities(ub.bar_id, ub.role_level, ub.venue_role_id)
    FROM public.user_bars ub
    LEFT JOIN public.venue_roles vr ON vr.id = ub.venue_role_id
    WHERE ub.bar_id = p_bar_id AND ub.user_id = auth.uid()
      AND (vr.ends_at IS NULL OR vr.ends_at > now())
  ), '{}');
$$;

-- For the Roles screen: the five built-in roles (with this venue's changes)
-- and the venue's own roles. starts_with is what the role could do before
-- anyone changed it, so the app marks a changed dot. Members only.
DROP FUNCTION "public"."get_venue_role_matrix"("p_bar_id" "uuid");
CREATE FUNCTION "public"."get_venue_role_matrix"("p_bar_id" "uuid")
    RETURNS TABLE("role_id" "uuid", "name" "text", "base_level" integer, "ends_at" timestamp with time zone,
                  "granted" "public"."venue_capability"[], "revoked" "public"."venue_capability"[],
                  "capabilities" "public"."venue_capability"[], "starts_with" "public"."venue_capability"[])
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT NULL::uuid, NULL::text, l, NULL::timestamptz,
         COALESCE(lo.granted, '{}'), COALESCE(lo.revoked, '{}'),
         private.role_capabilities(l, lo.granted, lo.revoked, b.default_visibility_level, b.default_measurement_level),
         private.role_capabilities(l, '{}', '{}', b.default_visibility_level, b.default_measurement_level)
  FROM public.bars b
  CROSS JOIN unnest(ARRAY[10, 20, 30, 35, 40]) AS l
  LEFT JOIN public.venue_level_overrides lo ON lo.bar_id = b.id AND lo.base_level = l
  WHERE b.id = p_bar_id AND b.id IN (SELECT private.my_bar_ids(0))
  UNION ALL
  SELECT vr.id, vr.name, vr.base_level, vr.ends_at, vr.granted, vr.revoked,
         private.role_capabilities(vr.base_level, vr.granted, vr.revoked, b.default_visibility_level, b.default_measurement_level),
         private.role_capabilities(vr.base_level, '{}', '{}', b.default_visibility_level, b.default_measurement_level)
  FROM public.venue_roles vr
  JOIN public.bars b ON b.id = vr.bar_id
  WHERE vr.bar_id = p_bar_id AND b.id IN (SELECT private.my_bar_ids(0))
  ORDER BY 3, 2 NULLS FIRST;
$$;

-- Switch one permission for one role at a bar: a venue role (p_role_id) or a
-- built-in one (p_level). In one statement, so quick taps can't lose each
-- other. Runs as the caller: the policies and guards below decide who may.
CREATE FUNCTION "public"."set_role_capability"(
    "p_bar_id" "uuid",
    "p_role_id" "uuid",
    "p_level" integer,
    "p_capability" "public"."venue_capability",
    "p_on" boolean
) RETURNS void
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
    v_level integer;
    v_has boolean;
    v_grant public.venue_capability[];
    v_revoke public.venue_capability[];
    v_rows integer;
BEGIN
    IF p_bar_id IS NULL OR p_capability IS NULL OR p_on IS NULL THEN
        RAISE EXCEPTION 'Pick a role and a permission.' USING ERRCODE = '22023';
    END IF;
    IF p_role_id IS NOT NULL THEN
        SELECT vr.base_level INTO v_level FROM public.venue_roles vr WHERE vr.id = p_role_id AND vr.bar_id = p_bar_id;
    ELSIF p_level = ANY (ARRAY[10, 20, 30, 35, 40]) THEN
        v_level := p_level;
    END IF;
    IF v_level IS NULL THEN
        RAISE EXCEPTION 'There''s no such role at this venue.' USING ERRCODE = 'P0002';
    END IF;

    SELECT p_capability = ANY (private.role_capabilities(v_level, '{}', '{}', b.default_visibility_level, b.default_measurement_level))
    INTO v_has FROM public.bars b WHERE b.id = p_bar_id;
    v_grant := CASE WHEN p_on AND NOT v_has THEN ARRAY[p_capability] ELSE '{}' END;
    v_revoke := CASE WHEN NOT p_on AND v_has THEN ARRAY[p_capability] ELSE '{}' END;

    IF p_role_id IS NOT NULL THEN
        UPDATE public.venue_roles
        SET granted = array_remove(granted, p_capability) || v_grant,
            revoked = array_remove(revoked, p_capability) || v_revoke
        WHERE id = p_role_id AND bar_id = p_bar_id;
    ELSE
        INSERT INTO public.venue_level_overrides AS o (bar_id, base_level, granted, revoked)
        VALUES (p_bar_id, v_level, v_grant, v_revoke)
        ON CONFLICT (bar_id, base_level) DO UPDATE
        SET granted = array_remove(o.granted, p_capability) || v_grant,
            revoked = array_remove(o.revoked, p_capability) || v_revoke,
            updated_by = auth.uid(),
            updated_at = now();
    END IF;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
        RAISE EXCEPTION 'Only people who can invite and manage staff change roles.';
    END IF;
END;
$$;

-- --- Who may change roles ---

-- Someone with staff who isn't an Admin can't change Admin roles, and can
-- only hand out permissions they have themselves (a role, or a built-in
-- role's changes, may not open anything new that they can't do).
CREATE FUNCTION "private"."guard_role_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_bar uuid := COALESCE(NEW.bar_id, OLD.bar_id);
    v_vis integer;
    v_meas integer;
    v_before public.venue_capability[] := '{}';
    v_after public.venue_capability[];
BEGIN
    -- A venue that's being deleted is already gone: nothing to guard.
    IF auth.uid() IS NULL OR private.is_app_admin() OR v_bar IN (SELECT private.my_bar_ids(40))
       OR NOT EXISTS (SELECT 1 FROM public.bars WHERE id = v_bar) THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    IF (TG_OP <> 'INSERT' AND OLD.base_level >= 40) OR (TG_OP <> 'DELETE' AND NEW.base_level >= 40) THEN
        RAISE EXCEPTION 'Only an Admin can change what an Admin role can do.';
    END IF;

    SELECT default_visibility_level, default_measurement_level INTO v_vis, v_meas FROM public.bars WHERE id = v_bar;
    IF TG_OP = 'DELETE' THEN
        -- A deleted venue role's members fall back to its built-in role;
        -- a removed change puts the built-in role back as it was.
        v_after := CASE WHEN TG_TABLE_NAME = 'venue_roles'
            THEN private.member_capabilities(v_bar, OLD.base_level, NULL)
            ELSE private.role_capabilities(OLD.base_level, '{}', '{}', v_vis, v_meas) END;
    ELSE
        v_after := private.role_capabilities(NEW.base_level, NEW.granted, NEW.revoked, v_vis, v_meas);
    END IF;
    IF TG_OP <> 'INSERT' THEN
        v_before := private.role_capabilities(OLD.base_level, OLD.granted, OLD.revoked, v_vis, v_meas);
    ELSIF TG_TABLE_NAME = 'venue_level_overrides' THEN
        v_before := private.role_capabilities(NEW.base_level, '{}', '{}', v_vis, v_meas);
    END IF;

    IF EXISTS (
        SELECT unnest(v_after) EXCEPT SELECT unnest(v_before) EXCEPT SELECT unnest(private.capabilities(v_bar))
    ) THEN
        RAISE EXCEPTION 'You can only give a role what you can do yourself.';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER "guard_role_change" BEFORE INSERT OR UPDATE OR DELETE ON "public"."venue_roles"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_role_change"();
CREATE TRIGGER "guard_role_change" BEFORE INSERT OR UPDATE OR DELETE ON "public"."venue_level_overrides"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_role_change"();

-- The same rule for members: someone with staff who isn't an Admin can't
-- change or remove an Admin, make anyone an Admin, or give someone more than
-- they can do themselves (nor themselves more than they had). After the row
-- is final (sync_member_role_level has copied a venue role's level), so the
-- caller's own standing is read from OLD when it's their own row.
-- accept_bar_invite sets cocktail.accepting_invite: there the invite, which
-- add_user_to_bar_by_email already checked, decides the role.
CREATE FUNCTION "private"."guard_member_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_self boolean := OLD.user_id = auth.uid();
    v_mine public.venue_capability[];
BEGIN
    IF auth.uid() IS NULL OR private.is_app_admin()
       OR current_setting('cocktail.accepting_invite', true) = 'on'
       OR NOT EXISTS (SELECT 1 FROM public.bars WHERE id = OLD.bar_id) THEN
        RETURN NULL;
    END IF;
    -- Leaving is always allowed (keep_a_venue_admin keeps an Admin).
    IF TG_OP = 'DELETE' AND v_self THEN
        RETURN NULL;
    END IF;
    IF (v_self AND OLD.role_level >= 40) OR (NOT v_self AND OLD.bar_id IN (SELECT private.my_bar_ids(40))) THEN
        RETURN NULL;
    END IF;
    IF OLD.role_level >= 40 OR (TG_OP = 'UPDATE' AND NEW.role_level >= 40) THEN
        RAISE EXCEPTION 'Only an Admin can change an Admin, or make someone one.';
    END IF;
    IF TG_OP = 'UPDATE' THEN
        v_mine := CASE WHEN v_self
            THEN private.member_capabilities(OLD.bar_id, OLD.role_level, OLD.venue_role_id)
            ELSE private.capabilities(OLD.bar_id) END;
        IF EXISTS (
            SELECT unnest(private.member_capabilities(NEW.bar_id, NEW.role_level, NEW.venue_role_id))
            EXCEPT SELECT unnest(private.member_capabilities(OLD.bar_id, OLD.role_level, OLD.venue_role_id))
            EXCEPT SELECT unnest(v_mine)
        ) THEN
            RAISE EXCEPTION 'You can only give someone a role that does no more than yours.';
        END IF;
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER "guard_member_change" AFTER UPDATE OR DELETE ON "public"."user_bars"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_member_change"();

-- As 20261014900000_venue_setup_claims.sql, with the flag above
-- around the one statement that writes the member's role.
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

    PERFORM set_config('cocktail.accepting_invite', 'on', true);
    INSERT INTO public.user_bars (user_id, bar_id, role_level)
    VALUES (auth.uid(), p_bar_id, v_invite.role_level)
    ON CONFLICT (user_id, bar_id) DO UPDATE SET role_level = EXCLUDED.role_level
    RETURNING * INTO v_member;
    PERFORM set_config('cocktail.accepting_invite', 'off', true);

    RETURN v_member;
END;
$$;

-- --- Policies: staff ---

ALTER TABLE "public"."venue_level_overrides" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "venue_level_overrides_select" ON "public"."venue_level_overrides" FOR SELECT TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."my_bar_ids"(0)));
CREATE POLICY "venue_level_overrides_insert" ON "public"."venue_level_overrides" FOR INSERT TO "authenticated"
    WITH CHECK ("bar_id" IN (SELECT "private"."bars_with_capability"('staff')));
CREATE POLICY "venue_level_overrides_update" ON "public"."venue_level_overrides" FOR UPDATE TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."bars_with_capability"('staff')))
    WITH CHECK ("bar_id" IN (SELECT "private"."bars_with_capability"('staff')));
CREATE POLICY "venue_level_overrides_delete" ON "public"."venue_level_overrides" FOR DELETE TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."bars_with_capability"('staff')));

ALTER POLICY "venue_roles_insert" ON "public"."venue_roles"
    WITH CHECK ("bar_id" IN (SELECT "private"."bars_with_capability"('staff')));
ALTER POLICY "venue_roles_update" ON "public"."venue_roles"
    USING ("bar_id" IN (SELECT "private"."bars_with_capability"('staff')))
    WITH CHECK ("bar_id" IN (SELECT "private"."bars_with_capability"('staff')));
ALTER POLICY "venue_roles_delete" ON "public"."venue_roles"
    USING ("bar_id" IN (SELECT "private"."bars_with_capability"('staff')));

ALTER POLICY "user_bars_update" ON "public"."user_bars"
    USING ("bar_id" IN (SELECT "private"."bars_with_capability"('staff')))
    WITH CHECK ("bar_id" IN (SELECT "private"."bars_with_capability"('staff')));
ALTER POLICY "user_bars_delete" ON "public"."user_bars"
    USING ("user_id" = (SELECT "auth"."uid"()) OR "bar_id" IN (SELECT "private"."bars_with_capability"('staff')));

ALTER POLICY "bar_invites_select" ON "public"."bar_invites"
    USING ("bar_id" IN (SELECT "private"."bars_with_capability"('staff'))
           OR "email" = lower((SELECT "auth"."jwt"()) ->> 'email'));
-- Only an Admin cancels an invite to Admin (add_user_to_bar_by_email has the same rule).
ALTER POLICY "bar_invites_delete" ON "public"."bar_invites"
    USING (("bar_id" IN (SELECT "private"."bars_with_capability"('staff'))
            AND ("role_level" < 40 OR "bar_id" IN (SELECT "private"."my_bar_ids"(40))))
           OR "email" = lower((SELECT "auth"."jwt"()) ->> 'email'));

-- As 20261008740000_daily_limits_and_venue_roles.sql, with staff in place of Admin, and
-- someone with staff who isn't an Admin inviting only to roles no bigger than theirs,
-- and never changing a pending invite to Admin (which only an Admin makes or cancels).
CREATE OR REPLACE FUNCTION "public"."add_user_to_bar_by_email"("p_email" "text", "p_bar_id" "uuid", "p_role_level" integer, "p_name" "text" DEFAULT NULL::"text") RETURNS "public"."user_bars"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_email TEXT := lower(btrim(p_email));
    v_name TEXT := nullif(btrim(p_name), '');
    v_member public.user_bars;
    v_admin boolean;
    v_rows integer;
BEGIN
    IF p_bar_id IS NULL OR p_bar_id NOT IN (SELECT private.bars_with_capability('staff')) THEN
        RAISE EXCEPTION 'You need the invite and manage staff permission to add members.';
    END IF;

    IF p_role_level IS NULL OR NOT (p_role_level = ANY (ARRAY[10, 20, 30, 35, 40])) THEN
        RAISE EXCEPTION 'Invalid role level.';
    END IF;

    v_admin := p_bar_id IN (SELECT private.my_bar_ids(40)) OR private.is_app_admin();
    IF NOT v_admin THEN
        IF p_role_level >= 40 THEN
            RAISE EXCEPTION 'Only an Admin can invite an Admin.';
        END IF;
        IF EXISTS (
            SELECT unnest(private.member_capabilities(p_bar_id, p_role_level, NULL))
            EXCEPT SELECT unnest(private.capabilities(p_bar_id))
        ) THEN
            RAISE EXCEPTION 'You can only invite someone to a role that does no more than yours.';
        END IF;
    END IF;

    IF v_email IS NULL OR v_email !~ '^[^@\s]+@[^@\s]+$' THEN
        RAISE EXCEPTION 'Enter an email address.';
    END IF;

    IF char_length(v_name) > 80 THEN
        RAISE EXCEPTION 'Keep the name to 80 characters.';
    END IF;

    -- A current member: change their role. People with staff already see members' emails.
    UPDATE public.user_bars ub
    SET role_level = p_role_level
    FROM auth.users au
    WHERE ub.bar_id = p_bar_id AND ub.user_id = au.id AND lower(au.email) = v_email
    RETURNING ub.* INTO v_member;

    IF FOUND THEN
        RETURN v_member;
    END IF;

    -- Anyone else: an invite, counted against the inviter's and the venue's
    -- day. One at a time per inviter and per venue, so quick taps can't both
    -- pass the limit.
    IF NOT private.is_app_admin() THEN
        PERFORM pg_advisory_xact_lock(hashtextextended('invite:' || auth.uid()::text, 0));
        PERFORM pg_advisory_xact_lock(hashtextextended('invite-bar:' || p_bar_id::text, 0));
        IF private.rate_count('invite', auth.uid(), NULL, NULL) >= private.daily_limit('invite_per_inviter') THEN
            RAISE EXCEPTION 'You''ve sent % invites today. Try again tomorrow.', private.daily_limit('invite_per_inviter');
        END IF;
        IF private.rate_count('invite', NULL, p_bar_id, NULL) >= private.daily_limit('invite_per_venue') THEN
            RAISE EXCEPTION 'This venue has sent % invites today. Try again tomorrow.', private.daily_limit('invite_per_venue');
        END IF;
    END IF;
    INSERT INTO private.rate_events (kind, user_id, bar_id) VALUES ('invite', auth.uid(), p_bar_id);

    -- The same whether or not the email has an account. A pending invite to
    -- Admin stays as it is unless an Admin changes it (the whole call,
    -- rate count included, is undone).
    INSERT INTO public.bar_invites (bar_id, email, role_level, invited_by, name)
    VALUES (p_bar_id, v_email, p_role_level, auth.uid(), v_name)
    ON CONFLICT (bar_id, email)
    DO UPDATE SET role_level = EXCLUDED.role_level, invited_by = EXCLUDED.invited_by, created_at = now(),
        name = COALESCE(EXCLUDED.name, public.bar_invites.name)
    WHERE v_admin OR public.bar_invites.role_level < 40;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
        RAISE EXCEPTION 'They''re already invited as an Admin. Only an Admin can change that invite.';
    END IF;

    RETURN NULL;
END;
$$;

-- As 20261010700000_profile_identity.sql, with emails for people with staff (they were Admin-only).
CREATE OR REPLACE FUNCTION "public"."get_bar_members"("p_bar_id" "uuid")
    RETURNS TABLE("user_id" "uuid", "email" "text", "role_level" integer, "display_name" "text", "joined_at" timestamp with time zone,
                  "avatar_url" "text", "venue_role_id" "uuid", "venue_role_name" "text", "role_ends_at" timestamp with time zone,
                  "role_since" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_user_role INT;
    v_staff BOOLEAN;
BEGIN
    SELECT ub.role_level INTO v_user_role
    FROM public.user_bars ub
    WHERE ub.bar_id = p_bar_id AND ub.user_id = auth.uid()
      AND NOT EXISTS (
          SELECT 1 FROM public.venue_roles vr WHERE vr.id = ub.venue_role_id AND vr.ends_at <= now()
      );

    IF v_user_role IS NULL THEN
        RAISE EXCEPTION 'You do not have access to view this bar members.';
    END IF;
    v_staff := 'staff' = ANY (private.capabilities(p_bar_id));

    RETURN QUERY
    SELECT
        ub.user_id,
        CASE
            WHEN v_staff OR ub.user_id = auth.uid() THEN au.email::TEXT
            ELSE NULL::TEXT
        END,
        ub.role_level,
        private.member_display_name(ub.user_id),
        ub.created_at,
        COALESCE(
            private.account_photo(ub.user_id),
            p.avatar_url
        ),
        vr.id,
        vr.name,
        vr.ends_at,
        ub.role_since
    FROM public.user_bars ub
    JOIN auth.users au ON ub.user_id = au.id
    LEFT JOIN public.profiles p ON p.user_id = ub.user_id AND p.kind = 'person'
    LEFT JOIN public.venue_roles vr ON vr.id = ub.venue_role_id
    WHERE ub.bar_id = p_bar_id
      AND (vr.ends_at IS NULL OR vr.ends_at > now());
END;
$$;

-- --- Policies: brand ---

-- People with brand change the brand columns; everything else on bars stays
-- with Admins. Runs before the other bars triggers, so it sees only what the
-- caller sent.
CREATE FUNCTION "private"."guard_bar_brand"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_brand text[] := ARRAY['logo_url', 'primary_color', 'secondary_color', 'accent_light_color', 'display_face',
                            'ground_tint', 'short_name', 'icon_url', 'accent_text', 'icon_background'];
BEGIN
    IF auth.uid() IS NULL OR private.is_app_admin() THEN
        RETURN NEW;
    END IF;
    IF (to_jsonb(NEW) - v_brand) IS DISTINCT FROM (to_jsonb(OLD) - v_brand)
       AND NEW.id NOT IN (SELECT private.my_bar_ids(40)) THEN
        RAISE EXCEPTION 'Only an Admin can change the venue''s settings.';
    END IF;
    IF EXISTS (SELECT 1 FROM unnest(v_brand) AS k WHERE to_jsonb(NEW) -> k IS DISTINCT FROM to_jsonb(OLD) -> k)
       AND NEW.id NOT IN (SELECT private.bars_with_capability('brand')) THEN
        RAISE EXCEPTION 'Changing the venue''s brand needs the edit brand permission.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "guard_bar_brand" BEFORE UPDATE ON "public"."bars"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_bar_brand"();

ALTER POLICY "bars_update" ON "public"."bars"
    USING ("id" IN (SELECT "private"."my_bar_ids"(40)) OR "id" IN (SELECT "private"."bars_with_capability"('brand')))
    WITH CHECK ("id" IN (SELECT "private"."my_bar_ids"(40)) OR "id" IN (SELECT "private"."bars_with_capability"('brand')));

-- --- Policies: edit_drinks and menus ---

CREATE OR REPLACE FUNCTION "private"."can_write"("p_bar_id" "uuid", "p_created_by" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN p_bar_id IS NULL THEN p_created_by = auth.uid() OR private.is_app_admin()
    ELSE p_bar_id IN (SELECT private.bars_with_capability('edit_drinks'))
  END;
$$;

-- Menus: a bar's are for people who build menus; personal ones as before.
CREATE FUNCTION "private"."can_build_menu"("p_bar_id" "uuid", "p_created_by" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT CASE
    WHEN p_bar_id IS NULL THEN private.can_write(NULL, p_created_by)
    ELSE auth.uid() IS NOT NULL AND p_bar_id IN (SELECT private.bars_with_capability('menus'))
  END;
$$;

CREATE OR REPLACE FUNCTION "private"."can_edit_menu"("p_menu_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT COALESCE(
    (SELECT private.can_build_menu(bar_id, created_by) FROM public.menus WHERE id = p_menu_id),
    false
  );
$$;

ALTER POLICY "menus_insert" ON "public"."menus"
    WITH CHECK ("created_by" = (SELECT "auth"."uid"()) AND "private"."can_build_menu"("bar_id", "created_by"));
ALTER POLICY "menus_update" ON "public"."menus"
    USING ("private"."can_build_menu"("bar_id", "created_by"))
    WITH CHECK ("private"."can_build_menu"("bar_id", "created_by"));
ALTER POLICY "menus_delete" ON "public"."menus"
    USING ("private"."can_build_menu"("bar_id", "created_by"));

CREATE OR REPLACE FUNCTION "private"."can_edit_credited"("p_bar_id" "uuid", "p_is_catalog" boolean, "p_created_by" "uuid", "p_origin_bar_profile_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT auth.uid() IS NOT NULL
    AND private.is_bar_credited_drink(p_bar_id, p_is_catalog, p_created_by, p_origin_bar_profile_id)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = p_origin_bar_profile_id AND p.kind = 'bar'
        AND p.bar_id IN (SELECT private.bars_with_capability('edit_drinks'))
    );
$$;

CREATE OR REPLACE FUNCTION "private"."guard_item_credit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_changed BOOLEAN;
    v_old_status public.credit_status;
BEGIN
    IF NEW.creator_profile_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.creator_profile_id AND kind = 'person') THEN
        RAISE EXCEPTION 'A drink''s creator must be a person''s profile.';
    END IF;
    IF NEW.origin_bar_profile_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.origin_bar_profile_id AND kind = 'bar') THEN
        RAISE EXCEPTION 'A drink''s origin must be a bar''s profile.';
    END IF;

    IF NEW.creator_profile_id IS NULL AND NEW.origin_bar_profile_id IS NULL THEN
        NEW.credit_status := NULL;
        RETURN NEW;
    END IF;
    NEW.credit_status := COALESCE(NEW.credit_status, 'suggested');

    -- Service role and SQL run without a user; catalog admins moderate.
    IF auth.uid() IS NULL OR private.is_app_admin() THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        v_changed := true;
    ELSE
        v_changed := NEW.creator_profile_id IS DISTINCT FROM OLD.creator_profile_id
                  OR NEW.origin_bar_profile_id IS DISTINCT FROM OLD.origin_bar_profile_id;
        v_old_status := OLD.credit_status;
    END IF;

    IF NEW.credit_status = 'verified' THEN
        IF v_old_status IS DISTINCT FROM 'verified' THEN
            RAISE EXCEPTION 'Only moderators can verify a credit.';
        ELSIF v_changed THEN
            NEW.credit_status := 'suggested';
        END IF;
    END IF;

    IF NEW.credit_status = 'claimed' AND (v_changed OR v_old_status IS DISTINCT FROM 'claimed') THEN
        IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.creator_profile_id AND user_id = auth.uid())
           AND NOT EXISTS (
               SELECT 1 FROM public.profiles p
               WHERE p.id = NEW.origin_bar_profile_id AND p.bar_id IN (SELECT private.bars_with_capability('edit_drinks'))
           ) THEN
            RAISE EXCEPTION 'Only the creator or their bar can claim a credit.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

ALTER POLICY "drafts_select" ON "public"."drafts"
    USING ("user_id" = (SELECT "auth"."uid"()) OR "bar_id" IN (SELECT "private"."bars_with_capability"('edit_drinks')));
ALTER POLICY "drafts_update" ON "public"."drafts"
    USING ("user_id" = (SELECT "auth"."uid"()) OR "bar_id" IN (SELECT "private"."bars_with_capability"('edit_drinks')))
    WITH CHECK (
        ("user_id" = (SELECT "auth"."uid"()) OR "bar_id" IN (SELECT "private"."bars_with_capability"('edit_drinks')))
        AND ("bar_id" IS NULL OR "bar_id" IN (SELECT "private"."my_bar_ids"(0)))
    );
ALTER POLICY "drafts_delete" ON "public"."drafts"
    USING ("user_id" = (SELECT "auth"."uid"()) OR "bar_id" IN (SELECT "private"."bars_with_capability"('edit_drinks')));

-- --- Seeing a bar's drinks: menu, and edit_drinks sees them all ---

-- A member sees a bar item when they edit drinks there, or when the menu
-- opens to them: the item's (or the bar's) Who sees what level, moved by
-- their role's grant or revoke of menu.
CREATE OR REPLACE FUNCTION "private"."can_view_bar_item"("p_bar_id" "uuid", "p_override_visibility_level" integer) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_bars ub
    JOIN public.bars b ON b.id = ub.bar_id
    LEFT JOIN public.venue_roles vr ON vr.id = ub.venue_role_id
    LEFT JOIN public.venue_level_overrides lo ON ub.venue_role_id IS NULL AND lo.bar_id = ub.bar_id AND lo.base_level = ub.role_level
    WHERE ub.bar_id = p_bar_id
      AND ub.user_id = auth.uid()
      AND (vr.ends_at IS NULL OR vr.ends_at > now())
      AND (
        private.cap_open('edit_drinks', 'edit_drinks' = ANY (private.base_capabilities(ub.role_level)),
                         COALESCE(vr.granted, lo.granted), COALESCE(vr.revoked, lo.revoked))
        OR private.cap_open('menu', ub.role_level >= COALESCE(p_override_visibility_level, b.default_visibility_level),
                            COALESCE(vr.granted, lo.granted), COALESCE(vr.revoked, lo.revoked))
      )
  );
$$;

-- Same rule under View as: a previewed lower role leaves the person's own
-- grants and revokes out, so it shows the built-in role. People who edit
-- drinks see every bar item, as items_select lets them.
CREATE OR REPLACE FUNCTION "private"."can_view_item"("p_item_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.items c
    LEFT JOIN public.bars b ON b.id = c.bar_id
    LEFT JOIN public.user_bars ub ON ub.bar_id = c.bar_id AND ub.user_id = auth.uid()
        AND NOT EXISTS (SELECT 1 FROM public.venue_roles vr WHERE vr.id = ub.venue_role_id AND vr.ends_at <= now())
    LEFT JOIN public.venue_roles vr ON vr.id = ub.venue_role_id
    LEFT JOIN public.venue_level_overrides lo ON ub.venue_role_id IS NULL AND lo.bar_id = ub.bar_id AND lo.base_level = ub.role_level
    CROSS JOIN LATERAL (SELECT public.effective_bar_role(ub.role_level) AS role) er
    WHERE c.id = p_item_id
      AND (
        (c.bar_id IS NULL
         AND (c.created_by IS NULL
              OR c.item_type NOT IN ('cocktail', 'beer', 'wine')
              OR c.created_by = auth.uid()
              OR private.is_app_admin()))
        OR (ub.user_id IS NOT NULL
            AND (private.cap_open('menu', er.role >= COALESCE(c.override_visibility_level, b.default_visibility_level),
                                  CASE WHEN er.role = ub.role_level THEN COALESCE(vr.granted, lo.granted) END,
                                  CASE WHEN er.role = ub.role_level THEN COALESCE(vr.revoked, lo.revoked) END)
                 OR private.cap_open('edit_drinks', 'edit_drinks' = ANY (private.base_capabilities(er.role)),
                                     CASE WHEN er.role = ub.role_level THEN COALESCE(vr.granted, lo.granted) END,
                                     CASE WHEN er.role = ub.role_level THEN COALESCE(vr.revoked, lo.revoked) END)))
        OR EXISTS (SELECT 1 FROM public.published_items pi WHERE pi.id = c.id)
      )
  );
$$;

-- The same rule as can_view_bar_item, for every bar the caller is on at
-- once, so items_select works it out once per query instead of once per row
-- (a bar's 5,000 drinks: about 2 ms, against 240 ms calling it per row).
--   sees_all: edits drinks there, or the role is given menu (every drink).
--   sees_by_level: menu isn't taken away, so the Who sees what level decides.
CREATE FUNCTION "private"."my_bar_item_access"()
    RETURNS TABLE("bar_id" "uuid", "sees_all" boolean, "sees_by_level" boolean, "role_level" integer, "default_level" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT ub.bar_id,
         private.cap_open('edit_drinks', 'edit_drinks' = ANY (private.base_capabilities(ub.role_level)),
                          COALESCE(vr.granted, lo.granted), COALESCE(vr.revoked, lo.revoked))
           OR private.cap_open('menu', false, COALESCE(vr.granted, lo.granted), COALESCE(vr.revoked, lo.revoked)),
         private.cap_open('menu', true, COALESCE(vr.granted, lo.granted), COALESCE(vr.revoked, lo.revoked)),
         ub.role_level,
         b.default_visibility_level
  FROM public.user_bars ub
  JOIN public.bars b ON b.id = ub.bar_id
  LEFT JOIN public.venue_roles vr ON vr.id = ub.venue_role_id
  LEFT JOIN public.venue_level_overrides lo ON ub.venue_role_id IS NULL AND lo.bar_id = ub.bar_id AND lo.base_level = ub.role_level
  WHERE ub.user_id = auth.uid()
    AND (vr.ends_at IS NULL OR vr.ends_at > now());
$$;

ALTER POLICY "items_select" ON "public"."items" USING (
  CASE
    WHEN "bar_id" IS NOT NULL THEN (
      "bar_id" IN (SELECT "a"."bar_id" FROM "private"."my_bar_item_access"() "a" WHERE "a"."sees_all")
      OR EXISTS (
        SELECT 1 FROM "private"."my_bar_item_access"() "a"
        WHERE "a"."bar_id" = "items"."bar_id" AND "a"."sees_by_level"
          AND "a"."role_level" >= COALESCE("items"."override_visibility_level", "a"."default_level")
      )
    )
    WHEN "created_by" IS NULL THEN (
      "origin_bar_profile_id" IS NULL OR "is_catalog"
      OR NOT ("origin_bar_profile_id" IN (SELECT "private"."page_closed_profile_ids"(true)))
    )
    WHEN "item_type" <> ALL (ARRAY['cocktail'::"public"."entity_type", 'beer'::"public"."entity_type", 'wine'::"public"."entity_type"]) THEN (
      "is_catalog" OR "created_by" = (SELECT "auth"."uid"()) OR (SELECT "private"."is_app_admin"()) OR "private"."can_see_home_item"("id")
    )
    ELSE (
      "created_by" = (SELECT "auth"."uid"()) OR (SELECT "private"."is_app_admin"())
      OR (
        "publish_mode" = ANY (ARRAY['description'::"public"."item_publish_mode", 'spec'::"public"."item_publish_mode"])
        AND "moderated_at" IS NULL
        AND NOT ("created_by" IN (SELECT "private"."blocked_user_ids"()))
        AND EXISTS (SELECT 1 FROM "public"."profiles" "p" WHERE "p"."user_id" = "items"."created_by" AND "p"."is_public" AND "p"."moderated_at" IS NULL)
      )
    )
  END
);

-- As 20261029500000_ice_builds.sql, with the role's grant or revoke of menu
-- moving the Who sees what level, and people who edit drinks seeing every
-- bar item, as items_select lets them (grants and revokes not under View as;
-- a previewed role decides by its built-in permissions).
CREATE OR REPLACE VIEW "public"."app_item_presentation" WITH ("security_invoker" = true) AS
 SELECT c.id,
    c.name,
    c.item_type,
    c.description,
    c.created_at,
    c.glassware_id,
    c.family_id,
    c.ice_id,
    COALESCE(c.notes, (SELECT n.notes FROM public.credited_drink_notes n WHERE n.item_id = c.id)) AS notes,
    c.origin,
    COALESCE(c.price, (SELECT cd.price FROM public.credited_drink_details cd WHERE cd.item_id = c.id)) AS price,
    c.status,
    c.brand_maker,
    c.abv,
    c.bar_id,
    c.icon_key,
    c.icon_url,
    c.hide_from_search,
    c.origin_bar_profile_id,
    c.created_by,
    c.creator_profile_id,
    c.generic_id,
    c.service_style,
    c.density_g_ml,
    COALESCE(c.dilution_pct, (SELECT cd.dilution_pct FROM public.credited_drink_details cd WHERE cd.item_id = c.id)) AS dilution_pct,
    COALESCE(c.serve_ml, (SELECT cd.serve_ml FROM public.credited_drink_details cd WHERE cd.item_id = c.id)) AS serve_ml,
    COALESCE(c.serve_abv, (SELECT cd.serve_abv FROM public.credited_drink_details cd WHERE cd.item_id = c.id)) AS serve_abv,
    c.abv_source,
    c.capacity_ml,
    c.iced_capacity_ml,
    c.ice_per_serve_g,
    COALESCE(c.price_minor, (SELECT cd.price_minor FROM public.credited_drink_details cd WHERE cd.item_id = c.id)) AS price_minor,
    c.is_core,
    c.ingredient_role,
    c.made_from_id,
    c.method_ice_id,
    c.ice_build
   FROM public.items c
     LEFT JOIN public.bars b ON c.bar_id = b.id
     LEFT JOIN public.user_bars ub ON ub.bar_id = c.bar_id AND ub.user_id = auth.uid()
     LEFT JOIN public.venue_roles vr ON vr.id = ub.venue_role_id
     LEFT JOIN public.venue_level_overrides lo ON ub.venue_role_id IS NULL AND lo.bar_id = ub.bar_id AND lo.base_level = ub.role_level
     CROSS JOIN LATERAL (SELECT public.effective_bar_role(ub.role_level) AS role) er
  WHERE c.bar_id IS NULL
     OR private.cap_open('menu', er.role >= COALESCE(c.override_visibility_level, b.default_visibility_level),
                         CASE WHEN er.role = ub.role_level THEN COALESCE(vr.granted, lo.granted) END,
                         CASE WHEN er.role = ub.role_level THEN COALESCE(vr.revoked, lo.revoked) END)
     OR (ub.user_id IS NOT NULL
         AND private.cap_open('edit_drinks', 'edit_drinks' = ANY (private.base_capabilities(er.role)),
                              CASE WHEN er.role = ub.role_level THEN COALESCE(vr.granted, lo.granted) END,
                              CASE WHEN er.role = ub.role_level THEN COALESCE(vr.revoked, lo.revoked) END));

-- As 20261010200000_catalog_read_speed.sql, with the role's grant or revoke
-- of menu moving the Who sees what level, and of specs the measurement level
-- (amounts, units, at service). A specs grant also shows the ingredient
-- names at the generic level, so the amounts have names. Not under View as.
CREATE OR REPLACE VIEW "public"."app_recipe_presentation" WITH ("security_invoker" = false) AS
SELECT
    "r"."id",
    "r"."created_at",
    "r"."recipe_item_id",
    CASE
        WHEN "c"."bar_id" IS NULL THEN "r"."ingredient_item_id"
        WHEN "ub"."user_id" IS NOT NULL AND "er"."role" >= COALESCE("c"."override_specific_brand_level", "b"."default_specific_brand_level") THEN "r"."ingredient_item_id"
        WHEN "ub"."user_id" IS NOT NULL AND ("er"."role" >= COALESCE("c"."override_generic_ingredient_level", "b"."default_generic_ingredient_level") OR "ov"."specs") THEN COALESCE(COALESCE("r"."parent_ingredient_id", "s"."generic_id"), "r"."ingredient_item_id")
        WHEN "ps"."id" IS NOT NULL THEN COALESCE(COALESCE("r"."parent_ingredient_id", "s"."generic_id"), "r"."ingredient_item_id")
        ELSE NULL::"uuid"
    END AS "display_ingredient_id",
    CASE
        WHEN "c"."bar_id" IS NULL THEN "r"."amount"
        WHEN "ub"."user_id" IS NOT NULL AND "private"."cap_open"('specs', "er"."role" >= COALESCE("c"."override_measurement_level", "b"."default_measurement_level"), "ov"."granted", "ov"."revoked") THEN "r"."amount"
        WHEN "ps"."id" IS NOT NULL THEN "r"."amount"
        ELSE NULL::numeric
    END AS "amount",
    CASE
        WHEN "c"."bar_id" IS NULL THEN "r"."unit"
        WHEN "ub"."user_id" IS NOT NULL AND "private"."cap_open"('specs', "er"."role" >= COALESCE("c"."override_measurement_level", "b"."default_measurement_level"), "ov"."granted", "ov"."revoked") THEN "r"."unit"
        WHEN "ps"."id" IS NOT NULL THEN "r"."unit"
        ELSE NULL::"text"
    END AS "unit",
    CASE
        WHEN "c"."bar_id" IS NULL THEN "r"."preparation_notes"
        WHEN "ub"."user_id" IS NOT NULL AND "er"."role" >= COALESCE("c"."override_prep_level", "b"."default_prep_level") THEN "r"."preparation_notes"
        ELSE NULL::"text"
    END AS "preparation_notes",
    "r"."is_optional",
    CASE
        WHEN "c"."bar_id" IS NULL THEN COALESCE("r"."parent_ingredient_id", "s"."generic_id")
        WHEN "ub"."user_id" IS NOT NULL AND "er"."role" >= COALESCE("c"."override_specific_brand_level", "b"."default_specific_brand_level") THEN COALESCE("r"."parent_ingredient_id", "s"."generic_id")
        WHEN "ub"."user_id" IS NOT NULL AND ("er"."role" >= COALESCE("c"."override_generic_ingredient_level", "b"."default_generic_ingredient_level") OR "ov"."specs") THEN COALESCE("r"."parent_ingredient_id", "s"."generic_id")
        WHEN "ps"."id" IS NOT NULL THEN COALESCE("r"."parent_ingredient_id", "s"."generic_id")
        ELSE NULL::"uuid"
    END AS "parent_ingredient_id",
    CASE
        WHEN "c"."bar_id" IS NULL THEN "r"."ingredient_item_id"
        WHEN "ub"."user_id" IS NOT NULL AND "er"."role" >= COALESCE("c"."override_specific_brand_level", "b"."default_specific_brand_level") THEN "r"."ingredient_item_id"
        ELSE NULL::"uuid"
    END AS "ingredient_item_id",
    "r"."sort_order",
    CASE
        WHEN "c"."bar_id" IS NULL THEN "r"."at_service"
        WHEN "ub"."user_id" IS NOT NULL AND "private"."cap_open"('specs', "er"."role" >= COALESCE("c"."override_measurement_level", "b"."default_measurement_level"), "ov"."granted", "ov"."revoked") THEN "r"."at_service"
        WHEN "ps"."id" IS NOT NULL THEN "r"."at_service"
        ELSE NULL::boolean
    END AS "at_service"
FROM "public"."recipes" "r"
JOIN "public"."items" "c" ON "r"."recipe_item_id" = "c"."id"
LEFT JOIN "public"."items" "s" ON "s"."id" = "r"."ingredient_item_id"
LEFT JOIN "public"."bars" "b" ON "c"."bar_id" = "b"."id"
LEFT JOIN "public"."user_bars" "ub" ON "ub"."bar_id" = "c"."bar_id" AND "ub"."user_id" = "auth"."uid"()
    AND NOT EXISTS (SELECT 1 FROM "public"."venue_roles" "vr" WHERE "vr"."id" = "ub"."venue_role_id" AND "vr"."ends_at" <= "now"())
LEFT JOIN "public"."venue_roles" "mvr" ON "mvr"."id" = "ub"."venue_role_id"
LEFT JOIN "public"."venue_level_overrides" "mlo" ON "ub"."venue_role_id" IS NULL AND "mlo"."bar_id" = "ub"."bar_id" AND "mlo"."base_level" = "ub"."role_level"
LEFT JOIN (
    SELECT "l"."id" FROM "private"."published_listing" "l" WHERE "l"."effective_mode" = 'spec'
) "ps" ON "ps"."id" = "c"."id"
LEFT JOIN "public"."profiles" "op" ON "op"."id" = "c"."origin_bar_profile_id"
    AND "c"."bar_id" IS NULL AND NOT "c"."is_catalog" AND "c"."created_by" IS NULL
LEFT JOIN "public"."bars" "ob" ON "ob"."id" = "op"."bar_id"
-- effective_bar_role(ub.role_level). A join, not a scalar subquery: see above.
LEFT JOIN "public"."user_prefs" "up" ON "up"."user_id" = "auth"."uid"()
CROSS JOIN LATERAL (
    SELECT LEAST(COALESCE("ub"."role_level", 10), COALESCE("up"."view_as_role_level", COALESCE("ub"."role_level", 10))) AS "role"
) "er"
-- The member's own grants and revokes, left out under View as.
CROSS JOIN LATERAL (
    SELECT "g"."granted", "g"."revoked", 'specs' = ANY ("g"."granted") AS "specs"
    FROM (SELECT
        CASE WHEN "er"."role" = "ub"."role_level" THEN COALESCE("mvr"."granted", "mlo"."granted", '{}') ELSE '{}' END AS "granted",
        CASE WHEN "er"."role" = "ub"."role_level" THEN COALESCE("mvr"."revoked", "mlo"."revoked", '{}') ELSE '{}' END AS "revoked"
    ) "g"
) "ov"
WHERE (
    "auth"."uid"() IS NOT NULL
    AND (
        (
            "c"."bar_id" IS NULL
            AND (
                "c"."created_by" IS NULL
                OR "c"."created_by" = "auth"."uid"()
                OR ("c"."item_type" <> ALL (ARRAY['cocktail'::"public"."entity_type", 'beer'::"public"."entity_type", 'wine'::"public"."entity_type"])
                    AND ("c"."is_catalog" OR "private"."can_see_home_item"("c"."id")))
                OR EXISTS (SELECT 1 FROM "private"."app_admins" "aa" WHERE "aa"."user_id" = "auth"."uid"())
            )
            AND (
                "op"."id" IS NULL
                OR COALESCE("ob"."page_visibility", 'description'::"public"."bar_page_visibility") = 'open'
                OR EXISTS (SELECT 1 FROM "private"."app_admins" "aa" WHERE "aa"."user_id" = "auth"."uid"())
                OR EXISTS (
                    SELECT 1 FROM "public"."user_bars" "tb"
                    WHERE "tb"."bar_id" = "ob"."id" AND "tb"."user_id" = "auth"."uid"()
                      AND NOT EXISTS (SELECT 1 FROM "public"."venue_roles" "vr" WHERE "vr"."id" = "tb"."venue_role_id" AND "vr"."ends_at" <= "now"()))
            )
        )
        OR ("ub"."user_id" IS NOT NULL
            AND "private"."cap_open"('menu', "er"."role" >= COALESCE("c"."override_visibility_level", "b"."default_visibility_level"), "ov"."granted", "ov"."revoked"))
    )
) OR "ps"."id" IS NOT NULL;

-- --- Grants ---

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."venue_level_overrides" TO "authenticated";
GRANT ALL ON TABLE "public"."venue_level_overrides" TO "service_role";

REVOKE EXECUTE ON FUNCTION "private"."cap_open"("public"."venue_capability", boolean, "public"."venue_capability"[], "public"."venue_capability"[]) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."cap_open"("public"."venue_capability", boolean, "public"."venue_capability"[], "public"."venue_capability"[]) TO "authenticated", "service_role";
REVOKE EXECUTE ON FUNCTION "private"."member_capabilities"("uuid", integer, "uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."member_capabilities"("uuid", integer, "uuid") TO "authenticated", "service_role";
REVOKE EXECUTE ON FUNCTION "private"."my_bar_item_access"() FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."my_bar_item_access"() TO "authenticated", "service_role";
REVOKE EXECUTE ON FUNCTION "private"."can_build_menu"("uuid", "uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."can_build_menu"("uuid", "uuid") TO "authenticated", "service_role";
REVOKE EXECUTE ON FUNCTION "private"."guard_role_change"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."guard_member_change"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."guard_bar_brand"() FROM PUBLIC, "anon", "authenticated";

REVOKE EXECUTE ON FUNCTION "public"."get_venue_role_matrix"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."get_venue_role_matrix"("uuid") TO "authenticated", "service_role";
REVOKE EXECUTE ON FUNCTION "public"."set_role_capability"("uuid", "uuid", integer, "public"."venue_capability", boolean) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."set_role_capability"("uuid", "uuid", integer, "public"."venue_capability", boolean) TO "authenticated", "service_role";
