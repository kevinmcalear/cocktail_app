import { Redirect, useLocalSearchParams } from 'expo-router';

/** Old links to /library: Library is the Drinks tab now (at a venue). */
export default function LibraryRoute() {
  return <Redirect href={{ pathname: '/drinks', params: useLocalSearchParams() }} />;
}
