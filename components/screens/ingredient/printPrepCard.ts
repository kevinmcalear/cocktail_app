import { Platform, Share } from 'react-native';

import { prepCardText, type PrepCardInput } from '@/lib/prepCard';

/** Print the card on the web (a plain window, the browser's print dialog); share it as text on a phone. */
export async function printPrepCard(card: PrepCardInput): Promise<void> {
  const text = prepCardText(card);
  if (Platform.OS === 'web') {
    const w = window.open('', '_blank', 'width=520,height=640');
    if (!w) return;
    w.document.title = `${card.name} card`;
    const pre = w.document.createElement('pre');
    pre.textContent = text;
    pre.setAttribute('style', 'font: 500 15px/1.5 ui-monospace, monospace; margin: 24px; white-space: pre-wrap');
    w.document.body.appendChild(pre);
    w.print();
    return;
  }
  await Share.share({ message: text });
}
