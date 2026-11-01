import { Image } from 'expo-image';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BackbarTheme, BrandProvider, Caption, DrinkImage, DsText, useDs } from '@/components/ds';
import { VenueMark } from '@/components/nav/VenueMarks';
import { DEFAULT_ACCENT, displayFaces, font, radius, space, type BackbarScheme } from '@/constants/tokens';
import { BRAND_SAMPLE } from '@/lib/brandSample';

import type { BrandLook } from '../BrandPreview';

/** Each preview is drawn as a phone draws it, at real sizes, then scaled down to fit. */
const BASE_W = 300;
const BASE_H = 520;
const PHOTO = require('@/assets/images/cocktails/bolo_tie.jpg') as number;

export type MiniKind = 'drawn' | 'photo' | 'menu' | 'bar';
export const MINIS: { kind: MiniKind; label: string }[] = [
  { kind: 'drawn', label: 'Drink, drawn' },
  { kind: 'photo', label: 'Drink, photo' },
  { kind: 'menu', label: 'Menu' },
  { kind: 'bar', label: 'Bar page' },
];

const DRINK = BRAND_SAMPLE[1];
const MENU = [...BRAND_SAMPLE, { name: 'Daiquiri', line: 'White rum · lime · sugar', price: '15' }];

/**
 * One of the bar's pages in the draft theme (canvas Theme-flow-2: a drawn
 * drink, a photo drink, its menu, its bar page). The photo decides its own
 * mode (Decided), so it's always the night page.
 */
export function ThemeMini({ kind, look, scheme, width }: { kind: MiniKind; look: BrandLook; scheme: BackbarScheme; width: number }) {
  const ds = useDs();
  const scale = width / BASE_W;
  return (
    <View role="img" aria-label={`${MINIS.find((m) => m.kind === kind)?.label} at ${look.name}, ${scheme} mode`} style={[styles.frame, { width, height: BASE_H * scale, borderColor: ds.c.lineStrong }]}>
      <View style={[styles.base, { transform: [{ scale }] }]}>
        <BackbarTheme scheme={kind === 'photo' ? 'dark' : scheme}>
          <BrandProvider accent={look.accent ?? DEFAULT_ACCENT} groundTint={look.groundTint} displayFace={look.displayFace}>
            <MiniPage kind={kind} look={look} />
          </BrandProvider>
        </BackbarTheme>
      </View>
    </View>
  );
}

function MiniPage({ kind, look }: { kind: MiniKind; look: BrandLook }) {
  const ds = useDs();
  const name = { fontFamily: displayFaces[ds.displayFace].regular };
  const button = (label: string) => (
    <View style={[styles.button, { backgroundColor: ds.accentFill.fill }]}>
      <DsText variant="body" color={ds.accentFill.text} style={styles.strong}>{label}</DsText>
    </View>
  );
  const rows = (
    <View>
      {['Rye', 'Amaro', 'Orange bitters'].map((r) => (
        <View key={r} style={[styles.row, { borderTopColor: ds.c.line }]}>
          <DsText variant="body">{r}</DsText>
        </View>
      ))}
    </View>
  );
  if (kind === 'drawn' || kind === 'photo') {
    return (
      <View style={[styles.page, { backgroundColor: ds.c.ground }]}>
        {kind === 'photo' ? <Image source={PHOTO} style={styles.photo} contentFit="cover" accessibilityIgnoresInvertColors /> : (
          <View style={styles.drawing}>
            <DrinkImage sketch={DRINK.sketch} itemId={DRINK.name} accessibilityLabel={DRINK.name} sketchDetail="thumb" radius={0} />
          </View>
        )}
        <View style={styles.body}>
          <DsText variant="title" numberOfLines={1} style={name}>{DRINK.name}</DsText>
          {rows}
          {button('Rank it')}
        </View>
      </View>
    );
  }
  if (kind === 'menu') {
    return (
      <View style={[styles.page, styles.body, { backgroundColor: ds.c.ground }]}>
        <Caption tone="muted">{look.name} · Menu</Caption>
        <DsText variant="display" numberOfLines={1} style={name}>Autumn</DsText>
        {MENU.map((d) => (
          <View key={d.name} style={[styles.menuRow, { borderTopColor: ds.c.line }]}>
            <View style={styles.flex}>
              <DsText variant="headline" numberOfLines={1} style={name}>{d.name}</DsText>
              <Caption tone="muted" numberOfLines={1}>{d.line}</Caption>
            </View>
            <DsText variant="spec">{d.price}</DsText>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={[styles.page, styles.body, styles.bar, { backgroundColor: ds.c.ground }]}>
      <VenueMark venue={{ ...look, roleLevel: 40 }} size={64} />
      <Caption tone="muted">Cocktail bar · open till 2</Caption>
      <DsText variant="title" numberOfLines={2} style={name}>{look.name}</DsText>
      {button('See the menu')}
      <DsText variant="body" color={ds.accentText} style={styles.strong}>On the menu now</DsText>
      {rows}
    </View>
  );
}

/** The four previews in a row that scrolls sideways, with their names under them (phones and the narrow column). */
export function ThemeMiniStrip({ look, scheme }: { look: BrandLook; scheme: BackbarScheme }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stripBox} contentContainerStyle={styles.strip}>
      {MINIS.map((m) => (
        <View key={m.kind} style={styles.cell}>
          <ThemeMini kind={m.kind} look={look} scheme={scheme} width={MINI_W} />
          <Caption tone="muted" align="center">{m.label}</Caption>
        </View>
      ))}
    </ScrollView>
  );
}

const MINI_W = 132;

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', borderRadius: radius.control, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth },
  base: { width: BASE_W, height: BASE_H, transformOrigin: 'top left' },
  page: { flex: 1 },
  drawing: { height: 220 },
  photo: { height: 260 },
  body: { gap: space.md, padding: space.lg },
  bar: { paddingTop: space.xxxl },
  row: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: space.sm },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: space.md },
  flex: { flex: 1, minWidth: 0 },
  button: { alignItems: 'center', justifyContent: 'center', height: 50, borderRadius: radius.pill },
  strong: { ...font.semiBold },
  // A sideways list never takes the page's spare height (web gives a ScrollView flex-grow).
  stripBox: { flexGrow: 0 },
  strip: { gap: space.md },
  cell: { gap: space.xs, width: MINI_W },
});
