import * as Device from 'expo-device';
import { useRef, useState, type ComponentRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Button, Caption, TextLink, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { useReadAnything } from '@/hooks/useBulk';
import { parseBringIn, readingText } from '@/lib/paste';
import { isReadableFile, MAX_READ_FILES, pickReadFiles, type ReadFile, type ReadKind } from '@/lib/readAnything';
import { takeMenuPhoto } from '@/lib/readMenu';

import { useMenuPhotoDrop } from '../menus/useMenuPhotoDrop';

export type BringInReadResult = ReturnType<typeof readingText> & { kind: ReadKind };

interface BringInReadProps {
  mode: 'drinks' | 'ingredients';
  text: string;
  /** `replace`: the text box itself was read, so its reading takes its place. */
  onRead: (result: BringInReadResult, replace: boolean) => void;
}

/**
 * Reading for Bring in: snap or choose photos (a PDF too on web), drop them
 * here on web, or have messy pasted text read. What comes back lands in the
 * text box, to check like anything pasted.
 */
export function BringInRead({ mode, text, onRead }: BringInReadProps) {
  const ds = useDs();
  const read = useReadAnything();
  const [error, setError] = useState<string | null>(null);
  const zone = useRef<ComponentRef<typeof View>>(null);
  const web = Platform.OS === 'web';
  // The simulator has no camera, and launching it there crashes the app.
  const camera = !web && Device.isDevice;

  const go = async (input: { files?: ReadFile[]; text?: string }, replace: boolean) => {
    setError(null);
    try {
      const reading = await read.mutateAsync({ ...input, hint: mode === 'drinks' ? 'recipes' : 'bottles' });
      onRead({ ...readingText(reading), kind: reading.kind }, replace);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t read that. Try again.');
    }
  };
  const fromFiles = async (get: () => Promise<ReadFile[]>) => {
    try {
      const files = await get();
      if (files.length) await go({ files }, false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t open your photos.');
    }
  };
  const dragging = useMenuPhotoDrop(zone, (files) => void go({ files: files.slice(0, MAX_READ_FILES) }, false), isReadableFile);
  // Pasted drinks with no spec lines it could read: a caption, a social post, a recipe written out in sentences.
  const messy = mode === 'drinks' && !!text.trim() && parseBringIn(text, 'drinks').every((block) => !block.lines.length);

  return (
    <View ref={zone} style={[styles.wrap, web && [styles.zone, { borderColor: dragging ? ds.accentText : ds.c.lineStrong }]]}>
      <Caption tone="muted">{web ? 'Or read it from photos or a PDF of a spec sheet, a menu or your bottles. You can drop them here.' : 'Or read it from a photo of a spec sheet, a menu or your bottles.'}</Caption>
      <View style={styles.buttons}>
        {camera ? <Button label="Snap" icon="camera.fill" variant="secondary" onPress={() => void fromFiles(takeMenuPhoto)} disabled={read.isPending} /> : null}
        <Button label={web ? 'Photos or a PDF' : 'Photos'} icon="photo" variant="secondary" onPress={() => void fromFiles(pickReadFiles)} disabled={read.isPending} />
      </View>
      {messy && !read.isPending ? <TextLink label="Read this text with AI" accessibilityHint="Sends the text above to Google AI to find the recipes in it" onPress={() => void go({ text }, true)} /> : null}
      {read.isPending ? (
        <Caption tone="muted" role="status">
          Reading…
        </Caption>
      ) : null}
      {error ? <Caption tone="accent">{error}</Caption> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  zone: { padding: space.md, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: radius.card },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
