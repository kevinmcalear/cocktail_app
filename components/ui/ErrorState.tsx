import { useNetInfo } from '@react-native-community/netinfo';
import { Button, Text, YStack } from 'tamagui';

/** Friendly load-failure state with a retry, instead of a raw error dump. */
export function ErrorState({
  title = "Couldn't load this",
  onRetry,
}: {
  title?: string;
  onRetry?: () => void;
}) {
  const netInfo = useNetInfo();
  const offline = netInfo.isConnected === false;

  return (
    <YStack alignItems="center" gap="$3" paddingVertical="$8" paddingHorizontal="$6">
      <Text fontSize={18} fontWeight="700" color="$color" textAlign="center">
        {title}
      </Text>
      <Text fontSize={15} color="$color11" textAlign="center">
        {offline
          ? "You're offline and this isn't saved on this device yet."
          : 'Something went wrong on our side. Try again in a moment.'}
      </Text>
      {onRetry ? (
        <Button
          onPress={onRetry}
          marginTop="$2"
          backgroundColor="$color8"
          borderRadius={12}
          minHeight={44}
          paddingHorizontal="$5"
          role="button"
        >
          <Text color="$background" fontWeight="700" fontSize={15}>
            Try again
          </Text>
        </Button>
      ) : null}
    </YStack>
  );
}
