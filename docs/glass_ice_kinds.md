# Glass and ice kinds: plan

Approved by Kevin on 26 Oct 2026 ("Approved with the recommended answers to all five calls"). PR 1 (the migration) is `feat/glass-ice-kinds-data`.

The one screen change is drawn on the canvas "Cocktail: the whole app", Drink page: [Naming a new glass or ice asks what kind it is](https://claude.ai/artifact/KRE17t8L8SC8f4M4KFLgZe#artboard-38acf35d492e) (purple note: drawn, not built).

## Why

A drink names its glass and ice through shared catalog items (`items.glassware_id`, `items.ice_id`, `items.method_ice_id`, the layers of `items.ice_build`). Those items have a name and nothing else, so every reader works out the kind from the name:

- Glass: `glassFromName` (`supabase/functions/_shared/sketchRules.ts`, a list of regexes). Read by the drawing rules, `GlassStep`, `GlassPickSheet`, `SketchGlassPicker` and `isVenueGlassName` (`lib/glassware.ts`).
- Ice: `iceFromName` in the same file, wrapped as `iceKind` (`lib/iceBuild.ts`). Read by the drawing rules, `IceStep`, `AddLayerSheet`, `IceLayers`, `IcePrompt`, `lib/kitCheck.ts`, `lib/kitFromDrinks.ts` and `lib/iceBuild.ts`. In SQL, `private.ice_kind(name)` repeats the same regexes for the drawing triggers (`item_sketches_set_ice_build`, `refresh_ice_build`).

What goes wrong:

- The two ice lists have already drifted. "Hoshizaki" is cubes in the app (`\bhosh`, 26 Oct) and nothing in SQL, so its drawings and its wizard step disagree.
- A name the regexes don't know has no kind. "Custom" (15 drinks) has none.
- One item can't be two things. "Rocks & Crushed ice" (3 drinks) is a glass item with an ice in its name.
- The 16 glass types are written out three times as CHECKs (`glass_models`, `bar_glassware`, `home_glassware`) and once more in TypeScript (`SKETCH_GLASSES`).

Below the catalog, the tree is already sound: glass type, then variant (`private.valid_glass_variant`), then model (`glass_models`), then a venue's or a home's own glass (`bar_glassware`, `home_glassware`). Venue ice has `item_ice.shape`. This plan joins the catalog items to that tree, so a stored item's kind is never guessed.

## What stays name-based, on purpose

Text that isn't an item still has to be read: a drink's description ("served in a coupe"), a menu photo or an import, an AI answer, and a name someone is typing. `glassFromName` and `iceFromName` stay for that, and for the backfill. They stop being used for any item that has a kind.

## The data (one migration, human-gated)

Slot: the next free one after the open PRs (20261123100000, 20261123300000 and 20261123310000 are taken), checked against production first.

1. `private.is_glass_type(text)`: the 16 types in one place. The CHECKs on `glass_models.glass`, `bar_glassware.glass` and `home_glassware.glass` switch to it. A `*.check.ts` asserts it lists the same types as `SKETCH_GLASSES`.
2. `items.glass text`: a glassware item's type. CHECK: null, or `item_type = 'glassware'` and `private.is_glass_type(glass)`.
3. `items.ice_kind text`: how an ice item is drawn in the glass, one of `none`, `cubes`, `large`, `spear`, `crushed`, `pebble`, `shaved`, `sphere` (the drawing's `Ice`). CHECK: null, or `item_type = 'ice'`.
4. Venue ice: `item_ice.draw_as` moves to `items.ice_kind`, so every ice item says how it's drawn in one place. `save_venue_ice` writes it (the shape itself for the seven drawn shapes, the person's pick for `cut` and `other`, null for `block` and `slab`). `venue_ice()` still returns `draw_as`, read from `items`, for app builds from before the migration. `home_ice.draw_as` stays: home ice isn't an item.
5. Null means "not sure": the drink keeps the drawing someone picked for it (`item_sketches.inputs`), else the rules guess, as "Custom" works today.
6. A trigger keeps `glass_models` honest: a model with a `shape_item_id` has that item's `glass`. All 2,089 models with a shape item agree today.
7. Changing a shared item's kind after it exists redraws every drink that uses it, so only admins may change it. Setting the kind when the item is made is open to whoever can make it.
8. The drawing triggers read `items.ice_kind` by id, not `private.ice_kind(name)`, and a change to an item's `glass` or `ice_kind` redraws its drinks (as a change to `item_ice` does now). `private.ice_kind` is dropped.
9. `npm run gen:types` in the same PR.

### Backfill (written out by name in the migration, not by regex)

| Item | Drinks | Kind |
| --- | --- | --- |
| Rocks, Small Rocks, Butcher Glass | 245, 8, 1 | rocks |
| Coupe, Coupette | 229, 159 | coupe |
| Highball | 158 | highball |
| Collins, Swizzle, Tall Spirit Mixer | 80, 1, 1 | collins |
| Martini | 76 | martini |
| Nick & Nora, Chartreuse Glass | 74, 1 | nick |
| Wine | 36 | wine |
| Flute | 15 | flute |
| Fizz, Small Highball | 10, 7 | fizz |
| Julep Cup | 5 | julep |
| Ceramic | 5 | ceramic |
| Beer, Beer Glass | 0, 4 | beer |
| Spritz | 2 | spritz |
| Mug | 2 | mug |
| Tiki Mug | 0 | tiki |
| Snifter | 0 | snifter |
| Custom | 15 | null: not sure (call 1) |
| Rocks & Crushed ice | 3 | split (call 3) |
| Cubes, Hoshizaki | 179, 1 | cubes |
| Large Cube | 78 | large |
| Crushed | 67 | crushed |
| Spear | 19 | spear |
| Shaved, Pebble, Sphere | 6, 1, 1 | as named |
| No Ice (two rows) | 2, 1 | none; merged into one row (call 4) |
| The venues' own ice (7 rows) | 0 | from `shape` and `draw_as` |

Drink counts are production on 26 Oct. Any glass or ice item the list doesn't name stays null, and the migration's notice says how many.

## The app (one PR, after the migration is live)

- `useDropdowns` and the drink queries select `glass` and `ice_kind`. A wizard pick (`WizardPick`) and a spec item carry its kind.
- Every caller listed under Why reads the kind from the item. `lib/iceBuild.ts` takes layers with a kind, not just a name. The drawing input (`SketchDrink`) gains `glassKind` and `iceKind`, used before any name. The name rules only run when a kind is missing.
- `hooks/specLineSave.ts` saves the kind with a new glass or ice item.
- The screen change (canvas board above): after someone types a new glass or ice name, one question appears under the field: "What kind of glass is it?" or "How does it look in the glass?". The name rules preselect a guess ("Tiki bowl" picks Tiki mug), and "Not sure" is always there. It shows in three places: the drink editor's Glass sheet (Add a glass), the wizard's glass step (Another glass) and the wizard's Add a layer sheet (Other ice). Picking an existing item asks nothing.
- `supabase/functions/_shared/sketch.ts` and `sketchRules.ts` change with it. The app bundles them, so this ships as an OTA. Deploying the edge functions that use them (the drawing fill) stays human-gated, and until then they fall back to the name, as now.

## Kevin's calls (26 Oct)

1. "Custom" (15 drinks) has no kind: each drink keeps the drawing picked for it.
2. "Tall Spirit Mixer" is a Collins, as the name rules say now.
3. "Rocks & Crushed ice" is split: its 3 drinks get Rocks, and Crushed when they name no ice, then it's merged into Rocks.
4. "No Ice" stays an ice item, kind `none` ("served without ice", which an empty ice doesn't say), and its two rows become one.
5. Only admins change a shared item's kind once it exists.

## Left for later

- Drinks naming a venue's own ice is still kit and ice PR 6's open item (`docs/kit_and_ice.md`). This plan makes that easier (every ice item has `ice_kind`), but doesn't do it.
- A glass item has no variant. The variant stays a per-drink drawing pick and a per-venue glass fact.
