import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useDs } from '@/components/ds';
import { ListGroup, ListRow, SectionLabel } from '@/components/ds/ListGroup';
import { LogBatchButton } from '@/components/screens/prep/LogBatchButton';
import { dayHues, radius, space } from '@/constants/tokens';
import { useBatchLogs, useShelfLives } from '@/hooks/useBatches';
import { useTonight } from '@/hooks/useTonight';
import { useTonightPrep } from '@/hooks/useTonightPrep';
import { fridgeRows, lowLine } from '@/lib/drinksTab';
import { itemHref } from '@/lib/itemRoutes';

/** A batch's day colour (the kitchen's day dots), or a hollow ring when it hasn't been made. */
function DayMark({ day }: { day: number | null }) {
  const ds = useDs();
  return <View style={[styles.mark, { borderWidth: 1, borderColor: ds.c.lineStrong }, day === null ? null : { backgroundColor: dayHues[day] }]} />;
}

/**
 * House-made's top (Sta-capsules, House-made): Low, the house-made tonight's
 * lists need more of (Prep's own rule) with Log batch, then In the fridge,
 * each one's newest batch in its day colour with its use-by, "Use today" in
 * amber. Both need Prep or Specs (useTonightPrep); without them, or with
 * nothing to show, the section stays out and the house-made list follows.
 */
export function HouseMadeTop({ barId, nameOf }: { barId: string; nameOf: (id: string) => string | null }) {
  const router = useRouter();
  const tonight = useTonight(barId);
  const [now] = useState(() => new Date());
  const { canPrep, prep, batchOf } = useTonightPrep(
    barId,
    tonight.menus.map((m) => m.id),
    now
  );
  const batches = useBatchLogs(canPrep ? barId : null).data ?? [];
  const keeps = useShelfLives(batches.map((b) => b.itemId)).data ?? {};
  const fridge = fridgeRows(batches, keeps, nameOf, now);
  const low = canPrep ? (prep?.make ?? []) : [];
  const lastDay = (id: string) => fridge.find((f) => f.id === id)?.madeDay ?? null;
  const open = (id: string) => () => router.push(itemHref('Ingredient', id) as Href);
  if (!low.length && !fridge.length) return null;
  return (
    <View style={styles.top}>
      {low.length ? (
        <View style={styles.section}>
          <SectionLabel title="Low" />
          <ListGroup>
            {low.map((line, i) => (
              <ListRow key={line.id} first={i === 0} lead={<DayMark day={lastDay(line.id)} />} title={line.name} detail={lowLine(line)} end={<LogBatchButton barId={barId} id={line.id} name={line.name} batch={batchOf(line.id)} />} />
            ))}
          </ListGroup>
        </View>
      ) : null}
      {fridge.length ? (
        <View style={styles.section}>
          <SectionLabel title="In the fridge" aside={String(fridge.length)} />
          <ListGroup>
            {fridge.map((row, i) => (
              <ListRow key={row.id} first={i === 0} lead={<DayMark day={row.madeDay} />} title={row.name} detail={row.line} value={row.today ? 'Use today' : null} warn={row.today} onPress={open(row.id)} />
            ))}
          </ListGroup>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { gap: space.lg },
  section: { gap: space.sm },
  mark: { width: 14, height: 14, borderRadius: radius.pill },
});
