import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Button, Chip, IngredientThumb } from '@/components/ds';
import { space } from '@/constants/tokens';
import { PANTRY, PANTRY_WATER } from '@/lib/pantry';

import { SectionHead } from './BarSections';

interface PantrySectionProps {
  /** The staples the catalog has, by ingredient name (usePantryItems). */
  items: { name: string; id: string }[];
  /** Everything else in the fridge you've added (milk, pineapple), newest first. */
  extras: { name: string; id: string }[];
  onShelf: Set<string>;
  onAdd: (ids: string[]) => void;
  onRemove: (id: string) => void;
  /** Opens Add to your bar on the fridge. */
  onMore: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Fridge and pantry: lemons, sugar, eggs and the rest, so a sour isn't
 * blocked by a lemon, then anything else you keep. Each is a shelf row;
 * water comes with any of the staples.
 */
export function PantrySection({ items, extras, onShelf, onAdd, onRemove, onMore, style }: PantrySectionProps) {
  const ids = new Map(items.map((i) => [i.name, i.id]));
  const water = ids.get(PANTRY_WATER);
  const staples = PANTRY.flatMap((p) => {
    const id = ids.get(p.name);
    return id ? [{ ...p, id }] : [];
  });
  const withWater = (more: string[]) => (water && !onShelf.has(water) ? [...more, water] : more);
  const missing = staples.filter((s) => !onShelf.has(s.id)).map((s) => s.id);
  const count = staples.length - missing.length + extras.length;

  return (
    <View style={[styles.section, style]}>
      <SectionHead section="fridge" count={count} />
      <View role="group" accessibilityLabel="Fridge and pantry" style={styles.chips}>
        {staples.map((s) => {
          const on = onShelf.has(s.id);
          return <Chip key={s.id} label={s.label} leading={<IngredientThumb id={s.id} name={s.name} size={32} />} multi quiet selected={on} onPress={() => (on ? onRemove(s.id) : onAdd(withWater([s.id])))} />;
        })}
        {extras.map((x) => (
          <Chip key={x.id} label={x.name} leading={<IngredientThumb id={x.id} name={x.name} size={32} />} multi quiet selected onPress={() => onRemove(x.id)} />
        ))}
        <Button label="Add" icon="plus" variant="secondary" onPress={onMore} />
      </View>
      {staples.length && missing.length === staples.length ? <Button label="I have all of these" variant="secondary" onPress={() => onAdd(withWater(missing))} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
