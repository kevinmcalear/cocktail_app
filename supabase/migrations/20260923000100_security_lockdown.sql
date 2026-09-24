-- Security lockdown.
--
-- Before this migration:
--   * anyone holding the public anon key could insert, update and delete the
--     recipe catalog (items, recipes, categories, menu_drinks, ...);
--   * the user_bars write policies compared bar_id to itself, so an admin of
--     any bar could add, change or remove members of every bar;
--   * any signed-in user could edit or delete any menu or image row;
--   * the two presentation views ran as their owner and ignored RLS;
--   * SECURITY DEFINER functions were callable by anon with a mutable
--     search_path;
--   * the drinks bucket accepted uploads from anyone, anywhere, of any size.
--
-- After it, one permission model applies everywhere:
--   * Bar rows (bar_id set) are readable by the bar's members and writable by
--     members with role >= 35 (Drink Creator), matching the app's edit check.
--   * Rows with no bar are readable by any signed-in user and writable by the
--     user who created them. Legacy rows with no recorded creator are
--     writable only by catalog admins (private.app_admins).
--   * Child rows (recipes, item_images, menu_drinks, ...) follow their parent.
--   * Signed-out (anon) requests match no policy at all.

-- ---------------------------------------------------------------------------
-- Ownership columns, constraints and the indexes the new policies use
-- ---------------------------------------------------------------------------

-- Added without a default first so existing rows stay NULL (legacy, admin-only),
-- then defaulted so every new row records its creator.
ALTER TABLE "public"."items" ADD COLUMN "created_by" "uuid" REFERENCES "auth"."users"("id") ON DELETE SET NULL;
ALTER TABLE "public"."items" ALTER COLUMN "created_by" SET DEFAULT "auth"."uid"();
ALTER TABLE "public"."menus" ADD COLUMN "created_by" "uuid" REFERENCES "auth"."users"("id") ON DELETE SET NULL;
ALTER TABLE "public"."menus" ALTER COLUMN "created_by" SET DEFAULT "auth"."uid"();
ALTER TABLE "public"."menu_templates" ADD COLUMN "created_by" "uuid" REFERENCES "auth"."users"("id") ON DELETE SET NULL;
ALTER TABLE "public"."menu_templates" ALTER COLUMN "created_by" SET DEFAULT "auth"."uid"();

ALTER TABLE "public"."user_bars" ADD CONSTRAINT "user_bars_role_level_check"
    CHECK ("role_level" = ANY (ARRAY[10, 20, 30, 35, 40]));

CREATE INDEX IF NOT EXISTS "items_bar_id_idx" ON "public"."items" ("bar_id");
CREATE INDEX IF NOT EXISTS "items_created_by_idx" ON "public"."items" ("created_by");
CREATE INDEX IF NOT EXISTS "menus_bar_id_idx" ON "public"."menus" ("bar_id");
CREATE INDEX IF NOT EXISTS "menus_created_by_idx" ON "public"."menus" ("created_by");
CREATE INDEX IF NOT EXISTS "menu_templates_created_by_idx" ON "public"."menu_templates" ("created_by");
CREATE INDEX IF NOT EXISTS "drafts_bar_id_idx" ON "public"."drafts" ("bar_id");
CREATE INDEX IF NOT EXISTS "drafts_user_id_idx" ON "public"."drafts" ("user_id");
CREATE INDEX IF NOT EXISTS "user_bars_bar_id_idx" ON "public"."user_bars" ("bar_id");
CREATE INDEX IF NOT EXISTS "item_images_item_id_idx" ON "public"."item_images" ("item_id");
CREATE INDEX IF NOT EXISTS "menu_drinks_menu_id_idx" ON "public"."menu_drinks" ("menu_id");
CREATE INDEX IF NOT EXISTS "template_sections_template_id_idx" ON "public"."template_sections" ("template_id");

-- ---------------------------------------------------------------------------
-- Private helpers (not exposed through the Data API)
-- ---------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS "private";
GRANT USAGE ON SCHEMA "private" TO "authenticated", "service_role";

-- Users who may edit the shared catalog: rows with no bar and no creator.
CREATE TABLE "private"."app_admins" (
    "user_id" "uuid" PRIMARY KEY REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
ALTER TABLE "private"."app_admins" ENABLE ROW LEVEL SECURITY;

-- One row per paid AI call, for the per-user daily quota.
CREATE TABLE "private"."ai_usage" (
    "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "user_id" "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "fn" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
CREATE INDEX "ai_usage_user_id_created_at_idx" ON "private"."ai_usage" ("user_id", "created_at" DESC);
ALTER TABLE "private"."ai_usage" ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION "private"."is_app_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (SELECT 1 FROM private.app_admins WHERE user_id = auth.uid());
$$;

-- Bars where the caller's real (not view-as) role is at least p_min_role.
CREATE FUNCTION "private"."my_bar_ids"("p_min_role" integer) RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT bar_id FROM public.user_bars
  WHERE user_id = auth.uid() AND role_level >= p_min_role;
$$;

-- Whether the caller may write a row with this bar and creator.
CREATE FUNCTION "private"."can_write"("p_bar_id" "uuid", "p_created_by" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN p_bar_id IS NULL THEN p_created_by = auth.uid() OR private.is_app_admin()
    ELSE EXISTS (
      SELECT 1 FROM public.user_bars
      WHERE bar_id = p_bar_id AND user_id = auth.uid() AND role_level >= 35
    )
  END;
$$;

CREATE FUNCTION "private"."can_edit_item"("p_item_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT COALESCE(
    (SELECT private.can_write(bar_id, created_by) FROM public.items WHERE id = p_item_id),
    false
  );
$$;

CREATE FUNCTION "private"."can_edit_menu"("p_menu_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT COALESCE(
    (SELECT private.can_write(bar_id, created_by) FROM public.menus WHERE id = p_menu_id),
    false
  );
$$;

CREATE FUNCTION "private"."can_edit_template"("p_template_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT COALESCE(
    (SELECT private.can_write(NULL, created_by) FROM public.menu_templates WHERE id = p_template_id),
    false
  );
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA "private" FROM PUBLIC, "anon";
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA "private" TO "authenticated", "service_role";

-- ---------------------------------------------------------------------------
-- Replace every policy on public tables
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  p record;
BEGIN
  FOR p IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END;
$$;

-- items: bar rows for members, no-bar rows for everyone signed in.
CREATE POLICY "items_select" ON "public"."items" FOR SELECT TO "authenticated"
    USING ("bar_id" IS NULL OR "bar_id" IN (SELECT "private"."my_bar_ids"(0)));
CREATE POLICY "items_insert" ON "public"."items" FOR INSERT TO "authenticated"
    WITH CHECK ("created_by" = (SELECT "auth"."uid"()) AND "private"."can_write"("bar_id", "created_by"));
CREATE POLICY "items_update" ON "public"."items" FOR UPDATE TO "authenticated"
    USING ("private"."can_write"("bar_id", "created_by"))
    WITH CHECK ("private"."can_write"("bar_id", "created_by"));
CREATE POLICY "items_delete" ON "public"."items" FOR DELETE TO "authenticated"
    USING ("private"."can_write"("bar_id", "created_by"));

-- Child rows of items: readable when the parent is, writable when the parent is.
CREATE POLICY "recipes_select" ON "public"."recipes" FOR SELECT TO "authenticated"
    USING ("recipe_item_id" IN (SELECT "id" FROM "public"."items"));
CREATE POLICY "recipes_insert" ON "public"."recipes" FOR INSERT TO "authenticated"
    WITH CHECK ("private"."can_edit_item"("recipe_item_id"));
CREATE POLICY "recipes_update" ON "public"."recipes" FOR UPDATE TO "authenticated"
    USING ("private"."can_edit_item"("recipe_item_id"))
    WITH CHECK ("private"."can_edit_item"("recipe_item_id"));
CREATE POLICY "recipes_delete" ON "public"."recipes" FOR DELETE TO "authenticated"
    USING ("private"."can_edit_item"("recipe_item_id"));

CREATE POLICY "item_categories_select" ON "public"."item_categories" FOR SELECT TO "authenticated"
    USING ("item_id" IN (SELECT "id" FROM "public"."items"));
CREATE POLICY "item_categories_insert" ON "public"."item_categories" FOR INSERT TO "authenticated"
    WITH CHECK ("private"."can_edit_item"("item_id"));
CREATE POLICY "item_categories_update" ON "public"."item_categories" FOR UPDATE TO "authenticated"
    USING ("private"."can_edit_item"("item_id"))
    WITH CHECK ("private"."can_edit_item"("item_id"));
CREATE POLICY "item_categories_delete" ON "public"."item_categories" FOR DELETE TO "authenticated"
    USING ("private"."can_edit_item"("item_id"));

CREATE POLICY "item_methods_select" ON "public"."item_methods" FOR SELECT TO "authenticated"
    USING ("item_id" IN (SELECT "id" FROM "public"."items"));
CREATE POLICY "item_methods_insert" ON "public"."item_methods" FOR INSERT TO "authenticated"
    WITH CHECK ("private"."can_edit_item"("item_id"));
CREATE POLICY "item_methods_update" ON "public"."item_methods" FOR UPDATE TO "authenticated"
    USING ("private"."can_edit_item"("item_id"))
    WITH CHECK ("private"."can_edit_item"("item_id"));
CREATE POLICY "item_methods_delete" ON "public"."item_methods" FOR DELETE TO "authenticated"
    USING ("private"."can_edit_item"("item_id"));

CREATE POLICY "item_images_select" ON "public"."item_images" FOR SELECT TO "authenticated"
    USING ("item_id" IN (SELECT "id" FROM "public"."items"));
CREATE POLICY "item_images_insert" ON "public"."item_images" FOR INSERT TO "authenticated"
    WITH CHECK ("private"."can_edit_item"("item_id"));
CREATE POLICY "item_images_update" ON "public"."item_images" FOR UPDATE TO "authenticated"
    USING ("private"."can_edit_item"("item_id"))
    WITH CHECK ("private"."can_edit_item"("item_id"));
CREATE POLICY "item_images_delete" ON "public"."item_images" FOR DELETE TO "authenticated"
    USING ("private"."can_edit_item"("item_id"));

CREATE POLICY "item_attributes_select" ON "public"."item_attributes" FOR SELECT TO "authenticated"
    USING ("item_id" IN (SELECT "id" FROM "public"."items"));
CREATE POLICY "item_attributes_write" ON "public"."item_attributes" FOR ALL TO "authenticated"
    USING ("private"."can_edit_item"("item_id"))
    WITH CHECK ("private"."can_edit_item"("item_id"));

CREATE POLICY "substitutions_select" ON "public"."substitutions" FOR SELECT TO "authenticated"
    USING ("original_item_id" IN (SELECT "id" FROM "public"."items"));
CREATE POLICY "substitutions_write" ON "public"."substitutions" FOR ALL TO "authenticated"
    USING ("private"."can_edit_item"("original_item_id"))
    WITH CHECK ("private"."can_edit_item"("original_item_id"));

-- Shared taxonomy: readable by everyone signed in, curated by catalog admins.
CREATE POLICY "categories_select" ON "public"."categories" FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "categories_write" ON "public"."categories" FOR ALL TO "authenticated"
    USING ("private"."is_app_admin"()) WITH CHECK ("private"."is_app_admin"());
CREATE POLICY "attributes_select" ON "public"."attributes" FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "category_attributes_select" ON "public"."category_attributes" FOR SELECT TO "authenticated" USING (true);

-- images rows only hold a public URL; the app inserts and reads them, never
-- edits or deletes them.
CREATE POLICY "images_select" ON "public"."images" FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "images_insert" ON "public"."images" FOR INSERT TO "authenticated" WITH CHECK (true);

-- menus follow the same bar / creator model as items.
CREATE POLICY "menus_select" ON "public"."menus" FOR SELECT TO "authenticated"
    USING ("bar_id" IS NULL OR "bar_id" IN (SELECT "private"."my_bar_ids"(0)));
CREATE POLICY "menus_insert" ON "public"."menus" FOR INSERT TO "authenticated"
    WITH CHECK ("created_by" = (SELECT "auth"."uid"()) AND "private"."can_write"("bar_id", "created_by"));
CREATE POLICY "menus_update" ON "public"."menus" FOR UPDATE TO "authenticated"
    USING ("private"."can_write"("bar_id", "created_by"))
    WITH CHECK ("private"."can_write"("bar_id", "created_by"));
CREATE POLICY "menus_delete" ON "public"."menus" FOR DELETE TO "authenticated"
    USING ("private"."can_write"("bar_id", "created_by"));

CREATE POLICY "menu_drinks_select" ON "public"."menu_drinks" FOR SELECT TO "authenticated"
    USING ("menu_id" IN (SELECT "id" FROM "public"."menus"));
CREATE POLICY "menu_drinks_insert" ON "public"."menu_drinks" FOR INSERT TO "authenticated"
    WITH CHECK ("private"."can_edit_menu"("menu_id"));
CREATE POLICY "menu_drinks_update" ON "public"."menu_drinks" FOR UPDATE TO "authenticated"
    USING ("private"."can_edit_menu"("menu_id"))
    WITH CHECK ("private"."can_edit_menu"("menu_id"));
CREATE POLICY "menu_drinks_delete" ON "public"."menu_drinks" FOR DELETE TO "authenticated"
    USING ("private"."can_edit_menu"("menu_id"));

-- Templates are shared across bars; each is editable by its creator.
CREATE POLICY "menu_templates_select" ON "public"."menu_templates" FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "menu_templates_insert" ON "public"."menu_templates" FOR INSERT TO "authenticated"
    WITH CHECK ("created_by" = (SELECT "auth"."uid"()));
CREATE POLICY "menu_templates_update" ON "public"."menu_templates" FOR UPDATE TO "authenticated"
    USING ("private"."can_write"(NULL, "created_by"))
    WITH CHECK ("private"."can_write"(NULL, "created_by"));
CREATE POLICY "menu_templates_delete" ON "public"."menu_templates" FOR DELETE TO "authenticated"
    USING ("private"."can_write"(NULL, "created_by"));

CREATE POLICY "template_sections_select" ON "public"."template_sections" FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "template_sections_insert" ON "public"."template_sections" FOR INSERT TO "authenticated"
    WITH CHECK ("private"."can_edit_template"("template_id"));
CREATE POLICY "template_sections_update" ON "public"."template_sections" FOR UPDATE TO "authenticated"
    USING ("private"."can_edit_template"("template_id"))
    WITH CHECK ("private"."can_edit_template"("template_id"));
CREATE POLICY "template_sections_delete" ON "public"."template_sections" FOR DELETE TO "authenticated"
    USING ("private"."can_edit_template"("template_id"));

-- bars: visible to members only; created through create_new_bar().
CREATE POLICY "bars_select" ON "public"."bars" FOR SELECT TO "authenticated"
    USING ("id" IN (SELECT "private"."my_bar_ids"(0)));
CREATE POLICY "bars_update" ON "public"."bars" FOR UPDATE TO "authenticated"
    USING ("id" IN (SELECT "private"."my_bar_ids"(40)))
    WITH CHECK ("id" IN (SELECT "private"."my_bar_ids"(40)));
CREATE POLICY "bars_delete" ON "public"."bars" FOR DELETE TO "authenticated"
    USING ("id" IN (SELECT "private"."my_bar_ids"(40)));

-- user_bars: members see their bar's roster; only that bar's admins change it.
CREATE POLICY "user_bars_select" ON "public"."user_bars" FOR SELECT TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."my_bar_ids"(0)));
CREATE POLICY "user_bars_insert" ON "public"."user_bars" FOR INSERT TO "authenticated"
    WITH CHECK ("bar_id" IN (SELECT "private"."my_bar_ids"(40)));
CREATE POLICY "user_bars_update" ON "public"."user_bars" FOR UPDATE TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."my_bar_ids"(40)))
    WITH CHECK ("bar_id" IN (SELECT "private"."my_bar_ids"(40)));
CREATE POLICY "user_bars_delete" ON "public"."user_bars" FOR DELETE TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()) OR "bar_id" IN (SELECT "private"."my_bar_ids"(40)));

-- drafts: private to the author, shared with the bar's Drink Creators.
CREATE POLICY "drafts_select" ON "public"."drafts" FOR SELECT TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()) OR "bar_id" IN (SELECT "private"."my_bar_ids"(35)));
CREATE POLICY "drafts_insert" ON "public"."drafts" FOR INSERT TO "authenticated"
    WITH CHECK (
        "user_id" = (SELECT "auth"."uid"())
        AND ("bar_id" IS NULL OR "bar_id" IN (SELECT "private"."my_bar_ids"(0)))
    );
CREATE POLICY "drafts_update" ON "public"."drafts" FOR UPDATE TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()) OR "bar_id" IN (SELECT "private"."my_bar_ids"(35)))
    WITH CHECK (
        ("user_id" = (SELECT "auth"."uid"()) OR "bar_id" IN (SELECT "private"."my_bar_ids"(35)))
        AND ("bar_id" IS NULL OR "bar_id" IN (SELECT "private"."my_bar_ids"(0)))
    );
CREATE POLICY "drafts_delete" ON "public"."drafts" FOR DELETE TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()) OR "bar_id" IN (SELECT "private"."my_bar_ids"(35)));

CREATE POLICY "user_prefs_own" ON "public"."user_prefs" TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()))
    WITH CHECK ("user_id" = (SELECT "auth"."uid"()));

-- The presentation views now run with the caller's permissions, so the policies
-- above apply to them too.
ALTER VIEW "public"."app_item_presentation" SET ("security_invoker" = true);
ALTER VIEW "public"."app_recipe_presentation" SET ("security_invoker" = true);

-- ---------------------------------------------------------------------------
-- Functions: fixed search_path, caller checks, no anonymous execution
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION "public"."add_user_to_bar_by_email"("p_email" "text", "p_bar_id" "uuid", "p_role_level" integer) RETURNS "public"."user_bars"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_user_id UUID;
    v_admin_role INT;
    v_new_user_bar public.user_bars;
BEGIN
    SELECT role_level INTO v_admin_role
    FROM public.user_bars
    WHERE bar_id = p_bar_id AND user_id = auth.uid();

    IF v_admin_role IS NULL OR v_admin_role < 40 THEN
        RAISE EXCEPTION 'You must be a bar Admin to add members.';
    END IF;

    IF p_role_level IS NULL OR NOT (p_role_level = ANY (ARRAY[10, 20, 30, 35, 40])) THEN
        RAISE EXCEPTION 'Invalid role level.';
    END IF;

    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = p_email;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User not found with that email.';
    END IF;

    INSERT INTO public.user_bars (user_id, bar_id, role_level)
    VALUES (v_user_id, p_bar_id, p_role_level)
    ON CONFLICT (user_id, bar_id)
    DO UPDATE SET role_level = EXCLUDED.role_level
    RETURNING * INTO v_new_user_bar;

    RETURN v_new_user_bar;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."assign_item_to_bar"("p_item_id" "uuid", "p_bar_id" "uuid") RETURNS "public"."items"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_admin_role INT;
    v_updated_item public.items;
BEGIN
    SELECT role_level INTO v_admin_role
    FROM public.user_bars
    WHERE bar_id = p_bar_id AND user_id = auth.uid();

    IF v_admin_role IS NULL OR v_admin_role < 40 THEN
        RAISE EXCEPTION 'You must be a bar Admin to assign items to this bar.';
    END IF;

    -- Moving an item takes it away from wherever it lives now, so the caller
    -- must also be allowed to edit it there.
    IF NOT private.can_edit_item(p_item_id) THEN
        RAISE EXCEPTION 'You do not have permission to move this item.';
    END IF;

    UPDATE public.items
    SET bar_id = p_bar_id
    WHERE id = p_item_id
    RETURNING * INTO v_updated_item;

    RETURN v_updated_item;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."create_new_bar"("p_name" "text", "p_visibility" integer, "p_generic" integer, "p_specific" integer, "p_measurement" integer, "p_prep" integer) RETURNS "public"."bars"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    new_bar public.bars;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'You must be signed in to create a bar.';
    END IF;

    INSERT INTO public.bars (
        name,
        default_visibility_level,
        default_generic_ingredient_level,
        default_specific_brand_level,
        default_measurement_level,
        default_prep_level
    ) VALUES (
        p_name,
        p_visibility,
        p_generic,
        p_specific,
        p_measurement,
        p_prep
    ) RETURNING * INTO new_bar;

    INSERT INTO public.user_bars (bar_id, user_id, role_level)
    VALUES (new_bar.id, auth.uid(), 40);

    RETURN new_bar;
END;
$$;

ALTER FUNCTION "public"."get_bar_members"("p_bar_id" "uuid") SET "search_path" TO '';
ALTER FUNCTION "public"."get_my_bars"() SET "search_path" TO '';
ALTER FUNCTION "public"."update_bar_settings"("p_bar_id" "uuid", "p_name" "text", "p_visibility" integer, "p_generic" integer, "p_specific" integer, "p_measurement" integer, "p_prep" integer, "p_logo_url" "text", "p_primary_color" "text", "p_secondary_color" "text") SET "search_path" TO '';
ALTER FUNCTION "public"."update_modified_column"() SET "search_path" TO '';
ALTER FUNCTION "public"."effective_bar_role"("real_role" integer) SET "search_path" TO '';

-- Lets edge functions ask, with the caller's own token, whether the caller may
-- edit an item. It only ever answers for the caller.
CREATE FUNCTION "public"."can_edit_item"("p_item_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT private.can_edit_item(p_item_id);
$$;

-- Records one paid AI call for a user and says whether it fits in the daily
-- quota. Service role only: edge functions call it before contacting Gemini.
CREATE FUNCTION "public"."consume_ai_quota"("p_user_id" "uuid", "p_fn" "text", "p_daily_limit" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_count INT;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

    SELECT count(*) INTO v_count
    FROM private.ai_usage
    WHERE user_id = p_user_id AND created_at > now() - interval '24 hours';

    IF v_count >= p_daily_limit THEN
        RETURN false;
    END IF;

    INSERT INTO private.ai_usage (user_id, fn) VALUES (p_user_id, p_fn);
    RETURN true;
END;
$$;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA "public" FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."add_user_to_bar_by_email"("p_email" "text", "p_bar_id" "uuid", "p_role_level" integer) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."assign_item_to_bar"("p_item_id" "uuid", "p_bar_id" "uuid") TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."create_new_bar"("p_name" "text", "p_visibility" integer, "p_generic" integer, "p_specific" integer, "p_measurement" integer, "p_prep" integer) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_bar_members"("p_bar_id" "uuid") TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_my_bars"() TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."update_bar_settings"("p_bar_id" "uuid", "p_name" "text", "p_visibility" integer, "p_generic" integer, "p_specific" integer, "p_measurement" integer, "p_prep" integer, "p_logo_url" "text", "p_primary_color" "text", "p_secondary_color" "text") TO "authenticated";
-- Called by the presentation views; kept callable by anon so a signed-out read
-- of a view returns no rows instead of a permission error.
GRANT EXECUTE ON FUNCTION "public"."effective_bar_role"("real_role" integer) TO "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."can_edit_item"("p_item_id" "uuid") TO "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."rls_auto_enable"() FROM "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."update_modified_column"() FROM "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."consume_ai_quota"("p_user_id" "uuid", "p_fn" "text", "p_daily_limit" integer) FROM "authenticated";
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA "public" TO "service_role";

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

-- Leftover dashboard templates and blanket write access to the drinks bucket.
DROP POLICY IF EXISTS "Give anon users access to JPG images in folder 1d544wr_0" ON "storage"."objects";
DROP POLICY IF EXISTS "Give anon users access to JPG images in folder 1d544wr_1" ON "storage"."objects";
DROP POLICY IF EXISTS "Give anon users access to JPG images in folder 1d544wr_2" ON "storage"."objects";
DROP POLICY IF EXISTS "Give anon users access to JPG images in folder 1d544wr_3" ON "storage"."objects";
DROP POLICY IF EXISTS "Allow public uploads to drinks" ON "storage"."objects";
DROP POLICY IF EXISTS "Authenticated Uploads" ON "storage"."objects";
DROP POLICY IF EXISTS "Authenticated Updates" ON "storage"."objects";
DROP POLICY IF EXISTS "Public Access" ON "storage"."objects";

-- The app uploads new files only (upsert: false) into these folders; bars/ and
-- glassware-icons/ are written by edge functions with the service role.
CREATE POLICY "drinks_insert_app_folders" ON "storage"."objects" FOR INSERT TO "authenticated"
    WITH CHECK (
        "bucket_id" = 'drinks'
        AND ("storage"."foldername"("name"))[1] = ANY (ARRAY['beers', 'cocktails', 'drafts', 'ingredients', 'menus', 'wines'])
    );

UPDATE "storage"."buckets"
SET "file_size_limit" = 15728640,
    "allowed_mime_types" = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
WHERE "id" = 'drinks';

UPDATE "storage"."buckets"
SET "file_size_limit" = 5242880,
    "allowed_mime_types" = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
WHERE "id" = 'avatars';
