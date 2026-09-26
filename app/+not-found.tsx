import { Link, Stack } from 'expo-router';
import { WebHead } from '@/components/WebHead';
import { Text, YStack } from 'tamagui';

import { BRAND } from '@/constants/brand';

export default function NotFound() {
  return (
    <YStack flex={1} alignItems="center" justifyContent="center" padding="$6" gap="$3" backgroundColor="$background">
      <Stack.Screen options={{ title: 'Not found' }} />
      <WebHead>
        <title>{`Page not found · ${BRAND.productName}`}</title>
      </WebHead>
      <Text fontSize={28} fontWeight="700" color="$color" role="heading">
        Page not found
      </Text>
      <Text fontSize={16} color="$color11" textAlign="center" maxWidth={360}>
        This link doesn&apos;t go anywhere. It may be old, or the drink or menu may have been removed.
      </Text>
      <Link href="/">
        <Text fontSize={16} fontWeight="600" color="$color8">
          Go to home
        </Text>
      </Link>
    </YStack>
  );
}
