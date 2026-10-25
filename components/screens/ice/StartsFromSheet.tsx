import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Field, Headline, PressableScale, Sheet, SheetScrollView, useDs } from '@/components/ds';
import { IceThumb } from '@/components/ds/IceThumb';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import type { VenueIce } from '@/hooks/useVenueIce';
import { iceDrawKind, kitSourceLine } from '@/lib/venueKit';

/** What an ice starts from as the editor holds it: an item, a flavour typed by name (found at save), or null for water. */
export type StartsFromPick = { id: string | null; name: string } | null;

/**
 * Starts from (Kit and ice, step 7): another of the venue's ice (a block, a
 * slab, its cubes), a flavour, or just water. A new block or slab is added in
 * Kit › Ice first.
 */
export function StartsFromSheet({ ices, value, onPick, onClose }: { ices: readonly VenueIce[]; value: StartsFromPick; onPick: (v: StartsFromPick) => void; onClose: () => void }) {
  const ds = useDs();
  const [flavour, setFlavour] = useState(value && !value.id ? value.name : '');
  const row = (key: string, label: string, line: string | null, on: boolean, pick: () => void, thumb: ReactNode) => (
    <PressableScale key={key} role="radio" aria-checked={on} accessibilityLabel={line ? `${label}. ${line}` : label} onPress={pick} style={[styles.row, { borderBottomColor: ds.c.line }]}>
      {thumb}
      <View style={styles.flex}>
        <Body numberOfLines={1}>{label}</Body>
        {line ? <Caption tone="muted" numberOfLines={2}>{line}</Caption> : null}
      </View>
      {on ? <IconSymbol name="checkmark" size={18} color={ds.c.ink} /> : null}
    </PressableScale>
  );
  return (
    <Sheet visible onClose={onClose} accessibilityLabel="Starts from" keyboard style={styles.pad} header={<Headline role="heading">Starts from</Headline>}>
      <SheetScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View role="radiogroup" accessibilityLabel="Starts from">
          {ices.map((r) => row(r.id, r.name, kitSourceLine(r), value?.id === r.id, () => onPick({ id: r.id, name: r.name }), <IceThumb kind={iceDrawKind(r) ?? 'large'} size={40} />))}
          {row('water', 'Water', 'Nothing else goes in', value === null, () => onPick(null), <View style={[styles.blank, { backgroundColor: ds.c.raised }]} />)}
        </View>
        <Caption tone="muted">A block or slab you cut from goes in Kit › Ice first, under Blocks and slabs.</Caption>
        <Field label="Or a flavour" value={flavour} onChangeText={setFlavour} placeholder="Coffee, tea, a juice" maxLength={60} />
        {flavour.trim() ? <Button label={`Starts from ${flavour.trim()}`} variant="secondary" onPress={() => onPick({ id: null, name: flavour.trim() })} /> : null}
      </SheetScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.xl, paddingBottom: space.xxl },
  body: { gap: space.md, paddingTop: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1, minWidth: 0 },
  blank: { width: 40, height: 40, borderRadius: radius.control },
});
