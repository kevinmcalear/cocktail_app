import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, PressableScale, Spec, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import { useBarZones, useItemLocations } from '@/hooks/useBackBar';
import { usePrepData } from '@/hooks/usePrepList';
import { useSaveZoneCount, useStockOnHand } from '@/hooks/useStockCounts';
import { formatPar } from '@/lib/backBar';
import { countStep, countUnit, formatCount, zoneSummary, type CountedSpot } from '@/lib/stock';
import type { ItemLocation } from '@/types/backBar';

interface CountScreenProps {
  barId: string;
  /** Tonight's menu ids, so house-made items are known for "goes on the prep list". */
  menuIds: string[];
}

/**
 * Count: walk the back bar map zone by zone in the order it's laid out. Each
 * spot shows its container and par with a stepper in the unit that makes
 * sense; saving a zone records a count, and the prep and order lists pick
 * the short items up.
 */
export function CountScreen({ barId, menuIds }: CountScreenProps) {
  const ds = useDs();
  const { data: zones = [], isPending: zonesPending } = useBarZones(barId);
  const { data: locations = [] } = useItemLocations(barId);
  const { data: onHand = [] } = useStockOnHand(barId);
  const { data: prepData } = usePrepData(barId, menuIds);
  const save = useSaveZoneCount(barId);
  const [index, setIndex] = useState(0);
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [savedZones, setSavedZones] = useState<string[]>([]);

  if (zonesPending) return <Caption tone="muted">Loading the back bar…</Caption>;
  if (!zones.length) return <Body tone="muted">Draw the back bar first: Count walks it zone by zone.</Body>;
  const zone = zones[Math.min(index, zones.length - 1)];
  const spots = locations.filter((l) => l.zone_id === zone.id && l.item);
  const last = (l: ItemLocation) => onHand.find((r) => r.item_id === l.item_id && r.location_id === l.id);
  const valueOf = (l: ItemLocation): number | null => (amounts[l.id] ?? null);
  const counted: CountedSpot[] = spots.map((l) => ({
    name: l.item?.name ?? 'Hidden item',
    amount: valueOf(l),
    par: l.par_amount == null ? null : Number(l.par_amount),
    unit: countUnit(l.par_unit),
    houseMade: !!prepData?.houseMade[l.item_id],
  }));
  const summary = zoneSummary(counted);
  const done = savedZones.includes(zone.id);
  const next = () => setIndex((i) => Math.min(i + 1, zones.length - 1));
  const saveZone = () =>
    save
      .mutateAsync({
        zoneId: zone.id,
        lines: spots.filter((l) => valueOf(l) !== null).map((l) => ({ item_id: l.item_id, location_id: l.id, amount: valueOf(l)!, unit: countUnit(l.par_unit) })),
      })
      .then(() => {
        setSavedZones((z) => [...z, zone.id]);
        if (index < zones.length - 1) next();
      }, () => {});

  return (
    <View style={styles.block}>
      <View style={styles.head}>
        <Headline role="heading">{zone.name}</Headline>
        <Caption tone="muted">
          zone {index + 1} of {zones.length}
          {done ? ' · saved' : ''}
        </Caption>
      </View>
      {zone.description ? <Caption tone="muted">{zone.description}</Caption> : null}
      {spots.length === 0 ? <Body tone="muted">Nothing lives here yet.</Body> : null}
      {spots.map((l) => {
        const unit = countUnit(l.par_unit);
        const step = countStep(unit);
        const value = valueOf(l);
        const par = l.par_amount == null ? null : Number(l.par_amount);
        const short = value !== null && par !== null && value < par;
        const was = last(l);
        const setValue = (v: number) => setAmounts((a) => ({ ...a, [l.id]: Math.max(0, Math.round(v * 10) / 10) }));
        return (
          <View key={l.id} style={[styles.row, { borderBottomColor: ds.c.line }]}>
            <View style={styles.rowMain}>
              <Body>{l.item?.name}</Body>
              <Caption tone="muted">
                {[l.shelf, formatPar(l.par_amount, l.par_unit) ? `par ${formatPar(l.par_amount, l.par_unit)}` : null, was ? `last ${formatCount(Number(was.amount), was.unit)}` : null].filter(Boolean).join(' · ')}
              </Caption>
              {l.container ? <Caption tone="muted">{l.container}</Caption> : null}
            </View>
            <View role="group" accessibilityLabel={`${l.item?.name}, count in ${unit}`} style={[styles.stepper, { borderColor: ds.c.lineStrong }]}>
              <PressableScale accessibilityLabel={`Less ${l.item?.name}`} onPress={() => setValue((value ?? par ?? 0) - step)} style={styles.stepButton}>
                <IconSymbol name="minus" size={18} color={ds.c.ink} />
              </PressableScale>
              <Spec tone={short ? 'accent' : 'ink'} align="center" style={styles.stepValue}>
                {value === null ? '–' : formatCount(value, unit)}
              </Spec>
              <PressableScale accessibilityLabel={`More ${l.item?.name}`} onPress={() => setValue((value ?? par ?? 0) + step)} style={styles.stepButton}>
                <IconSymbol name="plus" size={18} color={ds.c.ink} />
              </PressableScale>
            </View>
          </View>
        );
      })}
      {spots.length ? <Body tone="muted">{summary.sentence}</Body> : null}
      {save.error ? <Caption tone="accent">{"Couldn't save the count. Check your connection and try again."}</Caption> : null}
      <View style={styles.actions}>
        {spots.length ? <Button label={save.isPending ? 'Saving…' : index < zones.length - 1 ? 'Save and next' : 'Save count'} disabled={save.isPending || !spots.some((l) => valueOf(l) !== null)} onPress={saveZone} /> : null}
        {index < zones.length - 1 ? <Button label={`Skip to ${zones[index + 1].name}`} variant="ghost" onPress={next} /> : null}
        {index > 0 ? <Button label="Back" variant="ghost" onPress={() => setIndex((i) => i - 1)} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.md },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  rowMain: { flex: 1, gap: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.pill },
  stepButton: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 72 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
