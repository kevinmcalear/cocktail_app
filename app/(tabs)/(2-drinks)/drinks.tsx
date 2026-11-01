import { NoDrinkPicked } from '@/components/nav/DrinksSplit';
import { MountOnFocus } from '@/components/nav/MountOnFocus';
import { LibraryScreen } from '@/components/screens/LibraryScreen';
import { CollectionScreen } from '@/components/screens/home/CollectionScreen';
import { useDrinksSplit } from '@/hooks/useDrinksSplit';
import { useMode } from '@/hooks/useMode';

/**
 * The Drinks tab's first page: the venue's library at a venue, your collection at home, until the Drinks lane draws both.
 * On a desktop at a venue the library is the list beside this page (the tab's layout), so the page waits for a pick.
 */
export default function DrinksTab() {
  const home = useMode().mode === 'home';
  const split = useDrinksSplit();
  return <MountOnFocus>{home ? <CollectionScreen /> : split ? <NoDrinkPicked /> : <LibraryScreen />}</MountOnFocus>;
}
