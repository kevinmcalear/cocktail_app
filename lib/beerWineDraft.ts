/**
 * The beer or wine being added, as its draft is kept (store/useBeerWineWizardStore)
 * and synced to the account (hooks/useDraftSync). Kept apart from the
 * wizard's rules (lib/beerWineWizard) and its drawing, so the sync, which
 * every page mounts, doesn't bring them to the web's first load.
 */
import type { DrinkKind } from './drinkKinds';

export const BEER_WINE_STEPS = ['name', 'maker', 'style', 'strength', 'glass', 'notes', 'price', 'review'] as const;
export type BeerWineStep = (typeof BEER_WINE_STEPS)[number];

/** A local photo picked or taken in the wizard, uploaded when it's saved. */
export interface DraftPhoto {
  uri: string;
  mimeType: string;
}

export interface BeerWineDraft {
  /** Stamped on the first change (store/useBeerWineWizardStore): the same draft on every device. */
  id?: string;
  name: string;
  maker: string;
  /** A style chip ("IPA", "Red"): saved as that category when the catalog has it, and it draws the colour. */
  style: string | null;
  /** A region chip ("Belgium", "France"), saved as its category. */
  region: string | null;
  /** ABV in percent, as typed. */
  abv: string;
  /** How the glass is drawn ('beer_tulip'); null is the style's usual glass. */
  glassVariant: string | null;
  /** Tasting words, in the order tapped; they lead the description. */
  tasting: string[];
  description: string;
  price: string;
  /** Where it's from ("Portland, USA"), filled from the catalog. */
  origin: string | null;
  photo: DraftPhoto | null;
  /** "It's a different one" was said for this name (its nameKey): the name-taken card stays away for it. */
  differentFrom: string | null;
}

export const EMPTY_BEER_WINE: BeerWineDraft = {
  name: '',
  maker: '',
  style: null,
  region: null,
  abv: '',
  glassVariant: null,
  tasting: [],
  description: '',
  price: '',
  origin: null,
  photo: null,
  differentFrom: null,
};

/** Anything typed or picked: closing asks "Leave it for now?" and keeps it, and Add lists it (Kevin, 8 Nov). */
export const filledBeerWine = (d: BeerWineDraft) =>
  !!(d.name.trim() || d.maker.trim() || d.style || d.region || d.abv || d.photo || d.tasting.length || d.description.trim() || d.price.trim());

/** One unsaved beer and one wine per place: 'beer:home', 'wine:<venue id>'. */
export const beerWinePlace = (kind: DrinkKind, barId: string | null | undefined) => `${kind}:${barId || 'home'}`;

/**
 * A beer or wine's slot among the account's wizard drafts. A drink's slot
 * starts with its place ('home' or a venue's id, lib/wizardSlots), so the two
 * never meet.
 */
export const isBeerWineSlot = (slot: string) => /^(beer|wine):/.test(slot);

/** The venue a beer or wine's slot is at; null at home. */
export function beerWineBar(slot: string): string | null {
  const place = slot.slice(slot.indexOf(':') + 1);
  return place === 'home' ? null : place;
}
