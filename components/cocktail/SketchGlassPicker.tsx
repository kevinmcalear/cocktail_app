import { StyleSheet, View } from 'react-native';

import { Button, Caption, GlassVariantPicker } from '@/components/ds';
import { space } from '@/constants/tokens';
import { barGlassFor, useBarGlassware } from '@/hooks/useBarGlassware';
import { useItemSketch } from '@/hooks/useItemSketch';
import { variantsOf } from '@/lib/sketch/geometry';
import { glassFromName } from '@/supabase/functions/_shared/sketch';

interface SketchGlassPickerProps {
  itemId: string;
  /** The drink's bar: its glass of this type is marked. */
  barId: string | null;
  /** The glassware chosen in the editor, which may not be saved (or drawn) yet. */
  glasswareName: string | null;
  /** The drink's own pick; null follows its bar's glassware. */
  value: string | null;
  onChange: (variant: string | null) => void;
}

/**
 * "Glass drawing" in the drink editor: which drawing of its glass the sketch
 * uses when the drink has no photo. Shown once the drink has been drawn, for
 * glasses with more than one drawing.
 */
export function SketchGlassPicker({ itemId, barId, glasswareName, value, onChange }: SketchGlassPickerProps) {
  const sketch = useItemSketch(itemId).data ?? null;
  const barGlasses = useBarGlassware(barId).data;
  const glass = glassFromName(glasswareName) ?? sketch?.glass ?? null;
  if (!sketch || !glass || variantsOf(glass).length < 2) return null;
  // The drink's own pick for this glass, else what it's drawn in now (its bar's glass).
  const own = value?.startsWith(`${glass}_`) ? value : null;
  const shown = own ?? (sketch.glass === glass ? sketch.variant : null);
  const barGlass = barGlassFor(barGlasses, glass);
  const notes = barGlass ? { [barGlass.variant ?? variantsOf(glass)[0].key]: "The bar's glass" } : undefined;
  return (
    <View style={styles.section}>
      <Caption tone="muted" style={styles.title}>GLASS DRAWING</Caption>
      <Caption tone="muted">How the glass is drawn while the drink has no photo.</Caption>
      <GlassVariantPicker glass={glass} inputs={sketch} seed={itemId} value={shown} onChange={onChange} notes={notes} accessibilityLabel="Glass drawing" />
      {own ? <Button label="Use the bar's glass" variant="ghost" onPress={() => onChange(null)} style={styles.reset} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm, paddingTop: space.lg },
  title: { letterSpacing: 1.2 },
  reset: { alignSelf: 'flex-start' },
});
