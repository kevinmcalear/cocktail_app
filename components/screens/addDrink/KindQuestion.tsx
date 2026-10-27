import { StyleSheet, View } from 'react-native';

import { Caption, Chip } from '@/components/ds';
import { space } from '@/constants/tokens';
import { GLASS_TYPE_LABEL, GLASS_TYPES, typedKind } from '@/lib/glassware';
import { ICE_SHAPE_LABEL } from '@/lib/venueKit';

export type KindOf = 'glass' | 'ice';

const ICE_CHOICES = ['cubes', 'large', 'spear', 'sphere', 'crushed', 'pebble', 'shaved'] as const;
const CHOICES: Record<KindOf, readonly { key: string; label: string }[]> = {
  glass: GLASS_TYPES.map((g) => ({ key: g, label: GLASS_TYPE_LABEL[g] })),
  ice: ICE_CHOICES.map((i) => ({ key: i, label: ICE_SHAPE_LABEL[i] })),
};
const LABEL: Record<KindOf, string> = { glass: 'What kind of glass is it?', ice: 'How does it look in the glass?' };

/** The kind a new name saves: the one tapped, else the guess from the name (`value` undefined). Null is Not sure. */
export const pickedKind = (of: KindOf, name: string, value: string | null | undefined) => (value === undefined ? typedKind(of, name) : value);

function caption(of: KindOf, name: string, picked: string | null, guess: string | null): string {
  if (!picked) return of === 'glass' ? 'Each drink in it is drawn from its own shape pick.' : 'The drawing guesses from the drink.';
  if (picked !== guess) return 'Every drink with it is drawn this way.';
  const a = /^[aeiou]/i.test(name) ? 'an' : 'a';
  return `Picked from the name. ${of === 'glass' ? `Every drink in ${a} ${name}` : 'Every drink with it'} is drawn this way.`;
}

/**
 * Naming a new glass or ice asks what kind it is (canvas board "Naming a new
 * glass or ice asks what kind it is", approved 26 Oct 2026): one row of
 * chips under the field, the guess from the name picked to start, and Not
 * sure. Saved with the new item (items.glass, items.ice_kind).
 */
export function KindQuestion({ of, name, value, onChange }: { of: KindOf; name: string; value: string | null | undefined; onChange: (kind: string | null) => void }) {
  const typed = name.trim();
  const guess = typedKind(of, typed);
  const picked = pickedKind(of, typed, value);
  return (
    <View style={styles.stack}>
      <Caption>{LABEL[of]}</Caption>
      <View role="radiogroup" aria-label={LABEL[of]} style={styles.chips}>
        {CHOICES[of].map((c) => (
          <Chip key={c.key} label={c.label} selected={picked === c.key} onPress={() => onChange(c.key)} />
        ))}
        <Chip label="Not sure" selected={!picked} onPress={() => onChange(null)} />
      </View>
      <Caption tone="muted">{caption(of, typed, picked, guess)}</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
