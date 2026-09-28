import { useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, DsText, Field, GlassButton, Headline, PressableScale, Title, useDs } from '@/components/ds';
import { layout, radius, space } from '@/constants/tokens';
import { DuplicateVenueError, useAddressSearch, useAddVenue, type AddedVenue } from '@/hooks/useDiscover';
import { ADDRESS_MIN_CHARS, type VenueAddress } from '@/lib/nearMe';

interface AddBarFormProps {
  /** What they searched for, as a starting name. */
  initialName?: string;
  onAdded: (venue: AddedVenue) => void;
  onCancel?: () => void;
  /** Offered when the bar turns out to be on Cocktail already. */
  onOpenExisting?: (profileId: string) => void;
}

/**
 * Add a bar someone visited: its name and an address picked from the search
 * (so it lands on the map). It goes up public and unclaimed; the bar can
 * claim it later and moderators can fix or remove it.
 */
export function AddBarForm({ initialName = '', onAdded, onCancel, onOpenExisting }: AddBarFormProps) {
  const ds = useDs();
  const [name, setName] = useState(initialName);
  const [search, setSearch] = useState('');
  const [address, setAddress] = useState<VenueAddress | null>(null);
  const found = useAddressSearch(address ? '' : search);
  const add = useAddVenue();
  const dupe = add.error instanceof DuplicateVenueError ? add.error : null;

  const pick = (a: VenueAddress) => {
    setAddress(a);
    if (!name.trim() && a.placeName) setName(a.placeName);
  };
  const submit = () => {
    if (!address || !name.trim() || add.isPending) return;
    add.mutate({ name: name.trim(), address }, { onSuccess: onAdded });
  };

  const typed = search.trim().length;
  let suggestions = null;
  if (!address && typed >= ADDRESS_MIN_CHARS) {
    if (found.error) suggestions = <Caption tone="accent">{found.error.message}</Caption>;
    else if (found.isFetching && !found.data) suggestions = <Caption tone="muted">Searching…</Caption>;
    else if (found.data?.length === 0) suggestions = <Caption tone="muted">No street addresses match. Try the street and city.</Caption>;
    else if (found.data) {
      suggestions = (
        <View role="radiogroup" accessibilityLabel="Addresses" style={styles.list}>
          {found.data.map((a) => (
            <PressableScale key={a.key} role="radio" aria-checked={false} accessibilityLabel={a.label} onPress={() => pick(a)} style={[styles.option, { borderBottomColor: ds.c.line }]}>
              <Body numberOfLines={2}>{a.label}</Body>
            </PressableScale>
          ))}
        </View>
      );
    }
  }

  return (
    <View style={styles.form}>
      <Field label="Bar name" value={name} onChangeText={setName} placeholder="Harbour Room" maxLength={80} autoCorrect={false} />
      {address ? (
        <View style={[styles.chosen, { backgroundColor: ds.c.raised }]}>
          <View style={styles.flex}>
            <Caption tone="muted">Address</Caption>
            <Body>{[address.address_line, address.locality, address.city, address.postcode].filter(Boolean).join(', ')}</Body>
          </View>
          <Button label="Change" variant="ghost" onPress={() => setAddress(null)} />
        </View>
      ) : (
        <Field
          label="Address"
          value={search}
          onChangeText={setSearch}
          placeholder="The bar's name or street, and the city"
          hint={typed < ADDRESS_MIN_CHARS ? 'Pick it from the list so the bar lands in the right spot.' : undefined}
          autoCorrect={false}
        />
      )}
      {suggestions}
      <DsText variant="caption" tone="muted" role="link" onPress={() => Linking.openURL('https://www.openstreetmap.org/copyright')}>
        Address search by Photon, with data © OpenStreetMap contributors
      </DsText>

      {dupe ? (
        <View style={styles.row}>
          <Caption tone="accent" style={styles.flex}>
            {dupe.message}
          </Caption>
          {dupe.existingId && onOpenExisting ? <Button label="Open it" variant="secondary" onPress={() => onOpenExisting(dupe.existingId!)} /> : null}
        </View>
      ) : add.error ? (
        <Caption tone="accent">{`Couldn't add it: ${add.error.message}`}</Caption>
      ) : null}
      <Caption tone="muted">It shows to everyone as not claimed yet, until the bar claims it.</Caption>
      <View style={styles.actions}>
        {onCancel ? <Button label="Cancel" variant="ghost" onPress={onCancel} /> : null}
        <Button label={add.isPending ? 'Adding…' : 'Add bar'} disabled={!address || !name.trim() || add.isPending} onPress={submit} />
      </View>
    </View>
  );
}

/** AddBarForm in a sheet, for Discover. */
export function AddBarSheet({ onClose, onAdded, onOpenExisting }: { onClose: () => void; onAdded: (v: AddedVenue) => void; onOpenExisting: (id: string) => void }) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close" style={[styles.scrim, { backgroundColor: ds.c.scrim }]} onPress={onClose}>
        <Pressable role="dialog" aria-label="Add a bar" style={[styles.sheet, { backgroundColor: ds.c.surface }]} onPress={(e) => e.stopPropagation()}>
          <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xl }]} keyboardShouldPersistTaps="handled">
            <View style={styles.close}>
              <GlassButton accessibilityLabel="Close" icon="xmark" onPress={onClose} />
            </View>
            <Title>Add a bar</Title>
            <Headline>{"A bar you've been to that isn't on Cocktail yet."}</Headline>
            <AddBarForm onAdded={onAdded} onCancel={onClose} onOpenExisting={onOpenExisting} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.md },
  flex: { flex: 1, minWidth: 0 },
  list: { gap: 0 },
  option: { minHeight: layout.minTapTarget, justifyContent: 'center', paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  chosen: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.control, borderCurve: 'continuous' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
  scrim: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 640, maxHeight: '92%', borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, borderCurve: 'continuous' },
  body: { padding: space.xl, gap: space.md },
  close: { alignSelf: 'flex-end', marginBottom: -space.xxl },
});
