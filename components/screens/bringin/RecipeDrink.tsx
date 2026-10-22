import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Body, Button, Caption, Field, ReviewRow, TextLink, useDs } from '@/components/ds';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { radius, space, type as typeScale, fontFamilies } from '@/constants/tokens';
import { barVariants, useBarGlassware } from '@/hooks/useBarGlassware';
import type { DrinkToMake } from '@/hooks/useBringInSave';
import { useSpecCatalog } from '@/hooks/useBulk';
import { useDropdowns } from '@/hooks/useDropdowns';
import { isPrepName, prepRatio } from '@/lib/bringIn';
import { recipeDraft, type RecipeChoices } from '@/lib/bringInDraft';
import { ingredientState, plainKind, type MatchData } from '@/lib/bringInMatch';
import { convertPour, sketchLook } from '@/lib/drinkWizard';
import type { ReadFile } from '@/lib/readAnything';
import { draftSketchInputs } from '@/lib/sketch/draft';
import type { ReadPlace, RecipeReading, RecipeReadLine } from '@/supabase/functions/_shared/anythingRead';
import { useSettingsStore } from '@/store/useSettingsStore';

import { BoxField, MonoLabel, PageLook } from './CheckParts';
import { SourceCrop } from './PagePicture';
import { DrawnFromSpec, FromYourFile } from './RecipeSource';

/** "calvados" reads "Calvados", as the canvas sets a spec line; a bottle's own capitals stay. */
export const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const amountShown = (line: RecipeReadLine, usual: string) => {
  if (line.unit === 'top') return 'Top';
  if (line.amount === null) return '';
  const pour = convertPour(line.amount, line.unit ?? usual, usual);
  return `${pour.amount} ${pour.unit}`.trim();
};

/** A checked recipe as the drink it saves as, drawn with the bar's own glasses, as the wizard draws. */
export function useDrinkMaker(data: MatchData) {
  const usual = useSettingsStore((s) => s.defaultUnit) || 'ml';
  const { methods, glasses } = useSpecCatalog();
  const ice = (useDropdowns().data?.iceTypes ?? []).flatMap((i: { id: string; name: string | null }) => (i.name ? [{ id: i.id, name: i.name }] : []));
  const variants = barVariants(useBarGlassware(data.venueId).data);
  const toMake = (r: RecipeReading, c: RecipeChoices): DrinkToMake => {
    const draft = recipeDraft(r, c, data, { methods, glasses, ice }, usual);
    // Saved as drawn here, so the drink keeps the drawing the check showed.
    return { draft, prepNames: r.lines.filter((l) => isPrepName(l.ingredient)).map((l) => l.ingredient), sketch: draftSketchInputs(sketchLook(draft, variants)) };
  };
  return { toMake, variants, usual };
}

function Chips({ words, onNotes }: { words: string[]; onNotes: () => void }) {
  const ds = useDs();
  return (
    <View style={styles.chips}>
      {words.map((w) => (
        <View key={w} style={[styles.chip, { backgroundColor: ds.c.surface, borderColor: ds.c.glassBorder }]}>
          <Body>{sentence(w)}</Body>
        </View>
      ))}
      <Button label="+ Notes" variant="ghost" onPress={onNotes} style={[styles.notes, { borderColor: ds.c.lineStrong }]} />
    </View>
  );
}

interface RecipeDrinkProps {
  recipe: RecipeReading;
  choices: RecipeChoices;
  onChange: (change: Partial<RecipeChoices>) => void;
  files: ReadFile[];
  /** "From a notebook photo": where it came from. */
  from: string;
  data: MatchData;
  /** "Drink 3 of 12", when there's more than one. */
  count?: { at: number; of: number } | null;
  /** The desktop review: the drawing beside the name, and the file in its own column, not here. */
  wide?: boolean;
  /** "Edit this drink": the full editor. */
  onEdit?: () => void;
}

/**
 * One read drink to check (canvas make-bringin-recipe): drawn from its spec,
 * with the bit of the file it was read from small underneath (canvas
 * eddie-oct22-wave1), who made it and where it's from, every spec line
 * matched to your bar with amounts in your unit, the method, glass, ice and
 * garnish as chips.
 */
export function RecipeDrink({ recipe, choices, onChange, files, from, data, count, wide, onEdit }: RecipeDrinkProps) {
  const ds = useDs();
  const { toMake, usual, variants } = useDrinkMaker(data);
  const [look, setLook] = useState<{ at?: ReadPlace | null; title: string } | null>(null);
  const [matchOf, setMatchOf] = useState<number | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const choose = (line: number, choice: RecipeChoices['lines'][number] | null) => {
    const lines = { ...choices.lines };
    if (choice) lines[line] = choice;
    else delete lines[line];
    onChange({ lines });
  };
  const drawn = JSON.stringify(sketchLook(toMake(recipe, choices).draft, variants));
  // One inputs object per look: SketchDrawing keeps its painted scene by it.
  const sketch = useMemo(() => draftSketchInputs(JSON.parse(drawn)), [drawn]);
  const pageUnit = recipe.lines.find((l) => l.unit && ['oz', 'ml', 'cl'].includes(l.unit))?.unit;
  const file = (x: { at?: ReadPlace | null } | null) => (x?.at ? (files[x.at.page] ?? null) : null);
  const page = file(recipe);
  const eyebrow = [page ? null : from, count && count.of > 1 ? `Drink ${count.at + 1} of ${count.of}` : null].filter(Boolean).join(' · ');
  // The desktop says method and glass under the name, as the board does; the chips keep the rest.
  const served = wide ? [recipe.method, recipe.glass].filter((w): w is string => !!w) : [];
  const chips = [recipe.method, recipe.glass, recipe.ice, recipe.garnish].filter((w): w is string => !!w && !served.includes(w));
  const name = (
    <View style={wide ? styles.flex : undefined}>
      {eyebrow ? (
        <Caption tone="muted" style={styles.eyebrow}>
          {eyebrow}
        </Caption>
      ) : null}
      <TextInput accessibilityLabel="Drink name" value={choices.name} onChangeText={(value) => onChange({ name: value })} style={[styles.name, { color: ds.c.ink, fontFamily: fontFamilies.instrument }]} />
      {wide ? <Caption tone="muted">{[...served.map(sentence), served.length ? 'drawn from the spec' : 'Drawn from the spec'].join(' · ')}</Caption> : null}
    </View>
  );

  return (
    <>
      {wide ? (
        <View style={styles.head}>
          <DrawnFromSpec inputs={sketch} seed={recipe.name} name={choices.name} compact />
          {name}
        </View>
      ) : (
        <>
          <DrawnFromSpec inputs={sketch} seed={recipe.name} name={choices.name} />
          {name}
        </>
      )}
      {!wide && page && recipe.at ? (
        <FromYourFile
          file={page}
          box={recipe.at.box}
          words={recipe.lines.slice(0, 3).map((l) => `${amountShown(l, l.unit ?? usual)} ${l.ingredient}`).join('\n')}
          page={files.length > 1 ? recipe.at.page + 1 : null}
          onLook={() => setLook({ at: recipe.at, title: choices.name })}
        />
      ) : null}
      <View style={styles.made}>
        <View style={styles.row}>
          <BoxField label="MADE BY">
            <TextInput accessibilityLabel="Made by" placeholder="Who made it?" placeholderTextColor={ds.c.faint} value={choices.madeBy} onChangeText={(madeBy) => onChange({ madeBy })} style={[styles.input, { color: ds.c.ink }]} />
          </BoxField>
          <BoxField label="SOURCE">
            <TextInput accessibilityLabel="Source" placeholder="Where it’s from" placeholderTextColor={ds.c.faint} value={choices.source} onChangeText={(source) => onChange({ source })} style={[styles.input, { color: ds.c.ink }]} />
          </BoxField>
        </View>
        <Caption tone="muted">Made by and source are saved as notes on the drink.</Caption>
      </View>
      <View>
        <View style={styles.specHead}>
          <MonoLabel>SPEC</MonoLabel>
          {pageUnit && pageUnit !== usual ? <Caption tone="muted">{`${pageUnit} on the page · showing ${usual}`}</Caption> : null}
        </View>
        <View role="list">
          {recipe.lines.map((line, i) => {
            const choice = choices.lines[i];
            const fresh = !!choice && 'fresh' in choice;
            const state = fresh ? null : ingredientState(line.ingredient, data, choice && 'pick' in choice ? choice.pick : null);
            const amount = amountShown(line, usual);
            const onAmount = line.at && file(line) ? () => setLook({ at: line.at, title: line.ingredient }) : undefined;
            const flag = line.unsure ? `Check this: ${line.doubt ? `${line.doubt} ` : ''}${onAmount ? 'Tap to see the page' : 'Look at the page'}` : null;
            const crop = line.unsure && line.at ? <SourceCrop file={file(line)} box={line.at.box} words={line.ingredient} width={58} height={32} /> : null;
            if (state?.state === 'have') {
              const named = state.item.name.toLowerCase() !== line.ingredient.toLowerCase() ? ` · ${state.item.name}` : '';
              return <ReviewRow key={i} state="have" amount={amount} onAmount={onAmount} title={sentence(line.ingredient)} detail={`In your bar${named}`} flag={flag} end={crop} onPress={() => setMatchOf(i)} pressHint="See or change the match" />;
            }
            if (state?.state === 'pick') {
              const kind = plainKind(line.ingredient, state.items, data);
              const options = [...state.items.map((it) => ({ id: it.id, label: it.name })), ...(kind ? [{ id: kind.id, label: `Any ${kind.name.toLowerCase()}` }] : [])];
              return <ReviewRow key={i} state="pick" amount={amount} onAmount={onAmount} title={sentence(line.ingredient)} detail="Which one?" flag={flag} end={crop} choices={options} onChoose={(id) => choose(i, { pick: id })} />;
            }
            const ratio = prepRatio(line.ingredient);
            const detail = ratio ? `New prep · ${ratio}` : isPrepName(line.ingredient) ? 'New prep' : 'New ingredient';
            return <ReviewRow key={i} state="new" amount={amount} onAmount={onAmount} title={sentence(line.ingredient)} detail={detail} flag={flag} end={crop} action={fresh ? { label: 'Undo', hint: 'Use the match again', onPress: () => choose(i, null) } : undefined} />;
          })}
        </View>
      </View>
      {onEdit ? (
        <View style={styles.start}>
          <TextLink label="Edit this drink" tone="ink" accessibilityHint="Opens it in the full editor" onPress={onEdit} />
        </View>
      ) : null}
      <Chips words={chips} onNotes={() => setNotesOpen((o) => !o)} />
      {notesOpen || choices.notes ? <Field label="Notes" value={choices.notes} onChangeText={(notes) => onChange({ notes })} minLines={3} /> : null}
      <PageLook file={file(look)} at={look?.at ?? null} title={look?.title ?? ''} onClose={() => setLook(null)} />
      {matchOf !== null ? (
        <MenuSheet visible onClose={() => setMatchOf(null)} title={recipe.lines[matchOf].ingredient} subtitle="Matched to what’s in your bar.">
          <View style={styles.sheet}>
            <Button label="Keep the match" onPress={() => setMatchOf(null)} />
            <Button label="Make it a new ingredient" variant="secondary" onPress={() => { choose(matchOf, { fresh: true }); setMatchOf(null); }} />
          </View>
        </MenuSheet>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.lg + 4 },
  eyebrow: { letterSpacing: 0.6, textTransform: 'uppercase' },
  name: { ...typeScale.title, paddingVertical: 0 },
  row: { flexDirection: 'row', gap: space.sm + 2 },
  made: { gap: space.sm },
  input: { ...typeScale.body, paddingVertical: 2, fontFamily: fontFamilies.body },
  specHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center' },
  notes: { borderWidth: 1, borderStyle: 'dashed', minHeight: 36 },
  sheet: { gap: space.sm },
  start: { alignItems: 'flex-start' },
  flex: { flex: 1, minWidth: 0 },
});
