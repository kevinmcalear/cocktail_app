import { Redirect, Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Caption, PressableScale, useDs } from '@/components/ds';
import { SAMPLE_IMAGES, SAMPLE_LEVELS, sampleDrink } from '@/components/ds/gallery/drinkSample';
import { DrinkScreen } from '@/components/screens/drink/DrinkScreen';
import { radius, space } from '@/constants/tokens';
import { useRedesign } from '@/lib/flags';
import { ROLE_LEVELS } from '@/lib/roles';

/**
 * The redesigned drink page with a sample Penicillin, masked as the server
 * would mask it for each role. Hidden, like /dev/gallery.
 */
export default function DrinkPreview() {
  const redesign = useRedesign();
  const [role, setRole] = useState(30);
  const [photo, setPhoto] = useState(true);
  if (!__DEV__ && !redesign) return <Redirect href="/" />;
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
        preview={{ heroSource: photo ? SAMPLE_IMAGES.photo : null, role, levels: SAMPLE_LEVELS }}
      />
      <BackbarTheme>
        <RoleBar role={role} setRole={setRole} photo={photo} setPhoto={setPhoto} />
      </BackbarTheme>
    </View>
  );
}

function RoleBar({ role, setRole, photo, setPhoto }: { role: number; setRole: (r: number) => void; photo: boolean; setPhoto: (p: boolean) => void }) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const chip = (label: string, selected: boolean, onPress: () => void) => (
    <PressableScale key={label} role="radio" aria-selected={selected} accessibilityLabel={label} onPress={onPress} style={[styles.chip, { backgroundColor: selected ? ds.c.ink : ds.c.raised }]}>
      <Caption color={selected ? ds.c.ground : ds.c.ink}>{label}</Caption>
    </PressableScale>
  );
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + space.sm, backgroundColor: ds.c.surface, borderTopColor: ds.c.line }]}>
      <View role="radiogroup" accessibilityLabel="View as" style={styles.row}>
        {ROLE_LEVELS.map((r) => chip(r.label, role === r.level, () => setRole(r.level)))}
      </View>
      <View style={styles.row}>{chip(photo ? 'Photo' : 'No photo', photo, () => setPhoto(!photo))}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.sm, gap: space.xs, borderTopWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  chip: { minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center' },
});
