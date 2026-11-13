/**
 * The new drink's save (hooks/useCreateDrink.ts), loaded when a waiting one
 * sends rather than in every page's first load (lib/react-query.ts). Its own
 * file so a test can stand in for it (Jest can't run import()).
 */
export const loadDrinkSave = () => import('@/hooks/useCreateDrink');
/** Putting a drink made offline in its menu section (hooks/madeForSection.ts): loaded the same way, for the same reason. */
export const loadMadeForSection = () => import('@/hooks/madeForSection');
