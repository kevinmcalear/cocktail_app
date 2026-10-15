import { DiscoverScreen } from '@/components/screens/home/DiscoverScreen';
import { MountOnFocus } from '@/components/nav/MountOnFocus';
import { useRoundVisit } from '@/hooks/useFirstRound';

/** The Discover tab, in both modes. */
export default function DiscoverTab() {
  useRoundVisit('discover');
  return (
    <MountOnFocus>
      <DiscoverScreen />
    </MountOnFocus>
  );
}
