# Schema proposal: publishing and moderation

Status: **draft for review.** The migrations below have been built and tested only on an isolated local Supabase stack. None of them has been applied to production, and none may be until Kevin approves it.

This is step 7 of the Back Bar brief (https://claude.ai/artifact/1ksBAgPLyVmLGKdm48x6sf): "Home mode opens the app to everyone, using the drinks bars have already published", "Bars publish releases, with a choice of menu description only or the full spec", "An age check at sign-up", and "Reporting, blocking and content filtering from day one". It covers the two pieces [the first schema proposal](schema_proposal.md) left out: publishing and moderation.

| # | Piece | Migration |
|---|---|---|
| 4a | Blocks and moderation holds | `20260926170000_blocks_and_moderation_holds.sql` (first, because the public read paths filter on it) |
| 1, 2 | Publish modes, releases, the public projection | `20260926170100_publishing.sql` |
| 3 | Collections, home menus, the age check | `20260926170200_collections_and_age_check.sql` |
| 4b | Reports and moderator tools | `20260926170300_reports.sql` |

Tests: `supabase/tests/publishing-moderation.test.mjs` (47 tests). With the existing suites that's 184, all passing on the isolated stack.

**Not in this proposal:** comments (reports accept a comment id so they're ready for it); the "can make" function; share cards and shopping lists (app work over these tables); an admin moderation screen (moderators work through two RPCs for now); any app UI.

## Principles

1. **Members see exactly what they saw.** `items_select`, `can_view_bar_item()`, `my_bar_ids()` and the five role levels don't change. Publishing adds a second, public read path beside them. It only ever adds: nothing a member could see becomes hidden.
2. **The public path returns public columns only.** Opening a raw `items` row to strangers would hand out bartender notes (`items.notes`, shown as "Bartender notes"), price, status and the role overrides. So non-members never read `items`; they read `published_items`, a view with only the menu-card columns.
3. **Same patterns as the security lockdown and the first proposal.** RLS on every table, `TO authenticated` unless a row is public on purpose, helpers in `private` with `search_path = ''`, set-returning helpers used as `x IN (SELECT private.fn())`, composite foreign keys so a child row can't point at another bar's parent.
4. **Anything signed-out visitors read needs no private helper.** The anon role has no access to the `private` schema, so public views and anon policies are written inline. That's why `published_items` repeats the block check instead of calling `private.blocked_user_ids()`.
5. **Moderators' decisions stick.** A takedown is a `moderated_at` hold that only catalog admins can set or clear, so an owner can't undo it by editing the row.
6. **Keep less personal data.** The age check keeps the outcome, not the birth date. Reports keep the reporter only while their account exists.

## Shared helpers

| Helper | What it answers |
|---|---|
| `private.blocked_user_ids()` | Everyone the caller has blocked or been blocked by. Empty signed out. |
| `private.guard_moderated_at()` | Trigger on `items`, `profiles`, `releases`: only moderators (or the service role) set or clear `moderated_at`. |
| `private.guard_item_publish()` | Trigger on `items`: who may change `publish_mode`, and what it needs first. Keeps `published_at` in step. |
| `private.guard_release_publish()`, `private.guard_release_item()` | Triggers: a live release only holds published drinks. |
| `public.published_items` (view) | The public projection of published drinks and what they reference. |
| `public.published_ingredient(app_recipe_presentation)` | Computed relationship: the ingredient a spec row shows, for non-members. |
| `private.is_age_confirmed()` | Whether the caller has passed the age check. |
| `public.confirm_age(birth_date, country)`, `public.get_my_age_check()` | The age check, for the app. |
| `private.can_report_profile(profile)` | A profile the caller can see, or someone they've blocked. |
| `private.my_reports_today()` | The daily report limit (a policy can't count its own table). |
| `public.resolve_report(...)`, `public.set_content_hidden(...)` | Moderator tools. Catalog admins only. |

## 1. Publishing: the level below Guest

### How it fits the role levels

The brief's table asks for "a level below Guest for the public". That level is **Public (0)**, and it isn't a membership: nobody holds it in `user_bars`, and `user_bars.role_level` keeps its 10 to 40 CHECK. It's what anyone gets, signed in or not, for drinks a bar has chosen to publish.

| Level | Sees a bar's drink | Sees its spec |
|---|---|---|
| Public (0) | when `publish_mode` is `description` or `spec`, through `published_items` | when `publish_mode` is `spec`: generic ingredient, amount, unit |
| Guest (10) and up | as today: `items_select` via `can_view_bar_item()`, by the bar's visibility level and the drink's override; plus anything public | as today, by the bar's generic, brand, measurement and prep levels; never less than the public spec |

So publishing is a floor. A drink hidden from Guests (visibility override 30) that an admin publishes is visible to Guests too, through the public path, like everyone. `can_view_bar_item()` itself is untouched: it still answers "may this member read the raw row", and the raw row is still members-only.

### `items.publish_mode`

New enum `item_publish_mode`:

| Value | The public sees |
|---|---|
| `private` (default) | nothing. Every existing drink starts here, so nothing changes on deploy. |
| `description` | the menu card: name, description, glass, ice, family, methods, picture, credit (creator, origin bar, year). |
| `spec` | the menu card, plus the spec: ingredients at the generic level (Blended Scotch, not the brand), amounts and units. Preparation notes and the specific brand stay at the bar's own levels. |

`items.published_at` records when it last went from private to public. `items.moderated_at` is the moderation hold (section 4).

**Who can change it** (`guard_item_publish`, on insert and on changes to `publish_mode` or `bar_id`):

- A bar's drink: members with the `publish` capability at that bar (Admin by default, grantable to other roles), in both directions. A Drink Creator can still edit the drink, just not publish or unpublish it. The bar also needs a public, unmoderated profile, so every published drink is credited to someone.
- A person's own drink (no bar): its creator, with a public, unmoderated person profile.
- The shared catalogue (no bar, no creator): catalog admins.

### `published_items` (view)

Runs as its owner, like `app_recipe_presentation`, and is readable by `anon` and `authenticated`. Columns: `id`, `name`, `item_type`, `description`, `bar_id`, `glassware_id`, `ice_id`, `family_id`, `origin`, `abv`, `icon_key`, `icon_url`, `publish_mode`, `published_at`, the credit columns (`riff_of_id`, `creator_profile_id`, `origin_bar_profile_id`, `origin_year`, `credit_status`), `is_reference`, and the hero picture (`image_url`, `image_is_generated` so the Sketch tag survives into the public app).

Two kinds of row:

- **Published drinks**: `publish_mode` isn't `private`, no moderation hold, and the bar (or, for a person's own drink, its creator) has a public, unmoderated profile. A person's own drink also drops out when the caller and its creator have blocked each other.
- **References** (`is_reference = true`): the glass, ice, family and methods those drinks use, and the generic ingredients of `spec` drinks. Name, type and picture only; description and bar are NULL. This is how a stranger's app can say "Rocks glass" and "Honey-ginger syrup" without reading the bar's rows. A house-made syrup's own recipe stays private unless the syrup itself is published with its spec.

### `app_recipe_presentation`

Same columns and types, two changes:

1. A drink published with its full spec returns its rows to everyone, signed out included, at the public level. `anon` gets `SELECT` on the view; its WHERE clause gives signed-out callers only those drinks.
2. The member branches now also require a membership row. Before, the view filtered non-members out in its WHERE clause; now that some non-members get rows, the CASE branches check it themselves. For every row the view returned before, the membership already existed, so members see exactly what they saw.

A `description` drink's rows stay members-only, and a Guest still gets them with the spec masked (tested). Non-members name the ingredients with the `published_ingredient` computed relationship, because `display_ingredient` goes through the `items` policy, which they don't pass.

## 2. Releases

`releases`: `bar_id`, `name` ("Autumn release"), `description`, `cover_url`, `release_date` (the date it's known by), `published_at` (NULL = draft; a future time schedules it), `moderated_at`, `created_by`.

`release_items`: `release_id`, `bar_id`, `item_id`, `sort_order`. Composite foreign keys to `releases (id, bar_id)` and `items (id, bar_id)` (a new unique constraint on `items`), so a release only holds its own bar's drinks.

Rules, enforced for everyone including the service role:

- Publishing a release needs a public bar profile, at least one drink, and every drink published (`description` or `spec`). Each drink keeps its own mode, so one release can mix menu-card-only drinks and full specs.
- A private drink can't be added to a live release.
- Unpublishing a drink later is allowed: it simply drops out of the public view of the release, since the drink list only holds ids and `published_items` decides what the public sees.

**RLS:**

| Table | Read | Write |
|---|---|---|
| `releases` | live ones (`published_at <= now()`, no hold): everyone, signed out too; drafts and scheduled: `publish` capability | `publish` capability |
| `release_items` | rows of live releases: everyone; all rows: `publish` capability | `publish` capability |

## 3. Collections, home menus and the age check

### Collections

- `collected_items`: `user_id`, `item_id`, `release_id` (where they found it, optional), `collected_at`. A drink can be saved when it's published and visible to the caller, or when they can already read it (their bar's drinks, the shared catalogue). References and private drinks can't be saved.
- `collected_releases`: `user_id`, `release_id`, `collected_at`. Only live releases.

Both are private to their owner (read, insert, delete), and saving needs a confirmed age. They're live references: if a bar unpublishes a drink, it drops out of the collector's view too (see open questions).

### Home menus

The brief's "Your menu, Sat 27 Sep, 6 guests" reuses `menus` with no bar. Two additions: `menus.menu_date` and `menus.guest_count`.

One policy change: **bar-less menus become private to their creator.** Today `menus_select` lets every signed-in user read every bar-less menu, even though `prepare_account_deletion` already calls them "private working documents". Once home mode opens sign-ups, that would publish everyone's party plans. Legacy bar-less menus with no recorded creator (production has three, checked read-only on 2026-09-26) keep today's behaviour. `menu_drinks` follows `menus`, so it's covered too.

### Age check

`confirm_age(birth_date, country_code)` is called once at sign-up:

- It compares the date with the country's legal drinking age (`private.drinking_age`: 21 in the US and UAE, 20 in Japan, Iceland and Thailand, 19 in South Korea and Canada, 18 elsewhere, taking the strictest region where it varies).
- It stores only the outcome in `private.age_checks`: country, the age applied, and when. **The birth date is never stored.**
- Under age: it returns NULL and records it, and a second attempt with a different date is refused (the usual "neutral age gate" rule). Support can clear the row.
- `get_my_age_check()` tells the app `confirmed`, `under_age` or `unknown`.

`private.age_checks` is in the private schema with RLS on and no policies: nobody reads it through the API.

Enforced today on collecting (drinks and releases). See the open questions for where else it should apply.

## 4. Moderation

### Blocks

`user_blocks`: `blocker_id`, `blocked_id`, `created_at`. Private to the blocker; the blocked person can't read it. People block from a profile, which carries the user id.

**What a block filters, in both directions** (so the blocker disappears for the blocked person too):

| Where | Filter |
|---|---|
| Public profiles | `profiles_select_public` (signed in) skips profiles on either side of a block |
| `published_items` | a person's own published drinks by someone on either side of a block |
| Comments, public rankings per person | not built yet; they should use `private.blocked_user_ids()` the same way |

A bar's drinks aren't one person's content, so a block doesn't hide them, even when a staff member you blocked wrote them. Area rankings are anonymous aggregates and stay as they are. Signed-out visitors can't block, so their policies don't check.

### Moderation holds

`moderated_at` on `items`, `profiles` and `releases`. A hold takes the row out of every public path: `published_items`, spec rows in `app_recipe_presentation`, public profiles, live releases, and `get_drink_rankings()` (redefined to skip moderated venue profiles). The owner still sees their own row, and can't lift the hold. Hiding a person's profile also hides their own published drinks, since those need a public, unmoderated profile.

### Reports

`reports`: `reporter_id`, `target_kind` (`profile`, `item`, `release`, `comment`, `ranking`), one target column per kind (`profile_id`, `item_id`, `release_id`, `comment_id`; a ranking uses `item_id` for the list and `profile_id` for the bar), `reason` (`spam`, `harassment`, `hate`, `sexual`, `violence`, `self_harm`, `under_age`, `impersonation`, `misleading`, `fake_rankings`, `other`), `details`, `status` (`open`, `actioned`, `dismissed`), `resolution` (shown to the reporter), `reviewed_by`, `reviewed_at`.

- **Filing:** signed in; the target must be something the reporter can see (or someone they've blocked: people often block first and report second). At most one open report per person per target, and 20 a day.
- **Reading:** the reporter and moderators only. The person reported can't see it, and neither can anyone else.
- **Changing:** nobody edits or deletes reports directly. Moderators call `resolve_report(report, status, resolution, hide)`, which closes it and optionally puts a hold on the profile, drink or release, or `set_content_hidden(kind, id, hidden)` to hide or restore directly.
- **Account deletion:** a report outlives both accounts. The reporter becomes NULL and a deleted target's column becomes NULL, so the moderation record stays.

Moderators are the existing catalog admins (`private.app_admins`).

## What signed-out visitors see

Everything below is read through the API with the anon key. Nothing else is reachable signed out.

| Data | Signed out |
|---|---|
| `published_items` | published drinks and their references, public columns only |
| `app_recipe_presentation` | rows of drinks published with their full spec, at the public level |
| `releases`, `release_items` | live releases and their drink lists |
| `profiles` | public, unmoderated profiles (unchanged apart from the hold) |
| `get_drink_rankings`, `get_item_scores`, `get_venue_branding` | unchanged (rankings skip moderated venues) |
| `items`, `recipes`, `menus`, collections, blocks, reports, age checks | nothing |

## RLS at a glance

| Table | Read | Write |
|---|---|---|
| `items.publish_mode` | existing `items` policies | existing `items` policies, plus `guard_item_publish` (`publish` capability, public profile) |
| `items`, `profiles`, `releases` `.moderated_at` | with the row | moderators only (trigger) |
| `published_items` (view) | everyone, signed out too | none |
| `app_recipe_presentation` (view) | members as before; everyone for full-spec drinks | none |
| `releases` | live: everyone; all: `publish` | `publish` |
| `release_items` | live: everyone; all: `publish` | `publish` |
| `collected_items`, `collected_releases` | owner | owner, with a confirmed age |
| `menus` (bar-less) | creator (legacy no-creator rows: everyone signed in) | unchanged |
| `private.age_checks` | nobody (RPCs only) | `confirm_age()` |
| `user_blocks` | blocker | blocker |
| `reports` | reporter, moderators | reporter inserts (open, visible target, 20 a day); moderators via RPC |

## What each screen reads

Bold tables and views are new in this proposal.

| Screen | Reads | Writes |
|---|---|---|
| Discover | `get_drink_rankings`; **`published_items`**, live **`releases`** | none |
| Public drink page (web) | **`published_items`**, `app_recipe_presentation` with **`published_ingredient`**, public `profiles`, `get_item_scores` | **`reports`** |
| My Bar, "Free from bars" | live **`releases`**, **`release_items`**, **`published_items`**; `home_bar_items` for "you can make 5" | **`collected_releases`**, **`collected_items`** |
| Collection | **`collected_releases`**, **`collected_items`**, home `menus` (+ **`menu_date`**, **`guest_count`**), `menu_drinks`, **`published_items`** | same, plus `menus`, `menu_drinks` |
| Drink page (venue), "Cost and publishing" | `items.publish_mode`, `my_capabilities` (`publish`) | `items.publish_mode` |
| Release builder (venue) | **`releases`**, **`release_items`**, bar drinks | **`releases`**, **`release_items`**, `items.publish_mode` |
| "Preview guest menu" / view as public | **`published_items`** filtered to the bar | none |
| Profile | public `profiles`; **`user_blocks`** (own) | **`user_blocks`**, **`reports`** |
| Sign-up | **`get_my_age_check`** | **`confirm_age`** |
| Moderation (catalog admins) | **`reports`** | **`resolve_report`**, **`set_content_hidden`** |

## Rollout

- **Stacked on #44.** These migrations use `profiles`, `bars_with_capability('publish')`, `venue_roles` (in the `app_recipe_presentation` join) and `get_drink_rankings()` from #44. The timestamps come after #44's production versions (`20260926150000` to `150600`) and #67's `20260926130000`. This branch is cut from `step4/base`, which still carries an earlier copy of #44 with `20260926000000` names; the SQL these migrations depend on is the same in both.
- **Redefines two existing objects**, from their latest text: `app_recipe_presentation` (from #44's roles migration) and `get_drink_rankings` (from #44's rankings migration). If either changes again first, regenerate these from the new text.
- **Nothing is dropped or renamed.** Every existing drink starts `private`, so the public sees nothing until a bar publishes. The only behaviour change for current users is that new bar-less menus are private to their creator.
- **One new unique constraint on `items`** (`id`, `bar_id`), for the release foreign key. It can't fail (id is already unique). Moving a released drink to another bar with `assign_item_to_bar` will fail until it's taken out of the release.
- **Advisors:** `published_items` shows the same "security definer view" ERROR as `app_recipe_presentation`, on purpose: it must run as its owner to return public columns of rows the caller can't read. The new two-policy tables add the same "multiple permissive policies" WARN as #44's.
- **App follow-ups** (not in this PR): hooks for the tables above; add them to `types/`; home screens read `published_items` instead of `items`/`app_item_presentation`; the sign-up flow calls `confirm_age`.
- **Applying to production** needs Kevin's explicit OK, and the order matters: 170000, 170100, 170200, 170300.

## Open questions for Kevin

1. **Age check approach.** Self-declared birth date plus country at sign-up, keeping only the outcome, with no retry after an under-age answer. Enough, or do we want a store-level age rating only, or a verification provider later? Where else should it apply: publishing your own drinks, rankings, public profiles? And do signed-out web visitors get a client-side "are you of age" gate before public drink pages?
2. **Drinking ages.** The country list in `private.drinking_age` is a short starting point and needs a legal check. Countries that ban alcohol aren't handled; do we rely on store region availability for those?
3. **What's public by default?** Every drink starts `private`. Should a bar's current menu be published at `description` by default once it has a public profile, or always opt-in per drink?
4. **Public spec level.** "Full spec" shows the generic ingredient, amount and unit; the specific brand and preparation notes stay at the bar's own levels. Should a bar be able to publish brands and prep notes too (a third mode, or a per-bar setting)?
5. **Price in public.** `published_items` leaves out `price`. Show menu prices on public pages?
6. **Collections: live or snapshot?** A collected drink that the bar later unpublishes disappears from the collector's view. Keep it (copy on collect, credited), or respect the bar's decision?
7. **Personal drinks are readable by every signed-in user today** (bar-less `items`, `created_by` set). Production has none yet, but home mode will create many. Make them private to their creator unless published, like home menus in this PR? That's a one-line `items_select` change, left out here because shared recipes may rely on today's rule.
8. **Blocking bars.** Blocks are between people. Do we want "mute this bar" as well?
9. **Blocks in both directions.** A block hides the blocker from the blocked person too (standard, but it lets them infer the block). OK?
10. **Moderators.** Catalog admins moderate. A separate `moderators` role, and a moderation screen, before launch? Should moderators be notified of new reports (a webhook or email)?
11. **Ranking abuse.** A `fake_rankings` report can be filed, but the only action today is hiding a profile. Do we want a way to exclude a person's comparisons from the aggregates?
12. **Report limit.** 20 a day per person, one open report per target. Right numbers?
