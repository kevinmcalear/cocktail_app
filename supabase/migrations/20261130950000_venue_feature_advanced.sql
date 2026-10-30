-- Advanced options: a venue switch for the details most bars don't keep.
--
-- Simple by default (jam decision dec-24, 29 Oct 2026). Wash lines on
-- glasses (and Fit it, which scales a spec to one), and Ice and Tools in
-- venue setup, only show for venues whose Admin switches Advanced options
-- on in Features (lib/venueFeatures.ts). Off to start, except for venues
-- that already keep those details (the backfill at the end).
--
--   * bars_enabled_features_known now allows 'advanced' too. Nothing else
--     changes: the column, its default, bars_update (Admins only) and the
--     venue_feature_events trigger are as 20261016800000 and 20261027100000
--     left them.

ALTER TABLE "public"."bars" DROP CONSTRAINT "bars_enabled_features_known";

ALTER TABLE "public"."bars" ADD CONSTRAINT "bars_enabled_features_known" CHECK (
    "enabled_features" <@ ARRAY['tonight', 'prep', 'study', 'backBar', 'history', 'flavorMap', 'techniques', 'libraryExtras', 'advanced']::"text"[]
);

-- --- Venues that already keep these details keep seeing them ---
--
-- A venue with a wash line on any of its glasses, ice from its own machine,
-- or tools in its Kit gets 'advanced' switched on, beside whatever else it
-- has. Idempotent: a venue that has it already is left alone. The feature
-- events trigger is off for this one update, so nobody's Library says an
-- Admin just switched it on.

ALTER TABLE "public"."bars" DISABLE TRIGGER "bars_record_feature_events";

-- allow-anon-write: a one-off backfill run by the migration, not a client grant.
UPDATE "public"."bars" AS b
SET "enabled_features" = b."enabled_features" || ARRAY['advanced']::"text"[]
WHERE NOT ('advanced' = ANY (b."enabled_features"))
  AND (
    EXISTS (
        SELECT 1 FROM "public"."bar_glassware" g
        JOIN "public"."profiles" p ON p."id" = g."profile_id"
        WHERE p."bar_id" = b."id" AND g."wash_line_ml" IS NOT NULL
    )
    OR EXISTS (SELECT 1 FROM "public"."item_ice" i WHERE i."bar_id" = b."id" AND i."source" = 'machine')
    OR EXISTS (SELECT 1 FROM "public"."bar_kit" k WHERE k."bar_id" = b."id" AND k."kind" = 'tool')
  );

ALTER TABLE "public"."bars" ENABLE TRIGGER "bars_record_feature_events";
