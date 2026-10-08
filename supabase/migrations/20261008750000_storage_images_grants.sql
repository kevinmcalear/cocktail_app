-- Narrower reads on the drinks bucket, image rows that point at it, and no
-- table-level privileges the API never uses.
--
--   * storage.objects: the drinks bucket is public, so its files are served
--     by URL without any policy. The old SELECT-for-everyone policy also let
--     anyone list the bucket. Now a signed-in person can read only the rows of
--     files they uploaded themselves (what an upload's response needs).
--     Edge functions and scripts use the service role and are unaffected.
--   * images_insert: a client can only record a picture that lives in this
--     project's drinks bucket. The service role (edge functions, data
--     migrations, import scripts) is unaffected, and so are existing rows.
--   * TRUNCATE, TRIGGER and REFERENCES are taken away from anon and
--     authenticated on every public table and view, and from tables created
--     by later migrations.

-- --- Storage ---

DROP POLICY IF EXISTS "Allow public downloads from drinks" ON "storage"."objects";

CREATE POLICY "drinks_select_own_uploads" ON "storage"."objects" FOR SELECT TO "authenticated"
    USING ("bucket_id" = 'drinks' AND "owner_id" = (SELECT "auth"."uid"())::text);

-- --- Image rows ---

-- Production's project, or a local stack (whose URLs only ever exist locally).
CREATE FUNCTION "private"."is_drinks_bucket_url"("p_url" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT p_url ~ '^(https://uzrqriixgxbvhunwrwkn\.supabase\.co|http://(127\.0\.0\.1|localhost)(:[0-9]+)?)/storage/v1/object/public/drinks/[^?#\\]+$'
    AND p_url !~* '(/\.|%2e|%2f|%5c)'
    AND char_length(p_url) <= 1000;
$$;

DROP POLICY "images_insert" ON "public"."images";
CREATE POLICY "images_insert" ON "public"."images" FOR INSERT TO "authenticated"
    WITH CHECK (NOT "is_generated" AND "spec_fingerprint" IS NULL AND "private"."is_drinks_bucket_url"("url"));

-- --- Table privileges ---

REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA "public" FROM "anon", "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
    REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM "anon", "authenticated";
