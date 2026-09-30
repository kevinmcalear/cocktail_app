import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

export { inspectAuthUrl, type AuthLinkState } from '@/lib/parseAuthParams';

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
