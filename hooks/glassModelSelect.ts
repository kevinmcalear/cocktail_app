/** The columns a glass_models read selects (GlassModel in hooks/useGlassModels.ts), with its maker's page. */
export const GLASS_MODEL_SELECT =
  'id, maker_profile_id, shape_item_id, glass, variant, name, series, designer, model_code, capacity_ml, height_mm, rim_mm, material, product_url, outline, maker:profiles!glass_models_maker_profile_id_fkey(handle, display_name)';
