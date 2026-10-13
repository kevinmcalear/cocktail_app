// The web saves its PDF from the print page (window.print), so it never loads expo-print.
export const canSharePdf = (): boolean => false;

export async function sharePdf(_html: string, _title: string): Promise<boolean> {
  return false;
}
