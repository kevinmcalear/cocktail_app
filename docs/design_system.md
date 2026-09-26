# Design system: Back Bar

The written rules behind the Back Bar brief (https://claude.ai/artifact/1ksBAgPLyVmLGKdm48x6sf). When the brief and this file disagree, ask. The tokens are in `constants/tokens.ts`; the components that use them are in `components/ds/` (see the gallery below). Screens that haven't been redesigned yet still use `constants/palette.ts`. `npm run check:design` stops new raw values either way.

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

- **Accent** = the venue's `primary_color`, contrast-checked: if it's under 4.5:1 on the light ground, light mode uses a deeper shade automatically. The accent goes on the one primary action per screen, the active tab, and selection. Nowhere else.
- **Drink field** = two or three colours extracted from a drink's photo at upload, used as a radial field behind the hero and the study card. Text never sits directly on it without a scrim.
- **Status**: keep `STATUS` (danger, success, warning, info) and `warningText` for amber text. Status colour is separate from the accent and never the only signal.

## Type

| Style | Size | Face |
|---|---|---|
| Display (drink name on its page) | 56 | Instrument Serif, or the venue's display face |
| Title (screen titles) | 34 | Display face |
| Headline | 20 | Geist 600 |
| Body | 17 | Geist 400 |
| Spec (measurements) | 17 | Geist Mono 500, tabular numbers |
| Caption | 13 | Geist 500 |

- Nothing below 13 pt. Uppercase labels get letter spacing and still stay at 13 or more.
- Venue display faces: Instrument Serif, Fraunces, or Bricolage Grotesque. Body and spec faces are fixed.
- Respect Dynamic Type: sizes scale, layouts wrap rather than clip.

## Shape and space

- **Radius:** 12 (controls), 22 (cards), 36 (sheets), full (pills), all with continuous corners (`borderCurve: 'continuous'`).
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

## Glass

- iOS 26+: Expo Router `NativeTabs` for the tab bar, `GlassView` (expo-glass-effect) for floating controls, `BlurView` fallback where glass isn't available.
- Android: solid raised surfaces (expo-blur can't blur the tab bar cleanly there).
- Web: `backdrop-filter` blur with a solid fallback.
- Glass controls sitting on a photo use `onMedia` (dark glass, light ink) in both themes; otherwise dark ink on a dark photo disappears.

## Images

- Every drink has a hero plus four service angles: side, top, garnish, hand-off.
- Missing images are drawn automatically in the house pencil-sketch style and carry a visible **Sketch** tag everywhere, including the public app. Real photos replace sketches; sketches never replace photos. When a spec changes, photos are flagged "may be out of date" rather than swapped.
- No drink ever falls back to another drink's photo.
- Photos are lifted from their background and set on a field of the drink's own colour, so different phones look like one shoot.

## Layout

| Width | Navigation | Layout |
|---|---|---|
| Under 768 | Labelled glass tabs, search at the bottom | One column, sheets for detail |
| 768 to 1199 | Icon rail | Two panes. Service mode can fill the screen on a station iPad. |
| 1200 and up | Branded sidebar with ⌘K search | Content plus an inspector (photos, locations, "view as") |

Venue mode tabs: Tonight, Library, Prep, Study. Home mode tabs: Discover, My Bar, Collection, You. The venue chip in the corner switches between venues and modes.

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

- Wrap it in `BackbarTheme` (fonts, the Back Bar colours, and the Tamagui sub-theme) and, once step 2 lands, the active venue's `BrandProvider`.
- Build from `components/ds`: `Display`/`Title`/`Headline`/`Body`/`Spec`/`Caption`, `Button`, `GlassButton`/`GlassSurface`, `Tag`, `Segmented`, `SpecRow`, `DrinkImage`, `LockedSection`, `Surface`, `PressableScale`, and `useDs()` for colours. Use `useBreakpoint()`/`useGutter()` for layout.
- Accessibility props: use `role` and `aria-*` (`aria-selected`, `aria-disabled`). The legacy `accessibilityRole`/`accessibilityState` props don't reach the DOM on web.
- A venue accent is only ever used through `useDs().accentText` (text) and `useDs().accentFill` (button fills); both are contrast-checked by `lib/color.ts`.

## The gallery

`/dev/gallery` renders every token and shared component in both themes (side by side on desktop), for no venue, Little Rye and Pale Moth, plus a switch for the redesign preview. It's public but hidden (not linked anywhere) and opens in every build: its switch is how you turn the redesign on for yourself in production. Add new ds components to it in the same PR; agents verify against it and against the brief.
