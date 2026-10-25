import { Fragment, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, DrinkImage, Field, PressableScale, RowScore, Switch, useDs } from '@/components/ds';
import { NearLabel } from '@/components/search/NearPicks';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useMyProfile, type MyProfile } from '@/hooks/useMyProfile';
import { useMyMadeDrinks, useProfilePicks, useSetPick, useSetPicks } from '@/hooks/useProfiles';
import { useMyHadDrinks, useMyHadPicks, usePinDrink, useSetAllHadPicks, useSetHadPick } from '@/hooks/useRankings';
import { sortHad, tallyBars, whereLine, type HadDrink } from '@/lib/hadDrinks';
import { plural } from '@/lib/menus';
import { nearAfter } from '@/lib/nearName';
import { pickedShown, SHARE_MODES, type ShareSection } from '@/lib/profiles';

import { SafetyPage } from '../safety/SafetyPage';

const TITLE: Record<ShareSection, string> = { had: 'Drinks on your profile', bars: 'Bars on your profile', originals: 'Originals on your profile' };
const NOUN: Record<ShareSection, string> = { had: 'drinks', bars: 'bars', originals: 'originals' };
const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'shown', label: 'Shown' },
  { value: 'hidden', label: 'Hidden' },
] as const;
const PIN_NOTE = 'Four fit. Pin a fifth and it takes the place of the oldest pin.';

interface Row {
  key: string;
  title: string;
  detail: string;
  score: number | null;
  pick: boolean | null | undefined;
  pin?: number | null;
  drink?: HadDrink;
}

/** Settings › Public profile › Choose (ppl-pick): one section's drinks, bars or originals, each with its switch. */
export function ProfilePicksScreen({ section }: { section: ShareSection }) {
  const { data: profile, isPending } = useMyProfile();
  if (!profile) {
    return (
      <SafetyPage title={TITLE[section]} backTo="/settings/profile">
        <Body tone="muted">{isPending ? 'Loading…' : 'Make your public profile first.'}</Body>
      </SafetyPage>
    );
  }
  return <Picks profile={profile} section={section} />;
}

function Picks({ profile, section }: { profile: MyProfile; section: ShareSection }) {
  const ds = useDs();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['value']>('all');
  const [note, setNote] = useState(PIN_NOTE);
  const mode = profile.sharing[section];
  const modeLabel = SHARE_MODES.find((m) => m.value === mode)?.label ?? 'All';
  const drinks = useMyHadDrinks().data;
  const hadPicks = useMyHadPicks().data ?? {};
  const barPicks = useProfilePicks(section === 'bars' ? profile.id : null, 'bars').data ?? {};
  const madePicks = useProfilePicks(section === 'originals' ? profile.id : null, 'originals').data ?? {};
  const made = useMyMadeDrinks(section === 'originals' ? profile.id : null).data;
  const setHad = useSetHadPick();
  const setPick = useSetPick();
  const setAllHad = useSetAllHadPicks();
  const setPicks = useSetPicks();
  const pinDrink = usePinDrink();
  const error = setHad.error ?? setPick.error ?? setAllHad.error ?? setPicks.error ?? pinDrink.error;

  const rows: Row[] | undefined =
    section === 'had'
      ? drinks && sortHad(drinks, 'score').map((d) => ({ key: d.id, title: d.name, detail: whereLine(d), score: d.score, pick: hadPicks[d.id]?.onProfile, pin: hadPicks[d.id]?.pin, drink: d }))
      : section === 'bars'
        ? drinks &&
          tallyBars(drinks).flatMap((b) => (b.venue ? [{ key: b.venue.id, title: b.venue.name, detail: plural(b.drinks, 'drink'), score: b.average, pick: barPicks[b.venue.id] }] : []))
        : made?.map((o) => ({ key: o.id, title: o.name, detail: o.origin ?? 'Your original', score: null, pick: madePicks[o.id] }));
  const shownOf = (r: Row) => pickedShown(mode, r.pick);
  const query = search.trim().toLowerCase();
  const filtered = rows?.filter((r) => filter === 'all' || (filter === 'shown') === shownOf(r));
  const visible = filtered?.filter((r) => !query || r.title.toLowerCase().includes(query));
  // "negorni": Negroni, after what matched (NearPicks).
  const close = filtered && visible ? nearAfter(query, filtered, visible, (r) => r.title) : [];
  const shownCount = rows?.filter(shownOf).length ?? 0;
  const pinned = (rows ?? []).filter((r) => r.pin).sort((a, b) => (a.pin ?? 0) - (b.pin ?? 0));

  const toggle = (r: Row, on: boolean) => {
    setNote(PIN_NOTE);
    if (section === 'had') setHad.mutate({ id: r.key, onProfile: on, pin: on ? (r.pin ?? null) : null });
    else setPick.mutate({ profileId: profile.id, section, targetId: r.key, shown: on });
  };
  const pin = (r: Row) =>
    pinDrink.mutate(
      { id: r.key, pin: !r.pin },
      { onSuccess: (bumped) => setNote(bumped ? `${rows?.find((x) => x.key === bumped)?.title ?? 'A drink'} made room for ${r.title}.` : PIN_NOTE) }
    );
  const all = (on: boolean) => {
    setNote(PIN_NOTE);
    if (section === 'had') setAllHad.mutate(on);
    else setPicks.mutate({ profileId: profile.id, section, targetIds: (rows ?? []).map((r) => r.key), shown: on });
  };

  return (
    <SafetyPage
      title={TITLE[section]}
      intro={`Your ${NOUN[section]} are set to ${modeLabel}: ${mode === 'picked' ? 'only the ones you switch on show' : mode === 'all' ? 'every one shows unless you switch it off' : 'none show for now, and your choices are kept'}. The same screen picks bars and originals.`}
      backTo="/settings/profile"
      action={rows ? <Caption tone="muted" style={styles.mono}>{`${shownCount} of ${rows.length} shown`}</Caption> : null}
    >
      <View style={styles.box}>
        {section === 'had' ? (
          <View style={styles.group}>
            <Caption tone="muted" role="heading" style={styles.eyebrow}>
              Top four · tap the pin on a drink
            </Caption>
            <View style={styles.slots}>
              {[0, 1, 2, 3].map((i) => {
                const d = pinned[i]?.drink;
                return (
                  <View key={i} style={styles.slot} accessible accessibilityLabel={d ? `Place ${i + 1}, ${d.name}` : `Place ${i + 1}, empty`}>
                    {d ? (
                      <>
                        <DrinkImage thumb source={d.imageUrl} generated={d.isSketch} itemId={d.itemId} accessibilityLabel={d.name} />
                        <Caption numberOfLines={1}>{d.name}</Caption>
                      </>
                    ) : (
                      <View style={[styles.empty, { borderColor: ds.c.lineStrong }]}>
                        <Caption tone="muted">Empty</Caption>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
            <Caption tone="muted" role="status">
              {note}
            </Caption>
          </View>
        ) : null}
        <Field label={`Search your ${NOUN[section]}`} hideLabel value={search} onChangeText={setSearch} placeholder={`Search your ${NOUN[section]}`} autoCorrect={false} />
        <View role="radiogroup" accessibilityLabel="Filter" style={styles.chips}>
          {FILTERS.map((f) => (
            <Chip key={f.value} quiet label={f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} />
          ))}
        </View>
        {error ? (
          <Caption tone="accent" role="alert">
            {error.message}
          </Caption>
        ) : null}
        {!visible ? (
          <Caption tone="muted">Loading…</Caption>
        ) : !rows?.length ? (
          <Body tone="muted">{section === 'originals' ? 'You haven’t made a drink yet.' : 'Nothing here yet. Rank a drink and it shows up here.'}</Body>
        ) : (
          <View role="list">
            {[...visible, ...close].map((r) => {
              const shown = shownOf(r);
              return (
                <Fragment key={r.key}>
                {r === close[0] ? <NearLabel found={visible.length > 0} style={styles.near} /> : null}
                <View role="listitem" style={[styles.row, { borderBottomColor: ds.c.line }]}>
                  <View style={styles.flex}>
                    <Body numberOfLines={2} style={styles.title}>
                      {r.title}
                    </Body>
                    <Caption tone="muted" numberOfLines={1}>
                      {r.detail}
                    </Caption>
                  </View>
                  <RowScore score={r.score} />
                  {section === 'had' ? (
                    <PressableScale
                      role="button"
                      aria-pressed={!!r.pin}
                      accessibilityLabel={r.pin ? `Unpin ${r.title} from your top four` : `Pin ${r.title} to your top four`}
                      onPress={() => pin(r)}
                      disabled={pinDrink.isPending || mode === 'none'}
                      style={[styles.pin, { backgroundColor: r.pin ? ds.accentFill.fill : ds.c.surface }]}
                    >
                      <IconSymbol name={r.pin ? 'pin.fill' : 'pin'} size={18} color={r.pin ? ds.accentFill.text : ds.c.muted} />
                    </PressableScale>
                  ) : null}
                  <Switch
                    value={shown}
                    onValueChange={(on) => toggle(r, on)}
                    disabled={mode === 'none'}
                    label={`Show ${r.title} on your profile`}
                  />
                </View>
                </Fragment>
              );
            })}
          </View>
        )}
        {rows?.length && mode !== 'none' ? (
          <View style={styles.pair}>
            <Button label="Show all" variant="secondary" onPress={() => all(true)} disabled={setAllHad.isPending || setPicks.isPending} style={styles.flex} />
            <Button label="Hide all" variant="secondary" onPress={() => all(false)} disabled={setAllHad.isPending || setPicks.isPending} style={styles.flex} />
          </View>
        ) : null}
      </View>
    </SafetyPage>
  );
}

const styles = StyleSheet.create({
  near: { paddingTop: space.md },
  box: { gap: space.md, marginTop: space.md },
  group: { gap: space.sm },
  slots: { flexDirection: 'row', gap: space.sm },
  slot: { flex: 1, minWidth: 0, gap: space.xs },
  empty: { aspectRatio: 1, borderRadius: radius.control, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pair: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  mono: { fontFamily: fontFamilies.monoMedium },
  eyebrow: { letterSpacing: 1.2, textTransform: 'uppercase', fontFamily: fontFamilies.bodyMedium },
  title: { fontFamily: fontFamilies.bodySemiBold },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 64, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  pin: { width: layout.minTapTarget, height: layout.minTapTarget, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
