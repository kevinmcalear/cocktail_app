import * as Device from 'expo-device';
import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, PressableScale, Surface, Tag, TextLink, useDs, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { pickReadFiles, type ReadFile } from '@/lib/readAnything';
import { takeMenuPhoto } from '@/lib/readMenu';

import { SetupPage } from './SetupPage';

/** The kinds of thing people bring, as quiet examples. */
export const BRING_EXAMPLES = ['Spec book PDF', 'Printed menu', 'Google Doc', 'Notes app', 'Back bar photo'];

interface BringStepProps {
  /** Photos or PDFs picked here: kept for Bring in to read once setup is done. */
  onFiles: (files: ReadFile[]) => void;
  /** Paste: Bring in opens to paste into once setup is done. */
  onPaste: () => void;
  /** What's waiting to be read, for the tray: "3 photos". */
  waiting: string | null;
  /** The pinned button(s). */
  footer: ReactNode;
  /** "Later", at the top right. */
  onLater?: () => void;
  examples?: string[];
  /** Under the three ways in: who reads it and where it lands. */
  note?: string;
  error?: string;
}

/** One way in: an accent icon, a title and what it takes. */
function Way({ icon, title, line, onPress }: { icon: IconName; title: string; line: string; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="button" accessibilityLabel={`${title}: ${line}`} onPress={onPress} style={[styles.way, { backgroundColor: ds.c.raised }]}>
      <IconSymbol name={icon} size={22} color={ds.accentText} />
      <View style={styles.flex}>
        <DsText variant="headline">{title}</DsText>
        <Caption tone="muted">{line}</Caption>
      </View>
    </PressableScale>
  );
}

/**
 * Hand over a spec book, a menu or a shelf: snap it, pick photos or files, or
 * paste. What's picked waits in the tray and Bring in reads it as soon as
 * setup is done. ponytail: reading it in the background while setup carries
 * on (b25) belongs to Bring in's own background reader; until that lands the
 * tray says it's waiting rather than counting pages.
 */
export function BringStep({ onFiles, onPaste, waiting, footer, onLater, examples = BRING_EXAMPLES, note, error }: BringStepProps) {
  const ds = useDs();
  const [problem, setProblem] = useState<string | null>(null);
  const web = Platform.OS === 'web';
  // The simulator has no camera, and launching it there crashes the app.
  const camera = !web && Device.isDevice;
  const from = async (get: () => Promise<ReadFile[]>) => {
    setProblem(null);
    try {
      const files = await get();
      if (files.length) onFiles(files);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Couldn’t open your photos.');
    }
  };
  return (
    <SetupPage
      topRight={onLater ? <TextLink label="Later" onPress={onLater} /> : undefined}
      footer={
        <>
          {waiting ? (
            <View role="status">
              <Surface style={styles.tray}>
                <IconSymbol name="doc.text" size={20} color={ds.accentText} />
                <View style={styles.flex}>
                  <Body style={styles.strong}>{`${waiting} ready to read`}</Body>
                  <Caption tone="muted">We read it as soon as you finish here. You check everything before it’s saved.</Caption>
                </View>
              </Surface>
            </View>
          ) : null}
          {footer}
        </>
      }
    >
      <View style={styles.chips} accessibilityLabel={`For example: ${examples.join(', ')}`}>
        {examples.map((e) => (
          <Tag key={e} label={e} />
        ))}
      </View>
      <View style={styles.ways}>
        {camera ? <Way icon="camera.fill" title="Snap it" line="Menu pages, spec sheets, the back bar" onPress={() => void from(takeMenuPhoto)} /> : null}
        <Way icon="photo" title={web ? 'Photos or files' : 'Photos'} line={web ? 'Screenshots, PDFs, several at once' : 'Screenshots, several at once'} onPress={() => void from(pickReadFiles)} />
        <Way icon="doc.on.doc" title="Paste" line="Copy from Notes, a doc, or a link" onPress={onPaste} />
      </View>
      {problem || error ? <Caption tone="accent">{problem ?? error}</Caption> : null}
      {note ? <Caption tone="muted">{note}</Caption> : null}
      <Caption tone="muted">You can always bring things in later from the + button.</Caption>
    </SetupPage>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  ways: { gap: space.sm },
  way: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + space.xl, paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.card },
  tray: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.sm },
  flex: { flex: 1, minWidth: 0 },
  strong: { fontFamily: fontFamilies.bodySemiBold },
});
