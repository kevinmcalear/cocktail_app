import { StyleSheet, View } from 'react-native';

import { Button, IngredientDrawing, Tag, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';
import type { ItemPrep } from '@/hooks/usePrepCard';
import { formatQuantity, toQuantity } from '@/lib/quantity';
import { leadTimeLabel, shelfLifeLabel } from '@/lib/scale';

import { DrinkHero } from '../drink/DrinkHero';
import type { Fact } from '../drink/DrinkFacts';
import type { ShownPicture } from '../drink/PictureViewer';

/**
 * The top of an ingredient page: its drawing on sketch paper, or for a batch,
 * the photos of the drink it makes.
 */
export function IngredientHero({ id, name, pictures, height, fade }: { id: string; name: string; pictures: ShownPicture[]; height: number; fade: boolean }) {
  const ds = useDs();
  if (pictures.length) return <DrinkHero name={name} pictures={pictures} glass={null} itemId={null} height={height} fade={fade} />;
  // The drawing is square; on a phone it sits low, clear of the controls, with the page pulled up over its foot.
  const size = Math.min(height - (fade ? space.xxl : 0) - space.xxxl, 360);
  return (
    <View style={[styles.hero, { height, backgroundColor: ds.c.paper, paddingBottom: fade ? space.xxl : space.xl }]} accessibilityLabel={`Drawing of ${name}`}>
      <View style={{ width: size, height: size }}>
        <IngredientDrawing id={id} name={name} />
      </View>
    </View>
  );
}

/** House prep, how it's made, and whose recipe it is; or for a bottle, its role. */
export function IngredientTags({ isPrep, actions, venueName, shared, role }: { isPrep: boolean; actions: string[]; venueName: string | null; shared: boolean; role: string | null }) {
  const tags: { label: string; accent?: boolean }[] = isPrep
    ? [{ label: 'House prep', accent: true }, ...actions.map((a) => ({ label: a })), ...(shared ? [{ label: 'Shared recipe' }] : venueName ? [{ label: venueName }] : [])]
    : [role === 'product' ? 'Bottle' : role === 'generic' ? 'Style' : null, venueName].filter((t): t is string => !!t).map((label) => ({ label }));
  if (!tags.length) return null;
  return (
    <View style={styles.tags}>
      {tags.map((t) => (
        <Tag key={t.label} label={t.label} tone={t.accent ? 'accent' : 'default'} />
      ))}
    </View>
  );
}

/** Makes, keeps, store, takes: what you check before you start a batch. */
export function prepFacts(prep: ItemPrep | null | undefined): Fact[] {
  if (!prep) return [];
  const y = toQuantity(prep.yield_amount, prep.yield_unit);
  return [
    y && { label: 'Makes', value: formatQuantity(y) },
    shelfLifeLabel(prep.shelf_life_hours) && { label: 'Keeps', value: shelfLifeLabel(prep.shelf_life_hours)! },
    prep.storage && { label: 'Store', value: prep.storage },
    leadTimeLabel(prep.lead_time_minutes, prep.lead_time_note) && { label: 'Takes', value: leadTimeLabel(prep.lead_time_minutes, prep.lead_time_note)! },
  ].filter((f): f is Fact => !!f);
}

/** Pinned under a phone page: Make, and a jump to the drinks it goes in. */
export function MakeBar({ bottom, onMake, drinks, onDrinks }: { bottom: number; onMake: () => void; drinks: number; onDrinks: () => void }) {
  const ds = useDs();
  return (
    <View style={[styles.bar, { paddingBottom: bottom + space.md, backgroundColor: ds.c.ground, borderTopColor: ds.c.line }]}>
      <Button label="Make" icon="flask" size="lg" onPress={onMake} style={styles.make} />
      {drinks ? <Button label={`In ${drinks} ${drinks === 1 ? 'drink' : 'drinks'}`} variant="secondary" size="lg" onPress={onDrinks} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  make: { flex: 1 },
});
