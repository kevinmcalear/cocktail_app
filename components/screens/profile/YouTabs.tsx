import { useRouter, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, DrinkImage, Segmented, TextLink } from '@/components/ds';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { space } from '@/constants/tokens';
import type { MyProfile } from '@/hooks/useMyProfile';
import { useItemScores } from '@/hooks/useFlavor';
import { useProfilePicks, useSetPick, type Original } from '@/hooks/useProfiles';
import { useMyHadPicks, useSetHadPick } from '@/hooks/useRankings';
import { hasDates, sortHad, tallyBars, whereLine, type HadDrink, type HadSort } from '@/lib/hadDrinks';
import { heroPicture } from '@/lib/itemImages';
import { itemHref } from '@/lib/itemRoutes';
import { plural } from '@/lib/menus';
import { pickedShown, type ShareSection } from '@/lib/profiles';

import { ModeLine } from './ModeLine';
import { riffed } from './ProfileSections';
import { ShowRow } from './ShowRow';

const TABS = [
  { value: 'had', label: 'Had' },
  { value: 'bars', label: 'Bars' },
  { value: 'originals', label: 'Originals' },
] as const;

const SORTS: { value: HadSort; label: string }[] = [
  { value: 'score', label: 'Top scored' },
  { value: 'recent', label: 'Latest' },
];

interface Row {
  key: string;
  title: string;
  detail: string | null;
  score: number | null | undefined;
  lead: ReactNode;
  href: string | null;
  pick: boolean | null | undefined;
}

/**
 * Had / Bars / Originals on You (ppl-you), each row with its eye: the
 * section's mode and "4 of 7 shown" with Change, and a footnote with Choose
 * all at once. Without a public profile, the rows and a line saying only you
 * see them.
 */
export function YouTabs({ profile, drinks, made, loading, failed }: { profile: MyProfile | null; drinks: HadDrink[]; made: Original[]; loading: boolean; failed: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<ShareSection>('had');
  const [sort, setSort] = useState<HadSort>('score');
  const hadPicks = useMyHadPicks().data ?? {};
  const barPicks = useProfilePicks(profile?.id, 'bars').data ?? {};
  const madePicks = useProfilePicks(profile?.id, 'originals').data ?? {};
  const scores = useItemScores(tab === 'originals' ? made.map((d) => d.id) : []).data ?? {};
  const setHad = useSetHadPick();
  const setPick = useSetPick();
  const mode = profile?.sharing[tab] ?? 'none';
  // A tap shows straight away; a failed save puts it back.
  const pending = setHad.isPending ? { key: setHad.variables?.id, on: setHad.variables?.onProfile } : setPick.isPending ? { key: setPick.variables?.targetId, on: setPick.variables?.shown } : null;

  const rows: Row[] =
    tab === 'had'
      ? sortHad(drinks, sort).map((d) => ({
          key: d.id,
          title: d.name,
          detail: whereLine(d),
          score: d.score,
          lead: <DrinkImage thumb source={d.imageUrl} generated={d.isSketch} itemId={d.itemId} accessibilityLabel={d.name} radius="control" />,
          href: itemHref('Cocktail', d.itemId),
          pick: hadPicks[d.id]?.onProfile,
        }))
      : tab === 'bars'
        ? tallyBars(drinks).flatMap((b) =>
            b.venue
              ? [
                  {
                    key: b.venue.id,
                    title: b.venue.name,
                    detail: [plural(b.drinks, 'drink'), b.venue.place?.split(',')[0]].filter(Boolean).join(' · '),
                    score: b.average,
                    lead: <UserAvatar uri={b.venue.avatarUrl} name={b.venue.name} size={52} />,
                    href: `/p/${b.venue.handle || b.venue.id}`,
                    pick: barPicks[b.venue.id],
                  },
                ]
              : []
          )
        : made.map((d) => {
            const hero = heroPicture(d.item_images);
            return {
              key: d.id,
              title: d.name,
              detail: ['Your original', d.origin_year, riffed(d)].filter(Boolean).join(' · '),
              score: scores[d.id],
              lead: <DrinkImage thumb source={hero?.url} generated={hero?.isSketch} glass={d.glass?.icon_key} itemId={d.id} accessibilityLabel={d.name} radius="control" />,
              href: `/cocktail/${d.id}`,
              pick: madePicks[d.id],
            };
          });
  const shownOf = (r: Row) => pickedShown(mode, pending?.key === r.key ? pending.on : r.pick);
  const shownCount = rows.filter(shownOf).length;
  const toggle = (r: Row) => {
    if (!profile) return;
    const on = !shownOf(r);
    if (tab === 'had') setHad.mutate({ id: r.key, onProfile: on, pin: on ? (hadPicks[r.key]?.pin ?? null) : null });
    else setPick.mutate({ profileId: profile.id, section: tab, targetId: r.key, shown: on });
  };
  const choose = () => router.push(`/settings/profile-picks?section=${tab}` as Href);
  const error = setHad.error ?? setPick.error;

  let list;
  if (tab !== 'originals' && failed) list = <Body tone="muted">Couldn’t load your drinks. Check your connection and try again.</Body>;
  else if (loading) list = <Caption tone="muted">Loading your drinks…</Caption>;
  else if (!rows.length)
    list =
      tab === 'originals' ? (
        <Body tone="muted">You haven’t made a drink yet. Tap New to write one up.</Body>
      ) : (
        <View style={styles.empty}>
          <Body tone="muted">Nothing here yet. Open a drink you’ve had and tap Rank it: it lands here with your score, and counts towards the bar’s.</Body>
          <Button label="Find a drink" icon="magnifyingglass" onPress={() => router.navigate('/search')} style={styles.start} />
        </View>
      );
  else
    list = (
      <View role="list">
        {rows.map((r) => (
          <ShowRow
            key={r.key}
            lead={r.lead}
            title={r.title}
            detail={r.detail}
            score={r.score}
            hidden={!!profile && !shownOf(r)}
            onToggle={profile && mode !== 'none' ? () => toggle(r) : undefined}
            onPress={r.href ? () => router.push(r.href as Href) : undefined}
          />
        ))}
      </View>
    );

  return (
    <View style={styles.section}>
      <Segmented accessibilityLabel="Your drinks" look="track" options={TABS} value={tab} onChange={setTab} />
      {profile && rows.length ? <ModeLine mode={mode} shown={shownCount} total={rows.length} onChange={() => router.push('/settings/profile-sharing' as Href)} /> : null}
      {tab === 'had' && hasDates(drinks) ? (
        <View role="radiogroup" accessibilityLabel="Sort" style={styles.chips}>
          {SORTS.map((s) => (
            <Chip key={s.value} quiet label={s.label} selected={sort === s.value} onPress={() => setSort(s.value)} />
          ))}
        </View>
      ) : null}
      {list}
      {error ? (
        <Caption tone="accent" role="alert">
          {error.message}
        </Caption>
      ) : null}
      {rows.length ? (
        profile ? (
          <View style={styles.foot}>
            <Caption tone="muted">Hidden ones are greyed out and say Only you: they still count in your rankings. Tap the eye to show or hide one.</Caption>
            <TextLink label="Choose all at once" onPress={choose} />
          </View>
        ) : (
          <Caption tone="muted">{`Only you can see ${tab === 'bars' ? 'your bars and your average at each' : tab === 'had' ? 'what you’ve had and your scores' : 'the drinks you’ve made'}. You can show them on a public profile.`}</Caption>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  empty: { gap: space.md, paddingVertical: space.md },
  start: { alignSelf: 'flex-start' },
  foot: { gap: space.xs, alignItems: 'flex-start' },
});
