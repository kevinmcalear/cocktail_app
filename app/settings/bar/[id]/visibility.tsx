import { Redirect, useLocalSearchParams } from 'expo-router';

/** Old link: "Who sees your page" lives in Publishing's first section now. */
export default function PageVisibilityRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/settings/bar/${id}/publishing`} />;
}
