import { Stack, useLocalSearchParams } from 'expo-router';

import { DrinkLoading } from '@/components/screens/drink/DrinkLoading';
import { PhotosScreen } from '@/components/screens/drink/PhotosScreen';
import { CouldNotLoad } from '@/components/screens/safety/NotAvailable';
import { useCocktail } from '@/hooks/useCocktails';

/** The full-screen photos and shot list (from the service view). */
export default function PhotosRoute() {
  const { id, angle } = useLocalSearchParams<{ id: string; angle?: string }>();
  const query = useCocktail(id);
  const item = query.isPlaceholderData ? undefined : query.data;
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: item ? `${item.name} photos` : 'Photos' }} />
      {query.error ? <CouldNotLoad what="drink" failed={{ retry: () => void query.refetch() }} /> : item ? <PhotosScreen item={item} angle={angle} /> : <DrinkLoading />}
    </>
  );
}
