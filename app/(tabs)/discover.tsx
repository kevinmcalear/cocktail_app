import { DiscoverScreen } from '@/components/screens/home/DiscoverScreen';
import { MountOnFocus } from '@/components/nav/MountOnFocus';

/** The Discover tab, in both modes. */
export default function DiscoverTab() {
  return (
    <MountOnFocus>
      <DiscoverScreen />
    </MountOnFocus>
  );
}
