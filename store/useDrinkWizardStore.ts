import { EMPTY_DRAFT, newDraftId, type WizardDraft, type WizardStep } from '@/lib/drinkWizard';
import { importsInPlainSlots } from '@/lib/wizardSlots';

import { createWizardStore } from './createWizardStore';

export { wizardPlace } from './createWizardStore';
/** The kept draft a wizard opens: the place's one, or a drink started from a menu, by name or from another drink. */
export { draftSlot, isReviewSlot, sectionSlots } from '@/lib/wizardSlots';

/**
 * The drink being added (components/screens/addDrink), kept on the device
 * until it's saved. The first change gives the draft its id (the drink's id
 * once saved, and its drawing's seed).
 */
export const useDrinkWizardStore = createWizardStore<WizardDraft, WizardStep>('drink-wizard', EMPTY_DRAFT, 'name', (d) => (d.id ? d : { ...d, id: newDraftId() }), { tombstones: true });

/**
 * An import's drink left in a plain New drink slot (an older version put it
 * there) moves to its own draft by name, so New drink starts fresh. Run once
 * the device's drafts load, and after the account's arrive. The old slot is
 * cleared, so the account's copy goes too.
 */
export function moveImportsOut() {
  const { kept, clear } = useDrinkWizardStore.getState();
  for (const { from, to } of importsInPlainSlots(kept)) {
    const k = useDrinkWizardStore.getState().kept[from];
    clear(from);
    useDrinkWizardStore.setState((s) => ({ kept: { ...s.kept, [to]: { ...k, updatedAt: Date.now() } } }));
  }
}
if (useDrinkWizardStore.persist.hasHydrated()) moveImportsOut();
else useDrinkWizardStore.persist.onFinishHydration(moveImportsOut);
