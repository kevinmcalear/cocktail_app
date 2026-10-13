import type { ConfigContext, ExpoConfig } from 'expo/config';
import { withEntitlementsPlist, type ConfigPlugin } from 'expo/config-plugins';

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

/**
 * expo-notifications adds the Push Notifications entitlement, but the app only
 * schedules local notifications (lib/readyNudge.ts), and the App Store profile
 * has no Push capability, so signing failed (builds 23 and 26).
 * ponytail: when remote push is wanted, drop this, add Push to the App ID and
 * let EAS regenerate the profile (needs an Apple sign-in).
 */
const withoutPushEntitlement: ConfigPlugin = (config) =>
  withEntitlementsPlist(config, (c) => {
    delete c.modResults['aps-environment'];
    return c;
  });

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
      // Kevin's personal Apple Developer team. Pinned so EAS never signs with
      // another team the same Apple ID can reach.
      appleTeamId: 'X992AGRP7X',
      // Only standard HTTPS/TLS: exempt from export compliance paperwork.
      config: { usesNonExemptEncryption: false },
      // Directions (components/screens/bar/Directions.tsx) offers Google Maps
      // and Waze only when installed; iOS answers canOpenURL only for schemes listed here.
      infoPlist: { ...config.ios?.infoPlist, LSApplicationQueriesSchemes: ['comgooglemaps', 'waze'] },
      // The sign-in email's link and venue staff links open the app, not the
      // site (public/.well-known/apple-app-site-association lists these app
      // ids). Store and preview builds only: local dev builds sign without it.
      ...(variant === 'development' ? {} : { associatedDomains: ['applinks:babyvom.it'] }),
    },
    android: {
      ...config.android,
      package: appId,
    },
    // Over-the-air JS updates from EAS Update. A new store binary is needed
    // whenever the app version (and so the runtime) changes.
    runtimeVersion: { policy: 'appVersion' },
    // Store builds upload their JS source maps and iOS debug symbols to Sentry
    // (org, project and SENTRY_AUTH_TOKEN come from the EAS production
    // environment). Build-time only: the native SDK is already linked, so
    // crash capture itself doesn't depend on this. Not in dev or preview
    // builds, which have nothing to upload to.
    plugins: [...(config.plugins ?? []), ...(variant === 'production' ? ['@sentry/react-native'] : []), withoutPushEntitlement],
    updates: { url: `https://u.expo.dev/${config.extra?.eas?.projectId}` },
    extra: {
      ...config.extra,
      appVariant: variant,
    },
  };
};
