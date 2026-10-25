/**
 * Keeping the drink wizard's drafts in the account as well as on the device
 * (make-anything-steps-3, step 9; hooks/useDraftSync does the reads and
 * writes). Pure: what a device keeps after reading the account's drafts,
 * and what it sends back.
 */
import { hasContent, type WizardDraft, type WizardStep } from './drinkWizard';

export interface KeptDraft {
  draft: WizardDraft;
  step: WizardStep;
  updatedAt: number;
}

/** A draft as the account keeps it: no photos, which are files on the device they were picked on. */
export function forAccount(k: KeptDraft): KeptDraft {
  const { photos: _photos, ...draft } = k.draft;
  return { ...k, draft };
}

/**
 * The device's drafts after reading the account's: the newer of each wins
 * (keeping this device's photos); one the account no longer has, which this
 * device had seen there, was saved or started over elsewhere and goes; one
 * cleared here but not yet gone from the account stays gone, unless the
 * account's is newer. `push` is what the account lacks or has older: new
 * here, or changed while offline.
 * ponytail: "newer" is each device's clock; skew decides a tie between two
 * devices edited minutes apart. A server-stamped version is the upgrade.
 */
export function mergeDrafts(
  device: Record<string, KeptDraft>,
  account: Record<string, KeptDraft>,
  { seen, cleared, sentSince = [] }: { seen: readonly string[]; cleared: readonly { place: string; at: number }[]; sentSince?: readonly string[] }
): { kept: Record<string, KeptDraft>; push: string[]; seen: string[] } {
  // Cleared here: the account's copy stays out only if it's no newer than what was cleared (another device may have started a new one in that slot).
  const gone = (slot: string, there: KeptDraft) => cleared.some((c) => c.place === slot && there.updatedAt <= c.at);
  const kept: Record<string, KeptDraft> = {};
  const push: string[] = [];
  for (const [slot, here] of Object.entries(device)) {
    const there = account[slot];
    if (!there) {
      // Sent after this read began: the read just doesn't have it yet.
      if (seen.includes(slot) && !sentSince.includes(slot)) continue;
      kept[slot] = here;
      if (hasContent(here.draft)) push.push(slot);
    } else if (there.updatedAt > here.updatedAt) kept[slot] = { ...there, draft: { ...there.draft, photos: here.draft.photos } };
    else {
      kept[slot] = here;
      if (here.updatedAt > there.updatedAt) push.push(slot);
    }
  }
  for (const [slot, there] of Object.entries(account)) if (!(slot in device) && !gone(slot, there)) kept[slot] = there;
  return { kept, push, seen: Object.entries(account).filter(([s, there]) => !gone(s, there)).map(([s]) => s) };
}
