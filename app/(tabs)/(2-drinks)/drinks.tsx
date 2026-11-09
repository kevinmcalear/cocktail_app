import { NoDrinkPicked } from '@/components/nav/NoDrinkPicked';
import { MountOnFocus } from '@/components/nav/MountOnFocus';
import { useStartTabUnder } from '@/components/nav/useStartTabUnder';
import { StaffDrinks } from '@/components/screens/drinks/StaffDrinks';
import { HomeDrinks } from '@/components/screens/drinks/HomeDrinks';
import { useDrinksSplit } from '@/hooks/useDrinksSplit';
import { useMode } from '@/hooks/useMode';

/**
 * The Drinks tab's first page: the bar's drinks, house-made and bottles at a
 * bar, your drinks, shelf and menus at home (Prod-phone drinks and shelf).
 * On a desktop at a bar the list is the column beside this page (the tab's
 * layout), so the page shows its first row until one is picked.
 */
export default function DrinksTab() {
  useStartTabUnder('/drinks');
  const home = useMode().mode === 'home';
  const split = useDrinksSplit();
  return <MountOnFocus>{home ? <HomeDrinks /> : split ? <NoDrinkPicked /> : <StaffDrinks />}</MountOnFocus>;
}
