import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/ds';
import { space } from '@/constants/tokens';
import { NOTE_KINDS, noteKind, noteWord } from '@/lib/flavor';
import { SPIRITS, STYLES } from '@/lib/drinkStyles';

import { ChipRow } from './DiscoverArea';

const NOTES = NOTE_KINDS.map((d) => ({ id: noteKind(d), label: noteWord(d) }));

function chipButtons(kind: string | null, onChange: (kind: string | null) => void, items: readonly { id: string; label: string }[]) {
  const toggle = (id: string) => onChange(kind === id ? null : id);
  return items.map((s) => <Chip key={s.id} quiet label={s.label} selected={kind === s.id} onPress={() => toggle(s.id)} />);
}

/** Drink families (Martinis, Sours). Sits above where, spirit, and tasting notes. */
export function DiscoverDrinkFilters({ kind, onChange }: { kind: string | null; onChange: (kind: string | null) => void }) {
  const chips = chipButtons(kind, onChange, STYLES);
  return (
    <ChipRow label="Drinks" title="Drinks">
      {chips}
    </ChipRow>
  );
}

/**
 * Spirit (Gin) or a tasting note (Smoky). One kind at a time, shared with
 * the Drinks row; tapping the chosen one again clears it.
 */
export function DiscoverKinds({ kind, onChange }: { kind: string | null; onChange: (kind: string | null) => void }) {
  return (
    <View style={styles.rows}>
      <ChipRow label="By spirit" title="By spirit">
        {chipButtons(kind, onChange, SPIRITS)}
      </ChipRow>
      <ChipRow label="By tasting notes" title="By tasting notes">
        {chipButtons(kind, onChange, NOTES)}
      </ChipRow>
    </View>
  );
}

const styles = StyleSheet.create({
  rows: { gap: space.lg },
});
