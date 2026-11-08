import { EMPTY_BEER_WINE, type BeerWineDraft, type BeerWineStep } from '@/lib/beerWineDraft';

import { createWizardStore } from './createWizardStore';

export { beerWinePlace } from '@/lib/beerWineDraft';

/**
 * The beer or wine being added (components/screens/addBeerWine), kept on the
 * device until it's saved, and in the account as well when signed in
 * (hooks/useDraftSync), like a drink's.
 */
export const useBeerWineWizardStore = createWizardStore<BeerWineDraft, BeerWineStep>('beer-wine-wizard', EMPTY_BEER_WINE, 'name', undefined, { tombstones: true });
