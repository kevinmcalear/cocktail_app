import type { loadBeerWineDrafts as Native } from './beerWineDrafts';

/**
 * On the web the beer and wine drafts load on a sign-out, not with the root
 * layout: the store brings the beer and wine wizard (lib/beerWineWizard),
 * which only the add flow's own chunk needs, and every page would otherwise
 * carry it at first load.
 */
export const loadBeerWineDrafts: typeof Native = async () => (await import('@/store/useBeerWineWizardStore')).useBeerWineWizardStore;
