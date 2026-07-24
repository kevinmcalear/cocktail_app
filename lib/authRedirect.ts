import { Platform } from 'react-native';

const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL || 'https://babyvom.it').replace(/\/$/, '');

/** Redirect target for signup confirm + password recovery emails. */
export function getAuthRedirectTo(path: '/auth/reset-password' | '/auth/callback' = '/auth/callback') {
  // On web, stay on whatever origin you're actually using (prod, preview, localhost).
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}${path}`;
  }
  // Native emails need an https allowlisted URL — custom schemes get mangled in many clients.
  return `${SITE_URL}${path}`;
}
