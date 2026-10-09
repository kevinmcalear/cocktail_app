import { useMemo } from 'react';

import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useBeers } from '@/hooks/useBeers';
import { useCocktails } from '@/hooks/useCocktails';
import { useDropdowns } from '@/hooks/useDropdowns';
import { useStudyPile } from '@/hooks/useStudyPile';
import { useTonight } from '@/hooks/useTonight';
import { useWines } from '@/hooks/useWines';
import { heroPicture, type ItemImageLink } from '@/lib/itemImages';
import type { PresentationRecipe } from '@/lib/spec';
import { pourFacts, type Fact, type GlassOption } from '@/lib/study';

export type DeckId = 'tonight' | 'pile' | 'venue' | 'beers' | 'wines';

export interface StudyCardData {
  id: string;
  kind: 'cocktail' | 'beer' | 'wine';
  name: string;
  imageUrl: string | null;
  barId: string | null;
  glass: GlassOption | null;
  /** Cocktails: the role-masked spec on the back of the card. */
  recipes: PresentationRecipe[];
  /** Beer and wine: style, maker, region, strength and serve instead of a spec. */
  facts: Fact[];
  /** Beer and wine: the description and tasting notes. */
  about: string | null;
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
  item_images?: ItemImageLink[] | null;
  recipes?: PresentationRecipe[] | null;
}

interface PourRow {
  id: string;
  name: string;
  bar_id: string | null;
  glassware_id: string | null;
  brand_maker: string | null;
  abv: number | null;
  price: string | null;
  origin: string | null;
  description: string | null;
  notes: string | null;
  item_images?: ItemImageLink[] | null;
  item_categories?: { category_id: string }[] | null;
}

interface NamedItem {
  id: string;
  name: string;
  icon_key?: string | null;
}

interface CategoryRow {
  id: string;
  name: string;
  parent_id: string | null;
}

/**
 * Study decks for the active venue: tonight's menu, the person's study pile,
 * and every cocktail, beer and wine at the venue. Cocktail cards carry the
 * role-masked spec, so each role studies what it's allowed to see; beer and
 * wine cards carry what staff say about them at the table.
 */
export function useStudyDecks() {
  const { active } = useActiveVenue();
  const { drinks: tonight, isLoading: tonightLoading } = useTonight(active?.id ?? null);
  const { data: cocktails, isLoading: cocktailsLoading } = useCocktails();
  const { data: beers, isLoading: beersLoading } = useBeers();
  const { data: wines, isLoading: winesLoading } = useWines();
  const { data: dropdowns } = useDropdowns();
  const { studyPile } = useStudyPile();

  return useMemo(() => {
    const glasses: GlassOption[] = ((dropdowns?.glassware ?? []) as NamedItem[]).map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.icon_key || g.name,
    }));
    const glassOf = (id: string | null) => glasses.find((g) => g.id === id) ?? null;
    const categories = new Map(((dropdowns?.categories ?? []) as CategoryRow[]).map((c) => [c.id, c]));
    const cards: Record<string, StudyCardData> = {};
    for (const c of (cocktails ?? []) as unknown as CocktailRow[]) {
      cards[c.id] = {
        id: c.id,
        kind: 'cocktail',
        name: c.name,
        imageUrl: heroPicture(c.item_images)?.url ?? null,
        barId: c.bar_id,
        glass: glassOf(c.glassware_id),
        recipes: c.recipes ?? [],
        facts: [],
        about: null,
      };
    }
    const addPours = (rows: unknown, kind: 'beer' | 'wine') => {
      for (const p of (rows ?? []) as PourRow[]) {
        const glass = glassOf(p.glassware_id);
        const tags = (p.item_categories ?? []).flatMap(({ category_id }) => {
          const tag = categories.get(category_id);
          return tag ? [{ name: tag.name, group: categories.get(tag.parent_id ?? '')?.name ?? null }] : [];
        });
        cards[p.id] = {
          id: p.id,
          kind,
          name: p.name,
          imageUrl: heroPicture(p.item_images)?.url ?? null,
          barId: p.bar_id,
          glass,
          recipes: [],
          facts: pourFacts({ kind, maker: p.brand_maker, abv: p.abv, price: p.price, origin: p.origin, glass: glass?.name ?? null, tags }),
          about: [p.description, p.notes].map((s) => s?.trim()).filter(Boolean).join('\n\n') || null,
        };
      }
    };
    addPours(beers, 'beer');
    addPours(wines, 'wine');

    const has = (id: string) => !!cards[id];
    const atVenue = (kind: StudyCardData['kind']) =>
      Object.values(cards)
        .filter((c) => c.kind === kind && active && c.barId === active.id)
        .map((c) => c.id);
    const at = active ? ` at ${active.name}` : '';
    const tonightIds = [...new Set(tonight.map((d) => d.id))].filter(has);
    // Beer and wine pages save to the pile as "beer-<id>"; cocktails save bare ids.
    const pileIds = [...new Set(studyPile.map((id) => id.replace(/^(beer|wine)-/, '')))].filter(has);
    const decks: Deck[] = [
      { id: 'tonight', title: 'Tonight’s menu', description: 'The drinks you’ll pour tonight.', cardIds: tonightIds },
      { id: 'pile', title: 'Your study pile', description: 'Drinks you saved to learn.', cardIds: pileIds },
      { id: 'venue', title: `Cocktails${at}`, description: 'Every cocktail on the venue’s books.', cardIds: atVenue('cocktail') },
      { id: 'beers', title: `Beers${at}`, description: 'Style, brewery and how it’s served.', cardIds: atVenue('beer') },
      { id: 'wines', title: `Wines${at}`, description: 'Style, producer and region.', cardIds: atVenue('wine') },
    ];
    return { decks, cards, glasses, isLoading: tonightLoading || cocktailsLoading || beersLoading || winesLoading };
  }, [dropdowns?.glassware, dropdowns?.categories, cocktails, beers, wines, active, tonight, studyPile, tonightLoading, cocktailsLoading, beersLoading, winesLoading]);
}
