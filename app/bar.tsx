import { Redirect, useLocalSearchParams } from 'expo-router';

/** Old links to /bar: My Bar is your shelf now, Drinks' Shelf at home. */
export default function BarRoute() {
  return <Redirect href={{ pathname: '/drinks', params: { ...useLocalSearchParams(), tab: 'shelf' } }} />;
}
