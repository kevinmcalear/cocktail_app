import { EmailLinkGate } from '@/components/auth/EmailLinkGate';
import { useAuth } from '@/ctx/AuthContext';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator } from 'react-native';
import { Text, YStack, useTheme } from 'tamagui';
import { AuthShell } from '@/components/auth/AuthShell';

/** Landing route for signup confirmation (and other email) redirects. */
export default function AuthCallback() {
  const theme = useTheme();
  const router = useRouter();
  const { session, passwordRecovery, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !session) return;
    if (passwordRecovery) {
      router.replace('/auth/reset-password');
      return;
    }
    router.replace('/(tabs)');
  }, [session, passwordRecovery, authLoading, router]);

  return (
    <EmailLinkGate
      cleanPath="/auth/callback"
      ready={!!session}
      retryHref="/auth/sign-up"
      retryLabel="Create account again"
      waitingTitle="Confirm your email"
      waitingSubtitle="Tap continue to finish signing up."
    >
      <AuthShell title="Signing you in" subtitle="One moment…">
        <YStack alignItems="center" paddingVertical="$4">
          <ActivityIndicator color={theme.color8?.get() as string} />
          <Text marginTop="$3" color="$color11" fontSize={14}>
            Taking you in…
          </Text>
        </YStack>
      </AuthShell>
    </EmailLinkGate>
  );
}
