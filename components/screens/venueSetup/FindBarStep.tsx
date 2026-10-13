import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DrinkImage, DsText, Field, Headline, PressableScale, Tag, useDs } from '@/components/ds';
import { AddBarForm } from '@/components/screens/home/AddBar';
import { SetupFooter, SetupPage } from '@/components/screens/onboarding/SetupPage';
import { Monogram, SetupHead } from '@/components/screens/onboarding/SetupParts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useBarPageCount, useClaimableBars, type ClaimableBar } from '@/hooks/useVenueSetup';

const THUMB = 52;
const MARK = 48;

/** "Cocktail bar · 42 Gertrude St, Fitzroy". */
function placeLine(b: ClaimableBar): string {
  const where = [b.address_line, b.locality ?? b.city].filter(Boolean).join(', ');
  return [b.bar_type ?? 'Bar', where].filter(Boolean).join(' · ');
}

/** "2 awards · 24 drinks". */
function countsLine(b: ClaimableBar): string | null {
  const parts = [b.awards ? `${b.awards} award${b.awards === 1 ? '' : 's'}` : null, b.drinks ? `${b.drinks} drink${b.drinks === 1 ? '' : 's'}` : null].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

/** One bar page as a card: its mark, where it is, whether it's claimed, a few of its drinks. */
function BarCard({ bar, selected, onPick }: { bar: ClaimableBar; selected: boolean; onPick: () => void }) {
  const ds = useDs();
  const counts = countsLine(bar);
  return (
    <PressableScale
      role="radio"
      aria-checked={selected}
      aria-disabled={bar.claimed}
      disabled={bar.claimed}
      accessibilityLabel={`${bar.display_name}, ${placeLine(bar)}${bar.claimed ? ', claimed' : ''}`}
      onPress={onPick}
      style={[styles.card, { backgroundColor: bar.claimed ? 'transparent' : ds.c.raised, borderColor: selected ? ds.accentText : ds.c.line }]}
    >
      <View style={styles.top}>
        {/* A bar without a logo: its initials in an outlined circle (canvas make-venue-find). */}
        {bar.avatar_url ? <UserAvatar uri={bar.avatar_url} name={bar.display_name} size={MARK} /> : <Monogram name={bar.display_name} size={MARK} quiet={bar.claimed} />}
        <View style={styles.flex}>
          <DsText variant="body" style={styles.strong} numberOfLines={1}>{bar.display_name}</DsText>
          <Caption tone="muted" numberOfLines={1}>{placeLine(bar)}</Caption>
          {bar.claimed ? <Caption tone="muted">Claimed. Work there? Ask its Admin to add you.</Caption> : null}
        </View>
      </View>
      {bar.claimed ? null : <Tag label={bar.is_closed ? 'Already on Cocktail · closed · not claimed' : 'Already on Cocktail · not claimed'} />}
      {!bar.claimed && bar.sample.length ? (
        <View style={styles.thumbs}>
          {bar.sample.map((d) => (
            <View key={d.id} style={[styles.thumb, { backgroundColor: ds.c.paper }]}>
              <DrinkImage itemId={d.id} accessibilityLabel="" aspectRatio={1} radius={0} sketchDetail="thumb" style={styles.fill} />
            </View>
          ))}
        </View>
      ) : null}
      {!bar.claimed && counts ? <Caption tone="muted">{counts}</Caption> : null}
    </PressableScale>
  );
}

/**
 * Step 1: find the bar's page among the ones already here, or add a new one
 * (typed name and address: decision b22, nothing from Google).
 */
export function FindBarStep({ onPicked, onSkip }: { onPicked: (bar: { id: string; name: string }) => void; onSkip: () => void }) {
  const ds = useDs();
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<ClaimableBar | null>(null);
  const [adding, setAdding] = useState(false);
  const found = useClaimableBars(search);
  const total = useBarPageCount().data;
  const list = found.data ?? [];

  if (adding) {
    return (
      <SetupPage footer={<SetupFooter label="Back to the search" onPress={() => setAdding(false)} />}>
        <Headline role="heading">Add a new bar</Headline>
        <Caption tone="muted">Its name and address now. Hours, phone and website come next.</Caption>
        <AddBarForm initialName={search} onAdded={(v) => onPicked({ id: v.id, name: v.display_name })} onOpenExisting={(id) => onPicked({ id, name: search.trim() })} />
      </SetupPage>
    );
  }

  return (
    <SetupPage footer={<SetupFooter label={picked ? `Claim ${picked.display_name}` : 'Claim your bar'} disabled={!picked} onPress={() => picked && onPicked({ id: picked.id, name: picked.display_name })} onSkip={onSkip} />}>
      <Field label="Search bars on Cocktail" icon="magnifyingglass" value={search} onChangeText={(t) => { setSearch(t); setPicked(null); }} placeholder="Little Rye, Fitzroy" autoCorrect={false} />
      {list.length ? (
        <View role="radiogroup" accessibilityLabel="Bars that match" style={styles.list}>
          {list.map((b) => (
            <BarCard key={b.id} bar={b} selected={picked?.id === b.id} onPick={() => setPicked(b)} />
          ))}
        </View>
      ) : null}
      {search.trim().length >= 2 && found.data?.length === 0 ? <Body tone="muted">No bar pages by that name.</Body> : null}
      {list.length && total ? (
        <Caption tone="muted">{`${list.length} of ${total.toLocaleString('en')} bar pages. Claiming one sends it to a person to check; you keep setting up meanwhile.`}</Caption>
      ) : null}
      <SetupHead>Not here?</SetupHead>
      <PressableScale role="button" accessibilityLabel="Add a new bar" onPress={() => setAdding(true)} style={[styles.add, { backgroundColor: ds.c.surface, borderColor: ds.c.lineStrong }]}>
        <IconSymbol name="plus" size={20} color={ds.accentText} />
        <View style={styles.flex}>
          <DsText variant="body" style={styles.medium}>Add a new bar</DsText>
          <Caption tone="muted">Type its name and address; add hours, phone and website next</Caption>
        </View>
        <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
      </PressableScale>
    </SetupPage>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  card: { gap: space.md, padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, minWidth: 0 },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  medium: { fontFamily: fontFamilies.bodyMedium },
  thumbs: { flexDirection: 'row', gap: space.sm },
  thumb: { width: THUMB, height: THUMB, borderRadius: radius.control, overflow: 'hidden' },
  fill: { width: THUMB, height: THUMB },
  add: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 72, paddingHorizontal: space.lg, borderRadius: radius.card, borderWidth: 1 },
});
