import { AuthMessage, AuthShell } from '@/components/auth/AuthShell';
import {
  clearAuthParamsFromUrl,
  getIncomingAuthUrl,
  inspectAuthUrl,
  type AuthLinkState,
} from '@/lib/authLink';
import { createSessionFromUrl } from '@/lib/createSessionFromUrl';
import { Link } from 'expo-router';
import { ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';
import { Button, Text, YStack, useTheme } from 'tamagui';

type Props = {
  /** Path to keep in the address bar after a successful exchange */
  cleanPath: string;
  /** Already have a usable session (e.g. recovery) */
  ready: boolean;
  children: ReactNode;
  /** Where to send people who need a fresh email */
  retryHref: '/auth/forgot-password' | '/auth/sign-up' | '/auth/login';
  retryLabel: string;
  waitingTitle?: string;
  waitingSubtitle?: string;
};

/**
 * Email scanners / link previews burn one-time Supabase verify URLs.
 * We land with token_hash (or code) and only exchange on an explicit tap.
 */
export function EmailLinkGate({
  cleanPath,
  ready,
  children,
  retryHref,
  retryLabel,
  waitingTitle = 'Continue',
  waitingSubtitle = 'Tap below to finish — this keeps email previews from burning the link.',
}: Props) {
  const theme = useTheme();
  const [link, setLink] = useState<AuthLinkState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getIncomingAuthUrl().then((url) => setLink(inspectAuthUrl(url)));
  }, []);

  if (ready) return <>{children}</>;

  if (!link) {
    return (
      <AuthShell title="One moment…" subtitle="Checking your link.">
        <YStack alignItems="center" paddingVertical="$4">
          <ActivityIndicator color={theme.color8?.get() as string} />
        </YStack>
      </AuthShell>
    );
  }

  const showError = error || link.error;

  if (showError) {
    return (
      <AuthShell
        title="Link expired"
        subtitle={showError}
        footer={
          <Link href="/auth/login" asChild>
            <Pressable>
              <Text color="$color11" fontSize={14}>
                Back to sign in
              </Text>
            </Pressable>
          </Link>
        }
      >
        <Link href={retryHref} asChild>
          <Button backgroundColor="$color8" borderRadius={8} height={44}>
            <Text color="$backgroundStrong" fontWeight="700" fontSize={15}>
              {retryLabel}
            </Text>
          </Button>
        </Link>
      </AuthShell>
    );
  }

  if (!link.hasCredential) {
    return (
      <AuthShell
        title="Link required"
        subtitle="Open the link from your email to continue."
        footer={
          <Link href="/auth/login" asChild>
            <Pressable>
              <Text color="$color11" fontSize={14}>
                Back to sign in
              </Text>
            </Pressable>
          </Link>
        }
      >
        <Link href={retryHref} asChild>
          <Button backgroundColor="$color8" borderRadius={8} height={44}>
            <Text color="$backgroundStrong" fontWeight="700" fontSize={15}>
              {retryLabel}
            </Text>
          </Button>
        </Link>
      </AuthShell>
    );
  }

  const continueFromEmail = async () => {
    if (!link.url) return;
    setBusy(true);
    setError(null);
    try {
      await createSessionFromUrl(link.url);
      clearAuthParamsFromUrl(cleanPath);
    } catch (e: any) {
      setError(e?.message || 'Could not open this link.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title={waitingTitle} subtitle={waitingSubtitle}>
      <YStack gap="$3">
        {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}
        <Button
          backgroundColor="$color8"
          onPress={continueFromEmail}
          disabled={busy}
          borderRadius={8}
          height={44}
          opacity={busy ? 0.7 : 1}
        >
          {busy ? (
            <ActivityIndicator color={theme.backgroundStrong?.get() as string} />
          ) : (
            <Text color="$backgroundStrong" fontWeight="700" fontSize={15}>
              Continue
            </Text>
          )}
        </Button>
      </YStack>
    </AuthShell>
  );
}
