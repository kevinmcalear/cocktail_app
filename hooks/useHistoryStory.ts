import { useQuery } from '@tanstack/react-query';

import { fetchBasedOn } from '@/hooks/useLineage';
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
 * A few small queries, only for the picked drink.
 */
export function useHistoryStory(itemId: string | null) {
  return useQuery({
    queryKey: ['history-story', itemId],
    enabled: !!itemId,
    queryFn: async (): Promise<HistoryStory> => {
      const [aliases, versions, printed] = await Promise.all([
        supabase.from('classic_aliases').select('alias, source').eq('classic_id', itemId!).order('alias'),
        // ponytail: the 60 best-credited bar versions, so the story can lead with the best scored; a classic with more pages through its own drink page.
        fetchBasedOn(itemId!, 'riff', 60),
        supabase.from('source_recipes').select('source:sources(key, title, year, author)').eq('item_id', itemId!),
      ]);
      if (aliases.error) throw aliases.error;
      if (printed.error) throw printed.error;
      const books = (printed.data ?? []).flatMap((p) => (p.source ? [p.source] : []));
      return {
        aliases: (aliases.data ?? []) as HistoryStory['aliases'],
        versions: versions.map((v) => ({ id: v.id, name: v.name, bar: v.origin_bar?.display_name ?? null })),
        books: [...new Map(books.map((b) => [b.key, b])).values()].sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999)),
      };
    },
  });
}
