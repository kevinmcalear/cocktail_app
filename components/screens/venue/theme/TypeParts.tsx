import { useState } from 'react';
import { Platform, StyleSheet, View, type TextStyle } from 'react-native';

import { Caption, DsText, PressableScale, Spec, useDs } from '@/components/ds';
import { VenueMark } from '@/components/nav/VenueMarks';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { faceInfo } from '@/constants/faceInfo';
import { displayFaces, displayName, font, radius, space, type, type DisplayFace } from '@/constants/tokens';
import { tonalFor } from '@/lib/themeRails';

import type { BrandLook } from '../BrandPreview';

export const FACES = Object.keys(displayFaces) as DisplayFace[];
/** The styles in order, each with the kind of bar it's for (canvas Theme-type). One face each (Kevin, 31 Oct). */
export const STYLES = [...new Set(FACES.map((f) => faceInfo[f].style))];
export const MOOD: Record<string, string> = {
  Default: 'The app’s own face. Pick nothing and this is it.',
  Book: 'Neighbourhood bars, wine bars, a good list. Quiet and bookish.',
  Worn: 'Speakeasies, old rooms, the bar that has been there forever.',
  Deco: 'Hotel bars, cocktail lounges, brass and velvet.',
  Tavern: 'Pubs, taverns, dive bars with good drinks.',
  Modern: 'New openings, minimal rooms, no serifs.',
  Poster: 'Aperitivo bars, Italian and French, flared capitals.',
  Sign: 'Beer halls, dive bars, late-night spots. Tall, condensed, a sign over the door.',
};
export const NAMES_NOTE = 'For names only: the bar, its drinks and menus. Amounts, allergens and buttons stay in the app’s type. Every face is free under the SIL Open Font License.';
const MENU = [
  { name: 'Negroni', line: 'Gin, Campari, sweet vermouth', price: '16' },
  { name: 'Penicillin', line: 'Scotch, lemon, honey, ginger', price: '18' },
  { name: 'Martini', line: 'Gin, dry vermouth, a twist', price: '17' },
];

/** How the picker is drawn (canvas Theme-type): the phone's sheet, Android's full-screen dialog, or the web's two-column dialog. */
export type PickerLook = 'phone' | 'android' | 'wide';
/** A face at a size, loaded (useDisplayFaces). */
export type SetFace = (f: DisplayFace, size: { fontSize: number; lineHeight: number }) => TextStyle;

const web = Platform.OS === 'web';
const ARROWS: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/**
 * The web's keys inside a radio group (th-n-type): the arrows move the choice
 * and the focus with it; Tab moves between groups, since only the chosen one
 * takes Tab.
 */
function arrowKeys(i: number, n: number, pick: (j: number) => void) {
  return (e: { key: string; preventDefault: () => void; currentTarget: unknown }) => {
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : e.key in ARROWS ? (i + ARROWS[e.key] + n) % n : null;
    if (j === null) return;
    e.preventDefault();
    pick(j);
    // ponytail: on the web a React Native view is a DOM element; its siblings are the group's other choices.
    ((e.currentTarget as HTMLElement).parentElement?.children[j] as HTMLElement | undefined)?.focus();
  };
}

/** The keyboard's focus ring on the web, in the bar's text colour (th-n-type: "a visible focus ring"). */
function useFocusRing() {
  const ds = useDs();
  const [at, setAt] = useState<string | null>(null);
  return (key: string) => ({
    onFocus: () => setAt(key),
    onBlur: () => setAt((k) => (k === key ? null : k)),
    ring: at === key ? { outlineColor: ds.accentText, outlineStyle: 'solid' as const, outlineWidth: 2, outlineOffset: 2 } : null,
  });
}

/** The bar's name and a few drinks in the face, in its theme, read as one picture. */
export function Card({ look, face, set, wide }: { look: BrandLook; face: DisplayFace; set: SetFace; wide?: boolean }) {
  const ds = useDs();
  return (
    <View role="img" aria-label={`Preview: ${look.name} in ${faceInfo[face].label}`} style={[styles.card, wide && styles.cardWide, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
      <View style={styles.cardHead}>
        <VenueMark venue={{ ...look, displayFace: face, roleLevel: 40 }} size={40} />
        <DsText variant={wide ? 'display' : 'title'} numberOfLines={1} style={[styles.flex, set(face, wide ? type.display : type.title)]}>{look.name}</DsText>
      </View>
      <Caption tone="muted" style={styles.eyebrow}>AUTUMN · STIRRED</Caption>
      {MENU.map((d) => (
        <View key={d.name} style={styles.row}>
          <View style={styles.flex}>
            <DsText variant="headline" numberOfLines={1} style={set(face, wide ? displayName.card : displayName.row)}>{d.name}</DsText>
            <Caption tone="muted" numberOfLines={1}>{d.line}</Caption>
          </View>
          <Spec>{d.price}</Spec>
        </View>
      ))}
    </View>
  );
}

/**
 * Style: one radio per style, each written in its own face. Ink when chosen on
 * the phone and the web (a neutral control); on Android a Material 3 filter
 * chip, 32 tall with a 48 touch target, a check and the bar's tonal tint.
 */
export function StyleChips({ look, face, accent, set, onPick }: { look: PickerLook; face: DisplayFace; accent: string; set: SetFace; onPick: (f: DisplayFace) => void }) {
  const ds = useDs();
  const focus = useFocusRing();
  const android = look === 'android';
  const tonal = tonalFor(accent, ds.scheme === 'dark');
  const style = faceInfo[face].style;
  return (
    <View role="radiogroup" aria-label="Style" style={styles.chips}>
      {STYLES.map((s, i) => {
        const lead = FACES.find((f) => faceInfo[f].style === s)!;
        const on = s === style;
        const ink = android ? (on ? tonal.ink : ds.c.ink) : on ? ds.c.ground : ds.c.ink;
        const f = focus(s);
        return (
          <PressableScale
            key={s}
            role="radio"
            aria-checked={on}
            accessibilityLabel={`${s}, ${faceInfo[lead].label}`}
            onPress={() => onPick(lead)}
            focusable={web ? on : undefined}
            onFocus={f.onFocus}
            onBlur={f.onBlur}
            // @ts-expect-error onKeyDown is web-only (react-native-web)
            onKeyDown={arrowKeys(i, STYLES.length, (j) => onPick(FACES.find((x) => faceInfo[x].style === STYLES[j])!))}
            hitSlop={android ? space.sm : undefined}
            style={[
              android ? styles.m3Chip : styles.chip,
              android
                ? { backgroundColor: on ? tonal.fill : 'transparent', borderColor: on ? tonal.fill : ds.c.lineStrong, borderWidth: 1 }
                : { backgroundColor: on ? ds.c.ink : ds.c.surface, borderColor: on ? ds.c.ink : ds.c.line, borderWidth: StyleSheet.hairlineWidth },
              f.ring,
            ]}
          >
            {android && on ? <IconSymbol name="checkmark" size={18} color={ink} /> : null}
            <DsText variant="body" color={ink} style={set(lead, type.body)}>{s}</DsText>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** Face: the faces in the chosen style as Aa tiles, four to a row, the chosen one ringed in the bar's text colour. */
export function FaceTiles({ look, face, set, onPick }: { look: PickerLook; face: DisplayFace; set: SetFace; onPick: (f: DisplayFace) => void }) {
  const ds = useDs();
  const focus = useFocusRing();
  const inStyle = FACES.filter((f) => faceInfo[f].style === faceInfo[face].style);
  // Empty places keep a lone tile a quarter of the row, as the board's four.
  const spare = (4 - (inStyle.length % 4)) % 4;
  return (
    <View role="radiogroup" aria-label="Face" style={styles.tiles}>
      {inStyle.map((f, i) => {
        const on = f === face;
        const ring = focus(f);
        return (
          <PressableScale
            key={f}
            role="radio"
            aria-checked={on}
            accessibilityLabel={`${faceInfo[f].label}, ${i + 1} of ${inStyle.length}`}
            onPress={() => onPick(f)}
            focusable={web ? on : undefined}
            onFocus={ring.onFocus}
            onBlur={ring.onBlur}
            // @ts-expect-error onKeyDown is web-only (react-native-web)
            onKeyDown={arrowKeys(i, inStyle.length, (j) => onPick(inStyle[j]))}
            style={[
              styles.tile,
              look === 'phone' ? styles.tilePhone : null,
              { backgroundColor: ds.c.surface, borderColor: on ? ds.accentText : ds.c.line, borderWidth: on ? 2 : look === 'android' ? 1 : StyleSheet.hairlineWidth },
              ring.ring,
            ]}
          >
            <DsText variant="body" style={set(f, type.title)}>Aa</DsText>
            <Caption color={on ? ds.accentText : ds.c.muted} numberOfLines={2} align="center" style={on ? styles.strong : styles.medium}>{faceInfo[f].label}</Caption>
          </PressableScale>
        );
      })}
      {Array.from({ length: spare }, (_, i) => (
        <View key={i} style={styles.spare} />
      ))}
    </View>
  );
}

/** Which face is chosen, and where it sits in its style when there are several (the board's "1 of 4"). */
export function faceCount(face: DisplayFace): string {
  const inStyle = FACES.filter((f) => faceInfo[f].style === faceInfo[face].style);
  return inStyle.length > 1 ? `${inStyle.indexOf(face) + 1} of ${inStyle.length}` : '';
}

/** The chosen face and who drew it, with its place in the style (the phone and the web). */
export function FaceHead({ face, wide }: { face: DisplayFace; wide?: boolean }) {
  return (
    <View style={[styles.head, wide && styles.headWide]}>
      <DsText variant="body" style={styles.flex}>
        <DsText variant="body" style={styles.strong}>{faceInfo[face].label}</DsText>
        <DsText variant="body" tone="muted">{` · ${faceInfo[face].by}`}</DsText>
      </DsText>
      <Caption tone="muted">{faceCount(face)}</Caption>
    </View>
  );
}

/** A group's label on Android (Style, Face), in the bar's colour, with what's chosen on the right. */
export function GroupLabel({ label, detail }: { label: string; detail?: string }) {
  const ds = useDs();
  return (
    <View style={[styles.head, styles.label]}>
      <Caption color={ds.accentText} style={[styles.medium, styles.flex]}>{label}</Caption>
      {detail ? <Caption tone="muted">{detail}</Caption> : null}
    </View>
  );
}

const TILE_H = 100;

const styles = StyleSheet.create({
  card: { gap: space.md, paddingHorizontal: space.xl - 2, paddingTop: space.lg + space.xs, paddingBottom: space.xl - 2, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth },
  cardWide: { gap: space.lg, paddingHorizontal: space.xl + 2, paddingTop: space.xl, paddingBottom: space.xl + 2 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  eyebrow: { ...font.semiBold, letterSpacing: 1, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: space.md },
  flex: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.sm },
  headWide: { marginTop: space.xs },
  label: { paddingTop: space.xs },
  strong: { ...font.semiBold },
  medium: { ...font.medium },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { height: 40, paddingHorizontal: space.md + 3, flexDirection: 'row', alignItems: 'center', gap: space.xs + 2, borderRadius: radius.pill },
  m3Chip: { height: 32, paddingHorizontal: space.md + 2, flexDirection: 'row', alignItems: 'center', gap: space.xs + 2, borderRadius: radius.chip },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { flex: 1, height: TILE_H, alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingHorizontal: space.xs, borderRadius: radius.control + space.xs, borderCurve: 'continuous' },
  tilePhone: { borderRadius: radius.control + space.sm - 2 },
  spare: { flex: 1 },
});
