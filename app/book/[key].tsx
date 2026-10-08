import { Stack } from 'expo-router';

import { BookScreen } from '@/components/screens/book/BookScreen';

/** One of the old cocktail books, by its key ("thomas-1862"). Opened from a drink's From the books section. */
export default function BookRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Book' }} />
      <BookScreen />
    </>
  );
}
