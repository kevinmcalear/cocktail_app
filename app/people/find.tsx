import { Stack } from 'expo-router';

import { FindPeopleScreen } from '@/components/screens/people/FindPeopleScreen';

/** Find people: search public pages, and the people on your bars (Kept-people). */
export default function FindPeopleRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Find people' }} />
      <FindPeopleScreen />
    </>
  );
}
