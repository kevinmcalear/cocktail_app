import { Redirect, useLocalSearchParams } from 'expo-router';

/** Old links to /collection: your drinks and menus are the Drinks tab at home now. */
export default function CollectionRoute() {
  return <Redirect href={{ pathname: '/drinks', params: useLocalSearchParams() }} />;
}
