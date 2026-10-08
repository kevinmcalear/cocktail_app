# Store submission guide

What it takes to get the network app into the App Store and Google Play, and
which steps only the account owner can do. The code side (identity, build
profiles, permissions, account deletion, legal pages, icons) is done; see
`app.config.ts`, `eas.json` and `constants/brand.json`.

Placeholders to replace once the product is named: `productName` in
`constants/brand.json` (app name, legal pages), the icon set in
`assets/images` (rendered from a simple coupe glass), and the domain
`babyvom.it` in the URLs below.

## 1. Accounts (start now: some steps take days)

- **Apple Developer Program**: $99/year.
  - **Individual:** the listing shows your personal name.
  - **Organization:** the listing shows a company name. It needs a legal entity and a D-U-N-S number, which is free but takes one to two weeks. Choose Organization if you'll sell this to bars.
  - Apps can move to an Organization account later, keeping their bundle ID.
- **Google Play Console**: $25 one-off.
  - New *personal* accounts must run a closed test with 12 testers opted in for 14 days in a row before they can publish to production.
  - *Organization* accounts, which also need a D-U-N-S number, skip this.
  - Either way, start early.
- **Expo:** the EAS project is `@kevinmcalear/cocktail_app`. The public build variables are already set for every environment (`eas env:list production`).

## 2. White-label model (App Store guideline 4.2.6)

Apple rejects template apps submitted on a client's behalf. Supported model:

1. **One network app** in the stores, under our account, that every bar uses; it takes on the signed-in bar's logo and colours. This is the "picker" model 4.2.6 allows.
2. **Each bar's name and icon on the home screen** through the installable web app (planned: per-bar web app manifest), with no store review.
3. **Optional bar-branded store apps** built from this codebase with overridden identity, published from **the bar's own** Apple/Google developer accounts, with us added as team members.

## 3. Builds and releases

| Goal | Command |
|---|---|
| Dev build on the iOS simulator | `eas build --profile development-simulator --platform ios` |
| Internal test build for phones | `eas build --profile preview --platform all` (iOS devices must be registered first: `eas device:create`) |
| Store build | `eas build --profile production --platform ios` / `--platform android` |
| Upload to App Store Connect / TestFlight | `eas submit --profile production --platform ios` |
| Ship a JS-only fix to installed apps | `eas update --channel production --environment production --message "…"`, then `npm run sentry:sourcemaps` (see below) |

**Owner-only steps the first time:**

- **The first iOS production build** asks you to sign in to Apple. EAS then registers the bundle ID `com.kevinmcalear.cocktail` and creates the certificates. That is the moment the bundle ID becomes permanent.
- **Sign in with the personal Apple ID, not the Sandbox one.** The app ships under Kevin's individual team `X992AGRP7X`, pinned as `ios.appleTeamId` in `app.config.ts` and in the `eas.json` submit profile. To skip the account prompt, name it: `EXPO_APPLE_TEAM_ID=X992AGRP7X eas build --profile production --platform ios`.
- **Submitting:** the App Store Connect app ("Cocktail", app ID `6817112287`) is pinned as `ascAppId` in the `eas.json` submit profile, so `eas submit` never has to find or create one. Without it, `eas submit` reads `app.config.ts` with no `APP_VARIANT` (it does not load the build profile's env), falls back to the development identity and creates a "Cocktail (Dev)" app for `com.kevinmcalear.cocktail.dev`. If you ever submit without the pin, prefix `APP_VARIANT=production`.
- **The first Android release** must be uploaded by hand in the Play Console, as the `.aab` from `eas build`. After that, `eas submit` can upload using a Play service-account key.

## 3a. Crash reports and analytics (Sentry, PostHog)

Both are off until their public keys are set, and both are in every 1.3.0 binary already (`@sentry/react-native` 8.28.0 and `posthog-react-native` 4.77.0 are autolinked). The keys are `EXPO_PUBLIC_*` values, inlined when the JS is bundled, so turning either on is an env change plus a new JS bundle, not a new store build.

| What | How it's turned on | Reaches |
|---|---|---|
| JS errors, native crashes (Sentry) | `EXPO_PUBLIC_SENTRY_DSN` in the EAS `production` environment, then an `eas update` | 1.3.0 binaries (iOS 9, Android 8) after they download the OTA, so from their second launch |
| Usage events (PostHog) | `EXPO_PUBLIC_POSTHOG_KEY` (and `EXPO_PUBLIC_POSTHOG_HOST` for the EU cloud) in EAS `production`, then an `eas update` | same |
| Web | the same variables in Vercel (Production), then a redeploy | babyvom.it |
| Readable OTA stack traces | `npm run sentry:sourcemaps` straight after each `eas update`, with `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` in the shell. It uploads the maps `eas update` left in `dist/`; debug IDs match them to events. | every OTA from then on |
| Readable traces for the store build's own bundle, iOS debug symbols | the `@sentry/react-native` config plugin, added for `APP_VARIANT=production` in `app.config.ts`. It uploads during the EAS build with `SENTRY_AUTH_TOKEN` (secret), `SENTRY_ORG` and `SENTRY_PROJECT` from the EAS `production` environment. | the next store build only |

- The plugin only adds build steps (an Xcode upload phase and a Gradle upload task). No native runtime code changes, so OTAs on `runtimeVersion` 1.3.0 stay safe for builds 9 and 8, even though the fingerprint now differs.
- `eas.json` sets `SENTRY_ALLOW_FAILURE=true` on the production profile: a missing token or a Sentry outage logs a warning instead of failing a store build. Check the build log for `sentry-cli` warnings after the first build with the token.
- On builds 9 and 8, errors before the first OTA lands come from the embedded bundle, whose maps were never uploaded, so they show minified frames. Native iOS crashes on those builds show unsymbolicated frames unless their dSYMs are uploaded by hand.
- What's sent: the account id (never email or name), app version and EAS Update id, device model and OS. Breadcrumbs drop console logs and query strings, and email addresses are replaced before sending (`lib/monitoringScrub.ts`). PostHog events are the eight in `lib/analytics.ts` plus screen views by route pattern, with GeoIP off (the SDK default).

## 4. App Store Connect listing

- **Name:** must be unique in the store. The subtitle is up to 30 characters.
- **Categories:** Food & Drink (primary) and Business (secondary).
- **Age rating:** answer that alcohol references are *frequent*. The app is for adults working in hospitality.
- **URLs:**
  - Privacy policy: `https://babyvom.it/legal/privacy`
  - Support: `https://babyvom.it/legal/privacy`, which lists the contact email, until there is a support page
  - Account deletion is in the app: Settings → Account → Delete account.
- **Sign-in for review:** App Review needs a working demo account.
  - Create `review@…` as a member of a demo bar with sample drinks and a menu.
  - Put the credentials in *App Review Information*.
  - Also explain that venues are invite-only.
- **Export compliance:** already answered in the build (`ITSAppUsesNonExemptEncryption = false`).
- **Sign in with Apple:** not required. The app only offers email sign-in (guideline 4.8).
- **Privacy "nutrition label".** Declare these data types. Tracking: **No**.
  - Contact info (email address, name): linked to you, for app functionality.
  - User content (photos, other content such as recipes and menus): linked to you, for app functionality.
  - Identifiers (user ID): linked to you, for app functionality.
  - Usage data, product interaction: linked to you, for analytics. Declare it before `EXPO_PUBLIC_POSTHOG_KEY` goes live.
  - Diagnostics, crash data and other diagnostic data: linked to you, for app functionality. Declare it before `EXPO_PUBLIC_SENTRY_DSN` goes live. Not performance data: tracing is off.
  - Identifiers, device ID: linked to you, for analytics and app functionality. PostHog and Sentry each keep a random per-install id; declaring it is the safe reading of Apple's definition.
  - "Linked" because both tag events with the account id (`components/Analytics.tsx`, `components/ObservabilityProvider.tsx`). Dropping those two calls would make usage and diagnostics "not linked", at the cost of following one person across devices.
  - The App Privacy answers are edited in App Store Connect and published without a new build, so update them the day the keys go on.
- **Screenshots:**
  - 6.9" iPhone at 1320×2868.
  - 13" iPad at 2064×2752, because the app supports iPad.

## 5. Google Play listing

- **Data safety:** declare the same data types as above. Data is encrypted in transit, and users can request deletion.
  - App activity, app interactions: collected, not shared, required, for analytics.
  - App info and performance, crash logs and diagnostics: collected, not shared, required, for analytics and app functionality.
  - Device or other IDs: collected, not shared, required, for analytics.
  - Sentry and PostHog process data on our behalf, which Google does not count as sharing.
  - Deletion URL: `https://babyvom.it/legal/delete-account`
- **Content rating (IARC):** answer yes to alcohol references.
- **Target audience:** 18 and over.
- **App access:** give the same demo reviewer account.
- **Ads:** none.
- **Screenshots:** phone (at least 2) and 7"/10" tablet screenshots, plus a feature graphic at 1024×500.

## 6. Still to do in code

- **Universal and app links,** so email links open the app instead of the website. This needs the Apple Team ID and the final domain. It means an `apple-app-site-association` file and an `assetlinks.json` file on the domain, plus `ios.associatedDomains` and Android `intentFilters`.
- **A per-bar installable web app,** so each bar gets its own name and icon on the home screen.
- **Replace the placeholder name and icons** once the brand exists.
