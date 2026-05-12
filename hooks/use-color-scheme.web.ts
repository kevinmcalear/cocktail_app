import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();

  if (typeof window !== 'undefined') {
    // On the client, return the actual system preference immediately.
    // This may cause a hydration mismatch in React 18+ (dev only),
    // but ensures the user's preferred theme is respected without a flash.
    return colorScheme ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}
