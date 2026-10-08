import { CollectionScreen } from '@/components/screens/home/CollectionScreen';
import { MountOnFocus } from '@/components/nav/MountOnFocus';

/** The Collection tab, in home mode. */
export default function Collection() {
  return (
    <MountOnFocus>
      <CollectionScreen />
    </MountOnFocus>
  );
}
