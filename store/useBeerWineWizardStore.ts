import { EMPTY_BEER_WINE, type BeerWineDraft, type BeerWineStep } from '@/lib/beerWineWizard';
import type { DrinkKind } from '@/lib/drinkKinds';

import { createWizardStore } from './createWizardStore';

/** The beer or wine being added (components/screens/addBeerWine), kept on the device until it's saved. */
export const useBeerWineWizardStore = createWizardStore<BeerWineDraft, BeerWineStep>('beer-wine-wizard', EMPTY_BEER_WINE, 'name');

/** One unsaved beer and one wine per place: 'beer:home', 'wine:<venue id>'. */
export const beerWinePlace = (kind: DrinkKind, barId: string | null | undefined) => `${kind}:${barId || 'home'}`;
