import { getLocales } from 'expo-localization';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DrinkImage, DsText, Headline, PressableScale, Spec, useDs } from '@/components/ds';
// A bar's ringed monogram, or its logo (disc-list).
import { BarMark } from '@/components/screens/home/BarMark';
import { LoveBarButton } from '@/components/screens/kept/LoveBarButton';
import { space } from '@/constants/tokens';
import type { AreaRanking } from '@/hooks/useRankings';
import { useBarVersions } from '@/hooks/useSpecMatches';
import { formatDistance, usesMiles } from '@/lib/nearMe';
import { formatScore } from '@/lib/ranking';

const LOGO = 40;

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
export function AreaRankList({ rows, classicId, scoreDetail = (r) => `${r.rankers} ranked`, love = false }: { rows: AreaRow[]; classicId?: string; scoreDetail?: (r: AreaRow) => string; love?: boolean; }) {
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
            end={love ? <LoveBarButton profileId={r.venue_profile_id} name={r.display_name} /> : undefined}
          />
        );
      })}
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
  note: { paddingVertical: space.md },
});
