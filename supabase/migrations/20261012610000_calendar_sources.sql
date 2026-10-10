-- This week, from a calendar link: a venue pastes the .ics link of the
-- calendar it already keeps (Google Calendar's public address, Luma, iCloud,
-- Outlook) and its events come into This week, checked every few hours.
-- Design: "New event sheet: From a calendar link" on the This week page of
-- https://claude.ai/artifact/KRE17t8L8SC8f4M4KFLgZe.
--
--   calendar_sources   a venue's calendar links. Members who build menus
--                      (the 'menus' capability, as for events) add and
--                      remove them; removing one removes its events.
--   events             gain source_id and external_uid, one row per
--                      occurrence, so a sync updates in place and drops
--                      what the calendar cancelled.
--
-- The sync-calendar edge function reads the feeds (service role) and keeps
-- what the team changed: kind, who sees it, the guest, the menu and the house
-- menu switch are only set when an event first comes in. A cron tick wakes it
-- every three hours, like the flavor worker (two Vault secrets; until they
-- exist, nothing runs).

CREATE TABLE "public"."calendar_sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "bar_id" "uuid" NOT NULL REFERENCES "public"."bars"("id") ON DELETE CASCADE,
    -- webcal:// links are stored as https://.
    "url" "text" NOT NULL CHECK ("url" ~ '^https://[^\s]+$' AND char_length("url") <= 1000),
    -- New events from this calendar start as Everyone, or as Team only.
    "starts_public" boolean DEFAULT false NOT NULL,
    -- Occurrences the team left out when it brought the calendar in.
    "skipped_uids" "text"[] DEFAULT '{}'::"text"[] NOT NULL CHECK (cardinality("skipped_uids") <= 500),
    "last_synced_at" timestamp with time zone,
    "last_error" "text",
    "created_by" "uuid" DEFAULT "auth"."uid"() REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    UNIQUE ("bar_id", "url")
);

CREATE INDEX "calendar_sources_synced_idx" ON "public"."calendar_sources" ("last_synced_at" NULLS FIRST);

ALTER TABLE "public"."calendar_sources" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calendar_sources_select" ON "public"."calendar_sources" FOR SELECT TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."bars_with_capability"('menus')));
CREATE POLICY "calendar_sources_insert" ON "public"."calendar_sources" FOR INSERT TO "authenticated"
    WITH CHECK ("bar_id" IN (SELECT "private"."bars_with_capability"('menus')) AND "created_by" = (SELECT "auth"."uid"()));
CREATE POLICY "calendar_sources_update" ON "public"."calendar_sources" FOR UPDATE TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."bars_with_capability"('menus')))
    WITH CHECK ("bar_id" IN (SELECT "private"."bars_with_capability"('menus')));
CREATE POLICY "calendar_sources_delete" ON "public"."calendar_sources" FOR DELETE TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."bars_with_capability"('menus')));

REVOKE ALL ON "public"."calendar_sources" FROM "anon";
-- The team chooses the link and how its events start; the sync owns the rest.
REVOKE INSERT, UPDATE ON "public"."calendar_sources" FROM "authenticated";
GRANT INSERT ("bar_id", "url", "starts_public", "skipped_uids") ON "public"."calendar_sources" TO "authenticated";
GRANT UPDATE ("starts_public", "skipped_uids") ON "public"."calendar_sources" TO "authenticated";

-- Five calendars a venue is plenty, and keeps the sync's work bounded.
CREATE FUNCTION "private"."limit_calendar_sources"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF (SELECT count(*) FROM public.calendar_sources WHERE bar_id = NEW.bar_id) >= 5 THEN
        RAISE EXCEPTION 'A venue can bring in up to five calendars. Remove one first.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "limit_calendar_sources" BEFORE INSERT ON "public"."calendar_sources"
    FOR EACH ROW EXECUTE FUNCTION "private"."limit_calendar_sources"();

REVOKE EXECUTE ON FUNCTION "private"."limit_calendar_sources"() FROM PUBLIC, "anon", "authenticated";

-- --- Imported events ---

ALTER TABLE "public"."events"
    ADD COLUMN "source_id" "uuid" REFERENCES "public"."calendar_sources"("id") ON DELETE CASCADE,
    -- The calendar's UID plus the occurrence's start.
    ADD COLUMN "external_uid" "text" CHECK (char_length("external_uid") <= 600),
    ADD CONSTRAINT "events_source_uid_key" UNIQUE ("source_id", "external_uid"),
    ADD CONSTRAINT "events_source_check" CHECK (("source_id" IS NULL) = ("external_uid" IS NULL));

CREATE INDEX "events_source_id_idx" ON "public"."events" ("source_id") WHERE "source_id" IS NOT NULL;

-- Only the sync says which calendar an event came from.
CREATE FUNCTION "private"."guard_event_source"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    IF auth.uid() IS NOT NULL AND (
        (TG_OP = 'INSERT' AND (NEW.source_id IS NOT NULL OR NEW.external_uid IS NOT NULL))
        OR (TG_OP = 'UPDATE' AND (NEW.source_id IS DISTINCT FROM OLD.source_id OR NEW.external_uid IS DISTINCT FROM OLD.external_uid))
    ) THEN
        RAISE EXCEPTION 'Events from a calendar come in through its link.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "guard_event_source" BEFORE INSERT OR UPDATE OF "source_id", "external_uid" ON "public"."events"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_event_source"();

REVOKE EXECUTE ON FUNCTION "private"."guard_event_source"() FROM PUBLIC, "anon", "authenticated";

-- --- The cron tick ---

CREATE FUNCTION "private"."wake_calendar_sync"() RETURNS void
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_url text;
    v_secret text;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.calendar_sources) THEN
        RETURN;
    END IF;
    SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'calendar_sync_url';
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'calendar_sync_secret';
    IF v_url IS NULL OR v_secret IS NULL THEN
        RETURN;
    END IF;
    PERFORM net.http_post(
        url := v_url,
        body := '{}'::jsonb,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-calendar-sync-secret', v_secret),
        timeout_milliseconds := 5000
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."wake_calendar_sync"() FROM PUBLIC, "anon", "authenticated";

SELECT cron.schedule('calendar-sync', '7 */3 * * *', 'SELECT private.wake_calendar_sync()');
