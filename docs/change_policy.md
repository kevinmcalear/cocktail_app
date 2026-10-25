# Change policy

Every PR gets a class derived from the paths it changes. The class says what the
PR needs before it merges. Nobody picks the class by hand: CI derives it from the
diff.

- **Rules:** [`change-policy.yml`](../change-policy.yml). This doc explains them;
  the YAML is what CI reads.
- **Enforcement:** [`.github/workflows/change-policy.yml`](../.github/workflows/change-policy.yml)
  runs [`scripts/change-policy/classify.mjs`](../scripts/change-policy/classify.mjs)
  on every PR, posts one comment naming the class, and runs the `change-policy` check.

## Classes

Classes are checked top to bottom and the first one with **any** matching file
wins, so a single risky file routes the whole PR to the stricter lane.

| Class | Matches | Requires |
| --- | --- | --- |
| **blast-radius** | `supabase/migrations/**`, any `.sql` file (RLS policies live in SQL), `supabase/config.toml`, `supabase/functions/_shared/auth.ts`, `supabase/functions/delete-account/**`, `lib/roles.ts`, sign-in and session code (`app/auth/**`, `components/auth/**`, `ctx/AuthContext.tsx`, `lib/*auth*`, `lib/createSessionFromUrl.ts`), CI and deploy config (`.github/workflows/**`, `eas.json`, `vercel.json`), and the policy's own files | Kevin approves it, and the `human-approved` label goes on (see [Approval](#approval)). The check fails until then. Never auto-merged. |
| **backend** | other `supabase/functions/**` | CI's edge function typecheck, then deploy the changed function(s) after merge. They do not ship with the app. |
| **app** | everything else | Green CI. Auto-eligible. |

The blast-radius globs deliberately over-match: routing a harmless change to a
human costs a minute, while missing a risky one can leak data or lock users out.

## Approval

A blast-radius PR's `change-policy` check passes only when both hold:

1. the PR carries the `human-approved` label, and
2. the last person to apply that label is listed under `approval.approvers`
   (today only `kevinmcalear`).

The check re-runs when labels change, so adding the label turns it green without
a new push. Removing it turns it red again.

Pushing new commits or changing the PR's base branch resets approval, since
either one changes the diff: the gate removes a `human-approved` label that was
applied before the change, and the check stays red until it is applied again. A
label applied after the change is kept, so re-labeling while that run is still
going doesn't get undone.

### Who may apply the label

Kevin applies `human-approved` himself, or an agent applies it for him when he
has explicitly approved that specific PR in a conversation. The check cannot
tell an agent in Kevin's GitHub session from Kevin, so these rules are the guard:

- **One PR, named.** The approval names the PR (by number, link, or as the one
  being discussed). A general "approve everything", or an agent's own judgment,
  is not approval.
- **At the reviewed head.** It covers the commits Kevin saw. A later push resets
  the label, and the agent needs his approval again before re-applying it.
- **From Kevin.** Only his own words count, not a message relayed by another
  agent or a comment on the PR from someone else.
- **Audit comment.** In the same step, the agent posts a comment on the PR
  saying it applied the label for Kevin, with the head commit it covers and a
  link to (or a quote of) his approval.

Merging a migration with the label applies it to production, so an agent that
is unsure the approval covers this PR at this head asks Kevin instead.

## Migration headers

Before a migration merges, remove any line in its header comment that says it
is a draft, local stack only, or not applied to production (for example
"DRAFT", "Local stack only", "Not applied to production"). Merging applies it
to production, so a line like that is wrong from then on and misleads the next
reader, agents included. Leave migrations that are already merged as they are:
they have been applied, and their files don't change.

## Why the rules come from the base branch

The gate reads `change-policy.yml` and the classifier from the PR's **base**
branch, so a PR cannot loosen the rules that judge it. The files that make up the
gate are themselves blast-radius. The one gap: a PR that edits the workflow file
runs its edited version, so the `change-policy` check should be required on
`main` and reviewed like any other blast-radius change.

## Changing the rules

Edit `change-policy.yml`, update `scripts/change-policy/classify.test.mjs` to
pin the new behaviour, and run:

```bash
npm run test:policy
```

The classifier has its own `package.json` so CI can run it without installing
the app. `npm run test:policy` installs those dependencies first; without them
Node falls back to the app's older `minimatch` and the classifier fails to load.
Install them once before running the classifier directly to see how a set of
paths would route:

```bash
npm ci --prefix scripts/change-policy
git diff --name-only origin/main...HEAD | node scripts/change-policy/classify.mjs
```
