import { getLocales } from 'expo-localization';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Headline, PressableScale, useDs } from '@/components/ds';
// A bar's ringed monogram, or its logo (disc-list).
import { BarMark } from '@/components/screens/home/BarMark';
import { LoveBarButton } from '@/components/screens/kept/LoveBarButton';
import { space } from '@/constants/tokens';
import type { AreaRanking } from '@/hooks/useRankings';
import { useBarVersions } from '@/hooks/useSpecMatches';
import { formatDistance, rankedCount, usesMiles, type DiscoverRow } from '@/lib/nearMe';

import { ScoreRow } from './ScoreRows';

const LOGO = 40;

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
          <ScoreRow
            key={r.venue_profile_id}
            position={r.position}
            title={r.display_name}
            sub={[placeOf(r), pour?.label].filter(Boolean).join(' · ')}
            score={r.score}
            scoreDetail={scoreDetail(r)}
            logo={classicId ? undefined : r.avatar_url}
            barId={r.venue_profile_id}
            itemId={classicId ? (pour?.itemId ?? classicId) : undefined}
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
  flex: { flex: 1, minWidth: 0 },
  note: { paddingVertical: space.md },
});
