import { AuthShell } from '@/components/auth/AuthShell';
import { useAuth } from '@/ctx/AuthContext';
import { createSessionFromUrl } from '@/lib/createSessionFromUrl';
import { Link, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';
import { Text, YStack, useTheme } from 'tamagui';

/** Landing route for signup confirmation (and other email) redirects. */
export default function AuthCallback() {
  const theme = useTheme();
  const router = useRouter();
  const { session, passwordRecovery, loading: authLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const url = await Linking.getInitialURL();
      // Web: detectSessionInUrl already ran; native / hash fallbacks still need this
      if (url) {
        try {
          await createSessionFromUrl(url);
        } catch (e: any) {
          if (!cancelled) setError(e?.message || 'Could not complete sign-in from link.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (authLoading || error) return;
    if (passwordRecovery) {
      router.replace('/auth/reset-password');
      return;
    }
    if (session) router.replace('/(tabs)');
  }, [session, passwordRecovery, authLoading, error, router]);

  if (error) {
    return (
      <AuthShell
        title="Link expired"
        subtitle={error}
        footer={
          <Link href="/auth/login" asChild>
            <Pressable>
              <Text color="$color8" fontSize={14} fontWeight="700">
                Back to sign in
              </Text>
            </Pressable>
          </Link>
        }
      >
        <Text fontSize={14} color="$color11">
          Request a new confirmation or reset email and try again.
        </Text>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Signing you in" subtitle="One moment…">
      <YStack alignItems="center" paddingVertical="$4">
        <ActivityIndicator color={theme.color8?.get() as string} />
      </YStack>
    </AuthShell>
  );
}
