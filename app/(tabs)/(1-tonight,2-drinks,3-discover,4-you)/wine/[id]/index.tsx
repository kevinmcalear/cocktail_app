import { useLocalSearchParams } from 'expo-router';

import { BeerWineScreen } from '@/components/screens/drink/KindRoutesLazy';
import { InMenu } from '@/components/screens/menus/pager/InMenu';

/** Opened from a menu (?menu=), the page carries the menu's pager (Menu-pager). */
export default function WineDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <InMenu itemId={id}>
      <BeerWineScreen kind="wine" />
    </InMenu>
  );
}
