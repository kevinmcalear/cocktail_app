import { YouScreen } from '@/components/screens/profile/YouScreen';
import { MountOnFocus } from '@/components/nav/MountOnFocus';

/** The home sidebar's You on wide web (phones open /you from the avatar). Settings are behind its gear. */
export default function You() {
  return (
    <MountOnFocus>
      <YouScreen />
    </MountOnFocus>
  );
}
