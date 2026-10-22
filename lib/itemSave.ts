import { supabase } from '@/lib/supabase';

/** The spec-level overrides, read from items: app_item_presentation doesn't carry them. */
export const OVERRIDE_LEVELS = 'override_visibility_level, override_generic_ingredient_level, override_specific_brand_level, override_measurement_level, override_prep_level';

type LevelColumn = 'override_visibility_level' | 'override_generic_ingredient_level' | 'override_specific_brand_level' | 'override_measurement_level' | 'override_prep_level';
export type LevelRow = Partial<Record<LevelColumn, number | null>>;
/** The five level fields as an editor holds them: the level as text ("20"), null when unset. */
export interface LevelFields {
  overrideVisibility: string | null;
  overrideGeneric: string | null;
  overrideSpecific: string | null;
  overrideMeasurement: string | null;
  overridePrep: string | null;
}

const asText = (v: number | null | undefined) => (v == null ? null : String(v));
const asNumber = (v: string | null) => (v ? parseInt(v, 10) : null);

/** An items row's levels as form fields (all null when the row couldn't be read). */
export function levelFields(row: LevelRow | null | undefined): LevelFields {
  return {
    overrideVisibility: asText(row?.override_visibility_level),
    overrideGeneric: asText(row?.override_generic_ingredient_level),
    overrideSpecific: asText(row?.override_specific_brand_level),
    overrideMeasurement: asText(row?.override_measurement_level),
    overridePrep: asText(row?.override_prep_level),
  };
}

/** The form's levels as items columns. */
export function levelColumns(f: LevelFields) {
  return {
    override_visibility_level: asNumber(f.overrideVisibility),
    override_generic_ingredient_level: asNumber(f.overrideGeneric),
    override_specific_brand_level: asNumber(f.overrideSpecific),
    override_measurement_level: asNumber(f.overrideMeasurement),
    override_prep_level: asNumber(f.overridePrep),
  };
}

/**
 * The columns whose value differs from what the form loaded. Save writes only
 * these, so a field the form couldn't load is never written back blank.
 */
export function changedColumns<T extends Record<string, unknown>>(loaded: T, next: T): Partial<T> {
  return Object.fromEntries(Object.entries(next).filter(([key, value]) => value !== loaded[key])) as Partial<T>;
}

/**
 * Saves an item's tags (item_categories) as the form changed them: unlinks
 * only the tags it loaded that are now unticked, and links the newly ticked
 * ones. A tag the form never loaded (added elsewhere since) is left alone.
 */
export async function saveItemTags(itemId: string, loaded: readonly string[], selected: readonly string[]) {
  const toDelete = loaded.filter((c) => !selected.includes(c));
  const toAdd = selected.filter((c) => !loaded.includes(c));
  if (toDelete.length) {
    const { error } = await supabase.from('item_categories').delete().eq('item_id', itemId).in('category_id', toDelete);
    if (error) throw error;
  }
  if (toAdd.length) {
    const rows = toAdd.map((category_id) => ({ item_id: itemId, category_id, is_primary: true }));
    const { error } = await supabase.from('item_categories').upsert(rows, { onConflict: 'item_id,category_id' });
    if (error) throw error;
  }
}
