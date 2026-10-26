import { useEffect, useEffectEvent, useState } from 'react';
import { ActivityIndicator, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, GlassButton, PressableScale, sheetIsDialog, Title, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { bottleReadings, useBringInMatchData } from '@/hooks/useBringInMatchData';
import { useMatchCatalog } from '@/hooks/useMatchCatalog';
import { readingSteps, stepsDone, type ReadingStep } from '@/lib/bringIn';
import { matchSummary, pageMarks } from '@/lib/bringInMatch';
import { pickReadFiles } from '@/lib/readAnything';
import { useBringIn, type BringInJob } from '@/store/useBringIn';

import { PagePicture } from './PagePicture';
import { ReadingAsChip } from './ReadingAsChip';

function Step({ step }: { step: ReadingStep }) {
  const ds = useDs();
  const icon =
    step.state === 'done' ? <IconSymbol name="checkmark.circle.fill" size={20} color={ds.c.ink} /> : step.state === 'now' ? <ActivityIndicator size="small" color={ds.accentText} /> : <View style={[styles.ring, { borderColor: ds.c.faint }]} />;
  return (
    <View style={styles.step}>
      <View style={styles.icon}>{icon}</View>
      <Body tone={step.state === 'next' ? 'muted' : 'ink'} style={styles.flex}>
        {step.label}
        {step.detail ? <Body tone="muted">{` ${step.detail}`}</Body> : null}
      </Body>
    </View>
  );
}

/**
 * Reading (canvas make-bringin-reading): the page you gave, large, with what
 * was found boxed on it; the pages as a strip with Add a page; and the
 * reading's real steps. Done, it moves on to the check by itself; "Keep
 * using the app" leaves it reading behind the tray.
 */
/** How long a finished reading waits on the catalog before offering to search by name instead. */
const MATCH_WAIT_MS = 20_000;

export function ReadingScreen({ job, onClose, onBackground, onReady, onSearch }: { job: BringInJob; onClose: () => void; onBackground: () => void; onReady: () => void; onSearch?: () => void }) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const addPages = useBringIn((s) => s.addPages);
  const retry = useBringIn((s) => s.retry);
  const bottles = bottleReadings(job);
  const data = useBringInMatchData(job.barId, true, bottles);
  const files = job.source.files;
  const matched = job.reading && data ? matchSummary(job.reading, data) : null;
  // A snap matches on the server: the catalog only downloads if that fails (useBringInMatchData).
  const catalog = useMatchCatalog(!bottles);
  const steps = readingSteps({ pages: files.length, reading: job.reading, matched, catalog: catalog.progress });
  const progress = job.status === 'ready' && matched ? 100 : stepsDone(steps);
  const ready = job.status === 'ready' && !!matched;

  // Read and matched: on to the check, after a beat so the last tick shows.
  const moveOn = useEffectEvent(onReady);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => moveOn(), 700);
    return () => clearTimeout(t);
  }, [ready]);

  // Read, but the catalog hasn't come (a slow or no connection): don't leave them waiting on it.
  const [waited, setWaited] = useState(false);
  const waiting = job.status === 'ready' && !data;
  useEffect(() => {
    if (!waiting) return;
    const t = setTimeout(() => setWaited(true), MATCH_WAIT_MS);
    return () => clearTimeout(t);
  }, [waiting]);
  const slow = waiting && (waited || catalog.failed);

  const marks = job.reading && data ? pageMarks(job.reading, data, page) : [];
  const title = job.status === 'failed' ? 'Couldn’t read it' : files.length > 1 ? `Reading ${files.length} pages` : 'Reading';

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <GlassButton icon="xmark" accessibilityLabel="Close" onPress={onClose} />
        {files.length ? (
          <View style={styles.strip} aria-label={`${files.length} ${files.length === 1 ? 'page' : 'pages'}`}>
            {files.map((file, i) => (
              <PressableScale key={file.uri} accessibilityLabel={`Page ${i + 1}`} onPress={() => setPage(i)} style={[styles.thumb, { backgroundColor: ds.c.paper, borderColor: i === page ? ds.accentText : 'transparent', opacity: i === page ? 1 : 0.6 }]} />
            ))}
            {!job.local ? (
              <PressableScale accessibilityLabel="Add a page" onPress={() => void pickReadFiles().then((more) => addPages(more.filter((f) => !f.mimeType.startsWith('text/'))))} style={[styles.thumb, styles.add, { borderColor: ds.c.lineStrong }]}>
                <IconSymbol name="plus" size={14} color={ds.c.muted} />
              </PressableScale>
            ) : null}
          </View>
        ) : null}
      </View>
      <View style={styles.paper}>
        <PagePicture file={files[page] ?? null} text={job.source.url ?? job.source.text} width={width - space.xxl * 2} maxHeight={height * 0.48} marks={marks} style={styles.tilt} />
      </View>
      {/* A sheet-like panel on phones; on the web a card that doesn't dock to the window's edge (no bottom sheets on the web). */}
      <View style={[styles.panel, sheetIsDialog ? styles.card : styles.docked, { backgroundColor: ds.c.surface, borderColor: ds.c.glassBorder, paddingBottom: sheetIsDialog ? space.xl : insets.bottom + space.xl }]}>
        {sheetIsDialog ? null : <View style={[styles.grabber, { backgroundColor: ds.c.lineStrong }]} />}
        <View style={styles.titleRow}>
          <Title style={styles.flex} numberOfLines={2}>
            {title}
          </Title>
          <ReadingAsChip kind={job.reading?.kind ?? job.as} />
        </View>
        {job.status === 'failed' ? (
          <>
            <Caption tone="accent">{job.error}</Caption>
            <Button label="Try again" size="lg" onPress={retry} />
          </>
        ) : (
          <>
            <View style={styles.steps}>
              {steps.map((step) => (
                <Step key={step.label} step={step} />
              ))}
            </View>
            <View role="progressbar" aria-label="Reading" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} style={[styles.bar, { backgroundColor: ds.c.raised }]}>
              <View style={[styles.fill, { width: `${progress}%`, backgroundColor: ds.accentText }]} />
            </View>
            {slow ? <Caption tone="muted">{catalog.failed ? 'Couldn’t get the catalog to match against. Check your connection.' : 'Matching is taking longer than it should.'}</Caption> : null}
            {slow && onSearch ? <Button label="Search by name instead" size="lg" onPress={onSearch} /> : null}
            <Button label="Keep using the app, we’ll tell you" size="lg" variant="secondary" onPress={onBackground} />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg },
  strip: { flexDirection: 'row', gap: space.xs + 2 },
  thumb: { width: 32, height: 42, borderRadius: radius.mark, borderWidth: 2 },
  add: { borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  paper: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xxl },
  tilt: { transform: [{ rotate: '-2deg' }], shadowOpacity: 0.5, shadowRadius: 30, shadowOffset: { width: 0, height: 24 }, elevation: 12 },
  panel: { paddingTop: space.md, paddingHorizontal: space.xl - 4, gap: space.xl - 4, width: '100%', maxWidth: 560, alignSelf: 'center' },
  docked: { borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, borderTopWidth: StyleSheet.hairlineWidth },
  card: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, paddingTop: space.xl, marginBottom: space.xl },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: radius.pill },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  steps: { gap: space.xs },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 32 },
  icon: { width: 20, alignItems: 'center' },
  ring: { width: 18, height: 18, borderRadius: radius.pill, borderWidth: 1.8 },
  bar: { height: 4, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: 4 },
  flex: { flex: 1 },
});
