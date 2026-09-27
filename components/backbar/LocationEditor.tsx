import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Field } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useLocationMutations } from '@/hooks/useBackBar';
import { parsePar } from '@/lib/backBar';
import { confirmAsync } from '@/lib/dialogs';
import type { ItemLocation } from '@/types/backBar';

interface LocationEditorProps {
  barId: string;
  location: ItemLocation;
  /** Starts "tap a zone to move it there". */
  onMove: () => void;
  onDone: () => void;
}

const blankToNull = (s: string) => (s.trim() ? s.trim() : null);

/** Where exactly an item sits in its zone, what it's kept in, and how much should be there. */
export function LocationEditor({ barId, location, onMove, onDone }: LocationEditorProps) {
  const { updateLocation, removeLocation } = useLocationMutations(barId);
  const [shelf, setShelf] = useState(location.shelf ?? '');
  const [container, setContainer] = useState(location.container ?? '');
  const [parAmount, setParAmount] = useState(location.par_amount == null ? '' : String(location.par_amount));
  const [parUnit, setParUnit] = useState(location.par_unit ?? '');
  const name = location.item?.name ?? 'this item';

  const [tried, setTried] = useState(false);
  const par = parsePar(parAmount, parUnit);
  // Said once they try to save, not while they're still typing.
  const parError = tried ? par.error : undefined;

  const save = () => {
    setTried(true);
    if (par.error) return;
    updateLocation.mutate(
      { id: location.id, changes: { shelf: blankToNull(shelf), container: blankToNull(container), par_amount: par.amount, par_unit: par.unit } },
      { onSuccess: onDone }
    );
  };

  const remove = async () => {
    const ok = await confirmAsync({
      title: `Take ${name} off the map?`,
      message: 'It goes back to waiting for a spot if a current menu uses it.',
      confirmText: 'Remove',
      destructive: true,
    });
    if (ok) removeLocation.mutate(location.id, { onSuccess: onDone });
  };

  return (
    <View style={styles.wrap}>
      <Field label="Shelf" value={shelf} onChangeText={setShelf} placeholder="Top shelf · left" maxLength={60} />
      <Field label="Container" value={container} onChangeText={setContainer} placeholder="1 L squeeze bottle, blue tape" maxLength={200} />
      <View style={styles.par}>
        <View style={styles.parAmount}>
          <Field label="Par" value={parAmount} onChangeText={setParAmount} placeholder="2" keyboardType="decimal-pad" />
        </View>
        <View style={styles.parUnit}>
          <Field label="Unit" value={parUnit} onChangeText={setParUnit} placeholder="L" maxLength={20} />
        </View>
      </View>
      {parError ? <Caption tone="accent">{parError}</Caption> : null}
      <View style={styles.actions}>
        <Button label={updateLocation.isPending ? 'Saving…' : 'Save'} onPress={save} disabled={updateLocation.isPending} />
        <Button label="Move to another zone" variant="secondary" onPress={onMove} />
        <Button label="Remove" variant="ghost" onPress={() => void remove()} disabled={removeLocation.isPending} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md, paddingTop: space.md, paddingBottom: space.sm },
  par: { flexDirection: 'row', gap: space.md },
  parAmount: { flex: 1 },
  parUnit: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
