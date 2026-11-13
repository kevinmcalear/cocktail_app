import type { QueryClient } from '@tanstack/react-query';

import type { MenuLayoutWrite } from '@/hooks/barWrites';
import { isKeptWrite, type AnyWrite } from '@/lib/keptWrites';
import { addDrink, savePayload } from '@/lib/menuLayout';
import { MENU_LAYOUT } from '@/lib/offlineWrites';
import { supabase } from '@/lib/supabase';
import type { MenuDrink } from '@/types/menus';

const NOT_ON = 'It isn’t on the menu yet: add it from the menu.';

/**
 * A drink made with "Create a new drink" in a menu section while there was no
 * signal: no editor is waiting for it by the time its save lands, so it goes
 * in that section here, in the same replay (lib/react-query.ts, before the
 * next waiting write). A layout of that menu still waiting behind it gets the
 * drink, so sending that layout keeps it; with none, it's added to the section
 * itself. Once either way. Returns a warning when it couldn't be put there.
 */
export async function placeInSection(qc: QueryClient, sectionId: string, drink: { id: string; name: string }): Promise<string | null> {
  for (const write of qc.getMutationCache().findAll({ mutationKey: MENU_LAYOUT })) {
    const v = write.state.variables as MenuLayoutWrite | undefined;
    if (!write.state.isPaused || !isKeptWrite(write as AnyWrite) || !v?.layout.sections.some((s) => s.key === sectionId)) continue;
    if (v.layout.sections.some((s) => s.drinks.some((d) => d.id === drink.id))) return null;
    const row: MenuDrink = { id: drink.id, name: drink.name, kind: 'cocktail', line: '', price: null, imageUrl: null, isSketch: true, glass: null };
    const next = addDrink(v.layout, sectionId, row);
    if (!next.sections.some((s) => s.drinks.some((d) => d.id === drink.id))) return NOT_ON;
    // In place: the waiting write sends this same object (after a relaunch too, once the row is saved again).
    Object.assign(v, { layout: next, args: { ...v.args, p_sections: savePayload(next) } });
    return null;
  }
  const { data: section, error } = await supabase.from('menu_sections').select('menu_id').eq('id', sectionId).maybeSingle();
  if (error || !section) return NOT_ON;
  const { data: last } = await supabase
    .from('menu_drinks')
    .select('sort_order')
    .eq('menu_section_id', sectionId)
    .is('off_at', null)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error: added } = await supabase.from('menu_drinks').insert({ menu_id: section.menu_id, menu_section_id: sectionId, item_id: drink.id, sort_order: (last?.sort_order ?? -1) + 1 });
  // Already on it (an editor that was open put it there): that's the one.
  return added && added.code !== '23505' ? NOT_ON : null;
}
