import { Redirect, Stack, useLocalSearchParams } from 'expo-router';

import { PrintScreen } from '@/components/screens/print/PrintScreen';
import { WebHead } from '@/components/WebHead';

/** Print, for a menu: `/print?menu=<menu id>` (the menu on now, from Tonight's Print tonight's list). */
export default function PrintRoute() {
  const { menu } = useLocalSearchParams<{ menu?: string }>();
  if (!menu) return <Redirect href="/" />;
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Print' }} />
      <WebHead>
        <title>Print</title>
      </WebHead>
      <PrintScreen menuId={menu} />
    </>
  );
}
