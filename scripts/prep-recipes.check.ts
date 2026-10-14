// The rules a house prep recipe seed (supabase/seeds/preps/*.json) must pass
// before scripts/prep-recipes.mjs turns it into a migration, and a check that
// each migration is the one its seed makes. Run: npm run test:unit
//
//   * Every amount has a source; a staple has two, from different sites. A
//     keep comes from a source that gives one, and is never longer than the
//     shortest any of them gives.
//   * Units and "how it's made" tags are the app's own lists.
//   * Sugar, acid and salt sit in the range their kind allows: a 1:1 syrup is
//     about half sugar, a 20% saline is 20% salt, a super juice about 6% acid.
//   * The yield is no more than what goes in, and not far less.
//   * A grade C recipe says it's a starting point to test.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { PREP_ACTIONS } from '../lib/scale';
import { RECIPE_UNITS } from '../lib/units';
import { output, readSeeds } from './prep-recipes.mjs';

type Line = { ingredient: string; amount?: number | null; unit?: string | null; note?: string; optional?: boolean; removed?: boolean };
type Source = { field: string; url: string; kind: string; note?: string; hours?: number; checked_on?: string };
type Prep = {
  name: string;
  kind: string;
  kind_of?: string | null;
  kind_of_force?: boolean;
  aliases?: string[];
  description?: string;
  abv?: number | null;
  grade?: 'A' | 'B' | 'C';
  staple?: boolean;
  replace?: boolean;
  fix?: string;
  recipe?: Line[];
  yield?: { amount: number; unit: string; derived?: boolean } | null;
  keeps?: { hours?: number | null; storage?: string | null } | null;
  actions?: string[];
  steps?: { body: string; timer_seconds?: number }[];
  sources?: Source[];
};
type Seed = { migration: string; header?: string[]; checked_on?: string; ingredients?: { name: string; description: string; kind_of?: string }[]; preps: Prep[] };

const KINDS = new Set([
  'syrup', 'cordial', 'sherbet', 'oleo', 'orgeat', 'grenadine', 'shrub', 'super-juice', 'acid-adjusted', 'acid-solution', 'saline',
  'clarified', 'milk-punch', 'wash', 'infusion', 'tincture', 'bitters', 'foam', 'soda', 'oil', 'food', 'blend', 'other',
]);
const FIELDS = new Set(['recipe', 'yield', 'keeps']);
const SOURCE_KINDS = new Set(['producer', 'retailer', 'reference', 'registry', 'law']);
const UNITS = new Set(RECIPE_UNITS.map((u) => u.value));
const ACTIONS = new Set<string>(PREP_ACTIONS);
// Share-alike text can't go in a catalog we don't license that way; model output isn't a source.
const BANNED_HOSTS = /(^|\.)(wikibooks\.org|chatgpt\.com|openai\.com|perplexity\.ai|gemini\.google\.com|claude\.ai)$/;
const DASHES = /[–—]/;

// ml-ish amount: g and ml count alike (close enough for a range check).
const PER: Record<string, number> = { ml: 1, g: 1, cl: 10, oz: 29.57, kg: 1000, tsp: 5, bsp: 5, tbsp: 15, dash: 0.8, drop: 0.05 };
const amountOf = (l: Line) => (l.amount != null && l.unit && PER[l.unit] ? l.amount * PER[l.unit] : 0);

const ACID = /\b(citric|malic|tartaric|lactic|ascorbic|phosphoric|succinic)\s+acid\b/i;
const SALT = /\b(salt|saltbush)\b/i;
const VINEGAR = /\bvinegar\b/i;
const PEEL = /\b(peel|zest|rind|skins?|husks?)\b/i;
const SPIRIT = /\b(vodka|neutral|grain spirit|everclear|rum|rhum|gin|spirit|whisk(e)?y|bourbon|rye|tequila|mezcal|brandy|cognac|pisco|grappa|shochu|soju|baijiu|absinthe|overproof)\b/i;
// Sugar each sweetener carries, by weight.
const SWEET: [RegExp, number][] = [
  [/\brich (simple |demerara )?syrup\b|\b2:1\b/i, 0.66],
  [/\b(simple|sugar|gomme|demerara|cane) syrup\b/i, 0.5],
  [/\bhoney\b/i, 0.82],
  [/\bagave( nectar| syrup)?\b/i, 0.75],
  [/\bmaple syrup\b/i, 0.66],
  [/\bmolasses\b/i, 0.7],
  [/\b(sugar|demerara|muscovado|turbinado|piloncillo|jaggery|panela|rapadura|dextrose|glucose|sucrose)\b/i, 1],
];
const sugarOf = (l: Line) => {
  const s = SWEET.find(([re]) => re.test(l.ingredient));
  return s ? amountOf(l) * s[1] : 0;
};
const percentIn = (name: string) => {
  const m = name.match(/(\d+(?:\.\d+)?)\s*%/);
  return m ? Number(m[1]) / 100 : null;
};

const RANGES: Record<string, { sugar?: [number, number]; acid?: [number, number] }> = {
  syrup: { sugar: [0.25, 0.72] },
  cordial: { sugar: [0.2, 0.7], acid: [0, 0.06] },
  sherbet: { sugar: [0.25, 0.8] },
  oleo: { sugar: [0.3, 0.85] },
  orgeat: { sugar: [0.25, 0.7] },
  grenadine: { sugar: [0.3, 0.72] },
  shrub: { sugar: [0.15, 0.65] },
};

export function validate(seed: Seed, where = 'seed'): string[] {
  const out: string[] = [];
  const bad = (name: string, msg: string) => out.push(`${where}: ${name}: ${msg}`);
  if (!/^\d{14}_[a-z0-9_]+\.sql$/.test(seed.migration ?? '')) out.push(`${where}: migration name "${seed.migration}"`);
  if (DASHES.test(JSON.stringify(seed))) out.push(`${where}: has an en or em dash`);
  for (const s of seed.ingredients ?? []) {
    if (!s.name || !s.description) out.push(`${where}: ingredient ${s.name ?? '?'} needs a name and a description`);
  }
  const seen = new Set<string>();
  for (const p of seed.preps ?? []) {
    const n = p.name ?? '?';
    const key = n.toLowerCase();
    if (seen.has(key)) bad(n, 'listed twice');
    seen.add(key);
    if (!/^\S.{1,78}\S$/.test(n) || n[0] !== n[0].toUpperCase()) bad(n, 'name must be 3 to 80 characters, capitalised');
    if (!KINDS.has(p.kind)) bad(n, `kind "${p.kind}"`);
    if (p.grade && !['A', 'B', 'C'].includes(p.grade)) bad(n, `grade "${p.grade}"`);
    if (p.grade === 'C' && !/starting point/i.test(p.description ?? '')) bad(n, 'grade C must say it is a starting point to test');
    if (p.replace && !p.fix) bad(n, 'a replaced recipe says what it fixes');
    for (const a of p.actions ?? []) if (!ACTIONS.has(a)) bad(n, `action "${a}"`);
    if (p.keeps?.storage && p.keeps.storage.length > 60) bad(n, 'storage over 60 characters');
    for (const s of p.steps ?? []) {
      if (!s.body || s.body.trim().length < 1 || s.body.length > 500) bad(n, 'step must be 1 to 500 characters');
      if (s.timer_seconds != null && !(Number.isInteger(s.timer_seconds) && s.timer_seconds > 0 && s.timer_seconds <= 86400)) bad(n, 'step timer 1 s to 24 h');
    }

    const lines = p.recipe ?? [];
    const sources = p.sources ?? [];
    for (const s of sources) {
      if (!FIELDS.has(s.field)) bad(n, `source field "${s.field}"`);
      if (!SOURCE_KINDS.has(s.kind)) bad(n, `source kind "${s.kind}"`);
      if (!/^https?:\/\/\S+$/.test(s.url ?? '') || s.url.length > 2000) bad(n, `source url "${s.url}"`);
      else if (BANNED_HOSTS.test(new URL(s.url).hostname)) bad(n, `source ${s.url} can't be used`);
      if (s.note && s.note.length > 500) bad(n, 'source note over 500 characters');
      if (s.checked_on && !/^\d{4}-\d{2}-\d{2}$/.test(s.checked_on)) bad(n, 'checked_on is a date');
    }
    const urls = sources.map((s) => `${s.field} ${s.url}`);
    if (new Set(urls).size !== urls.length) bad(n, 'the same page twice for one fact');

    for (const l of lines) {
      if (!l.ingredient) bad(n, 'a line with no ingredient');
      if (l.amount != null && !(Number.isFinite(l.amount) && l.amount > 0)) bad(n, `${l.ingredient}: amount ${l.amount}`);
      if (l.unit != null && !UNITS.has(l.unit)) bad(n, `${l.ingredient}: unit "${l.unit}"`);
      if (l.amount != null && !l.unit) bad(n, `${l.ingredient}: an amount needs a unit`);
    }
    const amounts = lines.some((l) => l.amount != null);
    const recipeSources = sources.filter((s) => s.field === 'recipe');
    if (amounts && !recipeSources.length) bad(n, 'amounts with no recipe source');
    if (!amounts && recipeSources.length) bad(n, 'a recipe source with no amounts');
    if (p.staple && amounts && new Set(recipeSources.map((s) => new URL(s.url).hostname.replace(/^www\./, ''))).size < 2) {
      bad(n, 'a staple needs two recipe sources from different sites');
    }

    // Yield: sourced or worked out, and never more than goes in.
    if (p.yield) {
      if (!(p.yield.amount > 0) || !UNITS.has(p.yield.unit)) bad(n, 'yield needs an amount and a unit');
      if (!p.yield.derived && !sources.some((s) => s.field === 'yield')) bad(n, 'yield needs a source, or derived: true');
      const all = lines.reduce((t, l) => t + amountOf(l), 0);
      const kept = lines.filter((l) => !l.removed).reduce((t, l) => t + amountOf(l), 0);
      const y = p.yield.amount * (PER[p.yield.unit] ?? 1);
      if (all > 0 && y > all * 1.1) bad(n, `yield ${y} is more than goes in (${Math.round(all)})`);
      if (kept > 0 && y < kept * 0.3 && p.kind !== 'clarified' && p.kind !== 'milk-punch') bad(n, `yield ${y} is far less than stays in (${Math.round(kept)})`);
    }

    // Keep: from a source that says, and never longer than the shortest.
    const hours = p.keeps?.hours;
    const keepSources = sources.filter((s) => s.field === 'keeps');
    if (hours != null) {
      if (!(Number.isInteger(hours) && hours > 0)) bad(n, `keeps ${hours} h`);
      const given = keepSources.map((s) => s.hours).filter((h): h is number => typeof h === 'number');
      if (!given.length) bad(n, 'a keep needs a keeps source that gives hours');
      else if (hours > Math.min(...given)) bad(n, `keeps ${hours} h is longer than a source allows (${Math.min(...given)} h)`);
    } else if (keepSources.length) bad(n, 'a keeps source but no keep');

    // Ranges by kind.
    const total = lines.reduce((t, l) => t + amountOf(l), 0);
    if (!amounts || total <= 0) continue;
    const sugar = lines.reduce((t, l) => t + sugarOf(l), 0) / total;
    const acid = lines.filter((l) => ACID.test(l.ingredient)).reduce((t, l) => t + amountOf(l), 0);
    const range = RANGES[p.kind];
    if (range?.sugar && (sugar < range.sugar[0] || sugar > range.sugar[1])) bad(n, `sugar ${(sugar * 100).toFixed(1)}% is outside ${range.sugar.map((x) => x * 100).join(' to ')}% for a ${p.kind}`);
    if (range?.acid && (acid / total < range.acid[0] || acid / total > range.acid[1])) bad(n, `acid ${((acid / total) * 100).toFixed(1)}% is outside the range for a ${p.kind}`);
    if (p.kind === 'syrup') {
      if (/\b(rich|2:1)\b/i.test(n) && sugar < 0.6) bad(n, `a rich syrup at ${(sugar * 100).toFixed(1)}% sugar`);
      if (/^(simple syrup|.*\(1:1\))$/i.test(n) && (sugar < 0.45 || sugar > 0.55)) bad(n, `a 1:1 syrup at ${(sugar * 100).toFixed(1)}% sugar`);
    }
    if (p.kind === 'shrub' && !lines.some((l) => VINEGAR.test(l.ingredient))) bad(n, 'a shrub with no vinegar');
    if (p.kind === 'super-juice') {
      if (!lines.some((l) => PEEL.test(l.ingredient))) bad(n, 'a super juice with no peel');
      if (acid / total < 0.025 || acid / total > 0.08) bad(n, `super juice acid ${((acid / total) * 100).toFixed(1)}%, expected 2.5 to 8%`);
    }
    if (p.kind === 'acid-adjusted') {
      const juice = total - acid;
      const perLitre = (acid / juice) * 1000;
      if (perLitre < 10 || perLitre > 80) bad(n, `${perLitre.toFixed(0)} g acid per litre of juice`);
    }
    if (p.kind === 'acid-solution' || p.kind === 'saline') {
      const solute = p.kind === 'saline' ? lines.filter((l) => SALT.test(l.ingredient)).reduce((t, l) => t + amountOf(l), 0) : acid;
      const strength = solute / total;
      const named = percentIn(n);
      if (named != null && Math.abs(strength - named) > 0.015) bad(n, `${(strength * 100).toFixed(1)}% by weight, the name says ${named * 100}%`);
      if (named == null && (strength < 0.02 || strength > 0.35)) bad(n, `${(strength * 100).toFixed(1)}% is not a working ${p.kind}`);
    }
    if (p.kind === 'tincture' && !lines.some((l) => SPIRIT.test(l.ingredient))) bad(n, 'a tincture with no spirit');
  }
  return out;
}

// Run directly (npm run test:unit); other scripts import validate() alone.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  // --- The rules catch what they should ---

  const base = (over: Partial<Prep>): Seed => ({
    migration: '20991231000000_test.sql',
    preps: [{
      name: 'Test syrup', kind: 'syrup', grade: 'A',
      recipe: [{ ingredient: 'Sugar', amount: 500, unit: 'g' }, { ingredient: 'Water', amount: 500, unit: 'ml' }],
      yield: { amount: 800, unit: 'ml', derived: true },
      keeps: { hours: 336, storage: 'Fridge' },
      actions: ['Syrup'],
      sources: [
        { field: 'recipe', url: 'https://example.com/a', kind: 'reference' },
        { field: 'keeps', url: 'https://example.com/a', kind: 'reference', hours: 672 },
      ],
      ...over,
    }],
  });
  assert.deepEqual(validate(base({})), []);
  const fails = (over: Partial<Prep>, re: RegExp) => {
    const problems = validate(base(over));
    assert.ok(problems.some((p) => re.test(p)), `expected ${re} in ${JSON.stringify(problems)}`);
  };
  fails({ keeps: { hours: 2000, storage: 'Fridge' } }, /longer than a source allows/);
  fails({ sources: [{ field: 'recipe', url: 'https://example.com/a', kind: 'reference' }] }, /keeps source that gives hours/);
  fails({ sources: [{ field: 'keeps', url: 'https://example.com/a', kind: 'reference', hours: 672 }] }, /amounts with no recipe source/);
  fails({ staple: true }, /two recipe sources/);
  fails({ recipe: [{ ingredient: 'Sugar', amount: 500, unit: 'cups' }, { ingredient: 'Water', amount: 500, unit: 'ml' }] }, /unit "cups"/);
  fails({ actions: ['Stir'] }, /action "Stir"/);
  fails({ yield: { amount: 5000, unit: 'ml', derived: true } }, /more than goes in/);
  fails({ yield: { amount: 800, unit: 'ml' } }, /yield needs a source/);
  fails({ name: 'Rich test syrup' }, /rich syrup/);
  fails({ recipe: [{ ingredient: 'Sugar', amount: 900, unit: 'g' }, { ingredient: 'Water', amount: 100, unit: 'ml' }] }, /sugar 90\.0%/);
  fails({ grade: 'C', description: 'A syrup.' }, /starting point/);
  fails({ description: 'Sugar — water' }, /dash/);
  fails({ sources: [{ field: 'recipe', url: 'https://en.wikibooks.org/wiki/x', kind: 'reference' }, { field: 'keeps', url: 'https://example.com/a', kind: 'reference', hours: 672 }] }, /can't be used/);
  fails({ name: 'Saline solution (20%)', kind: 'saline', recipe: [{ ingredient: 'Salt', amount: 100, unit: 'g' }, { ingredient: 'Water', amount: 900, unit: 'ml' }], yield: { amount: 950, unit: 'ml', derived: true } }, /name says 20%/);
  fails({ kind: 'super-juice', recipe: [{ ingredient: 'Lime peel', amount: 100, unit: 'g' }, { ingredient: 'Citric acid', amount: 300, unit: 'g' }, { ingredient: 'Water', amount: 1000, unit: 'ml' }], yield: { amount: 1300, unit: 'ml', derived: true } }, /super juice acid/);
  fails({ kind: 'shrub' }, /no vinegar/);
  fails({ kind: 'tincture', recipe: [{ ingredient: 'Chilli', amount: 50, unit: 'g' }, { ingredient: 'Water', amount: 500, unit: 'ml' }], yield: { amount: 500, unit: 'ml', derived: true } }, /no spirit/);
  assert.deepEqual(
    validate(base({ name: 'Saline solution (20%)', kind: 'saline', recipe: [{ ingredient: 'Salt', amount: 200, unit: 'g' }, { ingredient: 'Water', amount: 800, unit: 'ml' }], yield: { amount: 900, unit: 'ml', derived: true } })),
    [],
  );

  // --- The real seeds ---

  const names = new Map<string, string>();
  for (const { file, seed } of readSeeds()) {
    const problems = validate(seed as Seed, file);
    assert.deepEqual(problems, [], problems.join('\n'));
    for (const p of (seed as Seed).preps) {
      const key = p.name.toLowerCase();
      // A corrected catalog recipe may sit beside the stage that first loaded it.
      if (names.has(key) && !p.replace) assert.fail(`${p.name} is in ${names.get(key)} and ${file}`);
      names.set(key, file);
    }
    const migration = readFileSync(`supabase/migrations/${(seed as Seed).migration}`, 'utf8');
    assert.equal(migration, output(file, seed), `${(seed as Seed).migration} is stale: run node scripts/prep-recipes.mjs`);
    assert.doesNotMatch(migration, DASHES);
  }
}
