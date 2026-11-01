import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

function readBase64FromBlob(uri: string): Promise<string> {
    return fetch(uri)
        .then((response) => response.blob())
        .then(
            (blob) =>
                new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const result = reader.result;
                        if (typeof result !== 'string') {
                            reject(new Error('Could not read image data.'));
                            return;
                        }
                        const comma = result.indexOf(',');
                        resolve(comma >= 0 ? result.slice(comma + 1) : result);
                    };
                    reader.onerror = () => reject(reader.error ?? new Error('Could not read image file.'));
                    reader.readAsDataURL(blob);
                }),
        );
}

export async function uriToBase64(uri: string): Promise<string> {
    if (Platform.OS === 'web' || uri.startsWith('blob:') || uri.startsWith('data:')) {
        return readBase64FromBlob(uri);
    }

    return FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
}

/** Storage path ext; a blob URI has no filename (jpg), a data URI says its type (a cropped cut-out is a png). */
export function imageExtFromUri(uri: string): string {
    if (uri.startsWith('data:')) return uri.startsWith('data:image/png') ? 'png' : 'jpg';
    if (uri.startsWith('blob:')) return 'jpg';
    const ext = (uri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
    return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg';
}
