import { useMemo } from 'react';

import { useMenuLibrary } from '@/hooks/useMenuMutations';
import { blankSection, type EditSection } from '@/lib/menuLayout';
import { applyMenuPaste, parseMenuPaste, pasteRows, placedGroups, type PasteRow } from '@/lib/paste';
import type { MenuDrink } from '@/types/menus';

type Missing = Extract<PasteRow, { status: 'missing' }>;

const sectionsOf = (rows: PasteRow[]): EditSection[] =>
  applyMenuPaste({ name: '', coverUrl: null, coverPosition: 50, sections: [blankSection()] }, null, placedGroups(rows, false)).sections;

/**
 * A list pasted into New menu, matched as it's typed with the builder's Paste
 * a list matcher (lib/paste): the sections the draft starts with, the
 * preview's (where a drink that isn't there yet stands in, marked new), the
 * prices to keep, and the drinks Bring in starts afterwards.
 */
export function useNewMenuPaste(text: string, barId: string | null, enabled: boolean) {
  const { data: library = [] } = useMenuLibrary(barId, enabled);
  return useMemo(() => {
    const rows = enabled ? pasteRows(parseMenuPaste(text, false), library, {}) : [];
    const missing = rows.filter((r): r is Missing => r.status === 'missing');
    // A stand-in so the card can show where it goes: never saved.
    const standIn = (r: Missing): MenuDrink => ({ id: `new:${r.key}`, name: r.name, kind: 'cocktail', line: '', price: r.price ?? null, imageUrl: null, isSketch: false, glass: null });
    const shown = rows.map((r): PasteRow => (r.status === 'missing' ? { key: r.key, section: r.section, status: 'add', drink: standIn(r), price: null, note: null } : r));
    const adding = rows.flatMap((r) => (r.status === 'add' ? [r] : []));
    return {
      sections: sectionsOf(rows),
      preview: sectionsOf(shown),
      newIds: new Set(missing.map((r) => `new:${r.key}`)),
      found: adding.length,
      prices: adding.flatMap((r) => (r.price ? [{ id: r.drink.id, price: r.price }] : [])),
      missing: missing.map((r) => ({ name: r.name, ingredients: r.ingredients })),
      // ponytail: a name matching two drinks is left for the builder's Paste a list, which asks which.
      unsure: rows.filter((r) => r.status === 'pick').length,
    };
  }, [text, library, enabled]);
}
