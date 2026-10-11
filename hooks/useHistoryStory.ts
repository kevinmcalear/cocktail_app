import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

// Row shapes are written by hand until types/ is regenerated.

export interface HistoryStory {
  /** True synonyms ("Bourbon Negroni"), each with where it's from. */
  aliases: { alias: string; source: string }[];
  /** The best-credited bars' versions, for the first lines of "Bar versions". */
  versions: { id: string; name: string; bar: string | null }[];
  /** The books it's printed in, oldest first. */
  books: { key: string; title: string; year: number | null; author: string | null }[];
}

/**
 * What History's drink sheet and side panel add to the tree's own facts: a
 * classic's aliases, its first few bar versions and the books it's printed in.
 * Three small queries, only for the picked drink.
 */
export function useHistoryStory(itemId: string | null) {
  return useQuery({
    queryKey: ['history-story', itemId],
    enabled: !!itemId,
    queryFn: async (): Promise<HistoryStory> => {
      const [aliases, versions, printed] = await Promise.all([
        supabase.from('classic_aliases').select('alias, source').eq('classic_id', itemId!).order('alias'),
        supabase
          .from('items')
          .select('id, name, origin_bar:profiles!items_origin_bar_profile_id_fkey(display_name)')
          .eq('riff_of_id', itemId!)
          .order('credit_status', { ascending: false, nullsFirst: false })
          .order('name')
          .limit(3),
        supabase.from('source_recipes').select('source:sources(key, title, year, author)').eq('item_id', itemId!),
      ]);
      if (aliases.error) throw aliases.error;
      if (versions.error) throw versions.error;
      if (printed.error) throw printed.error;
      type Version = { id: string; name: string; origin_bar: { display_name: string } | null };
      type Printed = { source: HistoryStory['books'][number] | null };
      const books = ((printed.data ?? []) as unknown as Printed[]).flatMap((p) => (p.source ? [p.source] : []));
      return {
        aliases: (aliases.data ?? []) as HistoryStory['aliases'],
        versions: ((versions.data ?? []) as unknown as Version[]).map((v) => ({ id: v.id, name: v.name, bar: v.origin_bar?.display_name ?? null })),
        books: [...new Map(books.map((b) => [b.key, b])).values()].sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999)),
      };
    },
  });
}
