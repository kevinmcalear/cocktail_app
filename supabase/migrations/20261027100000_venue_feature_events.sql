-- Who switched a venue feature on or off, and when. Local stack only until Kevin's OK.
--
-- "New at <venue>" (whole-app canvas, Onboarding, "Staff: something new at
-- the venue", approved 15 Oct 2026): when a venue's Admin switches a feature
-- on in Venue settings, everyone else at the venue sees one quiet line at the
-- top of the Library, and a dot on the new tab until they open it.
--
--   * venue_feature_events: one row per switch that changed, written by a
--     trigger on bars when enabled_features changes. The app's save path
--     (hooks/useVenueFeatures.ts useSetVenueFeature) stays as it is, and
--     nobody can write a row by hand, so who turned what on can't be faked.
--   * by_user is whoever made the change (auth.uid()); null when it wasn't a
--     signed-in person (a script with the service role), or when that
--     person's account is deleted.
--   * The venue's members read its rows (private.my_bar_ids(0), as
--     bars_select does). Nobody else reads them, and no client writes them.
--   * Starts empty: switches made before this ships make no news.

CREATE TABLE "public"."venue_feature_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "bar_id" "uuid" NOT NULL REFERENCES "public"."bars"("id") ON DELETE CASCADE,
    "feature" "text" NOT NULL,
    "enabled" boolean NOT NULL,
    "by_user" "uuid" REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "at" timestamp with time zone DEFAULT "now"() NOT NULL
);

COMMENT ON TABLE "public"."venue_feature_events" IS 'Each venue feature switched on or off (bars.enabled_features), by whom and when. Written by a trigger on bars; members read, nobody writes.';

CREATE INDEX "venue_feature_events_bar_at_idx" ON "public"."venue_feature_events" ("bar_id", "at" DESC);

ALTER TABLE "public"."venue_feature_events" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "venue_feature_events_select" ON "public"."venue_feature_events" FOR SELECT TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."my_bar_ids"(0)));

REVOKE ALL ON "public"."venue_feature_events" FROM "anon";
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON "public"."venue_feature_events" FROM "authenticated";
GRANT SELECT ON "public"."venue_feature_events" TO "authenticated";
GRANT ALL ON "public"."venue_feature_events" TO "service_role";

-- --- The trigger ---

-- One row for each key that was added (enabled) or taken away (not enabled).
-- SECURITY DEFINER: the person saving can't insert into the table themselves.
CREATE FUNCTION "private"."record_venue_feature_events"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    INSERT INTO public.venue_feature_events (bar_id, feature, enabled, by_user)
    SELECT NEW.id, k, true, auth.uid()
    FROM unnest(NEW.enabled_features) AS k
    WHERE NOT k = ANY (OLD.enabled_features)
    UNION ALL
    SELECT NEW.id, k, false, auth.uid()
    FROM unnest(OLD.enabled_features) AS k
    WHERE NOT k = ANY (NEW.enabled_features);
    RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."record_venue_feature_events"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "bars_record_feature_events" AFTER UPDATE OF "enabled_features" ON "public"."bars"
    FOR EACH ROW WHEN (NEW.enabled_features IS DISTINCT FROM OLD.enabled_features)
    EXECUTE FUNCTION "private"."record_venue_feature_events"();
