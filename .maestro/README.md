# Maestro journeys

The first journeys on a phone (Kevin, 1 Nov 2026: Maestro, on EAS later). Three short flows on the dev build (bundle id `com.kevinmcalear.cocktail.dev`, scheme `cocktailapp-dev`):

| Flow | What it checks |
|---|---|
| `tabs.yaml` | The four tabs (Tonight, Drinks, Discover, You) show, and each opens as the selected tab. |
| `open-drink.yaml` | Drinks: open a drink from the venue's library, Close it, and land back on the list. |
| `android-back.yaml` | Android only: Back leaves a drink page and closes the New sheet without leaving the app, and leaves the app from Tonight's first page. |

`subflows/start.yaml` opens the app (on your Metro server, for a dev build) and signs in the local demo user when it's signed out.

**Not run yet.** They were written on 1 Nov 2026 with no simulator or emulator free, and `maestro check-syntax` passes on each. Expect the first run to need a selector or two fixed; fix them here.

## Run them locally

Against the local Supabase stack only, never production. You need [Maestro](https://docs.maestro.dev), a dev build installed on a booted simulator or emulator, and the local stack up.

1. Demo data, if `supabase/seed_demo.sql`'s venues aren't there:
   ```sh
   docker exec -i supabase_db_cocktail_app psql -q -U postgres < supabase/seed_demo.sql
   ```
2. Metro against the local stack, from the repo root:
   ```sh
   eval "$(supabase status -o env | grep -E '^(API_URL|ANON_KEY)=')"
   EXPO_NO_DOTENV=1 EXPO_PUBLIC_SUPABASE_URL=$API_URL EXPO_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY npx expo start --dev-client --port 8081
   ```
   On an Android emulator 127.0.0.1 is the emulator itself, so first `adb reverse tcp:8081 tcp:8081` and `adb reverse tcp:54321 tcp:54321`.
3. Run them. `scripts/dev-user.mjs --link` makes the demo user (Admin at Little Rye, Bartender at Pale Moth) and prints a one-time sign-in link, `cocktailapp-dev://auth/callback?token_hash=...&type=magiclink`, from the local admin API. The first flow opens it; the rest find the app signed in. A link works once, so make a new one for each run.
   ```sh
   # Android
   maestro test -e METRO_URL=http%3A%2F%2F127.0.0.1%3A8081 -e SIGN_IN_LINK="$(node scripts/dev-user.mjs --link)" .maestro
   # iOS simulator (no hardware Back)
   maestro test --exclude-tags android -e METRO_URL=http%3A%2F%2F127.0.0.1%3A8081 -e SIGN_IN_LINK="$(node scripts/dev-user.mjs --link)" .maestro
   ```
   One flow: `maestro test ... .maestro/open-drink.yaml`. With several devices booted, pick one with `maestro --device <id> test ...`.

## On EAS, later

The plan is Maestro on EAS Workflows: Android on every PR that touches the app, iOS nightly and before store builds. Three things it waits on, all Kevin's call:

- **A backend that isn't production.** Kevin picked a staging Supabase project (decision Q6); it doesn't exist yet. EAS runners can't reach a laptop's local stack, so until then these run locally only.
- **A build for the flows:** an `e2e` profile in `eas.json` (the `.dev` variant, an Android APK, JavaScript inside, staging's URL and key). Leave out `METRO_URL` for that build; `start.yaml` then skips the Metro step.
- **A workflow** in `.eas/workflows/` with `type: maestro` jobs pointing at this folder, and a way to hand it a fresh sign-in link from staging (a step that runs `--link` against staging, once that script learns to).
