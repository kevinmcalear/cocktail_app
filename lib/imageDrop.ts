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
