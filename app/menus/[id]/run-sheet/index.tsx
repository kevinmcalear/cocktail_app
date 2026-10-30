import { Stack, useLocalSearchParams } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { RunSheetScreen } from '@/components/screens/runSheet/RunSheetScreen';
import { WebHead } from '@/components/WebHead';

/** A menu's run sheet: serves, swaps for this menu, who brings what, the PDF. In the bar's colours and face, like the menu (tf-078). */
export default function RunSheetRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <VenueBrandProvider>
      <Stack.Screen options={{ headerShown: false, title: 'Run sheet' }} />
      <WebHead>
        <title>Run sheet</title>
      </WebHead>
      <RunSheetScreen menuId={id} />
    </VenueBrandProvider>
  );
}
