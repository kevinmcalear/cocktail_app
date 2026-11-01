import { Stack } from 'expo-router';

import { FridgeScreen } from '@/components/screens/label/FridgeScreen';
import { WebHead } from '@/components/WebHead';

/** In the fridge: the bar's house-made by the day each batch was made (Bet-labels). */
export default function FridgeRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'In the fridge' }} />
      <WebHead>
        <title>In the fridge</title>
      </WebHead>
      <FridgeScreen />
    </>
  );
}
