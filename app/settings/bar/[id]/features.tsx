import { Redirect, useLocalSearchParams } from 'expo-router';

/** Old links to a venue's Features: the switches are gone (31 Oct), so open the venue's settings. */
export default function FeaturesRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: '/settings/bar/[id]', params: { id } }} />;
}
