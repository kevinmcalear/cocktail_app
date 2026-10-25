import { StyleSheet, View } from 'react-native';

import { Button, Caption, Chip, Field } from '@/components/ds';
import { GlassModelCard } from '@/components/glass/GlassModelCard';
import { GlassModelPicker } from '@/components/glass/GlassModelPicker';
import { GlassSnap } from '@/components/glass/GlassSnap';
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
 * glass from the catalog (maker, name or code), or Snap the glass for the
 * three closest to a photo. Not there? Draw my glass from a photo of it
 * (components/screens/kit/draw), or Name your own: its shape and its name,
 * drawn as that shape.
 */
export function GlassWhich({ value, onChange, venueModelIds, venueName, shape, onDraw, keepShape }: { value: GlassWhichValue; onChange: (v: GlassWhichValue) => void; venueModelIds?: readonly string[]; venueName?: string; /** The search starts on this shape (a drink named it). */ shape?: SketchGlass | null; /** Draw my glass, beside Name your own, where the sheet can keep a photo. */ onDraw?: () => void; /** The glass already has a job (the venue's Coupe, or the glass a drink named): a real glass picked for it keeps that type, whatever the catalog files it under. */ keepShape?: boolean }) {
  const set = (patch: Partial<GlassWhichValue>) => onChange({ ...value, ...patch });
  const pick = (m: GlassModel) => {
    // A Savage Pony picked for the venue's Coupe stays its Coupe (and its drawing, for a glass not traced yet):
    // its coupe drinks are drawn in the Pony's own outline.
    const glass = keepShape ? value.glass : m.glass;
    onChange({ ...value, mode: 'picked', model: m, glass, variant: glass === m.glass ? m.variant : value.variant });
  };

  if (value.mode === 'find') {
    return (
      <View style={styles.stack}>
        <GlassSnap onPick={pick} />
        <GlassModelPicker
          venueModelIds={venueModelIds}
          venueName={venueName}
          initialGlass={shape ?? null}
          onPick={pick}
          onDescribe={() => set({ mode: 'own', model: null })}
          describeLabel="Not there? Name your own"
          onDraw={onDraw}
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
        <GlassModelCard model={value.model} variant={value.glass === value.model.glass ? value.variant : null} />
        {value.glass !== value.model.glass ? <Caption tone="muted">{`Your ${GLASS_TYPE_LABEL[value.glass]} drinks are drawn in it.`}</Caption> : null}
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
