import { usePathname, useRouter, type Href } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, GlassSurface, useBreakpoint, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { foundLine, readingName } from '@/lib/bringIn';
import { canNudge } from '@/lib/readyNudge';
import { useBringIn, type BringInJob } from '@/store/useBringIn';

/** "Reading 2 pages", "Reading your link". */
function readingWhat(job: BringInJob): string {
  if (job.source.url) return 'Reading your link';
  const pages = job.source.files.length;
  if (!pages) return 'Reading your text';
  return pages === 1 ? 'Reading your page' : `Reading ${pages} pages`;
}

function words(job: BringInJob, queued: number): { title: string; detail: string } {
  const next = queued ? ` ${queued} more after this.` : '';
  if (job.status === 'failed') return { title: 'Couldn’t read it', detail: job.error ?? 'Try again.' };
  if (job.status === 'ready' && job.reading) {
    const name = readingName(job.reading);
    const r = job.reading;
    const many = r.kind === 'recipes' ? r.recipes.length !== 1 : r.kind === 'bottles' && r.bottles.length + (r.unreadable?.length ?? 0) !== 1;
    return { title: `${name.charAt(0).toUpperCase()}${name.slice(1)} ${many ? 'are' : 'is'} ready to check`, detail: `${foundLine(job.reading)}.${next}` };
  }
  return { title: readingWhat(job), detail: `${canNudge() ? 'We’ll tap you when it’s ready.' : 'It says so here when it’s ready.'}${next}` };
}

/**
 * The reading carries on while you use the app (canvas make-bringin-tray): a
 * glass chip above the tab bar (bottom right on wide screens) with Open.
 */
export function ReadingTray() {
  const ds = useDs();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const wide = useBreakpoint() !== 'phone';
  const job = useBringIn((s) => s.job);
  const queued = useBringIn((s) => s.queue.length);
  const foreground = useBringIn((s) => s.foreground);
  if (!job || foreground || pathname.startsWith('/bring-in')) return null;
  const { title, detail } = words(job, queued);

  return (
    <View pointerEvents="box-none" style={[styles.place, wide ? styles.wide : { left: space.md, right: space.md, bottom: insets.bottom + 88 }]}>
      <GlassSurface style={[styles.chip, { borderColor: ds.c.glassBorder }]}>
        <View role="status" style={styles.row}>
          {job.status === 'reading' ? <ActivityIndicator color={ds.accentText} /> : <IconSymbol name={job.status === 'ready' ? 'checkmark.circle.fill' : 'exclamationmark.circle'} size={22} color={ds.accentText} />}
          <View style={styles.flex}>
            <Body numberOfLines={1}>{title}</Body>
            <Caption tone="muted" numberOfLines={2}>
              {detail}
            </Caption>
          </View>
          <Button label="Open" variant="secondary" onPress={() => router.push('/bring-in' as Href)} />
        </View>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  place: { position: 'absolute', zIndex: 20 },
  wide: { right: space.xl, bottom: space.xl, width: 420 },
  chip: { borderRadius: radius.control + 6, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.md + 2 },
  flex: { flex: 1, minWidth: 0 },
});
