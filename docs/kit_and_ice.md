# Kit and ice: build plan

Approved by Kevin on 25 Oct 2026 ("this seems good enough for now, go for it in designing this into everything and moving forward"). The design is the canvas "Cocktail: the whole app" (https://claude.ai/artifact/KRE17t8L8SC8f4M4KFLgZe, read it with the Artifact tool), Venue tools page:

- "Kit and ice" boards `venue-ice-made-your-way.dc.html` (steps 1 to 6), `-2` (steps 7 to 12), `-3` (step 13, home), from y 23400, with notes `kiticeplan` (data plan, sources), `kiticedecided` (Kevin's calls).
- "Glasses and ice from your drinks" (`venue-glass-ice-match.dc.html`, y 20300), approved with it.

## What Kevin decided

1. Glassware, Ice and Tools behave the same everywhere: the same Kit list (drawing, name, where it comes from in one line, one Add button), the same item page, the same Add sheet with three questions in the same order (what is it, where does it come from, one more only when it matters), and the same "not in your kit, add it?" prompt in every wizard and in What next.
2. Ice question 1: what it looks like in the glass (cubes, large cube, Collins block, sphere, cut to size, crushed, pebble, shaved, something else), then optional size and clear or cloudy; stamped and something frozen inside behind "More".
3. Ice question 2: bought (a supplier; suppliers can "cut to order"), our machine (a name: Hoshizaki, Kold-Draft, a clear ice maker like a Klaris), or we make it.
4. Ice question 3 (made here): a starting recipe from six common ways (cut from a block or slab, freeze in a mould, freeze a block clear, smash in a Lewis bag, crack to order, press a sphere) and six more behind a link (carve by hand, shave from a block, stamp, something frozen inside, flavoured ice, write our own).
5. Block = the whole freeze (ice companies freeze 300 lb Clinebell blocks); slab = a cut layer. Either can be made or bought. They sit in "Blocks and slabs, to cut from" under the venue's ice.
6. Eddie's stack: a Collins block that isn't tall enough sits on small clear pieces; the wizard offers it from the block's length and the glass's height; once the drink is in, the join is invisible. This is the existing spear-on-cubes build (#702).
7. Glassware and tools ask where they come from too. Tools become a list with Add (no switches), with a name of your own and where it is (behind the bar, prep kitchen).
8. Home: glassware and ice, optional, offered once, after venues.
9. Drawings: make the ice accurate (size to scale against the glass, clear or cloudy, stamp, what's frozen inside, faint seams under liquid).

## Today's schema (mapped 25 Oct, main at 7cf80920)

- Ice items: `items` with `item_type = 'ice'`, all catalog rows (`bar_id` null); no ice columns beyond name/icon/capacity. Drinks: `ice_id` (top layer, FK items), `method_ice_id` (FK items, 20261029100000), `ice_build` jsonb layers `{ice, n, to, packed, tin}` (20261029500000, checked by `private.valid_ice_build`, no FK inside); `20261103210000_ice_top_layer.sql` keeps `ice_id` = top layer and adds `bar_kit.length_mm`; trigger `set_ice_build` writes `item_sketches.inputs.build` via `private.ice_kind(name)`.
- Venue ice and tools: `bar_kit (bar_id, kind 'ice'|'tool', key, note, made_here, supplier_id, sort_order, length_mm)`; ice key one of 7 kinds; tool key an equipment id; RLS: team reads, `prep` writes. Only `hooks/useBarKit.ts` touches it (callers: KitIceScreen, KitToolsScreen, AddDrinkWizard, IceBuildSheet, MakeScreen via useToolsFor, VenueSettingsLinks; helpers lib/venueKit.ts; lib/iceBuild.ts:149 reads length_mm).
- `private.house_ice` / `set_house_ice` / `refresh_house_ice` (20261019600000) draw a drink with the venue's nearest ice kind, reading `bar_kit` ice keys.
- Glassware: `bar_glassware` (profile_id of the bar's profile, glass, variant, name, maker, designer, series, shape_note, source_urls, is_default, maker_profile_id, model_id → glass_models); RLS read any signed-in, write `can_edit_bar_glassware` (prep).
- Home: `home_kit_items (user_id, equipment_id)` only; no home glassware or ice.
- Suppliers: `suppliers` (bar_id, supplies text[] of bottles/ice/produce/garnish/glassware/barware/equipment); RLS prep or costs.
- House preps: `item_prep`, `item_steps (item_id, position, body, timer_seconds)`, `recipes` (recipe_item_id, ingredient_item_id, ...). No item_type check on these tables; `ingredient_role = 'prep'` and `made_from_id` require `item_type = 'ingredient'`; hooks/usePrepCard.ts assumes ingredients.
- Equipment: only lib/techniques/equipment.ts (~58 ids); no table; steps store no equipment.
- Ice makers exist as maker profiles (34) and some suppliers; no ice product items.

## PRs

PR 1 lands first. After it, PRs 2, 3 and 5 can run in parallel worktrees (5 can start earlier against a sketch-input contract); 4 needs 2 and 3; 6 needs 2; 7 last.

| PR | What | Gated? |
| --- | --- | --- |
| 1. Kit data | Migration + hooks + types, details below. | Migration: Kevin's OK at the PR head |
| 2. Kit screens | Steps 1 to 6: KitList, KitItemPage, KitAddSheet shared by Glassware, Ice, Tools; Tools list with Add and own names; blocks and slabs section. Old KitIceScreen chips and KitToolsScreen switches removed. | No |
| 3. Ice recipes | Steps 7, 8: ice made here edited with the house-prep editor; templates in our own words (bar practice labelled); "starts from" another ice; steps name tools; new equipment: bandsaw, ice saw, ice stamp, ice ball press, block shaver. | No |
| 4. Kit check | Step 11: one check (glass, ice followed back through its recipe, tools from method/preps/techniques) on the drink page, Library filter (Ready here / Needs something), nearest swap; technique library and wizard prep step read the venue's tools in venue mode. | No |
| 5. Drawings | Steps 9, 10: painter draws ice size to scale, clear or cloudy, stamp, frozen inside, Collins block on small pieces with faint seams under liquid. Shared sketch code is used by edge functions too: deploying those stays human-gated. | No (edge deploy gated) |
| 6. Same sheet everywhere | Step 12: wizard "not in your kit, add it?" for ice and tools; What next "From your drinks" for glasses, ice, tools; Add sheet opened prefilled; wizard offers small cubes under a short Collins block. | No |
| 7. Home | Step 13: My Bar › Your kit with optional glassware and ice; its own migration for home glassware and home ice. | Migration: Kevin's OK |

### PR 1: what the data is now (migration `20261110100000_kit_and_ice.sql`)

Built from the starting design above, with the changes noted (why in brackets).

- **Venue ice** is an `items` row (`item_type = 'ice'`, `bar_id` = the venue) with `item_ice` beside it (1:1 on `item_id`, plus `bar_id` so the item and its supplier are both the venue's, by composite keys):
  - `shape`: `cubes`, `large`, `spear` (the Collins block), `sphere`, `cut` (cut to size), `crushed`, `pebble`, `shaved`, `other` (something else), and `block`, `slab` (to cut from). `draw_as` (one of the seven drawing kinds) only for `cut` and `other`; `lib/venueKit.ts` `iceDrawKind` reads it.
  - `size_mm` (a cube's side, a sphere's across, a Collins block's width) and `length_mm` (a Collins block's or spear's length, a block's or slab's longest side). [Two numbers, not width and depth: the drawings are side views, so these are what scale.]
  - `clear` (null is not sure), `stamped`, `frozen_inside` (text), `source` (`bought`, `machine`, `made`, null is not said), `supplier_id` (only when bought), `machine` (only for our machine), `note`.
  - No `sort_order`: the list is in the order ice was added. [Nothing in the design reorders it.]
- **Reading and writing it**: `venue_ice(bar)` lists a venue's ice for its whole team (a supplier's name only for Prep or Costs). `save_venue_ice` and `remove_venue_ice` write the item and its `item_ice` together for anyone with Prep; nobody writes `item_ice` directly. [Prep can't write `items` (that's Edit drinks), and a bartender without the menu capability can't read the venue's items, so an RPC on each side.] Removing is refused while a drink pours the ice (`ice_id`, `method_ice_id`, `ice_build`) or another ice starts from it. Hooks: `hooks/useVenueIce.ts`.
- **Starts from**: a `recipes` line on the ice (`recipe_item_id` = the ice, `ingredient_item_id` = the block, slab, cubes or a flavour). Prep at the venue now writes recipe lines of its own ice items (`private.can_edit_venue_ice`); every other recipe still needs Edit drinks. Steps and Makes/Keeps already allowed Prep (`item_steps`, `item_prep`).
- **Steps name tools**: `item_steps.equipment text[]`, equipment ids or a venue's own tool by name, at most 12.
- **bar_kit is tools only**: its ice rows moved into ice items in the same migration (names as the wizard says them, made here or the supplier, the note, a spear's length). Tools gained `name` (own tools have no `key`), `location` (`bar`, `prep`), `count`, and `source` (`bought`, `ours`), which replaces `made_here`. `kind` stays, always `tool`, so app builds from before the migration keep saving tools; drop it once those builds are gone.
- **Glassware**: `bar_glassware.source` (`bought`, `ours`), `supplier_id` (the venue's own, checked by a trigger since the row has a profile, not a bar), `count`.
- **Suppliers**: `cuts_to_order`.
- **Drawings**: `private.item_sketches_set_house_ice` reads the venue's ice in the glass from `item_ice` (a `cut` or `other` ice by its `draw_as`; blocks and slabs never), and a change to `item_ice` redraws the venue's drinks. The wizard's spear length is `item_ice.length_mm`.
- **Not yet**: drinks still name the shared ice (`useDropdowns` `iceTypes` and the wizard's lookup leave out venue ice items); PR 6 offers the venue's own. The ice picker and Kit › Ice screens stay as they were until PR 2.

### PR 2: what the screens are now

- **One pattern** in `components/screens/kit/`: `KitList` (drawing, name, where it comes from in one line, one Add button; Ice has "In the glass" and "Blocks and slabs, to cut from"), `KitItemPage` (drawing, facts with Change, how it connects, Remove from Kit), `KitAddSheet` (the three questions on `Sheet`, a centred dialog on the web) with `SourceQuestion` (question 2 for all three).
- **The sheets**, each openable prefilled at any question: `IceSheet` (`ice` or `initial`, `startAt`, `madeStep` for question 3), `GlassSheet` (`glass`, `startAt`, `describe`, `onSave` to hold instead of save), `ToolSheet` (`tool` or `initialKey`, `startAt`). PR 6 opens these from the wizard and What next; PR 4 links to them from the kit check.
- **Routes**: the lists stay at `/settings/bar/<id>/glassware|ice|tools`; one thing opens at `/settings/bar/<id>/kit/<kind>/<item id>` (its own page on a phone, beside the list on a wide screen).
- **Gone**: `GlassForm` (Wide/Deep/Saucer, Who makes it, Designer, Series), the ice chips and the tool switches (`useSetTools`, `toolGroups`). A glass named by hand is its shape and its name; one picked from the catalog keeps its maker on the model.
- **Left for later PRs**: ice question 3 and "How it's made" on the ice page (PR 3: `madeStep`, and the placeholder in `KitIceScreen`'s `IcePage`); "In N drinks", "Needed by" and "What it needs" (PR 4); "Glasses and ice from your drinks" (PR 6).

### PR 3: what ice recipes are now

- Ice made here is edited at `/settings/bar/<bar>/kit/ice/<ice>?recipe=1` (PR 2's item route; no new route, so no `vercel.json` rewrite) (`components/screens/ice/IceRecipeScreen.tsx`), built from the house-prep editor's parts (`MethodEdit` with tools per step, `KeepsSheet` with pieces or kg). Kit › Ice's item page shows `IceRecipeSection` (read view: starts from, steps, what it needs, Add to kit) in place of PR 2's placeholder; `IceSheet`'s `madeStep` asks question 3 with `IceWaysList`, and after the save `startIceRecipe` (`hooks/useIceRecipe.ts`) writes the starting recipe.
- The twelve ways are `lib/iceRecipes.ts`, in our own words, checked on the web (sources at the end of the file). A stamped ice gets a stamp step, except for crushed, cracked and shaved ways.
- Starts from is one `recipes` line, rewritten only when it changes (so its note stays). An ice that starts from this one is never offered, so a direct loop can't be saved; PR 4 should still keep a visited set when it follows a chain back.
- Steps and recipe lines are readable by people with Prep (or house-made) at the venue, as for house preps. The kit check (PR 4) runs for the venue's team, so it may need an RPC to read the chain for a bartender without Prep.
- New equipment: `ice-saw`, `ice-stamp`, `ice-ball-press` (bar), `bandsaw`, `block-shaver` (specialist). No migration.

### PR 6: the same sheet everywhere

- `KitPrompt` (components/screens/kit): "not in your kit, add it?" with Add, Not now and the list. `GlasswarePrompt` (glass picks) and `IcePrompt` (the wizard's ice step) build on it; Add opens `GlassSheet` / `IceSheet` filled in, with "From the <drink>" and Change above question 2.
- What next › From your drinks (`FromDrinksStep`, `hooks/useKitFromDrinks.ts`, `lib/kitFromDrinks.ts`): glasses, ice and tools the venue's drinks name that aren't in its Kit. Glasses by their drawn shape (Add, or Match for one with no real glass), ice by drawing kind, tools from blended drinks and the venue's own ice recipes' steps.
- Small cubes under a short Collins block: the wizard's ice tip from #702 already offers it (glass height from the venue's glass, block length from `item_ice.length_mm`).
- Not yet: drinks still name the shared ice, so a drink can't name the venue's own "Clear cube · 50 mm" (see the PR 1 note), and "15 drinks over ice don't say which · Pick" needs a way to change many drinks at once.

### PR 4: the kit check

- `lib/kitCheck.ts` (+ check): a drink's glass (by drawn shape), each ice it needs (its build's layers and what it's shaken with, by drawing kind) and the tools its methods name (`methodTools`: Shake is tins and a strainer, Stir a mixing glass and a strainer, Blend a blender), against the venue's Kit. An ice the venue makes is followed back through what it starts from (a visited set, so a loop ends) and its steps' tools are checked too. A part of the Kit with nothing listed isn't checked. "Needs a sphere and a block ice shaver"; the nearest ice the venue has (`houseIce`).
- `hooks/useKitCheck.ts`: the venue's Kit with its ice recipes, a drink as the check reads it, `useDrinkKitCheck`, `useVenueKitChecks`, `useKitShelves`. Ice recipes are read as house preps are, so without Prep an ice's own tools aren't followed.
- The drink page's "Can <venue> make it?" (`components/screens/drink/KitCheckSection.tsx`) in venue mode, for the venue's drinks and the catalog's; Add opens Kit's sheets filled in.
- Library: Ready here and Needs something (`KIT_FILTERS`, in the filter menu's Kit section), each tile saying what it needs.
- The technique library and the wizard's prep step read `useKitHere()` (hooks/useBarKit.ts): the venue's tools in venue mode, your home kit otherwise.

Notes for later PRs:

- PR 3: the house-prep editor (`hooks/usePrepCard.ts`) assumes ingredients (`ingredient_role`, `made_from_id` are ingredient-only, by check constraint). Ice made here uses `item_steps`, `item_prep` and `recipes` lines, not `made_from_id`. Prep-only staff still can't write recipe lines of a house prep (an ingredient), only of the venue's ice.
- PR 3/4: `hooks/useVenueIngredients.ts` counts every venue item's recipe lines as ingredients in use, so a block an ice starts from would show there; filter ice out when ice recipes ship.
- PR 6: a drink that names the venue's own ice is visible only to people who see the venue's items; a public (credited) drink should keep naming the shared ice.
- Migration slot: 20261110100000.
