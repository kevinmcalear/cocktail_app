import { Stack, useLocalSearchParams } from 'expo-router';

import { RunSheetPrint } from '@/components/screens/runSheet/RunSheetPrint';
import { WebHead } from '@/components/WebHead';

/** The run sheet as a bare page, to print or save as a PDF. */
export default function RunSheetPrintRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Run sheet' }} />
      <WebHead>
        <title>Run sheet</title>
      </WebHead>
      <RunSheetPrint menuId={id} />
    </>
  );
}
