import { useSegments } from 'expo-router';
import { useState } from 'react';
import { Platform } from 'react-native';

import { AppTabs } from '@/components/nav/AppTabs';
import { useAuth } from '@/ctx/AuthContext';
import { useClaimReturn } from '@/lib/claimReturn';
import { needsOnboarding } from '@/lib/onboarding';

/** Share pages people open from a link (app/d, app/m, app/p). */
const PUBLIC_PAGES = ['d', 'm', 'p'];

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
  // On the web, a share page opened from a link covers the tabs: they draw once
  // someone goes back to them, so the page doesn't load a tab's code (and its
  // data) that nobody sees. Once drawn they stay, keeping each tab's place.
  const top = useSegments()[0] ?? '';
  const covered = Platform.OS === 'web' && PUBLIC_PAGES.includes(top);
  const [shown, setShown] = useState(!covered);
  if (!covered && !shown) setShown(true);
  return shown ? <AppTabs /> : null;
}
