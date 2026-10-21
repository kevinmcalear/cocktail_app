import { Stack, useLocalSearchParams } from 'expo-router';

import { DrinkLoading } from '@/components/screens/drink/DrinkLoading';
import { ServiceView } from '@/components/screens/drink/ServiceView';
import { CouldNotLoad } from '@/components/screens/safety/NotAvailable';
import { useCocktail } from '@/hooks/useCocktails';

/** The full-screen service view for a drink (Open the service view, on its page). */
export default function ServiceRoute() {
  const { id, angle } = useLocalSearchParams<{ id: string; angle?: string }>();
  const query = useCocktail(id);
  const item = query.isPlaceholderData ? undefined : query.data;
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: item ? `${item.name} service` : 'Service' }} />
      {query.error ? <CouldNotLoad what="drink" failed={{ retry: () => void query.refetch() }} /> : item ? <ServiceView item={item} angle={angle} /> : <DrinkLoading />}
    </>
  );
}
