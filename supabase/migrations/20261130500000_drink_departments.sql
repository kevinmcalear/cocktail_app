-- Drink departments and approval (jam dec-25, Eddie's TestFlight notes
-- tf-059 and tf-087, 29 Oct).
--
-- tf-059: some staff add only beers and wines. They shouldn't see hidden
-- details or delete what isn't theirs. dec-25: roles split drink creators by
-- type, and their drafts wait for approval before going live.
--
--   * venue_roles.drink_types: a venue role may be limited to cocktails,
--     beer and wine (any of them). NULL, as every role has today, is every
--     kind. Cocktails include house-made ingredients (the cocktail side makes
--     the syrups and batches). Only venue roles carry it: built-in roles stay
--     as they are.
--   * Someone on a limited role ("a department") writes only items of those
--     kinds at that venue: items insert, update and delete, and every child
--     table that asks private.can_edit_item (recipes, notes, photos, steps).
--   * They don't see every drink just because they edit drinks: they see the
--     venue's drinks by its Who sees what level, as their built-in role
--     would, plus every drink of their own kinds (items_select and
--     private.visible_items; events and This week through
--     private.can_view_bar_item, by level only). A drink credited to the
--     venue (edited through its page) follows the same kinds. Costs,
--     house-made recipes and specs follow the
--     role's own permissions, which a venue switches as before.
--   * items.awaiting_approval: what a department adds waits for approval. A
--     trigger sets it on their inserts, whatever the client sends; only
--     someone who edits drinks at the venue with no department limit clears
--     it (approves). Until then only its maker and those approvers see it.
--   * get_venue_role_matrix returns each role's drink_types, and
--     public.my_drink_types tells the app the caller's own limit.
--
-- tf-087: a house-made ingredient's (batch's) method follows its own "prep"
-- level, as its recipe lines already follow theirs (app_recipe_presentation):
-- item_steps read (and write, for prep staff) only at that level and up when
-- it's set. People who can edit the item always do. No level set: as before.

-- --- 1. The columns ---

ALTER TABLE "public"."venue_roles" ADD COLUMN "drink_types" "public"."entity_type"[];
ALTER TABLE "public"."venue_roles" ADD CONSTRAINT "venue_roles_drink_types_kinds" CHECK (
    "drink_types" IS NULL
    OR (cardinality("drink_types") > 0
        AND "drink_types" <@ ARRAY['cocktail', 'beer', 'wine']::"public"."entity_type"[])
);
COMMENT ON COLUMN "public"."venue_roles"."drink_types" IS
    'The kinds of drink this role adds and edits (cocktail, beer, wine). NULL: every kind. Cocktails include house-made ingredients.';

ALTER TABLE "public"."items" ADD COLUMN "awaiting_approval" boolean DEFAULT false NOT NULL;
COMMENT ON COLUMN "public"."items"."awaiting_approval" IS
    'A venue drink added by a role limited to some drink kinds, waiting for someone who edits every kind to approve it.';
CREATE INDEX "items_awaiting_approval_idx" ON "public"."items" ("bar_id") WHERE "awaiting_approval";

-- --- 2. Who is in a department ---

-- The kinds a limited role writes: its drink types, and house-made
-- ingredients with cocktails. NULL in, NULL out (every kind).
CREATE FUNCTION "private"."department_kinds"("p_types" "public"."entity_type"[]) RETURNS "public"."entity_type"[]
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT CASE WHEN p_types IS NULL THEN NULL
              WHEN 'cocktail' = ANY (p_types) THEN p_types || 'ingredient'::public.entity_type
              ELSE p_types END;
$$;

-- The caller's department at each venue where their role (not ended) has one.
CREATE FUNCTION "private"."my_departments"() RETURNS TABLE("bar_id" "uuid", "kinds" "public"."entity_type"[])
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT ub.bar_id, private.department_kinds(vr.drink_types)
  FROM public.user_bars ub
  JOIN public.venue_roles vr ON vr.id = ub.venue_role_id
  WHERE ub.user_id = auth.uid()
    AND vr.drink_types IS NOT NULL
    AND (vr.ends_at IS NULL OR vr.ends_at > now());
$$;

-- The kinds the caller writes at a venue: NULL when they aren't limited there.
CREATE FUNCTION "private"."my_drink_kinds"("p_bar_id" "uuid") RETURNS "public"."entity_type"[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT d.kinds FROM private.my_departments() d WHERE d.bar_id = p_bar_id;
$$;

-- Whether the caller's department (if any) at this venue covers this kind.
-- A home item (no venue) or an unlimited role: always.
CREATE FUNCTION "private"."kind_open"("p_bar_id" "uuid", "p_type" "public"."entity_type") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT p_bar_id IS NULL OR COALESCE(p_type = ANY (private.my_drink_kinds(p_bar_id)), true);
$$;

-- Venues where the caller approves: they edit drinks there with no limit.
CREATE FUNCTION "private"."my_approver_bar_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT b FROM private.bars_with_capability('edit_drinks') b
  WHERE b NOT IN (SELECT d.bar_id FROM private.my_departments() d);
$$;

-- For the app: the drink types the caller is limited to at a venue (NULL: every kind).
CREATE FUNCTION "public"."my_drink_types"("p_bar_id" "uuid") RETURNS "public"."entity_type"[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT vr.drink_types
  FROM public.user_bars ub
  JOIN public.venue_roles vr ON vr.id = ub.venue_role_id
  WHERE ub.bar_id = p_bar_id AND ub.user_id = auth.uid()
    AND (vr.ends_at IS NULL OR vr.ends_at > now());
$$;

REVOKE ALL ON FUNCTION "private"."department_kinds"("public"."entity_type"[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION "private"."my_departments"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "private"."my_drink_kinds"("uuid") FROM PUBLIC;
REVOKE ALL ON FUNCTION "private"."kind_open"("uuid", "public"."entity_type") FROM PUBLIC;
REVOKE ALL ON FUNCTION "private"."my_approver_bar_ids"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."my_drink_types"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."department_kinds"("public"."entity_type"[]) TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "private"."my_departments"() TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "private"."my_drink_kinds"("uuid") TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "private"."kind_open"("uuid", "public"."entity_type") TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "private"."my_approver_bar_ids"() TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."my_drink_types"("uuid") TO "authenticated", "service_role";

-- --- 3. Writes: only their own kinds ---

-- A drink credited to a venue (no bar_id; its origin is the venue's page) is
-- edited through that venue: its department's kinds hold there too.
CREATE FUNCTION "private"."credited_kind_open"("p_origin_bar_profile_id" "uuid", "p_type" "public"."entity_type") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT COALESCE((
    SELECT private.kind_open(p.bar_id, p_type)
    FROM public.profiles p
    WHERE p.id = p_origin_bar_profile_id AND p.kind = 'bar'
  ), true);
$$;

REVOKE ALL ON FUNCTION "private"."credited_kind_open"("uuid", "public"."entity_type") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "private"."credited_kind_open"("uuid", "public"."entity_type") TO "authenticated", "service_role";

ALTER POLICY "items_insert" ON "public"."items"
    WITH CHECK ("created_by" = (SELECT "auth"."uid"()) AND "private"."can_write"("bar_id", "created_by")
                AND "private"."kind_open"("bar_id", "item_type"));

-- As 20261017700000_bar_edits_credited_drinks.sql, with the department's
-- kinds on the venue branch (before and after, so no one moves a drink out
-- of their kinds or into them).
ALTER POLICY "items_update" ON "public"."items"
    USING (
        ("private"."can_write"("bar_id", "created_by") AND "private"."kind_open"("bar_id", "item_type"))
        OR ("private"."can_edit_credited"("bar_id", "is_catalog", "created_by", "origin_bar_profile_id")
            AND "private"."credited_kind_open"("origin_bar_profile_id", "item_type"))
    )
    WITH CHECK (
        ("private"."can_write"("bar_id", "created_by") AND "private"."kind_open"("bar_id", "item_type"))
        OR ("private"."can_edit_credited"("bar_id", "is_catalog", "created_by", "origin_bar_profile_id")
            AND "private"."credited_kind_open"("origin_bar_profile_id", "item_type"))
    );

ALTER POLICY "items_delete" ON "public"."items"
    USING ("private"."can_write"("bar_id", "created_by") AND "private"."kind_open"("bar_id", "item_type"));

-- Every child table that asks this follows.
CREATE OR REPLACE FUNCTION "private"."can_edit_item"("p_item_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT COALESCE(
    (SELECT (private.can_write(bar_id, created_by) AND private.kind_open(bar_id, item_type))
         OR (private.can_edit_credited(bar_id, is_catalog, created_by, origin_bar_profile_id)
             AND private.credited_kind_open(origin_bar_profile_id, item_type))
       FROM public.items WHERE id = p_item_id),
    false
  );
$$;

-- Someone in a department can't lift one: they don't change a role's drink
-- types, delete a limited role, or move anyone off one (staff permission or
-- not). Admins and everyone else go by the role guards as before.
CREATE FUNCTION "private"."guard_department_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_bar uuid := COALESCE(NEW.bar_id, OLD.bar_id);
BEGIN
    IF auth.uid() IS NULL OR private.is_app_admin() OR private.my_drink_kinds(v_bar) IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    IF TG_TABLE_NAME = 'venue_roles' THEN
        IF (TG_OP = 'UPDATE' AND NEW.drink_types IS DISTINCT FROM OLD.drink_types)
           OR (TG_OP = 'DELETE' AND OLD.drink_types IS NOT NULL) THEN
            RAISE EXCEPTION 'Only someone who edits every kind of drink here changes what a role adds.' USING ERRCODE = '42501';
        END IF;
    ELSIF TG_OP = 'UPDATE' AND NEW.venue_role_id IS DISTINCT FROM OLD.venue_role_id
          AND EXISTS (SELECT 1 FROM public.venue_roles vr WHERE vr.id = OLD.venue_role_id AND vr.drink_types IS NOT NULL) THEN
        RAISE EXCEPTION 'Only someone who edits every kind of drink here changes what a role adds.' USING ERRCODE = '42501';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER "guard_department_change" BEFORE UPDATE OR DELETE ON "public"."venue_roles"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_department_change"();
CREATE TRIGGER "guard_department_change" BEFORE UPDATE ON "public"."user_bars"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_department_change"();

-- --- 4. Approval ---

-- A department's new venue drink waits; only an approver (not limited at
-- that venue) changes the flag afterwards. The service role and app admins
-- as before.
CREATE FUNCTION "private"."guard_item_approval"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF auth.uid() IS NULL OR private.is_app_admin() THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'INSERT' THEN
        NEW.awaiting_approval := NEW.bar_id IS NOT NULL AND private.my_drink_kinds(NEW.bar_id) IS NOT NULL;
    ELSIF NEW.awaiting_approval IS DISTINCT FROM OLD.awaiting_approval
          AND (NEW.bar_id IS NULL OR NEW.bar_id NOT IN (SELECT private.my_approver_bar_ids())) THEN
        RAISE EXCEPTION 'Only someone who edits every kind of drink here can approve it.' USING ERRCODE = '42501';
    ELSIF NEW.bar_id IS DISTINCT FROM OLD.bar_id AND private.my_drink_kinds(NEW.bar_id) IS NOT NULL THEN
        -- Moving a drink into a venue where you're limited: it waits there too.
        NEW.awaiting_approval := true;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "guard_item_approval" BEFORE INSERT OR UPDATE ON "public"."items"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_item_approval"();

-- --- 5. Reads ---

-- As 20261101200000_role_permissions_per_role.sql, with a department not
-- seeing every venue drink through edit_drinks.
CREATE OR REPLACE FUNCTION "private"."my_bar_item_access"()
    RETURNS TABLE("bar_id" "uuid", "sees_all" boolean, "sees_by_level" boolean, "role_level" integer, "default_level" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT ub.bar_id,
         (vr.drink_types IS NULL
          AND private.cap_open('edit_drinks', 'edit_drinks' = ANY (private.base_capabilities(ub.role_level)),
                               COALESCE(vr.granted, lo.granted), COALESCE(vr.revoked, lo.revoked)))
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

-- As 20261101200000, with a department's own kinds, and a drink waiting for
-- approval kept to its maker and the venue's approvers.
ALTER POLICY "items_select" ON "public"."items" USING (
  CASE
    WHEN "bar_id" IS NOT NULL THEN (
      (
        "bar_id" IN (SELECT "a"."bar_id" FROM "private"."my_bar_item_access"() "a" WHERE "a"."sees_all")
        OR EXISTS (
          SELECT 1 FROM "private"."my_bar_item_access"() "a"
          WHERE "a"."bar_id" = "items"."bar_id" AND "a"."sees_by_level"
            AND "a"."role_level" >= COALESCE("items"."override_visibility_level", "a"."default_level")
        )
        OR EXISTS (
          SELECT 1 FROM "private"."my_departments"() "d"
          WHERE "d"."bar_id" = "items"."bar_id" AND "items"."item_type" = ANY ("d"."kinds")
        )
      )
      AND (
        NOT "awaiting_approval"
        OR "created_by" = (SELECT "auth"."uid"())
        OR "bar_id" IN (SELECT "private"."my_approver_bar_ids"())
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

-- As 20261126400000_spec_verdicts_index.sql (child rows ask this through
-- can_view_item), with the same two changes.
CREATE OR REPLACE FUNCTION "private"."visible_items"("p_item_ids" "uuid"[]) RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT c.id
    FROM public.items c
    LEFT JOIN public.bars b ON b.id = c.bar_id
    LEFT JOIN public.user_bars ub ON ub.bar_id = c.bar_id AND ub.user_id = auth.uid()
        AND NOT EXISTS (SELECT 1 FROM public.venue_roles vr WHERE vr.id = ub.venue_role_id AND vr.ends_at <= now())
    LEFT JOIN public.venue_roles vr ON vr.id = ub.venue_role_id
    LEFT JOIN public.venue_level_overrides lo ON ub.venue_role_id IS NULL AND lo.bar_id = ub.bar_id AND lo.base_level = ub.role_level
    CROSS JOIN LATERAL (SELECT public.effective_bar_role(ub.role_level) AS role) er
    WHERE c.id = ANY (p_item_ids)
      AND auth.uid() IS NOT NULL
      AND (
        (c.bar_id IS NULL
         AND (c.created_by IS NULL
              OR c.item_type NOT IN ('cocktail', 'beer', 'wine')
              OR c.created_by = auth.uid()
              OR private.is_app_admin()))
        OR (ub.user_id IS NOT NULL
            AND (NOT c.awaiting_approval OR c.created_by = auth.uid() OR c.bar_id IN (SELECT private.my_approver_bar_ids()))
            AND (private.cap_open('menu', er.role >= COALESCE(c.override_visibility_level, b.default_visibility_level),
                                  CASE WHEN er.role = ub.role_level THEN COALESCE(vr.granted, lo.granted) END,
                                  CASE WHEN er.role = ub.role_level THEN COALESCE(vr.revoked, lo.revoked) END)
                 OR (vr.drink_types IS NULL
                     AND private.cap_open('edit_drinks', 'edit_drinks' = ANY (private.base_capabilities(er.role)),
                                          CASE WHEN er.role = ub.role_level THEN COALESCE(vr.granted, lo.granted) END,
                                          CASE WHEN er.role = ub.role_level THEN COALESCE(vr.revoked, lo.revoked) END))
                 OR c.item_type = ANY (private.department_kinds(vr.drink_types))))
        OR EXISTS (SELECT 1 FROM public.published_items pi WHERE pi.id = c.id)
      );
$$;

-- As 20261101200000 (events and This week ask it, with no item to hand): a
-- department doesn't see every venue drink through edit_drinks here either,
-- only by the Who sees what level.
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
        (vr.drink_types IS NULL
         AND private.cap_open('edit_drinks', 'edit_drinks' = ANY (private.base_capabilities(ub.role_level)),
                              COALESCE(vr.granted, lo.granted), COALESCE(vr.revoked, lo.revoked)))
        OR private.cap_open('menu', ub.role_level >= COALESCE(p_override_visibility_level, b.default_visibility_level),
                            COALESCE(vr.granted, lo.granted), COALESCE(vr.revoked, lo.revoked))
      )
  );
$$;

-- --- 6. A batch's method follows its own level (tf-087) ---

-- Whether the caller opens a level at a venue: no level set, or their role
-- there (not ended, lowered by View as) is at it or above.
CREATE FUNCTION "private"."opens_level"("p_bar_id" "uuid", "p_level" integer) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT p_level IS NULL OR EXISTS (
    SELECT 1
    FROM public.user_bars ub
    LEFT JOIN public.venue_roles vr ON vr.id = ub.venue_role_id
    WHERE ub.bar_id = p_bar_id AND ub.user_id = auth.uid()
      AND (vr.ends_at IS NULL OR vr.ends_at > now())
      AND public.effective_bar_role(ub.role_level) >= p_level
  );
$$;

REVOKE ALL ON FUNCTION "private"."opens_level"("uuid", integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "private"."opens_level"("uuid", integer) TO "authenticated", "service_role";

-- As 20261012410000_home_prep_steps_private.sql: a venue's steps read for
-- house-made or prep holders at the item's prep level, and for its editors.
ALTER POLICY "item_steps_select" ON "public"."item_steps" USING (EXISTS (
    SELECT 1 FROM "public"."items" "i"
    WHERE "i"."id" = "item_id"
      AND (("i"."bar_id" IS NULL
            AND ("i"."created_by" IS NULL OR "i"."is_catalog" OR "private"."can_edit_item"("i"."id")))
           OR (("i"."bar_id" IN (SELECT "private"."bars_with_capability"('house_made'))
                OR "i"."bar_id" IN (SELECT "private"."bars_with_capability"('prep')))
               AND "private"."opens_level"("i"."bar_id", "i"."override_prep_level"))
           OR ("i"."bar_id" IS NOT NULL AND "private"."can_edit_item"("i"."id")))
));

-- As 20261001110000_prep_cards.sql: prep holders write steps at that level too.
ALTER POLICY "item_steps_write" ON "public"."item_steps"
    USING (EXISTS (
        SELECT 1 FROM "public"."items" "i"
        WHERE "i"."id" = "item_id"
          AND (("i"."bar_id" IN (SELECT "private"."bars_with_capability"('prep'))
                AND "private"."opens_level"("i"."bar_id", "i"."override_prep_level"))
               OR ("private"."can_edit_item"("i"."id")
                   AND ("i"."bar_id" IS NULL OR "i"."bar_id" IN (SELECT "private"."bars_with_capability"('house_made')))))
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM "public"."items" "i"
        WHERE "i"."id" = "item_id"
          AND (("i"."bar_id" IN (SELECT "private"."bars_with_capability"('prep'))
                AND "private"."opens_level"("i"."bar_id", "i"."override_prep_level"))
               OR ("private"."can_edit_item"("i"."id")
                   AND ("i"."bar_id" IS NULL OR "i"."bar_id" IN (SELECT "private"."bars_with_capability"('house_made')))))
    ));

-- --- 7. The Roles screen reads each role's drink types ---

-- As 20261101200000, with drink_types (NULL for built-in roles).
DROP FUNCTION "public"."get_venue_role_matrix"("p_bar_id" "uuid");
CREATE FUNCTION "public"."get_venue_role_matrix"("p_bar_id" "uuid")
    RETURNS TABLE("role_id" "uuid", "name" "text", "base_level" integer, "ends_at" timestamp with time zone,
                  "granted" "public"."venue_capability"[], "revoked" "public"."venue_capability"[],
                  "capabilities" "public"."venue_capability"[], "starts_with" "public"."venue_capability"[],
                  "drink_types" "public"."entity_type"[])
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT NULL::uuid, NULL::text, l, NULL::timestamptz,
         COALESCE(lo.granted, '{}'), COALESCE(lo.revoked, '{}'),
         private.role_capabilities(l, lo.granted, lo.revoked, b.default_visibility_level, b.default_measurement_level),
         private.role_capabilities(l, '{}', '{}', b.default_visibility_level, b.default_measurement_level),
         NULL::public.entity_type[]
  FROM public.bars b
  CROSS JOIN unnest(ARRAY[10, 20, 30, 35, 40]) AS l
  LEFT JOIN public.venue_level_overrides lo ON lo.bar_id = b.id AND lo.base_level = l
  WHERE b.id = p_bar_id AND b.id IN (SELECT private.my_bar_ids(0))
  UNION ALL
  SELECT vr.id, vr.name, vr.base_level, vr.ends_at, vr.granted, vr.revoked,
         private.role_capabilities(vr.base_level, vr.granted, vr.revoked, b.default_visibility_level, b.default_measurement_level),
         private.role_capabilities(vr.base_level, '{}', '{}', b.default_visibility_level, b.default_measurement_level),
         vr.drink_types
  FROM public.venue_roles vr
  JOIN public.bars b ON b.id = vr.bar_id
  WHERE vr.bar_id = p_bar_id AND b.id IN (SELECT private.my_bar_ids(0))
  ORDER BY 3, 2 NULLS FIRST;
$$;

REVOKE ALL ON FUNCTION "public"."get_venue_role_matrix"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."get_venue_role_matrix"("uuid") TO "authenticated", "service_role";
