import { VenueFeatures } from '@/components/bar/VenueFeatures';
import { Body } from '@/components/ds';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useEffectiveRole } from '@/hooks/useViewAs';
import { canSwitchFeatures } from '@/lib/venueFeatureList';

import { VenueSubPage } from './VenueSubPage';

/**
 * A venue's Features, under its settings: which sections the team sees
 * (lib/venueFeatures.ts). Its Admins switch them; everyone else is told who can.
 */
export function FeaturesScreen({ barId }: { barId: string }) {
  const name = useActiveVenue().venues.find((v) => v.id === barId)?.name ?? 'your venue';
  const admin = canSwitchFeatures(useEffectiveRole(barId));
  return (
    <VenueSubPage barId={barId} title="Features">
      {admin ? <VenueFeatures barId={barId} venueName={name} /> : <Body tone="muted">Only Admins can switch features on and off.</Body>}
    </VenueSubPage>
  );
}
