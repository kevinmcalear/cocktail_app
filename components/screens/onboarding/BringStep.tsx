import * as Device from 'expo-device';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, GlassSurface, PressableScale, Tag, TextLink, useBreakpoint, useDs, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { pickReadFiles, snapReadFiles, sourcesFromFiles, type ReadFile } from '@/lib/readAnything';
import { useBringIn } from '@/store/useBringIn';

import { SetupPage } from './SetupPage';

/** The kinds of thing people bring, as quiet examples. */
export const BRING_EXAMPLES = ['Spec book PDF', 'Printed menu', 'Google Doc', 'Notes app', 'Back bar photo'];

interface BringStepProps {
  /** Where what's read comes in: the venue being set up, or null for your own bar. */
  barId: string | null;
  /** Photos or PDFs picked here: Bring in starts reading them straight away, while setup carries on. */
  onFiles: (files: ReadFile[]) => void;
  /** Paste: Bring in opens to paste into once setup is done. */
  onPaste: () => void;
  /** The pinned button(s). */
  footer: ReactNode;
  /** "Later", at the top right. */
  onLater?: () => void;
  examples?: string[];
  /** Under the three ways in: who reads it and where it lands. */
  note?: string;
  /** The last line: where to bring more in later. */
  later?: string;
  error?: string;
}

/** One way in: an accent line icon, a title and what it takes. */
function Way({ icon, title, line, onPress }: { icon: IconName; title: string; line: string; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="button" accessibilityLabel={`${title}: ${line}`} onPress={onPress} style={[styles.way, { backgroundColor: ds.c.surface, borderColor: ds.c.lineStrong }]}>
      <IconSymbol name={icon} size={22} color={ds.accentText} />
      <View style={styles.flex}>
        <DsText variant="body" style={styles.medium}>{title}</DsText>
        <Caption tone="muted">{line}</Caption>
      </View>
    </PressableScale>
  );
}

/**
 * What Bring in is reading, over the step's buttons (canvas make-onboarding-bring):
 * it keeps reading while setup carries on. ponytail: Bring in reads a job's
 * pages in one go, so the tray counts the pages, not how far through it is.
 */
function Tray() {
  const ds = useDs();
  const job = useBringIn((s) => s.job);
  if (!job) return null;
  const pages = job.source.files.length + job.more.length;
  const what = pages === 1 ? 'One page' : `${pages} pages`;
  const title = job.status === 'reading' ? 'Reading your spec book' : job.status === 'ready' ? 'Your spec book is ready to check' : 'Couldn’t read it';
  const detail = job.status === 'failed' ? (job.error ?? 'Try again from Bring in.') : `${what}. Check it when you’re done here.`;
  return (
    <GlassSurface style={[styles.tray, { borderColor: ds.c.glassBorder }]}>
      <View role="status" style={styles.trayRow}>
        {job.status === 'reading' ? <ActivityIndicator color={ds.accentText} /> : <IconSymbol name={job.status === 'ready' ? 'checkmark.circle.fill' : 'exclamationmark.circle'} size={20} color={ds.accentText} />}
        <View style={styles.flex}>
          <Body style={styles.medium}>{title}</Body>
          <Caption tone="muted">{detail}</Caption>
        </View>
      </View>
    </GlassSurface>
  );
}

/**
 * Photos or files picked (or snapped) to Bring in: it starts reading them
 * straight away, in the background, for `barId`. Says what went wrong, or null.
 */
export async function bringFiles(get: () => Promise<ReadFile[]>, barId: string | null, onFiles: (files: ReadFile[]) => void): Promise<string | null> {
  try {
    const files = await get();
    if (!files.length) return null;
    onFiles(files);
    const [first, ...rest] = await sourcesFromFiles(files, true);
    if (!first) return null;
    const store = useBringIn.getState();
    if (store.job && store.job.status !== 'failed') store.enqueue([first, ...rest]);
    else {
      store.start(first, { barId });
      store.enqueue(rest);
    }
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Couldn’t open your photos.';
  }
}

/**
 * Hand over a spec book, a menu or a shelf: snap it, pick photos or files, or
 * paste. What's picked starts reading straight away (Bring in's background
 * reader, b25) and the tray shows it while setup carries on.
 */
export function BringStep({ barId, onFiles, onPaste, footer, onLater, examples = BRING_EXAMPLES, note, later = 'You check everything before it’s saved. You can always bring things in later from the + button.', error }: BringStepProps) {
  const [problem, setProblem] = useState<string | null>(null);
  const web = Platform.OS === 'web';
  const phone = useBreakpoint() === 'phone';
  // The simulator has no camera, and launching it there crashes the app. A phone's browser opens its camera.
  const camera = web ? phone : Device.isDevice;
  const from = async (get: () => Promise<ReadFile[]>) => {
    setProblem(null);
    setProblem(await bringFiles(get, barId, onFiles));
  };
  return (
    <SetupPage
      topRight={onLater ? <TextLink label="Later" onPress={onLater} /> : undefined}
      footer={
        <>
          <Tray />
          {footer}
        </>
      }
    >
      <View style={styles.chips} accessibilityLabel={`For example: ${examples.join(', ')}`}>
        {examples.map((e) => (
          <Tag key={e} label={e} tone="outline" />
        ))}
      </View>
      <View style={styles.ways}>
        {camera ? <Way icon="camera" title="Snap it" line="Menu pages, spec sheets, the back bar" onPress={() => void from(snapReadFiles)} /> : null}
        <Way icon="photo" title={web ? 'Photos or files' : 'Photos'} line={web ? 'Screenshots, PDFs, several at once' : 'Screenshots, several at once'} onPress={() => void from(pickReadFiles)} />
        <Way icon="doc.on.clipboard" title="Paste" line="Copy from Notes, a doc, or a link" onPress={onPaste} />
      </View>
      {problem || error ? <Caption tone="accent">{problem ?? error}</Caption> : null}
      {note ? <Caption tone="muted">{note}</Caption> : null}
      <Caption tone="muted">{later}</Caption>
    </SetupPage>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  ways: { gap: space.sm },
  way: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + space.xl, paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.card, borderWidth: 1 },
  tray: { borderRadius: radius.control + 6, borderWidth: 1, overflow: 'hidden', marginBottom: space.md },
  trayRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.md + 2 },
  flex: { flex: 1, minWidth: 0 },
  medium: { fontFamily: fontFamilies.bodyMedium },
});
