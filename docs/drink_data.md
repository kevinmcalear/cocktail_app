# Where each drink fact lives

One home for each fact (AGENTS.md). The 22 Oct 2026 database audit found
several facts that looked stored twice; most turned out to be different facts
with similar names. This page says which column holds what, so the next change
puts a fact in its home and not beside it. The migration that added each one
says more in its header.

## Who made it

| Fact | Home | Not to be confused with |
|---|---|---|
| Who made it, and whether they said yes | `item_credits` (since 20261204300000): one row per credit, as role (`creator`, `co_creator`, `bar`, `maker`), a page or a plain name, and a status (suggested, pending, accepted, verified, declined, disputed) | `items.created_by`, the account that typed it in |
| The bar a shared drink lives on | `items.origin_bar_profile_id` (a bar page), mirrored as its `bar` credit | `items.bar_id`, the venue workspace that owns the row |
| Who makes a bottle (or a garnish, a cordial) | `items.maker_profile_id` (a maker page) | `items.brand_maker` |
| The name on the label | `items.brand_maker`, as text | |

`brand_maker` is the brand ("Eagle Rare"); `maker_profile_id` is the house
that makes it (Buffalo Trace Distillery). They often differ, and both are
kept. A beer's brewery and a wine's producer live only in `brand_maker`: only
ingredients have maker pages (`private.guard_item_maker`). Migration
20261103240000 pointed the branded catalog bottles whose `brand_maker` was
exactly one maker page's name at that page, once; bottles added later are not
linked for you.

## Where it came from

| Fact | Home | Means |
|---|---|---|
| What it's based on | `items.based_on_id` with `based_on_kind`: `riff` (a bar's version of a classic: rankings, bar pages and Discover count it as that classic) or `descends` (the classic a classic descends from, catalog only) | |
| Or the historic style it comes from | `items.based_on_style_id` (`drink_styles`), kind `style` | At most one of this and `based_on_id` |
| Whose spec it borrowed | `based_on_id` while `spec_source = 'classic'` | A menu drink with no lines was filled from the classic; the first edit makes it the bar's |
| Its family | `items.drink_family`, the name as shown (Sour, Highball, Sipper, Low ABV) | The family tree reads its key (`private.family_key`); names outside its eight aren't in the tree |
| The bottle a house prep is made from | `items.made_from_id` | Ingredients only |
| What kind of drink it is in search | `categories` | |

A drink's whole line is `based_on_id` up to its classic, then on up to the
first classic, then the style. The old columns (`riff_of_id`,
`lineage_parent_id`, `lineage_style_id`, `spec_from_id`, `lineage_family`,
`family_id`) stay in step for builds before 2.0; see
[one_home_drop.md](one_home_drop.md).

## Glass

| Fact | Home |
|---|---|
| The kind of glass (Coupe, Rocks) | `drink_glass.glassware_id`, a shared `glassware` item. Every drink starts here |
| The real glass, where someone knows it (a maker's model and size) | `drink_glass.glass_model_id` (`glass_models`). Picking one sets `glassware_id` to its kind; picking another kind lets it go |
| How the drink is drawn | `drink_glass.sketch_variant`, else the real glass's drawing, else the bar's main glass of that kind |
| The glasses a venue pours into | `bar_glassware`, on the bar's page: a real glass (`model_id`) or one the bar describes |

## Ice

| Fact | Home |
|---|---|
| The ice it's served over | `drink_ice.ice_id` |
| The ice it's made with (shaken with, blended with) | `drink_ice.method_ice_id` |
| How the ice sits, layer by layer | `drink_ice.ice_build`; its top layer is `ice_id` |
| How much ice a serve takes | `drink_ice.ice_per_serve_g` |
| The ice a venue has, what it looks like and where it comes from | Ice items of the venue with `item_ice` (shape, size, clear, bought, our machine or made here); see [kit_and_ice.md](kit_and_ice.md). Drinks still name the shared ice |
| How long a venue's spear or Collins block is | `item_ice.length_mm` |

`drink_glass` and `drink_ice` (since 20261204300000) are one row per drink.
The same columns on `items` stay in step for builds before 2.0, and drawings
still read them until the drop; see [one_home_drop.md](one_home_drop.md).

## Had and want

| Fact | Home |
|---|---|
| You had a drink (ranked it, made it, remembered it) | `drinks_had`, one row per occasion; a ranking stays the ranking (`rank_entries`) |
| A drink or bar you want | `want_list`; whether it's done is read from `drinks_had`, never stored |
| Others see your shown makes | only through `get_profile_made` |

## Bars

`bars` is a venue's workspace (team, settings, its own drinks and menus);
`profiles` with kind `bar` is the public bar page. `profiles.bar_id` joins
them. A staffed bar's menus live in `menus`; `profile_menu_editions` is
research history for bars with no team yet.

## Who sees the spec

Permissions decide (20261204300000). Each role's permissions open what it
sees of a venue drink's spec: names with `talking_points` or `specs`; brands,
amounts and units with `specs`; prep notes with `house_made`. A bar switches a
built-in role's permissions in `venue_level_overrides` and a custom role's in
`venue_roles`. `items.spec_hidden` hides one drink's brands, amounts and prep
notes from everyone but those who edit it; names stay. The old per-field
levels (`bars.default_*_level` other than visibility, `items.override_*_level`
other than visibility) are read by nothing and drop once 2.0 is on every phone.
Whether a drink is listed at all is still `default_visibility_level` and
`override_visibility_level`.

## On a list

| Fact | Home |
|---|---|
| A drink on a list now, or planned for it | `menu_drinks`: `on_from` (null: with the list), `off_at`, who added it, what it replaced, its slot, a change waiting for approval |
| A drink's run on a list that ended | `menu_drinks_removed`, with when it went on and came off and who took it off |
| A drink's dates on every list | `drink_list_dates(item ids)`, read from both and from researched editions |
| The list on a day | `list_on_day(list, day)`; a daily list's author and names in `menu_days` |
| Drinks a bar makes that aren't on a list ("Also makes") | `bar_also_makes` (was `bar_off_menu`) |
| A takeover's guest bar | the list's run sheet guest party (`menu_run_parties`); its nights are `events` of kind `takeover` |

## Allergens

| Fact | Home |
|---|---|
| What an ingredient contains | `item_allergens`, the catalogue's and a bar's own once it checked (`item_allergen_checks`) |
| What a drink contains | worked out from its spec (`private.allergen_rollup`), never stored |
| The bar checked a drink's list | `items.allergens_checked_at`, `_by`, and `_spec` (what was checked); it holds while the spec and declarations are unchanged |
| A guest's own allergies | `user_prefs.allergies`, theirs alone, and on the phone when signed out |
