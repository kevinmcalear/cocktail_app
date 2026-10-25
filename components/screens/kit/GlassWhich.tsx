import { StyleSheet, View } from 'react-native';

import { Button, Chip, Field } from '@/components/ds';
import { GlassModelCard } from '@/components/glass/GlassModelCard';
import { GlassModelPicker } from '@/components/glass/GlassModelPicker';
import { space } from '@/constants/tokens';
import type { GlassModel } from '@/hooks/useGlassModels';
import { GLASS_TYPE_LABEL, GLASS_TYPES } from '@/lib/glassware';
import type { SketchGlass } from '@/lib/sketch/types';

import { KitChipGroup } from './KitAddSheet';

/** Which glass it is, as the sheet holds it: a real glass from the catalog, or one the bar names. */
export interface GlassWhichValue {
  mode: 'find' | 'picked' | 'own';
  model: GlassModel | null;
  glass: SketchGlass;
  variant: string | null;
  /** What the venue calls it; empty is the type ("Coupe"). */
  name: string;
}

/**
 * Question 1 of Add a glass (Kit and ice, step 3): its shape, then the real
 * glass from the catalog (maker, name or code). Not there? Name your own:
 * its shape and its name, drawn as that shape.
 */
export function GlassWhich({ value, onChange, venueModelIds, venueName, shape }: { value: GlassWhichValue; onChange: (v: GlassWhichValue) => void; venueModelIds?: readonly string[]; venueName?: string; /** The search starts on this shape (a drink named it). */ shape?: SketchGlass | null }) {
  const set = (patch: Partial<GlassWhichValue>) => onChange({ ...value, ...patch });

  if (value.mode === 'find') {
    return (
      <View style={styles.stack}>
        <GlassModelPicker
          venueModelIds={venueModelIds}
          venueName={venueName}
          initialGlass={shape ?? null}
          onPick={(m) => onChange({ ...value, mode: 'picked', model: m, glass: m.glass, variant: m.variant })}
          onDescribe={() => set({ mode: 'own', model: null })}
          describeLabel="Not there? Name your own"
        />
        {value.model ? <Button label="Keep the one I had" variant="ghost" onPress={() => set({ mode: 'picked' })} style={styles.start} /> : null}
      </View>
    );
  }

  const nameField = (
    <Field label="What you call it" value={value.name} onChangeText={(name) => set({ name })} placeholder={GLASS_TYPE_LABEL[value.glass]} maxLength={80} />
  );
  if (value.mode === 'picked' && value.model) {
    return (
      <View style={styles.stack}>
        <GlassModelCard model={value.model} variant={value.variant} />
        <Button label="Another glass" variant="secondary" onPress={() => set({ mode: 'find' })} style={styles.start} />
        {nameField}
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <KitChipGroup label="Its shape">
        {GLASS_TYPES.map((g) => (
          <Chip key={g} label={GLASS_TYPE_LABEL[g]} selected={g === value.glass} onPress={() => set({ glass: g, variant: null })} />
        ))}
      </KitChipGroup>
      {nameField}
      <Button label="Find it in the makers’ catalogs" variant="ghost" onPress={() => set({ mode: 'find' })} style={styles.start} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  start: { alignSelf: 'flex-start' },
});
