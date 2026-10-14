import * as Clipboard from 'expo-clipboard';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';

import { Button, Caption, TextLink } from '@/components/ds';
import { space } from '@/constants/tokens';
import type { RunSheet } from '@/lib/runSheet';
import { runSheetText } from '@/lib/runSheetText';

import { SheetPaper } from './SheetPaper';

type Menu = { id: string; name: string; startsAt: string | null; endsAt: string | null };

/** Print or save as PDF (web: the bare print page), or share as text (phones, today's binary). */
export function useSheetActions(sheet: RunSheet, menu: Menu, breakDown = false) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const web = Platform.OS === 'web';
  return {
    web,
    copied,
    print: () => router.push(`/menus/${menu.id}/run-sheet/print?print=1${breakDown ? '&breakdown=1' : ''}` as Href),
    openFull: () => router.push(`/menus/${menu.id}/run-sheet/print${breakDown ? '?breakdown=1' : ''}` as Href),
    share: () => void Share.share({ title: `Run sheet: ${menu.name}`, message: runSheetText(sheet, menu) }),
    copy: async () => {
      await Clipboard.setStringAsync(runSheetText(sheet, menu));
      setCopied(true);
    },
  };
}

/** Step 4 on a phone: a look at the sheet, then print, save or share it (board "4. The sheet"). */
export function SheetStep({ sheet, menu, breakDown }: { sheet: RunSheet; menu: Menu; breakDown: boolean }) {
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
          <Button label="Share" icon="square.and.arrow.up" size="lg" accessibilityHint="Send it by Mail, Messages or anything else as text" onPress={a.share} />
        )}
        <Button label={a.copied ? 'Copied' : 'Copy as text'} variant="secondary" icon="doc.on.doc" onPress={a.copy} />
      </View>
      <Caption tone="muted">
        {a.web
          ? 'Pick “Save as PDF” in the print dialog to send it. Changes to serves or swaps update the sheet straight away.'
          : 'Share opens Mail, Messages and the rest. Changes to serves or swaps update the sheet straight away.'}
      </Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { overflow: 'hidden' },
});
