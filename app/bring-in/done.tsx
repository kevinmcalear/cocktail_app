import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { Body, useDs } from '@/components/ds';
import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { BroughtIn, type BroughtInView } from '@/components/screens/bringin/BroughtIn';
import { WebHead } from '@/components/WebHead';
import { useBringInBatch } from '@/hooks/useBringInBatches';
import { useBringIn } from '@/store/useBringIn';

function Body_() {
  const ds = useDs();
  const { batch } = useLocalSearchParams<{ batch?: string }>();
  const done = useBringIn((s) => s.done);
  const stored = useBringInBatch(batch ?? null);
  // Just saved: what the save said (with its warnings). Opened from Last time: the batch.
  const fresh = done && (!batch || done.batchId === batch) ? done : null;
  const view: BroughtInView | null = fresh
    ? { ...fresh, barId: stored.data?.barId ?? null, undoneAt: stored.data?.undoneAt ?? null }
    : stored.data
      ? { batchId: stored.data.id, title: stored.data.title, source: stored.data.source, menuId: stored.data.menuId, drinkIds: [], barId: stored.data.barId, summary: stored.data.summary, createdAt: stored.data.createdAt, undoneAt: stored.data.undoneAt }
      : null;
  if (!view) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: ds.c.ground }}>
        {stored.isLoading ? <ActivityIndicator color={ds.accentText} /> : <Body tone="muted">Nothing brought in to show.</Body>}
      </View>
    );
  }
  return <BroughtIn view={view} />;
}

/** Brought in: what a bring-in made, with Undo all until tomorrow. */
export default function BroughtInRoute() {
  return (
    <VenueBrandProvider>
      <Stack.Screen options={{ headerShown: false, title: 'Brought in' }} />
      <WebHead>
        <title>Brought in</title>
      </WebHead>
      <Body_ />
    </VenueBrandProvider>
  );
}
