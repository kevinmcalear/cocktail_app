import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The Sentry plugin wraps "Bundle React Native code and images" in sentry-cli.
// When sentry-cli fails before it runs the bundler (no SENTRY_ORG, bad token),
// SENTRY_ALLOW_FAILURE turns that into a warning and the archive ships without
// main.jsbundle: the app dies on launch (iOS 1.3.0 build 10). A failed upload
// must fail the build instead. SENTRY_DISABLE_AUTO_UPLOAD skips sentry-cli and
// bundles normally.
// ponytail: drop SENTRY_DISABLE_AUTO_UPLOAD once SENTRY_ORG, SENTRY_PROJECT and
// SENTRY_AUTH_TOKEN are in the EAS production environment.
const eas = JSON.parse(readFileSync('eas.json', 'utf8'));
for (const [name, profile] of Object.entries<{ env?: Record<string, string> }>(eas.build)) {
  assert.notEqual(profile.env?.SENTRY_ALLOW_FAILURE, 'true', `eas.json build.${name}: SENTRY_ALLOW_FAILURE ships a binary with no JS bundle`);
}

console.log('sentryBuild ✓');
