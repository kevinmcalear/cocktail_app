import * as Clipboard from 'expo-clipboard';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';

import { Button, Caption, TextLink } from '@/components/ds';
import { space } from '@/constants/tokens';
import type { RunSheet } from '@/lib/runSheet';
import { runSheetHtml } from '@/lib/runSheetHtml';
import { runSheetText } from '@/lib/runSheetText';

import type { PartyLook } from './parts';
import { SendLists } from './SendLists';
import { canSharePdf, sharePdf } from './sharePdf';
import { SheetPaper } from './SheetPaper';

type Menu = { id: string; name: string; startsAt: string | null; endsAt: string | null };

/**
 * Print or save as PDF (web: the bare print page). On a phone, Share sends a
 * PDF when the binary has expo-print and expo-sharing, else the sheet as text.
 */
export function useSheetActions(sheet: RunSheet, menu: Menu, breakDown = false) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const web = Platform.OS === 'web';
  const query = `margin=${sheet.marginPct}${breakDown ? '&breakdown=1' : ''}`;
  return {
    web,
    copied,
    print: () => router.push(`/menus/${menu.id}/run-sheet/print?print=1&${query}` as Href),
    openFull: () => router.push(`/menus/${menu.id}/run-sheet/print?${query}` as Href),
    pdf: !web && canSharePdf(),
    shareText: () => void Share.share({ title: `Run sheet: ${menu.name}`, message: runSheetText(sheet, menu) }),
    share: async () => {
      const title = `Run sheet: ${menu.name}`;
      // A PDF that fails to make (low storage, a print service error) still goes out as text.
      const sent = await sharePdf(runSheetHtml(sheet, menu), title).catch(() => false);
      if (!sent) await Share.share({ title, message: runSheetText(sheet, menu) });
    },
    copy: async () => {
      await Clipboard.setStringAsync(runSheetText(sheet, menu));
      setCopied(true);
    },
  };
}

/** Step 4 on a phone: a look at the sheet, print, save or share it, and send each bar or brand their list (boards "4. The sheet", R1). */
export function SheetStep({ sheet, menu, breakDown, looks, claimUrls }: { sheet: RunSheet; menu: Menu; breakDown: boolean; looks: PartyLook[]; claimUrls: Record<string, string> }) {
  const a = useSheetActions(sheet, menu, breakDown);
  return (
    <View style={{ gap: space.lg }}>
      <View role="img" aria-label="Preview of the run sheet" style={styles.preview}>
        <SheetPaper sheet={sheet} menu={menu} variant="mini" />
      </View>
      <Caption tone="muted">
        A4 · <TextLink label="Open full size" onPress={a.openFull} />
      </Caption>
      <View style={{ gap: space.sm }}>
        {a.web ? (
          <Button label="Save as PDF or print" icon="printer" size="lg" onPress={a.print} />
        ) : (
          <Button label={a.pdf ? 'Share PDF' : 'Share'} icon="square.and.arrow.up" size="lg" accessibilityHint={a.pdf ? 'Mail, Messages, Files or AirDrop, as an A4 PDF' : 'Send it by Mail, Messages or anything else as text'} onPress={() => void a.share()} />
        )}
        {a.pdf ? <Button label="Share as text" variant="secondary" onPress={a.shareText} /> : null}
        <Button label={a.copied ? 'Copied' : 'Copy as text'} variant="secondary" icon="doc.on.doc" onPress={a.copy} />
      </View>
      <Caption tone="muted">
        {a.web
          ? 'Pick “Save as PDF” in the print dialog to send it. Changes to serves or swaps update the sheet straight away.'
          : `Share opens Mail, Messages and the rest${a.pdf ? ' with the PDF attached' : ''}. Changes to serves or swaps update the sheet straight away.`}
      </Caption>
      <SendLists sheet={sheet} menu={menu} looks={looks} claimUrls={claimUrls} />
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { overflow: 'hidden' },
});
