import { EmailLinkGate } from '@/components/auth/EmailLinkGate';
import { useAuth } from '@/ctx/AuthContext';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { AuthShell, AuthSpinner } from '@/components/auth/AuthShell';

/** Landing route for the sign-in email's link (and an invite's). */
export default function AuthCallback() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !session) return;
    // The sign-in email's link (or an invite's): the age check first. It
    // passes straight on when the account has already answered it.
    router.replace('/age-check');
  }, [session, authLoading, router]);

  return (
    <EmailLinkGate
      cleanPath="/auth/callback"
      ready={!!session}
      retryHref="/auth/login"
      retryLabel="Get a new code"
      waitingTitle="Sign in"
      waitingSubtitle="Tap continue to finish signing in."
    >
      <AuthShell title="Signing you in" subtitle="One moment…">
        <AuthSpinner label="Taking you in…" />
      </AuthShell>
    </EmailLinkGate>
  );
}
