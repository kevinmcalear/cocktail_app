import { Redirect, useLocalSearchParams } from 'expo-router';

/** Old links to /bar: My Bar is your shelf now, opened from Tonight at home. */
export default function BarRoute() {
  return <Redirect href={{ pathname: '/shelf', params: useLocalSearchParams() }} />;
}
