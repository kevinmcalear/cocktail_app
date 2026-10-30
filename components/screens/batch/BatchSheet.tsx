import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { BackbarTheme, Body, BrandProvider, Caption, LockedSection, PressableScale, Segmented, Sheet, SheetScrollView, TextLink, Title, useDs, useSheetClose } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ToolsSheet } from '@/components/tools/ToolsSheet';
import { layout, space } from '@/constants/tokens';
import { useShelfLives } from '@/hooks/useBatchPrep';
import { useSetPartFresh } from '@/hooks/useServiceSpec';
import { aheadParts, partKeeps } from '@/lib/batchContainers';
import { batchPrepLines, keepsFor, bottleExpiry, expiryLine } from '@/lib/batchPrep';
import {
  BOTTLE_SIZES,
  buildBatch,
  chillLine,
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
import { byPart, type MakingPart } from '@/lib/drinkParts';
import type { SpecLine } from '@/lib/spec';
import { useSettingsStore } from '@/store/useSettingsStore';

import { BatchActions } from './BatchActions';
import { freshPartsText, MakeByPart, partOneAbv, StationParts } from './BatchByPart';
import { AheadBlock, BottleChips, LabelBlock, PartEyebrow, UseBy, useContainers, useLabel } from './BatchContainers';
import { BatchRow, BottleRows, BottleTiles, Choice, FreezerCheck, ServesField, StockField } from './BatchParts';
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
  /** A venue's batch (Save as house-made, Make now); null at home (Share, Make it, tick as I go). */
  barId?: string | null;
  /** May make a house prep at the venue. */
  canPrep?: boolean;
  /** A drink made in parts (lib/drinkParts.ts): the bottle holds part 1, and each later part has its own container, or is made fresh per serve. */
  parts?: MakingPart[] | null;
  /** The drink, for its labels' code and setting a part made fresh. */
  itemId?: string | null;
}

type Mode = 'serves' | 'bottle' | 'stock';
const MODES = [
  { value: 'serves', label: 'Serves' },
  { value: 'bottle', label: 'Fill a bottle' },
  { value: 'stock', label: 'What I have' },
] as const;
const UNITS = [{ value: 'ml', label: 'ml' }, { value: 'oz', label: 'oz' }] as const;
/** What each station line is, beside its name ("citrus stays out"). */
const STATION_NOTE: Record<keyof typeof LEAVE_OUT_LABEL, string> = {
  citrus: 'citrus stays out',
  dairy: 'to order',
  bubbles: 'bubbles to order',
  garnish: 'per serve',
  station: 'at the station',
};
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

function BatchBody({ name, lines: all, methodNames: allMethods, lockedUntil, initialServes = 8, dilutionPct, serviceStyle, abv, canEdit, specLabel, barId = null, canPrep = false, parts = null, itemId = null }: BatchSheetProps) {
  // Made in parts, only part 1 goes in the bottle (board made-parts-making).
  const lines = parts ? byPart(all, parts.length)[0] : all;
  const methodNames = parts ? parts[0].methods : allMethods;
  const ds = useDs();
  const close = useSheetClose();
  const [mode, setMode] = useState<Mode>('serves');
  const [more, setMore] = useState(false); // Fill a bottle, the shelf, units and dilution wait behind More (i-batch-prompt).
  const [serves, setServes] = useState(initialServes);
  const [unit, setUnit] = useState<VolumeUnit>('ml');
  const [bottleSize, setBottleSize] = useState<BottleSize>(750);
  const [stockKey, setStockKey] = useState<string | null>(null);
  const [have, setHave] = useState('');
  const [tools, setTools] = useState(false);
  // Making it: the keys ticked off so far; null when not making.
  const [ticked, setTicked] = useState<string[] | null>(null);
  const tick = (key: string) => setTicked((t) => (t ? (t.includes(key) ? t.filter((k) => k !== key) : [...t, key]) : t));
  const boxes = useContainers(barId);
  const labelFor = useLabel(itemId);
  const setFresh = useSetPartFresh(itemId ?? '');
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
  const hasAmounts = all.some((l) => l.value !== null);
  const bottled = batch.lines.filter((l) => !l.leaveOut);
  const station = batch.lines.filter((l) => l.leaveOut);
  const bottles = `${batch.bottles} × ${bottleLabel(bottleSize)} ${batch.bottles === 1 ? 'bottle' : 'bottles'}`;
  const guessed = lines.every((l) => l.atService === null) && station.some((l) => l.leaveOut !== 'garnish');
  // House-made lines keep for so long; the bottle is used by the shortest of them.
  const houseIds = all.flatMap((l) => (l.houseMade && l.ingredientId ? [l.ingredientId] : []));
  const { data: lives = {} } = useShelfLives(houseIds);
  const lifeOf = (key: string) => {
    const id = lines.find((l) => l.key === key && l.houseMade)?.ingredientId;
    return id ? (lives[id] ?? null) : null;
  };
  const shelfHours = bottled.map((l) => lifeOf(l.key));
  const useBy = expiryLine(bottleExpiry(shelfHours, new Date()));
  // Every later part not made fresh goes in its own container (board made-parts-making, approved 27 Oct 2026).
  const ahead = parts ? aheadParts(all, parts, n, unit) : [];
  const keepsOne = boxes.keepsOf(1, shelfHours.filter((h): h is number => !!h).sort((a, b) => a - b)[0] ?? null);
  const keepsOf = (a: (typeof ahead)[number]) => boxes.keepsOf(a.part.n, partKeeps(a.lines, lives));
  const notes = new Map(all.map((l) => [l.key, l.note]));
  const onFresh = canEdit && itemId ? (part: number, fresh: boolean) => setFresh.mutate({ n: part, fresh }) : undefined;
  const aheadText = ahead.map((a) => `${a.part.name}, made ahead for ${n}: ${a.rows.map((r) => `${r.amount} ${r.ingredient}`).join(', ')}.`);
  const text = [`${name}, ${n} serves`, ...bottled.map((l) => `${l.amount} ${l.ingredient}`), ...(batch.water ? [`${batch.water.amount} water`] : []), `Pour ${batch.pour} each.`, ...aheadText, ...(parts ? freshPartsText(all, parts, unit, ahead) : [])].join('\n');
  const preps = [
    { name: `${name} batch`, lines: batchPrepLines(lines, bottled.map((l) => l.key), n), yieldMl: batch.totalMl, shelfHours: keepsOne },
    ...ahead.map((a) => ({ name: `${name}, ${a.part.name.toLowerCase()}`, lines: batchPrepLines(a.lines, a.rows.map((r) => r.key), n), yieldMl: a.totalMl, shelfHours: keepsOf(a) })),
  ];
  const stationRows = station.map((l) => (
    <BatchRow key={l.key} ingredient={l.ingredient} amount={l.perServe} sub={l.amount && l.perServe !== l.amount ? `${l.amount} for ${n}` : null} tag={LEAVE_OUT_LABEL[l.leaveOut!]} note={STATION_NOTE[l.leaveOut!]} />
  ));
  // At home, a drink in parts is made part by part with every line ticked; a venue's Make now ticks the bottle.
  const byParts = !!ticked && !!parts && !barId;
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
      {more ? <Segmented options={MODES} value={mode} onChange={setMode} accessibilityLabel="Scale by" variant="pill" stretch /> : null}
      {mode === 'bottle' ? <BottleTiles options={BOTTLES} value={bottleSize} onChange={setBottleSize} /> : null}
      {mode === 'stock' && stockLine ? (
        <StockField lines={stock} line={stockLine} onLine={setStockKey} have={have} onHave={setHave} unit={haveUnit} />
      ) : null}
      <ServesField
        value={n}
        onChange={pickServes}
        detail={mode === 'bottle' ? `${batch.total} · pour ${batch.pour} each` : ahead.length ? 'every part scales' : `fills ${batch.bottles} × ${bottleLabel(bottleSize)}`}
        trailing={more ? <Choice label="Units" options={UNITS} value={unit} onChange={setUnit} /> : undefined}
      />
      <TextLink label={more ? 'Fewer options' : 'More ways to batch: fill a bottle, what I have, units'} onPress={() => { setMore(!more); setMode('serves'); setUnit('ml'); }} />
      {mode === 'serves' ? (
        <>
          <ServesRuler value={serves} min={MIN_SERVES} max={MAX_SERVES} onChange={setServes} />
          <Caption tone="muted">{Platform.OS === 'web' ? 'Drag the ruler, use the arrow keys, or type a number.' : 'Drag to scale. Each serve is one tick.'}</Caption>
        </>
      ) : null}

      <View>
        {ahead.length ? (
          <PartEyebrow n={1} text={`IN THE BOTTLE · PART 1, ${parts![0].name.toUpperCase()}`} />
        ) : (
          <Caption tone="muted" style={styles.eyebrow}>
            {parts ? `IN THE BOTTLE · PART 1, ${parts[0].name.toUpperCase()}` : 'IN THE BOTTLE'}
          </Caption>
        )}
        <BottleRows batch={batch} bottled={bottled} unit={unit} houseNote={(key) => (lines.some((s) => s.key === key && s.houseMade) ? ['house', keepsFor(lifeOf(key))].filter(Boolean).join(' · ') : null)} ticked={ticked} onTick={tick} />
        {ahead.length ? <BottleChips chips={[`${batch.total} in ${bottles}`, batch.abv !== null ? `${Math.round(batch.abv)}% ABV` : null]} trailing={<UseBy hours={keepsOne} onChange={(h) => boxes.setKeeps(1, h)} />} /> : null}
        {ahead.length && ticked ? <LabelBlock label={labelFor(`${name} · ${parts![0].name}`, keepsOne, `${batch.total} in ${bottles}`)} /> : null}
      </View>

      {ahead.map((a) => (
        <AheadBlock key={a.part.n} a={a} boxes={boxes} keeps={keepsOf(a)} notes={notes} ticked={ticked} onTick={tick} labelFor={(amount) => labelFor(`${name} · ${a.part.name}`, keepsOf(a), amount)} onFresh={onFresh && ((fresh) => onFresh(a.part.n, fresh))} />
      ))}
      {setFresh.error ? <Caption tone="accent">{setFresh.error.message || "Couldn't change how that part is made. Try again."}</Caption> : null}

      {parts ? (
        <StationParts name={name} pour={batch.pourMl > 0 ? batch.pour : null} first={stationRows} added={station.map((l) => ({ amount: l.perServe, ingredient: l.ingredient }))} parts={parts} ahead={ahead} lines={all} unit={unit} onFresh={onFresh} />
      ) : batch.pourMl > 0 ? (
        <View>
          <Caption tone="muted" style={styles.eyebrow}>
            AT THE STATION, EACH SERVE
          </Caption>
          <BatchRow ingredient={`${name}, from the bottle`} amount={batch.pour} tone="accent" />
          {stationRows}
        </View>
      ) : null}

      {/* The bottle's total, strength and use-by as chips (board drink-sheet-batch-venue); with containers they sit under the bottle. */}
      {ahead.length ? null : (
        <BottleChips
          chips={[batch.total, batch.abv !== null ? `bottle ${Math.round(batch.abv)}% ABV` : null, useBy]}
          spoken={[`In the bottle: ${batch.total}`, bottles, batch.abv !== null ? `${Math.round(batch.abv)}% ABV` : null, useBy].filter(Boolean).join(', ')}
        />
      )}

      {batch.method === 'stirred' && batch.abv !== null ? <FreezerCheck abv={batch.abv} freezerC={freezerC} onFreezerC={setFreezerC} /> : null}
      <Body tone="muted">{`${batch.note} ${chillLine(batch.method, !!batch.water, freezerC, batch.abv)}`}</Body>
      {guessed ? (
        <Caption tone="muted">{canEdit ? 'What stays out of the bottle is guessed from the names. Set it in Edit, under Service.' : 'What stays out of the bottle is guessed from the names.'}</Caption>
      ) : null}
      <BatchActions
        name={name}
        barId={barId}
        canPrep={canPrep}
        making={!!ticked}
        onMake={() => setTicked((t) => (t ? null : []))}
        onDilution={more ? () => setTools(true) : undefined}
        preps={preps}
        text={text}
        onSaved={close}
      />
      {tools ? <ToolsSheet visible onClose={() => setTools(false)} tool="dilute" volumeMl={batch.totalMl - (batch.water?.ml ?? 0)} abv={parts ? partOneAbv(batch) : abv} scheme={ds.scheme} /> : null}
    </>
  );

  return (
    <SheetScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <View style={styles.head}>
        <View style={styles.flex}>
          {byParts ? <Caption tone="muted">{`At home · ${n} ${n === 1 ? 'serve' : 'serves'}`}</Caption> : null}
          <Title>{byParts ? name : 'Batch'}</Title>
          {byParts ? null : <Caption tone="muted">{[specLabel ?? name, parts ? `made in ${parts.length} parts${ahead.length === parts.length - 1 ? `, ${parts.length === 2 ? 'both' : 'all'} made ahead` : ''}` : methodLine(batch.method, batch.water)].join(' · ')}</Caption>}
        </View>
        <PressableScale accessibilityLabel="Close" onPress={close} style={styles.close}>
          <IconSymbol name="xmark" size={18} color={ds.c.muted} />
        </PressableScale>
      </View>
      {byParts ? <MakeByPart serves={n} parts={parts} lines={all} unit={unit} ticked={ticked} onTick={tick} onDone={() => setTicked(null)} /> : body}
    </SheetScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, paddingTop: space.md, paddingBottom: space.xxl, gap: space.lg },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  flex: { flex: 1, minWidth: 0 },
  eyebrow: { letterSpacing: 1.2 },
  close: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
});
