import { useQuery } from '@tanstack/react-query';

import { fetchStyles } from '@/hooks/useLineage';
import type { TreeNode } from '@/lib/drinkTree';
import { supabase } from '@/lib/supabase';

interface TreeDrinkRow {
  id: string;
  name: string;
  origin_year: number | null;
  origin_year_approx: boolean;
  lineage_family: string;
  lineage_parent_id: string | null;
  lineage_style_id: string | null;
  lineage_note: string | null;
  creator: { id: string; display_name: string } | null;
  origin_bar: { id: string; display_name: string; is_closed: boolean } | null;
  versions: { count: number }[] | null;
}

const COLUMNS = `id, name, origin_year, origin_year_approx, lineage_family, lineage_parent_id, lineage_style_id, lineage_note,
  creator:profiles!items_creator_profile_id_fkey(id, display_name),
  origin_bar:profiles!items_origin_bar_profile_id_fkey(id, display_name, is_closed),
  versions:items!riff_of_id(count)`;

/**
 * Every historic style and every catalog classic in the family tree, as one
 * flat list of nodes (about 420). Two queries; it changes rarely.
 * ponytail: one page of up to 1,000 classics; page it if the catalog's tree
 * passes that.
 */
export function useDrinkTree() {
  return useQuery({
    queryKey: ['drink-tree'],
    staleTime: 1000 * 60 * 60,
    queryFn: async (): Promise<TreeNode[]> => {
      const [styles, drinks] = await Promise.all([
        fetchStyles(),
        supabase.from('items').select(COLUMNS).eq('is_catalog', true).not('lineage_family', 'is', null).limit(1000),
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
        versions: 0,
      }));
      const drinkNodes: TreeNode[] = ((drinks.data ?? []) as unknown as TreeDrinkRow[]).map((d) => ({
        key: `d:${d.id}`,
        id: d.id,
        kind: 'drink',
        name: d.name,
        year: d.origin_year,
        approx: d.origin_year_approx,
        family: d.lineage_family,
        parentKey: d.lineage_parent_id ? `d:${d.lineage_parent_id}` : d.lineage_style_id ? `s:${d.lineage_style_id}` : null,
        note: d.lineage_note,
        creator: d.creator?.display_name ?? null,
        creatorId: d.creator?.id ?? null,
        bar: d.origin_bar?.display_name ?? null,
        barId: d.origin_bar?.id ?? null,
        barClosed: !!d.origin_bar?.is_closed,
        versions: d.versions?.[0]?.count ?? 0,
      }));
      return [...styleNodes, ...drinkNodes];
    },
  });
}
