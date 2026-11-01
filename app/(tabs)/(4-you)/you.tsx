import { MountOnFocus } from '@/components/nav/MountOnFocus';
import { YouScreen } from '@/components/screens/profile/YouScreen';

/** The You tab: your profile, with Settings behind its gear. */
export default function YouTab() {
  return (
    <MountOnFocus>
      <YouScreen />
    </MountOnFocus>
  );
}
