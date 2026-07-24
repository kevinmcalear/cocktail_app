import { parseAuthParams } from '@/lib/parseAuthParams';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

export type AuthLinkState = {
  url: string | null;
  error: string | null;
  /** code / tokens / token_hash present — needs a user gesture to exchange */
  hasCredential: boolean;
};

function humanizeAuthError(params: Record<string, string>): string | null {
  const raw = params.error_description || params.error;
  if (!raw) return null;
  const text = decodeURIComponent(raw.replace(/\+/g, ' '));
  if (/otp_expired|invalid|expired/i.test(params.error_code || text)) {
    return 'This email link is invalid or has already been used. Request a new one — and open it in your browser (mail app previews often burn the link).';
  }
  return text;
}

export function inspectAuthUrl(url: string | null | undefined): AuthLinkState {
  if (!url) return { url: null, error: null, hasCredential: false };
  const params = parseAuthParams(url);
  const error = humanizeAuthError(params);
  const hasCredential = !!(
    params.code ||
    params.token_hash ||
    (params.access_token && params.refresh_token)
  );
  return { url, error, hasCredential };
}

/** Current page URL (web) or deep link (native). */
export async function getIncomingAuthUrl(): Promise<string | null> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.href;
  }
  return Linking.getInitialURL();
}

/** Strip auth query/hash from the address bar after a successful exchange. */
export function clearAuthParamsFromUrl(path: string) {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.history?.replaceState) {
    return;
  }
  window.history.replaceState({}, '', path);
}
