import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, BrandProvider, Button, Caption, GlassButton, LockedSection, Spec, Surface, Title, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { ToolsSheet } from '@/components/tools/ToolsSheet';
import { layout, space } from '@/constants/tokens';
import { buildBatch, LEAVE_OUT_LABEL, MAX_SERVES, MIN_SERVES, type BatchMethod, type BottleSize, type VolumeUnit } from '@/lib/batch';
import type { SpecLine } from '@/lib/spec';

import { BatchRow, Choice, ServesField } from './BatchParts';
import { ServesRuler } from './ServesRuler';

export interface BatchScreenProps {
  name: string;
  lines: SpecLine[];
  /** The drink's method names ("Stir", "shake and top"). */
  methodNames: string[];
  /** Null when this role sees amounts; otherwise the role that opens them. */
  lockedUntil: string | null;
  accent?: string;
  onClose: () => void;
  initialServes?: number;
  /** The drink's dilution (lib/drinkMath.ts); the stirred default without one. */
  dilutionPct?: number | null;
  /** items.service_style: bottled, carbonated and draught drinks get water in the bottle too. */
  serviceStyle?: string | null;
  /** The drink's ABV before dilution, to prefill the dilution calculator. */
  abv?: number | null;
}

function methodLine(method: BatchMethod, water: { pct: number } | null): string {
  const pct = water ? `${Number(water.pct.toFixed(1))}% water in the bottle` : null;
  switch (method) {
    case 'stirred':
      return `Stirred · ${pct ?? 'no water added'}`;
    case 'shaken':
      return `Shaken · ${pct ?? 'citrus fresh, shaken to order'}`;
    case 'built':
      return `Built · ${pct ?? 'bubbles to order'}`;
    default:
      return `Method not set · ${pct ?? 'no water added'}`;
  }
}

const UNITS = [
  { value: 'ml', label: 'ml' },
  { value: 'oz', label: 'oz' },
] as const;
const BOTTLES = [
  { value: 750, label: '750 ml' },
  { value: 1000, label: '1 L' },
] as const;

/**
 * Batching a drink for prep, in the light "prep" theme: drag the ruler to the
 * number of serves and read off what goes in the bottle, the water for a
 * stirred drink, what's added fresh or to order, and how many bottles to fill.
 */
export function BatchScreen(props: BatchScreenProps) {
  return (
    <BackbarTheme scheme="light">
      <BrandProvider accent={props.accent}>
        <BatchPage {...props} />
      </BrandProvider>
    </BackbarTheme>
  );
}

function BatchPage({ name, lines, methodNames, lockedUntil, onClose, initialServes = 8, dilutionPct, serviceStyle, abv }: BatchScreenProps) {
  const [tools, setTools] = useState(false);
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const wide = useBreakpoint() !== 'phone';
  const [serves, setServes] = useState(initialServes);
  const [unit, setUnit] = useState<VolumeUnit>('ml');
  const [bottleSize, setBottleSize] = useState<BottleSize>(750);
  const batch = buildBatch(lines, methodNames, serves, { unit, bottleSize, dilutionPct, serviceStyle });
  const hasAmounts = lines.some((l) => l.value !== null);

  const header = (
    <View style={[styles.nav, { paddingTop: insets.top + space.sm, paddingHorizontal: gutter }]}>
      <GlassButton accessibilityLabel="Close batch" icon="xmark" onPress={onClose} />
      <Caption tone="muted" style={styles.eyebrow}>
        Prep · batch
      </Caption>
      <View style={styles.navSpacer} />
    </View>
  );

  const controls = (
    <View style={styles.column}>
      <Title>{name}</Title>
      <Caption tone="muted">{methodLine(batch.method, batch.water)}</Caption>
      <ServesField value={serves} onChange={setServes} />
      <ServesRuler value={serves} min={MIN_SERVES} max={MAX_SERVES} onChange={setServes} />
      <Caption tone="muted">
        {Platform.OS === 'web' ? 'Drag the ruler, use the arrow keys, or type a number.' : 'Drag to scale. Each serve is one tick.'}
      </Caption>
      <View style={styles.options}>
        <Choice label="Units" options={UNITS} value={unit} onChange={setUnit} />
        <Choice label="Bottle size" options={BOTTLES} value={bottleSize} onChange={setBottleSize} />
      </View>
    </View>
  );

  const bottles = `${batch.bottles} × ${bottleSize === 1000 ? '1 L' : '750 ml'} ${batch.bottles === 1 ? 'bottle' : 'bottles'}`;
  const spec = (
    <View style={styles.column}>
      <View>
        {batch.lines.map((l) => (
          <BatchRow key={l.key} ingredient={l.ingredient} amount={l.amount} sub={l.sub} tag={l.leaveOut ? LEAVE_OUT_LABEL[l.leaveOut] : null} />
        ))}
        {batch.water ? <BatchRow ingredient="Filtered water" amount={batch.water.amount} sub={`${Number(batch.water.pct.toFixed(1))}% dilution, poured straight from the bottle`} /> : null}
      </View>
      <View
        accessible
        accessibilityLabel={`Total in the bottle: ${batch.total}, ${bottles}`}
        style={styles.total}
      >
        <Caption tone="muted" style={styles.eyebrow}>
          In the bottle
        </Caption>
        <Spec>
          {batch.total} · {bottles}
        </Spec>
      </View>
      <Surface>
        <Body>{batch.note}</Body>
      </Surface>
      <Button label="Dilution calculator" icon="drop.fill" variant="secondary" onPress={() => setTools(true)} style={styles.tools} />
      {tools ? <ToolsSheet visible onClose={() => setTools(false)} tool="dilute" volumeMl={batch.totalMl - (batch.water?.ml ?? 0)} abv={abv} /> : null}
    </View>
  );

  const locked = lockedUntil ? (
    <LockedSection title="Batch" unlocked={false} opensAt={lockedUntil}>
      {null}
    </LockedSection>
  ) : !hasAmounts ? (
    <Body tone="muted">This drink has no measured spec to batch yet.</Body>
  ) : null;

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      {header}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: space.md, paddingBottom: insets.bottom + space.xxxl }}
      >
        {locked ? (
          <View style={styles.column}>
            <Title>{name}</Title>
            {locked}
          </View>
        ) : wide ? (
          <View style={styles.wide}>
            <View style={styles.flex}>{controls}</View>
            <View style={styles.flex}>{spec}</View>
          </View>
        ) : (
          <View style={styles.column}>
            {controls}
            {spec}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: space.sm },
  navSpacer: { width: layout.minTapTarget },
  eyebrow: { textTransform: 'uppercase', letterSpacing: 1.2 },
  column: { gap: space.lg },
  wide: { flexDirection: 'row', gap: space.xxl, maxWidth: 1040, width: '100%', alignSelf: 'center' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  total: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: space.sm },
  tools: { alignSelf: 'flex-start' },
});
