import { Stack } from 'expo-router';

import { MyReportsScreen } from '@/components/screens/safety/MyReportsScreen';

/** Settings › Your reports. */
export default function MyReportsRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Your reports' }} />
      <MyReportsScreen />
    </>
  );
}
