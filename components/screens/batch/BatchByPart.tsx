import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption } from '@/components/ds';
import { buildBatch, type Batch, type BatchLine, type VolumeUnit } from '@/lib/batch';
import { fromContainer, inOrderSteps, partWord, type AheadPart, type OrderPart } from '@/lib/batchContainers';
import { byPart, joinStep, type MakingPart } from '@/lib/drinkParts';
import type { SpecLine } from '@/lib/spec';

import { JoinLine, PartHead } from '../drink/DrinkParts';
import { FreshChoice, InOrder } from './BatchContainers';
import { BatchRow } from './BatchParts';

const AMOUNT_W = 88;
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Each part after the first made fresh for each serve: its lines for one serve. A part with a container (`ahead`, lib/batchContainers.ts) isn't. */
export function freshParts(lines: SpecLine[], parts: readonly MakingPart[], unit: VolumeUnit, ahead: readonly AheadPart[] = []): { part: MakingPart; rows: BatchLine[] }[] {
  const grouped = byPart(lines, parts.length);
  return parts.slice(1).filter((p) => !ahead.some((a) => a.part.n === p.n)).map((part) => ({ part, rows: buildBatch(grouped[part.n - 1], [], 1, { unit }).lines }));
}

/** The later parts for the batch's share text: "The cream, fresh for each serve: 30 ml Cream, then float it on top." */
export function freshPartsText(lines: SpecLine[], parts: readonly MakingPart[], unit: VolumeUnit, ahead: readonly AheadPart[] = []): string[] {
  return freshParts(lines, parts, unit, ahead).map(({ part, rows }) => {
    const join = joinStep(part.join);
    const what = rows.map((r) => `${r.amount} ${r.ingredient}`.trim()).join(', ');
    return `${part.name}, fresh for each serve${what ? `: ${what}` : ''}${join ? `, then ${lowerFirst(join)}` : ''}.`;
  });
}

/** The bottle's strength before its water, for the dilution calculator: part 1 alone, not the finished drink. */
export function partOneAbv(batch: Batch): number | null {
  const mix = batch.totalMl - (batch.water?.ml ?? 0);
  return batch.abv !== null && mix > 0 ? (batch.abv * batch.totalMl) / mix : null;
}

/**
 * The batch sheet's station list for a drink made in parts (board made-parts-making):
 * part 1 is the pour from the bottle and what's added to it (`first`, the rows as a
 * one-part drink shows them, `added` the same as words); then each later part in
 * order, poured from its own container when made ahead (`ahead`) or made fresh,
 * each ending on its join. With a container, the numbered "In order" list follows.
 */
export function StationParts({ name, pour, first, added, parts, ahead, lines, unit, onFresh }: {
  name: string;
  pour: string | null;
  first: ReactNode;
  added: readonly { amount: string; ingredient: string }[];
  parts: readonly MakingPart[];
  ahead: readonly AheadPart[];
  lines: SpecLine[];
  unit: VolumeUnit;
  /** Someone who can edit the drink sets a part made fresh or ahead. */
  onFresh?: (n: number, fresh: boolean) => void;
}) {
  const fresh = freshParts(lines, parts, unit, ahead);
  const order: OrderPart[] = [{ part: parts[0], pour, lines: added }];
  const later = parts.slice(1).map((part) => {
    const a = ahead.find((x) => x.part.n === part.n);
    if (a) {
      order.push({ part, pour: a.pour, lines: a.perServe.map((l) => ({ amount: l.perServe, ingredient: l.ingredient })), whipped: a.whipped });
      const word = partWord(part.name);
      return (
        <View key={part.n}>
          <PartHead n={part.n} name={part.name} how={fromContainer(part.methods)} />
          <BatchRow ingredient={a.rows.length === 1 ? `${a.rows[0].ingredient}, the ${word} container` : `From the ${word} container`} amount={a.pour} tone="accent" />
          {a.perServe.map((l) => (
            <BatchRow key={l.key} ingredient={l.ingredient} amount={l.perServe} />
          ))}
          <JoinLine join={part.join} inset={AMOUNT_W} />
        </View>
      );
    }
    const rows = fresh.find((f) => f.part.n === part.n)?.rows ?? [];
    order.push({ part, pour: null, lines: rows.map((l) => ({ amount: l.perServe, ingredient: l.ingredient })) });
    return (
      <View key={part.n}>
        <PartHead n={part.n} name={part.name} how={part.how ? `Made fresh for each serve: ${lowerFirst(part.how)}` : 'Made fresh for each serve'} />
        {onFresh && part.fresh ? <FreshChoice name={part.name} fresh onChange={(v) => onFresh(part.n, v)} /> : null}
        {rows.map((l) => (
          <BatchRow key={l.key} ingredient={l.ingredient} amount={l.perServe} />
        ))}
        <JoinLine join={part.join} inset={AMOUNT_W} />
      </View>
    );
  });
  const bottle = ahead.length ? `${name}, the ${partWord(parts[0].name)} bottle` : `${name}, from the bottle`;
  return (
    <>
      <View>
        <Caption tone="muted" style={styles.eyebrow}>
          AT THE STATION, EACH SERVE
        </Caption>
        <PartHead n={1} name={parts[0].name} how={parts[0].how} />
        {pour ? <BatchRow ingredient={bottle} amount={pour} tone="accent" /> : null}
        {first}
        {later}
      </View>
      {ahead.length ? <InOrder steps={inOrderSteps(order)} /> : null}
    </>
  );
}

/**
 * Make it, tick as I go, at home, for a drink made in parts (board made-parts-making):
 * every line for the serves, part by part under "PART 2 OF 2", and each join its own
 * tick, last in its part.
 */
export function MakeByPart({ serves, parts, lines, unit, ticked, onTick, onDone }: {
  serves: number;
  parts: readonly MakingPart[];
  lines: SpecLine[];
  unit: VolumeUnit;
  ticked: string[];
  onTick: (key: string) => void;
  onDone: () => void;
}) {
  const grouped = byPart(lines, parts.length).map((group, i) => ({ part: parts[i], rows: buildBatch(group, [], serves, { unit }).lines }));
  const keys = grouped.flatMap(({ part, rows }) => [...rows.map((r) => r.key), ...(joinStep(part.join) ? [`join-${part.n}`] : [])]);
  const notes = new Map(lines.map((l) => [l.key, l.note]));
  return (
    <>
      <Body tone="muted" role="status">{`${keys.filter((k) => ticked.includes(k)).length} of ${keys.length} done`}</Body>
      {grouped.map(({ part, rows }) => {
        const join = joinStep(part.join);
        return (
          <View key={part.n} role="group" aria-label={`Part ${part.n} of ${parts.length}, ${part.name}`}>
            <PartHead n={part.n} name={part.name} how={part.how} eyebrow={`PART ${part.n} OF ${parts.length}`} />
            {rows.map((l) => (
              <BatchRow key={l.key} ingredient={l.ingredient} amount={l.amount} sub={l.sub} note={[l.sub, notes.get(l.key)].filter(Boolean).join(' · ') || null} checked={ticked.includes(l.key)} onToggle={() => onTick(l.key)} />
            ))}
            {join ? <BatchRow ingredient={join} amount="" checked={ticked.includes(`join-${part.n}`)} onToggle={() => onTick(`join-${part.n}`)} /> : null}
          </View>
        );
      })}
      <Button label="Done making" onPress={onDone} />
    </>
  );
}

const styles = StyleSheet.create({
  eyebrow: { letterSpacing: 1.2 },
});
