import { useBeerWineWizardStore } from '@/store/useBeerWineWizardStore';

/** The beer and wine drafts, for clearUserData. With the app on native; the web loads them when asked (beerWineDrafts.web.ts). */
export async function loadBeerWineDrafts() {
  return useBeerWineWizardStore;
}
