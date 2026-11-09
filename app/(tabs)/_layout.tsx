import { AppTabs } from '@/components/nav/AppTabs';
import { useAuth } from '@/ctx/AuthContext';
import { useClaimReturn } from '@/lib/claimReturn';
import { needsOnboarding } from '@/lib/onboarding';
import { TABS } from '@/lib/tabs';

/**
 * Under a page opened by a link from outside the tabs (a create wizard's
 * dialog, Settings), the tabs start where the app opens: the first tab, `/`,
 * which sends a venue without Tonight on to Drinks ((1-tonight)/index.tsx).
 */
export const unstable_settings = { anchor: TABS[0].route };

/**
 * The tabs: native tabs on iPhone and Android (AppTabs.tsx), and the JS tabs
 * (JsTabs.tsx) on the web and a wide iPad: the glass tab bar on phone-width
 * web, the side nav on wide screens.
 * Just signed in from "Claim it on your phone": the app opens on that claim
 * (find-yourself step 4; a new account gets it at Setup's find step).
 */
export default function TabLayout() {
  // A confirmed session, not the saved user, and past Setup: the tabs sit under every
  // route (the stack's anchor), so they mount before sign-in or the age check send someone on.
  const { session } = useAuth();
  useClaimReturn(!!session && !needsOnboarding(session.user.user_metadata));
  return <AppTabs />;
}
