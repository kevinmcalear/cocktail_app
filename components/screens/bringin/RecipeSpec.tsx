import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, ReviewRow } from '@/components/ds';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { space } from '@/constants/tokens';
import { isPrepName, prepRatio } from '@/lib/bringIn';
import type { LineChoice, RecipeChoices } from '@/lib/bringInDraft';
import { ingredientState, plainKind, type MatchData } from '@/lib/bringInMatch';
import { convertPour } from '@/lib/drinkWizard';
import type { ReadFile } from '@/lib/readAnything';
import type { ReadPlace, RecipeReading, RecipeReadLine } from '@/supabase/functions/_shared/anythingRead';

import { MonoLabel } from './CheckParts';
import { SourceCrop } from './PagePicture';

/** "calvados" reads "Calvados", as the canvas sets a spec line; a bottle's own capitals stay. */
export const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const amountShown = (line: RecipeReadLine, usual: string) => {
  if (line.unit === 'top') return 'Top';
  if (line.amount === null) return '';
  const pour = convertPour(line.amount, line.unit ?? usual, usual);
  return `${pour.amount} ${pour.unit}`.trim();
};

/**
 * A read recipe's spec, every line matched to your bar with its amount in
 * your unit: in your bar (tap to change the match), which one, or new. A line
 * the reader was unsure of says so, with the bit of the page beside it.
 */
export function RecipeSpec({ recipe, choices, data, files, usual, label = true, onChoose, onLook }: {
  recipe: RecipeReading;
  choices: RecipeChoices;
  data: MatchData;
  files: ReadFile[];
  usual: string;
  /** The SPEC label, with "oz on the page · showing ml". */
  label?: boolean;
  onChoose: (line: number, choice: LineChoice | null) => void;
  onLook: (at: ReadPlace | null | undefined, title: string) => void;
}) {
  const [matchOf, setMatchOf] = useState<number | null>(null);
  const file = (x: { at?: ReadPlace | null }) => (x.at ? (files[x.at.page] ?? null) : null);
  const pageUnit = recipe.lines.find((l) => l.unit && ['oz', 'ml', 'cl'].includes(l.unit))?.unit;
  return (
    <View>
      {label ? (
        <View style={styles.specHead}>
          <MonoLabel>SPEC</MonoLabel>
          {pageUnit && pageUnit !== usual ? <Caption tone="muted">{`${pageUnit} on the page · showing ${usual}`}</Caption> : null}
        </View>
      ) : null}
      <View role="list">
        {recipe.lines.map((line, i) => {
          const choice = choices.lines[i];
          const fresh = !!choice && 'fresh' in choice;
          const state = fresh ? null : ingredientState(line.ingredient, data, choice && 'pick' in choice ? choice.pick : null);
          const amount = amountShown(line, usual);
          const onAmount = line.at && file(line)?.uri ? () => onLook(line.at, line.ingredient) : undefined;
          const flag = line.unsure ? `Check this: ${line.doubt ? `${line.doubt} ` : ''}${onAmount ? 'Tap to see the page' : 'Look at the page'}` : null;
          const crop = line.unsure && line.at ? <SourceCrop file={file(line)} box={line.at.box} words={line.ingredient} width={58} height={32} /> : null;
          if (state?.state === 'have') {
            const named = state.item.name.toLowerCase() !== line.ingredient.toLowerCase() ? ` · ${state.item.name}` : '';
            return <ReviewRow key={i} state="have" amount={amount} onAmount={onAmount} title={sentence(line.ingredient)} detail={`In your bar${named}`} flag={flag} end={crop} onPress={() => setMatchOf(i)} pressHint="See or change the match" />;
          }
          if (state?.state === 'pick') {
            const kind = plainKind(line.ingredient, state.items, data);
            const options = [...state.items.map((it) => ({ id: it.id, label: it.name })), ...(kind ? [{ id: kind.id, label: `Any ${kind.name.toLowerCase()}` }] : [])];
            return <ReviewRow key={i} state="pick" amount={amount} onAmount={onAmount} title={sentence(line.ingredient)} detail="Which one?" flag={flag} end={crop} choices={options} onChoose={(id) => onChoose(i, { pick: id })} />;
          }
          const ratio = prepRatio(line.ingredient);
          const detail = ratio ? `New prep · ${ratio}` : isPrepName(line.ingredient) ? 'New prep' : 'New ingredient';
          return <ReviewRow key={i} state="new" amount={amount} onAmount={onAmount} title={sentence(line.ingredient)} detail={detail} flag={flag} end={crop} action={fresh ? { label: 'Undo', hint: 'Use the match again', onPress: () => onChoose(i, null) } : undefined} />;
        })}
      </View>
      {matchOf !== null ? (
        <MenuSheet visible onClose={() => setMatchOf(null)} title={recipe.lines[matchOf].ingredient} subtitle="Matched to what’s in your bar.">
          <View style={styles.sheet}>
            <Button label="Keep the match" onPress={() => setMatchOf(null)} />
            <Button
              label="Make it a new ingredient"
              variant="secondary"
              onPress={() => {
                onChoose(matchOf, { fresh: true });
                setMatchOf(null);
              }}
            />
          </View>
        </MenuSheet>
      ) : null}
    </View>
  );
}

/** Sets or clears one line's choice. */
export function chooseLine(choices: RecipeChoices, line: number, choice: LineChoice | null): RecipeChoices {
  const lines = { ...choices.lines };
  if (choice) lines[line] = choice;
  else delete lines[line];
  return { ...choices, lines };
}

const styles = StyleSheet.create({
  specHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: space.xs },
  sheet: { gap: space.sm },
});
