import { useMemo } from 'react';

import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCocktails } from '@/hooks/useCocktails';
import { useDropdowns } from '@/hooks/useDropdowns';
import { useStudyPile } from '@/hooks/useStudyPile';
import { useTonight } from '@/hooks/useTonight';
import type { PresentationRecipe } from '@/lib/spec';
import type { GlassOption } from '@/lib/study';

export type DeckId = 'tonight' | 'pile' | 'venue';

export interface StudyCardData {
  id: string;
  name: string;
  imageUrl: string | null;
  barId: string | null;
  glass: GlassOption | null;
  recipes: PresentationRecipe[];
}

export interface Deck {
  id: DeckId;
  title: string;
  description: string;
  cardIds: string[];
}

interface CocktailRow {
  id: string;
  name: string;
  bar_id: string | null;
  glassware_id: string | null;
  item_images?: { images?: { url: string } | null }[] | null;
  recipes?: PresentationRecipe[] | null;
}

interface NamedItem {
  id: string;
  name: string;
  icon_key?: string | null;
}

/**
 * Study decks for the active venue: tonight's menu, the person's study pile,
 * and every cocktail at the venue. Cards carry the role-masked spec, so each
 * role studies what it's allowed to see.
 */
export function useStudyDecks() {
  const { active } = useActiveVenue();
  const { drinks: tonight, isLoading: tonightLoading } = useTonight(active?.id ?? null);
  const { data: cocktails, isLoading: cocktailsLoading } = useCocktails({ allContexts: true });
  const { data: dropdowns } = useDropdowns();
  const { studyPile } = useStudyPile();

  return useMemo(() => {
    const glasses: GlassOption[] = ((dropdowns?.glassware ?? []) as NamedItem[]).map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.icon_key || g.name,
    }));
    const cards: Record<string, StudyCardData> = {};
    for (const c of (cocktails ?? []) as unknown as CocktailRow[]) {
      cards[c.id] = {
        id: c.id,
        name: c.name,
        imageUrl: c.item_images?.[0]?.images?.url ?? null,
        barId: c.bar_id,
        glass: glasses.find((g) => g.id === c.glassware_id) ?? null,
        recipes: c.recipes ?? [],
      };
    }
    const has = (id: string) => !!cards[id];
    const tonightIds = [...new Set(tonight.filter((d) => d.category === 'Cocktail').map((d) => d.id))].filter(has);
    const venueIds = Object.values(cards)
      .filter((c) => active && c.barId === active.id)
      .map((c) => c.id);
    const decks: Deck[] = [
      { id: 'tonight', title: 'Tonight’s menu', description: 'The drinks you’ll pour tonight.', cardIds: tonightIds },
      { id: 'pile', title: 'Your study pile', description: 'Drinks you saved to learn.', cardIds: studyPile.filter(has) },
      { id: 'venue', title: active ? `Everything at ${active.name}` : 'Everything', description: 'Every cocktail on the venue’s books.', cardIds: venueIds },
    ];
    return { decks, cards, glasses, isLoading: tonightLoading || cocktailsLoading };
  }, [tonight, cocktails, dropdowns?.glassware, studyPile, active, tonightLoading, cocktailsLoading]);
}
