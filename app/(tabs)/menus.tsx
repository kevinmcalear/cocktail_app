import { Redirect } from 'expo-router';

/**
 * A hidden tab kept so old links to /menus land somewhere: menus live at
 * /menus/all, opened from Tonight, Library and the side nav.
 */
export default function MenusRoute() {
  return <Redirect href="/menus/all" />;
}
