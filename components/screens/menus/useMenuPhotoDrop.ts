import { useEffect, useRef, useState, type ComponentRef, type RefObject } from 'react';
import { Platform, View } from 'react-native';

import type { MenuPhoto } from '@/lib/readMenu';

/**
 * Web (and the desktop shell): photos dragged onto `target` arrive as menu
 * pages. On native it does nothing. Returns whether something is being
 * dragged over it, to show the drop target.
 */
export function useMenuPhotoDrop(target: RefObject<ComponentRef<typeof View> | null>, onPhotos: (photos: MenuPhoto[]) => void): boolean {
  const [over, setOver] = useState(false);
  const latest = useRef(onPhotos);
  useEffect(() => {
    latest.current = onPhotos;
  });
  useEffect(() => {
    // On web a View's ref is its DOM element.
    const node = Platform.OS === 'web' ? (target.current as unknown as HTMLElement | null) : null;
    if (!node) return;
    const enter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      setOver(true);
    };
    const leave = (e: DragEvent) => {
      if (!node.contains(e.relatedTarget as Node | null)) setOver(false);
    };
    const drop = (e: DragEvent) => {
      e.preventDefault();
      setOver(false);
      const files = Array.from(e.dataTransfer?.files ?? []).filter((file) => file.type.startsWith('image/'));
      if (files.length) latest.current(files.map((file) => ({ uri: URL.createObjectURL(file), mimeType: file.type })));
    };
    node.addEventListener('dragenter', enter);
    node.addEventListener('dragover', enter);
    node.addEventListener('dragleave', leave);
    node.addEventListener('drop', drop);
    return () => {
      node.removeEventListener('dragenter', enter);
      node.removeEventListener('dragover', enter);
      node.removeEventListener('dragleave', leave);
      node.removeEventListener('drop', drop);
    };
  }, [target]);
  return over;
}
