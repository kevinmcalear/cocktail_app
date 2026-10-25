import { MyBarScreen } from '@/components/screens/home/MyBarScreen';
import { MountOnFocus } from '@/components/nav/MountOnFocus';
import { RunningLowProvider } from '@/components/screens/shopping/ToBuy';

/** The My Bar tab, in home mode. */
export default function MyBar() {
  return (
    <MountOnFocus>
      <RunningLowProvider>
        <MyBarScreen />
      </RunningLowProvider>
    </MountOnFocus>
  );
}
