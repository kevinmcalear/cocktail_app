import { useQuery } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { useDebounced } from '@/hooks/useDiscover';
import { MENU_DRINK_COLUMNS, toMenuDrink, type MenuItemRow } from '@/hooks/useMenus';
import { ingredientLine, readingName, sentenceLine } from '@/lib/menus';
import { nameKey, nameLike, sameName } from '@/lib/sameName';
import { supabase } from '@/lib/supabase';

/** The drink a bar already has by a name. Plain JSON. */
export interface SameNameDrink {
  id: string;
  name: string;
  /** The venue it's kept at (items.bar_id), for who may edit it. */
  barId: string | null;
  /** "Gin, Campari, sweet vermouth". */
  line: string;
  /** A menu it's on, tonight's first ("Autumn menu"), when you can see the bar's menus. */
  menu: string | null;
  imageUrl: string | null;
  glass: string | null;
  /** The classic it's a version of (riff_of_id, when that's a catalog drink). */
  classic: { id: string; name: string } | null;
  /** Its spec lines, in order, as stored. */
  spec: { id: string | null; name: string; amount: number | null; unit: string | null }[];
}

type Row = MenuItemRow & {
  bar_id: string | null;
  riff_of: { id: string; name: string; is_catalog: boolean | null } | null;
  menu_drinks: { menu: { name: string; is_active: boolean | null } | null }[] | null;
  spec: { sort_order: number | null; amount: number | null; unit: string | null; ingredient: { id: string; name: string; ingredient_role: string | null } | null }[] | null;
};

const COLUMNS = `${MENU_DRINK_COLUMNS}, bar_id,
  riff_of:riff_of_id(id, name, is_catalog),
  menu_drinks(menu:menus(name, is_active)),
  spec:app_recipe_presentation!recipe_item_id(sort_order, amount, unit, ingredient:display_ingredient(id, name, ingredient_role))`;

// ponytail: a bar's cocktails whose letters come in the name's order, enough for any one bar's list; a page of them if a bar ever has more.
const CANDIDATES = 500;

/**
 * A cocktail with this name (lib/sameName.ts: case, accents, spaces and
 * punctuation aside; brackets count) that a bar already has: kept at the
 * venue (`barId`), or credited to the bar's page (`creditedTo`, a bar
 * profile; a staffed bar's drinks are read where everyone may, in
 * published_items). Only drinks you can see. Asked once typing pauses: the
 * bar's own index finds its drinks (items_bar_id_idx,
 * items_origin_bar_profile_id_idx), a loose pattern narrows them to names
 * and ids, and only the one with this very name is read in full.
 * `checking` is true while that answer is still to come for the name as
 * typed (not once it fails or waits offline), so nothing goes past it.
 */
export function useSameNameDrink({ barId, creditedTo, name }: { barId?: string | null; creditedTo?: string | null; name: string }) {
  const userId = useUserId();
  const settled = useDebounced(name, 300);
  const key = nameKey(settled);
  const scope = barId ? { column: 'bar_id' as const, id: barId } : creditedTo ? { column: 'origin_bar_profile_id' as const, id: creditedTo } : null;
  const query = useQuery({
    queryKey: ['same-name-drink', scope?.column, scope?.id, key, userId],
    enabled: !!scope && !!key && !!userId,
    staleTime: 30_000,
    queryFn: async (): Promise<SameNameDrink | null> => {
      const pattern = nameLike(settled)!;
      const { data, error } = await supabase.from('items').select('id, name').eq(scope!.column, scope!.id).eq('item_type', 'cocktail').ilike('name', pattern).limit(CANDIDATES);
      if (error) throw error;
      const found = (data ?? []).find((r) => sameName(r.name, settled));
      if (found) return readDrink(found.id);
      return scope!.column === 'origin_bar_profile_id' ? readPublished(scope!.id, pattern, settled) : null;
    },
  });
  const typed = nameKey(name);
  const checking = !!scope && !!typed && !!userId && (typed !== key || query.isLoading);
  return { data: query.data, checking };
}

async function readDrink(id: string): Promise<SameNameDrink | null> {
  const { data, error } = await supabase.from('items').select(COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  const row = data as unknown as Row | null;
  const drink = row ? toMenuDrink(row) : null;
  if (!row || !drink) return null;
  const menus = (row.menu_drinks ?? []).flatMap((m) => (m.menu ? [m.menu] : []));
  const riff = row.riff_of;
  const spec = [...(row.spec ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  return {
    id: row.id,
    name: row.name,
    barId: row.bar_id,
    line: sentenceLine(ingredientLine(spec.map((l) => readingName(l.ingredient)))) || drink.line,
    menu: (menus.find((m) => m.is_active) ?? menus[0])?.name ?? null,
    imageUrl: drink.imageUrl,
    glass: drink.glass,
    classic: riff?.is_catalog ? { id: riff.id, name: riff.name } : null,
    spec: spec.flatMap((l) => (l.ingredient ? [{ id: l.ingredient.id, name: l.ingredient.name, amount: l.amount, unit: l.unit }] : [])),
  };
}

/** A staffed bar's published drink by this name, for someone outside the bar (who can't read it in `items`). */
async function readPublished(profileId: string, pattern: string, name: string): Promise<SameNameDrink | null> {
  const { data, error } = await supabase
    .from('published_items')
    .select('id, name, bar_id, image_url, riff_of_id')
    .eq('origin_bar_profile_id', profileId)
    .eq('item_type', 'cocktail')
    .eq('is_reference', false)
    .ilike('name', pattern)
    .limit(CANDIDATES);
  if (error) throw error;
  const row = (data ?? []).find((r) => !!r.id && !!r.name && sameName(r.name, name));
  if (!row?.id || !row.name) return null;
  // The classic it's a version of is in the catalog, which everyone signed in can read.
  const riff = row.riff_of_id ? await supabase.from('items').select('id, name, is_catalog').eq('id', row.riff_of_id).maybeSingle() : null;
  if (riff?.error) throw riff.error;
  return { id: row.id, name: row.name, barId: row.bar_id, line: '', menu: null, imageUrl: row.image_url, glass: null, classic: riff?.data?.is_catalog ? { id: riff.data.id, name: riff.data.name } : null, spec: [] };
}
