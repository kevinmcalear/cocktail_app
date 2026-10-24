import { getLocales } from 'expo-localization';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Chip, useBreakpoint } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useCollection } from '@/hooks/useCollection';
import { useVenueScores } from '@/hooks/useDiscover';
import { useLovedBars, type LovedBar } from '@/hooks/useKept';
import { useMyHadDrinks } from '@/hooks/useRankings';
import { hoursStatus } from '@/lib/barHours';
import { averageScore, barNews } from '@/lib/collectionMenus';
import { beenBars, nearestFirst, type BarStage, type BeenSort } from '@/lib/collectionStages';
import { distanceKm } from '@/lib/discoverDrinks';
import { formatDistance, usesMiles } from '@/lib/nearMe';
import { formatScore } from '@/lib/ranking';
import { useLastPlace } from '@/store/useLastPlace';

import { BeenRow, WantRow, type WantBar } from './CollectionBarRows';
import { SortChoice, StageHead, StageStrip, TableHead, stageStyles } from './CollectionStages';
import { GoogleImportEntry, GoogleImportSheet } from './GoogleImport';

const BEEN_SORTS = [
  { value: 'score', label: 'Your score' },
  { value: 'recent', label: 'Recent' },
] as const;
type WantSort = 'near' | 'best' | 'open';
const WANT_SORTS = [
  { value: 'near', label: 'Nearest' },
  { value: 'best', label: 'Best scored' },
  { value: 'open', label: 'Open now' },
] as const;

/** Why a bar is on your list: the drinks you saved from it, else what it's pouring now. */
function whyLine(bar: LovedBar, saved: number): string | null {
  if (saved) return `You saved ${saved === 1 ? 'a drink' : `${saved} drinks`} from here`;
  return bar.currentMenu ? `${bar.currentMenu.name} on now` : null;
}

/** "Open until 1am", "Opens 5pm Thu", "Closed". */
function hoursText(s: { open: boolean; detail: string | null }): string {
  if (s.open) return s.detail ? `Open ${s.detail}` : 'Open now';
  return s.detail ? s.detail.charAt(0).toUpperCase() + s.detail.slice(1) : 'Closed';
}

/**
 * Collection's Bars (board home-collection-bars): Want to go → Been. Want to
 * go is the bars you love and haven't had a drink at yet, nearest first
 * (from where near me last found you), with tonight's hours and everyone's
 * score. Been is every bar you've scored a drink at: your score for it (the
 * average of yours there) beside everyone's; the heart is a filter. From
 * Google Maps brings the bars someone saved there.
 */
export function CollectionBars() {
  const desk = useBreakpoint() === 'desktop';
  const { data: loved = [], isLoading, error } = useLovedBars();
  const had = useMyHadDrinks().data ?? [];
  const saved = useCollection().data?.drinks ?? [];
  const place = useLastPlace((s) => s.place);
  const [stage, setStage] = useState<BarStage>('want');
  const [beenSort, setBeenSort] = useState<BeenSort>('score');
  const [lovedOnly, setLovedOnly] = useState(false);
  const [wantSort, setWantSort] = useState<WantSort>('near');
  const [importing, setImporting] = useState(false);
  const [now] = useState(() => Date.now());
  const allBeen = beenBars(had, beenSort);
  const beenIds = new Set(allBeen.map((b) => b.venue.id));
  const lovedById = new Map(loved.map((b) => [b.id, b]));
  const wantBars = loved.filter((b) => !beenIds.has(b.id));
  const scores = useVenueScores([...allBeen.map((b) => b.venue.id), ...wantBars.map((b) => b.id)]);
  if (error) return <Body tone="muted">Couldn’t load your bars. Try again in a moment.</Body>;
  if (isLoading) return null;

  const miles = usesMiles(getLocales()[0]);
  const want: WantBar[] = wantBars.map((b) => {
    const km = place && b.latitude != null && b.longitude != null ? distanceKm(place, { latitude: b.latitude, longitude: b.longitude }) : null;
    const status = hoursStatus(b.hours, new Date(now), b.timezone);
    return {
      id: b.id,
      handle: b.handle,
      name: b.name,
      avatarUrl: b.avatarUrl,
      place: b.place,
      km,
      away: km !== null ? formatDistance(km, miles) : null,
      hours: status ? { open: status.open, text: hoursText(status) } : null,
      why: whyLine(b, saved.filter((d) => d.barName === b.name).length),
      everyone: scores.get(b.id) ?? null,
    };
  });
  const wantShown =
    wantSort === 'best' ? [...want].sort((a, b) => (b.everyone ?? -1) - (a.everyone ?? -1)) : nearestFirst(wantSort === 'open' ? want.filter((b) => b.hours?.open) : want);
  const been = lovedOnly ? allBeen.filter((b) => lovedById.has(b.venue.id)) : allBeen;
  const avg = averageScore(allBeen.map((b) => b.yours));
  const openNow = want.filter((b) => b.hours?.open).length;

  return (
    <View style={styles.wrap}>
      <StageStrip
        label="Your bars"
        value={stage}
        onChange={setStage}
        stages={[
          { key: 'want', n: want.length, label: 'Want to go', sub: openNow ? `${openNow} open now` : null },
          { key: 'been', n: allBeen.length, label: 'Been', sub: avg !== null ? `you avg ${formatScore(avg)}` : null },
        ]}
      />
      {stage === 'want' ? (
        <View style={stageStyles.section}>
          {want.length ? (
            <>
              <StageHead>
                <SortChoice options={WANT_SORTS} value={wantSort} onChange={setWantSort} label="Sort" />
              </StageHead>
              {desk ? <TableHead cols={[{ label: 'Bar', width: null }, { label: 'Away', width: 90 }, { label: 'Tonight', width: 150 }, { label: 'Why it’s here', width: 230 }, { label: 'Everyone', width: 80, end: true }]} /> : null}
              <View role="list">
                {wantShown.map((b) => (
                  <View role="listitem" key={b.id}>
                    <WantRow bar={b} />
                  </View>
                ))}
              </View>
              {!wantShown.length ? <Body tone="muted">None of them are open right now.</Body> : null}
            </>
          ) : (
            <Body tone="muted">Tap the heart on a bar’s page to keep it here until you go.</Body>
          )}
          <View style={styles.google}>
            <GoogleImportEntry onPress={() => setImporting(true)} />
          </View>
        </View>
      ) : null}
      {stage === 'been' ? (
        <View style={stageStyles.section}>
          {allBeen.length ? (
            <>
              <StageHead>
                <View role="radiogroup" aria-label="Show" style={styles.chips}>
                  <Chip label="All" selected={!lovedOnly} quiet onPress={() => setLovedOnly(false)} />
                  <Chip label="Loved" selected={lovedOnly} quiet onPress={() => setLovedOnly(true)} />
                </View>
                <SortChoice options={BEEN_SORTS} value={beenSort} onChange={setBeenSort} label="Sort" />
              </StageHead>
              {desk ? (
                <TableHead cols={[{ label: 'Bar', width: null }, { label: 'Drinks you had', width: 150 }, { label: 'Your best there', width: 220 }, { label: 'Last time', width: 100 }, { label: 'Yours', width: 70, end: true }, { label: 'Everyone', width: 80, end: true }]} />
              ) : null}
              <View role="list">
                {been.map((b) => {
                  const l = lovedById.get(b.venue.id);
                  return (
                    <View role="listitem" key={b.venue.id}>
                      <BeenRow bar={b} loved={!!l} news={l ? barNews(l.currentMenu, l.latestRelease ? { name: l.latestRelease.name, date: l.latestRelease.date } : null) : null} everyone={scores.get(b.venue.id) ?? null} now={now} />
                    </View>
                  );
                })}
              </View>
            </>
          ) : (
            <Body tone="muted">Score a drink at a bar and the bar lands here, with your score for it.</Body>
          )}
        </View>
      ) : null}
      <GoogleImportSheet visible={importing} onClose={() => setImporting(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xl },
  chips: { flexDirection: 'row', gap: space.xs + 2 },
  google: { paddingTop: space.lg, maxWidth: 420 },
});
