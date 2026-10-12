import { Platform, Share, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { toQR } from 'toqr';

import { Caption, Headline, Spec, useDs } from '@/components/ds';
import { backbar, dayHues, radius, space } from '@/constants/tokens';
import { labelDate } from '@/lib/makeSteps';

import { dayName, qrPath } from './makeLogic';

export interface BatchLabel {
  name: string;
  made: Date;
  useBy: Date | null;
  by: string;
  amount: string | null;
  storage: string | null;
  allergens: string;
  /** The prep's page, which the label's code opens. */
  url: string;
}

const madeLine = (l: BatchLabel) => `MADE ${labelDate(l.made).toUpperCase()}${l.by ? ` · ${l.by}` : ''}`;

/** The label's lines, as printed. */
export function labelText(l: BatchLabel): string {
  return [l.name, madeLine(l), l.useBy ? `USE BY ${labelDate(l.useBy).toUpperCase()}` : null, [l.amount, l.storage, l.allergens].filter(Boolean).join(' · ')]
    .filter(Boolean)
    .join('\n');
}

/** One line short enough to write on masking tape. */
export function tapeText(l: BatchLabel): string {
  return [l.name, `${labelDate(l.made)}${l.by ? ` ${l.by}` : ''}`, l.useBy ? `use by ${labelDate(l.useBy)}` : null].filter(Boolean).join(' · ');
}

const qrFor = (url: string) => qrPath(toQR(url));

/**
 * Hand the label on: on the web the browser's print, with the day stripe and
 * the code; on a phone the share sheet (a label printer's app or a note).
 * ponytail: no direct label-printer support; add a print route with a page sized to the roll when a bar asks.
 */
export async function shareLabel(l: BatchLabel) {
  const text = labelText(l);
  if (Platform.OS !== 'web') {
    await Share.share({ message: `${text}\n${l.url}` });
    return;
  }
  const w = window.open('', '_blank', 'width=460,height=320');
  if (!w) return;
  const doc = w.document;
  doc.title = `${l.name} label`;
  const card = doc.createElement('div');
  card.setAttribute('style', `display:flex;gap:12px;align-items:stretch;margin:16px;border:1px solid ${backbar.light.lineStrong};width:max-content`);
  const stripe = doc.createElement('div');
  stripe.setAttribute('style', `width:16px;background:${dayHues[l.made.getDay()]};-webkit-print-color-adjust:exact;print-color-adjust:exact`);
  const pre = doc.createElement('pre');
  pre.textContent = text;
  pre.setAttribute('style', 'font: 600 15px/1.4 ui-monospace, monospace; margin: 12px 0');
  const { d, size } = qrFor(l.url);
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('width', '84');
  svg.setAttribute('height', '84');
  svg.setAttribute('style', 'margin:12px 12px 12px 0;align-self:center');
  const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  svg.appendChild(path);
  card.append(stripe, pre, svg);
  doc.body.appendChild(card);
  w.print();
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

/** The label as it prints: the day's colour down the side, the lines, and a code that opens the prep's page. */
export function LabelCard({ label }: { label: BatchLabel }) {
  const ds = useDs();
  const { d, size } = qrFor(label.url);
  const day = dayName(label.made);
  return (
    <View style={styles.wrap}>
      <View
        role="img"
        accessibilityLabel={`Label: ${labelText(label).replace(/\n/g, ', ')}. ${day} colour. Code that opens its page.`}
        style={[styles.label, { borderColor: ds.c.lineStrong, backgroundColor: backbar.light.surface }]}
      >
        <View style={[styles.stripe, { backgroundColor: dayHues[label.made.getDay()] }]} />
        <View style={styles.lines}>
          <Headline color={backbar.light.ink}>{label.name}</Headline>
          <Spec color={backbar.light.ink}>{madeLine(label)}</Spec>
          {label.useBy ? <Spec color={backbar.light.ink}>{`USE BY ${labelDate(label.useBy).toUpperCase()}`}</Spec> : null}
          <Caption color={backbar.light.muted}>{[label.amount, label.storage, label.allergens].filter(Boolean).join(' · ')}</Caption>
        </View>
        <Svg width={72} height={72} viewBox={`0 0 ${size} ${size}`} style={styles.code}>
          <Path d={d} fill={backbar.light.ink} />
        </Svg>
      </View>
      <Caption tone="muted">{`The stripe is ${day}'s colour. The code opens this prep's page.`}</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  label: { alignSelf: 'flex-start', flexDirection: 'row', maxWidth: '100%', borderWidth: 1, borderRadius: radius.mark, overflow: 'hidden' },
  stripe: { width: space.lg },
  lines: { flexShrink: 1, padding: space.md, gap: 2 },
  code: { alignSelf: 'center', marginRight: space.md },
});
