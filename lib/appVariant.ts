import Constants from 'expo-constants';

export type AppVariant = 'development' | 'preview' | 'production';

/**
 * Which build this is, from app.config.ts (APP_VARIANT at build time). Tags
 * crash reports and analytics so internal test builds, which talk to the
 * production backend, stay separate from real users.
 */
export const appVariant: AppVariant =
  (Constants.expoConfig?.extra?.appVariant as AppVariant | undefined) ?? 'development';
