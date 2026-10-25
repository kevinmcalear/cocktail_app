import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

import { Body, Caption, Chip, Field, Segmented, Spec, Switch, TextLink, useDs } from '@/components/ds';
import { GlassThumb, FIRST_TYPES, MORE_TYPES } from '@/components/glass/GlassModelPicker';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { aboutMl, inches, mmText, ounces, readSize, type SizeBy } from '@/lib/drawGlass';
import type { TracedGlass } from '@/lib/glassTrace';
import { GLASS_TYPE_LABEL } from '@/lib/glassware';
import type { GlassOutline } from '@/lib/sketch/outline';
import type { SketchGlass } from '@/lib/sketch/types';

import { KitChipGroup } from '../KitAddSheet';

// The steps of Draw my glass (Venue tools board, x 3520 y 20300), drawn;
// useDrawGlass runs them inside "Which glass is it?".

export const PHOTO_TIPS: [string, string][] = [
  ['Plain wall or a sheet of paper behind it', 'The tracer follows the glass’s edge. Bottles behind make it guess.'],
  ['Side on, level with the middle of the glass', 'Not from above: the rim should look like a thin oval.'],
  ['The whole glass in the frame', 'Rim to foot, with a little space around it.'],
  ['Empty and dry, in daylight if you can', 'No garnish, no ice, no hand.'],
];

/** Step 2's tips, numbered. */
export function PhotoTips() {
  const ds = useDs();
  return (
    <View role="list" style={styles.stack}>
      {PHOTO_TIPS.map(([tip, why], i) => (
        <View key={tip} role="listitem" style={styles.tip}>
          <View style={[styles.tipNo, { backgroundColor: ds.c.raised }]}>
            <Caption>{String(i + 1)}</Caption>
          </View>
          <View style={styles.flex}>
            <Body>{tip}</Body>
            <Caption tone="muted">{why}</Caption>
          </View>
        </View>
      ))}
    </View>
  );
}

/** The photo, small, with Retake beside it. */
export function PhotoChip({ uri, onRetake }: { uri: string | null; onRetake?: () => void }) {
  const ds = useDs();
  return (
    <View style={[styles.chip, { backgroundColor: ds.c.surface }]}>
      {uri ? <Image source={{ uri }} style={styles.chipPhoto} contentFit="cover" accessibilityIgnoresInvertColors /> : <IconSymbol name="camera.fill" size={20} color={ds.c.muted} />}
      <Body style={styles.flex}>Your photo</Body>
      {onRetake ? <TextLink label="Retake" onPress={onRetake} /> : null}
    </View>
  );
}

export interface SizeValue {
  glass: SketchGlass;
  name: string;
  maker: string;
  by: SizeBy;
  number: string;
}

/** Step 3: name, maker, the kind of glass, and one number. */
export function SizeStep({ value, onChange, home }: { value: SizeValue; onChange: (v: SizeValue) => void; home: boolean }) {
  const set = (patch: Partial<SizeValue>) => onChange({ ...value, ...patch });
  const [more, setMore] = useState(MORE_TYPES.includes(value.glass) || !FIRST_TYPES.slice(0, 5).includes(value.glass));
  const kinds = more ? [...FIRST_TYPES, ...MORE_TYPES] : FIRST_TYPES.slice(0, 5);
  const n = readSize(value.by, value.number);
  const height = value.by === 'height';
  return (
    <View style={styles.stack}>
      <Field label="Name" value={value.name} onChangeText={(name) => set({ name })} placeholder={GLASS_TYPE_LABEL[value.glass]} maxLength={80} />
      {home ? null : <Field label="Maker (optional)" value={value.maker} onChangeText={(maker) => set({ maker })} placeholder="A glassworks, a potter, an edition" maxLength={80} />}
      <KitChipGroup label="What kind of glass?">
        {kinds.map((g) => (
          <Chip key={g} label={GLASS_TYPE_LABEL[g]} selected={g === value.glass} onPress={() => set({ glass: g })} />
        ))}
        {more ? null : <Chip label="More" selected={false} onPress={() => setMore(true)} />}
      </KitChipGroup>
      <View style={styles.stack}>
        <Caption tone="muted">I know its</Caption>
        <Segmented
          choice
          variant="pill"
          accessibilityLabel="I know its"
          options={[
            { value: 'height', label: 'Height' },
            { value: 'capacity', label: 'Capacity' },
          ]}
          value={value.by}
          onChange={(by) => set({ by, number: '' })}
        />
      </View>
      <Field
        label={height ? 'How tall is it?' : 'How much does it hold, to the brim?'}
        value={value.number}
        onChangeText={(number) => set({ number })}
        placeholder={height ? '150' : '205'}
        keyboardType="decimal-pad"
        maxLength={6}
        trailing={<Caption tone="muted">{height ? 'mm' : 'ml'}</Caption>}
        hint={height ? `Rim to table, with a ruler or tape.${n ? ` ${inches(n)}` : ''}` : `Fill it from a jigger and count.${n ? ` ${ounces(n)}.` : ''} We size the shape until it holds that much.`}
        error={value.number.trim() && !n ? (height ? 'A height from 20 to 400 mm.' : 'A capacity from 10 to 2,500 ml.') : undefined}
      />
    </View>
  );
}

/** Step 4: what the tracer does, while it does it. */
export function TracingStep({ uri, sizeTo }: { uri: string | null; sizeTo: string }) {
  const ds = useDs();
  const lines = ['Found the glass against the wall', 'Rim and foot, read as ovals', 'Following its edge, row by row', `Sizing it to ${sizeTo}`, 'Checking what it holds'];
  return (
    <View style={styles.stack}>
      {uri ? <Image source={{ uri }} style={[styles.photo, { backgroundColor: ds.c.surface }]} contentFit="contain" accessibilityIgnoresInvertColors /> : null}
      <View style={styles.tip}>
        <ActivityIndicator color={ds.c.muted} />
        <View role="list" aria-busy style={[styles.stack, styles.flex]}>
          {lines.map((l) => (
            <Body key={l} role="listitem" tone="muted">
              {l}
            </Body>
          ))}
        </View>
      </View>
    </View>
  );
}

/** Step 5: the photo and the drawing side by side at the same size, the traced line over the photo if asked, and the numbers. */
export function CompareStep({
  uri,
  photoSize,
  glass,
  traced,
  outline,
  by,
  capacity,
  onRetake,
  onFix,
}: {
  uri: string | null;
  /** The photo's pixels: the traced line is laid over it at that aspect, as the photo is shown. */
  photoSize: { width: number; height: number } | null;
  glass: SketchGlass;
  traced: TracedGlass | null;
  outline: GlassOutline;
  by: SizeBy;
  /** What it holds: the number typed, or worked out from the shape. */
  capacity: number;
  onRetake: () => void;
  onFix: () => void;
}) {
  const ds = useDs();
  const [over, setOver] = useState(false);
  const [box, setBox] = useState(160);
  const fromPhoto = uri ? 'From your photo' : 'From the shape';
  const rows: [string, string, string][] = [
    ['Height', mmText(outline.height_mm), by === 'height' ? 'You typed it' : 'From the shape'],
    ['Across the rim', mmText(outline.rim_mm), fromPhoto],
    ['Widest', mmText(outline.widest_mm), fromPhoto],
    ['Holds to the brim', by === 'capacity' ? `${Math.round(capacity)} ml` : aboutMl(capacity), by === 'capacity' ? 'You typed it' : 'Worked out from the shape'],
  ];
  return (
    <View style={styles.stack}>
      <View style={styles.pair} onLayout={(e) => setBox(Math.min(240, (e.nativeEvent.layout.width - space.md) / 2))}>
        {uri ? (
          <View style={styles.side}>
            <View style={[styles.frame, { width: box, height: box, backgroundColor: ds.c.surface }]}>
              <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" accessibilityLabel="Your photo of the glass" />
              {over && traced && photoSize ? (
                <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${photoSize.width} ${photoSize.height}`} preserveAspectRatio="xMidYMid meet" aria-hidden>
                  {[traced.overlay.left, traced.overlay.right].map((pts, i) => (
                    <Polyline
                      key={i}
                      points={pts.map(([x, y]) => `${x * photoSize.width},${y * photoSize.height}`).join(' ')}
                      fill="none"
                      stroke={ds.accentText}
                      strokeWidth={Math.max(photoSize.width, photoSize.height) / 120}
                    />
                  ))}
                </Svg>
              ) : null}
            </View>
            <Caption tone="muted">Your photo</Caption>
          </View>
        ) : null}
        <View style={styles.side}>
          <GlassThumb glass={glass} variant={null} outline={outline} size={box} />
          <Caption tone="muted">Our drawing, same size</Caption>
        </View>
      </View>
      {traced ? (
        <View style={styles.row}>
          <View style={styles.flex}>
            <Body>Show the outline on my photo</Body>
            <Caption tone="muted">The traced line over your photo, to see where it missed.</Caption>
          </View>
          <Switch value={over} onValueChange={setOver} label="Show the outline on my photo" />
        </View>
      ) : null}
      <View style={[styles.facts, { backgroundColor: ds.c.surface }]}>
        {rows.map(([label, value, how], i) => (
          <View key={label} style={[styles.fact, i ? { borderTopColor: ds.c.line, borderTopWidth: StyleSheet.hairlineWidth } : null]}>
            <Body tone="muted" style={styles.flex}>
              {label}
            </Body>
            <View style={styles.end}>
              <Spec>{value}</Spec>
              <Caption tone="muted">{how}</Caption>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.links}>
        <TextLink label="Retake the photo" onPress={onRetake} />
        <TextLink label={by === 'height' ? 'Fix the height' : 'Fix the capacity'} onPress={onFix} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
  tip: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  tipNo: { width: 24, height: 24, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm, borderRadius: radius.card, borderCurve: 'continuous' },
  chipPhoto: { width: 44, height: 44, borderRadius: radius.control },
  photo: { width: '100%', height: 220, borderRadius: radius.card },
  pair: { flexDirection: 'row', gap: space.md },
  side: { alignItems: 'center', gap: space.xs },
  frame: { borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  facts: { borderRadius: radius.card, borderCurve: 'continuous', paddingHorizontal: space.md },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.sm },
  end: { alignItems: 'flex-end' },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
});
