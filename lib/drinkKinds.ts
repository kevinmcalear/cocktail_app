import { useBeer } from '@/hooks/useBeers';
import { useWine } from '@/hooks/useWines';

/**
 * Beer and wine share one set of screens (add, edit, detail); this is what
 * differs between them.
 */
export type DrinkKind = 'beer' | 'wine';

export interface DrinkKindConfig {
  kind: DrinkKind;
  /** "Beer" / "Wine", for titles and messages. */
  label: string;
  /** React Query key for the list, e.g. ['beers']. */
  listQueryKey: string;
  /** Storage folder for published photos. */
  storageFolder: string;
  /** Loads one item, with its images and tags. */
  useItem: typeof useBeer;
  maker: {
    label: string;
    placeholder: string;
    /** Key used in saved drafts (older drafts depend on it). */
    draftKey: 'brewery' | 'vintner';
    /** SF Symbol for the maker pill on the detail page. */
    icon: 'building.2.fill' | 'map.fill';
  };
  placeholders: { name: string; abv: string; price: string };
}

export const DRINK_KINDS: Record<DrinkKind, DrinkKindConfig> = {
  beer: {
    kind: 'beer',
    label: 'Beer',
    listQueryKey: 'beers',
    storageFolder: 'beers',
    useItem: useBeer,
    maker: { label: 'Brewery / Brand', placeholder: 'e.g. Bellwoods', draftKey: 'brewery', icon: 'building.2.fill' },
    placeholders: { name: 'e.g. Cottage Lager', abv: 'e.g. 5.0', price: 'e.g. 8.00' },
  },
  wine: {
    kind: 'wine',
    label: 'Wine',
    listQueryKey: 'wines',
    storageFolder: 'wines',
    useItem: useWine,
    maker: { label: 'Vintner / Brand', placeholder: 'e.g. Napa Valley Wine', draftKey: 'vintner', icon: 'map.fill' },
    placeholders: { name: 'e.g. Cabernet Sauvignon', abv: 'e.g. 13.5', price: 'e.g. 60.00' },
  },
};

/** Item ids arrive bare or prefixed ("beer-<uuid>"); the database wants them bare. */
export function bareItemId(kind: DrinkKind, id: string | undefined): string {
  return (id ?? '').replace(`${kind}-`, '');
}
