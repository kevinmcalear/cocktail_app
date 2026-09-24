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
| Ship a JS-only fix to installed apps | `eas update --channel production --environment production --message "…"` |

**Owner-only steps the first time:**

- **The first iOS production build** asks you to sign in to Apple. EAS then registers the bundle ID `com.kevinmcalear.cocktail` and creates the certificates. That is the moment the bundle ID becomes permanent.
- **The first Android release** must be uploaded by hand in the Play Console, as the `.aab` from `eas build`. After that, `eas submit` can upload using a Play service-account key.
- **Crash reports:** before relying on Sentry stack traces, add the `@sentry/react-native` config plugin to `app.json` (organisation and project) and set `SENTRY_AUTH_TOKEN` as an EAS secret. Without the token, the plugin's upload step fails every Release build, which is why it is not enabled yet.

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
  - Usage data (product interaction): linked to you, for analytics. Only once PostHog is enabled.
  - Diagnostics (crash data, performance data): linked to you, for app functionality. Only once Sentry is enabled.
- **Screenshots:**
  - 6.9" iPhone at 1320×2868.
  - 13" iPad at 2064×2752, because the app supports iPad.

## 5. Google Play listing

- **Data safety:** declare the same data types as above. Data is encrypted in transit, and users can request deletion.
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
