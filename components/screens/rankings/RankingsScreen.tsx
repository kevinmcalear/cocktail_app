import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Caption, Chip, Display, GlassButton, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { layout, space } from '@/constants/tokens';
import { useSignedIn } from '@/ctx/AuthContext';
import { areaFor, useMyRankList, type RankVenue } from '@/hooks/useRankings';
import { countryName } from '@/lib/countries';
import { plural, topThree } from '@/lib/ranking';
import { shareOrCopy } from '@/lib/shareLink';
import { siteOrigin } from '@/lib/venueLink';

import { AreaList, FriendsList } from './RankingTabs';
import { ScoresMethod } from './ScoresMethod';
import { CardGroup, CardRow } from './ScoreRows';

export interface RankingsScreenProps {
  /** The list: "Negroni". */
  rankedAs: { id: string; name: string };
  /** Where "near here" is: the drink's own bar, if it has a public profile. */
  home: RankVenue | null;
}

type Place = Pick<RankVenue, 'postcode' | 'city' | 'country_code' | 'locality'>;
type Tab = 'city' | 'country' | 'all' | 'postcode' | 'friends';

/**
 * One drink's rankings (Sta-rankings, Sta-rankings-desk): Best Negroni in
 * the city, near you, or among your friends, yours marked; below the floor,
 * your own. How scores work beside it on a desktop, a page of its own on phones.
 */
export function RankingsScreen(props: RankingsScreenProps) {
  return (
    <BackbarTheme>
      <RankingsPage {...props} />
    </BackbarTheme>
  );
}

function RankingsPage({ rankedAs, home }: RankingsScreenProps) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const desk = useBreakpoint() === 'desktop';
  const signedIn = useSignedIn();
  const mine = useMyRankList(rankedAs.id);
  const myBest = topThree(mine.data ?? []).length > 0;

  // The area is around the drink's bar, or else the last bar I had it at.
  const place: Place | null = home ?? mine.data?.find((e) => e.venue?.country_code)?.venue ?? null;
  const wide: Tab = place && areaFor(place, 'city') ? 'city' : place && areaFor(place, 'country') ? 'country' : 'all';
  const tabs: { tab: Tab; label: string }[] = [
    { tab: wide, label: wide === 'city' ? place!.city! : wide === 'country' ? countryName(place!.country_code) : 'Everywhere' },
    ...(place && areaFor(place, 'postcode') ? [{ tab: 'postcode' as const, label: 'Near you' }] : []),
    ...(signedIn ? [{ tab: 'friends' as const, label: 'Your friends' }] : []),
  ];
  const [picked, setPicked] = useState<Tab>(wide);
  const tab = tabs.some((t) => t.tab === picked) ? picked : wide;
  const scope = tab === 'city' || tab === 'country' || tab === 'postcode' ? tab : null;
  const area = place && scope ? areaFor(place, scope) : null;
  // "in Brooklyn": the neighbourhood when it's near you, else the chip's name.
  const name = tab === 'postcode' ? (place?.locality ?? place?.postcode ?? 'your area') : scope ? tabs.find((t) => t.tab === tab)?.label : null;
  const where = name ? `in ${name}` : 'anywhere';

  const list = (
    <View style={styles.list}>
      <Caption tone="muted" style={styles.eyebrow}>
        Ranked by comparison
      </Caption>
      <Display>{`Best ${rankedAs.name}`}</Display>
      <View role="radiogroup" aria-label="Which list" style={styles.chips}>
        {tabs.map((t) => (
          <Chip key={t.tab} quiet label={t.label} selected={tab === t.tab} onPress={() => setPicked(t.tab)} />
        ))}
      </View>
      {tab === 'friends' ? <FriendsList rankedAs={rankedAs} /> : <AreaList rankedAs={rankedAs} area={area ?? {}} where={where} mine={mine.data ?? []} mineLoading={mine.isLoading} signedIn={signedIn} />}
      {desk ? null : (
        <CardGroup>
          <CardRow icon="list.number" title="How scores work" onPress={() => router.push('/how-scores-work')} />
        </CardGroup>
      )}
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + layout.minTapTarget + space.lg, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: gutter }}>
        {desk ? (
          <View style={styles.panes}>
            <View style={styles.left}>{list}</View>
            <View style={[styles.right, { borderLeftColor: ds.c.line }]}>
              <ScoresMethod />
            </View>
          </View>
        ) : (
          <View style={styles.page}>{list}</View>
        )}
      </ScrollView>
      <View style={[styles.top, { top: insets.top + space.sm, left: gutter, right: gutter }]}>
        <GlassButton
          accessibilityLabel={Platform.OS === 'web' ? 'Back' : 'Close'}
          icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
        {/* Your top three as a poster (Bet-poster); with no list of your own, the page's link. */}
        <GlassButton
          icon="square.and.arrow.up"
          label="Share"
          accessibilityLabel={myBest ? `Share your top three ${plural(rankedAs.name)}` : `Share the best ${rankedAs.name}`}
          onPress={() => (myBest ? router.push(`/share/poster?list=${rankedAs.id}`) : void shareOrCopy(`${siteOrigin()}/rankings/${rankedAs.id}`, `Best ${rankedAs.name}`, 'ranking'))}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { width: '100%', maxWidth: 600, alignSelf: 'center' },
  panes: { flexDirection: 'row', alignItems: 'flex-start', width: '100%', maxWidth: 1180, alignSelf: 'center' },
  left: { width: 600, paddingRight: space.xxl },
  right: { flex: 1, minWidth: 0, paddingLeft: space.xxl, borderLeftWidth: StyleSheet.hairlineWidth },
  list: { gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  top: { position: 'absolute', flexDirection: 'row', justifyContent: 'space-between' },
  eyebrow: { textTransform: 'uppercase', letterSpacing: 1.2 },
});
