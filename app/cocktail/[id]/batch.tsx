import { Redirect, useLocalSearchParams } from 'expo-router';

/** Old links to the Batch screen: Batch is a sheet on the drink page now, so open the drink with it up. */
export default function BatchRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: '/cocktail/[id]', params: { id, batch: '1' } }} />;
}
