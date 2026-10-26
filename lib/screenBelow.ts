/** Enough of a stack's navigation state to see what's under the top screen. */
interface StackState {
  index: number;
  routes: readonly { name: string; params?: object }[];
}

/**
 * The route under the screen on top of a stack, or null when nothing real is
 * there. Opened from a link (a cold start, or a page loaded on the web), the
 * router puts the root layout's anchor, (tabs), under the page with the page's
 * own params copied onto it (expo-router getStateFromPath, createStateObject):
 * nobody came from there, so Back shouldn't go there either.
 * ponytail: leans on expo-router copying those params (58.0.25); if an upgrade
 * stops, a cold link's Back goes to the tabs again (screenBelow.check.ts can't
 * see it). Upgrade path: a shared back helper that knows how the app opened.
 */
export function screenBelow(state: StackState | undefined, own: Record<string, string>) {
  const below = state?.routes[state.index - 1];
  if (!below) return null;
  const params = (below.params ?? {}) as Record<string, unknown>;
  const keys = Object.keys(own);
  const copied = keys.length > 0 && keys.every((k) => params[k] === own[k]);
  return copied ? null : { name: below.name, params };
}
