import { useQuery } from '@tanstack/react-query';

import { fetchStyles } from '@/hooks/useLineage';
import { familyKey, type TreeNode } from '@/lib/drinkTree';
import { spiritsOf } from '@/lib/drinkStyles';
import { supabase } from '@/lib/supabase';

interface TreeDrinkRow {
  id: string;
  name: string;
  origin_year: number | null;
  origin_year_approx: boolean;
  origin_year_guess: string | null;
  drink_family: string;
  based_on_id: string | null;
  based_on_kind: string | null;
  based_on_style_id: string | null;
  lineage_note: string | null;
  origin: string | null;
  creator: { id: string; display_name: string } | null;
  origin_bar: { id: string; display_name: string; is_closed: boolean; city: string | null } | null;
  versions: { count: number }[] | null;
  lines: { ingredient: { name: string } | null }[] | null;
}

// The ingredient names are read once here for the Timeline's Spirit filter; only the spirits are kept.
// versions: the drinks based on it as riffs (bars' versions), not the classics that came from it.
const COLUMNS = `id, name, origin_year, origin_year_approx, origin_year_guess, drink_family, based_on_id, based_on_kind, based_on_style_id, lineage_note, origin,
  creator:profiles!items_creator_profile_id_fkey(id, display_name),
  origin_bar:profiles!items_origin_bar_profile_id_fkey(id, display_name, is_closed, city),
  versions:items!based_on_id(count),
  lines:recipes!recipe_item_id(ingredient:items!ingredient_item_id(name))`;

/**
 * Every historic style and every catalog classic in the family tree, as one
 * flat list of nodes (about 420). Two queries; it changes rarely. A classic is
 * in the tree when its family is one of the tree's eight (familyKey); a
 * "Sipper" isn't.
 * ponytail: one page of up to 1,000 classics with a family; page it if the
 * catalog's tree passes that.
 */
export function useDrinkTree() {
  return useQuery({
    queryKey: ['drink-tree', 3],
    queryFn: async (): Promise<TreeNode[]> => {
      const [styles, drinks] = await Promise.all([
        fetchStyles(),
        supabase.from('items').select(COLUMNS).eq('is_catalog', true).not('drink_family', 'is', null).eq('versions.based_on_kind', 'riff').limit(1000),
      ]);
      if (drinks.error) throw drinks.error;
      const styleNodes: TreeNode[] = styles.map((s) => ({
        key: `s:${s.id}`,
        id: s.id,
        kind: 'style',
        name: s.name,
        year: s.year,
        approx: s.year_approx,
        family: s.family,
        parentKey: s.parent_style_id ? `s:${s.parent_style_id}` : null,
        note: s.summary,
        creator: null,
        creatorId: null,
        bar: null,
        barId: null,
        barClosed: false,
        city: null,
        modern: false,
        spirits: [],
        versions: 0,
      }));
      const inTree = ((drinks.data ?? []) as TreeDrinkRow[]).filter((d) => familyKey(d.drink_family));
      const drinkNodes: TreeNode[] = inTree.map((d) => ({
        key: `d:${d.id}`,
        id: d.id,
        kind: 'drink',
        name: d.name,
        year: d.origin_year,
        approx: d.origin_year_approx,
        guess: d.origin_year_guess,
        family: familyKey(d.drink_family)!,
        parentKey: d.based_on_kind === 'descends' ? `d:${d.based_on_id}` : d.based_on_kind === 'style' ? `s:${d.based_on_style_id}` : null,
        note: d.lineage_note,
        creator: d.creator?.display_name ?? null,
        creatorId: d.creator?.id ?? null,
        bar: d.origin_bar?.display_name ?? null,
        barId: d.origin_bar?.id ?? null,
        barClosed: !!d.origin_bar?.is_closed,
        city: d.origin_bar?.city ?? null,
        modern: d.origin === 'Modern Classic',
        spirits: spiritsOf({ name: d.name, ingredients: (d.lines ?? []).flatMap((l) => (l.ingredient ? [l.ingredient.name] : [])) }),
        versions: d.versions?.[0]?.count ?? 0,
      }));
      return [...styleNodes, ...drinkNodes];
    },
  });
}
