import { Stack } from 'expo-router';

import { ShoppingScreen } from '@/components/screens/shopping/ShoppingScreen';
import { WebHead } from '@/components/WebHead';

/** My Bar > Shopping: the shopping list. */
export default function ShoppingRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Shopping' }} />
      <WebHead>
        <title>Shopping</title>
      </WebHead>
      <ShoppingScreen />
    </>
  );
}
