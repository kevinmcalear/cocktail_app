# Schema proposal: Back Bar redesign

Status: **draft for review.** The migrations below are tested against the local Supabase stack only. None of them has been applied to production, and none should be until Kevin approves it.

The spec is the "What the data needs" table in the Back Bar brief (https://claude.ai/artifact/1ksBAgPLyVmLGKdm48x6sf). This proposal covers seven of its rows:

| # | Piece | Migration |
|---|---|---|
| 1 | Venue identity | `20260926000000_venue_identity.sql` |
| 2 | Venue roles | `20260926000100_venue_roles.sql` |
| 3 | Back bar | `20260926000200_back_bar.sql` |
| 4 | Prep and purchasing | `20260926000300_prep_and_purchasing.sql` |
| 6 | Lineage, credit and profiles | `20260926000400_profiles_and_credit.sql` |
| 5 | Events | `20260926000500_events.sql` (after 6, since it credits a profile) |
| 7 | Home bar and rankings | `20260926000600_home_bar_and_rankings.sql` |

Tests: `supabase/tests/venue-platform.test.mjs` (36 tests), plus one updated assertion in `venue-slugs.test.mjs` for the wider branding lookup.

**Not in this proposal:** photo angles, generated images and anything touching `images` or `item_images` (another task owns them); publishing (the level below Guest, per-drink publish mode, bar releases and collections); moderation (reports, blocks, filtering); stock counts and prep batches ("on hand", "made Tue"); the "can make" function itself (the approach is written up in section 7).

## Principles

1. **The base level stays the source of truth for existing policies.** Nothing that reads `user_bars.role_level` changes meaning. Custom roles copy their base level into `role_level`, so every existing policy, view and RPC sees what it sees today.
2. **New finer rules live in new tables.** Capabilities (section 2) are enforced by the new tables' policies and shown by the app. They never contradict what an existing policy already decides by level.
3. **Same patterns as the security lockdown.** RLS on every table, `TO authenticated` unless a row is meant to be public, helpers in the `private` schema with `search_path = ''`, set-returning helpers used as `bar_id IN (SELECT private.fn())` so they run once per query, and composite foreign keys so a child row can't point at another bar's parent.
4. **Signed-out visitors get only what's public on purpose:** public profiles, area rankings over a minimum number of rankers, and the existing branding lookup by exact slug.

## Shared helpers

| Helper | What it answers |
|---|---|
| `private.my_bar_ids(min_role)` | Existing. Now also skips memberships whose venue role has ended. |
| `private.can_write(bar, creator)` | Existing. Same rule, now built on `my_bar_ids(35)` so it skips ended memberships too. |
| `public.get_my_bars()` | Existing. Same change. |
| `public.app_recipe_presentation` | From #39, where it runs as its owner and reads `user_bars` itself. Same change: an ended membership doesn't join, so it reads as "not a member". |
| `public.get_bar_members(bar)` | From #39, also owner-run. Same change: an ended guest can't call it and isn't listed. |
| `private.capabilities(bar)` | The caller's capabilities at a bar (empty if not a member or expired). |
| `private.bars_with_capability(cap)` | Bars where the caller has a capability. The policy building block. |
| `public.my_capabilities(bar)` | For the app: what the signed-in member can do here. |
| `public.get_venue_role_matrix(bar)` | For the Roles screen: every base level and custom role with its capabilities, so the matrix is never re-implemented in TypeScript. |
| `private.item_usable_at_bar(item, bar)` | An item can be stocked at a bar if it's shared or the bar's own, and visible to the caller. |

## 1. Venue identity

Columns on `bars`, next to the logo and colours it already has. A separate `bar_branding` table would add a join to every bar read for no gain: bars' existing policies (members read, admins write) are exactly right for it, and `update_bar_settings()` keeps working.

| Column | Type | Rule |
|---|---|---|
| `primary_color` | text | Existing. This is the accent. |
| `accent_light_color` | text | Light-mode accent. Filled by a trigger whenever the accent changes: the accent darkened in 2% steps until it reaches 4.5:1 on the light ground (`#F6F3EE`). A hand-picked value must pass the same CHECK. Existing hex accents are backfilled. |
| `ground_tint` | text | Optional `#rrggbb` tint for the dark ground. |
| `display_face` | `venue_display_face` enum | `instrument_serif` (default), `fraunces`, `bricolage_grotesque`. |
| `short_name` | text | Home-screen name, 1 to 12 characters. |
| `icon_url` | text | Home-screen icon. |

`get_venue_branding(slug)` now returns these too, still by exact slug only, still callable signed out.

**RLS:** unchanged `bars` policies. Members read, admins (40) write.

## 2. Venue roles

### Tables

`venue_roles`: `bar_id`, `name` (unique per bar, case-insensitive), `base_level` (10, 20, 30, 35, 40), `granted` and `revoked` (arrays of `venue_capability`), optional `ends_at`.

`user_bars.venue_role_id`: nullable, with a composite foreign key `(venue_role_id, bar_id)` so a member can only hold their own bar's roles. `NULL` means a plain base role, which is every membership today.

### How it keeps existing policies working

- Assigning a role sets `role_level` to its base level (trigger). Changing a role's base level moves everyone who holds it.
- Changing a member's `role_level` by hand (an admin edit, or the existing `add_user_to_bar_by_email`) drops them back to a plain base role, so the level you set is the level they get.
- An admin role (40) can't have an end date, so a bar can't lose its last admin on a timer.
- **Expiry:** a membership whose role has ended stops counting in `my_bar_ids()`, `can_write()`, `get_my_bars()`, `app_recipe_presentation`, `get_bar_members()` and the capability helpers immediately. A pg_cron job (`sweep-expired-memberships`, every 15 minutes) then deletes those memberships, so direct `role_level` reads elsewhere stop seeing them too.

### Capabilities

One enum, `venue_capability`, with the rows of the brief's roles matrix:

| Capability | Matrix row | Kind | Guest 10 | Employee 20 | Bartender 30 | Drink Creator 35 | Admin 40 |
|---|---|---|---|---|---|---|---|
| `menu` | Menu and descriptions | level-bound | ● | ● | ● | ● | ● |
| `talking_points` | Talking points and allergens | overridable |  | ● | ● | ● | ● |
| `specs` | Specs | level-bound |  |  | ● | ● | ● |
| `house_made` | House-made recipes | overridable |  |  |  | ● | ● |
| `locations` | Where things live | overridable |  | ● | ● | ● | ● |
| `costs` | Costs and pour cost | overridable |  |  |  |  | ● |
| `edit_drinks` | Create and edit drinks | level-bound |  |  |  | ● | ● |
| `prep` | Prep list and orders | overridable |  |  |  | ● | ● |
| `photos` | Take and replace photos | overridable |  |  | ● | ● | ● |
| `menus` | Build menus and events | level-bound |  |  |  | ● | ● |
| `publish` | Publish to the public app | overridable |  |  |  |  | ● |
| `staff` | Invite and manage staff | level-bound |  |  |  |  | ● |
| `brand` | Edit brand | level-bound |  |  |  |  | ● |

`menu` and `specs` follow the bar's own `default_visibility_level` and `default_measurement_level`, as they do today.

**Level-bound** capabilities are ones an existing policy or view already decides from `role_level` (item and menu writes at 35, roster and brand writes at 40, visibility and measurement levels in the presentation views). They follow the base level and a CHECK constraint refuses overrides, so the app can never show a permission the database would refuse, or hide one the API would still allow.

**Overridable** capabilities are new. Roles grant or revoke them, and the new tables' policies enforce them. `photos` is here for the photo task's policies to use. `talking_points` and `house_made` apply to data in existing tables, so for those rows they're applied where specs are applied today, in the app and the presentation views.

The brief's example roles as data:

| Role | Base | Overrides |
|---|---|---|
| Barback | 20 | grant `house_made`, `prep` |
| Head bartender | 35 | grant `costs` |
| Guest bartender | 35 | revoke `house_made`, `prep`; `ends_at` Sun 5 Oct |

Two cells of the matrix differ from what today's policies already allow, and that difference is accepted (see Decisions): Drink Creators can build menus and events by default, so the Head bartender's override there does nothing, and a guest bartender at base 35 can build menus too.

**RLS:** `venue_roles` readable by the bar's members, written by its admins (`my_bar_ids(40)`), like the roster.

## 3. Back bar

`bar_zones`: `bar_id`, `name` (unique per bar), `kind` (`shelf`, `fridge`, `freezer`, `speed_rail`, `well`, `garnish`, `glass_rack`, `sink`, `bar_top`, `storeroom`, `other`), `description` ("Under the back bar, second from the left. 4 °C."), `photo_url`, and a position on the plan as fractions of its width and height (`plan_x`, `plan_y`, `plan_w`, `plan_h`, all or none, kept inside the plan), `sort_order`.

`item_locations`: `bar_id`, `item_id`, `zone_id` (composite FK to the same bar's zone), `shelf` ("Top shelf · left"), `container` ("1 L squeeze bottle, blue tape, date on the cap"), `photo_url`, `par_amount` + `par_unit`, `sort_order`. An item can live in several places. Items the bar's menus use with no location are the ones "waiting for a spot"; that's a query, not a column.

Positions are fractions, not pixels, so the phone card, the web map and printed labels draw the same plan at any size.

**RLS:**

| Table | Read | Write |
|---|---|---|
| `bar_zones` | `locations` capability | Drink Creator and up (`my_bar_ids(35)`) |
| `item_locations` | `locations` capability | Drink Creator and up, or `prep` capability; item must be shared or the bar's own |

## 4. Prep and purchasing

`item_prep` (one row per house-made item): `yield_amount` + `yield_unit` (4 L), `shelf_life_hours`, `lead_time_minutes` (hands-off time: drip, infuse, freeze), `lead_time_note` ("24 h drip"), `par_amount` + `par_unit`. Keyed by item because house-made items belong to one bar (`items.bar_id`).

`suppliers`: per bar, `name`, `website`, `order_notes`.

`item_purchasing` (per bar and item): `supplier_id` (composite FK to the same bar), `pack_size_amount` + `pack_size_unit` (700 ml), `order_code`.

`item_costs` (per bar and item): `pack_cost_minor`, `currency`. A separate table because costs are a capability of their own: the prep crew builds orders from suppliers and pack sizes but shouldn't see what things cost.

Derived, not stored:

- **Prep list:** an event's or menu's drinks, walked down `recipes` (`parent_ingredient_id` already nests sub-recipes) to house-made items, scaled by covers, with "start by" = event start minus `lead_time_minutes`, and batches = needed / `yield`.
- **Order list:** the same walk ending at bought items, grouped by supplier, rounded up to whole packs.
- **Pour cost:** `item_costs` per pack ÷ `pack_size`, times the amount in the spec; for house-made items, their own recipe's cost ÷ `yield`.

**RLS:**

| Table | Read | Write |
|---|---|---|
| `item_prep` | shared/personal items with the item; bar items with `house_made` or `prep` | `prep`, or edit rights on the item plus `house_made` |
| `suppliers` | `prep` or `costs` | `prep` or `costs` |
| `item_purchasing` | `prep` or `costs` | `prep` or `costs`; item must be usable at the bar |
| `item_costs` | `costs` | `costs` |

## 5. Events

`events`: `bar_id` (host), `name`, `starts_at`, `ends_at` (optional: "7 pm to late"), `menu_id` (an ordinary `menus` row, so `menu_drinks`, covers and menu policies are reused), `guest_profile_id` (the guest venue, credited; a bar profile, so it can be a venue that isn't on the platform), `guest_role_id` (composite FK to a host-bar venue role), `covers_estimate`, `notes`.

How a takeover works end to end:

1. The host builds an event with a menu and names the guest venue's profile.
2. Guest drinks are copied into the host bar with `creator_profile_id` and `origin_bar_profile_id` set, so each drink stays credited to its creator and bar. Copying (not sharing) keeps the rule that a bar's drinks are visible only to its members.
3. The host creates a guest role (for example base 35, revoke `house_made` and `prep`) ending when the event does, and adds the guest staff with it. They lose access on their own.

**RLS:** the host's members read; the guest venue's members read the event row too (so it shows up on their side) but not the host's menu or drinks. Written by `menus` capability (Drink Creator and up). The menu must be the host's, and the guest must be a bar profile the builder can see.

## 6. Lineage, credit and profiles

### Profiles

`profiles` is one kind of profile for home bartenders, working bartenders and bars:

- `kind` (`person`, `bar`), `handle` (unique, `a-z 0-9 . _`, 3 to 30), `display_name`, `bio`, `avatar_url`, `website`.
- Owner: `user_id` (person) or `bar_id` (bar). Neither set means **unclaimed**: a historic creator (Sam Ross) or a venue that isn't on the platform (Milk & Honey).
- `is_public`, default false.
- Where: `locality` for everyone ("Brunswick"); `address_line`, `postcode`, `city`, `region`, `country_code`, `latitude`, `longitude` for bars only. A CHECK stops a person's profile holding an address.

Location lives on the bar's profile, not `bars`, because it's public information and rankings need it for venues that aren't on the platform.

`profile_claims`: someone (or a bar, with `publish`) asks to take over an unclaimed profile. `approve_profile_claim(id)` (catalog admins only) hands it over and turns down other pending claims.

### Credit on drinks

New columns on `items`: `riff_of_id` (self FK), `creator_profile_id`, `origin_bar_profile_id`, `origin_year`, `credit_status` (`suggested`, `claimed`, `verified`).

A trigger keeps credit honest whoever edits the drink:

- The creator must be a person profile, the origin a bar profile.
- A new credit starts as `suggested`.
- Only catalog admins (or the service role) set `verified`. Changing the creator or bar of a verified credit drops it back to `suggested`.
- `claimed` can only be set by the creator themselves, or by a Drink Creator at the origin bar.

The existing `items.origin` label (Classic, Original, Variant) stays; `riff_of_id` is what the family tree follows.

**RLS:**

| Table | Read | Write |
|---|---|---|
| `profiles` | public ones by anyone, signed in or not; private ones by the owner, the bar's members, catalog admins | own person profile; a bar's profile with `publish`; unclaimed profiles by catalog admins |
| `profile_claims` | claimant, catalog admins | claimant inserts a pending claim on a visible unclaimed profile; admins review |
| `items` credit columns | existing `items` policies | existing `items` policies plus the credit trigger |

## 7. Home bar and rankings

### Home bar

`home_bar_items`: `user_id`, `item_id`, `added_at`. Private to the owner, and the item must be visible to them.

**"Can make", written up for the home-mode step:** a SQL function over `home_bar_items` and `recipes`. A bottle satisfies a recipe row if it's the row's ingredient, or shares the row's generic (`parent_ingredient_id`). A house-made ingredient counts as on hand if its own recipe can be made, worked out as a recursive fixpoint (bounded depth). A drink can be made when every non-optional row is satisfied. "One bottle away" is the drinks missing exactly one row, grouped by what's missing and counted.

### Rankings

- `rank_entries`: a drink someone had. `item_id` (what they had), `ranked_as_item_id` (the list it's compared in, usually the classic: "my martinis"), `venue_profile_id` (a public bar profile; `NULL` means made at home), `sentiment` (`loved`, `fine`, `disliked`), `rank_key`, `had_on`. One entry per person, drink, list and place.
- `rank_comparisons`: who, winner entry, loser entry, `is_tie` ("Too close to call"). Both entries must be the caller's and in the same list.
- `rank_entry_scores` (view, runs as the caller): each entry with its personal 0 to 10 score.

**Personal score, like Beli:** the first answer (loved, fine, didn't like) picks a band (10 to 6.7, 6.6 to 3.4, 3.3 to 0). Comparisons place the drink inside the band by binary insertion; the app writes `rank_key` as the midpoint of its neighbours, so no other row moves. Score = top of band minus (band width × position ÷ count in band). The comparisons are kept as the raw answers, so the order can be rebuilt or the method changed later.

### Aggregation: pg_cron and materialized views

Area rankings are computed on a schedule, not per request:

- `private.venue_drink_scores` (materialized view): one row per drink (list) at a bar. Each person counts once (their best score for it there). **Staff don't count at their own bar.** The score is a Bayesian average pulled toward the drink's mean across all bars with a prior of 10 rankers, so three fans can't top a list that others have hundreds of rankings in.
- `private.item_scores` (materialized view): one row per drink wherever it was had, for "best riffs". The creator's own rankings don't count.
- `private.refresh_rankings()` refreshes both `CONCURRENTLY` (unique indexes in place), scheduled by pg_cron at minute 7 of every hour (`refresh-rankings`).
- Both views live in `private`, which the API doesn't expose. They're read only through:
  - `get_drink_rankings(ranked_as, country, city, postcode, limit)`: "Best martini" in an area, best first. Area filters combine, so postcode, city and country are the three zoom levels.
  - `get_item_scores(item_ids)`: scores for a family tree's riffs.
- Both RPCs return a row only when **at least 20 people** have ranked it (`private.ranking_min_rankers()`), and only public bars. Both are callable signed out, for public web pages.

At today's scale this is cheap: the views are small and a full refresh takes milliseconds. If ranking volume grows, the upgrade path is incremental aggregation into a table keyed the same way, refreshed from the entries changed since the last run.

**RLS:** `home_bar_items`, `rank_entries` and `rank_comparisons` are private to their owner. Only the aggregates above are public.

## RLS at a glance

| Table | Read | Write |
|---|---|---|
| `bars` (new columns) | members (unchanged) | admins (unchanged) |
| `venue_roles` | members | admins |
| `user_bars.venue_role_id` | members (unchanged) | admins (unchanged) |
| `bar_zones` | `locations` | level 35+ |
| `item_locations` | `locations` | level 35+ or `prep` |
| `item_prep` | `house_made` or `prep` (bar items) | `prep`, or item editor with `house_made` |
| `suppliers`, `item_purchasing` | `prep` or `costs` | `prep` or `costs` |
| `item_costs` | `costs` | `costs` |
| `events` | host members, guest venue members | `menus` |
| `profiles` | public: everyone; private: owner, bar members | owner, bar `publish`, catalog admins |
| `profile_claims` | claimant, catalog admins | claimant (pending), catalog admins |
| `home_bar_items`, `rank_entries`, `rank_comparisons` | owner | owner |
| `rank_entry_scores` (view) | owner's rows | none |
| rankings (private MVs) | via RPC, 20+ rankers, public bars | pg_cron |

## What each screen reads

Screens from the brief. Bold tables are new in this proposal.

| Screen | Reads | Writes |
|---|---|---|
| Tonight | active `menus`, `menu_drinks`, `app_item_presentation`; `bars` identity (**accent_light_color**, **display_face**, logo); **`events`** this week for the nudge; **`item_prep`** lead times for "prep starts today"; `my_capabilities` | none |
| Drink (all role views) | `app_item_presentation`, `app_recipe_presentation`; `my_capabilities` and `get_venue_role_matrix` for locked sections and which role opens them; credit columns on `items` and **`profiles`**; **`item_locations`** per ingredient; **`item_costs`** + **`item_purchasing`** for pour cost; **`item_prep`** for house-made ingredients | drink edits (existing) |
| Service view, photo slots | photo task's tables; `my_capabilities` (`photos`) | photo task |
| Where it lives (phone) | **`item_locations`**, **`bar_zones`**, **`item_prep`** (par, shelf life) | **`item_locations`** (prep crew) |
| Back bar map (web) | **`bar_zones`**, **`item_locations`**; "waiting for a spot" = items in active menus' recipes (recursive) with no location | **`bar_zones`**, **`item_locations`** |
| Brand settings (web) | `bars` identity columns | `bars` (admins); the trigger fills the light-mode accent |
| Roles and access (web) | `get_venue_role_matrix`, **`venue_roles`**, `user_bars` | **`venue_roles`**, `user_bars.venue_role_id` |
| Prep | **`events`**, `menus`, `menu_drinks`, `recipes` (recursive), **`item_prep`**, **`item_purchasing`**, **`suppliers`** | **`item_prep`** par |
| Batch | `recipes`, **`item_prep`** yield, **`item_purchasing`** pack size | none |
| Study | `menus`, presentation views, `my_capabilities` | none (quiz state is out of scope) |
| Library | `items`, presentation views; "needs photo" from the photo task | none |
| Takeover builder (web) | **`events`**, `menus`, `menu_drinks`, credit on `items`, **`profiles`** (guest venue), **`venue_roles`**, `user_bars`, **`item_prep`**, **`item_purchasing`** | **`events`**, `menus`, `menu_drinks`, copied `items`, **`venue_roles`**, `user_bars` |
| Discover | `get_drink_rankings` | none |
| Rank | **`rank_entry_scores`** (own list, for binary insertion), public bar **`profiles`** to pick the venue | **`rank_entries`**, **`rank_comparisons`** |
| Family tree | `items.riff_of_id` up and down, **`profiles`** (creator, origin bar), `credit_status`, `get_item_scores` for riffs | **`profile_claims`** |
| Profile | **`profiles`**; originals = `items` by `creator_profile_id`; own rankings and shelf | own **`profiles`** row |
| My Bar | **`home_bar_items`**, `recipes` ("can make", one bottle away); releases need the publishing piece | **`home_bar_items`** |
| Collection | publishing piece (releases, collected menus); home menus can reuse `menus` with no bar | publishing piece |
| Public drink page (web) | public **`profiles`**, `get_drink_rankings`, `get_item_scores`; the drink itself needs the publishing piece | none |

## Rollout

- **Stacked on #39.** The roles migration redefines `app_recipe_presentation` and `get_bar_members()` as #39 leaves them (owner-run, role-scoped) plus the expiry rule, so #39 must be applied first.
- **Order:** the migrations are independent enough to ship with the roadmap steps: identity with step 2 (navigation and venue theming), roles with step 3, back bar, prep, purchasing and events with step 4, profiles, credit, home bar and rankings with step 7. They can also land together; each only adds.
- **Nothing is dropped or renamed.** Existing rows are untouched except the `accent_light_color` backfill. `get_venue_branding` gains columns; callers reading the old ones keep working.
- **Production prerequisite:** the roles migration runs `CREATE EXTENSION IF NOT EXISTS pg_cron` and schedules two jobs. Confirm pg_cron is allowed on the project before applying.
- **App follow-ups:** mirror `venue_capability` in `lib/roles.ts` (human-gated) or read `get_venue_role_matrix`; add the new tables to `types/`; the storage policy needs a folder for zone and container photos (coordinate with the photo task).
- **Account deletion:** new user-owned rows (profile, shelf, rankings, claims) cascade with the auth user. A deleted person's credits on drinks lose their creator link. A deleted bar's profile stays behind unclaimed, so credits to it survive.

## Decisions

- **Two matrix cells follow today's policies, not the brief** (Kevin, 2026-09-26). Level 35 can already write menus, so Drink Creators get "Build menus and events" by default, and a guest bartender at base 35 can build menus. `can_write()` keeps its meaning; revisit only if a venue asks for a role that edits drinks but not menus.

## Open questions for Kevin

1. **Level names.** The brief says Floor and Maker; `lib/roles.ts` says Employee and Drink Creator. Rename the labels?
2. **Par in two places.** Per location (`item_locations`, "restock this spot to 2") and per house-made item (`item_prep`, "keep 2 L made"). Bought items' order par is the sum of their location pars. OK?
3. **Expiry per role or per person?** The brief puts the end date on the role, which fits takeovers. A per-member end date would also cover a one-off trial shift.
4. **Bar profiles private by default.** A guest venue has to be visible to be credited on an event, so Pale Moth needs a public profile first. Default bar profiles to public?
5. **Person profiles and rankings private by default.** Public profiles show originals; rankings and shelves stay private until we decide what's shareable.
6. **Ranking numbers:** minimum 20 rankers, prior of 10, hourly refresh. Pick the real numbers (the brief's mockups show 88 to 402).
7. **Who creates unclaimed profiles** (historic creators, off-platform venues)? Catalog admins only for now. Letting anyone suggest one needs moderation.
8. **Currency.** `item_costs` stores a currency per row. Add a bar-level currency instead?
9. **Account deletion and credit.** Deleting an account removes the person's profile, so drinks lose the creator link. Alternative: keep an anonymised "former member" credit.
10. **Event guest drinks are copied** into the host bar with credit, rather than shared across bars. OK, or do we want cross-bar sharing (which would change `items` policies)?
11. **Applying to production.** Which migrations, when, and whether pg_cron can be enabled.
