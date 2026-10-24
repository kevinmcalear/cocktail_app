import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Chip, DsText, PressableScale, useBreakpoint, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, space } from '@/constants/tokens';
import { useVenueScores } from '@/hooks/useDiscover';
import { useLovedBars } from '@/hooks/useKept';
import { useMyHadDrinks } from '@/hooks/useRankings';
import { useWantToGo } from '@/hooks/useWantToGo';
import { averageScore, barNews } from '@/lib/collectionMenus';
import { beenBars, nearestFirst, type BarStage, type BeenSort } from '@/lib/collectionStages';
import { formatScore } from '@/lib/ranking';

import { BeenRow, WantRow } from './CollectionBarRows';
import { SortChoice, StageHead, StageStrip, TableHead, stageStyles } from './CollectionStages';
import { mapAvailable } from './DiscoverMap';
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

/**
 * Collection's Bars (board home-collection-bars): Want to go → Been. Want to
 * go is the bars you love and haven't had a drink at yet, nearest first
 * (from where near me last found you), with tonight's hours and everyone's
 * score. Been is every bar you've scored a drink at: your score for it (the
 * average of yours there) beside everyone's; the heart is a filter. From
 * Google Maps brings the bars someone saved there; See them on the map opens
 * Discover's map with only Want to go's bars (step 3).
 */
export function CollectionBars() {
  const desk = useBreakpoint() === 'desktop';
  const router = useRouter();
  const { data: loved = [], isLoading, error } = useLovedBars();
  const { want } = useWantToGo();
  const had = useMyHadDrinks().data ?? [];
  const [stage, setStage] = useState<BarStage>('want');
  const [beenSort, setBeenSort] = useState<BeenSort>('score');
  const [lovedOnly, setLovedOnly] = useState(false);
  const [wantSort, setWantSort] = useState<WantSort>('near');
  const [importing, setImporting] = useState(false);
  const [now] = useState(() => Date.now());
  const allBeen = beenBars(had, beenSort);
  const lovedById = new Map(loved.map((b) => [b.id, b]));
  const scores = useVenueScores(allBeen.map((b) => b.venue.id));
  if (error) return <Body tone="muted">Couldn’t load your bars. Try again in a moment.</Body>;
  if (isLoading) return null;

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
                {mapAvailable && want.some((b) => b.latitude !== null) ? <MapLink label={desk ? 'See them on the map' : 'Map'} onPress={() => router.navigate('/discover?list=want')} /> : null}
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

/** "See them on the map" (phones: "Map"), at the right of the sort. */
function MapLink({ label, onPress }: { label: string; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="link" accessibilityLabel="See your Want to go bars on the map" onPress={onPress} style={styles.mapLink} hitSlop={4}>
      <IconSymbol name="mappin.and.ellipse" size={16} color={ds.accentText} />
      <DsText variant="body" color={ds.accentText}>
        {label}
      </DsText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  mapLink: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2, minHeight: layout.minTapTarget },
  wrap: { gap: space.xl },
  chips: { flexDirection: 'row', gap: space.xs + 2 },
  google: { paddingTop: space.lg, maxWidth: 420 },
});
