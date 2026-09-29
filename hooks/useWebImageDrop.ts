import { useEffect, useEffectEvent, useRef } from 'react';
import { Platform, type View } from 'react-native';

import { imageUrisFromDataTransfer } from '@/lib/imageDrop';

/**
 * Web: accept image file drops on a View. Put the returned ref on it. React
 * Native Web's View doesn't pass drag events through as props, so this
 * listens on its DOM node. Does nothing on native, or without `onUris`.
 */
export function useWebImageDrop(onUris: ((uris: string[]) => void) | undefined, onActive?: (active: boolean) => void) {
    const ref = useRef<View>(null);
    const enabled = Platform.OS === 'web' && !!onUris;
    const dropped = useEffectEvent((uris: string[]) => onUris?.(uris));
    const active = useEffectEvent((value: boolean) => onActive?.(value));

    useEffect(() => {
        const node = ref.current as unknown as HTMLElement | null;
        if (!enabled || !node?.addEventListener) return;
        let depth = 0;
        const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types?.includes('Files');
        const onEnter = (e: DragEvent) => {
            if (!hasFiles(e)) return;
            e.preventDefault();
            depth += 1;
            active(true);
        };
        const onOver = (e: DragEvent) => {
            if (!hasFiles(e)) return;
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        };
        const onLeave = (e: DragEvent) => {
            if (!hasFiles(e)) return;
            depth = Math.max(0, depth - 1);
            if (depth === 0) active(false);
        };
        const onDrop = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            depth = 0;
            active(false);
            const uris = imageUrisFromDataTransfer(e.dataTransfer);
            if (uris.length) dropped(uris);
        };
        node.addEventListener('dragenter', onEnter);
        node.addEventListener('dragover', onOver);
        node.addEventListener('dragleave', onLeave);
        node.addEventListener('drop', onDrop);
        return () => {
            node.removeEventListener('dragenter', onEnter);
            node.removeEventListener('dragover', onOver);
            node.removeEventListener('dragleave', onLeave);
            node.removeEventListener('drop', onDrop);
        };
    }, [enabled]);

    return ref;
}
