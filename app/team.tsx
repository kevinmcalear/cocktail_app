import { Stack } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { TeamScreen } from '@/components/screens/team/TeamScreen';
import { WebHead } from '@/components/WebHead';

/** The venue's team. Employee and above, from the sidebar. */
export default function TeamRoute() {
  return (
    <VenueBrandProvider>
      <Stack.Screen options={{ headerShown: false, title: 'My team' }} />
      <WebHead>
        <title>My team</title>
      </WebHead>
      <TeamScreen />
    </VenueBrandProvider>
  );
}
