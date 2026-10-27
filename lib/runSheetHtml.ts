/**
 * The run sheet as a printable HTML page (A4), for expo-print to turn into a
 * PDF on a phone. The same content and order as the web print page
 * (components/screens/runSheet/SheetPaper.tsx). Pure.
 */

import { printPaper as P } from '@/constants/tokens';

import type { RunSheet } from './runSheet';
import { needAmount, sheetHead, type PartyList } from './runSheetText';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ponytail: the phone's own serif and sans, not the app's Instrument Serif and
// Geist; embedding the fonts would mean base64 font files in the bundle.
const CSS = `
@page { size: A4; margin: 14mm; }
* { box-sizing: border-box; }
body { margin: 0; color: ${P.ink}; background: ${P.paper}; font: 14px/1.45 -apple-system, "Helvetica Neue", Roboto, Arial, sans-serif; }
h1, h3.drink { font-family: "Iowan Old Style", Georgia, "Times New Roman", serif; font-weight: 400; }
h1 { font-size: 34px; line-height: 38px; margin: 0; }
h2 { font-size: 18px; margin: 24px 0 10px; }
header { border-bottom: 2px solid ${P.ink}; padding-bottom: 14px; display: grid; gap: 4px; }
.eyebrow { font-size: 11px; font-weight: 600; letter-spacing: .08em; color: ${P.muted}; }
.muted { color: ${P.muted}; font-size: 12px; }
.box { border: 1px solid ${P.rule}; border-radius: 4px; padding: 10px 14px; margin-bottom: 10px; break-inside: avoid; }
.box-head { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid ${P.rule}; padding-bottom: 6px; }
.box-head strong { font-size: 15px; }
table { width: 100%; border-collapse: collapse; }
td, th { padding: 5px 0; border-bottom: 1px solid ${P.hairline}; vertical-align: top; }
th { font-size: 11px; font-weight: 600; color: ${P.muted}; text-align: left; border-bottom: 1px solid ${P.ink}; }
.num { text-align: right; font-family: Menlo, "Roboto Mono", monospace; white-space: nowrap; padding-left: 12px; }
th.num { font-family: inherit; }
.drink-box { break-inside: avoid; border-bottom: 1px solid ${P.rule}; padding-bottom: 10px; margin-bottom: 12px; }
.drink-head { display: flex; justify-content: space-between; align-items: baseline; }
h3.drink { font-size: 24px; margin: 0; }
td.part { padding-top: 10px; }
footer { margin-top: 18px; }
`;

/** The whole run sheet, as a standalone HTML document. */
export function runSheetHtml(sheet: RunSheet, menu: { name: string; startsAt: string | null; endsAt: string | null }, printedOn = new Date()): string {
  const head = sheetHead(sheet, menu);
  const parties = sheet.parties.filter((p) => p.needs.length);
  const drinks = sheet.drinks.filter((d) => d.serves > 0);
  const n = (v: number) => v.toLocaleString('en-GB');
  const partyHtml = parties
    .map(
      (p) => `<div class="box"><div class="box-head"><strong>${esc(p.name)}</strong><span class="muted">${esc(p.role)}</span></div><table>${p.needs
        .map((x) => `<tr><td>${esc(x.name)}</td><td class="num">${esc(needAmount(x))}</td></tr>`)
        .join('')}</table></div>`,
    )
    .join('');
  const drinkHtml = drinks
    .map(
      (d) => `<div class="drink-box"><div class="drink-head"><h3 class="drink">${esc(d.name)}</h3><span class="num">× ${n(d.serves)}</span></div>${
        d.serve ? `<div class="muted">${esc(d.serve)}</div>` : ''
      }<table><tr><th>Ingredient</th><th class="num">Per drink</th><th class="num">For ${n(d.serves)}</th></tr>${(d.parts ?? [null])
        .map((p) => `${p ? `<tr><td colspan="3" class="part"><strong>${p.n} ${esc(p.name)}</strong>${p.joins ? ` <span class="muted">${esc(p.joins)}</span>` : ''}</td></tr>` : ''}${(p?.lines ?? d.lines)
          .filter((l) => !l.garnish)
          .map((l) => `<tr><td>${esc(l.name)}</td><td class="num">${esc(l.per)}</td><td class="num">${esc(l.total ?? '')}</td></tr>`)
          .join('')}`)
        .join('')}</table></div>`,
    )
    .join('');
  const printed = printedOn.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Run sheet: ${esc(menu.name)}</title><style>${CSS}</style></head><body>
<header><div class="eyebrow">RUN SHEET</div><h1>${esc(head.name)}</h1><div>${esc(head.when || 'No date yet')}</div><div class="muted">${esc(head.who)}</div></header>
<h2>Who brings what</h2>${partyHtml || '<p class="muted">Set some serves and the list fills in.</p>'}
<h2>The drinks</h2>${drinkHtml}
<footer class="muted">Printed ${esc(printed)} from the ${esc(menu.name)} menu. Specs as swapped for this menu.</footer>
</body></html>`;
}

/** One bar's or brand's list (lib/runSheetText.ts partyList) as a one-page HTML document, to send them as a PDF. */
export function partyListHtml(list: PartyList): string {
  const rows = list.needs.map((x) => `<tr><td>${esc(x.name)}</td><td class="num">${esc(needAmount(x))}</td></tr>`).join('');
  const others = list.others.length ? `<h2>Everyone else</h2>${list.others.map((o) => `<p>${esc(o)}</p>`).join('')}` : '';
  const drinkRows = list.drinks.map((d) => `<tr><td>${esc(d.name)}${d.makes.length ? `<div class="muted">You make ${esc(d.makes.join(', '))}</div>` : ''}</td><td class="num">${d.serves.toLocaleString('en-GB')}</td></tr>`);
  const drinks = drinkRows.length ? `<h2>Your drinks</h2><table>${drinkRows.join('')}</table>` : '';
  const claim = list.claim ? `<p class="muted">${esc(list.claim)}</p>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(list.title)}</title><style>${CSS}</style></head><body>
<header><div class="eyebrow">${esc(list.eyebrow)}</div><h1>${esc(list.title)}</h1><div>${esc(list.when || 'No date yet')}</div><div class="muted">${esc(list.from)}</div></header>
${drinks}${rows ? `<h2>${esc(list.ask)}</h2><table>${rows}</table>` : ''}${others}${claim}
<footer class="muted">Questions? Reply to whoever sent you this.</footer>
</body></html>`;
}
