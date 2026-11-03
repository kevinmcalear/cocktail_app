import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-contrast: more)';

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

/** Whether the browser asks for more contrast (the system's Increase Contrast). The static export renders without it. */
export function useMoreContrast(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
