import { Platform } from 'react-native';

import { isDesktopShell } from '@/lib/desktopShell';

const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL || 'https://babyvom.it').replace(/\/$/, '');
const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');

/** The site staff links point at: the current origin on web, the public site on native and desktop. */
export function siteOrigin(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && !isDesktopShell()) {
    return window.location.origin;
  }
  return SITE_URL;
}

/** The link a venue shares with its staff: sign in and install the venue's own app. */
export function venueStaffUrl(slug: string): string {
  return `${siteOrigin()}/v/${slug}`;
}

/** The venue's install manifest, served by the venue-app edge function. */
export function venueManifestUrl(slug: string): string {
  const params = new URLSearchParams({ slug, origin: siteOrigin() });
  return `${SUPABASE_URL}/functions/v1/venue-app/manifest?${params}`;
}

/** The venue's square home-screen icon (180 for iOS, 192/512 for Android). */
export function venueIconUrl(slug: string, size: 180 | 192 | 512): string {
  const params = new URLSearchParams({ slug, size: String(size) });
  return `${SUPABASE_URL}/functions/v1/venue-app/icon?${params}`;
}
