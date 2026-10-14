import { requireOptionalNativeModule } from 'expo';

/**
 * Whether this binary has expo-print and expo-sharing. Builds before them
 * don't, and an update must not crash there: Share falls back to text.
 */
export const canSharePdf = (): boolean => !!requireOptionalNativeModule('ExpoPrint') && !!requireOptionalNativeModule('ExpoSharing');

/**
 * The run sheet as a PDF in the share sheet (Mail, Messages, Files, AirDrop).
 * Returns false when this binary can't make one, so the caller shares text.
 */
export async function sharePdf(html: string, title: string): Promise<boolean> {
  if (!canSharePdf()) return false;
  // Loaded only once the native modules are known to be there: importing them
  // on an older binary throws.
  const [Print, Sharing] = await Promise.all([import('expo-print'), import('expo-sharing')]);
  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: title });
  return true;
}
