import { Redirect, useLocalSearchParams } from 'expo-router';

/** Old links to /bar: My Bar is the Tonight tab now (at home). */
export default function BarRoute() {
  return <Redirect href={{ pathname: '/', params: useLocalSearchParams() }} />;
}
