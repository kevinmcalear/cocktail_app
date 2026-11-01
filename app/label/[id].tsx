import { Stack, useLocalSearchParams } from 'expo-router';

import { LabelScreen, type LabelParams } from '@/components/screens/label/LabelScreen';
import { WebHead } from '@/components/WebHead';

/** A batch's label: `/label/<batch id>`, with `?item&amount&unit&made` when it was just logged (labelHref). */
export default function LabelRoute() {
  const params = useLocalSearchParams<Omit<LabelParams, 'id'> & { id: string }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Label' }} />
      <WebHead>
        <title>Label</title>
      </WebHead>
      <LabelScreen {...params} />
    </>
  );
}
