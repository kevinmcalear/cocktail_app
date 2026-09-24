-- Baseline: the production schema exactly as it existed on 2026-09-23.
--
-- The earlier migration history could not rebuild the database: its first
-- migration (20260409183835_remote_schema) was empty, and production had been
-- edited by hand since. This file replaces that history with a
-- `supabase db dump` of production, plus the storage buckets and policies that
-- only existed in the dashboard. Security fixes come in later migrations; this
-- file intentionally reproduces production as-is, holes included.

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

COMMENT ON SCHEMA "public" IS 'standard public schema';

CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

CREATE TYPE "public"."attribute_type_enum" AS ENUM (
    'tasting_note',
    'physical_trait'
);

ALTER TYPE "public"."attribute_type_enum" OWNER TO "postgres";

CREATE TYPE "public"."entity_type" AS ENUM (
    'cocktail',
    'ingredient',
    'beer',
    'wine',
    'glassware',
    'method',
    'ice',
    'family'
);

ALTER TYPE "public"."entity_type" OWNER TO "postgres";

CREATE TYPE "public"."item_domain" AS ENUM (
    'beer',
    'wine',
    'spirit',
    'ingredient',
    'cocktail_family',
    'glassware_style'
);

ALTER TYPE "public"."item_domain" OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

CREATE TABLE IF NOT EXISTS "public"."user_bars" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "bar_id" "uuid" NOT NULL,
    "role_level" integer DEFAULT 10 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."user_bars" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."add_user_to_bar_by_email"("p_email" "text", "p_bar_id" "uuid", "p_role_level" integer) RETURNS "public"."user_bars"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_user_id UUID;
    v_admin_role INT;
    v_new_user_bar public.user_bars;
BEGIN
    -- Check if the current user is an Admin (40) of this bar
    SELECT role_level INTO v_admin_role
    FROM public.user_bars
    WHERE bar_id = p_bar_id AND user_id = auth.uid();

    IF v_admin_role IS NULL OR v_admin_role < 40 THEN
        RAISE EXCEPTION 'You must be a bar Admin to add members.';
    END IF;

    -- Find the user by email
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = p_email;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User not found with that email.';
    END IF;

    -- Insert or update the user_bar record
    INSERT INTO public.user_bars (user_id, bar_id, role_level)
    VALUES (v_user_id, p_bar_id, p_role_level)
    ON CONFLICT (user_id, bar_id) 
    DO UPDATE SET role_level = EXCLUDED.role_level
    RETURNING * INTO v_new_user_bar;

    RETURN v_new_user_bar;
END;
$$;

ALTER FUNCTION "public"."add_user_to_bar_by_email"("p_email" "text", "p_bar_id" "uuid", "p_role_level" integer) OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "item_type" "public"."entity_type" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "glassware_id" "uuid",
    "family_id" "uuid",
    "ice_id" "uuid",
    "notes" "text",
    "origin" "text",
    "price" "text",
    "status" "text",
    "brand_maker" "text",
    "abv" numeric,
    "bar_id" "uuid",
    "override_visibility_level" integer,
    "override_generic_ingredient_level" integer,
    "override_specific_brand_level" integer,
    "override_measurement_level" integer,
    "override_prep_level" integer,
    "icon_key" "text",
    "icon_url" "text",
    "hide_from_search" boolean DEFAULT false NOT NULL
);

ALTER TABLE "public"."items" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."assign_item_to_bar"("p_item_id" "uuid", "p_bar_id" "uuid") RETURNS "public"."items"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_admin_role INT;
    v_updated_item public.items;
BEGIN
    -- Check if the current user is an Admin (40) of this bar
    SELECT role_level INTO v_admin_role
    FROM public.user_bars
    WHERE bar_id = p_bar_id AND user_id = auth.uid();

    IF v_admin_role IS NULL OR v_admin_role < 40 THEN
        RAISE EXCEPTION 'You must be a bar Admin to assign items to this bar.';
    END IF;

    UPDATE public.items
    SET bar_id = p_bar_id
    WHERE id = p_item_id
    RETURNING * INTO v_updated_item;

    RETURN v_updated_item;
END;
$$;

ALTER FUNCTION "public"."assign_item_to_bar"("p_item_id" "uuid", "p_bar_id" "uuid") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."bars" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "default_visibility_level" integer DEFAULT 10 NOT NULL,
    "default_generic_ingredient_level" integer DEFAULT 20 NOT NULL,
    "default_specific_brand_level" integer DEFAULT 30 NOT NULL,
    "default_measurement_level" integer DEFAULT 30 NOT NULL,
    "default_prep_level" integer DEFAULT 40 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "logo_url" "text",
    "primary_color" "text",
    "secondary_color" "text"
);

ALTER TABLE "public"."bars" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_new_bar"("p_name" "text", "p_visibility" integer, "p_generic" integer, "p_specific" integer, "p_measurement" integer, "p_prep" integer) RETURNS "public"."bars"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    new_bar public.bars;
BEGIN
    -- Insert the new bar
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

    -- Assign the creator as Admin (40)
    INSERT INTO public.user_bars (bar_id, user_id, role_level)
    VALUES (new_bar.id, auth.uid(), 40);

    RETURN new_bar;
END;
$$;

ALTER FUNCTION "public"."create_new_bar"("p_name" "text", "p_visibility" integer, "p_generic" integer, "p_specific" integer, "p_measurement" integer, "p_prep" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."effective_bar_role"("real_role" integer) RETURNS integer
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT LEAST(
    COALESCE(real_role, 10),
    COALESCE(
      (SELECT view_as_role_level FROM public.user_prefs WHERE user_id = auth.uid()),
      COALESCE(real_role, 10)
    )
  );
$$;

ALTER FUNCTION "public"."effective_bar_role"("real_role" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_bar_members"("p_bar_id" "uuid") RETURNS TABLE("user_id" "uuid", "email" "text", "role_level" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_user_role INT;
BEGIN
    -- Check if the current user has access to this bar
    SELECT ub.role_level INTO v_user_role
    FROM public.user_bars ub
    WHERE ub.bar_id = p_bar_id AND ub.user_id = auth.uid();

    IF v_user_role IS NULL THEN
        RAISE EXCEPTION 'You do not have access to view this bar members.';
    END IF;

    RETURN QUERY
    SELECT 
        ub.user_id,
        au.email::TEXT,
        ub.role_level
    FROM public.user_bars ub
    JOIN auth.users au ON ub.user_id = au.id
    WHERE ub.bar_id = p_bar_id;
END;
$$;

ALTER FUNCTION "public"."get_bar_members"("p_bar_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_my_bars"() RETURNS SETOF "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
    SELECT bar_id FROM public.user_bars WHERE user_id = auth.uid();
$$;

ALTER FUNCTION "public"."get_my_bars"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;

ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_bar_settings"("p_bar_id" "uuid", "p_name" "text", "p_visibility" integer, "p_generic" integer, "p_specific" integer, "p_measurement" integer, "p_prep" integer, "p_logo_url" "text" DEFAULT NULL::"text", "p_primary_color" "text" DEFAULT NULL::"text", "p_secondary_color" "text" DEFAULT NULL::"text") RETURNS "public"."bars"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_admin_role INT;
    v_updated_bar public.bars;
BEGIN
    SELECT role_level INTO v_admin_role
    FROM public.user_bars
    WHERE bar_id = p_bar_id AND user_id = auth.uid();

    IF v_admin_role IS NULL OR v_admin_role < 35 THEN
        RAISE EXCEPTION 'You must be a bar Admin to update bar settings.';
    END IF;

    UPDATE public.bars
    SET
        name = p_name,
        default_visibility_level = p_visibility,
        default_generic_ingredient_level = p_generic,
        default_specific_brand_level = p_specific,
        default_measurement_level = p_measurement,
        default_prep_level = p_prep,
        logo_url = COALESCE(p_logo_url, logo_url),
        primary_color = p_primary_color,
        secondary_color = p_secondary_color
    WHERE id = p_bar_id
    RETURNING * INTO v_updated_bar;

    RETURN v_updated_bar;
END;
$$;

ALTER FUNCTION "public"."update_bar_settings"("p_bar_id" "uuid", "p_name" "text", "p_visibility" integer, "p_generic" integer, "p_specific" integer, "p_measurement" integer, "p_prep" integer, "p_logo_url" "text", "p_primary_color" "text", "p_secondary_color" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_modified_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."update_modified_column"() OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."app_item_presentation" AS
 SELECT "c"."id",
    "c"."name",
    "c"."item_type",
    "c"."description",
    "c"."created_at",
    "c"."glassware_id",
    "c"."family_id",
    "c"."ice_id",
    "c"."notes",
    "c"."origin",
    "c"."price",
    "c"."status",
    "c"."brand_maker",
    "c"."abv",
    "c"."bar_id",
    "c"."icon_key",
    "c"."icon_url",
    "c"."hide_from_search"
   FROM (("public"."items" "c"
     LEFT JOIN "public"."bars" "b" ON (("c"."bar_id" = "b"."id")))
     LEFT JOIN "public"."user_bars" "ub" ON ((("ub"."bar_id" = "c"."bar_id") AND ("ub"."user_id" = "auth"."uid"()))))
  WHERE (("c"."bar_id" IS NULL) OR ("public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_visibility_level", "b"."default_visibility_level")));

ALTER VIEW "public"."app_item_presentation" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."recipes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "recipe_item_id" "uuid",
    "ingredient_item_id" "uuid",
    "amount" numeric,
    "unit" "text",
    "preparation_notes" "text",
    "is_optional" boolean DEFAULT false,
    "parent_ingredient_id" "uuid",
    "sort_order" integer DEFAULT 0 NOT NULL
);

ALTER TABLE "public"."recipes" OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."app_recipe_presentation" AS
 SELECT "r"."id",
    "r"."created_at",
    "r"."recipe_item_id",
        CASE
            WHEN ("c"."bar_id" IS NULL) THEN "r"."ingredient_item_id"
            WHEN ("public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_specific_brand_level", "b"."default_specific_brand_level")) THEN "r"."ingredient_item_id"
            WHEN ("public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_generic_ingredient_level", "b"."default_generic_ingredient_level")) THEN COALESCE("r"."parent_ingredient_id", "r"."ingredient_item_id")
            ELSE NULL::"uuid"
        END AS "display_ingredient_id",
        CASE
            WHEN ("c"."bar_id" IS NULL) THEN "r"."amount"
            WHEN ("public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_measurement_level", "b"."default_measurement_level")) THEN "r"."amount"
            ELSE NULL::numeric
        END AS "amount",
        CASE
            WHEN ("c"."bar_id" IS NULL) THEN "r"."unit"
            WHEN ("public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_measurement_level", "b"."default_measurement_level")) THEN "r"."unit"
            ELSE NULL::"text"
        END AS "unit",
        CASE
            WHEN ("c"."bar_id" IS NULL) THEN "r"."preparation_notes"
            WHEN ("public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_prep_level", "b"."default_prep_level")) THEN "r"."preparation_notes"
            ELSE NULL::"text"
        END AS "preparation_notes",
    "r"."is_optional",
    "r"."parent_ingredient_id",
    "r"."ingredient_item_id",
    "r"."sort_order"
   FROM ((("public"."recipes" "r"
     JOIN "public"."items" "c" ON (("r"."recipe_item_id" = "c"."id")))
     LEFT JOIN "public"."bars" "b" ON (("c"."bar_id" = "b"."id")))
     LEFT JOIN "public"."user_bars" "ub" ON ((("ub"."bar_id" = "c"."bar_id") AND ("ub"."user_id" = "auth"."uid"()))))
  WHERE (("c"."bar_id" IS NULL) OR ("public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_visibility_level", "b"."default_visibility_level")));

ALTER VIEW "public"."app_recipe_presentation" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."attributes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "public"."attribute_type_enum" NOT NULL
);

ALTER TABLE "public"."attributes" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "parent_id" "uuid",
    "domain" "public"."item_domain",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);

ALTER TABLE "public"."categories" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."category_attributes" (
    "category_id" "uuid" NOT NULL,
    "attribute_id" "uuid" NOT NULL
);

ALTER TABLE "public"."category_attributes" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."drafts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "entity_type" "text" NOT NULL,
    "draft_data" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "bar_id" "uuid",
    CONSTRAINT "drafts_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['cocktail'::"text", 'ingredient'::"text", 'beer'::"text", 'wine'::"text", 'menu'::"text"])))
);

ALTER TABLE "public"."drafts" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "url" "text" NOT NULL
);

ALTER TABLE "public"."images" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."item_attributes" (
    "item_id" "uuid" NOT NULL,
    "attribute_id" "uuid" NOT NULL
);

ALTER TABLE "public"."item_attributes" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."item_categories" (
    "item_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "is_primary" boolean DEFAULT false
);

ALTER TABLE "public"."item_categories" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."item_images" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "item_id" "uuid",
    "image_id" "uuid",
    "sort_order" numeric
);

ALTER TABLE "public"."item_images" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."item_methods" (
    "item_id" "uuid" NOT NULL,
    "method_item_id" "uuid" NOT NULL,
    "sort_order" numeric
);

ALTER TABLE "public"."item_methods" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."menu_drinks" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "menu_id" "uuid",
    "template_section_id" "uuid",
    "item_id" "uuid",
    "sort_order" numeric
);

ALTER TABLE "public"."menu_drinks" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."menu_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."menu_templates" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."menus" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT false,
    "template_id" "uuid",
    "bar_id" "uuid",
    "cover_position" real DEFAULT 50,
    "cover_url" "text"
);

ALTER TABLE "public"."menus" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."substitutions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "original_item_id" "uuid",
    "substitute_item_id" "uuid",
    "notes" "text"
);

ALTER TABLE "public"."substitutions" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."template_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "min_items" integer DEFAULT 1,
    "max_items" integer,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "allowed_types" "text"[] DEFAULT ARRAY['cocktail'::"text", 'beer'::"text", 'wine'::"text"] NOT NULL,
    CONSTRAINT "template_sections_allowed_types_check" CHECK ((("allowed_types" <@ ARRAY['cocktail'::"text", 'beer'::"text", 'wine'::"text"]) AND ("cardinality"("allowed_types") >= 1)))
);

ALTER TABLE "public"."template_sections" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."user_prefs" (
    "user_id" "uuid" NOT NULL,
    "view_as_role_level" integer,
    CONSTRAINT "user_prefs_view_as_role_level_check" CHECK ((("view_as_role_level" IS NULL) OR ("view_as_role_level" = ANY (ARRAY[10, 20, 30, 35, 40]))))
);

ALTER TABLE "public"."user_prefs" OWNER TO "postgres";

ALTER TABLE ONLY "public"."attributes"
    ADD CONSTRAINT "attributes_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."bars"
    ADD CONSTRAINT "bars_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."category_attributes"
    ADD CONSTRAINT "category_attributes_pkey" PRIMARY KEY ("category_id", "attribute_id");

ALTER TABLE ONLY "public"."drafts"
    ADD CONSTRAINT "drafts_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."images"
    ADD CONSTRAINT "images_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."item_attributes"
    ADD CONSTRAINT "item_attributes_pkey" PRIMARY KEY ("item_id", "attribute_id");

ALTER TABLE ONLY "public"."item_categories"
    ADD CONSTRAINT "item_categories_pkey" PRIMARY KEY ("item_id", "category_id");

ALTER TABLE ONLY "public"."item_images"
    ADD CONSTRAINT "item_images_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."item_methods"
    ADD CONSTRAINT "item_methods_pkey" PRIMARY KEY ("item_id", "method_item_id");

ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."menu_templates"
    ADD CONSTRAINT "menu_templates_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."menus"
    ADD CONSTRAINT "menus_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."menu_drinks"
    ADD CONSTRAINT "new_menu_drinks_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."recipes"
    ADD CONSTRAINT "new_recipes_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."substitutions"
    ADD CONSTRAINT "substitutions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."template_sections"
    ADD CONSTRAINT "template_sections_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."user_bars"
    ADD CONSTRAINT "user_bars_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."user_bars"
    ADD CONSTRAINT "user_bars_user_id_bar_id_key" UNIQUE ("user_id", "bar_id");

ALTER TABLE ONLY "public"."user_prefs"
    ADD CONSTRAINT "user_prefs_pkey" PRIMARY KEY ("user_id");

CREATE UNIQUE INDEX "recipes_recipe_item_sort_order_idx" ON "public"."recipes" USING "btree" ("recipe_item_id", "sort_order");

CREATE OR REPLACE TRIGGER "update_menu_templates_modtime" BEFORE UPDATE ON "public"."menu_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();

ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."category_attributes"
    ADD CONSTRAINT "category_attributes_attribute_id_fkey" FOREIGN KEY ("attribute_id") REFERENCES "public"."attributes"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."category_attributes"
    ADD CONSTRAINT "category_attributes_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."drafts"
    ADD CONSTRAINT "drafts_bar_id_fkey" FOREIGN KEY ("bar_id") REFERENCES "public"."bars"("id");

ALTER TABLE ONLY "public"."drafts"
    ADD CONSTRAINT "drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");

ALTER TABLE ONLY "public"."item_attributes"
    ADD CONSTRAINT "item_attributes_attribute_id_fkey" FOREIGN KEY ("attribute_id") REFERENCES "public"."attributes"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."item_attributes"
    ADD CONSTRAINT "item_attributes_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."item_categories"
    ADD CONSTRAINT "item_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."item_categories"
    ADD CONSTRAINT "item_categories_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."item_images"
    ADD CONSTRAINT "item_images_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "public"."images"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."item_images"
    ADD CONSTRAINT "item_images_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."item_methods"
    ADD CONSTRAINT "item_methods_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."item_methods"
    ADD CONSTRAINT "item_methods_method_item_id_fkey" FOREIGN KEY ("method_item_id") REFERENCES "public"."items"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_bar_id_fkey" FOREIGN KEY ("bar_id") REFERENCES "public"."bars"("id");

ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "public"."items"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_glassware_id_fkey" FOREIGN KEY ("glassware_id") REFERENCES "public"."items"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_ice_id_fkey" FOREIGN KEY ("ice_id") REFERENCES "public"."items"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."menus"
    ADD CONSTRAINT "menus_bar_id_fkey" FOREIGN KEY ("bar_id") REFERENCES "public"."bars"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."menus"
    ADD CONSTRAINT "menus_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."menu_templates"("id");

ALTER TABLE ONLY "public"."menu_drinks"
    ADD CONSTRAINT "new_menu_drinks_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."menu_drinks"
    ADD CONSTRAINT "new_menu_drinks_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "public"."menus"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."menu_drinks"
    ADD CONSTRAINT "new_menu_drinks_template_section_id_fkey" FOREIGN KEY ("template_section_id") REFERENCES "public"."template_sections"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."recipes"
    ADD CONSTRAINT "new_recipes_ingredient_item_id_fkey" FOREIGN KEY ("ingredient_item_id") REFERENCES "public"."items"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."recipes"
    ADD CONSTRAINT "new_recipes_parent_ingredient_id_fkey" FOREIGN KEY ("parent_ingredient_id") REFERENCES "public"."items"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."recipes"
    ADD CONSTRAINT "new_recipes_recipe_item_id_fkey" FOREIGN KEY ("recipe_item_id") REFERENCES "public"."items"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."substitutions"
    ADD CONSTRAINT "substitutions_original_item_id_fkey" FOREIGN KEY ("original_item_id") REFERENCES "public"."items"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."substitutions"
    ADD CONSTRAINT "substitutions_substitute_item_id_fkey" FOREIGN KEY ("substitute_item_id") REFERENCES "public"."items"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."template_sections"
    ADD CONSTRAINT "template_sections_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."menu_templates"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."user_bars"
    ADD CONSTRAINT "user_bars_bar_id_fkey" FOREIGN KEY ("bar_id") REFERENCES "public"."bars"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."user_bars"
    ADD CONSTRAINT "user_bars_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."user_prefs"
    ADD CONSTRAINT "user_prefs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

CREATE POLICY "Admins can delete bar roles or users can leave" ON "public"."user_bars" FOR DELETE USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."user_bars" "ub"
  WHERE (("ub"."bar_id" = "ub"."bar_id") AND ("ub"."user_id" = "auth"."uid"()) AND ("ub"."role_level" >= 40))))));

CREATE POLICY "Admins can delete bars" ON "public"."bars" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_bars"
  WHERE (("user_bars"."bar_id" = "bars"."id") AND ("user_bars"."user_id" = "auth"."uid"()) AND ("user_bars"."role_level" >= 40)))));

CREATE POLICY "Admins can insert user_bars" ON "public"."user_bars" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_bars" "ub"
  WHERE (("ub"."bar_id" = "ub"."bar_id") AND ("ub"."user_id" = "auth"."uid"()) AND ("ub"."role_level" >= 40)))));

CREATE POLICY "Admins can update bar roles" ON "public"."user_bars" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_bars" "ub"
  WHERE (("ub"."bar_id" = "ub"."bar_id") AND ("ub"."user_id" = "auth"."uid"()) AND ("ub"."role_level" >= 40)))));

CREATE POLICY "Admins can update bars" ON "public"."bars" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_bars"
  WHERE (("user_bars"."bar_id" = "bars"."id") AND ("user_bars"."user_id" = "auth"."uid"()) AND ("user_bars"."role_level" >= 40)))));

CREATE POLICY "Allow public delete access to categories" ON "public"."categories" FOR DELETE USING (true);

CREATE POLICY "Allow public delete access to item_categories" ON "public"."item_categories" FOR DELETE USING (true);

CREATE POLICY "Allow public delete access to item_images" ON "public"."item_images" FOR DELETE USING (true);

CREATE POLICY "Allow public delete access to item_methods" ON "public"."item_methods" FOR DELETE USING (true);

CREATE POLICY "Allow public delete access to items" ON "public"."items" FOR DELETE USING (true);

CREATE POLICY "Allow public delete access to menu_drinks" ON "public"."menu_drinks" FOR DELETE USING (true);

CREATE POLICY "Allow public delete access to recipes" ON "public"."recipes" FOR DELETE USING (true);

CREATE POLICY "Allow public insert access to categories" ON "public"."categories" FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public insert access to item_categories" ON "public"."item_categories" FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public insert access to item_images" ON "public"."item_images" FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public insert access to item_methods" ON "public"."item_methods" FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public insert access to items" ON "public"."items" FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public insert access to menu_drinks" ON "public"."menu_drinks" FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public insert access to recipes" ON "public"."recipes" FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read access to attributes" ON "public"."attributes" FOR SELECT USING (true);

CREATE POLICY "Allow public read access to categories" ON "public"."categories" FOR SELECT USING (true);

CREATE POLICY "Allow public read access to category_attributes" ON "public"."category_attributes" FOR SELECT USING (true);

CREATE POLICY "Allow public read access to item_attributes" ON "public"."item_attributes" FOR SELECT USING (true);

CREATE POLICY "Allow public read access to item_categories" ON "public"."item_categories" FOR SELECT USING (true);

CREATE POLICY "Allow public read access to item_images" ON "public"."item_images" FOR SELECT USING (true);

CREATE POLICY "Allow public read access to item_methods" ON "public"."item_methods" FOR SELECT USING (true);

CREATE POLICY "Allow public read access to items" ON "public"."items" FOR SELECT USING (true);

CREATE POLICY "Allow public read access to menu_drinks" ON "public"."menu_drinks" FOR SELECT USING (true);

CREATE POLICY "Allow public read access to recipes" ON "public"."recipes" FOR SELECT USING (true);

CREATE POLICY "Allow public read access to substitutions" ON "public"."substitutions" FOR SELECT USING (true);

CREATE POLICY "Allow public update access to categories" ON "public"."categories" FOR UPDATE USING (true);

CREATE POLICY "Allow public update access to item_categories" ON "public"."item_categories" FOR UPDATE USING (true);

CREATE POLICY "Allow public update access to item_images" ON "public"."item_images" FOR UPDATE USING (true);

CREATE POLICY "Allow public update access to item_methods" ON "public"."item_methods" FOR UPDATE USING (true);

CREATE POLICY "Allow public update access to items" ON "public"."items" FOR UPDATE USING (true);

CREATE POLICY "Allow public update access to menu_drinks" ON "public"."menu_drinks" FOR UPDATE USING (true);

CREATE POLICY "Allow public update access to recipes" ON "public"."recipes" FOR UPDATE USING (true);

CREATE POLICY "Anyone can view bars" ON "public"."bars" FOR SELECT USING (true);

CREATE POLICY "Authenticated delete access" ON "public"."images" FOR DELETE TO "authenticated" USING (true);

CREATE POLICY "Authenticated insert access" ON "public"."images" FOR INSERT TO "authenticated" WITH CHECK (true);

CREATE POLICY "Authenticated update access" ON "public"."images" FOR UPDATE TO "authenticated" USING (true);

CREATE POLICY "Bar members can view other members" ON "public"."user_bars" FOR SELECT USING (("bar_id" IN ( SELECT "public"."get_my_bars"() AS "get_my_bars")));

CREATE POLICY "Enable insert access for all users" ON "public"."menu_templates" FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable insert access for all users" ON "public"."template_sections" FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable insert for all users" ON "public"."item_categories" FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable insert for all users" ON "public"."item_images" FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable insert for all users" ON "public"."item_methods" FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable insert for all users" ON "public"."items" FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable insert for all users" ON "public"."recipes" FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable insert for authenticated users" ON "public"."images" FOR INSERT TO "authenticated" WITH CHECK (true);

CREATE POLICY "Enable insert for authenticated users only" ON "public"."images" FOR INSERT TO "authenticated" WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON "public"."attributes" FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON "public"."categories" FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON "public"."category_attributes" FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON "public"."images" FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON "public"."item_attributes" FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON "public"."item_categories" FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON "public"."item_images" FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON "public"."item_methods" FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON "public"."items" FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON "public"."menu_templates" FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON "public"."recipes" FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON "public"."substitutions" FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON "public"."template_sections" FOR SELECT USING (true);

CREATE POLICY "Enable update access for all users" ON "public"."menu_templates" FOR UPDATE USING (true);

CREATE POLICY "Enable update access for all users" ON "public"."template_sections" FOR UPDATE USING (true);

CREATE POLICY "Enable update for all users" ON "public"."item_images" FOR UPDATE USING (true);

CREATE POLICY "Enable update for all users" ON "public"."items" FOR UPDATE USING (true);

CREATE POLICY "Enable update for all users" ON "public"."recipes" FOR UPDATE USING (true);

CREATE POLICY "Public menus are viewable by everyone" ON "public"."menus" FOR SELECT USING (true);

CREATE POLICY "Public read access" ON "public"."images" FOR SELECT USING (true);

CREATE POLICY "Users can delete menus" ON "public"."menus" FOR DELETE TO "authenticated" USING (true);

CREATE POLICY "Users can delete their own drafts or drafts in their bars" ON "public"."drafts" FOR DELETE USING ((("auth"."uid"() = "user_id") OR ("bar_id" IN ( SELECT "user_bars"."bar_id"
   FROM "public"."user_bars"
  WHERE ("user_bars"."user_id" = "auth"."uid"())))));

CREATE POLICY "Users can insert menus" ON "public"."menus" FOR INSERT TO "authenticated" WITH CHECK (true);

CREATE POLICY "Users can insert their own drafts" ON "public"."drafts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can update menus" ON "public"."menus" FOR UPDATE TO "authenticated" USING (true);

CREATE POLICY "Users can update their own drafts or drafts in their bars" ON "public"."drafts" FOR UPDATE USING ((("auth"."uid"() = "user_id") OR ("bar_id" IN ( SELECT "user_bars"."bar_id"
   FROM "public"."user_bars"
  WHERE ("user_bars"."user_id" = "auth"."uid"()))))) WITH CHECK ((("auth"."uid"() = "user_id") OR ("bar_id" IN ( SELECT "user_bars"."bar_id"
   FROM "public"."user_bars"
  WHERE ("user_bars"."user_id" = "auth"."uid"())))));

CREATE POLICY "Users can view their own drafts or drafts in their bars" ON "public"."drafts" FOR SELECT USING ((("auth"."uid"() = "user_id") OR ("bar_id" IN ( SELECT "user_bars"."bar_id"
   FROM "public"."user_bars"
  WHERE ("user_bars"."user_id" = "auth"."uid"())))));

ALTER TABLE "public"."attributes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."bars" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."category_attributes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."drafts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."images" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."item_attributes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."item_categories" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."item_images" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."item_methods" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."menu_drinks" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."menu_templates" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."menus" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."recipes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."substitutions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."template_sections" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."user_bars" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."user_prefs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own prefs" ON "public"."user_prefs" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

GRANT ALL ON TABLE "public"."user_bars" TO "anon";
GRANT ALL ON TABLE "public"."user_bars" TO "authenticated";
GRANT ALL ON TABLE "public"."user_bars" TO "service_role";

GRANT ALL ON FUNCTION "public"."add_user_to_bar_by_email"("p_email" "text", "p_bar_id" "uuid", "p_role_level" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."add_user_to_bar_by_email"("p_email" "text", "p_bar_id" "uuid", "p_role_level" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_user_to_bar_by_email"("p_email" "text", "p_bar_id" "uuid", "p_role_level" integer) TO "service_role";

GRANT ALL ON TABLE "public"."items" TO "anon";
GRANT ALL ON TABLE "public"."items" TO "authenticated";
GRANT ALL ON TABLE "public"."items" TO "service_role";

GRANT ALL ON FUNCTION "public"."assign_item_to_bar"("p_item_id" "uuid", "p_bar_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."assign_item_to_bar"("p_item_id" "uuid", "p_bar_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_item_to_bar"("p_item_id" "uuid", "p_bar_id" "uuid") TO "service_role";

GRANT ALL ON TABLE "public"."bars" TO "anon";
GRANT ALL ON TABLE "public"."bars" TO "authenticated";
GRANT ALL ON TABLE "public"."bars" TO "service_role";

GRANT ALL ON FUNCTION "public"."create_new_bar"("p_name" "text", "p_visibility" integer, "p_generic" integer, "p_specific" integer, "p_measurement" integer, "p_prep" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."create_new_bar"("p_name" "text", "p_visibility" integer, "p_generic" integer, "p_specific" integer, "p_measurement" integer, "p_prep" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_new_bar"("p_name" "text", "p_visibility" integer, "p_generic" integer, "p_specific" integer, "p_measurement" integer, "p_prep" integer) TO "service_role";

GRANT ALL ON FUNCTION "public"."effective_bar_role"("real_role" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."effective_bar_role"("real_role" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."effective_bar_role"("real_role" integer) TO "service_role";

GRANT ALL ON FUNCTION "public"."get_bar_members"("p_bar_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_bar_members"("p_bar_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_bar_members"("p_bar_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."get_my_bars"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_bars"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_bars"() TO "service_role";

GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";

GRANT ALL ON FUNCTION "public"."update_bar_settings"("p_bar_id" "uuid", "p_name" "text", "p_visibility" integer, "p_generic" integer, "p_specific" integer, "p_measurement" integer, "p_prep" integer, "p_logo_url" "text", "p_primary_color" "text", "p_secondary_color" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_bar_settings"("p_bar_id" "uuid", "p_name" "text", "p_visibility" integer, "p_generic" integer, "p_specific" integer, "p_measurement" integer, "p_prep" integer, "p_logo_url" "text", "p_primary_color" "text", "p_secondary_color" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_bar_settings"("p_bar_id" "uuid", "p_name" "text", "p_visibility" integer, "p_generic" integer, "p_specific" integer, "p_measurement" integer, "p_prep" integer, "p_logo_url" "text", "p_primary_color" "text", "p_secondary_color" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "service_role";

GRANT ALL ON TABLE "public"."app_item_presentation" TO "anon";
GRANT ALL ON TABLE "public"."app_item_presentation" TO "authenticated";
GRANT ALL ON TABLE "public"."app_item_presentation" TO "service_role";

GRANT ALL ON TABLE "public"."recipes" TO "anon";
GRANT ALL ON TABLE "public"."recipes" TO "authenticated";
GRANT ALL ON TABLE "public"."recipes" TO "service_role";

GRANT ALL ON TABLE "public"."app_recipe_presentation" TO "anon";
GRANT ALL ON TABLE "public"."app_recipe_presentation" TO "authenticated";
GRANT ALL ON TABLE "public"."app_recipe_presentation" TO "service_role";

GRANT ALL ON TABLE "public"."attributes" TO "anon";
GRANT ALL ON TABLE "public"."attributes" TO "authenticated";
GRANT ALL ON TABLE "public"."attributes" TO "service_role";

GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";

GRANT ALL ON TABLE "public"."category_attributes" TO "anon";
GRANT ALL ON TABLE "public"."category_attributes" TO "authenticated";
GRANT ALL ON TABLE "public"."category_attributes" TO "service_role";

GRANT ALL ON TABLE "public"."drafts" TO "anon";
GRANT ALL ON TABLE "public"."drafts" TO "authenticated";
GRANT ALL ON TABLE "public"."drafts" TO "service_role";

GRANT ALL ON TABLE "public"."images" TO "anon";
GRANT ALL ON TABLE "public"."images" TO "authenticated";
GRANT ALL ON TABLE "public"."images" TO "service_role";

GRANT ALL ON TABLE "public"."item_attributes" TO "anon";
GRANT ALL ON TABLE "public"."item_attributes" TO "authenticated";
GRANT ALL ON TABLE "public"."item_attributes" TO "service_role";

GRANT ALL ON TABLE "public"."item_categories" TO "anon";
GRANT ALL ON TABLE "public"."item_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."item_categories" TO "service_role";

GRANT ALL ON TABLE "public"."item_images" TO "anon";
GRANT ALL ON TABLE "public"."item_images" TO "authenticated";
GRANT ALL ON TABLE "public"."item_images" TO "service_role";

GRANT ALL ON TABLE "public"."item_methods" TO "anon";
GRANT ALL ON TABLE "public"."item_methods" TO "authenticated";
GRANT ALL ON TABLE "public"."item_methods" TO "service_role";

GRANT ALL ON TABLE "public"."menu_drinks" TO "anon";
GRANT ALL ON TABLE "public"."menu_drinks" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_drinks" TO "service_role";

GRANT ALL ON TABLE "public"."menu_templates" TO "anon";
GRANT ALL ON TABLE "public"."menu_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_templates" TO "service_role";

GRANT ALL ON TABLE "public"."menus" TO "anon";
GRANT ALL ON TABLE "public"."menus" TO "authenticated";
GRANT ALL ON TABLE "public"."menus" TO "service_role";

GRANT ALL ON TABLE "public"."substitutions" TO "anon";
GRANT ALL ON TABLE "public"."substitutions" TO "authenticated";
GRANT ALL ON TABLE "public"."substitutions" TO "service_role";

GRANT ALL ON TABLE "public"."template_sections" TO "anon";
GRANT ALL ON TABLE "public"."template_sections" TO "authenticated";
GRANT ALL ON TABLE "public"."template_sections" TO "service_role";

GRANT ALL ON TABLE "public"."user_prefs" TO "anon";
GRANT ALL ON TABLE "public"."user_prefs" TO "authenticated";
GRANT ALL ON TABLE "public"."user_prefs" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


-- ---------------------------------------------------------------------------
-- Storage (managed in the dashboard until now; not included in db dump)
-- ---------------------------------------------------------------------------

INSERT INTO "storage"."buckets" ("id", "name", "public")
VALUES ('avatars', 'avatars', true), ('drinks', 'drinks', true)
ON CONFLICT ("id") DO NOTHING;

CREATE POLICY "Give users access to own folder 1oj01fe_0" ON "storage"."objects" FOR SELECT USING ((("bucket_id" = 'avatars'::"text") AND ((( SELECT "auth"."uid"() AS "uid"))::"text" = ("storage"."foldername"("name"))[1])));
CREATE POLICY "Give users access to own folder 1oj01fe_1" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'avatars'::"text") AND ((( SELECT "auth"."uid"() AS "uid"))::"text" = ("storage"."foldername"("name"))[1])));
CREATE POLICY "Give users access to own folder 1oj01fe_2" ON "storage"."objects" FOR UPDATE USING ((("bucket_id" = 'avatars'::"text") AND ((( SELECT "auth"."uid"() AS "uid"))::"text" = ("storage"."foldername"("name"))[1])));
CREATE POLICY "Give users access to own folder 1oj01fe_3" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'avatars'::"text") AND ((( SELECT "auth"."uid"() AS "uid"))::"text" = ("storage"."foldername"("name"))[1])));

CREATE POLICY "Give anon users access to JPG images in folder 1d544wr_0" ON "storage"."objects" FOR SELECT USING ((("bucket_id" = 'drinks'::"text") AND ("storage"."extension"("name") = 'jpg'::"text") AND ("lower"(("storage"."foldername"("name"))[1]) = 'public'::"text") AND ("auth"."role"() = 'anon'::"text")));
CREATE POLICY "Give anon users access to JPG images in folder 1d544wr_1" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'drinks'::"text") AND ("storage"."extension"("name") = 'jpg'::"text") AND ("lower"(("storage"."foldername"("name"))[1]) = 'public'::"text") AND ("auth"."role"() = 'anon'::"text")));
CREATE POLICY "Give anon users access to JPG images in folder 1d544wr_2" ON "storage"."objects" FOR UPDATE USING ((("bucket_id" = 'drinks'::"text") AND ("storage"."extension"("name") = 'jpg'::"text") AND ("lower"(("storage"."foldername"("name"))[1]) = 'public'::"text") AND ("auth"."role"() = 'anon'::"text")));
CREATE POLICY "Give anon users access to JPG images in folder 1d544wr_3" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'drinks'::"text") AND ("storage"."extension"("name") = 'jpg'::"text") AND ("lower"(("storage"."foldername"("name"))[1]) = 'public'::"text") AND ("auth"."role"() = 'anon'::"text")));
CREATE POLICY "Allow public uploads to drinks" ON "storage"."objects" FOR INSERT WITH CHECK (("bucket_id" = 'drinks'::"text"));
CREATE POLICY "Allow public downloads from drinks" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'drinks'::"text"));
CREATE POLICY "Public Access" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'drinks'::"text"));
CREATE POLICY "Authenticated Uploads" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK (("bucket_id" = 'drinks'::"text"));
CREATE POLICY "Authenticated Updates" ON "storage"."objects" FOR UPDATE TO "authenticated" USING (("bucket_id" = 'drinks'::"text"));
