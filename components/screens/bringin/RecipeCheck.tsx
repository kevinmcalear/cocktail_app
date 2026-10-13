import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, Field, ReviewRow, useDs, useGutter } from '@/components/ds';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { radius, space, type as typeScale, fontFamilies } from '@/constants/tokens';
import { useSpecCatalog } from '@/hooks/useBulk';
import { useDropdowns } from '@/hooks/useDropdowns';
import { isPrepName, prepRatio } from '@/lib/bringIn';
import { openPickLine, recipeDraft, startChoices, type RecipeChoices } from '@/lib/bringInDraft';
import { ingredientState, plainKind, type MatchData } from '@/lib/bringInMatch';
import { convertPour } from '@/lib/drinkWizard';
import type { ReadFile } from '@/lib/readAnything';
import type { RecipeReading, RecipeReadLine } from '@/supabase/functions/_shared/anythingRead';
import { useSettingsStore } from '@/store/useSettingsStore';
import type { DrinkToMake } from '@/hooks/useBringInSave';

import { BoxField, CheckFooter, CheckTop, MonoLabel, PageLook } from './CheckParts';
import { SourceCrop } from './PagePicture';

/** "calvados" reads "Calvados", as the canvas sets a spec line; a bottle's own capitals stay. */
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const amountShown = (line: RecipeReadLine, usual: string) => {
  if (line.unit === 'top') return 'Top';
  if (line.amount === null) return '';
  const pour = convertPour(line.amount, line.unit ?? usual, usual);
  return `${pour.amount} ${pour.unit}`.trim();
};

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
  recipes: RecipeReading[];
  files: ReadFile[];
  /** "From a notebook photo": where it came from. */
  from: string;
  data: MatchData;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (drinks: DrinkToMake[]) => void;
  onEditAll: (drink: DrinkToMake) => void;
}

/**
 * The recipe check (canvas make-bringin-recipe): one drink at a time, its
 * source beside its name, who made it and where it's from, every spec line
 * matched to your bar with amounts in your unit, the method, glass, ice and
 * garnish as chips. An open pick doesn't hold the save: it saves as the
 * plain kind.
 */
export function RecipeCheck({ recipes, files, from, data, saving, error, onCancel, onSave, onEditAll }: RecipeCheckProps) {
  const ds = useDs();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const usual = useSettingsStore((s) => s.defaultUnit) || 'ml';
  const { methods, glasses } = useSpecCatalog();
  const ice = (useDropdowns().data?.iceTypes ?? []).flatMap((i: { id: string; name: string | null }) => (i.name ? [{ id: i.id, name: i.name }] : []));
  const [at, setAt] = useState(0);
  const [all, setAll] = useState<RecipeChoices[]>(() => recipes.map(startChoices));
  const [look, setLook] = useState<RecipeReadLine | null>(null);
  const [matchOf, setMatchOf] = useState<number | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const recipe = recipes[at];
  const choices = all[at];
  const set = (change: Partial<RecipeChoices>) => setAll((prev) => prev.map((c, i) => (i === at ? { ...c, ...change } : c)));
  const choose = (line: number, choice: RecipeChoices['lines'][number] | null) => {
    const lines = { ...choices.lines };
    if (choice) lines[line] = choice;
    else delete lines[line];
    set({ lines });
  };
  const toMake = (r: RecipeReading, c: RecipeChoices): DrinkToMake => ({
    draft: recipeDraft(r, c, data, { methods, glasses, ice }, usual),
    prepNames: r.lines.filter((l) => isPrepName(l.ingredient)).map((l) => l.ingredient),
  });
  const pageUnit = recipe.lines.find((l) => l.unit && ['oz', 'ml', 'cl'].includes(l.unit))?.unit;
  const last = at === recipes.length - 1;
  const file = (line: RecipeReadLine | RecipeReading | null) => (line?.at ? (files[line.at.page] ?? null) : null);

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + space.sm, paddingHorizontal: gutter }]} keyboardShouldPersistTaps="handled">
        <CheckTop kind="recipes" onCancel={onCancel} />
        <View style={styles.head}>
          <View style={styles.tilt}>
            <SourceCrop file={file(recipe)} box={recipe.at?.box} words={[recipe.name, ...recipe.lines.slice(0, 3).map((l) => `${amountShown(l, l.unit ?? usual)} ${l.ingredient}`)].join('\n')} width={68} height={88} />
          </View>
          <View style={styles.flex}>
            <Caption tone="muted" style={styles.eyebrow}>
              {recipes.length > 1 ? `${from} · ${at + 1} of ${recipes.length}` : from}
            </Caption>
            <TextInput accessibilityLabel="Drink name" value={choices.name} onChangeText={(name) => set({ name })} style={[styles.name, { color: ds.c.ink, fontFamily: fontFamilies.instrument }]} />
          </View>
        </View>
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
              const onAmount = line.at && file(line) ? () => setLook(line) : undefined;
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
        <Chips words={[recipe.method, recipe.glass, recipe.ice, recipe.garnish].filter((w): w is string => !!w)} onNotes={() => setNotesOpen((o) => !o)} />
        {notesOpen || choices.notes ? <Field label="Notes" value={choices.notes} onChangeText={(notes) => set({ notes })} minLines={3} /> : null}
        {error ? <Caption tone="accent">{error}</Caption> : null}
      </ScrollView>
      <CheckFooter note={openPickLine(recipe, choices, data)}>
        <View style={styles.row}>
          <Button label="Edit all" size="lg" variant="secondary" onPress={() => onEditAll(toMake(recipe, choices))} style={styles.flex} />
          <Button
            label={saving ? 'Saving…' : !last ? 'Next drink' : recipes.length > 1 ? `Save ${recipes.length} drinks` : 'Save drink'}
            size="lg"
            disabled={saving || !choices.name.trim()}
            onPress={() => (last ? onSave(recipes.map((r, i) => toMake(r, all[i]))) : setAt(at + 1))}
            style={styles.wide}
          />
        </View>
      </CheckFooter>
      <PageLook file={file(look)} at={look?.at ?? null} title={look?.ingredient ?? ''} onClose={() => setLook(null)} />
      {matchOf !== null ? (
        <MenuSheet visible onClose={() => setMatchOf(null)} title={recipe.lines[matchOf].ingredient} subtitle="Matched to what’s in your bar.">
          <View style={styles.sheet}>
            <Button label="Keep the match" onPress={() => setMatchOf(null)} />
            <Button label="Make it a new ingredient" variant="secondary" onPress={() => { choose(matchOf, { fresh: true }); setMatchOf(null); }} />
          </View>
        </MenuSheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: space.lg, paddingBottom: space.xxl },
  head: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md + 2 },
  tilt: { transform: [{ rotate: '-3deg' }] },
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
  flex: { flex: 1 },
  wide: { flex: 2 },
});
