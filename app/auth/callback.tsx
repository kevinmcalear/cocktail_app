import { EmailLinkGate } from '@/components/auth/EmailLinkGate';
import { useAuth } from '@/ctx/AuthContext';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { AuthShell, AuthSpinner } from '@/components/auth/AuthShell';

/** Landing route for signup confirmation (and other email) redirects. */
export default function AuthCallback() {
  const router = useRouter();
  const { session, passwordRecovery, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !session) return;
    if (passwordRecovery) {
      router.replace('/auth/reset-password');
      return;
    }
    // Mostly sign-up confirmations: the age check first. It passes straight
    // on when the account has already answered it.
    router.replace('/age-check');
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
        <AuthSpinner label="Taking you in…" />
      </AuthShell>
    </EmailLinkGate>
  );
}
