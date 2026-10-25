import { StyleSheet, View } from 'react-native';

import { Caption, Chip, Field } from '@/components/ds';
import { space } from '@/constants/tokens';
import type { VenueIce } from '@/hooks/useVenueIce';
import { iceWay, type IceWayKey } from '@/lib/iceRecipes';
import { inTheGlass } from '@/lib/venueKit';

import { IceWaysList } from './IceWaysList';
import type { StartsFromPick } from './StartsFromSheet';

export interface IceMade {
  way: IceWayKey | null;
  from: StartsFromPick;
}

/** The ice a way can start from: blocks and slabs to cut, the ice in the glass to crush or stamp. */
export function startPicks(way: IceWayKey | null, others: readonly VenueIce[]): VenueIce[] {
  const from = way ? iceWay(way).from : null;
  return from === 'block' ? others.filter((r) => !inTheGlass(r)) : from === 'cubes' ? others.filter(inTheGlass) : [];
}

/** Whether a pick is still needed before the recipe can start. */
export function madeReady({ way, from }: IceMade, others: readonly VenueIce[]): boolean {
  if (!way) return false;
  if (iceWay(way).from === 'flavour') return !!from?.name.trim();
  return !startPicks(way, others).length || !!from;
}

/**
 * How do you make it? (Kit and ice, step 6): the ways, then which block, slab
 * or ice it starts from, or which flavour. The Add sheet asks it as question 3;
 * the recipe page asks it while an ice has no steps.
 */
export function IceMadeStep({ value, onChange, others }: { value: IceMade; onChange: (v: IceMade) => void; others: readonly VenueIce[] }) {
  const from = value.way ? iceWay(value.way).from : null;
  const picks = startPicks(value.way, others);
  const label = from === 'block' ? 'Which block or slab?' : 'Which ice?';
  return (
    <View style={styles.body}>
      <IceWaysList value={value.way} onChange={(way) => onChange({ way, from: null })} />
      {picks.length ? (
        <View style={styles.group}>
          <Caption tone="muted">{label}</Caption>
          <View role="radiogroup" accessibilityLabel={label} style={styles.chips}>
            {picks.map((r) => (
              <Chip key={r.id} label={r.name} selected={value.from?.id === r.id} onPress={() => onChange({ ...value, from: { id: r.id, name: r.name } })} />
            ))}
          </View>
        </View>
      ) : (from === 'block' || from === 'cubes') ? (
        <Caption tone="muted">{`Add the ${from === 'block' ? 'block or slab' : 'ice'} it starts from in Kit › Ice, then pick it under Starts from on its recipe.`}</Caption>
      ) : null}
      {from === 'flavour' ? <Field label="Which flavour?" value={value.from?.name ?? ''} onChangeText={(name) => onChange({ ...value, from: name.trim() ? { id: null, name } : null })} placeholder="Coffee, tea, a juice" maxLength={60} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg },
  group: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
