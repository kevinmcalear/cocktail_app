-- A bar's glass names its maker's page (after 20261012420000). bar_glassware
-- (20261007100000) keeps who makes each glass a bar pours into as free text
-- ("Kimura Glass"); 20261011173000 gave the glass houses maker pages. Now a
-- row can link the page too, so the maker's page lists the bars that pour into
-- its glasses. The text stays: most of the makers bars name (a potter, a
-- one-off edition) have no page.

ALTER TABLE "public"."bar_glassware"
    ADD COLUMN "maker_profile_id" "uuid" REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

COMMENT ON COLUMN "public"."bar_glassware"."maker_profile_id" IS
    'The maker''s page for this glass, when it has one (a maker that makes glassware). maker keeps the name as the bar gives it.';

CREATE INDEX "bar_glassware_maker_profile_id_idx" ON "public"."bar_glassware" ("maker_profile_id")
    WHERE "maker_profile_id" IS NOT NULL;

-- Only a maker's page that says it makes glassware.
CREATE FUNCTION "private"."guard_bar_glassware_maker"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.maker_profile_id IS NULL THEN RETURN NEW; END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
         WHERE id = NEW.maker_profile_id AND kind = 'maker' AND 'glassware' = ANY (makes)
    ) THEN
        RAISE EXCEPTION 'A glass''s maker must be a maker''s page that makes glassware.' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION "private"."guard_bar_glassware_maker"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "guard_maker" BEFORE INSERT OR UPDATE OF "maker_profile_id" ON "public"."bar_glassware"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_bar_glassware_maker"();

-- The glasses bars already name by a maker that now has a page (BOBO, Nude,
-- Kimura Glass on production): matched by name, ignoring case and accents.
UPDATE "public"."bar_glassware" g SET "maker_profile_id" = p.id
  FROM "public"."profiles" p
 WHERE g.maker_profile_id IS NULL AND g.maker IS NOT NULL
   AND p.kind = 'maker' AND 'glassware' = ANY (p.makes)
   AND public.ingredient_key(p.display_name) = public.ingredient_key(g.maker);
