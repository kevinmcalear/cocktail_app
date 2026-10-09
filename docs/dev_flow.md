# How we work

The cycle for every change, whether a person or an agent is doing it.

## 1. Start from an issue

Features start as a GitHub issue using the **Feature** template: the problem, who it's for, the metric that tells us it worked (a PostHog event or funnel), acceptance criteria, and the mockup in the Back Bar brief it has to match. Bugs use the **Bug** template. Design first, then build: if the issue can't say what "done" looks like, it isn't ready.

## 2. Build on a branch

- Branch names: `feat/…`, `fix/…`, `docs/…`, or `stepN/…` for the redesign roadmap.
- Keep PRs to one step. If a step depends on an unmerged one, stack it on that branch and say so in the PR.

## 3. Verify

Tests are not enough on their own. Drive the change on every surface it can break.

| Change touches | Verify on |
|---|---|
| Screens, components, layout | Web at 390 px and 1280 px wide, iOS simulator, Android |
| Web-only code (`*.web.tsx`, sidebar, keyboard) | Web at 1280 px |
| Native-only code, config plugins, `app.config.ts` | iOS simulator and Android build |
| Hooks and data | The screens that use them, against local Supabase |
| Migrations, RLS, edge functions | Local Supabase + `npm run test:security` (and Kevin's OK before production) |

Recipes:

- **Local Supabase:** Docker running, then `supabase start -x studio,imgproxy,logflare,vector,realtime,supavisor,mailpit,postgres-meta`, `supabase db reset`, `npm run test:security`. Seed data with only the `public.*` inserts from a dump (never auth tables), loaded with `session_replication_role=replica`.
- **Auth emails (venue invites, sign-up):** leave `mailpit` out of `-x` and keep the edge runtime. Auth's emails land in Mailpit at `http://127.0.0.1:54324` (its API is `/api/v1/messages`); the templates are in `supabase/templates`. The Team screen's Invite calls `send-bar-invite`.
- **Web against local Supabase:** `EXPO_NO_DOTENV=1` plus the env values from `supabase status`, then `expo start --web --no-dev --port 8090`. Dev mode bundles `.env` as a module and would point at production. `--no-dev` doesn't rebuild on edits, so restart after changes. Port 8081 is often taken.
- **Demo data:** `docker exec -i supabase_db_cocktail_app psql -U postgres < supabase/seed_demo.sql` loads two made-up venues (Little Rye and Pale Moth), glassware, drinks and a current menu at each.
- **Signing in locally without a password:** `node scripts/dev-user.mjs` creates `demo@example.test` (Admin at Little Rye, Bartender at Pale Moth) on the local stack only and writes a session to `.expo/dev-session.json`. On web, put its `session` in localStorage under its `storageKey` and reload. On the simulator, generate a magic link with the admin API and open `cocktailapp://auth/callback?token_hash=…&type=magiclink`, then tap Continue.
- **iOS release build:** `npx expo run:ios --configuration Release`. Cancel the dev-client URL prompt and launch from the icon.
- **Production web build:** `npm run build:web`, then serve `dist/` with the `vercel.json` rewrites applied. The script turns on Metro tree shaking (`EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH`, `EXPO_UNSTABLE_TREE_SHAKING`), which `expo start` and native exports don't use, so check web-only breakage (a module that only works through an import's side effects) against this build. Bare `import 'x'` lines are kept unless the package marks the file side-effect free.
- **Web hydration errors (React #418 on a cold load):** the static export renders every page light, with no window (0 x 0) and signed out, and the first client render must produce the same HTML. Values that differ on the device go through `hooks/useIsHydrated.ts`; the window size already does (`useWindowDimensions` is patched in `patches/`). For a readable diff instead of the minified error, run `expo export -p web --dev --output-dir <scratch dir>`, serve that directory, and cold-load the page in a fresh tab at both widths, light and dark. React reports one mismatch per route boundary, so repeat until the console is clean. A warning about `id` attributes (`useId`) is expected: the export wraps the app in `app/+html.tsx`, the browser doesn't.
- **CI typecheck differs from local:** CI has no `expo-env.d.ts` or `.expo/types` (generated, ignored). Move both aside and run `tsc` to reproduce it.

## 4. Open the PR

The template asks for: why, what changed, how it was verified (with screenshots at phone and desktop widths for UI), what CI covers, and how Kevin can check it directly (exact local steps for web, an EAS preview build for native). Link the issue with `Closes #N`.

Vercel builds no PR previews: each build is billed by the CPU minute, and previews were most of the bill. `ignoreCommand` in `vercel.json` skips every non-production build, and production builds for merges that only touch `supabase/`, `docs/`, `.github/`, `desktop/` or Markdown. Preview deployments are also switched off in the Vercel project settings.

## 5. Merge

Kevin merges when CI is green. There's no auto-merge. After merging a stack, retarget the next PR to `main` before merging it.

## Changes that need Kevin

Migrations, RLS, auth, `lib/roles.ts`, edge function deploys, production data, store submissions, and anything that spends money. Prepare and test these fully, then ask. See also [AGENTS.md](../AGENTS.md#how-we-work).

Once a migration is merged with the `human-approved` label, the Deploy migrations workflow (`.github/workflows/deploy-migrations.yml`) runs `supabase db push` against production, connecting to the database directly through the session pooler. The project ref is in the workflow file; the only secret it needs is `SUPABASE_DB_PASSWORD` (no access token). It can be run by hand from the Actions tab to catch production up.

## The redesign roadmap

The Back Bar brief (https://claude.ai/artifact/1ksBAgPLyVmLGKdm48x6sf) is the target. Each step ships on phone, tablet and web together.

0. **Guardrails:** agent docs, the main-branch hook, the design ratchet, the redesign flag (removed in step 9), PR and issue templates.
1. **Design system:** tokens (colour, type, radius, spacing, springs), fonts, shared components, and a hidden gallery route showing them in both themes, at phone and desktop widths, for two venue brands.
2. **Navigation and venue theming:** NativeTabs (Tonight, Library, Prep, Study), the venue switcher, and a per-venue theme from the logo colours.
3. **The drink page:** colour-field hero, spec, photo angles with automatic sketches, locked sections by role, venue roles.
4. **Venue operations:** prep tree with lead times, back bar map, order list, takeovers.
5. **Study and batch.**
6. **Expo SDK 58.** React Native is still 0.88.0-rc.3, the build SDK 58.0.2 ships. `.npmrc` stays until that is a stable 0.88.0.
7. **Home mode, then the public layer:** my bar, collections, profiles, credit and lineage, comparison rankings, moderation.
8. **The gaps from steps 2 and 3:** venue brand settings with a live preview; the drink page's Service section.
9. **Done.** The old screens and the redesign flag are gone. New screens build from `components/ds`. Cocktail edit, and beer and wine detail, still use the Tamagui layout until they are ported. Do not go looking for a redesign flag.
10. **Launch cut (7 Oct 2026):** Study, Prep and Service mode stay built but are switched off in `constants/features.ts`, and Discover is its own tab in both modes.
