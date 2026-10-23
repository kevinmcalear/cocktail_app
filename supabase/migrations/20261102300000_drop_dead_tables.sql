-- Tables and functions nothing uses, and a nightly sweep of old drafts
-- (database audit, 22 Oct, 1.1, 1.2, 1.5 and 3.4).
--
-- 1. attributes, category_attributes, item_attributes and substitutions came
--    in with the baseline and were never used: empty in production on
--    22 Oct, and no code, edge function, script, view, function, policy,
--    trigger or cron job names them. attribute_type_enum goes with
--    attributes, its only user. The drops have no CASCADE, so they fail
--    loudly if anything has come to depend on them since.
-- 2. private.retired_drink_sketches held the links to the AI drink sketches
--    that drawn sketches replaced on 7 Oct (20261007230000), so that swap
--    could be undone. Drawn sketches have stayed; nothing reads the table.
--    The 190 images rows it pointed at, and their files in the drinks
--    bucket, are left alone here (the PR lists them for a later clean-up).
-- 3. assign_item_to_bar, flavor_for_you and get_my_bars have no caller: not
--    the app, edge functions, scripts, cron, other functions or policies.
--    Dropping them shrinks what a signed-in person can call. Two stay:
--    merge_ingredients, an admin tool run by hand, and confirm_item_photos,
--    which nothing calls yet but is how an editor clears "May be out of
--    date" on a photo, as the Photos screen promises.
-- 4. Drafts nobody has saved for 60 days are deleted every night at 03:53
--    UTC. Saving a draft now stamps updated_at with the server's clock (the
--    app sent the phone's, so a phone set weeks behind could have its draft
--    swept the night it was saved). Like purge-cron-history, the job is a
--    single statement; cron.schedule replaces a job of the same name, so
--    running this again is safe.

-- --- Old tables ---

DROP TABLE "public"."category_attributes";
DROP TABLE "public"."item_attributes";
DROP TABLE "public"."attributes";
DROP TABLE "public"."substitutions";
DROP TYPE "public"."attribute_type_enum";

DROP TABLE "private"."retired_drink_sketches";

-- --- Functions with no caller ---

DROP FUNCTION "public"."assign_item_to_bar"("uuid", "uuid");
DROP FUNCTION "public"."flavor_for_you"("jsonb", integer);
DROP FUNCTION "public"."get_my_bars"();

-- --- Old drafts ---

CREATE TRIGGER "drafts_updated_at" BEFORE INSERT OR UPDATE ON "public"."drafts"
    FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();

SELECT cron.schedule('sweep-old-drafts', '53 3 * * *', $$DELETE FROM public.drafts WHERE updated_at < now() - interval '60 days'$$);
