# Cocktail: agent instructions

A platform for the life of a drink. Bars create, prep, teach and pour their drinks (venue mode). Home bartenders collect and remake them (home mode). Everyone ranks drinks and credits who made them (public layer). One Expo app for iOS, Android, web and desktop, on Supabase. Live with real bar staff; the GitHub repo is **public**.

- Docs index: [llms.txt](llms.txt). How we work: [docs/dev_flow.md](docs/dev_flow.md). Design rules: [docs/design_system.md](docs/design_system.md).
- **The source of truth for every screen is the canvas "Cocktail: the whole app": https://claude.ai/artifact/KRE17t8L8SC8f4M4KFLgZe** (approved by Kevin on 10 Oct 2026; read it with the Artifact tool, not WebFetch). It supersedes the older per-feature canvases and the Back Bar brief (https://claude.ai/artifact/1ksBAgPLyVmLGKdm48x6sf), which stays as background.
  - Build what the board draws, not just its decisions. A PR that touches a screen puts the board beside a screenshot of the real screen and lists every drawn element as built, changed (why) or left out; anything changed or left out needs Kevin's OK first.
  - Keep it current: when Kevin decides something that changes a screen, update the board in the same piece of work. New screens are drawn there before they are built.

## Stack

Expo SDK 58 (RN 0.88.0, React 19.3, React Compiler), Expo Router, Tamagui 2.7 (`tamagui.config.ts`), TanStack Query, Zustand, Reanimated 4, expo-image, expo-glass-effect, Supabase (Postgres + RLS, edge functions in Deno), EAS Build/Update, Vercel for web (babyvom.it). Sentry and PostHog are wired but off until their keys are set. Don't upgrade Tamagui to 3 until it's stable; that upgrade is its own PR.

## How we work

- **Branch, PR, CI, Kevin merges.** Never commit or push to `main`; a hook in `.claude/settings.json` blocks it. One step per PR; stack PRs when steps depend on each other.
- **Review your own branch first:** before asking for review, run `/code-review` on the branch and fix the findings you confirm.
- **Verify the real thing before asking for review:** web at phone and desktop widths, plus the iOS simulator and Android when native code or layout changes. Put screenshots in the PR. Local recipes: [docs/dev_flow.md](docs/dev_flow.md#verify).
- **Human-gated:** database migrations, RLS, auth, `lib/roles.ts`, and deploying edge functions. Build and test these against the local Supabase stack only; never push them to production without Kevin's explicit OK in the conversation. A migration merged to main (which needs the `human-approved` label) is applied to production by the Deploy migrations workflow; that label is the OK. Apply it yourself only when Kevin has explicitly approved that PR at its current head, and leave an audit comment linking his approval ([docs/change_policy.md](docs/change_policy.md#who-may-apply-the-label)). Edge functions are still deployed by hand.
- **Public repo:** no emails, user data, secrets or unfixed security details in code, commits or PR text.
- **One app, no old UI.** The Back Bar redesign is the app; the old screens and the redesign flag were removed in step 9. New screens build from `components/ds`. A large change that must reach people gradually can use a PostHog flag, but remove the old path in the PR that makes the new one the default.
- **Parallel work:** foundation pieces (tokens, shared components, navigation) go in order in one session. Independent screens can be built in parallel worktrees once those land.

## Working within the usage budget

Claude usage is the scarce resource here, not CI minutes (the repo is public, so Actions are free). Every call re-reads the whole conversation, so a long session or a waiting loop costs far more than it looks.

- **Don't watch CI.** No `sleep`, `until` or repeated `gh pr checks` loops. Open the PR, call the ccd_pr tools once, and let the app's CI monitor wake the session when checks finish.
- **Check locally only what you touched:** `npm run typecheck` and the tests nearest your change. Leave the full suite to CI. Run `npm run test:security` (it starts Supabase) only when the change touches `supabase/` or a file those tests read.
- **Subagents default to Sonnet** (`CLAUDE_CODE_SUBAGENT_MODEL` in `.claude/settings.json`). Use them for searching, reading and data gathering. Pass `model: "opus"` only for a subagent that writes tricky code or makes a judgment call.
- **One session per piece of work, not per fix.** Related fixes to the same PR or screen go in the same session. When a session passes about 300k tokens of context, write a short handoff and start fresh rather than carrying the history.
- **Screenshots are expensive.** Prefer `read_page` / `get_page_text` to check text and structure; take one screenshot for the PR at the end.
- **Store builds only for native changes.** A JS-only change ships with `eas update`; run `eas build` only when native config, a native dependency or the app version changes.

## Enforced by CI

- `npm run typecheck`: zero type errors, and it must stay that way.
- `npm run lint`: zero errors. React Compiler warnings are tolerated but don't add new ones.
- `npm run check:design`: a ratchet (`scripts/design-ratchet.mjs`). A file may not gain raw hex/rgb colours, raw font sizes, raw corner radii, `any`, or direct Supabase calls in `app/` or `components/`. New `.tsx` files stay under 300 lines, and files already over that may not grow. When you fix violations, run `npm run check:design -- --update` to lock the gain in.
- `npm run test:unit` (node checks and script tests), `npm run test:jest -- --ci`, `npm run test:security` (RLS, against local Supabase), `npm run test:policy` (PR class), `npm run build:web`.
- `deno check` on each `supabase/functions/*/index.ts` (CI does this). Edge functions do not ship with the app; deploy is separate and human-gated.

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

- **Data:** Supabase queries live in TanStack Query hooks in `hooks/`, never in screens or components. Use the generated types in `types/`. Cursor pagination for long lists. Query results must be plain JSON (arrays and objects, no `Set`, `Map` or `Date`): the query cache is persisted to storage, and anything else comes back broken after a reload.
- **Bar menus:** a bar with staff owns its menus, so they go in `menus`, where its staff can fix them. `profile_menu_editions` is research history for bars with no staff yet. A seed that adds history to a staffed bar ends with `select private.move_menu_history_to_venue('<bar id>')`.
- **UI:** new screens build from `components/ds` (tokens in `constants/tokens.ts`, gallery at `/dev/gallery`). Drink pages use `components/screens/drink`: cocktails (`DrinkScreen`), beer and wine (`BeerWineScreen`, the same hero, controls and desktop card with no spec), and editing in place (`edit/`, beer and wine in `BeerWineEditScreen`). Ingredient editing uses `components/screens/ingredient` (`IngredientEditPage`, and `PrepEditor` for house preps). Do not start another drink page. Reuse before making new components. Every sheet builds on `Sheet` (`components/ds/Sheet.tsx`) or `MenuSheet`: a fading backdrop, a spring up, drag to close, and a centred dialog on the web. Use `role`/`aria-*` for accessibility, not the legacy `accessibilityRole`/`accessibilityState` (they don't reach the DOM on web).
- **Web against local Supabase:** `EXPO_NO_DOTENV=1` and the env from `supabase status`, or the dev server uses `.env` and talks to production. Full recipe in [docs/dev_flow.md](docs/dev_flow.md#verify).
- **Platform differences:** small ones use `Platform.OS` / `Platform.select`; structural ones use `.web.tsx` / `.native.tsx` files.
- **Native projects:** `ios/` and `android/` are generated (Expo prebuild) and ignored. Native config goes in `app.config.ts` and config plugins.
- **Web head:** never import `expo-router/head`; use `components/WebHead`, which renders nothing on native.
- **Env:** `EXPO_PUBLIC_*` only for values safe to ship to clients. In dev, Expo bundles `.env` itself, which overrides shell variables; see [docs/dev_flow.md](docs/dev_flow.md#verify).

## Agent setup

- The Expo plugin for Claude Code is enabled for this project in `.claude/settings.json`: it adds Expo Skills and the Expo MCP server (docs, EAS builds, simulator screenshots). Run `/mcp` once to sign in to Expo.
- A Stop hook (`.claude/hooks/stop-checks.sh`) runs typecheck, eslint on the changed files and `npm run check:design` when a turn ends with uncommitted code changes, and sends Claude back to fix any failure. It skips changes that already passed and worktrees without `node_modules`.
- The Supabase MCP connector is read-only here. Use the linked `supabase` CLI for writes, and only with Kevin's OK.
