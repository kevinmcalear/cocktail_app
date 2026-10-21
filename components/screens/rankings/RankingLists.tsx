import { getLocales } from 'expo-localization';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DrinkImage, DsText, Headline, PressableScale, Spec, useDs } from '@/components/ds';
// A bar's ringed monogram, or its logo (disc-list).
import { BarMark } from '@/components/screens/home/BarMark';
import { LoveBarButton } from '@/components/screens/kept/LoveBarButton';
import { space } from '@/constants/tokens';
import type { AreaRanking, RankEntry } from '@/hooks/useRankings';
import { useBarVersions } from '@/hooks/useSpecMatches';
import { formatDistance, rankedCount, usesMiles, type DiscoverRow } from '@/lib/nearMe';
import { dayOf, formatScore, type Sentiment } from '@/lib/ranking';

const BAND: Record<Sentiment, string> = { loved: 'Loved', fine: 'Fine', disliked: "Didn't like" };
const LOGO = 40;
const MONTH_YEAR = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' });

interface RowProps {
  position: number;
  title: string;
  detail: string;
  score: number;
  scoreDetail?: string;
  /** The bar's logo (initials when null). Undefined leaves the logo out. */
  logo?: string | null;
  /** The bar page, for its venue's colours when it has no logo. */
  barId?: string;
  /** One drink at one bar: its picture leads instead of the logo. */
  drinkId?: string;
  /** Makes the row a link, e.g. to the bar's profile. */
  onPress?: () => void;
  /** Discover: resting the pointer or keyboard focus on the row shows this bar on the map. Leaving cancels that. */
  onHoverIn?: () => void;
  onHoverOut?: () => void;
  /** Beside the row, outside its link: the bar's heart. */
  end?: ReactNode;
}

/** A numbered row with a score at the end: a bar in an area list, a drink in your own. */
export function RankRow({ position, title, detail, score, scoreDetail, logo, barId, drinkId, onPress, onHoverIn, onHoverOut, end }: RowProps) {
  const ds = useDs();
  const label = `Number ${position}: ${title}, ${detail}. Score ${formatScore(score)}${scoreDetail ? `, ${scoreDetail}` : ''}`;
  const body = (
    <>
      <DsText variant="title" tone="accent" style={styles.position}>
        {position}
      </DsText>
      {drinkId ? <DrinkImage itemId={drinkId} glass={null} accessibilityLabel="" radius="control" style={styles.drink} thumb /> : logo !== undefined ? <BarMark logoUrl={logo} name={title} profileId={barId} size={LOGO} /> : null}
      <View style={styles.flex}>
        <Headline numberOfLines={1}>{title}</Headline>
        <Caption tone="muted" numberOfLines={1}>
          {detail}
        </Caption>
      </View>
      <View style={styles.score}>
        <Spec>{formatScore(score)}</Spec>
        {scoreDetail ? <Caption tone="muted">{scoreDetail}</Caption> : null}
      </View>
    </>
  );
  const row = onPress ? (
    <PressableScale role="link" accessibilityLabel={label} onPress={onPress} onHoverIn={onHoverIn} onHoverOut={onHoverOut} onFocus={onHoverIn} onBlur={onHoverOut} style={styles.link}>
      {body}
    </PressableScale>
  ) : (
    <View accessible accessibilityLabel={label} style={styles.link}>
      {body}
    </View>
  );
  return (
    <View style={[styles.row, { borderBottomColor: ds.c.line }]}>
      {row}
      {end}
    </View>
  );
}

/** My list for a drink, best first, with a heading at each band. */
export function MyRankList({ entries, listName }: { entries: RankEntry[]; listName: string }) {
  return (
    <View>
      {entries.map((e, i) => {
        const where = e.venue ? [e.venue.display_name, e.venue.locality].filter(Boolean).join(', ') : 'Home';
        const title = e.item?.name && e.item.name !== listName ? e.item.name : where;
        const detail = [title === where ? null : where, e.had_on ? MONTH_YEAR.format(dayOf(e.had_on)) : null].filter(Boolean).join(' · ');
        return (
          <View key={e.id}>
            {i === 0 || entries[i - 1].sentiment !== e.sentiment ? (
              <Caption tone="muted" style={styles.band}>
                {BAND[e.sentiment]}
              </Caption>
            ) : null}
            <RankRow position={i + 1} title={title} detail={detail || 'Ranked'} score={e.score} />
          </View>
        );
      })}
    </View>
  );
}

// Read after data loads, so never during the static web render.
const imperial = () => usesMiles(getLocales()[0]);

/** "Brunswick, Melbourne · 1.2 km" */
export function placeOf(r: { locality: string | null; city: string | null; distance_km?: number | null }): string {
  const place = [r.locality, r.city].filter(Boolean).join(', ') || 'Bar';
  return r.distance_km == null ? place : `${place} · ${formatDistance(r.distance_km, imperial())}`;
}

type AreaRow = AreaRanking & { distance_km?: number | null; avatar_url?: string | null };

/**
 * Bars in an area, best first. Each opens the bar's profile. For a classic's
 * list (`classicId`), each row is one drink at one bar (disc-rankings): it
 * leads with that drink's picture and says what the bar pours of it, "the
 * classic spec" or what its variation changes; other lists lead with the logo.
 * `love`: each bar's heart at the end of its row (signed in).
 */
export function AreaRankList({ rows, classicId, scoreDetail = (r) => `${r.rankers} ranked`, love = false, onShowBar }: { rows: AreaRow[]; classicId?: string; scoreDetail?: (r: AreaRow) => string; love?: boolean; /** Hovering a row opens that bar on the map. */ onShowBar?: (barId: string | null) => void }) {
  const router = useRouter();
  const pours = useBarVersions(classicId, rows.map((r) => r.venue_profile_id));
  return (
    <View>
      {rows.map((r) => {
        const pour = pours[r.venue_profile_id];
        return (
          <RankRow
            key={r.venue_profile_id}
            position={r.position}
            title={r.display_name}
            detail={[placeOf(r), pour?.label].filter(Boolean).join(' · ')}
            score={r.score}
            scoreDetail={scoreDetail(r)}
            logo={classicId ? undefined : r.avatar_url}
            barId={r.venue_profile_id}
            drinkId={classicId ? (pour?.itemId ?? classicId) : undefined}
            onPress={() => router.push(`/p/${r.handle || r.venue_profile_id}`)}
            onHoverIn={onShowBar ? () => onShowBar(r.venue_profile_id) : undefined}
            onHoverOut={onShowBar ? () => onShowBar(null) : undefined}
            end={love ? <LoveBarButton profileId={r.venue_profile_id} name={r.display_name} /> : undefined}
          />
        );
      })}
    </View>
  );
}

/**
 * Early: bars people have started ranking, below the minimum. No position
 * and no score, only how many people, so nothing reads as a verdict (or
 * gives away a few people's private rankings). `love`: each bar's heart.
 */
export function EarlyList({ rows, love = false, onShowBar }: { rows: DiscoverRow[]; love?: boolean; /** Hovering a row opens that bar on the map. */ onShowBar?: (barId: string | null) => void }) {
  const ds = useDs();
  const router = useRouter();
  return (
    <View>
      {rows.map((r) => (
        <View key={r.venue_profile_id} style={[styles.row, { borderBottomColor: ds.c.line }]}>
          <PressableScale
            role="link"
            accessibilityLabel={[`${r.display_name}, ${placeOf(r)}`, rankedCount(r.rankers)].filter(Boolean).join('. ')}
            onPress={() => router.push(`/p/${r.handle || r.venue_profile_id}`)}
            onHoverIn={onShowBar ? () => onShowBar(r.venue_profile_id) : undefined}
            onHoverOut={onShowBar ? () => onShowBar(null) : undefined}
            style={styles.link}
          >
            <BarMark logoUrl={r.avatar_url} name={r.display_name} profileId={r.venue_profile_id} size={LOGO} />
            <View style={styles.flex}>
              <Headline numberOfLines={1}>{r.display_name}</Headline>
              <Caption tone="muted" numberOfLines={1}>
                {placeOf(r)}
              </Caption>
            </View>
            {r.rankers ? <Caption tone="muted">{rankedCount(r.rankers)}</Caption> : null}
          </PressableScale>
          {love ? <LoveBarButton profileId={r.venue_profile_id} name={r.display_name} /> : null}
        </View>
      ))}
    </View>
  );
}

/** A plain sentence where a list would be. */
export function ListNote({ children }: { children: string }) {
  return (
    <Body tone="muted" style={styles.note}>
      {children}
    </Body>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  // The row's link (or label), beside anything at its end.
  link: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.md },
  drink: { width: LOGO + space.sm, height: LOGO + space.sm },
  position: { minWidth: space.xl, textAlign: 'center' },
  flex: { flex: 1, minWidth: 0 },
  score: { alignItems: 'flex-end' },
  band: { marginTop: space.lg, textTransform: 'uppercase', letterSpacing: 1.2 },
  note: { paddingVertical: space.md },
});
