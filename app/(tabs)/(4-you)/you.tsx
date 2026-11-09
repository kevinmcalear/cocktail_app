import { MountOnFocus } from '@/components/nav/MountOnFocus';
import { useStartTabUnder } from '@/components/nav/useStartTabUnder';
import { YouScreen } from '@/components/screens/profile/YouScreen';

/** The You tab: your profile, with Settings behind its gear. */
export default function YouTab() {
  useStartTabUnder('/you');
  return (
    <MountOnFocus>
      <YouScreen />
    </MountOnFocus>
  );
}
