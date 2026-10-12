-- Bring in batches: one row per bring-in, so "Brought in" can list what it
-- made, Bring in can show "Last time", and "Undo all" can take it all back
-- until tomorrow. Local stack only until Kevin's OK.
--
-- A batch only records ids. Undo runs as the caller (SECURITY INVOKER), so it
-- can only delete what the caller could delete anyway: the items and menu go
-- through their own RLS (private.can_write), the shelf rows through
-- home_bar_items_own. A batch naming someone else's items removes nothing.

CREATE TABLE "public"."bring_in_batches" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users ("id") ON DELETE CASCADE,
    -- The venue it came into; null for your home bar.
    "bar_id" uuid REFERENCES "public"."bars" ("id") ON DELETE CASCADE,
    -- What it came from, as Brought in says it: "2 menu photos", "a link".
    "source" text NOT NULL CHECK (char_length("source") BETWEEN 1 AND 80),
    -- What it was, for "Last time": "Spring menu", "Orchard Fizz", "8 bottles".
    "title" text NOT NULL CHECK (char_length("title") BETWEEN 1 AND 120),
    "menu_id" uuid REFERENCES "public"."menus" ("id") ON DELETE SET NULL,
    -- Drinks, preps and ingredients it made.
    "item_ids" uuid[] NOT NULL DEFAULT '{}' CHECK (cardinality("item_ids") <= 500),
    -- Catalog bottles it put on your home shelf.
    "shelf_ids" uuid[] NOT NULL DEFAULT '{}' CHECK (cardinality("shelf_ids") <= 200),
    -- Prices it set on drinks you had: [{"id": uuid, "price": text}], put back only while unchanged.
    "prices" jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof("prices") = 'array' AND jsonb_array_length("prices") <= 500),
    -- The counts Brought in shows (drinks new and already yours, preps, ingredients, what's still blank).
    "summary" jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof("summary") = 'object' AND pg_column_size("summary") <= 16384),
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "undone_at" timestamptz
);

CREATE INDEX "bring_in_batches_user_recent" ON "public"."bring_in_batches" ("user_id", "created_at" DESC);

ALTER TABLE "public"."bring_in_batches" ENABLE ROW LEVEL SECURITY;

-- Yours only. No update or delete policy: undo_bring_in marks a batch undone.
CREATE POLICY "bring_in_batches_select_own" ON "public"."bring_in_batches" FOR SELECT TO "authenticated"
    USING ("user_id" = auth.uid());
CREATE POLICY "bring_in_batches_insert_own" ON "public"."bring_in_batches" FOR INSERT TO "authenticated"
    WITH CHECK ("user_id" = auth.uid() AND "undone_at" IS NULL);

GRANT SELECT, INSERT ON "public"."bring_in_batches" TO "authenticated";

-- Marking a batch undone is the function's job; nobody updates the row directly.
CREATE OR REPLACE FUNCTION "private"."mark_bring_in_undone"("p_batch" uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
    UPDATE public.bring_in_batches SET undone_at = now()
    WHERE id = p_batch AND user_id = auth.uid() AND undone_at IS NULL;
$$;
REVOKE ALL ON FUNCTION "private"."mark_bring_in_undone"(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "private"."mark_bring_in_undone"(uuid) TO "authenticated";

-- ponytail: "until tomorrow" is 24 hours from the bring-in, not the end of the
-- caller's next day (the server doesn't know their time zone). Upgrade: pass
-- the caller's zone and end the window at their midnight after next.
CREATE OR REPLACE FUNCTION "public"."undo_bring_in"("p_batch" uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
    b public.bring_in_batches;
    removed int := 0;
    kept int := 0;
    one uuid;
    p jsonb;
BEGIN
    SELECT * INTO b FROM public.bring_in_batches WHERE id = p_batch AND user_id = auth.uid();
    IF NOT FOUND THEN RAISE EXCEPTION 'That bring-in isn''t yours to undo.' USING ERRCODE = '42501'; END IF;
    IF b.undone_at IS NOT NULL THEN RAISE EXCEPTION 'That bring-in is already undone.' USING ERRCODE = '22023'; END IF;
    IF b.created_at < now() - interval '24 hours' THEN RAISE EXCEPTION 'Too late to undo that bring-in in one go.' USING ERRCODE = '22023'; END IF;

    IF b.menu_id IS NOT NULL THEN
        DELETE FROM public.menus WHERE id = b.menu_id;
    END IF;

    FOR p IN SELECT * FROM jsonb_array_elements(b.prices) LOOP
        UPDATE public.items SET price = NULL
        WHERE id = (p ->> 'id')::uuid AND public.items.price::text IS NOT DISTINCT FROM (p ->> 'price');
    END LOOP;

    IF cardinality(b.shelf_ids) > 0 THEN
        DELETE FROM public.home_bar_items WHERE user_id = auth.uid() AND item_id = ANY (b.shelf_ids);
    END IF;

    -- Drinks before the ingredients they use. Deleting an item cascades through
    -- spec lines and menus, so anything used since by a drink or a menu outside
    -- this bring-in stays (it would take that drink's line or menu spot with it).
    FOR one IN
        SELECT i.id FROM public.items i WHERE i.id = ANY (b.item_ids)
        ORDER BY (i.item_type = 'cocktail') DESC, i.created_at DESC
    LOOP
        IF EXISTS (SELECT 1 FROM public.recipes r WHERE r.ingredient_item_id = one AND NOT (r.recipe_item_id = ANY (b.item_ids)))
           OR EXISTS (SELECT 1 FROM public.menu_drinks m WHERE m.item_id = one) THEN
            kept := kept + 1;
            CONTINUE;
        END IF;
        BEGIN
            DELETE FROM public.items WHERE id = one;
            IF FOUND THEN removed := removed + 1; ELSE kept := kept + 1; END IF;
        EXCEPTION WHEN foreign_key_violation OR restrict_violation THEN
            kept := kept + 1;
        END;
    END LOOP;

    PERFORM private.mark_bring_in_undone(p_batch);
    RETURN jsonb_build_object('removed', removed, 'kept', kept);
END;
$$;
REVOKE ALL ON FUNCTION "public"."undo_bring_in"(uuid) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."undo_bring_in"(uuid) TO "authenticated";
