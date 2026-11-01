import { MountOnFocus } from '@/components/nav/MountOnFocus';
import { LibraryScreen } from '@/components/screens/LibraryScreen';
import { CollectionScreen } from '@/components/screens/home/CollectionScreen';
import { useMode } from '@/hooks/useMode';

/** The Drinks tab's first page: the venue's library at a venue, your collection at home, until the Drinks lane draws both. */
export default function DrinksTab() {
  const home = useMode().mode === 'home';
  return <MountOnFocus>{home ? <CollectionScreen /> : <LibraryScreen />}</MountOnFocus>;
}
