import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { BackbarTheme, Body, BrandProvider, Button, Caption, LockedSection, Segmented, sheetFrame, Spec, Tag, Title, useDs } from '@/components/ds';
import { ToolsSheet } from '@/components/tools/ToolsSheet';
import { radius, space } from '@/constants/tokens';
import {
  BOTTLE_SIZES,
  buildBatch,
  LEAVE_OUT_LABEL,
  MAX_SERVES,
  MIN_SERVES,
  servesFromStock,
  servesToFill,
  stockLines,
  stockUnit,
  type BatchMethod,
  type BottleSize,
  type VolumeUnit,
} from '@/lib/batch';
import type { SpecLine } from '@/lib/spec';
import { useSettingsStore } from '@/store/useSettingsStore';

import { BatchRow, Choice, FreezerCheck, ServesField, StockField } from './BatchParts';
import { ServesRuler } from './ServesRuler';

export interface BatchSheetProps {
  visible: boolean;
  onClose: () => void;
  name: string;
  lines: SpecLine[];
  /** The drink's method names ("Stir", "shake and top"). */
  methodNames: string[];
  /** Null when this role sees amounts; otherwise the role that opens them. */
  lockedUntil: string | null;
  accent?: string;
  initialServes?: number;
  /** The drink's dilution (lib/drinkMath.ts); the stirred default without one. */
  dilutionPct?: number | null;
  /** items.service_style: bottled, carbonated and draught drinks get water in the bottle too. */
  serviceStyle?: string | null;
  /** The drink's ABV before dilution, to prefill the dilution calculator. */
  abv?: number | null;
  /** The viewer can edit the drink, so a guessed split is theirs to set. */
  canEdit?: boolean;
}

type Mode = 'serves' | 'bottle' | 'stock';
const MODES = [
  { value: 'serves', label: 'Serves' },
  { value: 'bottle', label: 'Fill a bottle' },
  { value: 'stock', label: 'What I have' },
] as const;
const UNITS = [
  { value: 'ml', label: 'ml' },
  { value: 'oz', label: 'oz' },
] as const;
const bottleLabel = (size: BottleSize) => (size === 1000 ? '1 L' : `${size} ml`);
const BOTTLES = BOTTLE_SIZES.map((v) => ({ value: v, label: bottleLabel(v) }));

function methodLine(method: BatchMethod, water: { pct: number } | null): string {
  const pct = water ? `${Number(water.pct.toFixed(1))}% water in the bottle` : null;
  switch (method) {
    case 'stirred':
      return `Stirred · ${pct ?? 'no water added'}`;
    case 'shaken':
      return `Shaken · ${pct ?? 'shaken to order, so no water in the bottle'}`;
    case 'built':
      return `Built · ${pct ?? 'bubbles to order'}`;
    default:
      return `Method not set · ${pct ?? 'no water added'}`;
  }
}

/**
 * Batch a drink from its page, in both modes: by serves, to fill a bottle, or
 * from the bottle you have least of. Shows what goes in the bottle, what each
 * serve takes from it and adds at the station, how strong the bottle is, and
 * for a freezer pour, whether it stays liquid in this device's freezer.
 */
export function BatchSheet(props: BatchSheetProps) {
  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onClose}>
      <BackbarTheme>
        <BrandProvider accent={props.accent}>
          <Sheet {...props} />
        </BrandProvider>
      </BackbarTheme>
    </Modal>
  );
}

function Sheet({ onClose, name, lines, methodNames, lockedUntil, initialServes = 8, dilutionPct, serviceStyle, abv, canEdit }: BatchSheetProps) {
  const ds = useDs();
  // A percentage max height has nothing to measure on web (the column has no height): use the window.
  const maxHeight = useWindowDimensions().height * 0.92;
  const [mode, setMode] = useState<Mode>('serves');
  const [serves, setServes] = useState(initialServes);
  const [unit, setUnit] = useState<VolumeUnit>('ml');
  const [bottleSize, setBottleSize] = useState<BottleSize>(750);
  const [stockKey, setStockKey] = useState<string | null>(null);
  const [have, setHave] = useState('');
  const [tools, setTools] = useState(false);
  const freezerC = useSettingsStore((s) => s.freezerC);
  const setFreezerC = useSettingsStore((s) => s.setFreezerC);

  const opts = { unit, bottleSize, dilutionPct, serviceStyle };
  const stock = stockLines(lines);
  const stockLine = stock.find((l) => l.key === stockKey) ?? stock[0] ?? null;
  const haveUnit = stockLine ? stockUnit(stockLine, unit) : unit;
  const haveAmount = Number(have.replace(',', '.'));
  const n =
    mode === 'bottle'
      ? servesToFill(lines, methodNames, bottleSize, opts)
      : mode === 'stock' && stockLine && haveAmount > 0
        ? servesFromStock(stockLine, haveAmount, haveUnit)
        : serves;
  const batch = buildBatch(lines, methodNames, n, opts);
  const hasAmounts = lines.some((l) => l.value !== null);
  const bottled = batch.lines.filter((l) => !l.leaveOut);
  const station = batch.lines.filter((l) => l.leaveOut);
  const bottles = `${batch.bottles} × ${bottleLabel(bottleSize)} ${batch.bottles === 1 ? 'bottle' : 'bottles'}`;
  const guessed = lines.every((l) => l.atService === null) && station.some((l) => l.leaveOut !== 'garnish');
  const pickServes = (v: number) => {
    setMode('serves');
    setServes(v);
  };

  const body = lockedUntil ? (
    <LockedSection title="Batch" unlocked={false} opensAt={lockedUntil}>
      {null}
    </LockedSection>
  ) : !hasAmounts ? (
    <Body tone="muted">This drink has no measured spec to batch yet.</Body>
  ) : (
    <>
      <Segmented options={MODES} value={mode} onChange={setMode} accessibilityLabel="Scale by" />
      {mode === 'bottle' ? <Choice label="Bottle size" options={BOTTLES} value={bottleSize} onChange={setBottleSize} /> : null}
      {mode === 'stock' && stockLine ? (
        <StockField lines={stock} line={stockLine} onLine={setStockKey} have={have} onHave={setHave} unit={haveUnit} />
      ) : null}
      <ServesField value={n} onChange={pickServes} />
      {mode === 'serves' ? (
        <>
          <ServesRuler value={serves} min={MIN_SERVES} max={MAX_SERVES} onChange={setServes} />
          <Caption tone="muted">{Platform.OS === 'web' ? 'Drag the ruler, use the arrow keys, or type a number.' : 'Drag to scale. Each serve is one tick.'}</Caption>
        </>
      ) : null}
      <Choice label="Units" options={UNITS} value={unit} onChange={setUnit} />

      <View>
        <Caption tone="muted" style={styles.eyebrow}>
          IN THE BOTTLE
        </Caption>
        {bottled.map((l) => (
          <BatchRow key={l.key} ingredient={l.ingredient} amount={l.amount} sub={l.sub} />
        ))}
        {batch.water ? <BatchRow ingredient="Filtered water" amount={batch.water.amount} sub={`${Number(batch.water.pct.toFixed(1))}% of the mix before water`} /> : null}
        <View accessible accessibilityLabel={`In the bottle: ${batch.total}, ${bottles}`} style={styles.total}>
          <Body>{bottles}</Body>
          <Spec>{batch.total}</Spec>
        </View>
      </View>

      {batch.pourMl > 0 ? (
        <View>
          <Caption tone="muted" style={styles.eyebrow}>
            AT THE STATION, EACH SERVE
          </Caption>
          <BatchRow ingredient={`${name}, from the bottle`} amount={batch.pour} />
          {station.map((l) => (
            <BatchRow key={l.key} ingredient={l.ingredient} amount={l.perServe} sub={l.amount && l.perServe !== l.amount ? `${l.amount} for ${n}` : null} tag={LEAVE_OUT_LABEL[l.leaveOut!]} />
          ))}
        </View>
      ) : null}

      {batch.abv !== null ? <Tag label={`Bottle ${Math.round(batch.abv)}% ABV`} style={styles.tag} /> : null}
      {batch.method === 'stirred' && batch.abv !== null ? <FreezerCheck abv={batch.abv} freezerC={freezerC} onFreezerC={setFreezerC} /> : null}
      <Body tone="muted">{batch.note}</Body>
      {guessed ? (
        <Caption tone="muted">{canEdit ? 'What stays out of the bottle is guessed from the names. Set it under Service on the drink page.' : 'What stays out of the bottle is guessed from the names.'}</Caption>
      ) : null}
      <Button label="Dilution calculator" icon="drop.fill" variant="secondary" onPress={() => setTools(true)} style={styles.tools} />
      {tools ? <ToolsSheet visible onClose={() => setTools(false)} tool="dilute" volumeMl={batch.totalMl - (batch.water?.ml ?? 0)} abv={abv} scheme={ds.scheme} /> : null}
    </>
  );

  return (
    <Pressable accessibilityLabel="Close batch" style={[styles.scrim, sheetFrame.scrim, { backgroundColor: ds.c.scrim }]} onPress={onClose}>
      <View style={styles.avoider} pointerEvents="box-none">
        <Pressable style={[styles.sheet, sheetFrame.panel, { borderColor: ds.c.lineStrong, backgroundColor: ds.c.ground, maxHeight }]} onPress={(e) => e.stopPropagation()}>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <View style={styles.head}>
              <View style={styles.flex}>
                <Caption tone="muted">Batch</Caption>
                <Title>{name}</Title>
                <Caption tone="muted">{methodLine(batch.method, batch.water)}</Caption>
              </View>
              <Button label="Done" variant="secondary" onPress={onClose} />
            </View>
            {body}
          </ScrollView>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end' },
  avoider: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  sheet: { borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, borderCurve: 'continuous' },
  body: { padding: space.xl, paddingBottom: space.xxxl, gap: space.lg },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  flex: { flex: 1, minWidth: 0 },
  eyebrow: { letterSpacing: 1.2 },
  total: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: space.sm, paddingTop: space.md },
  tag: { alignSelf: 'flex-start' },
  tools: { alignSelf: 'flex-start' },
});
