import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { BackbarTheme, Body, BrandProvider, Caption, LockedSection, PressableScale, Segmented, Sheet, SheetScrollView, Spec, Title, useDs, useSheetClose } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ToolsSheet } from '@/components/tools/ToolsSheet';
import { layout, space } from '@/constants/tokens';
import { useShelfLives } from '@/hooks/useBatchPrep';
import { batchPrepLines, keepsFor, bottleExpiry, expiryLine } from '@/lib/batchPrep';
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

import { BatchActions } from './BatchActions';
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
  /** "House spec · version 3": which spec this is, first in the header. */
  specLabel?: string | null;
  /** A venue's batch (Save as prep card, Make now); null at home (Share, Make it, tick as I go). */
  barId?: string | null;
  /** May make a house prep at the venue. */
  canPrep?: boolean;
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
      return `stirred · ${pct ?? 'no water added'}`;
    case 'shaken':
      return `shaken to order, ${pct ?? 'no water in the bottle'}`;
    case 'built':
      return `built · ${pct ?? 'bubbles to order'}`;
    default:
      return `method not set · ${pct ?? 'no water added'}`;
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
    <BackbarTheme>
      <BrandProvider accent={props.accent}>
        <Sheet visible={props.visible} onClose={props.onClose} accessibilityLabel={`Batch ${props.name}`} ground>
          <BatchBody {...props} />
        </Sheet>
      </BrandProvider>
    </BackbarTheme>
  );
}

function BatchBody({ name, lines, methodNames, lockedUntil, initialServes = 8, dilutionPct, serviceStyle, abv, canEdit, specLabel, barId = null, canPrep = false }: BatchSheetProps) {
  const ds = useDs();
  const close = useSheetClose();
  const [mode, setMode] = useState<Mode>('serves');
  const [serves, setServes] = useState(initialServes);
  const [unit, setUnit] = useState<VolumeUnit>('ml');
  const [bottleSize, setBottleSize] = useState<BottleSize>(750);
  const [stockKey, setStockKey] = useState<string | null>(null);
  const [have, setHave] = useState('');
  const [tools, setTools] = useState(false);
  // Making it: the keys ticked off so far; null when not making.
  const [ticked, setTicked] = useState<string[] | null>(null);
  const tick = (key: string) => setTicked((t) => (t ? (t.includes(key) ? t.filter((k) => k !== key) : [...t, key]) : t));
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
  // House-made lines keep for so long; the bottle is used by the shortest of them.
  const houseIds = lines.flatMap((l) => (l.houseMade && l.ingredientId ? [l.ingredientId] : []));
  const { data: lives = {} } = useShelfLives(houseIds);
  const lifeOf = (key: string) => {
    const id = lines.find((l) => l.key === key && l.houseMade)?.ingredientId;
    return id ? (lives[id] ?? null) : null;
  };
  const shelfHours = bottled.map((l) => lifeOf(l.key));
  const useBy = expiryLine(bottleExpiry(shelfHours, new Date()));
  const shortest = shelfHours.filter((h): h is number => !!h).sort((a, b) => a - b)[0] ?? null;
  const text = [`${name}, ${n} serves`, ...bottled.map((l) => `${l.amount} ${l.ingredient}`), ...(batch.water ? [`${batch.water.amount} water`] : []), `Pour ${batch.pour} each.`].join('\n');
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
      {mode === 'bottle' ? <Caption tone="muted">{`${batch.total} · pour ${batch.pour} each`}</Caption> : null}
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
        {bottled.map((l) => {
          const keeps = keepsFor(lifeOf(l.key));
          const house = lines.some((s) => s.key === l.key && s.houseMade);
          return (
            <BatchRow
              key={l.key}
              ingredient={l.ingredient}
              amount={l.amount}
              sub={[l.sub, house ? ['house', keeps].filter(Boolean).join(' · ') : null].filter(Boolean).join(' · ') || null}
              checked={ticked?.includes(l.key)}
              onToggle={ticked ? () => tick(l.key) : undefined}
            />
          );
        })}
        {batch.water ? (
          <BatchRow
            ingredient="Filtered water"
            amount={batch.water.amount}
            sub={batch.method === 'stirred' ? `${Number(batch.water.pct.toFixed(1))}%, stands in for stirring` : `${Number(batch.water.pct.toFixed(1))}% of the mix before water`}
            checked={ticked?.includes('water')}
            onToggle={ticked ? () => tick('water') : undefined}
          />
        ) : batch.method === 'shaken' ? (
          <BatchRow ingredient="Water" amount={unit === 'oz' ? '0 oz' : '0 ml'} sub="the shake dilutes it" />
        ) : null}
        <View accessible accessibilityLabel={[`In the bottle: ${batch.total}`, bottles, batch.abv !== null ? `${Math.round(batch.abv)}% ABV` : null, useBy].filter(Boolean).join(', ')} style={styles.total}>
          <Spec>{batch.total}</Spec>
          <Caption tone="muted" style={styles.flex}>
            {[bottles, batch.abv !== null ? `bottle ${Math.round(batch.abv)}% ABV` : null, useBy].filter(Boolean).join(' · ')}
          </Caption>
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

      {batch.method === 'stirred' && batch.abv !== null ? <FreezerCheck abv={batch.abv} freezerC={freezerC} onFreezerC={setFreezerC} /> : null}
      <Body tone="muted">{batch.note}</Body>
      {guessed ? (
        <Caption tone="muted">{canEdit ? 'What stays out of the bottle is guessed from the names. Set it under Service on the drink page.' : 'What stays out of the bottle is guessed from the names.'}</Caption>
      ) : null}
      <BatchActions
        name={name}
        barId={barId}
        canPrep={canPrep}
        making={!!ticked}
        onMake={() => setTicked((t) => (t ? null : []))}
        onDilution={() => setTools(true)}
        prep={{ lines: batchPrepLines(lines, bottled.map((l) => l.key), n), yieldMl: batch.totalMl, shelfHours: shortest }}
        text={text}
        onSaved={close}
      />
      {tools ? <ToolsSheet visible onClose={() => setTools(false)} tool="dilute" volumeMl={batch.totalMl - (batch.water?.ml ?? 0)} abv={abv} scheme={ds.scheme} /> : null}
    </>
  );

  return (
    <SheetScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <View style={styles.head}>
        <View style={styles.flex}>
          <Title>Batch</Title>
          <Caption tone="muted">{[specLabel ?? name, methodLine(batch.method, batch.water)].join(' · ')}</Caption>
        </View>
        <PressableScale accessibilityLabel="Close" onPress={close} style={styles.close}>
          <IconSymbol name="xmark" size={18} color={ds.c.muted} />
        </PressableScale>
      </View>
      {body}
    </SheetScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.xl, paddingTop: space.md, paddingBottom: space.xxxl, gap: space.lg },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  flex: { flex: 1, minWidth: 0 },
  eyebrow: { letterSpacing: 1.2 },
  total: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: space.sm, paddingTop: space.md },
  close: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
});
