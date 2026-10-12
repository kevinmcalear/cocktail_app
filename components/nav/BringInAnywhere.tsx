import { useEffect, useEffectEvent, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Body, Caption, Display, DsText, useDs } from '@/components/ds';
import { useStartBringIn } from '@/components/screens/bringin/useStartBringIn';
import { useBringInPlace } from '@/hooks/useBringInPlace';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { bringInChoice, isEditable } from '@/lib/bringInAnywhere';
import { withAlpha } from '@/lib/color';
import { sourcesFromFiles } from '@/lib/readAnything';

const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types?.includes('Files');

/** What's being dragged, as far as the browser says before the drop: only the kinds, never the names. */
type Dragged = { kind: 'pdf' | 'photo' | 'text' | 'other' };

function draggedOf(e: DragEvent): Dragged[] {
  return Array.from(e.dataTransfer?.items ?? [])
    .filter((item) => item.kind === 'file')
    .map((item) => ({ kind: item.type === 'application/pdf' ? 'pdf' : item.type.startsWith('image/') ? 'photo' : /^text\/|csv/.test(item.type) ? 'text' : 'other' }));
}

const CARD: Record<Dragged['kind'], { icon: 'doc.text' | 'photo' | 'doc.plaintext'; label: string }> = {
  pdf: { icon: 'doc.text', label: 'A PDF' },
  photo: { icon: 'photo', label: 'A photo' },
  text: { icon: 'doc.plaintext', label: 'Text or a .csv' },
  other: { icon: 'doc.text', label: 'A file we can’t read' },
};

/**
 * Web and the desktop shell: drop photos, PDFs, text or .csv anywhere, or
 * paste outside a text box, and Bring in reads it. Each dropped file gets its
 * own check, one after another. A drop zone that takes the drop itself
 * (menu pages, drink photos) keeps it. While something is dragged over the
 * page, the "Drop to bring in" dialog sits over it, beside the sidebar
 * (canvas make-bringin-drop).
 */
export function BringInAnywhere() {
  const ds = useDs();
  const start = useStartBringIn();
  const place = useBringInPlace();
  const [dragging, setDragging] = useState<Dragged[] | null>(null);

  const take = useEffectEvent((files: File[], text: string | null) => {
    const choice = bringInChoice(files, text);
    if (!choice) return false;
    if ('text' in choice) start([{ files: [], text: choice.text, url: null }], { barId: place.barId });
    else {
      const picked = choice.files.map((i) => files[i]).map((file) => ({ uri: URL.createObjectURL(file), mimeType: file.type || 'text/plain', name: file.name }));
      void sourcesFromFiles(picked, true).then((sources) => start(sources, { barId: place.barId }));
    }
    return true;
  });

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let depth = 0;
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth += 1;
      setDragging(draggedOf(e));
    };
    // Without this the browser opens the file instead of dropping it.
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(null);
    };
    // Drop zones stop the drop from bubbling, so the dialog is cleared on the way down.
    const dropping = () => {
      depth = 0;
      setDragging(null);
    };
    const drop = (e: DragEvent) => {
      if (e.defaultPrevented || !hasFiles(e)) return;
      e.preventDefault();
      take(Array.from(e.dataTransfer?.files ?? []), null);
    };
    const paste = (e: ClipboardEvent) => {
      if (e.defaultPrevented || isEditable(e.target as HTMLElement | null)) return;
      if (take(Array.from(e.clipboardData?.files ?? []), e.clipboardData?.getData('text/plain') ?? null)) e.preventDefault();
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', dropping, true);
    window.addEventListener('drop', drop);
    window.addEventListener('paste', paste);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', dropping, true);
      window.removeEventListener('drop', drop);
      window.removeEventListener('paste', paste);
    };
  }, []);

  if (!dragging) return null;
  const key = /Mac|iP/.test(navigator.platform) ? '⌘V' : 'Ctrl+V';
  return (
    <View style={[styles.scrim, { backgroundColor: ds.c.scrim }]} pointerEvents="none">
      <View role="dialog" aria-label="Drop to bring in" style={[styles.frame, { borderColor: ds.accentText, backgroundColor: withAlpha(ds.accentText, 0.05) }]}>
        <IconSymbol name="square.and.arrow.down" size={56} color={ds.accentText} />
        <View style={styles.words}>
          <Display align="center">Drop to bring in</Display>
          <Body tone="muted" align="center">
            Menus, specs, recipes, bottle photos. Images, PDFs, text and .csv. Several at once is fine.
          </Body>
        </View>
        {dragging.length ? (
          <View role="list" aria-label="Files" style={styles.cards}>
            {dragging.slice(0, 6).map((file, i) => (
              <View key={i} role="listitem" style={[styles.card, { backgroundColor: ds.c.surface, borderColor: ds.c.glassBorder }]}>
                <IconSymbol name={CARD[file.kind].icon} size={28} color={ds.c.ink} />
                <View style={styles.flex}>
                  <Body numberOfLines={1}>{CARD[file.kind].label}</Body>
                  <Caption tone="muted">{file.kind === 'other' ? 'Left out' : 'We’ll work out what it is'}</Caption>
                </View>
              </View>
            ))}
          </View>
        ) : null}
        <Body tone="muted" align="center">
          {'Each file gets its own check, one after another. Or paste anywhere with '}
          <DsText variant="caption" style={[styles.key, { borderColor: ds.c.lineStrong, backgroundColor: ds.c.raised }]}>
            {key}
          </DsText>
        </Body>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 50 },
  frame: {
    position: 'absolute',
    top: space.xl,
    right: space.xl,
    bottom: space.xl,
    left: space.xl,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xl + 4,
    padding: space.xxl + 8,
  },
  words: { gap: space.sm, alignItems: 'center' },
  cards: { width: '100%', maxWidth: 820, flexDirection: 'row', flexWrap: 'wrap', gap: space.md + 2, justifyContent: 'center' },
  card: { flexBasis: 240, flexGrow: 1, maxWidth: 270, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg, borderRadius: radius.control + 4, borderWidth: 1 },
  flex: { flex: 1, minWidth: 0 },
  key: { borderWidth: 1, borderRadius: radius.mark, paddingHorizontal: 7, paddingVertical: 2 },
});
