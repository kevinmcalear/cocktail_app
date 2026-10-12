import { Stack } from 'expo-router';

import { WhatPeopleSeeScreen } from '@/components/screens/profile/SharingChoices';

/** Settings › Public profile › What people see. */
export default function ProfileSharingRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'What people see' }} />
      <WhatPeopleSeeScreen />
    </>
  );
}
