// Shared catalog ingredient names in sentence case: "Lime Juice" becomes
// "Lime juice", "Rich Demerara Syrup" becomes "Rich demerara syrup",
// "Coffee-Infused Campari" becomes "Coffee-infused Campari".
//
// Usage: node scripts/catalog-sentence-case.mjs <dump.json>
// where dump.json is the JSON output (`--output-format json`) of
//
//   select i.name, i.ingredient_role as role, nullif(btrim(i.brand_maker), '') as brand,
//          i.maker_profile_id is not null as has_maker
//     from public.items i
//    where i.bar_id is null and i.item_type = 'ingredient' and i.created_by is null;
//
// run read-only against production. It writes the migration below as an
// explicit old name -> new name list.
//
// The rule, word by word after the first: a word in `lower`
// (scripts/data/catalog-case-words.json) goes lower case, a word in `keep`
// stays as written, and a name with any other capitalised word is left alone.
// Brands and bottles never change: only styles and preps (ingredient_role
// generic or prep, no brand, no maker) are renamed, and one that names a
// bottle's brand inside it ("Milk-Washed Wild Turkey Rye") is left alone too.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const OUT = 'supabase/migrations/20261016750000_catalog_sentence_case.sql';
const WORDS = 'scripts/data/catalog-case-words.json';

export function loadWords(path = WORDS) {
  const { keep, lower } = JSON.parse(readFileSync(path, 'utf8'));
  return { keep: new Set(keep), lower: new Set(lower) };
}

const CAPITALISED = /^\p{Lu}\p{Ll}*(['’]s)?$/u;

/** One word (no spaces or hyphens) after the first: what it becomes, or null if the name should be left alone. */
function caseWord(part, words) {
  // Punctuation around the word ("(White)", "Spices,") stays put.
  const m = /^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u.exec(part);
  const [, pre, word, post] = m;
  if (!word || !/^\p{Lu}/u.test(word)) return part; // numbers, and words already lower case
  // Acronyms and single letters: IPA, VSOP, XO, PB&J, Vitamin C.
  if (word.length === 1 || /^[\p{Lu}\p{N}&.]+$/u.test(word)) return part;
  const key = word.toLocaleLowerCase('en');
  const base = key.replace(/['’]s$/, '');
  if (words.keep.has(key) || words.keep.has(base)) return part;
  if (CAPITALISED.test(word) && (words.lower.has(key) || words.lower.has(base))) return pre + key + post;
  return null;
}

/** The name in sentence case, or null when it should stay as it is (an unknown word, or nothing to change). */
export function sentenceCase(name, words) {
  const tokens = name.split(/(\s+)/);
  let first = true;
  const out = [];
  for (const token of tokens) {
    if (!token || /^\s+$/.test(token)) {
      out.push(token);
      continue;
    }
    const parts = token.split(/([-/])/);
    const cased = [];
    for (const part of parts) {
      if (part === '-' || part === '/' || !part) {
        cased.push(part);
        continue;
      }
      if (first && /\p{L}/u.test(part)) {
        first = false;
        cased.push(part);
        continue;
      }
      const next = caseWord(part, words);
      if (next === null) return null;
      cased.push(next);
    }
    out.push(cased.join(''));
  }
  const result = out.join('');
  return result === name ? null : result;
}

const tokensOf = (s) => s.toLocaleLowerCase('en').split(/[^\p{L}\p{N}'’&]+/u).filter(Boolean);

/** Brand phrases ("wild turkey", "monkey shoulder") from every branded row, minus single words the word lists already decide (Campari). */
export function brandPhrases(rows, words) {
  const phrases = new Set();
  for (const r of rows) {
    if (!r.brand) continue;
    const t = tokensOf(r.brand);
    // A one-word brand that is also an ordinary word ("Stock", "Husk") or a number isn't a brand in a style's name.
    if (!t.length || (t.length === 1 && (words.keep.has(t[0]) || words.lower.has(t[0]) || /^\d+$/.test(t[0])))) continue;
    phrases.add(t.join(' '));
  }
  return phrases;
}

/** The brand phrase inside the name, if there is one. */
export function brandIn(name, phrases) {
  const t = tokensOf(name);
  for (let i = 0; i < t.length; i++) {
    for (let n = 1; n <= 6 && i + n <= t.length; n++) {
      const p = t.slice(i, i + n).join(' ');
      if (phrases.has(p)) return p;
    }
  }
  return null;
}

export function plan(rows, words) {
  const phrases = brandPhrases(rows, words);
  const changes = [];
  const skipped = { brand: 0, word: 0 };
  for (const r of rows) {
    if ((r.role !== 'generic' && r.role !== 'prep') || r.brand || r.has_maker) continue;
    const next = sentenceCase(r.name, words);
    if (next === null) {
      if (/ \p{Lu}/u.test(r.name)) skipped.word++;
      continue;
    }
    if (brandIn(r.name, phrases)) {
      skipped.brand++;
      continue;
    }
    changes.push([r.name, next]);
  }
  changes.sort((a, b) => a[0].localeCompare(b[0], 'en'));
  return { changes, skipped };
}

const q = (s) => {
  if (s.includes('$q$')) throw new Error(`Name contains the quote tag: ${s}`);
  return `$q$${s}$q$`;
};

export function migration(changes) {
  return `-- Shared ingredient names in sentence case, as the boards draw them:
-- "Lime juice", "Agave syrup", "Coffee-infused Campari" (Kevin, 12 Oct).
--
-- Generated by scripts/catalog-sentence-case.mjs from a read-only copy of
-- production's shared catalog (2026-10-12); scripts/catalog-sentence-case.check.ts
-- checks every line below against the rule. Only shared styles and preps
-- (no venue, no person's own ingredient, no bottle or brand) are renamed, and
-- only the letter case changes, so every name key, alias and search match is
-- the same before and after. A name with a word the rule doesn't know (a
-- brand inside a prep, a person) is left as it is.
--
-- Matched by the exact current name, which is unique among shared
-- ingredients. A row renamed since, or missing here, is skipped, and a second
-- run changes nothing.

SET "app.image_worker" = 'on';
-- The case of a name changes no drink's flavour: note the paid flavour job
-- queue now and put it back at the end.
CREATE TEMP TABLE "flavor_jobs_before" AS SELECT * FROM "private"."item_flavor_jobs";
-- The name key doesn't change, so the duplicate-name guard has nothing to say.
SET "app.ingredient_merge" = 'on';

CREATE TEMP TABLE "sentence_case" ("old_name" text PRIMARY KEY, "new_name" text NOT NULL);
INSERT INTO "sentence_case" ("old_name", "new_name") VALUES
${changes.map(([a, b]) => `(${q(a)}, ${q(b)})`).join(',\n')};

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "sentence_case" WHERE lower("old_name") <> lower("new_name")) THEN
        RAISE EXCEPTION 'sentence case may only change letter case';
    END IF;
END $$;

UPDATE public.items i SET name = s.new_name
  FROM "sentence_case" s
 WHERE i.name = s.old_name
   AND i.item_type = 'ingredient' AND i.bar_id IS NULL AND i.created_by IS NULL
   AND i.ingredient_role IN ('generic', 'prep')
   AND NULLIF(btrim(i.brand_maker), '') IS NULL AND i.maker_profile_id IS NULL;

RESET "app.ingredient_merge";

-- --- Put the flavour job queue back ---
DELETE FROM "private"."item_flavor_jobs" j
WHERE NOT EXISTS (SELECT 1 FROM "flavor_jobs_before" o WHERE o.item_id = j.item_id);
UPDATE "private"."item_flavor_jobs" j SET
    "status" = o.status, "revision" = o.revision, "attempts" = o.attempts, "run_after" = o.run_after,
    "lease_until" = o.lease_until, "last_error" = o.last_error, "updated_at" = o.updated_at
FROM "flavor_jobs_before" o
WHERE j.item_id = o.item_id AND j.revision <> o.revision;
DROP TABLE "flavor_jobs_before";
DROP TABLE "sentence_case";
RESET "app.image_worker";
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dump = process.argv[2];
  if (!dump) {
    console.error('Usage: node scripts/catalog-sentence-case.mjs <dump.json>');
    process.exit(1);
  }
  const raw = JSON.parse(readFileSync(dump, 'utf8'));
  const rows = Array.isArray(raw) ? raw : raw.rows;
  const { changes, skipped } = plan(rows, loadWords());
  writeFileSync(OUT, migration(changes));
  console.log(`${changes.length} names change; left alone: ${skipped.word} with an unknown word, ${skipped.brand} naming a brand.`);
}
