import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';

import { useBarFeatureState } from '@/hooks/useBarFeature';
import type { VenueFeatureKey } from '@/lib/venueFeatures';

/**
 * A venue settings page that belongs to a switch (lib/venueFeatures.ts): with
 * the switch off, a link to it lands on the venue's settings. Nothing shows
 * until the switch is known.
 */
export function BarFeatureGate({ barId, feature, children }: { barId: string; feature: VenueFeatureKey; children: ReactNode }) {
  const on = useBarFeatureState(barId, feature);
  if (on === undefined) return null;
  return on ? children : <Redirect href={`/settings/bar/${barId}`} />;
}
