-- A second lock behind the access rules (database audit, 22 Oct, 4.1 and 4.2).
--
-- 1. Signed-out visitors (the anon role) lose INSERT, UPDATE and DELETE on
--    every table and view in public, and tables made by later migrations no
--    longer grant them either. Until now Supabase's default grants gave anon
--    those privileges and row-level security was the only thing refusing the
--    writes, so one mistaken policy would have let anyone write. TRUNCATE,
--    TRIGGER and REFERENCES went in 20261008750000; they are revoked again
--    here so this file states the whole rule.
--
--    SELECT stays: signed-out pages read published drinks, bar pages, shared
--    menus, releases and venue branding through it, and RLS still decides
--    which rows.
--
--    Nothing signed out writes to a table today, so nothing needs a carve-out:
--      * no INSERT, UPDATE or DELETE policy in public is open to anon or
--        PUBLIC (checked in production on 22 Oct);
--      * no public function anon can call writes anything: the age gate,
--        rankings, claims and rate limits are for signed-in people only, and
--        the six SECURITY INVOKER functions anon can call only read (and a
--        SECURITY DEFINER one would write as its owner anyway);
--      * the edge functions that use the anon key (requireUser,
--        send-bar-invite, venue-app) either act as a signed-in user, call
--        GoTrue, or call get_venue_branding, a read;
--      * sign-in goes through GoTrue (the auth schema), not these tables.
--    authenticated keeps its grants: signed-in writes still depend on RLS.
--
-- 2. Row-level security goes on for the five private tables that had it
--    off: discover_dirty, discover_spirit_rules, discover_style_rules,
--    profile_hidden_places and profile_merges. The private schema grants
--    them to nobody, so this changes nothing for the app. The functions that
--    use them (discover_mark, run_discover_dirty, refresh_discover_facts,
--    hide_profile_city, my_hidden_city, merge_person_profile) are SECURITY
--    DEFINER and owned by postgres, which owns the tables and is not forced
--    through RLS, so they read and write as before; so do the cron jobs.

-- --- Signed-out writes ---

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA "public" FROM "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM "anon";

-- --- Private tables ---

ALTER TABLE "private"."discover_dirty" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "private"."discover_spirit_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "private"."discover_style_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "private"."profile_hidden_places" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "private"."profile_merges" ENABLE ROW LEVEL SECURITY;
