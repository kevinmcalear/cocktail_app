-- Advanced options: a venue switch for the details most bars don't keep.
--
-- Simple by default (jam decision dec-24, 29 Oct 2026). Wash lines on
-- glasses (and Fit it, which scales a spec to one), and Ice and Tools in
-- venue setup, only show for venues whose Admin switches Advanced options
-- on in Features (lib/venueFeatures.ts). Off for every venue to start.
--
--   * bars_enabled_features_known now allows 'advanced' too. Nothing else
--     changes: the column, its default, bars_update (Admins only) and the
--     venue_feature_events trigger are as 20261016800000 and 20261027100000
--     left them.

ALTER TABLE "public"."bars" DROP CONSTRAINT "bars_enabled_features_known";

ALTER TABLE "public"."bars" ADD CONSTRAINT "bars_enabled_features_known" CHECK (
    "enabled_features" <@ ARRAY['tonight', 'prep', 'study', 'backBar', 'history', 'flavorMap', 'techniques', 'libraryExtras', 'advanced']::"text"[]
);
