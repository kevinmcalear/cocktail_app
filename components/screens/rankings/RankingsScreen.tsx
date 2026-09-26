import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Caption, GlassButton, Headline, Segmented, Title, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { layout, space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { areaFor, useDrinkRankings, useMyRankList, type RankScope, type RankVenue } from '@/hooks/useRankings';
import { plural } from '@/lib/ranking';

import { AreaRankList, ListNote, MyRankList } from './RankingLists';

export interface RankingsScreenProps {
  /** The list: "Martini". */
  rankedAs: { id: string; name: string };
  /** Where "near here" is: the drink's own bar, if it has a public profile. */
  home: RankVenue | null;
}

type Place = Pick<RankVenue, 'postcode' | 'city' | 'country_code' | 'locality'>;

// ponytail: mirrors private.ranking_min_rankers() (20). Upgrade path: return
// it from get_drink_rankings if the number ever changes per drink or area.
const MIN_RANKERS = 20;

function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(undefined, { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

function scopeLabel(place: Place, scope: RankScope): string {
  if (scope === 'postcode') return [place.postcode, place.locality].filter(Boolean).join(' ');
  if (scope === 'city') return place.city ?? '';
  return countryName(place.country_code ?? '');
}

/** "Your martinis" and "Best martini" in an area around a place. */
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
  const wide = useBreakpoint() !== 'phone';
  const signedIn = !!useAuth().user;
  const { data: mine, isLoading: mineLoading } = useMyRankList(rankedAs.id);

  // The area is around the drink's bar, or else the last bar I had it at.
  const place: Place | null = home ?? mine?.find((e) => e.venue?.country_code)?.venue ?? null;
  const scopes = (['postcode', 'city', 'country'] as const).filter((s) => place && areaFor(place, s));
  const [picked, setPicked] = useState<RankScope>('city');
  const scope = scopes.includes(picked) ? picked : scopes[scopes.length - 1];
  const area = place && scope ? areaFor(place, scope) : {};
  const where = place && scope ? scopeLabel(place, scope) : 'anywhere';
  const { data: best, isLoading: bestLoading, error: bestError } = useDrinkRankings(rankedAs.id, area);

  const mineSection = (
    <View style={styles.section}>
      <Headline role="heading">{`Your ${plural(rankedAs.name)}`}</Headline>
      {!signedIn ? (
        <ListNote>Sign in to keep your own list.</ListNote>
      ) : mineLoading ? (
        <ListNote>Loading your list…</ListNote>
      ) : mine?.length ? (
        <MyRankList entries={mine} listName={rankedAs.name} />
      ) : (
        <ListNote>{`You haven't ranked a ${rankedAs.name} yet. Open one and tap Rank it.`}</ListNote>
      )}
    </View>
  );

  const bestSection = (
    <View style={styles.section}>
      <Headline role="heading">{`Best ${rankedAs.name} ${scope ? `in ${where}` : 'anywhere'}`}</Headline>
      {scopes.length > 1 ? (
        <Segmented
          accessibilityLabel="Area"
          options={scopes.map((s) => ({ value: s, label: scopeLabel(place!, s) }))}
          value={scope!}
          onChange={setPicked}
        />
      ) : null}
      {bestError ? (
        <ListNote>{`Couldn't load the rankings: ${bestError.message}`}</ListNote>
      ) : bestLoading ? (
        <ListNote>Loading…</ListNote>
      ) : best?.length ? (
        <AreaRankList rows={best} />
      ) : (
        <ListNote>{`Not enough rankers yet ${scope ? `in ${where}` : 'anywhere'}. A bar's ${rankedAs.name} shows here once ${MIN_RANKERS} people have ranked it there.`}</ListNote>
      )}
      <Caption tone="muted">Each score is 0 to 10, from people comparing drinks two at a time. Updated every hour.</Caption>
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + layout.minTapTarget + space.lg, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: gutter }}>
        <View style={[styles.page, wide && styles.pageWide]}>
          <Caption tone="muted">Ranked by comparison</Caption>
          <Title>{plural(rankedAs.name)}</Title>
          <View style={[styles.columns, wide && styles.columnsWide]}>
            <View style={wide ? styles.column : undefined}>{bestSection}</View>
            <View style={wide ? styles.column : undefined}>{mineSection}</View>
          </View>
        </View>
      </ScrollView>
      <View style={[styles.back, { top: insets.top + space.sm, left: gutter }]}>
        <GlassButton
          accessibilityLabel={Platform.OS === 'web' ? 'Back' : 'Close'}
          icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { gap: space.sm, width: '100%', alignSelf: 'center' },
  pageWide: { maxWidth: 1080 },
  columns: { gap: space.xxl, marginTop: space.lg },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start' },
  column: { flex: 1, minWidth: 0 },
  section: { gap: space.sm },
  back: { position: 'absolute' },
});
