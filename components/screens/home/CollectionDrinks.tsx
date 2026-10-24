import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body } from '@/components/ds';
import { MemorySheet } from '@/components/screens/published/MemorySheet';
import { space } from '@/constants/tokens';
import { useCollection, type CollectedDrink } from '@/hooks/useCollection';
import { useMyBar } from '@/hooks/useHomeBar';
import { useMadeDrinks } from '@/hooks/useMade';
import { useMyHadDrinks } from '@/hooks/useRankings';
import { splitCollection } from '@/lib/collection';
import { averageScore } from '@/lib/collectionMenus';
import { beatCount, hadOutRows, madeRows, type DrinkStage, type HadSort } from '@/lib/collectionStages';
import { tallyMade } from '@/lib/madeIt';
import { formatScore } from '@/lib/ranking';

import { HadOut } from './CollectionHadOut';
import { MadeAtHome } from './CollectionMade';
import { StageStrip } from './CollectionStages';
import { ToMake, type MakeDrink } from './CollectionToMake';

/** A bar drink whose spec stays closed to you: names only. */
const isLocked = (d: CollectedDrink) => d.liveMode === 'description' && !d.specOpens;

/**
 * Collection's Drinks (board home-collection-drinks): Had out → To make →
 * Made. The tiles switch the list under them, To make first. Had out is
 * every drink you scored at a bar, with the past drinks you kept; To make,
 * every drink you saved and haven't made, against your shelf; Made, your
 * versions against the bars'.
 */
export function CollectionDrinks() {
  const { data, isLoading, error } = useCollection();
  const bar = useMyBar();
  const made = useMadeDrinks().data ?? [];
  const had = useMyHadDrinks().data ?? [];
  const [stage, setStage] = useState<DrinkStage>('make');
  const [sort, setSort] = useState<HadSort>('best');
  const [memory, setMemory] = useState<CollectedDrink | null>(null);
  if (error) return <Body tone="muted">Couldn’t load your collection. Try again in a moment.</Body>;
  if (isLoading || !data) return null;

  const { live } = splitCollection(data.drinks);
  const opens = new Set(live.map((d) => d.id));
  const tallies = tallyMade(made);
  const madeIds = new Set(tallies.map((t) => t.itemId));
  const classics = new Set(made.filter((m) => m.classic).map((m) => m.itemId));
  // Your best score for a drink you had out, and where: To make's "Had at Little Rye · 8.4".
  const yours = new Map<string, { score: number; bar: string | null }>();
  for (const h of had) if ((h.venue || h.atBar) && h.score >= (yours.get(h.itemId)?.score ?? -1)) yours.set(h.itemId, { score: h.score, bar: h.venue?.name ?? null });
  const from = (d: CollectedDrink) => {
    const out = d.itemId ? yours.get(d.itemId) : undefined;
    if (out) return `${out.bar ? `Had at ${out.bar}` : 'Had out'} · ${formatScore(out.score)}`;
    // A classic's barName is whoever publishes it, not where you had it.
    if (d.classic) return 'Saved · classic';
    return d.barName ? `${d.hadOn ? 'Had at' : 'Saved from'} ${d.barName}` : undefined;
  };
  const toMake: MakeDrink[] = live.filter((d) => !d.itemId || !madeIds.has(d.itemId)).map((d) => ({ ...d, locked: isLocked(d), from: from(d) }));
  const kept = data.drinks.map((d) => ({ id: d.id, itemId: d.itemId, name: d.name, imageUrl: d.imageUrl, barName: d.barName, hadOn: d.hadOn, past: !opens.has(d.id), locked: isLocked(d) }));
  const hadRows = hadOutRows(had, kept, bar, sort);
  const madeList = madeRows(tallies, had, classics);
  const out = had.filter((h) => h.venue || h.atBar);
  const avg = averageScore(out.map((h) => h.score));
  const ready = toMake.filter((d) => d.itemId && bar.canMakeIds.has(d.itemId) && !d.locked).length;
  const beat = beatCount(madeList);

  return (
    <View style={styles.wrap}>
      <StageStrip
        label="Where your drinks are"
        value={stage}
        onChange={setStage}
        stages={[
          { key: 'had', n: hadRows.length, label: 'Had out', sub: avg !== null ? `avg ${formatScore(avg)}` : null },
          { key: 'make', n: toMake.length, label: 'To make', sub: ready ? `${ready} ready` : null },
          { key: 'made', n: tallies.length, label: 'Made', sub: beat ? `${beat} beat the bar` : null },
        ]}
      />
      {stage === 'had' ? <HadOut rows={hadRows} sort={sort} onSort={setSort} onMemory={(id) => setMemory(data.drinks.find((d) => d.id === id) ?? null)} /> : null}
      {stage === 'make' ? <ToMake drinks={toMake} shelf={bar} /> : null}
      {stage === 'made' ? <MadeAtHome rows={madeList} /> : null}
      {memory ? <MemorySheet memory={memory} onClose={() => setMemory(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xl },
});
