-- Venue feature switches. Local stack only until Kevin's OK.
--
-- A venue's first release is Discover, Library and Menus (13 Oct). Everything
-- else (Tonight and This week, Prep, Study, Back bar, History, Flavor map,
-- Techniques, the extra Library filters) is off until the venue's Admin
-- switches it on in Venue settings. Home mode is not affected.
--
--   * bars.enabled_features: the extras switched on, by key. Empty by default,
--     so every venue, new or existing, starts with only the three.
--   * The CHECK keeps it to the keys the app knows (lib/venueFeatures.ts).
--     A new switch adds its key here and there.
--   * No new policy: members read bars under bars_select, and only Admins
--     (role level 40) update them under bars_update, so only an Admin can
--     change the switches and the whole team sees them.

ALTER TABLE "public"."bars" ADD COLUMN "enabled_features" "text"[] DEFAULT '{}'::"text"[] NOT NULL;

ALTER TABLE "public"."bars" ADD CONSTRAINT "bars_enabled_features_known" CHECK (
    "enabled_features" <@ ARRAY['tonight', 'prep', 'study', 'backBar', 'history', 'flavorMap', 'techniques', 'libraryExtras']::"text"[]
);

COMMENT ON COLUMN "public"."bars"."enabled_features" IS 'Extras the venue''s Admin switched on (lib/venueFeatures.ts). Empty: Discover, Library and Menus only.';
