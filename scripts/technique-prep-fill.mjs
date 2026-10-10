// Technique, bottle and "with what" for the shared catalog's house preps, read
// from their names: "Char Siu Fat-Washed Bourbon" is a fat wash with char siu,
// "Pandan-Infused Carpano Antica" is an infusion made from that bottle.
//
//   node scripts/technique-prep-fill.mjs --sheet <db-url>   read a local catalog, write the review sheet
//   node scripts/technique-prep-fill.mjs                    write the migration from the sheet
//   node scripts/technique-prep-fill.mjs --print            print it (technique-prep-fill.check.ts compares)
//
// Only exact names count: the base must be a bottle's name (or one of its
// aliases) for made_from_id, or a style's for generic_id; the "with what" must
// be a plain ingredient or style for the one recipe line. Nothing is guessed,
// and no amounts, keep times or methods are made up.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const SHEET = 'scripts/data/technique-prep-fill.csv';
const OUT = 'supabase/migrations/20261012420000_technique_prep_fill.sql';
const COLUMNS = ['prep', 'technique', 'with_text', 'adjunct', 'base_text', 'base_match', 'base_kind', 'actions', 'notes'];

// public.ingredient_key, in JS.
const FROM = "àáâãäåāçćčèéêëēěìíîïīñńòóôõöøōùúûüūýÿžšœæ'’‘`´";
const TO = 'aaaaaaa' + 'ccc' + 'eeeeee' + 'iiiii' + 'nn' + 'ooooooo' + 'uuuuu' + 'yy' + 'zs';
export function ingredientKey(name) {
  let s = '';
  for (const ch of String(name ?? '').toLowerCase()) {
    const i = FROM.indexOf(ch);
    s += i < 0 ? ch : (TO[i] ?? '');
  }
  return s.replace(/&/g, ' and ').replace(/[^a-z0-9:]+/g, ' ').trim() || null;
}

// --- Reading a name ---

const VERB_TAG = [
  [/^(fat[\s-]?wash(ed)?|fatwash(ed)?)$/i, 'Fat wash'],
  [/^milk[\s-]?wash(ed)?$/i, 'Milk wash'],
  [/^(washed|wash)$/i, 'wash'],
  [/^(infused|infusion)$/i, 'Infuse'],
  [/^(clarified|clarification)$/i, 'Clarify'],
  [/^(smoked|smoke)$/i, 'Smoke'],
  [/^(re-?distilled|distilled|(re-?)?distillate|(house|freeze)[\s-]distilled)$/i, 'Distil'],
  [/^tinctures?$/i, 'Tincture'],
  [/^sous[\s-]?vide$/i, 'Sous vide'],
  [/^((barrel|cask|wood|oak)[\s-])?aged$/i, 'Age'],
  [/^oil$/i, 'Oil'],
];
const tagOf = (verb) => VERB_TAG.find(([re]) => re.test(verb))?.[1];

// What a plain "washed" was washed with: milk and yoghurt are a milk wash,
// butter, oils, meat fats and cheeses a fat wash. Ice cream, coconut, rice,
// coffee and the rest could be either or neither, so they get no tag.
export function washKind(medium) {
  const m = (medium ?? '').toLowerCase();
  if (/\b(ice cream|gelato)\b/.test(m)) return null;
  const milk = /\b(milk|yog(h)?urt|cream|whey|kefir|makgeol?li)\b/.test(m);
  const fat = /(butter|\boil\b|evoo|bacon|\bfat\b|ghee|lard|tallow|schmaltz|foie gras|prosciutto|sausage|chorizo|\blamb\b|\bduck\b|\bbeef\b|wagyu|comt[eé]|parmesan|cheese|queso|ricotta|mascarpone|manchego|beeswax|avocado)/.test(m);
  if (milk && !fat) return 'Milk wash';
  if (fat && !milk) return 'Fat wash';
  return null;
}

// Names that hold a technique word but aren't that technique.
const NOT_TECHNIQUE = [
  [/^clarified butter\b/i, 'clarified butter is an ingredient (ghee), not the technique'],
  [/^nitrogen smoke$/i, 'nitrogen "smoke" is a fog, not smoke'],
];

const PREFIX = /^(infused|clarified|fat[\s-]?washed|milk[\s-]?washed|sous[\s-]?vide|(?:barrel|cask|wood|oak)[\s-]aged|(?:house|freeze)[\s-]distilled|re-?distilled|distilled|smoked)\s+(.+)$/i;
const VERBS = '(fat[\\s-]?wash(?:ed)?|fatwash(?:ed)?|milk[\\s-]?washed|washed|infused|smoked|re-?distilled|distilled|aged|sous[\\s-]?vide|clarified)';
const INFIX = new RegExp(`^(.+?)[\\s-]+${VERBS}\\s+(.+)$`, 'i');
const WITH_FORM = /^(.+?)\s+(infused|re-?distilled|sous[\s-]?vide)\s+with\s+(.+)$/i;
const BRACKET_FORM = /^(.+?)\s*\((.+?)[\s-]+infused\)$/i;
const SUFFIX = /^(.+?)[\s-]+(infused|washed|infusion|tinctures?|(?:re-?)?distillate|fat[\s-]?wash|fatwash|milk[\s-]?wash|wash|smoke|clarification|clarified|oil|sous[\s-]?vide)$/i;
const AGED_WITH = /(barrel|cask|wood|oak|shell|beeswax|chill?i)$/i;
const OTHER_TECHNIQUE = /infus|wash|smok|distil|clarif|tinctur|\baged\b|sous[\s-]?vide/i;
export const BROAD = /infus|distil|fat[\s-]?wash|wash|clarif|tinctur|\bsmoked?\b|\boils?\b|\baged?\b|sous[\s-]?vide|milk punch/i;

/**
 * Reads one prep name. Returns { tags, withText, adjuncts (names to try, in
 * order), baseText, baseUse (false when the family is made from scratch), note }.
 */
export function parsePrep(name) {
  const out = { tags: [], withText: '', adjuncts: [], baseText: '', baseUse: true, note: '' };
  const n = name.trim().replace(/\s+/g, ' ');
  for (const [re, why] of NOT_TECHNIQUE) if (re.test(n)) return { ...out, note: why };
  const add = (t) => t && !out.tags.includes(t) && out.tags.push(t);

  // The washing medium for a wash verb: "Bacon Fat-Washed" tries "Bacon Fat",
  // then "Bacon"; "Coconut Milk-Washed" tries "Coconut Milk".
  const wash = (verbTag, withText) => {
    if (verbTag === 'Fat wash') return { tag: verbTag, adj: withText ? [`${withText} Fat`, withText] : [] };
    if (verbTag === 'Milk wash') return { tag: verbTag, adj: [withText ? `${withText} Milk` : 'Milk'] };
    const kind = washKind(withText);
    return { tag: kind, adj: withText ? [withText] : [], unclear: !kind };
  };
  const readVerb = (verb, withText) => {
    let tag = tagOf(verb);
    let adj = withText ? [withText] : [];
    if (tag === 'Fat wash' || tag === 'Milk wash' || tag === 'wash') {
      const w = wash(tag, withText);
      tag = w.tag;
      adj = w.adj;
      if (w.unclear) out.note = 'washed with something that could be a fat or milk wash, or neither: no tag';
    }
    add(tag);
    out.withText = withText;
    out.adjuncts = adj;
  };

  let rest = n;
  // "Wakaze Saké Infused with Beaufort Rinds", "Belvedere Vodka Re-Distilled with Salted Pistachio".
  let m = rest.match(WITH_FORM);
  if (m) {
    readVerb(m[2], m[3]);
    out.baseText = m[1];
  } else if ((m = rest.match(BRACKET_FORM))) {
    // "Clément Blanc Rhum (Osmanthus-Infused)".
    readVerb('infused', m[2]);
    out.baseText = m[1];
  } else {
    // Leading techniques: "Clarified Coconut-Infused ...", "Smoked Bourbon". A
    // leading "Smoked" before an "X-Infused" belongs to the X ("Smoked Bacon-Infused Bourbon").
    let prefixed = false;
    while ((m = rest.match(PREFIX))) {
      if (/^smoked$/i.test(m[1]) && INFIX.test(m[2])) break;
      add(tagOf(m[1]));
      if (/^milk[\s-]?washed$/i.test(m[1])) out.adjuncts = ['Milk'];
      if (/^(house|freeze)[\s-]distilled$/i.test(m[1])) out.baseUse = false;
      rest = m[2];
      prefixed = true;
    }
    m = rest.match(INFIX);
    if (m && /aged$/i.test(m[2]) && !AGED_WITH.test(m[1])) m = null;
    if (m) {
      readVerb(m[2], m[1]);
      out.baseText = m[3];
    } else if (!prefixed && (m = rest.match(SUFFIX))) {
      // "Thyme Tincture", "Bay Leaf Oil", "Olive Oil Fat Wash", "Tofu Clarification": no base.
      readVerb(m[2], m[1]);
      out.baseUse = false;
      // "Glenmorangie 12yr Cocoa Butter Washed": the words before hold the base too.
      if (/^(infused|washed)$/i.test(m[2])) {
        out.adjuncts = [];
        out.withText = '';
      }
      if (out.tags.includes('Oil')) {
        const o = m[1].match(/^(.+?)\s+((?:extra virgin )?olive|coconut|sesame|avocado|hazelnut|peanut|sunflower)$/i);
        if (o) out.adjuncts = [o[1]];
      }
    } else if (prefixed) {
      out.baseText = rest;
      // "Distilled Lavender" is lavender, distilled: the thing named is what it's made with.
      if (out.tags.length === 1 && out.tags[0] === 'Distil' && out.baseUse) {
        out.adjuncts = [rest];
        out.withText = rest;
      }
    }
  }

  // A base that itself starts with a technique: "Yogurt-Washed Clarified 12-Year Rum".
  while (out.baseText && (m = out.baseText.match(PREFIX))) {
    add(tagOf(m[1]));
    out.baseText = m[2];
  }
  if (out.baseText && OTHER_TECHNIQUE.test(out.baseText)) {
    const v = out.baseText.match(new RegExp(VERBS, 'i'));
    if (v) {
      const t = tagOf(v[1]);
      add(t === 'wash' ? null : t);
    }
    out.note = 'the base names another technique too, so neither base nor with-what is read';
    out.baseUse = false;
    out.adjuncts = [];
  }
  if (/\bmilk punch\b/i.test(n)) {
    // A milk punch is a milk-washed drink; its "base" is the punch, not a bottle.
    add('Milk wash');
    out.baseUse = false;
  }
  // Distillates, tinctures and oils are made from scratch: technique and with-what only.
  if (out.tags.some((t) => t === 'Distil' || t === 'Tincture' || t === 'Oil')) out.baseUse = false;
  if (!out.tags.length && !out.note) out.note = 'no technique in a form the rules read';
  return out;
}

// --- The catalog ---

// Filed as a product in the catalog, but it's a style, not a bottle anyone sells.
const NOT_A_BOTTLE = new Set(['aromatic wine']);
const STYLE_WORDS = /(\s+(rum|rhum|gin|tequila|vodka|bourbon|whiskey|whisky|rye|mezcal|cognac|brandy|vermouth|scotch|pisco|cachaca|liqueur))+$/;
const DRINK_ROOTS = new Set(['Spirit', 'Liqueur', 'Wine', 'Aromatised Wine', 'Beer', 'Sake', 'Rice Wine', 'Cider', 'Juice']);

function loadCatalog(url) {
  const psql = process.env.PSQL || 'psql';
  const q = (sql) => {
    const r = spawnSync(psql, [url, '-XAtqc', sql], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    if (r.status !== 0) throw new Error(r.stderr);
    return JSON.parse(r.stdout.trim() || 'null') ?? [];
  };
  const items = q(`SELECT json_agg(x) FROM (SELECT i.id, i.name, i.ingredient_role AS role, i.generic_id, i.made_from_id,
      i.created_by IS NULL AS unowned, public.ingredient_key(i.name) AS key, i.is_core, i.created_at
    FROM public.items i WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL) x`);
  const aliases = q(`SELECT json_agg(x) FROM (SELECT key, item_id FROM public.ingredient_aliases) x`);
  const lines = q(`SELECT json_agg(x) FROM (SELECT recipe_item_id AS id, count(*) AS n FROM public.recipes GROUP BY 1) x`);
  const preps = q(`SELECT json_agg(x) FROM (SELECT item_id AS id, actions FROM public.item_prep) x`);
  return { items, aliases, lines, preps };
}

export function buildSheet({ items, aliases, lines, preps }) {
  const byId = new Map(items.map((r) => [r.id, r]));
  const byKey = new Map();
  for (const r of [...items].sort((a, b) => Number(b.is_core) - Number(a.is_core) || String(a.created_at).localeCompare(String(b.created_at)))) {
    if (!byKey.has(r.key)) byKey.set(r.key, r);
  }
  const aliasOf = new Map(aliases.map((a) => [a.key, byId.get(a.item_id)]));
  for (const r of items) {
    if (ingredientKey(r.name) !== r.key) throw new Error(`ingredient_key differs in JS for ${r.name}`);
  }
  const lineCount = new Map(lines.map((l) => [l.id, Number(l.n)]));
  const actionsOf = new Map(preps.map((p) => [p.id, p.actions]));
  const root = (r) => {
    let x = r;
    for (let i = 0; i < 8 && x?.generic_id && byId.get(x.generic_id); i++) x = byId.get(x.generic_id);
    return x?.name;
  };
  // The name wins over an alias; an alias only counts when no ingredient has the name.
  const find = (text) => {
    const k = ingredientKey(text);
    if (!k) return null;
    if (byKey.has(k)) return { row: byKey.get(k), via: 'name' };
    if (aliasOf.get(k)) return { row: aliasOf.get(k), via: 'alias' };
    return null;
  };

  // "Hennessy", "Bacardi Rum", "Michter's Bourbon": an alias picks one bottle,
  // but the name doesn't say which of the brand's bottles it is.
  const productKeys = items.filter((r) => r.role === 'product').map((r) => r.key);
  const brandOnly = (text) => {
    const brand = ingredientKey(text).replace(STYLE_WORDS, '').trim();
    return productKeys.filter((k) => k === brand || k.startsWith(`${brand} `)).length > 1;
  };

  const rows = [];
  const targets = items.filter((r) => r.role === 'prep' && r.unowned && BROAD.test(r.name)).sort((a, b) => a.name.localeCompare(b.name));
  for (const prep of targets) {
    const p = parsePrep(prep.name);
    const actions = [];
    const notes = p.note ? [p.note] : [];
    const have = actionsOf.get(prep.id) ?? [];
    if (p.tags.some((t) => !have.includes(t))) actions.push('tag');
    else if (p.tags.length) notes.push('tags already there');

    let baseMatch = '';
    let baseKind = '';
    if (p.baseText && p.baseUse) {
      const hit = find(p.baseText);
      if (!hit) notes.push('base is not an exact bottle or style');
      else if (hit.row.id === prep.id) notes.push('base is the prep itself');
      else if (hit.row.role === 'product' && prep.made_from_id) {
        notes.push(prep.made_from_id === hit.row.id ? 'made_from already this bottle' : `made_from already ${byId.get(prep.made_from_id)?.name}`);
      } else if (NOT_A_BOTTLE.has(hit.row.key)) notes.push(`${hit.row.name} is filed as a bottle but names a style`);
      else if (hit.row.role === 'product' && hit.via === 'alias' && brandOnly(p.baseText)) {
        notes.push(`base names only a brand with several bottles (the alias says ${hit.row.name})`);
      } else if (hit.row.role === 'product') {
        baseMatch = hit.row.name;
        baseKind = hit.via === 'alias' ? 'bottle (alias)' : 'bottle';
        if (prep.made_from_id === hit.row.id) notes.push('made_from already this bottle');
        else if (prep.made_from_id) notes.push(`made_from already ${byId.get(prep.made_from_id)?.name}`);
        else actions.push('made_from');
      } else if (hit.row.role === 'generic') {
        baseMatch = hit.row.name;
        baseKind = hit.via === 'alias' ? 'style (alias)' : 'style';
        const drink = DRINK_ROOTS.has(root(hit.row)) || / juice$/i.test(hit.row.name);
        if (!drink) notes.push('base style is not a drink, so not filed under it');
        else if (prep.generic_id) notes.push(prep.generic_id === hit.row.id ? 'style already this' : `style already ${byId.get(prep.generic_id)?.name}`);
        else actions.push('generic_id');
      } else notes.push(`base matches a ${hit.row.role ?? 'unsorted'} row, not a bottle or style`);
    } else if (p.baseText) notes.push('made from scratch or a punch: no bottle read');

    let adjunct = '';
    for (const text of p.adjuncts) {
      const hit = find(text);
      if (hit && hit.row.role === 'generic' && hit.row.id !== prep.id) {
        adjunct = hit.row.name;
        break;
      }
    }
    if (adjunct) {
      if (lineCount.get(prep.id)) notes.push('already has recipe lines');
      else actions.push('adjunct');
    } else if (p.withText && p.adjuncts.length) notes.push('with-what is not an exact plain ingredient');

    rows.push({
      prep: prep.name,
      technique: p.tags.join('; '),
      with_text: p.withText,
      adjunct,
      base_text: p.baseText,
      base_match: baseMatch,
      base_kind: baseKind,
      actions: actions.join('; '),
      notes: notes.join('; '),
    });
  }
  return rows;
}

// --- CSV ---

const cell = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
export const toCsv = (rows) => [COLUMNS.join(','), ...rows.map((r) => COLUMNS.map((c) => cell(r[c] ?? '')).join(','))].join('\n') + '\n';
export function fromCsv(text) {
  const out = [];
  let row = [];
  let f = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { f += '"'; i++; } else if (ch === '"') q = false; else f += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(f); f = ''; } else if (ch === '\n') { row.push(f); out.push(row); row = []; f = ''; } else f += ch;
  }
  const [head, ...body] = out;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

// --- Migration ---

const lit = (v) => (v ? `$q$${v}$q$` : 'NULL');

export function migration(rows) {
  const todo = rows.filter((r) => r.actions);
  const has = (r, a) => r.actions.split('; ').includes(a);
  const count = (a) => todo.filter((r) => has(r, a)).length;
  const values = todo.map((r) => {
    const tags = has(r, 'tag') ? `ARRAY[${r.technique.split('; ').map(lit).join(', ')}]::text[]` : `'{}'::text[]`;
    return `(${lit(r.prep)}, ${tags}, ${lit(has(r, 'made_from') ? r.base_match : '')}, ${lit(has(r, 'generic_id') ? r.base_match : '')}, ${lit(has(r, 'adjunct') ? r.adjunct : '')})`;
  });
  return `-- House preps in the shared catalog, filled in from what their names say:
-- "Char Siu Fat-Washed Bourbon", "Earl Grey-Infused Rum", "Bay Leaf Oil".
--
--   * The technique as a prep card tag (${count('tag')} preps): Fat wash, Milk wash, Infuse,
--     Clarify, Smoke, Age, Distil, Tincture, Sous vide or Oil, added to any
--     tags they have.
--   * Made from a bottle (${count('made_from')}): the base in the name is exactly a catalog
--     bottle or one of its aliases ("Peanut Butter-Washed Bulleit Bourbon").
--     An alias that names only a brand with several bottles ("Hennessy",
--     "Tanqueray Gin", "Michter's Bourbon") isn't followed.
--   * A style where there's none (${count('generic_id')}): the base is exactly a drink style.
--   * One recipe line, the "with what" (${count('adjunct')}): when those words are exactly a
--     plain catalog ingredient or style and the prep has no lines yet. No amounts.
--
-- Left alone: anything the name doesn't say exactly. No brand is guessed from
-- a style, distillates, tinctures and oils are made from scratch (no bottle),
-- washes whose medium could be fat or milk get no tag, and no ingredient is
-- made. The review sheet with every prep and why it was or wasn't filled is
-- ${SHEET} (made by scripts/technique-prep-fill.mjs).
--
-- Matched by name key, so rows that don't exist are skipped. Only shared
-- catalog preps (no venue, no owner); every field is filled only where empty,
-- so a second run changes nothing.

SET "app.image_worker" = 'on';
-- No paid flavour jobs: note the queue now and put it back at the end.
CREATE TEMP TABLE "flavor_jobs_before" AS SELECT * FROM "private"."item_flavor_jobs";

-- A shared ingredient of this role by name, or by alias when no ingredient has the name.
CREATE FUNCTION pg_temp.shared_as(p_name text, p_role text) RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT CASE
        WHEN EXISTS (SELECT 1 FROM public.items i WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL
                        AND public.ingredient_key(i.name) = public.ingredient_key(p_name))
        THEN (SELECT i.id FROM public.items i WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL
                 AND public.ingredient_key(i.name) = public.ingredient_key(p_name) AND i.ingredient_role = p_role)
        ELSE (SELECT i.id FROM public.ingredient_aliases a JOIN public.items i ON i.id = a.item_id
               WHERE a.key = public.ingredient_key(p_name) AND i.item_type = 'ingredient' AND i.bar_id IS NULL
                 AND i.ingredient_role = p_role)
    END;
$$;

CREATE TEMP TABLE fill_in (prep text PRIMARY KEY, tags text[] NOT NULL, bottle text, style text, adjunct text);
INSERT INTO fill_in VALUES
${values.join(',\n')};

CREATE TEMP TABLE fill_row AS
SELECT p.id AS prep_id, f.tags,
       pg_temp.shared_as(f.bottle, 'product') AS bottle_id,
       pg_temp.shared_as(f.style, 'generic') AS style_id,
       pg_temp.shared_as(f.adjunct, 'generic') AS adjunct_id
  FROM fill_in f
  JOIN public.items p ON p.item_type = 'ingredient' AND p.bar_id IS NULL
   AND public.ingredient_key(p.name) = public.ingredient_key(f.prep)
 WHERE p.ingredient_role = 'prep' AND p.created_by IS NULL;

-- The technique, added to the prep card's tags.
INSERT INTO public.item_prep AS ip (item_id, actions)
SELECT prep_id, tags FROM fill_row WHERE cardinality(tags) > 0
ON CONFLICT (item_id) DO UPDATE
   SET actions = ip.actions || ARRAY(SELECT u.t FROM unnest(EXCLUDED.actions) WITH ORDINALITY u(t, n)
                                      WHERE u.t <> ALL (ip.actions) ORDER BY u.n),
       updated_at = now()
 WHERE NOT EXCLUDED.actions <@ ip.actions;

-- Changing a style trips guard_ingredient_name when another ingredient already
-- goes by the prep's name; those keep their style as it is.
CREATE FUNCTION pg_temp.name_free(p_id uuid, p_name text) RETURNS boolean LANGUAGE sql STABLE AS $$
    SELECT NOT EXISTS (SELECT 1 FROM public.ingredient_aliases a
                        WHERE a.key = public.ingredient_key(p_name) AND a.item_id <> p_id);
$$;

-- The bottle. A prep with no style yet is said to be a kind of the bottle, and
-- shape_ingredient stores that as made from the bottle and a kind of its style;
-- the rest keep their style and get made_from_id.
UPDATE public.items i SET generic_id = r.bottle_id
  FROM fill_row r
 WHERE i.id = r.prep_id AND r.bottle_id IS NOT NULL
   AND i.made_from_id IS NULL AND i.generic_id IS NULL AND pg_temp.name_free(i.id, i.name);
UPDATE public.items i SET made_from_id = r.bottle_id
  FROM fill_row r
 WHERE i.id = r.prep_id AND r.bottle_id IS NOT NULL AND i.made_from_id IS NULL;

-- The style, where there's none.
UPDATE public.items i SET generic_id = r.style_id
  FROM fill_row r
 WHERE i.id = r.prep_id AND r.style_id IS NOT NULL AND i.generic_id IS NULL AND pg_temp.name_free(i.id, i.name);

-- The with-what, as the only line of a prep that has none.
INSERT INTO public.recipes (recipe_item_id, ingredient_item_id, sort_order)
SELECT r.prep_id, r.adjunct_id, 0
  FROM fill_row r
 WHERE r.adjunct_id IS NOT NULL AND r.adjunct_id <> r.prep_id
   AND NOT EXISTS (SELECT 1 FROM public.recipes x WHERE x.recipe_item_id = r.prep_id);

-- --- Put the flavour job queue back ---
DELETE FROM "private"."item_flavor_jobs" j
WHERE NOT EXISTS (SELECT 1 FROM "flavor_jobs_before" o WHERE o.item_id = j.item_id);
UPDATE "private"."item_flavor_jobs" j SET
    "status" = o.status, "revision" = o.revision, "attempts" = o.attempts, "run_after" = o.run_after,
    "lease_until" = o.lease_until, "last_error" = o.last_error, "updated_at" = o.updated_at
FROM "flavor_jobs_before" o
WHERE j.item_id = o.item_id AND j.revision <> o.revision;
DROP TABLE "flavor_jobs_before";

DROP TABLE "fill_in", "fill_row";
DROP FUNCTION pg_temp.shared_as(text, text);
DROP FUNCTION pg_temp.name_free(uuid, text);
RESET "app.image_worker";
`;
}

// --- Main ---

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args[0] === '--sheet') {
    if (!args[1]) throw new Error('Usage: --sheet <db-url>');
    const rows = buildSheet(loadCatalog(args[1]));
    writeFileSync(SHEET, toCsv(rows));
    console.log(`${rows.length} preps -> ${SHEET}`);
  } else {
    const sql = migration(fromCsv(readFileSync(SHEET, 'utf8')));
    if (args[0] === '--print') process.stdout.write(sql);
    else {
      writeFileSync(OUT, sql);
      console.log(`-> ${OUT}`);
    }
  }
}
