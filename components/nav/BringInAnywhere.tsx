import { usePathname, useRouter, type Href } from 'expo-router';
import { useEffect, useEffectEvent, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Body, Caption, Title, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { bringInChoice, isEditable } from '@/lib/bringInAnywhere';
import { withAlpha } from '@/lib/color';
import { deliverBringIn, stageBringIn, stageBringInFiles, type BringInDelivery } from '@/lib/bringInHandoff';

const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types?.includes('Files');

/**
 * Web and the desktop shell: drop photos or a PDF anywhere, or paste outside
 * a text box, and it goes to Bring in to be read. A drop zone that takes the
 * drop itself (menu pages, drink photos) keeps it. Renders the "Drop to bring
 * in" frame while something is dragged over the window.
 */
export function BringInAnywhere() {
  const ds = useDs();
  const router = useRouter();
  const pathname = usePathname();
  const [dragging, setDragging] = useState(false);

  const bring = useEffectEvent((delivery: BringInDelivery) => {
    if (pathname === '/bring-in' && deliverBringIn(delivery)) return;
    if ('files' in delivery) stageBringInFiles(delivery.files);
    else stageBringIn(delivery.text);
    router.push('/bring-in' as Href);
  });

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let depth = 0;
    const take = (files: FileList | undefined | null, text: string | null) => {
      const list = Array.from(files ?? []);
      const choice = bringInChoice(list, text);
      if (!choice) return false;
      if ('text' in choice) bring({ text: choice.text });
      else bring({ files: choice.files.map((i) => ({ uri: URL.createObjectURL(list[i]), mimeType: list[i].type })) });
      return true;
    };
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth += 1;
      setDragging(true);
    };
    // Without this the browser opens the file instead of dropping it.
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    // Drop zones stop the drop from bubbling, so the frame is cleared on the way down.
    const dropping = () => {
      depth = 0;
      setDragging(false);
    };
    const drop = (e: DragEvent) => {
      if (e.defaultPrevented || !hasFiles(e)) return;
      e.preventDefault();
      take(e.dataTransfer?.files, null);
    };
    const paste = (e: ClipboardEvent) => {
      if (e.defaultPrevented || isEditable(e.target as HTMLElement | null)) return;
      if (take(e.clipboardData?.files, e.clipboardData?.getData('text/plain') ?? null)) e.preventDefault();
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
  return (
    <View style={[styles.frame, { borderColor: ds.accentText, backgroundColor: withAlpha(ds.c.ground, 0.94) }]} aria-hidden>
      <Title>Drop to bring in</Title>
      <Body tone="muted" align="center">
        Menus, spec sheets, recipes, bottle photos. Photos and PDFs, a few at a time.
      </Body>
      <Caption tone="muted">{`Or paste anywhere with ${/Mac|iP/.test(navigator.platform) ? '⌘V' : 'Ctrl+V'}`}</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    position: 'absolute',
    top: space.lg,
    right: space.lg,
    bottom: space.lg,
    left: space.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: radius.sheet,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    padding: space.xl,
    pointerEvents: 'none',
  },
});
