import { useRootNavigationState } from 'expo-router';
import { useWindowDimensions } from 'react-native';

import { layout } from '@/constants/tokens';

import { isSeeThrough } from './seeThrough';

/** A navigator's state, as far as finding the route in focus goes. */
type Nav = { index?: number; routes: { name: string; state?: unknown }[] };

/**
 * A wide window with a create wizard's dialog open (seeThrough.ts): the page
 * under it shows, so MountOnFocus keeps it mounted and unfrozen. Narrower,
 * the wizard is a whole page and the tab under it can freeze as usual
 * (the dialog is desktop-wide only: AddIngredientRoute, AddBeerWineRoute).
 */
export function useUnderSeeThrough(): boolean {
  const desktop = useWindowDimensions().width >= layout.breakpoints.desktop;
  // The root's state nests each navigator's in the route showing it: walk down the routes in focus.
  let state: Nav | undefined = useRootNavigationState();
  while (desktop && state) {
    const route = state.routes[state.index ?? state.routes.length - 1];
    if (isSeeThrough(route?.name)) return true;
    state = route?.state as Nav | undefined;
  }
  return false;
}
