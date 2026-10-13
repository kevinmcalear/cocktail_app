import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';

import { BackbarTheme, Body, Button, Caption, dragDismissesKeyboard, GlassButton, PressableScale, Segmented, Title, useDs, useGutter } from '@/components/ds';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useMode } from '@/hooks/useMode';
import { useCoreIngredients, useIngredientNames, usePairings, type PairEra } from '@/hooks/usePairings';
import { useTrackRecent } from '@/hooks/useTrackRecent';
import { guessUnit, newLine } from '@/lib/drinkWizard';
import { addPick, groupByRing, MAP_SIZE } from '@/lib/flavorMap';
import { searchIngredients } from '@/lib/ingredientNames';
import { siteOrigin } from '@/lib/venueLink';
import { getPreferredUnit } from '@/store/useSettingsStore';
import { useDrinkWizardStore, wizardPlace } from '@/store/useDrinkWizardStore';

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
  const opened = (params.with ?? '').split(',').filter(Boolean).slice(0, 3);
  const [picked, setPicked] = useState<string[]>(opened);
  const [query, setQuery] = useState('');
  const [era, setEra] = useState<PairEra>('now');
  // Names come from what was tapped, so only the ids the page opened with need asking for.
  const [named, setNamed] = useState<Record<string, string>>({});
  const { data: openedNames = [] } = useIngredientNames(opened);
  const { data: core = [] } = useCoreIngredients();
  const nameOf = (id: string) => named[id] ?? openedNames.find((i) => i.id === id)?.name ?? '…';
  const { data: pairs = [], isLoading } = usePairings(picked, { limit: MAP_SIZE, era });
  const results = searchIngredients(query, core, { limit: 6 });
  const pickedNames = picked.map(nameOf);
  const pick = (next: string[], id: string, name: string) => {
    setNamed((n) => ({ ...n, [id]: name }));
    setPicked(next);
  };
  const addPair = (p: { id: string; name: string }) => pick(addPick(picked, p.id), p.id, p.name);
  // In venue mode a drink started here is the venue's (prep-flavor-map).
  const { active } = useActiveVenue();
  const venue = useMode().mode === 'home' ? null : active;
  const href = `/flavor-map?with=${picked.join(',')}`;
  const allNamed = picked.length > 0 && pickedNames.every((n) => n !== '…');
  const title = `What goes with ${pickedNames.join(' and ')}`;
  useTrackRecent(allNamed, allNamed ? { kind: 'flavor', id: picked.join(','), title, subtitle: 'Flavor map', href } : null);
  const share = () => void Share.share(Platform.OS === 'ios' ? { message: title, url: `${siteOrigin()}${href}` } : { message: `${title}: ${siteOrigin()}${href}` });

  const start = () => {
    const place = wizardPlace(venue?.id ?? null);
    const { kept, patch } = useDrinkWizardStore.getState();
    const lines = kept[place]?.draft.lines ?? [];
    const fresh = picked.filter((id) => !lines.some((l) => l.id === id));
    patch(place, { lines: [...lines, ...fresh.map((id) => newLine({ id, name: nameOf(id) }, guessUnit(nameOf(id), getPreferredUnit())))] });
    router.push((venue ? `/add-cocktail?barId=${venue.id}` : '/add-cocktail') as never);
  };

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView
        {...dragDismissesKeyboard}
        contentContainerStyle={[
          styles.page,
          { paddingTop: insets.top + layout.minTapTarget + space.lg, paddingBottom: insets.bottom + space.xxxl + (picked.length ? layout.minTapTarget + space.xl : 0), paddingHorizontal: gutter },
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
          variant="pill"
          stretch
        />

        <View style={[styles.field, { backgroundColor: ds.c.surface, borderColor: ds.c.lineStrong }]}>
          <IconSymbol name="magnifyingglass" size={16} color={ds.c.muted} />
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
                  pick([r.id], r.id, r.name);
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
            {/* Picked, in the accent (board prep-flavor-map). */}
            {picked.map((id) => (
              <PressableScale
                key={id}
                role="button"
                accessibilityLabel={picked.length > 1 ? `Remove ${nameOf(id)}` : nameOf(id)}
                onPress={() => picked.length > 1 && setPicked(picked.filter((p) => p !== id))}
                style={[styles.picked, { backgroundColor: ds.accentFill.fill }]}
              >
                <Body color={ds.accentFill.text} style={styles.pickedName}>
                  {nameOf(id)}
                </Body>
                {picked.length > 1 ? <IconSymbol name="xmark" size={12} color={ds.accentFill.text} /> : null}
              </PressableScale>
            ))}
          </View>
        ) : null}

        {picked.length ? (
          <>
            <View style={[styles.panel, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
              <RingMap
                pairs={pairs}
                centre={picked.length > 1 ? [`${picked.length} picked`] : pickedNames}
                onPick={(id) => {
                  const p = pairs.find((x) => x.id === id);
                  if (p) addPair(p);
                }}
              />
            </View>
            <Caption tone="muted">Tap anything to add it. Closer rings go together more often.</Caption>
          </>
        ) : null}

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
                    onPress={() => addPair(p)}
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

      </ScrollView>
      {picked.length ? (
        <View style={[styles.pinned, { paddingBottom: insets.bottom + space.md, paddingHorizontal: gutter, backgroundColor: ds.c.ground, borderTopColor: ds.c.line }]}>
          <Button label={venue ? `Start a ${venue.name} drink with these` : 'Start a drink with these'} icon="plus" size="lg" onPress={start} style={styles.pinnedButton} />
        </View>
      ) : null}
      <View style={[styles.back, { top: insets.top + space.sm, left: gutter, right: gutter }]}>
        <GlassButton
          accessibilityLabel={Platform.OS === 'web' ? 'Back' : 'Close'}
          icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
        {picked.length ? <GlassButton accessibilityLabel="Share this flavor map" icon="square.and.arrow.up" label="Share" onPress={share} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: space.lg },
  header: { gap: space.sm },
  field: { minHeight: 52, borderRadius: radius.control, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  input: { flex: 1, minHeight: layout.minTapTarget },
  picked: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.minTapTarget - space.xs, paddingHorizontal: space.md, borderRadius: radius.pill },
  pickedName: { fontFamily: fontFamilies.bodyMedium },
  panel: { borderRadius: radius.card, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth, paddingVertical: space.md, overflow: 'hidden' },
  results: { borderRadius: radius.control, borderWidth: 1, overflow: 'hidden' },
  result: { minHeight: layout.minTapTarget + 4, justifyContent: 'center', paddingHorizontal: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  ring: { paddingTop: space.md },
  ringLabel: { fontFamily: fontFamilies.mono, letterSpacing: 1.2, paddingBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget, borderTopWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1 },
  count: { fontFamily: fontFamilies.monoMedium, fontVariant: ['tabular-nums'] },
  back: { position: 'absolute', flexDirection: 'row', justifyContent: 'space-between' },
  pinned: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  pinnedButton: { width: '100%', maxWidth: 760, alignSelf: 'center' },
});
