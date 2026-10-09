import { Redirect, useLocalSearchParams, type Href } from 'expo-router';

import { editModeRedirect } from '@/lib/legacyCreatorRoutes';

/** The old Creator Hub. Old links land on Drafts, an adder or the item's page. */
export default function EditModeRedirect() {
  const params = useLocalSearchParams<{ create?: string; barId?: string; name?: string; type?: string; id?: string }>();
  return <Redirect href={editModeRedirect(params) as Href} />;
}
