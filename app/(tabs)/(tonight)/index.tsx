import { MountOnFocus } from '@/components/nav/MountOnFocus';
import { TonightScreen } from '@/components/screens/TonightScreen';
import { MyBarScreen } from '@/components/screens/home/MyBarScreen';
import { useMode } from '@/hooks/useMode';

/**
 * The Tonight tab's first page: the venue's night at a venue, and at home
 * My Bar (the home Tonight board leads with "from your shelf") until the
 * Tonight lane draws both.
 */
export default function TonightTab() {
  const home = useMode().mode === 'home';
  return <MountOnFocus>{home ? <MyBarScreen /> : <TonightScreen />}</MountOnFocus>;
}
