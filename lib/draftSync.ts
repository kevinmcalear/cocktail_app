/**
 * Keeping the add wizards' drafts in the account as well as on the device
 * (make-anything-steps-3, step 9; hooks/useDraftSync does the reads and
 * writes): a drink's, and a beer's or wine's (Kevin, 8 Nov: "Sync them too").
 * Pure: what a device keeps after reading the account's drafts, and what it
 * sends back.
 */
import { EMPTY_BEER_WINE, filledBeerWine, type BeerWineDraft } from './beerWineDraft';
import { hasContent, type WizardDraft, type WizardStep } from './drinkWizard';
import { EMPTY_HOUSE_MADE, filledHouseMade, type HouseMadeDraft } from './houseMadeDraft';

export interface KeptDraft<D extends object = WizardDraft, S extends string = WizardStep> {
  draft: D;
  step: S;
  updatedAt: number;
}

/**
 * What syncing needs to know of a wizard's drafts: when one is worth
 * keeping, and its fields that are files on the device they were picked on
 * (never sent; the account's newer copy keeps this device's).
 */
export interface DraftRules<D extends object> {
  filled: (draft: D) => boolean;
  local: readonly (keyof D)[];
}

export const DRINK_DRAFTS: DraftRules<WizardDraft> = { filled: hasContent, local: ['photos'] };
// A draft kept by an older version may lack a field: filled out first.
export const BEER_WINE_DRAFTS: DraftRules<BeerWineDraft> = { filled: (d) => filledBeerWine({ ...EMPTY_BEER_WINE, ...d }), local: ['photo'] };
// Something you make (Add-house: "on this phone and the web"): nothing in it is a file. It goes up once it has a name: an app
// from before 9 Nov reads every row that isn't a beer's or a wine's as a drink's, and a drink's draft with a name is all it checks.
export const HOUSE_MADE_DRAFTS: DraftRules<HouseMadeDraft> = { filled: (d) => filledHouseMade({ ...EMPTY_HOUSE_MADE, ...d }) && !!d.name?.trim(), local: [] };

/** Two copies of one draft, by the id its first change gave it; one kept before ids can't be told apart, so counts as the same. */
function sameDraft(a: object, b: object): boolean {
  const idA = (a as { id?: unknown }).id;
  const idB = (b as { id?: unknown }).id;
  return !idA || !idB || idA === idB;
}

/** A draft as the account keeps it: no photos. */
export function forAccount<D extends object, S extends string>(k: KeptDraft<D, S>, rules: DraftRules<D>): KeptDraft<D, S> {
  const draft = Object.fromEntries(Object.entries(k.draft).filter(([field]) => !rules.local.includes(field as keyof D))) as D;
  return { ...k, draft };
}

/**
 * The device's drafts after reading the account's: the newer of each wins
 * (keeping this device's photos); one the account no longer has, which this
 * device had seen there, was saved or started over elsewhere and goes; one
 * cleared here but not yet gone from the account stays gone, unless the
 * account's is newer. `push` is what the account lacks or has older: new
 * here (a draft kept before syncing began, too), or changed while offline.
 * ponytail: "newer" is each device's clock; skew decides a tie between two
 * devices edited minutes apart. A server-stamped version is the upgrade.
 */
export function mergeDrafts<D extends object, S extends string>(
  device: Record<string, KeptDraft<D, S>>,
  account: Record<string, KeptDraft<D, S>>,
  { seen, cleared, sentSince = [] }: { seen: readonly string[]; cleared: readonly { place: string; at: number }[]; sentSince?: readonly string[] },
  rules: DraftRules<D>
): { kept: Record<string, KeptDraft<D, S>>; push: string[]; seen: string[] } {
  // Cleared here: the account's copy stays out only if it's no newer than what was cleared (another device may have started a new one in that slot).
  const gone = (slot: string, there: KeptDraft<D, S>) => cleared.some((c) => c.place === slot && there.updatedAt <= c.at);
  const kept: Record<string, KeptDraft<D, S>> = {};
  const push: string[] = [];
  for (const [slot, here] of Object.entries(device)) {
    const there = account[slot];
    if (!there) {
      // Sent after this read began: the read just doesn't have it yet.
      if (seen.includes(slot) && !sentSince.includes(slot)) continue;
      kept[slot] = here;
      if (rules.filled(here.draft)) push.push(slot);
    } else if (there.updatedAt > here.updatedAt) {
      // This device's photos stay with the same draft only, never one started in its place elsewhere.
      const files = sameDraft(here.draft, there.draft) ? Object.fromEntries(rules.local.map((field) => [field, here.draft[field]])) : {};
      kept[slot] = { ...there, draft: { ...there.draft, ...files } };
    } else {
      kept[slot] = here;
      if (here.updatedAt > there.updatedAt) push.push(slot);
    }
  }
  for (const [slot, there] of Object.entries(account)) if (!(slot in device) && !gone(slot, there)) kept[slot] = there;
  // Every slot the account has, cleared here or not: one cleared but still there must still be taken out. Left off the list,
  // it read as never sent and its tombstone went with nothing deleted, so a save that waited for signal came back as a draft.
  return { kept, push, seen: Object.keys(account) };
}
