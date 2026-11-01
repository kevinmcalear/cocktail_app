import { NoDrinkPicked } from '@/components/nav/DrinksSplit';
import { MountOnFocus } from '@/components/nav/MountOnFocus';
import { LibraryScreen } from '@/components/screens/LibraryScreen';
import { HomeDrinks } from '@/components/screens/drinks/HomeDrinks';
import { useDrinksSplit } from '@/hooks/useDrinksSplit';
import { useMode } from '@/hooks/useMode';

/**
 * The Drinks tab's first page: the bar's drinks, house-made and bottles at a
 * bar, your drinks, shelf and menus at home (Prod-phone drinks and shelf).
 * On a desktop at a bar the list is the column beside this page (the tab's
 * layout), so the page waits for a pick.
 */
export default function DrinksTab() {
  const home = useMode().mode === 'home';
  const split = useDrinksSplit();
  return <MountOnFocus>{home ? <HomeDrinks /> : split ? <NoDrinkPicked /> : <LibraryScreen />}</MountOnFocus>;
}
