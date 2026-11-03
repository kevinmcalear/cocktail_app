import { useRef, useState, type ComponentRef, type Ref } from 'react';
import { Platform, Share, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Caption, useGutter, useToast } from '@/components/ds';
import { PaperPage } from '@/components/paper/PaperPage';
import { space } from '@/constants/tokens';
import { dayWord, LABEL, labelText, prepLabel, tapeText, type BatchLabel } from '@/lib/paper/label';
import { showMessage } from '@/lib/dialogs';
import { printPages } from '@/lib/paper/printOut';

export { labelText, tapeText, type BatchLabel };

type PageView = ComponentRef<typeof View>;

/**
 * Print the label drawn by LabelCard: the system print sheet on a phone
 * (which also shares it, to a label printer's app or a note), the browser's
 * print on the web, at the roll's size. `ref` goes on the LabelCard.
 */
export function useLabelPrint() {
  const ref = useRef<PageView>(null);
  const [painted, setPainted] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const print = async (l: BatchLabel) => {
    if (!ref.current || busy) return;
    setBusy(true);
    try {
      const result = await printPages([ref.current], 'label', `${l.name} label`);
      if (result === 'shared') toast.show({ title: 'Printing needs the latest app. Shared a picture instead.' });
    } catch {
      showMessage('Couldn’t print the label', 'Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };
  return { ref, painted: painted && !busy, onPainted: setPainted, print };
}

/** Copy the tape line: the clipboard on the web; on a phone the share sheet, which has Copy. */
export async function copyForTape(l: BatchLabel): Promise<boolean> {
  const text = tapeText(l);
  if (Platform.OS === 'web') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
  await Share.share({ message: text });
  return false;
}

/** The label as it prints (Bet-labels): the day's colour down the side, the lines, and a code that opens the prep's page. */
export function LabelCard({ label, pageRef, onPainted, center = false }: { label: BatchLabel; pageRef?: Ref<PageView>; onPainted?: (painted: boolean) => void; center?: boolean }) {
  const gutter = useGutter();
  const { width } = useWindowDimensions();
  // Its own size where it fits (about a label's size on a phone), smaller on a narrow one.
  const unit = Math.min(1, (width - 2 * gutter) / LABEL.w);
  return (
    <View style={[styles.wrap, center && styles.center]}>
      <PaperPage ref={pageRef} page={prepLabel(label)} unit={unit} sketches={{}} onPainted={onPainted} />
      <Caption tone="muted" align={center ? 'center' : undefined}>{`The stripe is ${dayWord(label.made)}’s colour. The code opens its page.`}</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  center: { alignItems: 'center' },
});
