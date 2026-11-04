# Design system: Back Bar

The written rules behind the Back Bar look. What each screen should be is drawn on the source of truth canvas, "Cocktail 2027" (https://claude.ai/artifact/HFuAkaE1wtZjnYhgjezDrF); the original Back Bar brief (https://claude.ai/artifact/1ksBAgPLyVmLGKdm48x6sf) is background. When the canvas and this file disagree, ask. The tokens are in `constants/tokens.ts`; the components that use them are in `components/ds/` (see the gallery below). Screens that haven't been redesigned yet still use `constants/palette.ts`. `npm run check:design` stops new raw values either way.

## Principles

1. **The drink lights the screen.** Chrome stays ink and glass. Colour comes from the drink's photo and the venue's brand, not from decoration.
2. **Readable across the bar.** Specs are read mid-service, with wet hands, at arm's length. Measurements are at least 17 pt, monospaced, and aligned in their own column.
3. **One layer of glass.** Glass is for controls floating over content (tab bar, toolbars, floating buttons, sheets). Content is never frosted.
4. **Everything springs.** Three named springs, nothing else. Nothing pops in or blinks.
5. **The venue owns the room.** Logo, accent, display face and roles are the venue's. Structure, body type and spec type are fixed so every venue stays legible.

## Colour

| Token | Service (dark, default) | Prep (light) |
|---|---|---|
| ground | `#0E0D0C` | `#F6F3EE` |
| surface | `#1A1816` | `#FFFFFF` |
| ink (text) | `#F3EEE6` | `#1A1714` |
| muted | `#A59C90` | `#6B645B` |
| line | ink at 8 to 12% | ink at 8% |

- **Accent** = the venue's `primary_color`, run through the guard rails in `lib/theme.ts` (canvas GWBCX "themes", decided 31 Oct): the button is held 2:1 off the page with a cream or ink label at 4.5:1, text in the colour gets its own shade at 4.5:1 per mode, neon is capped at chroma 0.2, a grey gives ink buttons. Increase Contrast overrides the bar (ink buttons). The accent goes on the one primary action per screen, the active tab, and selection. Nowhere else. A bar with no logo wears the ring mark (`RingMark`): its initials in its face on its colour, inside a painted ring.
- **Drink field** = two or three colours extracted from a drink's photo at upload, used as a radial field behind the hero and the study card. Text never sits directly on it without a scrim.
- **Status**: keep `STATUS` (danger, success, warning, info) and `warningText` for amber text. Status colour is separate from the accent and never the only signal.

## Type

| Style | Size | Face |
|---|---|---|
| Display (drink name on its page) | 56 | Instrument Serif, or the venue's face |
| Head (a main tab's name: Tonight, Drinks, Discover, You) | 40 | Display face |
| Title (screen titles) | 34 | Display face |
| Headline | 20 | System 600 |
| Body | 17 | System 400 |
| Spec (measurements) | 17 | System 500, tabular numbers |
| Label (chips, scope and tab labels, doses, compact `sm` buttons) | 15 | System 500 |
| Caption | 13 | System 500 |

- Faces (Kevin, 3 Nov 2026: "the board's fonts"): Instrument Serif (or the venue's face) for names and titles, Geist for body text, Geist Mono for eyebrows and labels set in capitals (`DsText` picks it for any non-name text with `textTransform: 'uppercase'`). This replaced the 31 Oct pick of Redaction and the system font. All three are SIL OFL, from `@expo-google-fonts`, loaded at runtime by `expo-font` (`components/ds/fonts.ts`; the web loads WOFF2 copies and Geist's semibold and the italic after first data). Redaction stays embedded in the native build (`app.json`) but nothing loads it. Sizes, weights and spacing are the canvas's.
- Dates put the day before the month in every locale ("Tuesday 3 November", "since 1 Oct"): new code uses `dayMonth` (`lib/dayMonth.ts`), not `toLocaleDateString`'s own order. Tonight, Drinks and the menu lines use it; older screens still to move are listed in the PR that added it.

- Nothing below 13 pt. Uppercase labels get letter spacing and still stay at 13 or more.
- Where the canvas draws 15 px (a chip, a scope or tab label, a dose, a compact button), use `variant="label"` (15/20), not 13 or 17. A dose keeps its mono face on top of it.
- Venue faces for names (Settings › Theme, one per style): Instrument Serif (the app's own, the column's default `instrument_serif`), Newsreader (Book), IM Fell English (Worn), Imbue (Deco), Besley (Tavern), Bricolage Grotesque (Modern), Belleza (Poster) and Big Shoulders (Sign), all SIL OFL. All but Instrument Serif load only when a venue on screen uses one (`components/ds/faces.ts`); until then they draw in Instrument Serif. Names take a face through `nameStyle` (its scale, spacing and capitals, and a line tall enough for its letters on iOS). A new face needs a `venue_display_face` value, its measured ascender and descent in `displayFaces` (`constants/tokens.ts`, checked by `components/ds/displayClip.check.ts`), and a WOFF2 for the web with its OFL text. Body and spec faces are fixed.
- Respect Dynamic Type: sizes scale, layouts wrap rather than clip.

## Shape and space

- **Radius:** 4 (marks drawn inside a card, like zones on the back bar plan), 12 (controls), 22 (cards), 36 (sheets), full (pills), all with continuous corners (`borderCurve: 'continuous'`).
- **Space:** 4-point grid: 4, 8, 12, 16, 24, 32, 48. Screen side gutter 16 on phones, 24 on tablet, 32 on desktop.
- **Tap targets:** at least 44 by 44.

## Motion and haptics

| Spring | Damping | Stiffness | Use |
|---|---|---|---|
| snap | 26 | 380 | Taps, toggles, chips |
| glide | 30 | 180 | Sheets, zoom transitions |
| pour | 12 | 120 | Liquid, the spec glass, playful moments |

- Tiles zoom into their pages (Expo Router zoom transitions) instead of modals sliding up.
- Haptics: `selectionAsync` on each detent when scrubbing (batch size, cards). `notificationAsync` on save, publish and a correct answer.
- With Reduce Motion on, springs become fades and nothing moves on its own.

## Icons

One set, the bar kit (whole-app canvas, Shell page, nav-icons), drawn the same on iOS, Android and web. The drawings live in `components/ui/glyphs.ts`; `IconSymbol` draws them and nothing else draws an icon.

- **Style:** a 24-point box, a 1.7 stroke, round caps and joins. Off is the muted ink; on is the accent with the accent at 22% inside the main shape (`<IconSymbol on />`). Names ending `.fill` are always on. A loved heart and a dot are solid.
- **Places:** the shell's places use `place.*` (Tonight, Library (the Drinks tab for now), Menus, Prep, Study, Discover, History, This week, Back bar, My Bar, Collection, You, My team, Theme, Roles and access, Settings), wherever the place is meant, not only in the nav. One icon per place: Menus is always the menu card, Settings always the sliders.
- **Names:** SF Symbol names, so a call site reads the same everywhere. A new icon is drawn into `glyphs.ts` in this style (check it in the gallery's Icons section beside the rest), never pulled from an icon font.
- **Sizes:** 24 for tabs and standalone buttons, 20 in rows and the rail, 18 inside text-sized controls. The control around it keeps its 44 (iOS) or 48 (Android) tap target.
- **The system's bars:** the iOS and Android tab bars stay the system's (Liquid Glass on iOS 26+, Material 3 on Android) and take our drawings as template images the system tints: the same outline selected or not (and so do the web's tab bar, rail and sidebar, Kept-glyph), and Android's selected Drinks with its bowl filled (`components/nav/tabImages.ts`, drawn by `npx tsx scripts/nav-tab-icons.ts`). Run that script after changing a tab's glyph. iOS draws its own magnifying glass on the search tab. Android has four tabs and searches from the bar on top of a tab's page; its Material colours come from `components/nav/material.ts`. A pushed page's header is the system's (`components/nav/NativeHeader.tsx`).
- **Android back** is an arrow, iOS and web a chevron (`IconSymbol` swaps `chevron.left`).
- **Accessibility:** icons are decorative (`aria-hidden`); the control that holds one carries the label.

## Glass

- iOS 26+: Expo Router `NativeTabs` for the tab bar, `GlassView` (expo-glass-effect) for floating controls, `BlurView` fallback where glass isn't available.
- Android: solid raised surfaces (expo-blur can't blur the tab bar cleanly there).
- Web: `backdrop-filter` blur with a solid fallback.
- Glass controls sitting on a photo use `onMedia` (dark glass, light ink) in both themes; otherwise dark ink on a dark photo disappears.
- A drink's photo decides its page (`images.brightness`, read at upload): bright makes a light page, everything else dark, whatever the phone's mode. The title sits in the photo's quiet room (`images.text_zone`) when at least 150 points of it are clear of the bar and the fade and the muted ink reads at 4.5:1 there (`lib/photoTitle.ts`); otherwise it goes under the photo. Never across the drink. There is no scrim: a mid-tone photo sends the title under it.

## Images

- Every drink has a hero plus four service angles: side, top, garnish, hand-off.
- Missing images are drawn automatically in the house pencil-sketch style. They carry no "Sketch" tag (decided 10 Oct 2026: a drawing is obviously a drawing, and on phones the tag read as an edit button). Real photos replace sketches; sketches never replace photos. When a spec changes, photos are flagged "may be out of date" rather than swapped. A drawn sketch uses the drink's own glass: martini, coupe, Nick and Nora, rocks and highball each have a few drawings (`lib/sketch/geometry.ts` GLASS_VARIANTS, side by side in the gallery). A drink takes its bar's glassware (`bar_glassware`) unless its editor picks one.
- No drink ever falls back to another drink's photo.
- Photos are lifted from their background and set on a field of the drink's own colour, so different phones look like one shoot.

## Layout

| Width | Navigation | Layout |
|---|---|---|
| Under 768 | Labelled glass tabs, search at the bottom | One column, sheets for detail |
| 768 to 1199 | Icon rail | Two panes. Service mode can fill the screen on a station iPad. |
| 1200 and up | Branded sidebar with ⌘K search | Content, plus a side pane only where it adds something the page lacks. The drink page has none: its shot list is on the Service tab and View as is in More. The list beside the page: venue Drinks keeps its list on the left and opens the picked drink beside it at /cocktail/<id> (`hooks/useDrinksSplit.ts`); Tonight, Discover, You and home Drinks stay as drawn. "+ Add" sits top right where a phone has its +. |

**Sheets are for phones.** On the web, at any width, a sheet is a dialog in the middle of the window, never a panel docked to the bottom. Every sheet is the one `Sheet` (`components/ds/Sheet.tsx`), or `MenuSheet` for a titled one: a plain dark backdrop fades in on its own (about 200 ms, easing out) and never moves with the sheet, which springs up on the glide spring with a grabber and a 36 radius top; drag it down from anywhere to close it (a long pull or a flick; the backdrop lightens as it goes, a pull up rubber-bands, and the keyboard drops); Reduce Motion fades it instead. Put a sheet's scrolling body in `SheetScrollView` (a FlatList: `renderScrollComponent`), so the scroll hands over to the drag at its top. Try both in the gallery's Sheets section. Its X and Cancel buttons close it with `useSheetClose()`, so it slides away first. A sheet holding unsaved changes passes `dirty`: every way out but its own Done (a swipe or drag, the backdrop, back, Escape, X or Cancel) asks "Discard changes?" first. `phoneFull` makes it fill the window on the web at phone width, as the phone's own sheet does (the theme's Type and Colour). Don't hand-build a sheet on a `Modal` (`npm run test:unit` fails on one).

**Small sheet or whole flow** (decision sheets: mixed). Pickers, menus and short forms are our `Sheet` (the default, `kind="small"`). A whole flow (Add, Rank it, Theme) passes `kind="flow"` to `Sheet` or `MenuSheet`: on phones it is the system's own sheet (SwiftUI's sheet on iOS through `@expo/ui`, with its glass, grabber, swipe to close and detents; Android's full-screen dialog with its back), on the web the same centred dialog, a little wider. On iOS `part` (a share of the screen, 0.3 to 0.9) rests it part-way, the floating inset sheet, as the first step of Add and Rank it is drawn; drop `part` for the next step and it grows to full height. Its head is `FlowHead`: Close (an X in glass, Android's back arrow), the title or step in the middle, the accent tick once there's something to finish. `useSheetClose()` closes either kind. Nothing else picks a sheet.

**Empty, loading, error and offline** are drawn in pencil (decision state-design): `PencilState` (`components/ds/PencilState.tsx`) with `kind`, one `title`, an optional `detail` and one `action`; `compact` inside a list or card. Loading breathes, offline says "Saved on this phone". Each screen's PR includes its empty, loading and offline states.

**Drawings at their sizes** (decision drawing-sizes): `DrinkDrawing` (`components/ds/DrinkDrawing.tsx`, or `DrinkDrawingFor` by item id) at `size="hero"` (280 for guests, 180 with `staff`), `"tile"` (160), `"row"` (56), and on a menu page `"menuRow"` (64), from one lib/sketch scene. The fourth size, `"middle"` (206), is the larger middle of three drawn together: `DrawingTrio` (`components/ds/DrawingTrio.tsx`, places in `trioPlaces.ts`) draws a menu's hero (160, 206, 160), a menu card's band and staff Tonight's hero (the same trio at 0.82). No card behind a drawing (decision chrome): a drawing sits on the page, its sky, or a tile of its own colour where the board draws one; only a photo has a frame. In the bar's own glassware: the database draws a bar's own drinks in its glasses, and `DrawingBar` (`components/ds/DrawingBar.tsx`) draws a drink from elsewhere (a classic on the menu) in the bar's default glass of its type (`lib/sketch/barGlass.ts`); unset, it's the venue being worked at. Dark mode paints the scene for night (`lib/sketch/passes.ts`: chalk pencil, the drink lit with its fill line, a glow behind), in `SketchDrawing` too. The colour pours in from the bottom of the glass as it appears; Reduce Motion shows it filled.

**The spec block** (decisions spec-toggle, makes-units): `SpecCard` (`components/screens/drink/spec`) shows what `useSpecAccess` allows. With amounts: the Ingredients | Steps switch (remembered per person, `store/useSpecViewStore.ts`; makers start in Steps), Makes 1, 2, 3 or A batch (never saved; A batch opens the Batch sheet), scaled amounts on jigger marks (`lib/specView.ts`), and the glass, ice and garnish line. Names only for the floor and guests, with no hint at what is held back.

**Toasts** confirm a change and can carry one action, like Undo: `useToast().show({ title, detail, action })` (`components/ds/Toast.tsx`, mounted once at the root). A glass pill floats above the bottom edge (bottom centre on the web, `lift` clears a screen's own bottom bar), is announced as a status, and goes after five seconds, a swipe or a tap; Reduce Motion fades it. A plain "Saved" with no action can stay on `toastDone` (`lib/toast.ts`).

Four tabs: Tonight, Drinks, Discover and You (`lib/tabs.ts`, tabs A, 31 Oct 2026). A venue whose Admin hasn't switched Tonight on in Features has the other three, and opens on Drinks (`lib/venueFeatures.ts`, 3 Nov 2026); the role never changes the tabs. The mode changes what a tab shows (venue Tonight is the night, home Tonight is My Bar until its lane; venue Drinks is the bar's drinks, house-made and bottles, home Drinks is your drinks, shelf and menus). Each tab holds its own stack: pages in `app/(tabs)/(1-tonight,2-drinks,3-discover,4-you)/` (a drink, Prep, Study) push on the tab they're opened from, and each tab's first page lives in its own group so its path always switches tabs. Search sits beside the tabs (the circle on iOS and phone-width web, a search bar on top on Android, ⌘K on wide web). Each page's header has the place button top left (switches between your bars and home) and the + (Add) top right; Android's Add is a plain FAB instead. Old paths (/library, /collection, /bar, /profile, /menus, /new) redirect; /bar opens Drinks' Shelf.

## Permissions in the UI

Locked sections stay visible, collapsed, and say which role opens them ("Opens at Maker"). Never silently hide something a person could be allowed to see.

## Accessibility

- Contrast: 4.5:1 for text in both themes, including on venue accents and drink fields.
- Every control has an accessible name and role; state (selected, expanded) is announced.
- Never rely on colour alone, especially in study and quiz feedback.
- Honour Reduce Motion, Reduce Transparency and Increase Contrast.

## Copy

Write from the person's side of the screen: "Where it lives", not "Location metadata". Buttons say what happens ("Add to prep list"). Errors say what went wrong and how to fix it. Specific beats clever.

## Building a redesigned screen

- Wrap it in `BackbarTheme` (the Back Bar colours for a scheme). Tab screens already sit inside `VenueBrandProvider`. A drink page passes that venue's `BrandProvider`.
- Build from `components/ds`: `Display`/`Title`/`Headline`/`Body`/`Spec`/`Caption`, `Button`, `GlassButton`/`GlassSurface`, `Tag`, `Segmented`, `DrinkImage`, `LockedSection`, `Surface`, `PressableScale`, and `useDs()` for colours. Use `useBreakpoint()`/`useGutter()` for layout. Pieces fewer than 20 routes use come from their own file, not the `components/ds` index, which the web loads on every page: `SpecRow`, `PopoverMenu`, `TimeField`, `ReviewRow`, `FlowHead`, `GlassVariantPicker` and `SketchTintPicker` (`import { SpecRow } from '@/components/ds/SpecRow'`).
- A page starts with `PageHeader` inside a `usePageColumn()` column (`components/nav/Page.tsx`): title, a subtitle only when it says something new (never the venue's name, the sidebar has it), the main action on the right. On wide web the column sits left, next to the sidebar: 760 for lists and forms, 1240 for plans, full width for grids. Never centre a page.
- Accessibility props: use `role` and `aria-*` (`aria-selected`, `aria-disabled`). The legacy `accessibilityRole`/`accessibilityState` props don't reach the DOM on web.
- A venue accent is only ever used through `useDs().accentText` (text) and `useDs().accentFill` (button fills); both come from `lib/theme.ts`.

## Bring in: reviewing what was read

Anything read from a photo or a paste (a menu, a spec, a shelf of bottles) is checked line by line with `ReviewRow`, matched through `lib/match.ts`. Each line is in one of four states, the same everywhere: **have** (already yours, ticked), **new** (will be made, in the accent), **pick** (two or more fit; the choices sit inline and hold the save button), **skip** (left out). The words in the detail line carry the state; the mark only echoes it. Design: https://claude.ai/artifact/9HUsf2Ydyfm4MPe8nCe6of

## The gallery

`/dev/gallery` renders every token and shared component in both themes (side by side on desktop), for no venue, Little Rye and Pale Moth, plus a light/dark toggle. The redesign flag is gone. The gallery and `/dev/drink` open in development builds only (`__DEV__`): release builds and the web drop them from the bundle. Add new ds components to it in the same PR; agents verify against it and against the brief.
