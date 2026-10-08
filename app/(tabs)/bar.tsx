import { MyBarScreen } from '@/components/screens/home/MyBarScreen';
import { MountOnFocus } from '@/components/nav/MountOnFocus';

/** The My Bar tab, in home mode. */
export default function MyBar() {
  return (
    <MountOnFocus>
      <MyBarScreen />
    </MountOnFocus>
  );
}
