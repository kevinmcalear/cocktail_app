import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Body, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import { COMMON_INGREDIENTS, guessUnit, newLine, pickByName, searchByName, type StepProps, type WizardLine, type WizardPick } from '@/lib/drinkWizard';
import { getPreferredUnit } from '@/store/useSettingsStore';

import { LineRow } from './LineRow';
import { WizardChip } from './WizardChrome';

type Ingredient = { id: string; name: string | null };

/** How many quick adds show under the field. */
const QUICK = 8;

/**
 * The spec so far, each line with a stepper; a field to find an ingredient
 * (or add a new one); and quick adds for the common ones.
 */
export function IngredientsStep({ draft, set, ingredients }: StepProps & { ingredients: readonly Ingredient[] }) {
  const ds = useDs();
  const [query, setQuery] = useState('');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const results = searchByName(query, ingredients);
  const exact = results.some((r) => (r.name ?? '').trim().toLowerCase() === query.trim().toLowerCase());

  const add = (pick: WizardPick) => {
    set({ lines: [...draft.lines, newLine(pick, guessUnit(pick.name, getPreferredUnit()))] });
    setQuery('');
  };
  const change = (key: string, c: Partial<WizardLine>) => set({ lines: draft.lines.map((l) => (l.key === key ? { ...l, ...c } : l)) });
  const has = (name: string) => draft.lines.some((l) => l.name.trim().toLowerCase() === name.toLowerCase());
  const quick = COMMON_INGREDIENTS.filter((n) => !has(n)).slice(0, QUICK);

  return (
    <View style={styles.stack}>
      {draft.lines.length ? (
        <View>
          {draft.lines.map((l) => (
            <LineRow
              key={l.key}
              line={l}
              open={l.key === openKey}
              onToggle={() => setOpenKey(openKey === l.key ? null : l.key)}
              onChange={(c) => change(l.key, c)}
              onRemove={() => set({ lines: draft.lines.filter((x) => x.key !== l.key) })}
            />
          ))}
        </View>
      ) : null}

      <View style={[styles.field, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
        <IconSymbol name="plus" size={18} color={ds.c.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Add an ingredient"
          placeholderTextColor={ds.c.muted}
          aria-label="Add an ingredient"
          autoCorrect={false}
          returnKeyType="done"
          maxLength={80}
          onSubmitEditing={() => {
            if (results[0]) add({ id: results[0].id, name: results[0].name ?? query });
            else if (query.trim()) add({ id: null, name: query.trim() });
          }}
          style={[styles.input, type.body, { fontFamily: fontFamilies.body, color: ds.c.ink }]}
        />
      </View>

      {query.trim() ? (
        <View role="list" style={[styles.results, { borderColor: ds.c.line }]}>
          {results.map((r) => (
            <ResultRow key={r.id} label={r.name ?? ''} onPress={() => add({ id: r.id, name: r.name ?? query })} />
          ))}
          {exact ? null : <ResultRow label={`Add “${query.trim()}” as new`} onPress={() => add({ id: null, name: query.trim() })} />}
        </View>
      ) : (
        <View role="group" accessibilityLabel="Quick adds" style={styles.chips}>
          {quick.map((n) => (
            <WizardChip key={n} label={n} add kind="button" onPress={() => add(pickByName(n, ingredients))} />
          ))}
        </View>
      )}
    </View>
  );
}

function ResultRow({ label, onPress }: { label: string; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="button" onPress={onPress} accessibilityLabel={label} style={[styles.result, { borderBottomColor: ds.c.line }]}>
      <Body numberOfLines={1}>{label}</Body>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  field: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: space.lg },
  input: { flex: 1, minHeight: layout.minTapTarget },
  results: { borderRadius: radius.control, borderWidth: 1, overflow: 'hidden' },
  result: { minHeight: layout.minTapTarget + 4, justifyContent: 'center', paddingHorizontal: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
