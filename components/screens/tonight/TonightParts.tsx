import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, Display, DrinkDrawingFor, DsText, PressableScale, TextLink, useDs, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, font, palateHues, radius, space } from '@/constants/tokens';
import { useItemSketch } from '@/hooks/useItemSketch';
import { withAlpha } from '@/lib/color';
import { liquidOf } from '@/lib/sketch/types';

/** How far down the sky reaches before it is the page's ground. */
const SKY = 440;

/** The page's date line in small capitals, and Tonight in the display face (Prod-today boards); Discover's head too. */
export function TonightHead({ eyebrow, title = 'Tonight', onEyebrow, eyebrowLabel }: { eyebrow: string; title?: string; onEyebrow?: () => void; eyebrowLabel?: string }) {
  const line = (
    <Caption tone="muted" style={styles.caps}>
      {eyebrow || ' '}
    </Caption>
  );
  return (
    <View style={styles.head}>
      {onEyebrow ? (
        <PressableScale role="button" accessibilityLabel={eyebrowLabel} onPress={onEyebrow}>
          {line}
        </PressableScale>
      ) : (
        line
      )}
      <Display aria-level={1}>{title}</Display>
    </View>
  );
}

/**
 * A section's label in sentence case, with an aside on the right ("14 you can
 * make", "All"). The page's date line is its one capitals label (decided:
 * one label per screen).
 */
export function TonightLabel({ title, aside, onAside }: { title: string; aside?: string | null; onAside?: () => void }) {
  return (
    <View style={styles.label}>
      <DsText variant="label" role="heading" aria-level={2} style={font.semiBold}>
        {title}
      </DsText>
      {aside ? onAside ? <TextLink label={aside} onPress={onAside} /> : <Caption tone="muted">{aside}</Caption> : null}
    </View>
  );
}

/** One drink's paint colour, for its tile and the sky. */
function useDrinkTint(itemId: string): string | null {
  const inputs = useItemSketch(itemId).data;
  return inputs ? liquidOf(inputs).hex : null;
}

/**
 * The sky over the top of the page: the hero drinks' colours left to right,
 * fading into the ground. Behind everything; it scrolls with the page.
 */
export function TonightSky({ ids }: { ids: readonly string[] }) {
  const ds = useDs();
  const a = useDrinkTint(ids[0] ?? '');
  const b = useDrinkTint(ids[1] ?? '');
  const c = useDrinkTint(ids[2] ?? '');
  const tints = [a, b, c].filter((t): t is string => !!t);
  if (!tints.length) return null;
  const strength = ds.scheme === 'dark' ? 0.22 : 0.16;
  const colors = (tints.length === 1 ? [tints[0], tints[0]] : tints).map((t) => withAlpha(t, strength)) as [string, string, ...string[]];
  return (
    <View pointerEvents="none" style={styles.sky}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={[withAlpha(ds.c.ground, 0), ds.c.ground]} style={StyleSheet.absoluteFill} />
    </View>
  );
}

/** Three drinks from the list on now, the middle one larger (staff Tonight's hero). */
export function HeroTrio({ ids, label, onPress }: { ids: readonly string[]; label: string; onPress: () => void }) {
  const [left, middle, right] = ids;
  return (
    <PressableScale role="link" accessibilityLabel={label} onPress={onPress} style={styles.trio}>
      {/* All three on the sky (hero size, no paper), the outer two smaller and tucked in. */}
      {left ? (
        <View style={styles.side}>
          <DrinkDrawingFor itemId={left} size="hero" staff />
        </View>
      ) : null}
      {middle ? <DrinkDrawingFor itemId={middle} size="hero" staff /> : null}
      {right ? (
        <View style={styles.side}>
          <DrinkDrawingFor itemId={right} size="hero" staff />
        </View>
      ) : null}
    </PressableScale>
  );
}

/** A list's name under its eyebrow, with a chevron: tap opens the list. */
export function ListHead({ eyebrow, name, onPress }: { eyebrow: string; name: string; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="link" accessibilityLabel={`${name}. ${eyebrow}`} onPress={onPress} style={styles.listHead}>
      <Caption tone="muted" style={styles.caps}>
        {eyebrow}
      </Caption>
      <View style={styles.listName}>
        <DsText variant="title" style={{ fontFamily: displayFaces[ds.displayFace].regular }} numberOfLines={1}>
          {name}
        </DsText>
        <IconSymbol name="chevron.down" size={18} color={ds.c.ink} />
      </View>
    </PressableScale>
  );
}

/**
 * A drink tile: its drawing on its own colour, the name in the display face, Ready or Need limes under it.
 * Without `ready` the line is muted (Discover's New menus: the menu's name and its bar, a little wider and shorter).
 */
export function DrinkTile({ id, name, status, ready, wide, onPress }: { id: string; name: string; status: string; ready?: boolean; wide?: boolean; onPress: () => void }) {
  const ds = useDs();
  const tint = useDrinkTint(id);
  const hues = palateHues[ds.scheme];
  return (
    <PressableScale role="link" accessibilityLabel={`${name}. ${status}`} onPress={onPress} style={[styles.tile, wide ? styles.tileWide : null]}>
      <View style={[styles.tileArt, wide ? styles.tileArtShort : null, { backgroundColor: tint ? withAlpha(tint, ds.scheme === 'dark' ? 0.28 : 0.2) : ds.c.raised }]}>
        <DrinkDrawingFor itemId={id} size="tile" pour={false} />
      </View>
      <DsText variant="headline" numberOfLines={1} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
        {name}
      </DsText>
      <Caption color={ready === undefined ? ds.c.muted : ready ? hues.green : ds.accentText} numberOfLines={1}>
        {status}
      </Caption>
    </PressableScale>
  );
}

/** A plain note on a soft card: an icon, a sentence, and a chevron (One bottle away). */
export function NoteCard({ icon, text, onPress }: { icon: IconName; text: string; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="link" accessibilityLabel={text} onPress={onPress} style={[styles.note, { backgroundColor: ds.c.raised }]}>
      <IconSymbol name={icon} size={20} color={ds.c.ink} />
      <DsText variant="body" style={styles.flex}>
        {text}
      </DsText>
      <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
    </PressableScale>
  );
}

/** A section: its label, then what's in it. */
export function TonightSection({ title, aside, onAside, children }: { title: string; aside?: string | null; onAside?: () => void; children: ReactNode }) {
  return (
    <View role="region" accessibilityLabel={title} style={styles.section}>
      <TonightLabel title={title} aside={aside} onAside={onAside} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.xs, paddingBottom: space.md },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2 },
  label: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  sky: { position: 'absolute', left: 0, right: 0, top: 0, height: SKY },
  // The drawings carry their own air above the glass, so the trio tucks up under the title.
  trio: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', marginTop: -space.xxxl, paddingBottom: space.md },
  side: { width: 96, alignItems: 'center', transform: [{ scale: 0.72 }], transformOrigin: 'bottom' },
  listHead: { gap: space.xs, alignSelf: 'flex-start' },
  listName: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tile: { width: 132, gap: space.xs },
  // New menus' tiles, as Prod-discover draws them: 150 wide, the picture 120 tall.
  tileWide: { width: 150 },
  tileArtShort: { height: 120 },
  tileArt: { height: 148, borderRadius: radius.card, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' },
  note: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous' },
  flex: { flex: 1, minWidth: 0 },
  section: { gap: space.sm },
});
