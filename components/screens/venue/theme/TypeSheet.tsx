import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BrandProvider, Caption, DsText, PressableScale, Sheet, SheetScrollView, Spec, useDisplayFaces, useDs } from '@/components/ds';
import { VenueMark } from '@/components/nav/VenueMarks';
import { DEFAULT_ACCENT, displayFaces, displayName, font, nameStyle, radius, space, type, type DisplayFace } from '@/constants/tokens';

import type { BrandLook } from '../BrandPreview';
import { FlowHead } from './FlowHead';

const FACES = Object.keys(displayFaces) as DisplayFace[];
/** The styles in order, each with the kind of bar it's for (canvas Theme-type). One face each (Kevin, 31 Oct). */
const STYLES = [...new Set(FACES.map((f) => displayFaces[f].style))];
const MOOD: Record<string, string> = {
  Default: 'The app’s own face. Pick nothing and this is it.',
  Book: 'Neighbourhood bars, wine bars, a good list. Quiet and bookish.',
  Worn: 'Speakeasies, old rooms, the bar that has been there forever.',
  Deco: 'Hotel bars, cocktail lounges, brass and velvet.',
  Tavern: 'Pubs, taverns, dive bars with good drinks.',
  Modern: 'New openings, minimal rooms, no serifs.',
  Poster: 'Aperitivo bars, Italian and French, flared capitals.',
  Sign: 'Beer halls, dive bars, late-night spots. Tall, condensed, a sign over the door.',
};
const MENU = [
  { name: 'Negroni', line: 'Gin, Campari, sweet vermouth', price: '16' },
  { name: 'Penicillin', line: 'Scotch, lemon, honey, ginger', price: '18' },
  { name: 'Martini', line: 'Gin, dry vermouth, a twist', price: '17' },
];

/**
 * Type for names, picker A (canvas Theme-type, Kevin picked A on 30 Oct): the
 * bar's own name and menu on top, changing with every tap; then a style, each
 * chip written in its own face; then the faces in that style as Aa tiles.
 * Done keeps the pick; X leaves the face as it was.
 */
export function TypeSheet({ visible, onClose, look, value, onUse }: { visible: boolean; onClose: () => void; look: BrandLook; value: DisplayFace; onUse: (face: DisplayFace) => void }) {
  const ds = useDs();
  const [face, setFace] = useState(value);
  // Every face shows here, so all of them load while the picker is open.
  const family = useDisplayFaces(visible ? FACES : []);
  const style = displayFaces[face].style;
  const inStyle = FACES.filter((f) => displayFaces[f].style === style);
  const set = (f: DisplayFace, size: { fontSize: number; lineHeight: number }) => ({ ...nameStyle(f, size), fontFamily: family(f) });
  return (
    <Sheet visible={visible} onClose={onClose} onShow={() => setFace(value)} accessibilityLabel="Type" kind="flow">
      <FlowHead title="Type" onDone={() => onUse(face)} />
      <SheetScrollView contentContainerStyle={styles.body}>
        <BrandProvider accent={look.accent ?? DEFAULT_ACCENT} groundTint={look.groundTint} displayFace={face}>
          <Card look={look} face={face} set={set} />
        </BrandProvider>

        <View style={styles.head}>
          <Caption style={styles.strong}>{`${displayFaces[face].label} · ${displayFaces[face].by}`}</Caption>
          <Caption tone="muted">{`${inStyle.indexOf(face) + 1} of ${inStyle.length}`}</Caption>
        </View>

        <View role="radiogroup" aria-label="Style" style={styles.chips}>
          {STYLES.map((s) => {
            const lead = FACES.find((f) => displayFaces[f].style === s)!;
            const on = s === style;
            return (
              <PressableScale
                key={s}
                role="radio"
                aria-checked={on}
                accessibilityLabel={`${s}, ${displayFaces[lead].label}`}
                onPress={() => setFace(lead)}
                style={[styles.chip, { backgroundColor: on ? ds.c.ink : 'transparent', borderColor: on ? ds.c.ink : ds.c.lineStrong }]}
              >
                <DsText variant="body" color={on ? ds.c.ground : ds.c.ink} style={set(lead, type.body)}>{s}</DsText>
              </PressableScale>
            );
          })}
        </View>
        <Caption tone="muted">{MOOD[style]}</Caption>

        <View role="radiogroup" aria-label="Face" style={styles.tiles}>
          {inStyle.map((f, i) => {
            const on = f === face;
            return (
              <PressableScale
                key={f}
                role="radio"
                aria-checked={on}
                accessibilityLabel={`${displayFaces[f].label}, ${i + 1} of ${inStyle.length}`}
                onPress={() => setFace(f)}
                style={[styles.tile, { borderColor: on ? ds.accentText : ds.c.line, borderWidth: on ? 2 : StyleSheet.hairlineWidth, backgroundColor: ds.c.surface }]}
              >
                <DsText variant="body" style={set(f, type.title)}>Aa</DsText>
                <Caption tone={on ? undefined : 'muted'} color={on ? ds.accentText : undefined} numberOfLines={2} align="center">{displayFaces[f].label}</Caption>
              </PressableScale>
            );
          })}
        </View>
        <Caption tone="muted">For names only: the bar, its drinks and menus. Amounts, allergens and buttons stay in the app’s type. Every face is free under the SIL Open Font License.</Caption>
      </SheetScrollView>
    </Sheet>
  );
}

/** The bar's name and a few drinks in the face, in its theme, read as one picture. */
function Card({ look, face, set }: { look: BrandLook; face: DisplayFace; set: (f: DisplayFace, size: { fontSize: number; lineHeight: number }) => object }) {
  const ds = useDs();
  return (
    <View role="img" aria-label={`Preview: ${look.name} in ${displayFaces[face].label}`} style={[styles.card, { backgroundColor: ds.c.ground, borderColor: ds.c.line }]}>
      <View style={styles.cardHead}>
        <VenueMark venue={{ ...look, displayFace: face, roleLevel: 40 }} size={36} />
        <DsText variant="title" numberOfLines={1} style={[styles.flex, set(face, type.title)]}>{look.name}</DsText>
      </View>
      <Caption tone="muted" style={styles.eyebrow}>AUTUMN · STIRRED</Caption>
      {MENU.map((d) => (
        <View key={d.name} style={[styles.row, { borderTopColor: ds.c.line }]}>
          <View style={styles.flex}>
            <DsText variant="headline" numberOfLines={1} style={set(face, displayName.row)}>{d.name}</DsText>
            <Caption tone="muted" numberOfLines={1}>{d.line}</Caption>
          </View>
          <Spec>{d.price}</Spec>
        </View>
      ))}
    </View>
  );
}

const TILE = 76;

const styles = StyleSheet.create({
  body: { gap: space.md, padding: space.lg, paddingBottom: space.xxxl },
  card: { gap: space.sm, padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  eyebrow: { letterSpacing: 0.8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.sm },
  flex: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: space.sm },
  strong: { ...font.semiBold },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { minHeight: 40, paddingHorizontal: space.md, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { width: TILE + space.lg, minHeight: TILE + space.lg, alignItems: 'center', justifyContent: 'center', gap: space.xs, padding: space.sm, borderRadius: radius.control, borderCurve: 'continuous' },
});
