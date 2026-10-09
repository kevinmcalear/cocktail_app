import { useState } from 'react';
import { Platform, StyleSheet, Switch, View } from 'react-native';

import { Body, Button, Caption, Chip, DsText, Field, useDs } from '@/components/ds';
import { backbar, space } from '@/constants/tokens';
import { useMyProfile, useSaveSharing, type MyProfile } from '@/hooks/useMyProfile';
import { useProfileOriginals, useProfilePicks, useSetPick } from '@/hooks/useProfiles';
import { useMyHadDrinks, useMyHadPicks, useSetHadPick } from '@/hooks/useRankings';
import { sortHad, tallyBars, whereLine } from '@/lib/hadDrinks';
import { plural } from '@/lib/menus';
import { modeSummary, pickedShown, SHARE_MODES, type ShareSection } from '@/lib/profiles';
import { formatScore } from '@/lib/ranking';

import { SafetyPage } from '../safety/SafetyPage';

const TITLE: Record<ShareSection, string> = { had: 'Drinks on your profile', bars: 'Bars on your profile', originals: 'Originals on your profile' };
const INTRO: Record<ShareSection, string> = {
  had: 'Show or hide each drink you’ve had, and pin up to four to the top of your profile.',
  bars: 'Show or hide each bar you’ve had drinks at. A bar you hide is never named, even beside a drink.',
  originals: 'Show or hide each drink you’ve made. Its credit still shows on the drink’s own page.',
};

interface Row {
  key: string;
  title: string;
  detail: string;
  pick: boolean | null | undefined;
  pin?: number | null;
}

/** Settings › Public profile › Choose: one section's drinks, bars or originals, each with its own switch. */
export function ProfilePicksScreen({ section }: { section: ShareSection }) {
  const { data: profile, isPending } = useMyProfile();
  return (
    <SafetyPage title={TITLE[section]} intro={INTRO[section]} backTo="/settings/profile">
      {isPending ? <Body tone="muted">Loading…</Body> : profile ? <Picks profile={profile} section={section} /> : <Body tone="muted">Make your public profile first.</Body>}
    </SafetyPage>
  );
}

function Picks({ profile, section }: { profile: MyProfile; section: ShareSection }) {
  const ds = useDs();
  const [search, setSearch] = useState('');
  const save = useSaveSharing();
  const mode = save.isPending && save.variables?.mode ? save.variables.mode : profile.sharing[section];
  const drinks = useMyHadDrinks().data;
  const hadPicks = useMyHadPicks().data ?? {};
  const barPicks = useProfilePicks(section === 'bars' ? profile.id : null, 'bars').data ?? {};
  const madePicks = useProfilePicks(section === 'originals' ? profile.id : null, 'originals').data ?? {};
  const originals = useProfileOriginals(section === 'originals' ? profile.id : null).data;
  const setHad = useSetHadPick();
  const setPick = useSetPick();
  const error = setHad.error ?? setPick.error;

  const rows: Row[] | undefined =
    section === 'had'
      ? drinks && sortHad(drinks, 'score').map((d) => ({ key: d.id, title: d.name, detail: `${whereLine(d)} · ${formatScore(d.score)}`, pick: hadPicks[d.id]?.onProfile, pin: hadPicks[d.id]?.pin }))
      : section === 'bars'
        ? drinks &&
          tallyBars(drinks).flatMap((b) => (b.venue ? [{ key: b.venue.id, title: b.venue.name, detail: `${plural(b.drinks, 'drink')} · ${formatScore(b.average)} average`, pick: barPicks[b.venue.id] }] : []))
        : originals?.map((o) => ({ key: o.id, title: o.name, detail: o.origin ?? 'Your original', pick: madePicks[o.id] }));
  const pins = Object.values(hadPicks).flatMap((p) => (p.pin ? [p.pin] : []));
  const query = search.trim().toLowerCase();
  const shownRows = rows?.filter((r) => !query || r.title.toLowerCase().includes(query));

  const toggle = (r: Row, on: boolean) =>
    section === 'had' ? setHad.mutate({ id: r.key, onProfile: on, pin: on ? (r.pin ?? null) : null }) : setPick.mutate({ profileId: profile.id, section, targetId: r.key, shown: on });
  const pin = (r: Row) => {
    if (r.pin) return setHad.mutate({ id: r.key, onProfile: true, pin: null });
    const free = [1, 2, 3, 4].find((n) => !pins.includes(n));
    if (free) setHad.mutate({ id: r.key, onProfile: true, pin: free });
  };

  return (
    <View style={styles.box}>
      <View role="radiogroup" accessibilityLabel={TITLE[section]} style={styles.chips}>
        {SHARE_MODES.map((m) => (
          <Chip key={m.value} label={m.label} selected={mode === m.value} onPress={() => save.mutate({ id: profile.id, section, mode: m.value })} />
        ))}
      </View>
      <Caption tone="muted">{modeSummary(section, mode)}</Caption>
      {rows && rows.length > 8 ? <Field label="Search" value={search} onChangeText={setSearch} autoCorrect={false} /> : null}
      {error ? (
        <Caption tone="accent" role="alert">
          {error.message}
        </Caption>
      ) : null}
      {!shownRows ? (
        <Caption tone="muted">Loading…</Caption>
      ) : !rows?.length ? (
        <Body tone="muted">{section === 'originals' ? 'No drinks are credited to you yet.' : 'Nothing here yet. Rank a drink and it shows up here.'}</Body>
      ) : (
        <View role="list">
          {shownRows.map((r) => {
            const shown = pickedShown(mode, r.pick);
            return (
              <View key={r.key} role="listitem" style={[styles.row, { borderBottomColor: ds.c.line }]}>
                <View style={styles.flex}>
                  <DsText variant="headline" numberOfLines={2}>
                    {r.title}
                  </DsText>
                  <Caption tone="muted" numberOfLines={1}>
                    {r.pin ? `Top four, number ${r.pin} · ${r.detail}` : r.detail}
                  </Caption>
                </View>
                {section === 'had' && shown ? (
                  <Button
                    label={r.pin ? 'Unpin' : 'Pin'}
                    variant="ghost"
                    accessibilityLabel={r.pin ? `Unpin ${r.title} from your top four` : `Pin ${r.title} to your top four`}
                    disabled={!r.pin && pins.length >= 4}
                    onPress={() => pin(r)}
                  />
                ) : null}
                <Switch
                  value={shown}
                  onValueChange={(on) => toggle(r, on)}
                  disabled={mode === 'none'}
                  aria-label={`Show ${r.title} on my profile`}
                  trackColor={{ false: ds.c.lineStrong, true: ds.accentFill.fill }}
                  thumbColor={backbar.light.surface}
                  {...(Platform.OS === 'web' ? { activeThumbColor: backbar.light.surface } : null)}
                />
              </View>
            );
          })}
        </View>
      )}
      {section === 'had' && pins.length >= 4 ? <Caption tone="muted">Your top four is full. Unpin one to pin another.</Caption> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space.md },
  flex: { flex: 1, minWidth: 0 },
  chips: { flexDirection: 'row', gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 64, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
});
