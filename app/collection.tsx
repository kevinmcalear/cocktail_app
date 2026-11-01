import { Redirect, useLocalSearchParams } from 'expo-router';

/** Old links to /collection: Collection is the Drinks tab now (at home). */
export default function CollectionRoute() {
  return <Redirect href={{ pathname: '/drinks', params: useLocalSearchParams() }} />;
}
