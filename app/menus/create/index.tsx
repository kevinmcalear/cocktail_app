import { Redirect, useLocalSearchParams, type Href } from 'expo-router';

import { menuCreateRedirect } from '@/lib/legacyCreatorRoutes';

/** The old menu creator. Without this, /menus/create would open as a menu called "create". */
export default function MenuCreateRedirect() {
  const params = useLocalSearchParams<{ menuId?: string; draftId?: string }>();
  return <Redirect href={menuCreateRedirect(params) as Href} />;
}
