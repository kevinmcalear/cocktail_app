-- View-as: optional ceiling on effective role for progressive disclosure previews.
-- LEAST(real membership, view_as) so users can only demote themselves.

CREATE TABLE public.user_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  view_as_role_level int NULL
    CHECK (
      view_as_role_level IS NULL
      OR view_as_role_level IN (10, 20, 30, 35, 40)
    )
);

ALTER TABLE public.user_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own prefs"
  ON public.user_prefs
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_prefs TO authenticated;

CREATE OR REPLACE FUNCTION public.effective_bar_role(real_role int)
RETURNS int
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT LEAST(
    COALESCE(real_role, 10),
    COALESCE(
      (SELECT view_as_role_level FROM public.user_prefs WHERE user_id = auth.uid()),
      COALESCE(real_role, 10)
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.effective_bar_role(int) TO authenticated;

CREATE OR REPLACE VIEW public.app_item_presentation AS
SELECT
    c.id,
    c.name,
    c.item_type,
    c.description,
    c.created_at,
    c.glassware_id,
    c.family_id,
    c.ice_id,
    c.notes,
    c.origin,
    c.price,
    c.status,
    c.brand_maker,
    c.abv,
    c.bar_id,
    c.icon_key,
    c.icon_url,
    c.hide_from_search
FROM public.items c
LEFT JOIN public.bars b ON c.bar_id = b.id
LEFT JOIN public.user_bars ub ON ub.bar_id = c.bar_id AND ub.user_id = auth.uid()
WHERE
    c.bar_id IS NULL
    OR (
      public.effective_bar_role(ub.role_level)
      >= COALESCE(c.override_visibility_level, b.default_visibility_level)
    );

CREATE OR REPLACE VIEW public.app_recipe_presentation AS
SELECT
    r.id,
    r.created_at,
    r.recipe_item_id,

    CASE
        WHEN c.bar_id IS NULL THEN r.ingredient_item_id
        WHEN public.effective_bar_role(ub.role_level)
          >= COALESCE(c.override_specific_brand_level, b.default_specific_brand_level)
        THEN r.ingredient_item_id
        WHEN public.effective_bar_role(ub.role_level)
          >= COALESCE(c.override_generic_ingredient_level, b.default_generic_ingredient_level)
        THEN COALESCE(r.parent_ingredient_id, r.ingredient_item_id)
        ELSE NULL
    END AS display_ingredient_id,

    CASE
        WHEN c.bar_id IS NULL THEN r.amount
        WHEN public.effective_bar_role(ub.role_level)
          >= COALESCE(c.override_measurement_level, b.default_measurement_level)
        THEN r.amount
        ELSE NULL
    END AS amount,

    CASE
        WHEN c.bar_id IS NULL THEN r.unit
        WHEN public.effective_bar_role(ub.role_level)
          >= COALESCE(c.override_measurement_level, b.default_measurement_level)
        THEN r.unit
        ELSE NULL
    END AS unit,

    CASE
        WHEN c.bar_id IS NULL THEN r.preparation_notes
        WHEN public.effective_bar_role(ub.role_level)
          >= COALESCE(c.override_prep_level, b.default_prep_level)
        THEN r.preparation_notes
        ELSE NULL
    END AS preparation_notes,

    r.is_optional,
    r.parent_ingredient_id,
    r.ingredient_item_id,
    r.sort_order

FROM public.recipes r
JOIN public.items c ON r.recipe_item_id = c.id
LEFT JOIN public.bars b ON c.bar_id = b.id
LEFT JOIN public.user_bars ub ON ub.bar_id = c.bar_id AND ub.user_id = auth.uid()
WHERE
    c.bar_id IS NULL
    OR (
      public.effective_bar_role(ub.role_level)
      >= COALESCE(c.override_visibility_level, b.default_visibility_level)
    );
