import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/ds';
import { space } from '@/constants/tokens';
import { SPIRITS, STYLES } from '@/lib/drinkStyles';

import { ChipRow } from './DiscoverArea';

/**
 * "What": a style (Martinis, Old Fashioneds, Sours) or a spirit (Gin,
 * Tequila & mezcal). One at a time; tapping the chosen one again clears it.
 */
export function DiscoverKinds({ kind, onChange }: { kind: string | null; onChange: (kind: string | null) => void }) {
  const toggle = (id: string) => onChange(kind === id ? null : id);
  return (
    <View style={styles.rows}>
      <ChipRow label="Style">
        {STYLES.map((s) => (
          <Chip key={s.id} label={s.label} selected={kind === s.id} onPress={() => toggle(s.id)} />
        ))}
      </ChipRow>
      <ChipRow label="Spirit">
        {SPIRITS.map((s) => (
          <Chip key={s.id} label={s.label} selected={kind === s.id} onPress={() => toggle(s.id)} />
        ))}
      </ChipRow>
    </View>
  );
}

const styles = StyleSheet.create({
  rows: { gap: space.sm },
});
