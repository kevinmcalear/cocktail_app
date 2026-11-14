import { Stack, useLocalSearchParams } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { TakeoverScreen } from '@/components/screens/takeover/TakeoverScreen';
import { WebHead } from '@/components/WebHead';

/** A takeover's page both bars share: /takeover/<the takeover list's menu id>. */
export default function TakeoverRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <VenueBrandProvider>
      <Stack.Screen options={{ headerShown: false, title: 'Takeover' }} />
      <WebHead>
        <title>Takeover</title>
      </WebHead>
      <TakeoverScreen id={id} />
    </VenueBrandProvider>
  );
}
