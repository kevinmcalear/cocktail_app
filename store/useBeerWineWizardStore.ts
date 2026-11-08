import { EMPTY_BEER_WINE, type BeerWineDraft, type BeerWineStep } from '@/lib/beerWineDraft';
import { newDraftId } from '@/lib/drinkWizard';

import { createWizardStore } from './createWizardStore';

/**
 * The beer or wine being added (components/screens/addBeerWine), kept on the
 * device until it's saved, and in the account as well when signed in
 * (hooks/useDraftSync), like a drink's. The first change gives the draft its
 * id, which tells it apart from another started in the same place.
 */
export const useBeerWineWizardStore = createWizardStore<BeerWineDraft, BeerWineStep>('beer-wine-wizard', EMPTY_BEER_WINE, 'name', (d) => (d.id ? d : { ...d, id: newDraftId() }), { tombstones: true });
