import { Redirect, Stack, useLocalSearchParams } from 'expo-router';

import { PrintPreview } from '@/components/screens/print/PrintPreview';
import { isSheetKind, SHEETS } from '@/components/screens/print/sheets';
import { WebHead } from '@/components/WebHead';

/** One sheet of the print set to look at and print: `/print/<list|run|spec|study|table|poster>?menu=<id>`, `&print=1` to print at once. */
export default function PrintSheetRoute() {
  const { sheet, menu } = useLocalSearchParams<{ sheet: string; menu?: string }>();
  if (!menu || !isSheetKind(sheet)) return <Redirect href="/" />;
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: SHEETS[sheet].label }} />
      <WebHead>
        <title>{SHEETS[sheet].label}</title>
      </WebHead>
      <PrintPreview menuId={menu} kind={sheet} />
    </>
  );
}
