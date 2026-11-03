// A bar's published drinks for a menu edition, with their ingredients by name.
// Split out of hooks/useMenuRuns.ts and loaded on first use: useProfiles
// re-exports that file onto every page's first load (B13).
import { publishedMenuDrink } from '@/hooks/useMenus';
import { fetchPublished } from '@/hooks/usePublished';
import { ingredientsLine, type IngredientName } from '@/lib/publicDrink';
import { supabase } from '@/lib/supabase';
import type { MenuDrink } from '@/types/menus';

/** The published drinks among `ids`, each line its ingredients by name (never amounts), else its description. */
export async function publishedMenuDrinks(ids: string[]): Promise<MenuDrink[]> {
  const [published, names] = await Promise.all([fetchPublished(ids), supabase.rpc('public_drink_ingredients', { p_item_ids: ids })]);
  if (names.error) throw names.error;
  const lines: Record<string, IngredientName[]> = {};
  for (const n of (names.data ?? []) as (IngredientName & { item_id: string })[]) (lines[n.item_id] ??= []).push({ name: n.name, brand: n.brand });
  const open = published.map(publishedMenuDrink).filter((d): d is MenuDrink => !!d);
  return open.map((d) => ({ ...d, line: ingredientsLine(lines[d.id] ?? []) ?? d.line }));
}
