import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, GlassButton, PencilState, PressableScale, useDs } from '@/components/ds';
import { SegmentedCapsule } from '@/components/ds/SegmentedCapsule';
import { ListNote, OutlineRows, RowName } from '@/components/ds/ListGroup';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space, STATUS } from '@/constants/tokens';
import { useMyProfile } from '@/hooks/useMyProfile';
import { useProfilePositions } from '@/hooks/useProfiles';
import { useLovedRows, useWantToGo } from '@/hooks/useWantToGo';
import { nearestFirst, wantCamera, wantLine, wantPins, type WantBar } from '@/lib/collectionStages';
import { readableAccent } from '@/lib/color';
import { confirmedJob } from '@/lib/profiles';
import { whenIdle } from '@/lib/idleQueue';
import { useLastPlace } from '@/store/useLastPlace';

import { YouPage } from '../profile/YouPage';
import { BarMark } from './BarMark';
import { DiscoverMap, mapAvailable } from './DiscoverMap';
import { GoogleImportSheet } from './GoogleImport';
import { WantToGoMap } from './WantToGoMapLazy';

type Tab = 'loved' | 'want';
const TABS = [
  { value: 'loved', label: 'Loved' },
  { value: 'want', label: 'Want to go' },
] as const;
const noMove = () => {};

/**
 * Your bars (Kept-you-bars), opened from You: the bars you love with what's
 * new there, and the ones you want to go to, nearest first, on a small map
 * that opens Discover's. The header's button brings bars in from Google Maps.
 * This is where Collection's Bars went; how a bar scored for you stays on
 * /your-drinks, in Bars.
 */
export function YourBarsScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === 'want' ? 'want' : 'loved');
  const [importing, setImporting] = useState(false);
  return (
    <YouPage title="Your bars" actions={<GlassButton icon="square.and.arrow.down" accessibilityLabel="Bring in from Google Maps" onPress={() => setImporting(true)} />}>
      <SegmentedCapsule options={TABS} value={tab} onChange={setTab} accessibilityLabel="Your bars" />
      {tab === 'loved' ? <Loved /> : <Want />}
      <GoogleImportSheet visible={importing} onClose={() => setImporting(false)} />
    </YouPage>
  );
}

function BarRow({
  bar,
  line,
  open,
  first,
}: {
  bar: {
    id: string;
    handle: string | null;
    name: string;
    avatarUrl: string | null;
  };
  line: string | null;
  open?: boolean;
  first: boolean;
}) {
  const ds = useDs();
  const router = useRouter();
  return (
    <View role="listitem">
      <PressableScale
        role="link"
        accessibilityLabel={[bar.name, line, open ? 'Open' : null].filter(Boolean).join('. ')}
        onPress={() => router.push(`/p/${bar.handle || bar.id}` as Href)}
        style={[styles.row, { borderTopColor: first ? 'transparent' : ds.c.line }]}
      >
        <BarMark name={bar.name} logoUrl={bar.avatarUrl} profileId={bar.id} size={44} />
        <View style={styles.words}>
          <RowName>{bar.name}</RowName>
          {line ? (
            <Caption tone="muted" numberOfLines={1}>
              {line}
            </Caption>
          ) : null}
        </View>
        {open ? <Body color={readableAccent(STATUS.success, ds.c.ground)}>Open</Body> : <IconSymbol name="chevron.right" size={16} color={ds.c.faint} />}
      </PressableScale>
    </View>
  );
}

function Loved() {
  const { data: profile } = useMyProfile();
  const positions = useProfilePositions(profile ? { id: profile.id, kind: 'person' } : null).data ?? [];
  const { rows, isLoading, error } = useLovedRows(new Set(positions.filter((p) => p.is_current && confirmedJob(p)).map((p) => p.bar.id)));
  if (error) return <PencilState kind="error" title="Your bars didn’t load" detail="The connection dropped halfway." />;
  if (isLoading) return <OutlineRows count={5} round pic={44} />;
  if (!rows.length) return <PencilState kind="empty" title="No loved bars yet" detail="Tap the heart on a bar’s page and it stays here." />;
  return (
    <>
      <View role="list">
        {rows.map((r, i) => (
          <BarRow key={r.bar.id} bar={r.bar} line={r.line} first={!i} />
        ))}
      </View>
      <ListNote icon="clock" text="New menus and events from bars you love show in This week, on Tonight." />
    </>
  );
}

function Want() {
  const { want, isLoading, error } = useWantToGo();
  if (error) return <PencilState kind="error" title="Your bars didn’t load" detail="The connection dropped halfway." />;
  if (isLoading) return <OutlineRows count={5} round pic={44} />;
  if (!want.length) return <PencilState kind="empty" title="Nowhere on your list yet" detail="Tap the heart on a bar’s page to keep it here until you go." />;
  const rows = nearestFirst(want);
  return (
    <>
      {mapAvailable && rows.some((b) => b.latitude !== null) ? <WantCard rows={rows} /> : null}
      <View role="list">
        {rows.map((b, i) => (
          <BarRow key={b.id} bar={b} line={wantLine(b)} open={b.hours?.open} first={!i} />
        ))}
      </View>
    </>
  );
}

/** The small map above Want to go (Kept-you-bars): a picture of them; tapping it opens Discover's map with only these bars. */
function WantCard({ rows }: { rows: WantBar[] }) {
  const ds = useDs();
  const router = useRouter();
  const place = useLastPlace((s) => s.place);
  const [camera] = useState(() => wantCamera(rows));
  const open = rows.filter((b) => b.hours?.open).length;
  // The map this card opens loads on its own on the web: start it now, while the card shows.
  useEffect(() => whenIdle(WantToGoMap.preload), []);
  return (
    <PressableScale role="link" accessibilityLabel="See your Want to go bars on the map" onPress={() => router.navigate('/discover?list=want')} style={[styles.map, { backgroundColor: ds.c.surface }]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <DiscoverMap
          pins={wantPins(rows)}
          me={place ? { latitude: place.latitude, longitude: place.longitude } : null}
          selectedId={null}
          onSelect={noMove}
          onViewportChange={noMove}
          camera={camera}
          scheme={ds.scheme}
          accent={ds.accentFill}
          compact
        />
      </View>
      {open ? (
        <View style={[styles.caption, { backgroundColor: ds.c.surface }]}>
          <Caption>{`${open} open now`}</Caption>
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 64,
    paddingVertical: space.sm + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  words: { flex: 1, minWidth: 0 },
  map: {
    height: 196,
    borderRadius: radius.card,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  caption: {
    position: 'absolute',
    left: space.md,
    bottom: space.md,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
  },
});
