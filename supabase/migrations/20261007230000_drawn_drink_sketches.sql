-- Drinks are drawn, never AI-generated.
--
-- The app draws every drink with no photo from its spec (item_sketches and
-- components/ds/DrawnSketch), so the image-worker's paid AI hero sketch is no
-- longer wanted for cocktails, and it hid the drawing wherever it existed:
--   * reconcile_item_images still stamps and flags a drink's photos against its
--     spec, but never asks the worker for a cocktail sketch. Ingredients, beer
--     and wine keep their automatic sketches;
--   * the AI sketches drinks already have are unlinked, so their drawings show.
--     The links are kept in private.retired_drink_sketches, and the images rows
--     and files are left alone, so this can be undone.
-- The Generate button for drinks is gone from the app, and the
-- generate-cocktail-image function is removed from the repo (undeploy it by hand).

-- As 20260925200000_auto_item_images.sql, with the cocktail exception at the end.
CREATE OR REPLACE FUNCTION "private"."reconcile_item_images"("p_item_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_fingerprint text := private.item_spec_fingerprint(p_item_id);
BEGIN
    IF v_fingerprint IS NULL THEN
        RETURN false;
    END IF;

    UPDATE public.item_images SET spec_fingerprint = v_fingerprint
    WHERE item_id = p_item_id AND NOT is_generated AND spec_fingerprint IS NULL;

    UPDATE public.item_images SET outdated_since = now()
    WHERE item_id = p_item_id AND spec_fingerprint <> v_fingerprint AND outdated_since IS NULL;

    UPDATE public.item_images SET outdated_since = NULL
    WHERE item_id = p_item_id AND spec_fingerprint = v_fingerprint AND outdated_since IS NOT NULL;

    -- Drinks are drawn in the app from their spec.
    IF EXISTS (SELECT 1 FROM public.items WHERE id = p_item_id AND item_type = 'cocktail') THEN
        RETURN false;
    END IF;

    RETURN NOT EXISTS (
        SELECT 1 FROM public.item_images
        WHERE item_id = p_item_id AND angle = 'hero'
          AND (NOT is_generated OR spec_fingerprint = v_fingerprint)
    );
END;
$$;

-- Jobs already waiting for the worker.
DELETE FROM private.item_image_jobs j
USING public.items i
WHERE i.id = j.item_id AND i.item_type = 'cocktail' AND j.status IN ('pending', 'ready', 'failed');

CREATE TABLE "private"."retired_drink_sketches" (
    "item_image_id" "uuid" PRIMARY KEY,
    "item_id" "uuid",
    "image_id" "uuid",
    "angle" "public"."image_angle" NOT NULL,
    "sort_order" numeric,
    "spec_fingerprint" "text",
    "linked_at" timestamp with time zone NOT NULL,
    "retired_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
ALTER TABLE "private"."retired_drink_sketches" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "private"."retired_drink_sketches" FROM PUBLIC, "anon", "authenticated";

-- The worker's own writes don't re-queue the drinks.
SELECT set_config('app.image_worker', 'on', true);

WITH gone AS (
    DELETE FROM public.item_images ii
    USING public.items i
    WHERE i.id = ii.item_id AND i.item_type = 'cocktail' AND ii.is_generated
    RETURNING ii.id, ii.item_id, ii.image_id, ii.angle, ii.sort_order, ii.spec_fingerprint, ii.created_at
)
INSERT INTO private.retired_drink_sketches (item_image_id, item_id, image_id, angle, sort_order, spec_fingerprint, linked_at)
SELECT id, item_id, image_id, angle, sort_order, spec_fingerprint, created_at FROM gone;

SELECT set_config('app.image_worker', 'off', true);
