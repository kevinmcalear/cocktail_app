/** Image file URIs from a browser file drop (blob: object URLs). */
export function imageUrisFromDataTransfer(dt: DataTransfer | null | undefined): string[] {
    if (!dt?.files?.length) return [];
    const uris: string[] = [];
    for (let i = 0; i < dt.files.length; i++) {
        const file = dt.files[i];
        if (file?.type?.startsWith('image/')) uris.push(URL.createObjectURL(file));
    }
    return uris;
}

/** RN-web View props: accept image file drops. */
export function webImageDropProps(
    onUris: ((uris: string[]) => void) | undefined,
    onActive?: (active: boolean) => void,
): Record<string, unknown> | undefined {
    if (!onUris) return undefined;
    let depth = 0;
    return {
        onDragEnter: (e: any) => {
            if (!e?.dataTransfer?.types?.includes?.('Files')) return;
            e.preventDefault?.();
            depth += 1;
            onActive?.(true);
        },
        onDragOver: (e: any) => {
            if (!e?.dataTransfer?.types?.includes?.('Files')) return;
            e.preventDefault?.();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        },
        onDragLeave: (e: any) => {
            if (!e?.dataTransfer?.types?.includes?.('Files')) return;
            depth = Math.max(0, depth - 1);
            if (depth === 0) onActive?.(false);
        },
        onDrop: (e: any) => {
            e.preventDefault?.();
            e.stopPropagation?.();
            depth = 0;
            onActive?.(false);
            const uris = imageUrisFromDataTransfer(e?.dataTransfer);
            if (uris.length) onUris(uris);
        },
    };
}
