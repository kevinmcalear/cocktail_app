/**
 * The run sheet as a printable HTML page (A4): the PDF a phone shares
 * (expo-print) and the page the web prints or saves as a PDF
 * (components/screens/runSheet/RunSheetPrint.tsx). The bars' and brands'
 * logos up top, who brings what by bar, each in the step 3 groups with a box
 * to tick, then each drink as swapped for this menu. Pure.
 */

import { printPaper as P } from '@/constants/tokens';

import { needGroups, type PartySheet, type RunSheet } from './runSheet';
import { sheetHead, type PartyList } from './runSheetText';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n = (v: number) => v.toLocaleString('en-GB');

// ponytail: the device's own serif and sans, not the app's Instrument Serif and
// Geist; embedding the fonts would mean base64 font files in the bundle.
const CSS = `
@page { size: A4; margin: 14mm; }
* { box-sizing: border-box; }
body { margin: 0; color: ${P.ink}; background: ${P.paper}; font: 13px/1.4 -apple-system, "Helvetica Neue", Roboto, Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
h1, h3.drink { font-family: "Iowan Old Style", Georgia, "Times New Roman", serif; font-weight: 400; }
h1 { font-size: 32px; line-height: 36px; margin: 2px 0 0; }
h2 { font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; margin: 22px 0 8px; padding-bottom: 4px; border-bottom: 2px solid ${P.ink}; }
header { border-bottom: 2px solid ${P.ink}; padding-bottom: 12px; display: grid; gap: 3px; }
.logos { display: flex; gap: 10px; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }
.logos img { height: 44px; max-width: 120px; object-fit: contain; }
.eyebrow { font-size: 11px; font-weight: 600; letter-spacing: .08em; color: ${P.muted}; }
.muted { color: ${P.muted}; font-size: 11px; }
.facts { display: flex; gap: 0; margin-top: 8px; border: 1px solid ${P.rule}; border-radius: 4px; }
.facts div { flex: 1; padding: 6px 10px; border-left: 1px solid ${P.rule}; }
.facts div:first-child { border-left: 0; }
.facts b { display: block; font-size: 16px; }
.party { margin-bottom: 14px; }
.party-head { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid ${P.ink}; break-after: avoid; }
.party-head img { height: 24px; max-width: 64px; object-fit: contain; }
.party-head strong { font-size: 16px; flex: 1; }
.group { break-inside: avoid; }
.group table { table-layout: fixed; }
.group col.c-tick { width: 22px; } .group col.c-num { width: 90px; } .group col.c-buy { width: 38%; }
.group-title { font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: ${P.muted}; padding: 8px 0 2px; }
table { width: 100%; border-collapse: collapse; }
td, th { padding: 4px 0; border-bottom: 1px solid ${P.hairline}; vertical-align: top; }
th { font-size: 11px; font-weight: 600; color: ${P.muted}; text-align: left; border-bottom: 1px solid ${P.ink}; }
td.tick { width: 22px; }
.box { display: inline-block; width: 11px; height: 11px; border: 1px solid ${P.ink}; border-radius: 2px; margin-top: 2px; }
.num { text-align: right; font-family: Menlo, "Roboto Mono", monospace; white-space: nowrap; padding-left: 12px; }
td.buy { text-align: right; padding-left: 12px; color: ${P.muted}; font-size: 11px; }
th.num { font-family: inherit; }
.drink-box { break-inside: avoid; border-bottom: 1px solid ${P.rule}; padding-bottom: 10px; margin-bottom: 12px; }
.drink-head { display: flex; justify-content: space-between; align-items: baseline; }
h3.drink { font-size: 22px; margin: 0; }
td.part { padding-top: 10px; }
footer { margin-top: 18px; }
`;

const page = (title: string, body: string) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><style>${CSS}</style></head><body>\n${body}\n</body></html>`;

/** A logo, only from the web (an upload's https URL). */
const logo = (url: string | null | undefined, name: string) => (url && /^https?:\/\//.test(url) ? `<img src="${esc(url)}" alt="${esc(name)} logo">` : '');

/** The logos of everyone on the sheet that has one. */
const logos = (parties: Pick<PartySheet, 'name' | 'logoUrl'>[]) => {
  const imgs = parties.map((p) => logo(p.logoUrl, p.name)).filter(Boolean);
  return imgs.length ? `<div class="logos">${imgs.join('')}</div>` : '';
};

/** One bar's or brand's things, in the step 3 groups, each with a box to tick and what to buy. */
function partyHtml(p: Pick<PartySheet, 'name' | 'role' | 'logoUrl' | 'needs'>): string {
  const groups = needGroups(p.needs)
    .map(
      (g) =>
        `<div class="group"><div class="group-title">${esc(g.title)}</div><table><colgroup><col class="c-tick"><col><col class="c-num"><col class="c-buy"></colgroup>${g.needs
          .map((x) => `<tr><td class="tick"><span class="box"></span></td><td>${esc(x.name)}</td><td class="num">${esc(x.amount)}</td><td class="buy">${esc(x.group === 'glassware' ? '' : (x.detail ?? ''))}</td></tr>`)
          .join('')}</table></div>`,
    )
    .join('');
  return `<section class="party"><div class="party-head">${logo(p.logoUrl, p.name)}<strong>${esc(p.name)}</strong><span class="muted">${esc(p.role)}</span></div>${groups}</section>`;
}

/** The whole run sheet, as a standalone HTML document. */
export function runSheetHtml(sheet: RunSheet, menu: { name: string; startsAt: string | null; endsAt: string | null }, printedOn = new Date()): string {
  const head = sheetHead(sheet, menu);
  const parties = sheet.parties.filter((p) => p.needs.length);
  const drinks = sheet.drinks.filter((d) => d.serves > 0);
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
  const facts = [
    ['Serves', n(sheet.totalServes)],
    ['Drinks', n(drinks.length)],
    ['Extra for testing', `${sheet.marginPct}%`],
  ]
    .map(([k, v]) => `<div><span class="muted">${k}</span><b>${esc(v)}</b></div>`)
    .join('');
  return page(
    `Run sheet: ${menu.name}`,
    `<header>${logos(sheet.parties)}<div class="eyebrow">RUN SHEET</div><h1>${esc(head.name)}</h1><div>${esc(head.when || 'No date yet')}</div><div class="muted">${esc(head.who)}</div><div class="facts">${facts}</div></header>
<h2>Who brings what</h2>${head.extra ? `<p class="muted">${esc(head.extra)}</p>` : ''}${parties.map(partyHtml).join('') || '<p class="muted">Set some serves and the list fills in.</p>'}
<h2>The drinks</h2>${drinkHtml}
<footer class="muted">Printed ${esc(printed)} from the ${esc(menu.name)} menu. Specs as swapped for this menu.</footer>`,
  );
}

/** One bar's or brand's list (lib/runSheetText.ts partyList) as a one-page HTML document, to send them as a PDF. */
export function partyListHtml(list: PartyList): string {
  const drinkRows = list.drinks.map((d) => `<tr><td>${esc(d.name)}${d.makes.length ? `<div class="muted">You make ${esc(d.makes.join(', '))}</div>` : ''}</td><td class="num">${n(d.serves)}</td></tr>`);
  const drinks = drinkRows.length ? `<h2>Your drinks</h2><table>${drinkRows.join('')}</table>` : '';
  const mine = list.needs.length ? `<h2>${esc(list.ask)}</h2>${list.extra ? `<p class="muted">${esc(list.extra)}</p>` : ''}${partyHtml({ name: list.party.name, role: list.party.role, logoUrl: list.party.logoUrl, needs: list.needs })}` : '';
  const others = list.others.length ? `<h2>Everyone else</h2>${list.others.map(partyHtml).join('')}` : '';
  const claim = list.claim ? `<p class="muted">${esc(list.claim)}</p>` : '';
  return page(
    list.title,
    `<header>${logos([list.party, ...list.others])}<div class="eyebrow">${esc(list.eyebrow)}</div><h1>${esc(list.title)}</h1><div>${esc(list.when || 'No date yet')}</div><div class="muted">${esc(list.from)}</div></header>
${drinks}${mine}${others}${claim}
<footer class="muted">Questions? Reply to whoever sent you this.</footer>`,
  );
}
