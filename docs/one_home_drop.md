# Dropping the old fields of One home

The One home migration (`20261204300000_one_home.sql`) gave each fact one home and kept the old fields in step with triggers, because app builds before 2.0 still read and write them. Once 2.0 is on every phone, one PR drops them, as `20261201200000` did for `bars.accent_text`. This page is that PR's checklist: for each section, the old fields and their new home, and the read-only production checks to run first. `scripts/oldFields.check.ts` keeps app code from gaining reads of them; the drop PR needs its baseline at zero.

Before the drop, for every section:
- No app version before 2.0 in use for a stretch Kevin picks (PostHog app versions, EAS Update insights by runtime version).
- Every database object that reads an old field is rewritten onto its new home first (scan `pg_proc.prosrc`, `pg_views.definition` and `pg_policies` for the names below).
- Then drop the sync triggers, then the old columns and tables with their indexes and constraints.

## Run names and amounts

- `bar_off_menu` (a view over `bar_also_makes` for old builds): drop the view.
- `bars.default_generic_ingredient_level`, `default_specific_brand_level`, `default_measurement_level`, `default_prep_level`, and `items.override_generic_ingredient_level`, `override_specific_brand_level`, `override_measurement_level`, `override_prep_level`: nothing reads them. Drop with the `spec_hidden_from_levels` trigger, and change `create_new_bar` and `update_bar_settings` to stop taking them. `default_visibility_level` and `override_visibility_level` stay (whether a drink is listed).
- Cancelled (3 Nov 2026, Kevin): `bars.enabled_features`, `public.venue_feature_events`, `set_venue_feature` and `private.record_venue_feature_events` stay. The venue feature switches came back (`lib/venueFeatures.ts`) and read and write them. Only the `'advanced'` key in `enabled_features` is an old field: `bars.advanced_options` is its home. The drop PR stops the `advanced_options_sync` trigger, removes `'advanced'` from every row's `enabled_features` and from the `bars_enabled_features_known` CHECK, and leaves the column.
- `menu_drink_runs` (a view, research history only): `drink_list_dates` replaced it (`20261203100000`). Drop it, and edit `supabase/tests/menu-dates.test.mjs` and `db-indexes.test.mjs`, which read it.
- `events.guest_role_id` (never read; a takeover's guest role lives on `menus.change_role_id`, `20261204400000`).

## One based-on link and one family

### Old fields and their new home

- `items.riff_of_id` -> `items.based_on_id` with `based_on_kind = 'riff'`
- `items.lineage_parent_id` -> `items.based_on_id` with `based_on_kind = 'descends'`
- `items.lineage_style_id` -> `items.based_on_style_id` (`based_on_kind = 'style'`)
- `items.spec_from_id` -> `items.based_on_id` while `items.spec_source = 'classic'` (no column of its own)
- `items.lineage_family` -> `private.family_key(items.drink_family)` on catalog drinks in the history tree (it only ever held those)
- `items.family_id` -> `items.drink_family`, the `family` item's name (any family: "Sour", "Sipper", "Low ABV")
- Then `items` rows with `item_type = 'family'` have nothing pointing at them and can go (after `family_id` is dropped, see (d)).
- Not folded, stay as they are: `items.generic_id`, `items.made_from_id` (ingredient taxonomy), `items.lineage_note` (describes the link; rename to `based_on_note` later if wanted).

Goes with the drop, in the same PR: trigger and function `based_on_sync`; indexes `items_riff_of_id_idx`, `items_lineage_parent_id_idx`, `items_lineage_style_id_idx`, `items_spec_from_id_idx`, `items_family_id_idx`; constraints `items_not_own_riff`, `items_lineage_not_self`, `items_lineage_one_parent`, `items_lineage_catalog_only`, `items_lineage_family_check`; `private.merge_item`'s self-link list; and these DB objects that read the old columns today (rewrite them to read `based_on_*`/`drink_family` first): `private.guard_item_lineage`, `private.guard_spec_source`, `private.claim_spec_on_edit`, `private.guard_bar_also_makes`, `private.refresh_discover_facts`, `private.spec_match_compute`, `private.spec_match_refresh`, `private.spec_match_refresh_all`, triggers `spec_match_item_inserted`/`spec_match_item_updated` (WHEN on `riff_of_id`), `private.can_see_home_item` (`family_id`), `public.discover_drinks`, `public.discover_list`, `public.search_bar_drinks`, `public.get_bar_classics`, `public.get_bar_top_drinks`, `public.my_bar_drinks`, `public.public_lineage_parent` (replace with one returning `based_on_id` + kind when both drinks are published), views `private.published_listing`, `public.published_items`, `public.app_item_presentation` (`family_id`). Tests that name the old columns: `owner-rights-views`, `notes-by-role`, `presentation-speed`, `family-tree`, `classic-fill`, `merge-items`, `spec-match`, and the riff_of_id fixtures in about 15 more (research section 5). `scripts/bar-history.mjs:453` writes `riff_of_id`.

### Production checks

Before applying this migration (read-only, Supabase MCP):

```sql
-- 1. Must be 0, or the migration stops: a drink with two parents.
select count(*) from items where num_nonnulls(riff_of_id, lineage_parent_id, lineage_style_id) > 1;
-- 2. Must be 0, or it stops: a spec copied from a drink that isn't its riff_of_id.
select count(*) from items where spec_from_id is not null and spec_from_id is distinct from riff_of_id;
-- 3. The family items, how many drinks use each, and the tree key each name stands for (null = none; still the family, by name).
select f.name, f.bar_id is not null as venue_own, count(d.id) as drinks,
       (select k from (values ('oldfashioned'),('martini'),('negroni'),('sour'),('sidecar'),('highball'),('tiki'),('flip')) v(k)
         where regexp_replace(lower(f.name), '[^a-z]', '', 'g') in (k, k || 's')) as key
  from items f left join items d on d.family_id = f.id
 where f.item_type = 'family' group by f.id order by drinks desc;
-- 4. Catalog drinks whose two families disagree (lineage_family wins in the backfill).
select d.name, d.lineage_family, f.name from items d join items f on f.id = d.family_id
 where d.lineage_family is not null and regexp_replace(lower(f.name), '[^a-z]', '', 'g') not in (d.lineage_family, d.lineage_family || 's');
-- 5. Stale copied-spec pointers (spec_from_id on a 'bar' spec): cleared by the sync on their next write.
select count(*) from items where spec_from_id is not null and spec_source <> 'classic';
-- 6. Riffs on catalog classics (allowed; one link means a later lineage parent replaces it).
select count(*) from items where riff_of_id is not null and is_catalog;
```

Before the drop PR:

1. Old builds are gone: no installed app version older than the first one that writes `based_on_*` and `drink_family` (EAS update insights per channel, PostHog app versions over the last 30 days).
2. Still in step everywhere (must be 0):
   ```sql
   select count(*) from items
    where riff_of_id is distinct from case when based_on_kind = 'riff' then based_on_id end
       or lineage_parent_id is distinct from case when based_on_kind = 'descends' then based_on_id end
       or lineage_style_id is distinct from case when based_on_kind = 'style' then based_on_style_id end
       or (spec_from_id is not null and spec_from_id is distinct from based_on_id)
       or (lineage_family is not null and lineage_family is distinct from private.family_key(drink_family))
       or (lineage_family is null and family_id is not null
           and lower(drink_family) is distinct from (select lower(private.family_name(f.name)) from items f where f.id = family_id));
   ```
3. Every drink with a `family_id` has the same `drink_family` by name (the last line above), including the catalog tree drinks the backfill left apart.
4. Nothing in the database reads the old columns but `based_on_sync`:
   ```sql
   select n.nspname, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where p.prosrc ~ '(riff_of_id|lineage_parent_id|lineage_style_id|lineage_family|family_id|spec_from_id)';
   select schemaname, viewname from pg_views where definition ~ '(riff_of_id|lineage_parent_id|lineage_style_id|lineage_family|family_id|spec_from_id)';
   select tablename, policyname from pg_policies where coalesce(qual, '') || coalesce(with_check, '') ~ '(riff_of_id|lineage_parent_id|lineage_style_id|lineage_family|family_id|spec_from_id)';
   select tgname from pg_trigger where tgrelid = 'public.items'::regclass and pg_get_triggerdef(oid) ~ '(riff_of_id|lineage_parent_id|lineage_style_id|lineage_family|family_id|spec_from_id)';
   ```
5. Nothing in the app reads them: `grep -rnE 'riff_of_id|lineage_parent_id|lineage_style_id|lineage_family|family_id|spec_from_id' hooks lib components app api scripts`.
6. Drop order in that PR: rewrite the readers in step 4, drop `based_on_sync`, drop the old columns with their indexes and constraints, then delete the `family` items.

## One credit relation

### Old fields and their new home

Drop once 2.0 is on every phone (one drop PR, after the checks in (d)):

- `items.creator_profile_id` -> `item_credits` (role `creator`, `profile_id`, `sort_order` 0)
- `items.creator_names` -> `item_credits` (role `creator`, `name`, `sort_order` 1 to 5); `private.names_fit` and `items_creator_names_check` go with it
- `items.credit_status` -> `item_credits.status`, per credit (`claimed` is `accepted`)
- `public.item_co_creators` -> `item_credits` (role `co_creator`), status 1:1
- `public.item_maker_credits` -> `item_credits` (role `maker`, `what` = `makes`); `confirmed_at` -> `status` accepted and `status_at`
- enums `public.credit_status`, `public.co_creator_status` -> `item_credits.status` (text with a check)
- `public.answer_credit` -> `answer_item_credit`; `public.confirm_maker_credit` -> `answer_item_credit`
- triggers and functions that only keep the old places in step: `private.sync_item_credits_from_co_creator`, `private.sync_item_credits_from_maker_credit`, `private.mirror_credit`, the creator and names halves of `private.sync_item_credits_from_item` and `private.put_main_credit`; the old guards `private.guard_item_credit` (its people-and-bars rule moves to an `item_credits` guard), `private.guard_item_co_creator`, `private.guard_item_maker_credit`
- bodies to rewrite onto `item_credits` (same names, so the app doesn't change): `set_drink_credits`, `set_maker_credit`

Stays: `items.origin_bar_profile_id` (the home bar, an access key for RLS and about 40 functions). Its `bar` row stays mirrored by the bar half of `sync_item_credits_from_item`; the bar's credit status lives only in `item_credits`. `private.run_sheet_credits` stays as the run sheet's own note (it could become a `source` column on the bar row later). `keep_main_credit_on_its_drink` stays (merge rule).

Database readers the drop PR moves (they read the old places today, still correct while in step): `get_profile_name_credits`, `search_bar_drinks`, `move_run_drink_credit` (credit_status), `merge_person_profile` (creator and co-creator updates, now also moves item_credits), matview `private.item_scores`, views `private.published_listing`, `public.published_items` (creator_profile_id, creator_names, credit_status), `public.app_item_presentation` (creator_profile_id). Already moved here: `credits_to_check`, `maker_credit_requests`, `waiting_co_credits`. Tests to move with them: co-creator-credits, co-creators, creator-names, makers, person-claims, bar-people, family-tree (l.106), owner-rights-views (published_items columns), bar-page-visibility, venue-platform, career-history, legends, mathew-resler.

### Production checks

Before applying this migration (read-only, Supabase MCP):
- `select credit_status, count(*) from items group by 1`; counts of `item_co_creators` by status, `item_maker_credits` (confirmed or not), `creator_names` rows and total names. The migration's DO block stops if the backfill count differs from these.
- `select count(*) from item_co_creators c join items i on i.id = c.item_id and i.creator_profile_id = c.profile_id` (a lead who is also a co-creator: allowed, two rows, but worth knowing).
- `select count(*) from item_maker_credits m join profiles p on p.id = m.profile_id where p.kind = 'bar' and m.confirmed_at is null` (bar pages waiting on glassware credits they couldn't see; they now reach that bar's inbox).

Before the drop PR:
1. In step: the `offStep` query from `supabase/tests/item-credits.test.mjs` returns all zeros on production.
2. No old writes left: API logs for 14 days show no calls to `/rest/v1/item_co_creators`, `/rest/v1/item_maker_credits` (insert, delete), `/rpc/answer_credit`, `/rpc/confirm_maker_credit`, and no item inserts carrying `creator_profile_id` or `credit_status`; app version share on 2.0 or later is effectively everyone (PostHog or EAS update insights).
3. No database code still reads the old fields: `select proname from pg_proc where prosrc ~ '(creator_profile_id|creator_names|credit_status|item_co_creators|item_maker_credits)'` and the same over `pg_views`/`pg_matviews` lists only the sync functions this section added.
4. Open disputes and declined credits: `select role, status, count(*) from item_credits where status in ('disputed', 'declined') group by 1, 2`, so none is settled by the drop by accident.
5. Every shared drink still has its home: `select count(*) from items where bar_id is null and not is_catalog and created_by is null and origin_bar_profile_id is null and exists (select 1 from item_credits c where c.item_id = items.id and c.role = 'bar' and c.status = 'declined')` (drinks a moderator took off a bar: they need a new home or removal).

## One had record and one Want list

### Old fields and their new home

Drop these only once 2.0 is on every phone (see d).

- `collected_items` (table) -> `want_list` kind 'drink'. The columns map as: item_id, release_id, name, bar_name and image_url keep their names; collected_at -> wanted_at.
- `collected_items.had_on` -> `drinks_had.had_on`, source 'memory'
- `collected_items.note` -> `drinks_had.note`, source 'memory'
- `made_drinks` (table) -> `drinks_had` source 'made':
  - made_on -> had_on
  - compared, swaps, note, rank_entry_id, image_id, on_profile and created_at keep their names
  - at_home = true
- `rank_entries.had_on` -> `drinks_had.had_on`: the newest had of each rank_entry_id. Dropping it means recreating these, which select it:
  - the views `public.rank_entry_scores` and `private.counted_rank_scores`
  - `get_profile_drinks` (shows_dates)
  - the app reads in (b)
- `loved_bars` as "want to go" -> `want_list` kind 'bar'. `loved_bars` itself stays, as follow: alerts, `my_week`, `bar_relevance`.
- Columns that exist only for the transition: `drinks_had.made_drink_id`, `drinks_had.collected_item_id`, `want_list.collected_item_id`.
- `get_profile_made`: its `id` (the made_drinks id, COALESCE(made_drink_id, id)) -> `had_id`. Drop the COALESCE.
- Functions and triggers that go with the old tables:
  - `private.fill_collected_memory`, `private.limit_made_drinks`, and made_drinks' `screen_text` trigger. The function `private.screen_made_text` stays: drinks_had uses it.
  - sync triggers: `made_drink_to_had`, `collected_item_to_want`, `had_to_old_tables`, `want_to_old_tables`
  - `private.backfill_had_and_want`, after the final check
- Keep `private.rank_entry_to_had`: a ranking is a had, for good. Its guard becomes harmless.
- Keep the hidden_bars half of `loved_bar_to_want`: hiding a bar drops it from Want. Split it out. The loved_bars half goes once loving no longer means wanting.
- Learn drinks_had or want_list at the drop, not before (the section's last comment block says why each can wait):
  - `private.merge_item` and `private.remove_venue` keep a picture "still used" by checking made_drinks. Switch both to drinks_had.image_id.
  - `private.storage_paths_in_use`: swap collected_items.image_url for want_list.image_url.
  - `public.my_ranked_drink_names`: no longer needed if the app reads drinks_had.name.
  - `private.merge_person_profile`: needs nothing. It merges person pages only, and both tables point at bar pages only.
- Not folded in, so these stay: `collected_releases`, `saved_menu_editions`, `hidden_bars`, `rank_comparisons`, `drink_photos`.

### Production checks

Read-only unless noted, and run in BEGIN/ROLLBACK.

1. **Nobody is on an old build.** EAS update insights show no launches on builds before 2.0 for two weeks or more. Also check that the API logs show no requests to `/rest/v1/collected_items`, `/made_drinks` or `/rest/v1/rank_entries?...had_on`.
   - Don't use row timestamps for this: the triggers write the old tables too.
2. **Drift:** `BEGIN; SELECT * FROM private.backfill_had_and_want(); ROLLBACK;` should add 0 at every step. Two counts are expected and harmless:
   - step 2, after someone deleted a ranking's had in 2.0
   - step 5, after someone un-wanted a bar they still follow with alerts on
3. **Pairs:**
   - every made_drinks row has exactly one drinks_had with its made_drink_id
   - every collected_items row has one want_list row with its collected_item_id
   - every collected row with had_on or note has its memory had
   - no drinks_had.made_drink_id or want_list.collected_item_id points at a missing row
4. **Dates:** count the rank_entries whose had_on is later than the max(drinks_had.had_on) for that rank_entry_id. It should be 0, or the drop would move those dates backward.
5. **Photos:** count the drinks_had rows with image_id and no made_drink_id. If any exist, `merge_item`, `remove_venue` and `storage_paths_in_use` must learn drinks_had in the drop PR, before made_drinks goes. They must anyway.
6. **References:** `select oid::regprocedure from pg_proc where prosrc ~ '(made_drinks|collected_items|fill_collected_memory)'` and the same over `pg_views` and `pg_policies`. Everything listed is recreated or dropped in the drop PR.
7. **Counts for the PR text:** totals only, never user data. Before and after:
   - drinks_had by source
   - want_list by kind and source
   - made_drinks, collected_items and loved_bars
8. **db:health:** add drinks_had and want_list to the empty-table, test-row and RLS-gap checks.

## One glass and one ice record per drink

### Old fields and their new home

| old field | new home |
|---|---|
| items.glassware_id | drink_glass.glassware_id |
| items.glass_model_id | drink_glass.glass_model_id |
| items.sketch_variant | drink_glass.sketch_variant |
| items.ice_id | drink_ice.ice_id |
| items.method_ice_id | drink_ice.method_ice_id |
| items.ice_build | drink_ice.ice_build |
| items.ice_per_serve_g | drink_ice.ice_per_serve_g |

These stay where they are, because they are facts about the glass and ice items (Kit), not about a drink:
- items.glass
- items.ice_kind
- item_ice
- items.capacity_ml
- items.iced_capacity_ml

These are caches or records, not homes, and stay:
- drafts.draft_data glasswareId and iceId (written as rows when the draft is published)
- item_sketches.inputs
- item_versions snapshots

**These go with the columns in the drop PR:**
- **Triggers on items:**
  - `glass_model` (`private.items_glass_model`)
  - `keep_ice_top_layer` (the function stays: drink_ice uses it)
  - `drink_glass_ice_on_insert` and `drink_glass_ice_on_update` (`private.items_to_drink_glass_ice`)
- **Copy-back triggers:** `to_items` on both new tables (`private.drink_glass_to_items`, `private.drink_ice_to_items`)
- **Items checks:** items_ice_build_check, plus the CHECKs on sketch_variant and ice_per_serve_g

**DB objects that read the old columns today** (from a pg_proc and pg_views scan of the local DB). Each moves to the new tables in the drop PR. If the views and RPCs keep their output column names, the app readers that go through them need no change.
- **Drawing inputs:**
  - item_sketches_set_glass_and_ice
  - item_sketches_set_ice_build
  - item_sketches_set_ice_look
  - item_sketches_set_variant
  - item_sketch_variant
  - item_sketch_outline
- **Redraw and job triggers on items:**
  - refresh_ice_build
  - refresh_ice_look
  - refresh_sketch_variant (its glass_model_id part)
  - queue_item_image_job_update (glassware_id, ice_id)
  - queue_item_sketch_job

  These go on drink_glass and drink_ice as AFTER triggers.
- **Redraws started from elsewhere:**
  - refresh_item_kind
  - refresh_glass_model_sketches
- **Functions:**
  - remove_venue_ice
  - can_see_home_item (also add method_ice_id and the build layers, which it misses today)
  - drink_snapshot
  - item_spec_fingerprint and item_flavor_fingerprint
  - drink_cost
  - get_item_sketch_context
  - my_bar_drinks
  - bar_week and week_event_drinks
- **Views:**
  - app_item_presentation (add glass_model_id and sketch_variant to its output while there)
  - published_items
  - private.published_listing
- **merge_item:** add the drink_glass and drink_ice rows to `item_merges.snapshot`. Today its 'item' entry carries them. After the drop it won't.

### Production checks

#### Before applying this migration (read-only, Supabase MCP)

```sql
-- Wrong kind of item: the migration stops on any. Expect 0 and 0.
select count(*) from items d join items g on g.id = d.glassware_id where g.item_type <> 'glassware';
select count(*) from items d
where exists (select 1 from items x where x.id in (d.ice_id, d.method_ice_id) and x.item_type <> 'ice')
   or exists (select 1 from jsonb_array_elements(d.ice_build) l join items x on x.id = (l->>'ice')::uuid where x.item_type <> 'ice');
-- Layers naming an item that no longer exists: copied as they are (decision 5). Expect 0.
select d.id, d.name from items d
where exists (select 1 from jsonb_array_elements(d.ice_build) l where not exists (select 1 from items x where x.id = (l->>'ice')::uuid));
-- Sizes, to compare with count(*) of drink_glass and drink_ice after applying.
select count(*) filter (where num_nonnulls(glassware_id, glass_model_id, sketch_variant) > 0) as glass,
       count(*) filter (where num_nonnulls(ice_id, method_ice_id, ice_build, ice_per_serve_g) > 0) as ice
from items;
-- Which kinds of item carry them (allowed today; worth knowing).
select item_type, count(*) from items
where num_nonnulls(glassware_id, glass_model_id, sketch_variant, ice_id, method_ice_id, ice_build, ice_per_serve_g) > 0 group by 1;
```

#### Before the drop PR

1. **The two homes still agree.** Rerun the migration's end check: the two LEFT JOIN counts in its last DO block. Expect 0 and 0.
2. **Old builds are gone.** No sessions from app versions before 2.0 for a stretch you choose (PostHog app version, or EAS Update insights by runtime version). Old builds write only items, and they would stop being copied.
3. **No app code reads or writes the old columns.** Grep `glassware_id|glass_model_id|sketch_variant|method_ice_id|ice_build|ice_per_serve_g|\bice_id\b` in hooks, lib, components, app, scripts and supabase/functions. Only the new names and embeds should be left (section (b) is the list to clear).
4. **No database object reads them.** Run the pg_proc and pg_views scan used for (a): `prosrc` or `definition` matching those names. Only the objects listed in (a) should come back, and the drop PR rewrites or drops all of them.
5. **Edge functions are deployed** with the new reads (itemPrompts; flavor-worker through get_item_sketch_context). The deploy is by hand and human-gated.
6. **Merges still record what they drop.** merge_item's snapshot records the drink_glass and drink_ice rows.
7. **Empty rows.** `select count(*) from drink_glass where num_nonnulls(glassware_id, glass_model_id, sketch_variant) = 0`, and the same for drink_ice. Delete them in the drop PR (cosmetic).
8. **Dead layer ids.** Rerun the layers check from the first block and settle decision 5.
9. **Nothing writes items with triggers off.** `session_replication_role = replica` would skip the copy. None of scripts, supabase/functions or the migrations does this today. Check again.
