import { useAuth } from '@/ctx/AuthContext';
import { useIsHydrated } from '@/hooks/useIsHydrated';

// The static export renders Home at build time, so the build machine's hour
// would be baked into the HTML and clash with the device's during hydration.
const HYDRATION_GREETING = 'Hello';

function timeGreeting(hour = new Date().getHours()) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Home's "Good evening, Sam" line, hydration-safe on the static web export. */
export function useHomeGreeting(): string {
  const { user } = useAuth();
  const isHydrated = useIsHydrated();
  const firstName = (user?.user_metadata?.first_name as string | undefined)?.trim();
  const greeting = isHydrated ? timeGreeting() : HYDRATION_GREETING;
  return firstName ? `${greeting}, ${firstName}` : greeting;
}
