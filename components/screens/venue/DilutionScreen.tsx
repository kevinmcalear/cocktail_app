import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Button, Caption, Field, GlassButton, Title, useDs, useGutter } from '@/components/ds';
import { WebHead } from '@/components/WebHead';
import { layout, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useDilutionDefaults, useSetDilutionDefaults } from '@/hooks/useDrinkMath';
import { useEffectiveRole } from '@/hooks/useViewAs';
import { DEFAULT_DILUTION, type DilutionDefaults } from '@/lib/drinkMath';

/** bars_update needs an Admin (level 40). */
const ADMIN = 40;

const METHODS = [
  { key: 'stirred', label: 'Stirred', hint: 'Stirred over ice, or bottled and poured from the freezer.' },
  { key: 'shaken', label: 'Shaken', hint: 'Shaken hard with ice.' },
  { key: 'built', label: 'Built', hint: 'Built in the glass over ice.' },
] as const;

/**
 * The venue's house dilution by method, in percent of the undiluted drink.
 * Every drink's serve size and serve ABV follow from these unless the drink
 * has its own measured figure. Admins change them.
 */
export function DilutionScreen({ barId }: { barId: string }) {
  return (
    <BackbarTheme>
      <DilutionPage barId={barId} />
    </BackbarTheme>
  );
}

function DilutionPage({ barId }: { barId: string }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const venue = useActiveVenue().venues.find((v) => v.id === barId);
  const canEdit = useEffectiveRole(barId) >= ADMIN;
  const { data, isLoading, error } = useDilutionDefaults(barId);
  const save = useSetDilutionDefaults(barId);
  // What the person has typed; anything untouched shows the saved figure.
  const [draft, setDraft] = useState<Record<string, string>>({});
  const shown = (key: (typeof METHODS)[number]['key']) => draft[key] ?? (data?.[key] == null ? '' : String(data[key]));

  const parsed: DilutionDefaults = {};
  const problems: string[] = [];
  for (const m of METHODS) {
    const raw = shown(m.key).trim();
    if (!raw) continue;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 100) problems.push(m.key);
    else parsed[m.key] = n;
  }

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>Dilution</title>
      </WebHead>
      <View style={[styles.nav, { paddingTop: insets.top + space.sm, paddingHorizontal: gutter }]}>
        <GlassButton accessibilityLabel={Platform.OS === 'web' ? 'Back' : 'Close'} icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: gutter }} keyboardShouldPersistTaps="handled">
        <View style={styles.readable}>
          <Title>Dilution</Title>
          <Body tone="muted">
            How much water each method adds at {venue?.name ?? 'the venue'}, as a percent of the drink before ice. Serve size and serve ABV on every drink page follow
            from these. A drink with a measured figure of its own keeps it.
          </Body>
          {isLoading ? <Caption tone="muted">Loading…</Caption> : null}
          {error ? <Body tone="muted">Couldn’t load the settings. Check your connection and try again.</Body> : null}
          {METHODS.map((m) => (
            <Field
              key={m.key}
              label={`${m.label} (house rule ${DEFAULT_DILUTION[m.key]}%)`}
              value={shown(m.key)}
              onChangeText={(t) => setDraft((d) => ({ ...d, [m.key]: t }))}
              placeholder={String(DEFAULT_DILUTION[m.key])}
              keyboardType="decimal-pad"
              editable={canEdit}
              hint={m.hint}
              error={problems.includes(m.key) ? 'Enter a percent between 0 and 100.' : undefined}
            />
          ))}
          {canEdit ? (
            <Button
              label={save.isPending ? 'Saving…' : 'Save dilution'}
              disabled={save.isPending || problems.length > 0}
              onPress={() => save.mutate(parsed)}
              style={styles.save}
            />
          ) : (
            <Caption tone="muted">You can look, but changing these needs an Admin at this venue.</Caption>
          )}
          {save.error ? <Caption tone="accent">{"Couldn't save. Check your connection and try again."}</Caption> : null}
          {save.isSuccess ? <Caption tone="muted">Saved. Every drink at the venue is being recalculated.</Caption> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  nav: { flexDirection: 'row', paddingBottom: space.sm, minHeight: layout.minTapTarget },
  readable: { maxWidth: 560, width: '100%', gap: space.lg, paddingTop: space.md },
  save: { alignSelf: 'flex-start' },
});
