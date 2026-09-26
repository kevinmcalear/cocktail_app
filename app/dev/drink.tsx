import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Caption, PressableScale, useDs } from '@/components/ds';
import { BATCH_SAMPLES, batchSampleLines, type BatchSampleKey } from '@/components/ds/gallery/batchSamples';
import { SAMPLE_IMAGES, SAMPLE_LEVELS, sampleDrink } from '@/components/ds/gallery/drinkSample';
import { BatchScreen } from '@/components/screens/batch/BatchScreen';
import { DrinkScreen } from '@/components/screens/drink/DrinkScreen';
import { radius, space } from '@/constants/tokens';
import { useRedesign } from '@/lib/flags';
import { roleLabel, ROLE_LEVELS } from '@/lib/roles';

/**
 * The redesigned drink page with a sample Penicillin, masked as the server
 * would mask it for each role, and its Batch screen with a sample drink for
 * each batching rule (`?batch=martini` opens straight to it). Hidden, like
 * /dev/gallery.
 */
export default function DrinkPreview() {
  const redesign = useRedesign();
  const params = useLocalSearchParams<{ batch?: string }>();
  const [role, setRole] = useState(30);
  const [photo, setPhoto] = useState(true);
  const [batch, setBatch] = useState<BatchSampleKey | null>(params.batch && params.batch in BATCH_SAMPLES ? (params.batch as BatchSampleKey) : null);
  if (!__DEV__ && !redesign) return <Redirect href="/" />;
  if (batch) {
    return (
      <View style={styles.flex}>
        <Stack.Screen options={{ headerShown: false, title: 'Batch preview' }} />
        <View style={styles.flex}>
          <BatchScreen
            key={batch}
            name={BATCH_SAMPLES[batch].name}
            lines={batchSampleLines(batch, role)}
            methodNames={[...BATCH_SAMPLES[batch].methods]}
            lockedUntil={role >= SAMPLE_LEVELS.measurement ? null : roleLabel(SAMPLE_LEVELS.measurement)}
            initialServes={batch === 'martini' ? 24 : 8}
            onClose={() => setBatch(null)}
          />
        </View>
        <BackbarTheme>
          <RoleBar role={role} setRole={setRole} docked>
            {(Object.keys(BATCH_SAMPLES) as BatchSampleKey[]).map((k) => chip(BATCH_SAMPLES[k].name, k === batch, () => setBatch(k)))}
          </RoleBar>
        </BackbarTheme>
      </View>
    );
  }
  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ headerShown: false, title: 'Drink page preview' }} />
      <DrinkScreen
        item={sampleDrink(role)}
        isFavorite={false}
        onToggleFavorite={() => {}}
        inStudyPile={false}
        onToggleStudyPile={() => {}}
        canEdit={false}
        onEdit={() => {}}
        preview={{ heroSource: photo ? SAMPLE_IMAGES.photo : null, role, levels: SAMPLE_LEVELS, onBatch: () => setBatch('penicillin') }}
      />
      <BackbarTheme>
        <RoleBar role={role} setRole={setRole}>
          {chip(photo ? 'Photo' : 'No photo', photo, () => setPhoto(!photo))}
        </RoleBar>
      </BackbarTheme>
    </View>
  );
}

function chip(label: string, selected: boolean, onPress: () => void) {
  return <Chip key={label} label={label} selected={selected} onPress={onPress} />;
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="radio" aria-selected={selected} accessibilityLabel={label} onPress={onPress} style={[styles.chip, { backgroundColor: selected ? ds.c.ink : ds.c.raised }]}>
      <Caption color={selected ? ds.c.ground : ds.c.ink}>{label}</Caption>
    </PressableScale>
  );
}

/** View-as roles, plus the page's own chips. Docked sits below the screen instead of over it. */
function RoleBar({ role, setRole, docked, children }: { role: number; setRole: (r: number) => void; docked?: boolean; children: ReactNode }) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  return (
    <View style={[docked ? null : styles.floating, styles.bar, { paddingBottom: insets.bottom + space.sm, backgroundColor: ds.c.surface, borderTopColor: ds.c.line }]}>
      <View role="radiogroup" accessibilityLabel="View as" style={styles.row}>
        {ROLE_LEVELS.map((r) => chip(r.label, role === r.level, () => setRole(r.level)))}
      </View>
      <View style={styles.row}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  floating: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  bar: { padding: space.sm, gap: space.xs, borderTopWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  chip: { minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center' },
});
