import { EMPTY_DRAFT, newDraftId, type WizardDraft, type WizardStep } from '@/lib/drinkWizard';

import { createWizardStore } from './createWizardStore';

export { wizardPlace } from './createWizardStore';

/**
 * The drink being added (components/screens/addDrink), kept on the device
 * until it's saved. The first change gives the draft its id (the drink's id
 * once saved, and its drawing's seed).
 */
export const useDrinkWizardStore = createWizardStore<WizardDraft, WizardStep>('drink-wizard', EMPTY_DRAFT, 'name', (d) => (d.id ? d : { ...d, id: newDraftId() }));
