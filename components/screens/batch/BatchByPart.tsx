import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption } from '@/components/ds';
import { buildBatch, type BatchLine, type VolumeUnit } from '@/lib/batch';
import { byPart, joinStep, type MakingPart } from '@/lib/drinkParts';
import type { SpecLine } from '@/lib/spec';

import { JoinLine, PartHead } from '../drink/DrinkParts';
import { BatchRow } from './BatchParts';

const AMOUNT_W = 88;
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Each part after the first, made fresh for each serve: its lines for one serve. A batch holds part 1 only (Kevin, 27 Oct 2026). */
export function freshParts(lines: SpecLine[], parts: readonly MakingPart[], unit: VolumeUnit): { part: MakingPart; rows: BatchLine[] }[] {
  const grouped = byPart(lines, parts.length);
  return parts.slice(1).map((part) => ({ part, rows: buildBatch(grouped[part.n - 1], [], 1, { unit }).lines }));
}

/** The later parts for the batch's share text: "The cream, fresh for each serve: 30 ml Cream, then float it on top." */
export function freshPartsText(lines: SpecLine[], parts: readonly MakingPart[], unit: VolumeUnit): string[] {
  return freshParts(lines, parts, unit).map(({ part, rows }) => {
    const join = joinStep(part.join);
    return `${part.name}, fresh for each serve: ${rows.map((r) => `${r.amount} ${r.ingredient}`.trim()).join(', ')}${join ? `, then ${lowerFirst(join)}` : ''}.`;
  });
}

/**
 * The batch sheet's station list for a drink made in parts (board made-parts-making):
 * part 1 is the pour from the bottle and what's added to it (`first`, the rows as a
 * one-part drink shows them); every later part is made fresh, ending on its join.
 */
export function StationParts({ name, pour, first, parts, lines, unit }: { name: string; pour: string | null; first: ReactNode; parts: readonly MakingPart[]; lines: SpecLine[]; unit: VolumeUnit }) {
  return (
    <View>
      <Caption tone="muted" style={styles.eyebrow}>
        AT THE STATION, EACH SERVE
      </Caption>
      <PartHead n={1} name={parts[0].name} how={parts[0].how} />
      {pour ? <BatchRow ingredient={`${name}, from the bottle`} amount={pour} tone="accent" /> : null}
      {first}
      {freshParts(lines, parts, unit).map(({ part, rows }) => (
        <View key={part.n}>
          <PartHead n={part.n} name={part.name} how={part.how ? `Made fresh for each serve: ${lowerFirst(part.how)}` : 'Made fresh for each serve'} />
          {rows.map((l) => (
            <BatchRow key={l.key} ingredient={l.ingredient} amount={l.perServe} />
          ))}
          <JoinLine join={part.join} inset={AMOUNT_W} />
        </View>
      ))}
    </View>
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
              <BatchRow key={l.key} ingredient={l.ingredient} amount={l.amount} note={notes.get(l.key)} checked={ticked.includes(l.key)} onToggle={() => onTick(l.key)} />
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
