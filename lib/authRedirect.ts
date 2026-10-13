import { Platform } from 'react-native';

import { isDesktopShell } from '@/lib/desktopShell';

const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL || 'https://babyvom.it').replace(/\/$/, '');

/** The origin email links go back to. */
export function getAuthSite() {
  // On web, stay on whatever origin you're actually using (prod, preview, localhost).
  // The desktop shell's origin isn't reachable from an email, so it uses the site.
  if (Platform.OS === 'web' && typeof window !== 'undefined' && !isDesktopShell()) {
    return window.location.origin;
  }
  // Native emails need an https allowlisted URL — custom schemes get mangled in many clients.
  return SITE_URL;
}

/** Where the sign-in email's link lands. */
export function getAuthRedirectTo(path: '/auth/callback' = '/auth/callback') {
  return `${getAuthSite()}${path}`;
}
