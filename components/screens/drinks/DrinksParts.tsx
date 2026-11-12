import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, DrinkImage, DsText, Head, IngredientThumb, PencilState, PressableScale, Tag, useDs } from '@/components/ds';
import { SegmentedCapsule } from '@/components/ds/SegmentedCapsule';
import { DrinkDrawing } from '@/components/ds/DrinkDrawing';
import { OutlineRows, RowName, SavedChip } from '@/components/ds/ListGroup';
import { ScreenHeader } from '@/components/nav/ScreenHeader';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, palateHues, radius, space } from '@/constants/tokens';
import { useItemSketch } from '@/hooks/useItemSketch';
import { withAlpha } from '@/lib/color';
import { bareGlassSketch } from '@/lib/sketch/bareGlass';
import { liquidOf } from '@/lib/sketch/types';

/**
 * The Drinks tab's head (Prod-phone drinks, Sta-drinks): the tab's own top
 * row (the place button and Add; Android's search bar), the bar's name (or
 * Home) over Drinks, the capsule, and with no signal "Whole spec book on this
 * phone" under it; no capsule when there's only one (a bar without More drink
 * filters, lib/venueFeatures.ts). `bleed`: the list's side padding, which the top row runs past.
 */
export function DrinksHead<T extends string>({
  eyebrow,
  capsules,
  value,
  onChange,
  offline,
  bleed,
}: {
  eyebrow: string;
  capsules: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  offline?: string | null;
  bleed: number;
}) {
  return (
    <View style={styles.head}>
      <View style={{ marginHorizontal: -bleed }}>
        <ScreenHeader />
      </View>
      <View style={styles.title}>
        <Caption tone="muted" style={styles.caps}>
          {eyebrow}
        </Caption>
        <Head aria-level={1}>Drinks</Head>
      </View>
      {offline ? <SavedChip text={offline} /> : null}
      {capsules.length > 1 ? <SegmentedCapsule options={capsules} value={value} onChange={onChange} accessibilityLabel={capsules.map((c) => c.label).join(', ')} /> : null}
    </View>
  );
}

export interface DrinkListRowProps {
  itemId: string;
  name: string;
  line?: string | null;
  /** "Egg" in amber (warn), "Off tonight" on a soft fill. */
  tag?: { label: string; warn?: boolean } | null;
  /** On the right in place of the chevron: "Ready" (green), "Need limes" (amber), a count ("60" in ink over a small "serves"). */
  end?: { text: string; tone: 'ready' | 'warn' | 'muted' | 'ink'; under?: string } | null;
  /** An ingredient (a bottle, a house-made): its drawing on a card instead of the drink's. */
  ingredient?: boolean;
  /** Lit: the drink open beside the list on a wide screen. */
  picked?: boolean;
  onPress: () => void;
  onPressIn?: () => void;
}

/**
 * One drink in a Drinks list: its drawing (lists use drawings only, decided),
 * its name in the display face, its line ("Dry shake · coupe"), a tag, and a
 * chevron, or what it says on the right (home's Ready, a bottle's count).
 */
export function DrinkListRow({ itemId, name, line, tag, end, ingredient, picked, onPress, onPressIn }: DrinkListRowProps) {
  const ds = useDs();
  const hues = palateHues[ds.scheme];
  const endColor = end?.tone === 'ready' ? hues.green : end?.tone === 'warn' ? ds.accentText : end?.tone === 'ink' ? ds.c.ink : ds.c.muted;
  return (
    <View role="listitem">
      <PressableScale
        role="link"
        accessibilityLabel={`${[name, line, tag?.label, [end?.text, end?.under].filter(Boolean).join(' ')].filter(Boolean).join(', ')}, open`}
        onPressIn={onPressIn}
        onPress={onPress}
        style={[styles.row, picked && { backgroundColor: withAlpha(ds.accentText, 0.12) }]}
      >
        {ingredient ? (
          <View style={[styles.card, { backgroundColor: ds.c.surface }]}>
            <IngredientThumb id={itemId} name={name} size={44} />
          </View>
        ) : (
          <DrinkImage thumb sketchDetail="thumb" itemId={itemId} accessibilityLabel={name} radius="control" style={styles.drawing} />
        )}
        <View style={styles.words}>
          <RowName>{name}</RowName>
          {line ? (
            <Caption tone="muted" numberOfLines={1}>
              {line}
            </Caption>
          ) : null}
        </View>
        {tag ? <Tag label={tag.label} tone={tag.warn ? 'warning' : 'default'} /> : null}
        {end?.under ? (
          <View style={styles.endStack}>
            <DsText variant="body" color={endColor} style={styles.end}>
              {end.text}
            </DsText>
            <Caption tone="muted">{end.under}</Caption>
          </View>
        ) : end ? (
          <DsText variant="body" color={endColor} style={styles.end}>
            {end.text}
          </DsText>
        ) : (
          <IconSymbol name="chevron.right" size={16} color={ds.c.faint} />
        )}
      </PressableScale>
    </View>
  );
}

/** A list of DrinkListRows (a plain stack; long lists use a FlatList of rows instead). */
export function DrinkRows({ children }: { children: ReactNode }) {
  return (
    <View role="list" style={styles.rows}>
      {children}
    </View>
  );
}

/** One drink's paint colour, for the On now card. */
function useTint(itemId: string): string | null {
  const inputs = useItemSketch(itemId).data;
  return inputs ? liquidOf(inputs).hex : null;
}

/** One of the card's drinks: its drawing, or its bare glass until it has one (as DrinkImage does). */
function CardDrink({ id }: { id: string }) {
  const inputs = useItemSketch(id).data;
  return <DrinkDrawing inputs={inputs ?? bareGlassSketch(null)} seed={id} size="hero" staff pour={false} />;
}

/**
 * The menu on now (Prod-phone drinks, staff): "On now · since 1 Oct" with a
 * live dot, its name, "8 drinks · Winter on 1 Dec", and three of its drinks
 * on the right, on its first drink's colour. Tap opens the menu.
 */
export function OnNowCard({ eyebrow, name, sub, ids, onPress }: { eyebrow: string; name: string; sub: string; ids: readonly string[]; onPress: () => void }) {
  const ds = useDs();
  const tint = useTint(ids[0] ?? '');
  const face = { fontFamily: displayFaces[ds.displayFace].regular };
  return (
    <PressableScale role="link" accessibilityLabel={`${name}. ${eyebrow}. ${sub}. Opens the menu.`} onPress={onPress} style={[styles.onNow, { backgroundColor: tint ? withAlpha(tint, ds.scheme === 'dark' ? 0.24 : 0.16) : ds.c.surface }]}>
      <View style={styles.onNowWords}>
        <View style={[styles.live, styles.onNowEyebrow]}>
          <View style={[styles.dot, { backgroundColor: palateHues[ds.scheme].green }]} />
          <Caption tone="muted" style={styles.caps} numberOfLines={2}>
            {eyebrow}
          </Caption>
        </View>
        <DsText variant="title" style={[face, styles.onNowName]} numberOfLines={2}>
          {name}
        </DsText>
        <Caption tone="muted" style={styles.onNowName} numberOfLines={2}>
          {sub}
        </Caption>
      </View>
      <View aria-hidden style={styles.trio}>
        {ids.slice(0, 3).map((id, i) => (
          <View key={id} style={[styles.pic, i === 1 && styles.middle]}>
            <View style={i === 1 ? styles.big : styles.small}>
              <CardDrink id={id} />
            </View>
          </View>
        ))}
      </View>
    </PressableScale>
  );
}

const CAPSULE_EMPTY = {
  drinks: { detail: 'No drinks yet. Snap tonight’s menu and they’re all here.', action: 'Snap the menu' },
  house: { detail: 'Nothing house-made yet. Syrups, cordials and batches go here.', action: 'Add a house-made' },
  bottles: { detail: 'No bottles yet. Snap the back bar or add them one by one.', action: 'Snap the back bar' },
} as const;

/** A capsule with nothing in it yet (Sta-drinks, Sta-capsules): the pencil glass, one line, one action (none without the right to add). */
export function CapsuleEmpty({ capsule, onAction }: { capsule: keyof typeof CAPSULE_EMPTY; onAction?: (() => void) | null }) {
  const words = CAPSULE_EMPTY[capsule];
  return (
    <View style={styles.state}>
      <PencilState kind="empty" title={words.detail} action={onAction ? { label: words.action, onPress: onAction } : undefined} />
    </View>
  );
}

/** Loading (Sta-drinks): six rows in outline. */
export function DrinksLoading() {
  return (
    <View style={styles.state}>
      <OutlineRows count={6} />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.md, paddingBottom: space.sm },
  // The name sits 18 above the capsules, as Prod-drinks draws it (the head's gap and this).
  title: { gap: space.xs, paddingBottom: space.xs + 2 },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2 },
  rows: { gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, borderRadius: radius.control, paddingHorizontal: space.sm, marginHorizontal: -space.sm },
  drawing: { width: 52 },
  card: { width: 52, height: 52, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  words: { flex: 1, minWidth: 0, gap: 2 },
  end: { textAlign: 'right' },
  endStack: { alignItems: 'flex-end', gap: 3 },
  onNow: { flexDirection: 'row', alignItems: 'center', minHeight: 168, borderRadius: radius.card + space.xs, borderCurve: 'continuous', overflow: 'hidden', padding: space.lg + 2 },
  // The eyebrow runs wider than the name so "On now · since 1 Oct" stays on one line, as Prod-drinks draws it; the name and its line keep left of the drawings.
  onNowWords: { flex: 1, minWidth: 0, gap: space.xs, zIndex: 1 },
  onNowEyebrow: { maxWidth: '72%' },
  onNowName: { maxWidth: '55%' },
  live: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs + 2 },
  dot: { width: 8, height: 8, marginTop: 5, borderRadius: radius.pill },
  // Three drawings at the card's right, the middle one larger, tucked together and cut by the card's edge.
  trio: { position: 'absolute', right: space.sm, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'flex-end' },
  pic: { width: 56, height: 160, alignItems: 'center', justifyContent: 'flex-end' },
  middle: { width: 76 },
  big: { transform: [{ scale: 0.76 }], transformOrigin: 'bottom' },
  small: { transform: [{ scale: 0.58 }], transformOrigin: 'bottom' },
  state: { paddingTop: space.md },
});
