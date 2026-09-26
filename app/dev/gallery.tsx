import { Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, BrandProvider, Caption, PressableScale, Title, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { GallerySections } from '@/components/ds/gallery/GallerySections';
import { backbar, layout, radius, SAMPLE_BRANDS, space, type BackbarScheme } from '@/constants/tokens';
import { useFlagStore, useRedesign } from '@/lib/flags';

type BrandKey = 'none' | keyof typeof SAMPLE_BRANDS;
const BRAND_LABELS: Record<BrandKey, string> = { none: 'No venue', littleRye: 'Little Rye', paleMoth: 'Pale Moth' };

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale
      role="radio"
      aria-selected={selected}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.choice, { backgroundColor: selected ? ds.c.ink : ds.c.raised }]}
    >
      <Caption color={selected ? ds.c.ground : ds.c.ink}>{label}</Caption>
    </PressableScale>
  );
}

function Column({ scheme }: { scheme: BackbarScheme }) {
  return (
    <BackbarTheme scheme={scheme}>
      <ColumnBody />
    </BackbarTheme>
  );
}

function ColumnBody() {
  const ds = useDs();
  return (
    <View style={[styles.column, { backgroundColor: ds.c.ground }]}>
      <Caption tone="muted">{ds.scheme === 'dark' ? 'Service (dark)' : 'Prep (light)'}</Caption>
      <GallerySections />
    </View>
  );
}

/**
 * Every token and shared component, in both themes, for two sample venues.
 * Hidden: not linked from the app, but it opens in every build, because its
 * switch is how you turn the redesign preview on for yourself in production.
 * ponytail: anyone who finds /dev/gallery can preview unfinished screens (their
 * own view only; RLS still guards the data). Gate it on catalog admin once the
 * client can ask the server who that is.
 */
export default function Gallery() {
  const redesign = useRedesign();
  const setOverride = useFlagStore((s) => s.setRedesignOverride);
  const [brand, setBrand] = useState<BrandKey>('littleRye');
  const [scheme, setScheme] = useState<BackbarScheme>('dark');
  const wide = useBreakpoint() === 'desktop';
  const gutter = useGutter();
  const insets = useSafeAreaInsets();

  const sample = brand === 'none' ? undefined : SAMPLE_BRANDS[brand];
  return (
    <BackbarTheme scheme={scheme}>
      <Stack.Screen options={{ headerShown: false, title: 'Design gallery' }} />
      <BrandProvider accent={sample?.accent} displayFace={sample?.displayFace}>
        <Controls
          gutter={gutter}
          top={insets.top}
          wide={wide}
          brand={brand}
          setBrand={setBrand}
          scheme={scheme}
          setScheme={setScheme}
          redesign={redesign}
          setRedesign={(on) => setOverride(on)}
        />
        <ScrollView style={{ backgroundColor: backbar[scheme].ground }} contentContainerStyle={[styles.columns, { paddingHorizontal: wide ? gutter : 0, paddingBottom: insets.bottom + space.xxxl }]}>
          {wide ? (
            <>
              <Column scheme="dark" />
              <Column scheme="light" />
            </>
          ) : (
            <Column scheme={scheme} />
          )}
        </ScrollView>
      </BrandProvider>
    </BackbarTheme>
  );
}

interface ControlsProps {
  gutter: number;
  top: number;
  wide: boolean;
  brand: BrandKey;
  setBrand: (b: BrandKey) => void;
  scheme: BackbarScheme;
  setScheme: (s: BackbarScheme) => void;
  redesign: boolean;
  setRedesign: (on: boolean) => void;
}

function Controls({ gutter, top, wide, brand, setBrand, scheme, setScheme, redesign, setRedesign }: ControlsProps) {
  const ds = useDs();
  return (
    <View style={[styles.controls, { paddingTop: top + space.lg, paddingHorizontal: gutter, backgroundColor: ds.c.ground, borderBottomColor: ds.c.line }]}>
      <Title>Back Bar</Title>
      <Body tone="muted">Design gallery: tokens and shared components. See docs/design_system.md.</Body>
      <View style={styles.row} role="radiogroup" accessibilityLabel="Venue brand">
        {(Object.keys(BRAND_LABELS) as BrandKey[]).map((k) => (
          <Choice key={k} label={BRAND_LABELS[k]} selected={brand === k} onPress={() => setBrand(k)} />
        ))}
      </View>
      {wide ? null : (
        <View style={styles.row} role="radiogroup" accessibilityLabel="Theme">
          <Choice label="Service (dark)" selected={scheme === 'dark'} onPress={() => setScheme('dark')} />
          <Choice label="Prep (light)" selected={scheme === 'light'} onPress={() => setScheme('light')} />
        </View>
      )}
      <View style={styles.row} role="radiogroup" accessibilityLabel="Redesigned screens">
        <Choice label="Redesign on" selected={redesign} onPress={() => setRedesign(true)} />
        <Choice label="Redesign off" selected={!redesign} onPress={() => setRedesign(false)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  controls: { gap: space.sm, paddingBottom: space.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  choice: { minHeight: layout.minTapTarget - 8, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center' },
  columns: { flexDirection: 'row', gap: space.xl, alignItems: 'flex-start' },
  column: { flex: 1, padding: space.lg, borderRadius: radius.card },
});
