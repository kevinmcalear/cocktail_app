import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Button, IngredientDrawing } from '@/components/ds';
import { space } from '@/constants/tokens';
import type { ShelfItem } from '@/hooks/useHomeBar';
import { SECTIONS } from '@/lib/barSections';
import { PANTRY, PANTRY_WATER } from '@/lib/pantry';

import { SectionActions, SectionHead, ShelfTile } from './BarSections';
import { AddTile, BarTile, TileGrid } from './BarTile';

interface PantrySectionProps {
  /** The staples the catalog has, by ingredient name (usePantryItems). */
  items: { name: string; id: string }[];
  /** Everything else in the fridge you've added (milk, pineapple), newest first. */
  extras: ShelfItem[];
  /** The whole shelf, for how many drinks each staple goes into. */
  shelf: ShelfItem[];
  onShelf: Set<string>;
  cols: number;
  editing: boolean;
  onEdit: (on: boolean) => void;
  onAdd: (ids: string[]) => void;
  onRemove: (id: string) => void;
  /** Opens Add to your bar on the fridge. */
  onMore: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Fridge and pantry: lemons, sugar, eggs and the rest, so a sour isn't
 * blocked by a lemon, then anything else you keep. The staples you don't
 * have wait as faded tiles to tap in; water comes with any of them.
 */
export function PantrySection({ items, extras, shelf, onShelf, cols, editing, onEdit, onAdd, onRemove, onMore, style }: PantrySectionProps) {
  const ids = new Map(items.map((i) => [i.name, i.id]));
  const water = ids.get(PANTRY_WATER);
  const staples = PANTRY.flatMap((p) => {
    const id = ids.get(p.name);
    return id ? [{ ...p, id }] : [];
  });
  const byId = new Map(shelf.map((s) => [s.id, s]));
  const withWater = (more: string[]) => (water && !onShelf.has(water) ? [...more, water] : more);
  const have = staples.filter((s) => onShelf.has(s.id));
  const missing = staples.filter((s) => !onShelf.has(s.id));
  const count = have.length + extras.length;

  return (
    <View style={[styles.section, style]}>
      <SectionHead section="fridge" count={count}>
        <SectionActions section="fridge" editing={editing} onEdit={onEdit} canEdit={count > 0} />
      </SectionHead>
      <TileGrid cols={cols}>
        {editing ? null : <AddTile label={SECTIONS.fridge.add} onPress={onMore} />}
        {have.map((s) => {
          const item = byId.get(s.id);
          return item ? (
            <ShelfTile key={s.id} item={{ ...item, name: s.label }} editing={editing} onRemove={onRemove} onHold={() => onEdit(true)} />
          ) : (
            <BarTile key={s.id} name={s.label} picture={<IngredientDrawing id={s.id} name={s.name} />} role="button" accessibilityLabel={`Take ${s.label} off your bar`} badge={editing ? 'remove' : null} onPress={() => onRemove(s.id)} />
          );
        })}
        {extras.map((x) => (
          <ShelfTile key={x.id} item={x} editing={editing} onRemove={onRemove} onHold={() => onEdit(true)} />
        ))}
        {editing
          ? null
          : missing.map((s) => (
              <BarTile
                key={s.id}
                name={s.label}
                meta="Tap if you keep it"
                picture={<IngredientDrawing id={s.id} name={s.name} />}
                role="button"
                accessibilityLabel={`I keep ${s.label}`}
                ghost
                badge="plus"
                onPress={() => onAdd(withWater([s.id]))}
              />
            ))}
      </TileGrid>
      {!editing && staples.length && !have.length ? <Button label="I have all of these" variant="secondary" onPress={() => onAdd(withWater(missing.map((s) => s.id)))} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
});
