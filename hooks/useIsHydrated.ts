import { useSyncExternalStore } from 'react';

const subscribeNoop = () => () => {};

/**
 * False while static rendering and while React hydrates that HTML, true after.
 * React uses the server snapshot for the hydration pass and then re-renders with
 * the client one, so values that differ between the build and the device (the
 * color scheme, the time of day) can render the build's value first and the
 * real one in an ordinary update. Hydration does not patch mismatched
 * attributes, and a text mismatch throws away the tree and re-renders it.
 * Components that mount later (not hydrating), and all of native, get true on
 * their first render.
 */
export function useIsHydrated(): boolean {
    return useSyncExternalStore(subscribeNoop, () => true, () => false);
}
