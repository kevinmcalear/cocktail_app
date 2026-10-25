import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, Chip, DsText, Field, PressableScale, useDs } from '@/components/ds';
import { NearPicks, splitNear } from '@/components/search/NearPicks';
import { radius, space } from '@/constants/tokens';
import { useBarProfile, usePublicBars } from '@/hooks/useRankings';

export interface GuestValue {
  /** A bar's public page: the event links to it and credits its drinks. */
  profileId: string | null;
  /** Free text, for a guest with no page here (a bartender, a brand). */
  name: string;
}

/**
 * The guest at a takeover or guest shift: a bar picked from the public pages
 * as you type, or the typed name when there's no page to pick.
 */
export function EventGuest({ value, onChange, placeholder, bare }: { value: GuestValue; onChange: (v: GuestValue) => void; placeholder: string; /** A row of the sheet's grouped card. */ bare?: boolean }) {
  const ds = useDs();
  const [search, setSearch] = useState(value.name);
  const picked = useBarProfile(null, value.profileId).data;
  const [found, near] = splitNear(usePublicBars(value.profileId ? '' : search, { near: true }).data ?? []);
  const chip = (b: (typeof found)[number]) => (
    <Chip key={b.id} selected={false} label={b.locality ? `${b.display_name}, ${b.locality}` : b.display_name} onPress={() => onChange({ profileId: b.id, name: '' })} />
  );

  if (value.profileId) {
    const name = picked?.display_name ?? 'Guest bar';
    return (
      <View style={styles.wrap}>
        <Caption tone="muted">Guest</Caption>
        <View style={[styles.picked, bare ? styles.pickedBare : { backgroundColor: ds.c.raised }]}>
          <View aria-hidden style={[styles.mark, { backgroundColor: ds.c.lineStrong }]}>
            <DsText variant="caption">{name[0]?.toUpperCase()}</DsText>
          </View>
          <View style={styles.flex}>
            <DsText numberOfLines={1}>{bare && (picked?.locality || picked?.city) ? `${name} · ${picked?.locality ?? picked?.city}` : name}</DsText>
            {!bare && (picked?.locality || picked?.city) ? <Caption tone="muted">{picked?.locality ?? picked?.city}</Caption> : null}
          </View>
          <PressableScale role="button" accessibilityLabel={`Change the guest from ${name}`} onPress={() => onChange({ profileId: null, name: '' })} style={styles.change}>
            <Caption tone="accent">Change</Caption>
          </PressableScale>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Field
        label="Guest"
        value={search}
        onChangeText={(t) => {
          setSearch(t);
          onChange({ profileId: null, name: t });
        }}
        placeholder={placeholder}
        autoCorrect={false}
        bare={bare}
      />
      {found.length || near.length ? (
        <View role="list" accessibilityLabel="Bars with a page here" style={styles.wrap}>
          {found.length ? <View style={styles.chips}>{found.map(chip)}</View> : null}
          <NearPicks found={found.length > 0} near={near} render={chip} rowStyle={styles.chips} />
        </View>
      ) : null}
      {search.trim().length >= 2 ? <Caption tone="muted">Pick their bar to link its page and credit its drinks, or keep the name as typed.</Caption> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  picked: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingLeft: space.md, borderRadius: radius.control },
  pickedBare: { minHeight: 28, paddingLeft: 0 },
  mark: { width: 28, height: 28, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  change: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.md },
});
