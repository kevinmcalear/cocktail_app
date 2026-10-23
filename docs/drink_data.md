# Where each drink fact lives

One home for each fact (AGENTS.md). The 22 Oct 2026 database audit found
several facts that looked stored twice; most turned out to be different facts
with similar names. This page says which column holds what, so the next change
puts a fact in its home and not beside it. The migration that added each one
says more in its header.

## Who made it

| Fact | Home | Not to be confused with |
|---|---|---|
| The bar a drink is from | `items.origin_bar_profile_id` (a bar page) | `items.bar_id`, the venue workspace that owns the row |
| The person who created it | `items.creator_profile_id` | `items.created_by`, the account that typed it in |
| Others who created it with them | `item_co_creators` | |
| Who cut its ice or made its glass ("ice by") | `item_maker_credits`, confirmed by the maker's team | |
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
| A bar's version of a classic | `items.riff_of_id` | Rankings, bar pages and Discover count it as that classic |
| Whose spec it borrowed | `items.spec_from_id` with `spec_source = 'classic'` | A menu drink with no lines was filled from the classic; the first edit makes it the bar's |
| The classic a classic descends from | `items.lineage_parent_id` | The family tree (Gold Rush for the Penicillin). Catalog only |
| Or the historic style it comes from | `items.lineage_style_id` (`drink_styles`) | Sour for the Whiskey Sour. At most one of this and the parent |
| Which of the family tree's eight families | `items.lineage_family`, a key (`sour`, `oldfashioned`) | The family tree board, catalog classics only |
| The menu group a venue files it under | `items.family_id`, a `family` item (Sour, Highball, Sipper) | A venue's own grouping, not history |
| The bottle a house prep is made from | `items.made_from_id` | Ingredients only |
| What kind of drink it is in search | `categories` | |

`lineage_family` and `family_id` are two taxonomies: one is the history
tree's, the other a bar's way of grouping its list. A drink's whole line is
`riff_of_id` up to its classic, then `lineage_parent_id` up to the first
classic, then the styles.

## Glass

| Fact | Home |
|---|---|
| The kind of glass (Coupe, Rocks) | `items.glassware_id`, a shared `glassware` item. Every drink starts here |
| The real glass, where someone knows it (a maker's model and size) | `items.glass_model_id` (`glass_models`). Picking one sets `glassware_id` to its kind; picking another kind lets it go |
| How the drink is drawn | `items.sketch_variant`, else the real glass's drawing, else the bar's main glass of that kind |
| The glasses a venue pours into | `bar_glassware`, on the bar's page: a real glass (`model_id`) or one the bar describes |

## Ice

| Fact | Home |
|---|---|
| The ice it's served over | `items.ice_id` |
| The ice it's made with (shaken with, blended with) | `items.method_ice_id` |
| How the ice sits, layer by layer | `items.ice_build`; its top layer is `ice_id` |

## Bars

`bars` is a venue's workspace (team, settings, its own drinks and menus);
`profiles` with kind `bar` is the public bar page. `profiles.bar_id` joins
them. A staffed bar's menus live in `menus`; `profile_menu_editions` is
research history for bars with no team yet.
