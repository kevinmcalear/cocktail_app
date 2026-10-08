import { EMPTY_INGREDIENT, type IngredientDraft, type IngredientStep } from '@/lib/ingredientWizard';

import { createWizardStore } from './createWizardStore';

export { wizardPlace } from './createWizardStore';

/** The ingredient being added (components/screens/addIngredient), kept on the device until it's saved. */
export const useIngredientWizardStore = createWizardStore<IngredientDraft, IngredientStep>('ingredient-wizard', EMPTY_INGREDIENT, 'name');
