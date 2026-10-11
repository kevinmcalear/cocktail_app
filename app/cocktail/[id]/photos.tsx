import { Stack, useLocalSearchParams } from 'expo-router';

import { ErrorState } from '@/components/ui/ErrorState';
import { DrinkLoading } from '@/components/screens/drink/DrinkLoading';
import { PhotosScreen } from '@/components/screens/drink/PhotosScreen';
import { useCocktail } from '@/hooks/useCocktails';

/** The full-screen photos and shot list (from the service view and the desktop inspector). */
export default function PhotosRoute() {
  const { id, angle } = useLocalSearchParams<{ id: string; angle?: string }>();
  const query = useCocktail(id);
  const item = query.isPlaceholderData ? undefined : query.data;
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: item ? `${item.name} photos` : 'Photos' }} />
      {query.error ? <ErrorState title="Couldn't load this drink" onRetry={() => void query.refetch()} /> : item ? <PhotosScreen item={item} angle={angle} /> : <DrinkLoading />}
    </>
  );
}
