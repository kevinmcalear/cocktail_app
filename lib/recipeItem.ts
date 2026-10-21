/** One line of a recipe while it is being edited (drink editor and prep pages). */
export interface SortableRecipeItem {
  id?: string;
  ingredient_id: string;
  name: string;
  amount: string;
  unit: string;
  preparation_notes?: string;
  is_optional?: boolean;
}
