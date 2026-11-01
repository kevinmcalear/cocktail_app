import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DrinkImage, DsText, GlassButton, GlassSurface, useDs } from '@/components/ds';
import { VenueMark } from '@/components/nav/VenueMarks';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { backbar, displayName, familyHues, font, layout, nameStyle, radius, space, type } from '@/constants/tokens';
import { BRAND_SAMPLE, sampleSketch } from '@/lib/brandSample';
import { withAlpha } from '@/lib/color';

import type { BrandLook } from '../BrandPreview';
import { DrinkHero } from '../../drink/DrinkHero';
import type { MiniKind } from './ThemeMinis';
import { StaffPage } from './ThemeStaffPage';

const PHOTO = require('@/assets/images/cocktails/bolo_tie.jpg') as number;
const DRINK = {
  ...BRAND_SAMPLE[1],
  tastes: 'Rye and bitter orange, stirred long and cold, with a dry finish.',
  parts: ['Rye', 'Amaro', 'Orange bitters', 'Orange peel'],
  served: 'On the rocks · orange peel',
};
const DAIQUIRI = { name: 'Daiquiri', line: 'White rum · lime · sugar', price: '15', isNew: false, sketch: sampleSketch('coupe', 'none', familyHues.light.sour, 'lime_wheel') };
const SECTIONS = [
  { title: 'Stirred', drinks: [BRAND_SAMPLE[0], BRAND_SAMPLE[1]] },
  { title: 'Shaken', drinks: [BRAND_SAMPLE[2], DAIQUIRI] },
];
const BAR_ROWS = [
  { label: 'Top ranked here', value: DRINK.name },
  { label: 'Tonight', value: 'Until 2' },
  { label: 'Who makes the drinks', value: '4 bartenders' },
];
/** The drink page's hero on a phone (DrinkHero: about 30% of the screen). */
const HERO = 300;
const PHOTO_HERO = 420;

export type PageKind = MiniKind | 'staff';

/**
 * One of the bar's pages at full size, in the draft theme (canvas Theme-page,
 * boards Theme-rye-*): a drawn drink, a photo drink, its menu, its bar page,
 * or the staff phone. Drawn with the app's own parts where they stand alone
 * (the drink's hero, its drawing, the bar's mark), from the same sample
 * drinks as the small previews. Back closes the preview; nothing else acts.
 */
export function ThemePage({ kind, look, top, onBack }: { kind: PageKind; look: BrandLook; top: number; onBack: () => void }) {
  const ds = useDs();
  if (kind === 'staff') return <StaffPage look={look} top={top} />;
  // A photo page's controls are dark glass with light ink, whatever the mode.
  const onPhoto = kind === 'photo';
  return (
    <View>
      {kind === 'drawn' ? <DrinkHero name={DRINK.name} pictures={[]} glass={null} sketch={DRINK.sketch} height={HERO + top} fade /> : null}
      {kind === 'photo' ? <PhotoHero top={top} /> : null}
      {kind === 'bar' ? <BarSky look={look} height={top + 260} /> : null}
      <View style={[styles.chrome, { top: top + space.sm }]}>
        <GlassButton accessibilityLabel="Back to Theme" icon="chevron.left" onPress={onBack} onMedia={onPhoto} />
        {/* Share, as the page draws it: a picture here, not a control. */}
        <View aria-hidden>
          <GlassSurface scheme={onPhoto ? 'dark' : undefined} style={styles.round}>
            <IconSymbol name="square.and.arrow.up" size={18} color={onPhoto ? backbar.dark.ink : ds.c.ink} />
          </GlassSurface>
        </View>
      </View>
      {kind === 'menu' ? <MenuBody look={look} top={top} /> : kind === 'bar' ? <BarBody look={look} top={top} /> : <DrinkBody look={look} />}
    </View>
  );
}

function PhotoHero({ top }: { top: number }) {
  const ds = useDs();
  return (
    <View style={{ height: PHOTO_HERO + top }}>
      <Image source={PHOTO} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
      <LinearGradient colors={[withAlpha(ds.c.ground, 0), ds.c.ground]} locations={[0.6, 1]} style={StyleSheet.absoluteFill} />
    </View>
  );
}

/** Its logo in the eyebrow, its name and credit in its face, Rank it in its colour (Theme-rye-drawing). */
function DrinkBody({ look }: { look: BrandLook }) {
  const ds = useDs();
  return (
    <View style={[styles.body, styles.drinkBody]}>
      <View style={styles.eyebrowRow}>
        <VenueMark venue={{ ...look, roleLevel: 40 }} size={18} />
        <Caption tone="muted" style={styles.eyebrow}>{`${look.name} · On the menu`}</Caption>
      </View>
      <DsText variant="display" numberOfLines={2}>{DRINK.name}</DsText>
      <DsText variant="headline" tone="muted" style={nameStyle(ds.displayFace, type.headline, true)}>{`${look.name} house spec`}</DsText>
      <Body style={styles.tastes}>{DRINK.tastes}</Body>
      <View style={[styles.rule, { borderColor: ds.c.line }]}>
        {DRINK.parts.map((p, i) => (
          <View key={p} style={[styles.part, { borderColor: ds.c.line }]}>
            <Body style={styles.flex}>{p}</Body>
            {i === DRINK.parts.length - 1 ? <Body tone="muted">Garnish</Body> : null}
          </View>
        ))}
      </View>
      <Body tone="muted">{DRINK.served}</Body>
      <Pill label="Rank it" />
    </View>
  );
}

/** Names in the face, sections in the colour, on the bar's paper (Theme-rye-menu). */
function MenuBody({ look, top }: { look: BrandLook; top: number }) {
  const ds = useDs();
  return (
    <View style={[styles.body, { paddingTop: top + layout.minTapTarget + space.xl }]}>
      <View style={styles.eyebrowRow}>
        <VenueMark venue={{ ...look, roleLevel: 40 }} size={40} />
        <View>
          <Body style={styles.strong}>{look.name}</Body>
          <Caption tone="muted">Menu · from 6 pm</Caption>
        </View>
      </View>
      <DsText variant="display" numberOfLines={1}>Autumn</DsText>
      <DsText variant="headline" tone="muted" style={nameStyle(ds.displayFace, type.headline, true)}>Four drinks for the cold coming in</DsText>
      {SECTIONS.map((s) => (
        <View key={s.title} style={styles.section}>
          <Caption color={ds.accentText} style={[styles.strong, styles.sectionHead, { borderColor: ds.c.line }]}>{s.title}</Caption>
          {s.drinks.map((d) => (
            <View key={d.name} style={[styles.menuRow, { borderColor: ds.c.line }]}>
              <View style={[styles.thumb, { backgroundColor: ds.c.paper }]}>
                <DrinkImage thumb sketchDetail="thumb" sketch={d.sketch} itemId={d.name} accessibilityLabel={d.name} radius="control" />
              </View>
              <View style={styles.flex}>
                <DsText variant="headline" style={nameStyle(ds.displayFace, displayName.card)}>{d.name}</DsText>
                <Caption tone="muted">{d.line}</Caption>
              </View>
              <DsText variant="spec">{d.price}</DsText>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** The bar's own sky: the drink sky's recipe in its colour, a step stronger, with no drawing in it (Theme-rye-bar). */
function BarSky({ look, height }: { look: BrandLook; height: number }) {
  const ds = useDs();
  const accent = look.accent ?? ds.accentText;
  return <LinearGradient colors={[withAlpha(accent, ds.scheme === 'dark' ? 0.32 : 0.26), withAlpha(accent, 0)]} style={[StyleSheet.absoluteFill, { height }]} />;
}

function BarBody({ look, top }: { look: BrandLook; top: number }) {
  const ds = useDs();
  return (
    <View style={[styles.body, { paddingTop: top + layout.minTapTarget + space.xl }]}>
      <View style={styles.logo}>
        <VenueMark venue={{ ...look, roleLevel: 40 }} size={84} />
      </View>
      <Caption tone="muted" style={styles.eyebrow}>Cocktail bar · open till 2</Caption>
      <DsText variant="display" numberOfLines={2}>{look.name}</DsText>
      <Body>Rye, sours and a short seasonal list in a narrow room.</Body>
      <Pill label="See the menu" />
      <Body style={styles.strong}>On the menu now</Body>
      <View style={styles.tiles}>
        {BRAND_SAMPLE.map((d) => (
          <View key={d.name} style={styles.tile}>
            <View style={[styles.tileArt, { backgroundColor: ds.c.paper }]}>
              <DrinkImage thumb sketchDetail="thumb" sketch={d.sketch} itemId={d.name} accessibilityLabel={d.name} radius="card" />
            </View>
            <DsText variant="body" numberOfLines={1} style={nameStyle(ds.displayFace, type.body)}>{d.name}</DsText>
          </View>
        ))}
      </View>
      <View style={[styles.rule, { borderColor: ds.c.line }]}>
        {BAR_ROWS.map((r) => (
          <View key={r.label} style={[styles.part, { borderColor: ds.c.line }]}>
            <Body style={styles.flex}>{r.label}</Body>
            <Body tone="muted">{r.value}</Body>
            <IconSymbol name="chevron.right" size={14} color={ds.c.muted} />
          </View>
        ))}
      </View>
    </View>
  );
}

/** The page's one main button, in the bar's colour; a picture of it here, not a control. */
export function Pill({ label }: { label: string }) {
  const ds = useDs();
  return (
    <View style={[styles.pill, { backgroundColor: ds.accentFill.fill }]}>
      <DsText variant="body" color={ds.accentFill.text} style={styles.strong}>{label}</DsText>
    </View>
  );
}

const styles = StyleSheet.create({
  chrome: { position: 'absolute', left: space.lg, right: space.lg, flexDirection: 'row', justifyContent: 'space-between' },
  round: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  body: { gap: space.md, paddingHorizontal: space.xl, paddingBottom: space.xxxl },
  drinkBody: { marginTop: -space.xxl },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  eyebrow: { ...font.figures, letterSpacing: 1.2, textTransform: 'uppercase' },
  tastes: { marginTop: space.sm },
  rule: { borderTopWidth: StyleSheet.hairlineWidth },
  part: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.minTapTarget + 2, borderBottomWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1, minWidth: 0 },
  strong: { ...font.semiBold },
  section: { marginTop: space.lg },
  sectionHead: { paddingBottom: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  thumb: { width: 64, height: 64, borderRadius: radius.control, overflow: 'hidden' },
  logo: { alignSelf: 'flex-start', borderRadius: radius.card, overflow: 'hidden' },
  pill: { height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, marginVertical: space.sm },
  tiles: { flexDirection: 'row', gap: space.md },
  tile: { flex: 1, gap: space.xs, minWidth: 0 },
  tileArt: { aspectRatio: 1, borderRadius: radius.card, overflow: 'hidden' },
});
