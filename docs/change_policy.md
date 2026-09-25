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
| **blast-radius** | `supabase/migrations/**`, any `.sql` file (RLS policies live in SQL), `supabase/config.toml`, `supabase/functions/_shared/auth.ts`, `supabase/functions/delete-account/**`, `lib/roles.ts`, sign-in and session code (`app/auth/**`, `components/auth/**`, `ctx/AuthContext.tsx`, `lib/*auth*`, `lib/createSessionFromUrl.ts`), and the policy's own files | Kevin applies the `human-approved` label. The check fails until then. Never auto-merged. |
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

Pushing new commits resets approval: the gate removes a `human-approved` label
that was applied before the push, and the check stays red until it is applied
again. A label applied after the push is kept, so re-labeling while that push's
check is still running doesn't get undone.

Agents must never apply `human-approved`, even when their GitHub session is
Kevin's. The check cannot tell the two apart, so the rule is the only guard.

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
npm ci --prefix scripts/change-policy && npm run test:policy
```

To see how a set of paths would route:

```bash
git diff --name-only origin/main...HEAD | node scripts/change-policy/classify.mjs
```

The classifier has its own `package.json` so CI can run it without installing
the app.
