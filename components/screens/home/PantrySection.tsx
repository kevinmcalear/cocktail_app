import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Button, Caption, Chip, Headline } from '@/components/ds';
import { space } from '@/constants/tokens';
import { PANTRY, PANTRY_WATER } from '@/lib/pantry';

interface PantrySectionProps {
  /** The staples the catalog has, by ingredient name (usePantryItems). */
  items: { name: string; id: string }[];
  onShelf: Set<string>;
  onAdd: (ids: string[]) => void;
  onRemove: (id: string) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Fridge and pantry: lemons, sugar, eggs and the rest, so a sour isn't
 * blocked by a lemon. Each is a shelf row; water comes with any of them.
 */
export function PantrySection({ items, onShelf, onAdd, onRemove, style }: PantrySectionProps) {
  const ids = new Map(items.map((i) => [i.name, i.id]));
  const water = ids.get(PANTRY_WATER);
  const staples = PANTRY.flatMap((p) => {
    const id = ids.get(p.name);
    return id ? [{ ...p, id }] : [];
  });
  if (!staples.length) return null;
  const withWater = (more: string[]) => (water && !onShelf.has(water) ? [...more, water] : more);
  const missing = staples.filter((s) => !onShelf.has(s.id)).map((s) => s.id);

  return (
    <View style={[styles.section, style]}>
      <View style={styles.head}>
        <Headline role="heading">Fridge & pantry</Headline>
        <Caption tone="muted">Most drinks need a few of these. Tap what you keep.</Caption>
      </View>
      <View role="group" accessibilityLabel="Fridge and pantry" style={styles.chips}>
        {staples.map((s) => {
          const on = onShelf.has(s.id);
          return <Chip key={s.id} label={s.label} multi quiet selected={on} onPress={() => (on ? onRemove(s.id) : onAdd(withWater([s.id])))} />;
        })}
      </View>
      {missing.length === staples.length ? <Button label="I have all of these" variant="secondary" onPress={() => onAdd(withWater(missing))} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  head: { gap: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
