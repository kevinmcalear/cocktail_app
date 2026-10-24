import { VenueFeatures } from '@/components/bar/VenueFeatures';
import { Body } from '@/components/ds';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useEffectiveRole } from '@/hooks/useViewAs';

import { VenueSubPage } from './VenueSubPage';

// Admin, the level that can switch a venue's features (lib/roles.ts).
const ADMIN = 40;

/**
 * A venue's Features on a page of their own, beside Venue settings in the
 * venue menu and the sidebar (venue-menu proposal, 24 Oct 2026): the
 * switches and Try it, for its Admins.
 */
export function FeaturesScreen({ barId }: { barId: string }) {
  const name = useActiveVenue().venues.find((v) => v.id === barId)?.name ?? 'your venue';
  const admin = useEffectiveRole(barId) >= ADMIN;
  return (
    <VenueSubPage barId={barId} title="Features" crumb={false}>
      {admin ? <VenueFeatures barId={barId} venueName={name} /> : <Body tone="muted">Only Admins can switch features on and off.</Body>}
    </VenueSubPage>
  );
}
