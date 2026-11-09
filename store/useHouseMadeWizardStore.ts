import { newDraftId } from '@/lib/drinkWizard';
import { EMPTY_HOUSE_MADE, type HouseMadeDraft, type HouseMadeStep } from '@/lib/houseMadeDraft';

import { createWizardStore } from './createWizardStore';

/**
 * Something you make being added (components/screens/addIngredient/MakeRecipeRoute),
 * kept on the device until it's saved, and in the account as well when signed
 * in (hooks/useDraftSync), like a drink's, a beer's or a wine's.
 */
export const useHouseMadeWizardStore = createWizardStore<HouseMadeDraft, HouseMadeStep>('house-made-wizard', EMPTY_HOUSE_MADE, 'kind', (d) => (d.id ? d : { ...d, id: newDraftId() }), { tombstones: true });
