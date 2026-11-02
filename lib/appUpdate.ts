import * as Updates from 'expo-updates';

/** Which JS this phone runs, for analytics: the store build's own, or an over-the-air update by its first 8 characters. */
export function appUpdate(): string | null {
  if (Updates.isEmbeddedLaunch || !Updates.updateId) return 'embedded';
  return Updates.updateId.slice(0, 8);
}
