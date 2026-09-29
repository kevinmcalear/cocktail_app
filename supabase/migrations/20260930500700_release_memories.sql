-- DRAFT (docs/publishing_moderation_proposal.md, section 3). Local stack only.
-- Not applied to production; needs Kevin's review first.
--
-- A collected release keeps a memory too, like a collected drink
-- (20260930500400): its name, the bar, the cover and the date it's known by,
-- filled in when collected. If the bar takes the release down or deletes it,
-- the row stays as a memory; its drinks only ever come from the live release.

ALTER TABLE "public"."collected_releases" DROP CONSTRAINT "collected_releases_pkey";
ALTER TABLE "public"."collected_releases" DROP CONSTRAINT "collected_releases_release_id_fkey";
ALTER TABLE "public"."collected_releases"
    ADD COLUMN "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    ALTER COLUMN "release_id" DROP NOT NULL,
    ADD CONSTRAINT "collected_releases_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE SET NULL,
    ADD CONSTRAINT "collected_releases_once" UNIQUE ("user_id", "release_id"),
    ADD COLUMN "name" "text",
    ADD COLUMN "bar_name" "text",
    ADD COLUMN "cover_url" "text",
    ADD COLUMN "release_date" "date";

CREATE FUNCTION "private"."fill_collected_release_memory"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    SELECT r.name, r.cover_url, r.release_date, COALESCE(bp.display_name, b.name)
      INTO NEW.name, NEW.cover_url, NEW.release_date, NEW.bar_name
      FROM public.releases r
      JOIN public.bars b ON b.id = r.bar_id
      LEFT JOIN public.profiles bp ON bp.bar_id = r.bar_id AND bp.is_public
     WHERE r.id = NEW.release_id AND r.published_at <= now() AND r.moderated_at IS NULL
     LIMIT 1;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "fill_collected_release_memory" BEFORE INSERT ON "public"."collected_releases"
    FOR EACH ROW EXECUTE FUNCTION "private"."fill_collected_release_memory"();

REVOKE EXECUTE ON FUNCTION "private"."fill_collected_release_memory"() FROM PUBLIC, "anon", "authenticated";

-- The memory is filled in by the trigger; collectors only add or remove rows.
REVOKE UPDATE ON "public"."collected_releases" FROM "authenticated";
