import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';

import { useMode } from '@/hooks/useMode';
import { useVenueFeatures } from '@/hooks/useVenueFeatures';
import type { VenueFeatureKey } from '@/lib/venueFeatures';

/**
 * A route that belongs to a venue section (lib/venueFeatures.ts): at a venue
 * that hasn't switched it on, a deep link lands on the venue's first tab
 * instead. Nothing shows until the switches are known. Home mode keeps the
 * page as it was.
 */
export function FeatureGate({ feature, children }: { feature: VenueFeatureKey; children: ReactNode }) {
  const venue = useMode().mode === 'venue';
  const { ready, has, home } = useVenueFeatures();
  if (!venue) return children;
  if (!ready) return null;
  return has(feature) ? children : <Redirect href={home} />;
}
