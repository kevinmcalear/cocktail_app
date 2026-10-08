import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Button, Caption, GlassButton, PressableScale, Segmented, Title, useDs, useGutter } from '@/components/ds';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import { useDropdowns } from '@/hooks/useDropdowns';
import { usePairings, type PairEra } from '@/hooks/usePairings';
import { guessUnit, newLine } from '@/lib/drinkWizard';
import { addPick, groupByRing, MAP_SIZE } from '@/lib/flavorMap';
import { searchIngredients } from '@/lib/ingredientNames';
import { getPreferredUnit } from '@/store/useSettingsStore';
import { useDrinkWizardStore, wizardPlace } from '@/store/useDrinkWizardStore';

import { PairChip } from '../pairings/PairChip';
import { RingMap } from './RingMap';

/** What goes with what: pick an ingredient, tap a partner to bounce to what goes with both. */
export function FlavorMapScreen() {
  return (
    <BackbarTheme>
      <FlavorMapPage />
    </BackbarTheme>
  );
}

function FlavorMapPage() {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const params = useLocalSearchParams<{ with?: string }>();
  const [picked, setPicked] = useState<string[]>(() => (params.with ?? '').split(',').filter(Boolean).slice(0, 3));
  const [query, setQuery] = useState('');
  const [era, setEra] = useState<PairEra>('now');
  const { data: dropdowns } = useDropdowns();
  const ingredients = dropdowns?.ingredients ?? [];
  const coreIds = new Set(dropdowns?.coreIngredientIds ?? []);
  const nameOf = (id: string) => ingredients.find((i) => i.id === id)?.name ?? '…';
  const { data: pairs = [], isLoading } = usePairings(picked, { limit: MAP_SIZE, era });
  const results = searchIngredients(
    query,
    ingredients.filter((i) => coreIds.size === 0 || coreIds.has(i.id)),
    { coreIds, limit: 6 }
  );
  const pickedNames = picked.map(nameOf);

  const start = () => {
    // ponytail: a drink started here is added at home; venue mode starts from Library.
    const place = wizardPlace(null);
    const { kept, patch } = useDrinkWizardStore.getState();
    const lines = kept[place]?.draft.lines ?? [];
    const fresh = picked.filter((id) => !lines.some((l) => l.id === id));
    patch(place, { lines: [...lines, ...fresh.map((id) => newLine({ id, name: nameOf(id) }, guessUnit(nameOf(id), getPreferredUnit())))] });
    router.push('/add-cocktail');
  };

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.page,
          { paddingTop: insets.top + layout.minTapTarget + space.lg, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: gutter },
        ]}
      >
        <View style={styles.header}>
          <Title>Flavor map</Title>
          <Body tone="muted">
            {era === 'books'
              ? "What the old cocktail books put together, from the recipes we've read so far. Tap anything to add it; the rings redraw to what goes with all of them."
              : 'What bartenders put together, counted from drinks in the app. Tap anything to add it; the rings redraw to what goes with all of them.'}
          </Body>
        </View>

        <Segmented
          accessibilityLabel="Whose drinks"
          options={[
            { value: 'now', label: 'Bars today' },
            { value: 'books', label: 'The old books' },
          ]}
          value={era}
          onChange={setEra}
        />

        <View style={[styles.field, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={picked.length ? 'Start again from…' : 'Start from an ingredient'}
            placeholderTextColor={ds.c.muted}
            aria-label="Start from an ingredient"
            autoCorrect={false}
            style={[styles.input, type.body, { fontFamily: fontFamilies.body, color: ds.c.ink }]}
          />
        </View>
        {query.trim() ? (
          <View role="list" style={[styles.results, { borderColor: ds.c.line }]}>
            {results.map((r) => (
              <PressableScale
                key={r.id}
                role="button"
                accessibilityLabel={`Start from ${r.name}`}
                onPress={() => {
                  setPicked([r.id]);
                  setQuery('');
                }}
                style={[styles.result, { borderBottomColor: ds.c.line }]}
              >
                <Body numberOfLines={1}>{r.name}</Body>
              </PressableScale>
            ))}
          </View>
        ) : null}

        {picked.length ? (
          <View role="group" aria-label="Picked" style={styles.chips}>
            {picked.map((id) => (
              <PairChip
                key={id}
                label={nameOf(id)}
                count={picked.length > 1 ? '×' : null}
                selected
                onPress={() => picked.length > 1 && setPicked(picked.filter((p) => p !== id))}
                accessibilityLabel={picked.length > 1 ? `Remove ${nameOf(id)}` : nameOf(id)}
              />
            ))}
          </View>
        ) : null}

        {picked.length ? <RingMap pairs={pairs} centre={pickedNames} onPick={(id) => setPicked(addPick(picked, id))} /> : null}

        {picked.length && !isLoading && !pairs.length ? (
          <Body tone="muted">
            {picked.length > 1
              ? 'Nothing pairs with all of these yet. Drop one to see more.'
              : era === 'books'
                ? "The old books we've read so far don't use this enough to say."
                : 'Not enough drinks use this yet to say what it pairs with.'}
          </Body>
        ) : null}

        <View role="list" aria-label="What pairs">
          {groupByRing(pairs).map(({ ring, items }) => {
            return (
              <View key={ring.label} style={styles.ring}>
                <Caption tone="muted" style={styles.ringLabel}>
                  {ring.label.toUpperCase()}
                </Caption>
                {items.map((p) => (
                  <PressableScale
                    key={p.id}
                    role="button"
                    accessibilityLabel={`Add ${p.name}. Together in ${p.together.join(' and ')} drinks`}
                    onPress={() => setPicked(addPick(picked, p.id))}
                    style={[styles.row, { borderTopColor: ds.c.line }]}
                  >
                    <Body style={styles.flex}>{p.name}</Body>
                    <Caption tone="muted" style={styles.count}>{`${p.together.join(' · ')} drinks`}</Caption>
                  </PressableScale>
                ))}
              </View>
            );
          })}
        </View>

        {picked.length ? <Button label="Start a drink with these" icon="plus" onPress={start} /> : null}
      </ScrollView>
      <View style={[styles.back, { top: insets.top + space.sm, left: gutter }]}>
        <GlassButton
          accessibilityLabel={Platform.OS === 'web' ? 'Back' : 'Close'}
          icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: space.lg },
  header: { gap: space.sm },
  field: { minHeight: 52, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: space.lg, justifyContent: 'center' },
  input: { minHeight: layout.minTapTarget },
  results: { borderRadius: radius.control, borderWidth: 1, overflow: 'hidden' },
  result: { minHeight: layout.minTapTarget + 4, justifyContent: 'center', paddingHorizontal: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  ring: { paddingTop: space.md },
  ringLabel: { letterSpacing: 1, paddingBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget, borderTopWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1 },
  count: { fontFamily: fontFamilies.monoMedium, fontVariant: ['tabular-nums'] },
  back: { position: 'absolute' },
});
