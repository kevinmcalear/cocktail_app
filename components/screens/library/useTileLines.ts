import { useMemo } from 'react';

import { useDropdowns } from '@/hooks/useDropdowns';
import { methodWord, tileLine, type Show } from '@/lib/libraryFilters';
import type { SearchItem } from '@/types/search';

/**
 * A Library tile's second line: "Stirred · Coupe"; R&D adds the collection;
 * beer and wine say what they are; preps what was done, yield and keeps;
 * Needs something says what's missing ("Needs a sphere", the kit check).
 */
export function useTileLines({ show, rndMenus, prepLine, needsOf }: {
  show: Show;
  rndMenus: readonly { name: string; itemIds: readonly string[] }[];
  prepLine: (id: string) => string | null;
  needsOf: (id: string) => string | null;
}) {
  const { data: specs } = useDropdowns();
  const rndOf = useMemo(() => new Map(rndMenus.flatMap((m) => m.itemIds.map((id) => [id, m.name] as const))), [rndMenus]);
  const glassName = (i: SearchItem) => (i.glassware_id ? (specs?.glassware.find((g) => g.id === i.glassware_id)?.name ?? null) : null);
  const lineOf = (i: SearchItem): string | null => {
    if (i.category === 'Ingredient') return prepLine(i.id);
    if (i.category === 'Beer' || i.category === 'Wine') return tileLine(i.category, glassName(i));
    if (show === 'needs') return needsOf(i.id);
    const method = i.method_id ? methodWord(specs?.methods.find((m) => m.id === i.method_id)?.name) : null;
    return tileLine(method, glassName(i), show === 'rnd' ? rndOf.get(i.id) : null);
  };
  return { glassName, lineOf };
}
