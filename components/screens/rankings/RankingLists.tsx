import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, Headline, Spec, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';
import type { AreaRanking, RankEntry } from '@/hooks/useRankings';
import { dayOf, formatScore, type Sentiment } from '@/lib/ranking';

const BAND: Record<Sentiment, string> = { loved: 'Loved', fine: 'Fine', disliked: "Didn't like" };
const MONTH_YEAR = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' });

function Row({ position, title, detail, score, scoreDetail }: { position: number; title: string; detail: string; score: number; scoreDetail?: string }) {
  const ds = useDs();
  return (
    <View
      accessible
      accessibilityLabel={`Number ${position}: ${title}, ${detail}. Score ${formatScore(score)}${scoreDetail ? `, ${scoreDetail}` : ''}`}
      style={[styles.row, { borderBottomColor: ds.c.line }]}
    >
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

/** Bars in an area, best first. */
export function AreaRankList({ rows }: { rows: AreaRanking[] }) {
  return (
    <View>
      {rows.map((r) => (
        <Row
          key={r.venue_profile_id}
          position={r.position}
          title={r.display_name}
          detail={[r.locality, r.city].filter(Boolean).join(', ') || 'Bar'}
          score={r.score}
          scoreDetail={`${r.rankers} ranked`}
        />
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
