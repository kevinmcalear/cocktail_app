import { Redirect, useLocalSearchParams } from 'expo-router';

/** Old links to /library: the bar's drinks are the Drinks tab now. */
export default function LibraryRoute() {
  return <Redirect href={{ pathname: '/drinks', params: useLocalSearchParams() }} />;
}
