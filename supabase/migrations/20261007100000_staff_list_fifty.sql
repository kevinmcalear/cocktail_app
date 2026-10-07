-- DRAFT. Local stack only until Kevin's OK.
--
-- The off-menu list becomes the staff list in Library: ranked to 50 (cut lines
-- at 10, 20 and 50), and reordered in one go. The table keeps its name.

ALTER TABLE "public"."bar_off_menu"
    DROP CONSTRAINT "bar_off_menu_rank_range",
    ADD CONSTRAINT "bar_off_menu_rank_range" CHECK ("sort_rank" IS NULL OR "sort_rank" BETWEEN 1 AND 50);

-- The ranked part of the list, in order: ranks 1..n, everything else unranked.
-- Security invoker, so the table's write policy decides who may. Clearing first
-- keeps the unique rank index happy while drinks swap places, and the whole
-- call is one transaction, so a refusal leaves the old order in place.
CREATE FUNCTION "public"."set_staff_list_order"("p_bar_id" "uuid", "p_item_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY INVOKER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_count integer;
BEGIN
    IF NOT ("p_bar_id" IN (SELECT "private"."bars_with_capability"('menus'))) THEN
        RAISE EXCEPTION 'Ordering the staff list opens at Drink Creator.' USING ERRCODE = '42501';
    END IF;
    IF cardinality("p_item_ids") > 50 THEN
        RAISE EXCEPTION 'The staff list ranks up to 50 drinks.';
    END IF;
    IF cardinality("p_item_ids") <> (SELECT count(DISTINCT x) FROM unnest("p_item_ids") AS x) THEN
        RAISE EXCEPTION 'A drink can only be in the staff list once.';
    END IF;

    UPDATE public.bar_off_menu SET sort_rank = NULL WHERE bar_id = "p_bar_id" AND sort_rank IS NOT NULL;
    UPDATE public.bar_off_menu o
       SET sort_rank = t.n
      FROM unnest("p_item_ids") WITH ORDINALITY AS t(item_id, n)
     WHERE o.bar_id = "p_bar_id" AND o.item_id = t.item_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> coalesce(cardinality("p_item_ids"), 0) THEN
        RAISE EXCEPTION 'The staff list changed while you were ordering it. Reload and try again.';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION "public"."set_staff_list_order"("p_bar_id" "uuid", "p_item_ids" "uuid"[]) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."set_staff_list_order"("p_bar_id" "uuid", "p_item_ids" "uuid"[]) TO "authenticated", "service_role";
