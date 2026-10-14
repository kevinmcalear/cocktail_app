import { Stack, useLocalSearchParams } from 'expo-router';

import { RunSheetScreen } from '@/components/screens/runSheet/RunSheetScreen';
import { WebHead } from '@/components/WebHead';

/** A menu's run sheet: serves, swaps for this menu, who brings what, the PDF. */
export default function RunSheetRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Run sheet' }} />
      <WebHead>
        <title>Run sheet</title>
      </WebHead>
      <RunSheetScreen menuId={id} />
    </>
  );
}
