import { Redirect, useLocalSearchParams } from 'expo-router';

/** Old links to the service photos: they live on the drink page and in its editor now. */
export default function PhotosRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: '/cocktail/[id]', params: { id } }} />;
}
