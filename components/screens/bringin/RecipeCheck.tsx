import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, Field, useDs, useGutter } from '@/components/ds';
import { radius, space, type as typeScale, fontFamilies } from '@/constants/tokens';
import { openPickLine, startChoices, type RecipeChoices } from '@/lib/bringInDraft';
import type { MatchData } from '@/lib/bringInMatch';
import type { ReadFile } from '@/lib/readAnything';
import type { ReadPlace, RecipeReading } from '@/supabase/functions/_shared/anythingRead';
import type { DrinkToMake } from '@/hooks/useBringInSave';

import { BoxField, CheckFooter, CheckTop, PageLook } from './CheckParts';
import { DrawnFromSpec, FromYourFile } from './RecipeSource';
import { amountShown, chooseLine, RecipeSpec, sentence } from './RecipeSpec';
import { useRecipeMaker, useSteadySketch } from './useRecipeMaker';

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

interface RecipeCheckProps {
  recipe: RecipeReading;
  files: ReadFile[];
  /** "From a notebook photo": where it came from. */
  from: string;
  data: MatchData;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (drink: DrinkToMake) => void;
  onEditAll: (drink: DrinkToMake) => void;
}

/**
 * The recipe check (canvas make-bringin-recipe) for one drink, drawn from its
 * spec, with the bit of the file it was read from small underneath (canvas
 * eddie-oct22-wave1), who made it and where it's from, every spec line
 * matched to your bar with amounts in your unit, the method, glass, ice and
 * garnish as chips. An open pick doesn't hold the save: it saves as the
 * plain kind. Several drinks are a review instead (ImportReview).
 */
export function RecipeCheck({ recipe, files, from, data, saving, error, onCancel, onSave, onEditAll }: RecipeCheckProps) {
  const ds = useDs();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const { usual, toMake } = useRecipeMaker(data);
  const [choices, setChoices] = useState<RecipeChoices>(() => startChoices(recipe));
  const [look, setLook] = useState<{ at?: ReadPlace | null; title: string } | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const set = (change: Partial<RecipeChoices>) => setChoices((c) => ({ ...c, ...change }));
  const made = toMake(recipe, choices);
  const sketch = useSteadySketch(made.sketch);
  const file = (x: { at?: ReadPlace | null } | null) => (x?.at ? (files[x.at.page] ?? null) : null);
  const page = file(recipe);

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + space.sm, paddingHorizontal: gutter }]} keyboardShouldPersistTaps="handled">
        <CheckTop kind="recipes" onCancel={onCancel} />
        <DrawnFromSpec inputs={sketch} seed={recipe.name} name={choices.name} />
        <View>
          {page ? null : (
            <Caption tone="muted" style={styles.eyebrow}>
              {from}
            </Caption>
          )}
          <TextInput accessibilityLabel="Drink name" value={choices.name} onChangeText={(name) => set({ name })} style={[styles.name, { color: ds.c.ink, fontFamily: fontFamilies.instrument }]} />
        </View>
        {page && recipe.at ? (
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
              <TextInput accessibilityLabel="Made by" placeholder="Who made it?" placeholderTextColor={ds.c.faint} value={choices.madeBy} onChangeText={(madeBy) => set({ madeBy })} style={[styles.input, { color: ds.c.ink }]} />
            </BoxField>
            <BoxField label="SOURCE">
              <TextInput accessibilityLabel="Source" placeholder="Where it’s from" placeholderTextColor={ds.c.faint} value={choices.source} onChangeText={(source) => set({ source })} style={[styles.input, { color: ds.c.ink }]} />
            </BoxField>
          </View>
          <Caption tone="muted">Made by and source are saved as notes on the drink.</Caption>
        </View>
        <RecipeSpec recipe={recipe} choices={choices} data={data} files={files} usual={usual} onChoose={(i, c) => setChoices((prev) => chooseLine(prev, i, c))} onLook={(at, title) => setLook({ at, title })} />
        <Chips words={[recipe.method, recipe.glass, recipe.ice, recipe.garnish].filter((w): w is string => !!w)} onNotes={() => setNotesOpen((o) => !o)} />
        {notesOpen || choices.notes ? <Field label="Notes" value={choices.notes} onChangeText={(notes) => set({ notes })} minLines={3} /> : null}
        {error ? <Caption tone="accent">{error}</Caption> : null}
      </ScrollView>
      <CheckFooter note={openPickLine(recipe, choices, data)}>
        <View style={styles.row}>
          <Button label="Edit all" size="lg" variant="secondary" onPress={() => onEditAll(made)} style={styles.flex} />
          <Button label={saving ? 'Saving…' : 'Save drink'} size="lg" disabled={saving || !choices.name.trim()} onPress={() => onSave(made)} style={styles.wide} />
        </View>
      </CheckFooter>
      <PageLook file={file(look)} at={look?.at ?? null} title={look?.title ?? ''} onClose={() => setLook(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: space.lg, paddingBottom: space.xxl },
  eyebrow: { letterSpacing: 0.6, textTransform: 'uppercase' },
  name: { ...typeScale.title, paddingVertical: 0 },
  row: { flexDirection: 'row', gap: space.sm + 2 },
  made: { gap: space.sm },
  input: { ...typeScale.body, paddingVertical: 2, fontFamily: fontFamilies.body },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center' },
  notes: { borderWidth: 1, borderStyle: 'dashed', minHeight: 36 },
  flex: { flex: 1 },
  wide: { flex: 2 },
});
