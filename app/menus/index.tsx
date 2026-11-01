import { Redirect } from 'expo-router';

/** Old links to the Menus tab: Menus is a page now, opened from Tonight, Drinks and the venue menu. */
export default function MenusRoute() {
  return <Redirect href="/menus/all" />;
}
