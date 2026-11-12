import { useLocalSearchParams, useRouter } from 'expo-router';

import { SignInScreen } from '@/components/auth/SignInScreen';
import { Welcome } from '@/components/auth/Welcome';

/**
 * Signed out: Welcome first (canvas Prod-first, 1), then the email and its
 * code at ?step=email, its own history entry, so a phone's or browser's Back
 * returns to Welcome as the screen's own Back does.
 */
export default function Login() {
  const router = useRouter();
  const { step } = useLocalSearchParams<{ step?: string }>();
  if (step !== 'email') return <Welcome onEmail={() => router.push('/auth/login?step=email')} />;
  return <SignInScreen onBack={() => (router.canGoBack() ? router.back() : router.replace('/auth/login'))} />;
}
