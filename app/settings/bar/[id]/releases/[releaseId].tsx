import { Stack, useLocalSearchParams } from 'expo-router';

import { ReleaseEditorScreen } from '@/components/screens/publishing/ReleaseEditorScreen';

/** Make (releaseId "new") or change one of a venue's releases. */
export default function ReleaseEditorRoute() {
  const { id, releaseId } = useLocalSearchParams<{ id: string; releaseId: string }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ReleaseEditorScreen barId={id} releaseId={releaseId} />
    </>
  );
}
