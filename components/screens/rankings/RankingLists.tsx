import { getLocales } from 'expo-localization';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, Headline, PressableScale, Spec, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';
import type { AreaRanking, RankEntry } from '@/hooks/useRankings';
import { formatDistance, peopleCount, usesMiles, type DiscoverRow } from '@/lib/nearMe';
import { dayOf, formatScore, type Sentiment } from '@/lib/ranking';

const BAND: Record<Sentiment, string> = { loved: 'Loved', fine: 'Fine', disliked: "Didn't like" };
const MONTH_YEAR = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' });

interface RowProps {
  position: number;
  title: string;
  detail: string;
  score: number;
  scoreDetail?: string;
  /** Makes the row a link, e.g. to the bar's profile. */
  onPress?: () => void;
}

function Row({ position, title, detail, score, scoreDetail, onPress }: RowProps) {
  const ds = useDs();
  const label = `Number ${position}: ${title}, ${detail}. Score ${formatScore(score)}${scoreDetail ? `, ${scoreDetail}` : ''}`;
  const body = (
    <>
      <DsText variant="title" tone="accent" style={styles.position}>
        {position}
      </DsText>
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
  const style = [styles.row, { borderBottomColor: ds.c.line }];
  return onPress ? (
    <PressableScale role="link" accessibilityLabel={label} onPress={onPress} style={style}>
      {body}
    </PressableScale>
  ) : (
    <View accessible accessibilityLabel={label} style={style}>
      {body}
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
            <Row position={i + 1} title={title} detail={detail || 'Ranked'} score={e.score} />
          </View>
        );
      })}
    </View>
  );
}

// Read after data loads, so never during the static web render.
const imperial = () => usesMiles(getLocales()[0]);

/** "Brunswick, Melbourne · 1.2 km" */
function placeOf(r: { locality: string | null; city: string | null; distance_km?: number | null }): string {
  const place = [r.locality, r.city].filter(Boolean).join(', ') || 'Bar';
  return r.distance_km == null ? place : `${place} · ${formatDistance(r.distance_km, imperial())}`;
}

type AreaRow = AreaRanking & { distance_km?: number | null };

/** Bars in an area, best first. Each opens the bar's profile. */
export function AreaRankList({ rows, scoreDetail = (r) => `${r.rankers} ranked` }: { rows: AreaRow[]; scoreDetail?: (r: AreaRow) => string }) {
  const router = useRouter();
  return (
    <View>
      {rows.map((r) => (
        <Row
          key={r.venue_profile_id}
          position={r.position}
          title={r.display_name}
          detail={placeOf(r)}
          score={r.score}
          scoreDetail={scoreDetail(r)}
          onPress={() => router.push(`/p/${r.handle || r.venue_profile_id}`)}
        />
      ))}
    </View>
  );
}

/**
 * Early: bars people have started ranking, below the minimum. No position
 * and no score, only how many people, so nothing reads as a verdict (or
 * gives away a few people's private rankings).
 */
export function EarlyList({ rows }: { rows: DiscoverRow[] }) {
  const ds = useDs();
  const router = useRouter();
  return (
    <View>
      {rows.map((r) => (
        <PressableScale
          key={r.venue_profile_id}
          role="link"
          accessibilityLabel={`${r.display_name}, ${placeOf(r)}. Early: ${peopleCount(r.rankers)} ranked`}
          onPress={() => router.push(`/p/${r.handle || r.venue_profile_id}`)}
          style={[styles.row, { borderBottomColor: ds.c.line }]}
        >
          <View style={styles.flex}>
            <Headline numberOfLines={1}>{r.display_name}</Headline>
            <Caption tone="muted" numberOfLines={1}>
              {placeOf(r)}
            </Caption>
          </View>
          <Caption tone="muted">{`${peopleCount(r.rankers)} ranked`}</Caption>
        </PressableScale>
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
  position: { minWidth: space.xl, textAlign: 'center' },
  flex: { flex: 1, minWidth: 0 },
  score: { alignItems: 'flex-end' },
  band: { marginTop: space.lg, textTransform: 'uppercase', letterSpacing: 1.2 },
  note: { paddingVertical: space.md },
});
