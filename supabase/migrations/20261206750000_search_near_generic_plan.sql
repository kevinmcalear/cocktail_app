-- public.search_near plans its query once per connection instead of on every
-- call (Mat, 4 Nov: a bottle search was slow to say "Did you mean", or that
-- nothing is called that).
--
--   * Postgres planned the function's one big query (RLS on items and
--     profiles in every branch) afresh each call: its guess for a plan that
--     fits any input stayed dearer than a fresh one, so it never kept one.
--     Planning cost about 70 ms a call, the query itself about 20 ms.
--   * plan_cache_mode = force_generic_plan keeps the first plan for the
--     connection. On the local stack, ingredient close names went from about
--     90 ms a call to about 20 ms; drink, bar and people searches stay as they
--     were (about 55 to 85 ms), and every search returns the same rows.
--   * Same signature, grants and body, so the app's types don't change.

ALTER FUNCTION "public"."search_near"("text", "text"[], double precision, double precision, double precision, "text", "text", integer)
    SET "plan_cache_mode" TO 'force_generic_plan';
