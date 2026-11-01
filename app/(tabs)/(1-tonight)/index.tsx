import { MountOnFocus } from '@/components/nav/MountOnFocus';
import { TonightScreen } from '@/components/screens/tonight/TonightScreen';

/** The Tonight tab's first page: tonight at your bar, or at home (components/screens/tonight). */
export default function TonightTab() {
  return (
    <MountOnFocus>
      <TonightScreen />
    </MountOnFocus>
  );
}
