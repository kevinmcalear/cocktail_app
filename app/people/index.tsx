import { Stack } from 'expo-router';

import { PeopleScreen } from '@/components/screens/people/PeopleScreen';

/** You › People: who you follow and who follows you (Kept-people). ?tab=followers opens Followers. */
export default function PeopleRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'People' }} />
      <PeopleScreen />
    </>
  );
}
