-- DRAFT. Local stack only until Kevin's OK.
--
-- Off-menu classics: drinks a bar can make that aren't on the printed menu,
-- and which of them to recommend first. One list. sort_rank 1–10 is the top
-- 10; 1–40 is the top 40; NULL means they can make it but it isn't in the
-- shortlist. A patron sees a name only (the classic, or the bar's own name
-- when that drink is published). The spec stays private.

CREATE TABLE "public"."bar_off_menu" (
    "bar_id" "uuid" NOT NULL REFERENCES "public"."bars"("id") ON DELETE CASCADE,
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "sort_rank" smallint,
    CONSTRAINT "bar_off_menu_pkey" PRIMARY KEY ("bar_id", "item_id"),
    CONSTRAINT "bar_off_menu_rank_range" CHECK ("sort_rank" IS NULL OR "sort_rank" BETWEEN 1 AND 40)
);

CREATE UNIQUE INDEX "bar_off_menu_rank_key" ON "public"."bar_off_menu" ("bar_id", "sort_rank") WHERE "sort_rank" IS NOT NULL;

-- This bar's cocktail, or a shared catalog classic, and a classic or a riff of one.
CREATE FUNCTION "private"."guard_bar_off_menu"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.items i
        WHERE i.id = NEW.item_id
          AND i.item_type = 'cocktail'
          AND (i.bar_id = NEW.bar_id OR i.is_catalog)
          AND (i.is_catalog OR i.riff_of_id IS NOT NULL)
    ) THEN
        RAISE EXCEPTION 'An off-menu pick is this bar''s riff on a classic, or a catalog classic.';
    END IF;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."guard_bar_off_menu"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "guard_bar_off_menu"
    BEFORE INSERT OR UPDATE OF "item_id", "bar_id" ON "public"."bar_off_menu"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_bar_off_menu"();

ALTER TABLE "public"."bar_off_menu" ENABLE ROW LEVEL SECURITY;

-- The floor can read the list. Building it is the same permission as building a menu.
CREATE POLICY "bar_off_menu_select" ON "public"."bar_off_menu" FOR SELECT TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."bars_with_capability"('menu')));
CREATE POLICY "bar_off_menu_write" ON "public"."bar_off_menu" FOR ALL TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."bars_with_capability"('menus')))
    WITH CHECK ("bar_id" IN (SELECT "private"."bars_with_capability"('menus')));

REVOKE ALL ON TABLE "public"."bar_off_menu" FROM PUBLIC, "anon";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."bar_off_menu" TO "authenticated";
GRANT ALL ON TABLE "public"."bar_off_menu" TO "service_role";

-- What a patron may see. Security definer, so it can read the list without
-- opening the table, and it must not return a private drink's name or id.
-- Empty unless the bar has a public profile.
CREATE FUNCTION "public"."get_bar_classics"("p_bar_id" "uuid")
RETURNS TABLE (
    "sort_rank" smallint,
    "ask_name" "text",
    "classic_name" "text",
    "open_id" "uuid"
)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.bar_id = p_bar_id AND p.kind = 'bar' AND p.is_public AND p.moderated_at IS NULL
    ) THEN
        RETURN;
    END IF;

    -- Subquery columns are named away from the OUT params. Those names are
    -- variables in this function, and an unqualified match would read the
    -- variable instead of the column.
    RETURN QUERY
    SELECT s.sort_rank, s.shown_name, s.shown_classic, s.shown_open
    FROM (
        SELECT
            o.sort_rank,
            CASE
                WHEN i.is_catalog AND i.moderated_at IS NULL THEN i.name
                WHEN i.bar_id IS NOT NULL AND i.publish_mode <> 'private' AND i.moderated_at IS NULL THEN i.name
                WHEN c.id IS NOT NULL AND c.moderated_at IS NULL THEN c.name
                ELSE NULL
            END AS shown_name,
            CASE
                WHEN i.is_catalog AND i.moderated_at IS NULL THEN i.name
                WHEN c.id IS NOT NULL AND c.moderated_at IS NULL THEN c.name
                ELSE NULL
            END AS shown_classic,
            CASE
                WHEN i.bar_id IS NOT NULL AND i.publish_mode <> 'private' AND i.moderated_at IS NULL THEN i.id
                ELSE NULL
            END AS shown_open
        FROM public.bar_off_menu o
        JOIN public.items i ON i.id = o.item_id
        LEFT JOIN public.items c ON c.id = i.riff_of_id
        WHERE o.bar_id = p_bar_id
    ) s
    WHERE s.shown_name IS NOT NULL
    ORDER BY s.sort_rank NULLS LAST, s.shown_name;
END;
$$;

REVOKE ALL ON FUNCTION "public"."get_bar_classics"("p_bar_id" "uuid") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."get_bar_classics"("p_bar_id" "uuid") TO "anon", "authenticated", "service_role";
