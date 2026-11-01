import { Redirect, useLocalSearchParams } from 'expo-router';

/** Old links to the service view: the drink page itself is the spec at the bar now. */
export default function ServiceRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: '/cocktail/[id]', params: { id } }} />;
}
