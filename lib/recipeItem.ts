import type { WizardLine } from '@/lib/drinkWizard';

/** What a line typed or made while editing carries until it saves: a recipe made in-house, one to write later, a new bottle (as in New). */
type Making = Partial<Pick<WizardLine, 'prep' | 'technique' | 'later' | 'bottle' | 'named' | 'combined' | 'batch'>>;

/** One line of a recipe while it is being edited (drink editor and prep pages). */
export interface SortableRecipeItem extends Making {
  id?: string;
  /** '' for a line typed or made while editing, until it saves (hooks/specLineSave). */
  ingredient_id: string;
  name: string;
  amount: string;
  unit: string;
  preparation_notes?: string;
  is_optional?: boolean;
  is_float?: boolean;
  /** Its place while editing, so the row keeps its key; a saved line goes by its row id until it has one. */
  key?: string;
}

/** A line as the making flow's list edits it (IngredientsStep), keeping the saved row. */
export type EditLine = WizardLine & { rowId?: string };

/** The editors' rows as the making flow's lines. */
export function toLine(item: SortableRecipeItem, index: number): EditLine {
  const { id, ingredient_id, preparation_notes, is_optional, is_float, key, ...rest } = item;
  return { ...rest, key: key ?? id ?? `${ingredient_id}-${index}`, id: ingredient_id || null, note: preparation_notes || undefined, rowId: id, optional: is_optional, float: is_float };
}

/** And back. */
export function fromLine(line: EditLine): SortableRecipeItem {
  const { key, id, note, rowId, optional, float, ...rest } = line;
  return { ...rest, key, id: rowId, ingredient_id: id ?? '', preparation_notes: note ?? '', is_optional: optional ?? false, is_float: float ?? false };
}
