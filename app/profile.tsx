import { Redirect, useLocalSearchParams } from 'expo-router';

/** Old links to /profile: You is its own tab. */
export default function ProfileRoute() {
  return <Redirect href={{ pathname: '/you', params: useLocalSearchParams() }} />;
}
