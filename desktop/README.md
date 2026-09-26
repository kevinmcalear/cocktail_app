# Desktop shell

A [Tauri 2](https://v2.tauri.app/) window around the Expo web export (`dist/`), so the desktop app is the same code as babyvom.it. It uses the system WebView (WKWebView on macOS, WebView2 on Windows), not Electron.

It's deliberately separate from the rest of the repo:

- It has its own `package.json` and lockfile. The root `npm ci` never installs the Tauri CLI, and CI doesn't build it, so nothing here can break the web or mobile builds.
- The web bundle has no Tauri code. The only web-side awareness is `lib/desktopShell.ts` (see [Web app deltas](#web-app-deltas)).
- Metro and ESLint ignore `desktop/`.

## Setup

You need Rust (`rustup`, stable) and, on macOS, the Xcode command line tools.

```bash
npm --prefix desktop ci
```

## Commands

From the repo root:

```bash
npm run desktop:dev     # Expo web dev server on :8090 + the desktop window
npm run desktop:build   # npm run build:web, then a release .app/.dmg (or .msi/.exe on Windows)
```

Build output: `desktop/src-tauri/target/release/bundle/`.

`scripts/tauri.mjs` wraps the Tauri CLI:

- It sets the product name from `constants/brand.json`.
- It generates the icons from `assets/images/icon.png` into `src-tauri/icons/`, which is gitignored.

Extra arguments pass through, for example `npm --prefix desktop run build -- --debug --bundles app`.

## What the shell adds (all in `src-tauri/src/lib.rs`)

- **External links open in the system browser.** WKWebView silently drops `target="_blank"` and `window.open` (react-native-web's `Linking.openURL` uses it). Top-level navigations away from the app are also sent to the browser. The shell forwards `http(s)`, `mailto` and `tel` to the OS through `tauri-plugin-opener`, from Rust, and blocks anything else.
- **`cocktailapp://` deep links.** These use the same scheme as the native app. `cocktailapp://auth/callback?token_hash=…&type=…` loads the web app's `/auth/callback`, which shows the usual "Continue" gate. Any other path works the same way, as on iOS. macOS registers the scheme from the bundle's Info.plist, so it only works in a built `.app`, not in `tauri dev`.
- **Single instance.** A second launch focuses the existing window. On Windows and Linux it also forwards the deep link to that window.

The web app never calls Tauri APIs, so there are no custom commands and no capabilities file. If you add a command later, it needs three wirings or JS gets "not allowed. Command not found":

1. a `#[tauri::command]` in `invoke_handler`;
2. the command in `build.rs` via `tauri_build::AppManifest::new().commands(&[...])`;
3. `allow-<command>` in `capabilities/*.json`.

Import any `@tauri-apps/api` module statically, never with `import()`. A dynamic import splits Tauri's core into an async chunk, which crashed the sandbox desktop app at boot.

## Web app deltas

**Origin.** The shell serves the bundle from `tauri://localhost` (`http://tauri.localhost` on Windows), which is useless in an email or a shared link. `isDesktopShell()` makes three places behave like native:

- `lib/authRedirect.ts`: sign-up and password-reset emails redirect to `EXPO_PUBLIC_SITE_URL`. The email link finishes in the browser, and the person then signs in on desktop with their password. Email clients mangle custom schemes, so the emails keep https links.
- `lib/venueLink.ts`: staff links shared from desktop point at the public site.
- `lib/webInstall.ts`: counts as "installed", so `/v/<slug>` goes straight into the venue instead of showing install instructions.

**CSP.** The policy lives in `src-tauri/tauri.conf.json`. It's the policy the web app would need if it ever set one on Vercel too.

| Directive | Allows | Why |
| --- | --- | --- |
| `connect-src` | `https://*.supabase.co`, `wss://*.supabase.co` | Supabase REST, auth, storage, edge functions, realtime. A wildcard, so preview branches work. Narrow to the project host if you prefer. |
| `connect-src` | `*.ingest.sentry.io` (us/de) | Sentry, when `EXPO_PUBLIC_SENTRY_DSN` is set |
| `connect-src` | `us.i.posthog.com`, `eu.i.posthog.com` | PostHog, when `EXPO_PUBLIC_POSTHOG_KEY` is set. Add the host if `EXPO_PUBLIC_POSTHOG_HOST` changes. |
| `connect-src` | `blob:`, `data:` | `lib/imageBase64.ts` fetches picked images |
| `img-src`, `media-src` | `https:`, `data:`, `blob:` | Storage images, plus images imported from arbitrary recipe sites |
| `style-src` | `'unsafe-inline'` | Tamagui and react-native-web inject styles at runtime. `dangerousDisableAssetCspModification: ["style-src"]` stops Tauri adding hashes, which would switch `'unsafe-inline'` off. |
| `script-src` | `'self'` only | No eval, no CDNs. Verified with a production export. |

`devCsp` (used by `tauri dev`) also allows `localhost`/`127.0.0.1` on any port, for Metro and a local Supabase stack.

## Testing against local Supabase

Dev build:

1. Start a web server with the local keys (see the repo's local testing notes; `EXPO_NO_DOTENV=1` keeps `.env` from pointing it at production).
2. Point the shell at that server:

   ```bash
   EXPO_NO_DOTENV=1 EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 EXPO_PUBLIC_SUPABASE_ANON_KEY=... npx expo start --web --no-dev --port 8092
   npm --prefix desktop run dev -- --config '{"build":{"devUrl":"http://localhost:8092","beforeDevCommand":""}}'
   ```

Built `.app`: the production CSP doesn't allow `http://127.0.0.1:54321`, so merge an override when building. Start from a `dist/` built with the local env:

```bash
npm --prefix desktop run build -- --debug --bundles app --config '{"build":{"beforeBuildCommand":""},"app":{"security":{"csp":{"connect-src":"<prod connect-src> http://127.0.0.1:54321 ws://127.0.0.1:54321","img-src":"<prod img-src> http://127.0.0.1:54321"}}}}'
open desktop/src-tauri/target/debug/bundle/macos/Cocktail.app
open "cocktailapp://auth/callback?token_hash=<from auth.admin.generateLink>&type=magiclink"
```

## Known gaps

- **Reloading a dynamic route** (for example `/cocktail/<id>`) falls back to `index.html`. Tauri has no `vercel.json` rewrites. In-app navigation is unaffected.
- **No auto-update or signed release.** The sandbox repo's `desktop-release.yml` isn't self-contained: it needs a Developer ID certificate, App Store Connect notarization keys, a minisign updater key and a public releases repo. To ship a build by hand:
  1. Run `npm run desktop:build` on a Mac with the production `.env`.
  2. Set `APPLE_SIGNING_IDENTITY`, plus `APPLE_API_ISSUER`/`APPLE_API_KEY`/`APPLE_API_KEY_PATH` for notarization. Tauri signs and notarizes automatically when these are set.
  3. Distribute the `.dmg`.

  To add updates later, port sandbox's `tauri-plugin-updater` setup and release workflow (`docs/desktop_distribution.md` there).
- **Windows builds** are untested.
