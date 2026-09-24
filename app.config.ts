import type { ConfigContext, ExpoConfig } from 'expo/config';

import brand from './constants/brand.json';

/**
 * The network app: one store binary that serves every bar (App Store
 * guideline 4.2.6's "picker" model). Bars get their own name and logo inside
 * the app after sign-in and on the home screen through the web app. A
 * bar-branded store build would override these values and be published from
 * the bar's own developer accounts.
 */
const APP = {
  name: brand.productName,
  /** Permanent once the first build is uploaded to App Store Connect / Play. */
  bundleId: 'com.kevinmcalear.cocktail',
  scheme: 'cocktailapp',
};

type Variant = 'development' | 'preview' | 'production';

// Set per EAS build profile (eas.json) and by build:web. Local builds default
// to development so they install alongside the real app.
const variant: Variant = (['development', 'preview', 'production'] as const).includes(
  process.env.APP_VARIANT as Variant
)
  ? (process.env.APP_VARIANT as Variant)
  : 'development';

const IDENTITY: Record<Variant, { name: string; idSuffix: string; scheme: string }> = {
  development: { name: `${APP.name} (Dev)`, idSuffix: '.dev', scheme: `${APP.scheme}-dev` },
  preview: { name: `${APP.name} (Preview)`, idSuffix: '.preview', scheme: `${APP.scheme}-preview` },
  production: { name: APP.name, idSuffix: '', scheme: APP.scheme },
};

export default ({ config }: ConfigContext): ExpoConfig => {
  const identity = IDENTITY[variant];
  const appId = `${APP.bundleId}${identity.idSuffix}`;

  return {
    ...config,
    name: identity.name,
    slug: 'cocktail_app',
    scheme: identity.scheme,
    ios: {
      ...config.ios,
      bundleIdentifier: appId,
      // Only standard HTTPS/TLS: exempt from export compliance paperwork.
      config: { usesNonExemptEncryption: false },
    },
    android: {
      ...config.android,
      package: appId,
    },
    // Over-the-air JS updates from EAS Update. A new store binary is needed
    // whenever the app version (and so the runtime) changes.
    runtimeVersion: { policy: 'appVersion' },
    updates: { url: `https://u.expo.dev/${config.extra?.eas?.projectId}` },
    extra: {
      ...config.extra,
      appVariant: variant,
    },
  };
};
