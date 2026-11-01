import { Redirect, useLocalSearchParams } from 'expo-router';

/** Old links to /new: New is the + now, not a tab. */
export default function NewRoute() {
  return <Redirect href={{ pathname: '/', params: useLocalSearchParams() }} />;
}
