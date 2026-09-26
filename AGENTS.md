# Cocktail: agent instructions

A platform for the life of a drink. Bars create, prep, teach and pour their drinks (venue mode). Home bartenders collect and remake them (home mode). Everyone ranks drinks and credits who made them (public layer). One Expo app for iOS, Android, web and desktop, on Supabase. Live with real bar staff; the GitHub repo is **public**.

- Docs index: [llms.txt](llms.txt). How we work: [docs/dev_flow.md](docs/dev_flow.md). Design rules: [docs/design_system.md](docs/design_system.md).
- The redesign north star is the "Back Bar" brief: https://claude.ai/artifact/1ksBAgPLyVmLGKdm48x6sf (read it with the Artifact tool, not WebFetch).

## Stack

Expo SDK 57 (RN 0.86, React 19.2, React Compiler), Expo Router, Tamagui 2.7 (`tamagui.config.ts`), TanStack Query, Zustand, Reanimated 4, expo-image, expo-glass-effect, Supabase (Postgres + RLS, edge functions in Deno), EAS Build/Update, Vercel for web (babyvom.it). Sentry and PostHog are wired but off until their keys are set. Don't upgrade to SDK 58 or Tamagui 3 until they're stable; each upgrade is its own PR.

## How we work

- **Branch, PR, CI, Kevin merges.** Never commit or push to `main`; a hook in `.claude/settings.json` blocks it. One step per PR; stack PRs when steps depend on each other.
- **Verify the real thing before asking for review:** web at phone and desktop widths, plus the iOS simulator and Android when native code or layout changes. Put screenshots in the PR. Local recipes: [docs/dev_flow.md](docs/dev_flow.md#verify).
- **Human-gated:** database migrations, RLS, auth, `lib/roles.ts`, and deploying edge functions. Build and test these against the local Supabase stack only; never push them to production without Kevin's explicit OK in the conversation.
- **Public repo:** no emails, user data, secrets or unfixed security details in code, commits or PR text.
- **The redesign ships behind a flag.** New screens render when `useRedesign()` (`lib/flags.ts`) is true; everyone else keeps the current screen until the new one is finished. Remove the old screen and the branch in the PR that makes the new one the default.
- **Parallel work:** foundation pieces (tokens, shared components, navigation) go in order in one session. Independent screens can be built in parallel worktrees once those land.

## Enforced by CI

- `npm run typecheck`: zero type errors, and it must stay that way.
- `npm run lint`: zero errors. React Compiler warnings are tolerated but don't add new ones.
- `npm run check:design`: a ratchet (`scripts/design-ratchet.mjs`). A file may not gain raw hex/rgb colours, raw font sizes, raw corner radii, `any`, or direct Supabase calls in `app/` or `components/`. New `.tsx` files stay under 300 lines, and files already over that may not grow. When you fix violations, run `npm run check:design -- --update` to lock the gain in.
- `npm run test:unit` (node checks and script tests), `npm run test:security` (RLS, against local Supabase), `npm run build:web`.

## Writing code (the "ponytail" rule)

Lazy means efficient, not careless. Before writing code, stop at the first rung that holds:

1. Does this need building at all?
2. Does it already exist here? Reuse the helper, hook or component.
3. Does the standard library, the platform, or an installed dependency already do it?
4. Only then write the minimum code that works.

- Understand the problem first: read the task and the code it touches, and trace the real flow end to end. A bug fix goes at the root cause; grep every caller of the function you touch and fix the shared function once.
- No abstractions, dependencies or boilerplate nobody asked for. Deletion over addition, boring over clever, fewest files possible.
- Mark intentional shortcuts with a `ponytail:` comment that names the ceiling and the upgrade path.
- Not lazy about: input validation at trust boundaries, error handling that prevents data loss, security, accessibility, and anything explicitly requested.
- Non-trivial logic leaves one runnable check behind: a `*.check.ts` assertion script (run by `npm run test:unit`) or a small test. Trivial one-liners need none.

## Code conventions

- **Data:** Supabase queries live in TanStack Query hooks in `hooks/`, never in screens or components. Use the generated types in `types/`. Cursor pagination for long lists.
- **UI:** redesigned screens build from `components/ds` (tokens in `constants/tokens.ts`, gallery at `/dev/gallery`); existing screens use Tamagui with `constants/palette.ts` until they're replaced. Reuse before making new components. Use `role`/`aria-*` for accessibility, not the legacy `accessibilityRole`/`accessibilityState` (they don't reach the DOM on web).
- **Platform differences:** small ones use `Platform.OS` / `Platform.select`; structural ones use `.web.tsx` / `.native.tsx` files.
- **Native projects:** `ios/` and `android/` are generated (Expo prebuild) and ignored. Native config goes in `app.config.ts` and config plugins.
- **Web head:** never import `expo-router/head`; use `components/WebHead`, which renders nothing on native.
- **Env:** `EXPO_PUBLIC_*` only for values safe to ship to clients. In dev, Expo bundles `.env` itself, which overrides shell variables; see [docs/dev_flow.md](docs/dev_flow.md#verify).

## Agent setup

- The Expo plugin for Claude Code is enabled for this project in `.claude/settings.json`: it adds Expo Skills and the Expo MCP server (docs, EAS builds, simulator screenshots). Run `/mcp` once to sign in to Expo.
- The Supabase MCP connector is read-only here. Use the linked `supabase` CLI for writes, and only with Kevin's OK.
