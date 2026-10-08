import { EMPTY_DRAFT, type WizardDraft, type WizardStep } from '@/lib/drinkWizard';

import { createWizardStore } from './createWizardStore';

export { wizardPlace } from './createWizardStore';

/** The drink being added (components/screens/addDrink), kept on the device until it's saved. */
export const useDrinkWizardStore = createWizardStore<WizardDraft, WizardStep>('drink-wizard', EMPTY_DRAFT, 'name');
