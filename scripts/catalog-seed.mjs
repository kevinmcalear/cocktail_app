// Turns supabase/seeds/catalog/*.json into the product-catalog migration.
// One source of truth: the check script fails if the SQL file drifts.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'supabase/seeds/catalog';
const OUT = 'supabase/migrations/20261001190000_product_catalog.sql';

const ACTIONS = new Set([
  'Blend', 'Infuse', 'Strain', 'Clarify', 'Syrup', 'Mix', 'Sous vide', 'Centrifuge',
  'Distil', 'Ferment', 'Freeze', 'Carbonate', 'Fat wash', 'Dehydrate',
]);

// Recipe lines named these, and no catalog entry did. Real pantry things.
const STUBS = [
  ['Cacao Nib', 'Cracked fermented cacao beans. Steeped in spirit to make cacao nib tincture or infused syrup, and used as a bitter garnish.'],
  ['Cane Sugar', 'Unrefined or raw cane sugar, sold as crystals or a wet loaf. Dissolved into syrups and used where white sugar would taste flat.'],
  ['Lemon Peel', 'The yellow outer rind of a lemon, cut as a twist or a swath. It adds lemon oil to a drink without the juice.'],
  ['Lime Peel', 'The green outer rind of a lime, cut as a twist. It is the oil on a Daiquiri, a Gimlet and a gin and tonic.'],
  ['Lime Zest', 'Finely grated lime rind, pith left behind. Used when a syrup or oleo needs lime oil through the whole batch.'],
  ['Orange Peel', 'The orange outer rind of an orange, cut as a twist or a coin. It is the garnish on an Old Fashioned and a Negroni.'],
  ['Passion Fruit Purée', 'Sieved passion fruit pulp, unsweetened. The base of a passion fruit syrup and a common sour ingredient in tropical drinks.'],
  ['Piloncillo', 'Unrefined Mexican cane sugar, sold as a hard cone. Grated or dissolved into syrup; darker and more molasses-like than white sugar.'],
  ['Pomegranate Molasses', 'Pomegranate juice boiled down to a thick, sour-sweet syrup. A few drops sharpen a shrub or a grenadine.'],
  ['White Wine Vinegar', 'A sharp vinegar made from white wine. The acid in shrubs and gastriques when citrus juice would muddy the flavour.'],
];

const key = (type, name) => `${type}\0${name.toLocaleLowerCase('en')}`;
const rank = (row) => (row.role === 'complex' ? 3 : row.role === 'product' ? 2 : 1);

function load() {
  const groups = new Map();
  for (const file of readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()) {
    for (const row of JSON.parse(readFileSync(join(DIR, file), 'utf8'))) {
      const id = key(row.type, row.name);
      const prev = groups.get(id);
      if (!prev || rank(row) > rank(prev) || (rank(row) === rank(prev) && (row.recipe?.length || 0) > (prev.recipe?.length || 0))) {
        const match = [...new Set([...(prev?.match || []), ...(row.match || []), row.name])];
        groups.set(id, { ...row, match });
      } else {
        prev.match = [...new Set([...(prev.match || []), ...(row.match || []), row.name])];
      }
    }
  }
  for (const [name, description] of STUBS) {
    const id = key('ingredient', name);
    if (!groups.has(id)) {
      groups.set(id, {
        role: 'generic', type: 'ingredient', name, description, abv: 0,
        generic: null, category: null, match: [name],
      });
    }
  }
  return [...groups.values()].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
}

function aliasesFor(rows) {
  const claims = new Map();
  for (const row of rows) {
    for (const alias of row.match || []) {
      if (!alias || typeof alias !== 'string') continue;
      const id = key(row.type, alias);
      if (!claims.has(id)) claims.set(id, new Set());
      claims.get(id).add(row.name);
    }
  }
  const kept = new Map(rows.map((row) => [key(row.type, row.name), new Set([row.name])]));
  for (const [id, names] of claims) {
    const [type, aliasLower] = [id.slice(0, id.indexOf('\0')), id.slice(id.indexOf('\0') + 1)];
    const owners = [...names].filter((name) => name.toLocaleLowerCase('en') === aliasLower);
    if (owners.length === 1) {
      kept.get(key(type, owners[0])).add([...names].find((n) => n.toLocaleLowerCase('en') === aliasLower) || owners[0]);
      // the alias string as written on the owner
      const owner = rows.find((r) => r.type === type && r.name === owners[0]);
      const written = (owner.match || []).find((a) => a.toLocaleLowerCase('en') === aliasLower) || owners[0];
      kept.get(key(type, owners[0])).add(written);
      continue;
    }
    if (names.size === 1) {
      const name = [...names][0];
      const owner = rows.find((r) => r.type === type && r.name === name);
      const written = (owner.match || []).find((a) => a.toLocaleLowerCase('en') === aliasLower);
      if (written) kept.get(key(type, name)).add(written);
    }
    // Two different entries claimed it, and neither is named that. Drop it
    // so a shared "Choya" row is not updated as two products.
  }
  const used = new Map();
  for (const [id, set] of kept) {
    const type = id.slice(0, id.indexOf('\0'));
    for (const alias of set) {
      const taken = `${type}\0${alias}`;
      if (used.has(taken)) throw new Error(`Alias "${alias}" (${type}) is on two entries`);
      used.set(taken, id);
    }
  }
  return kept;
}

// Beer styles that already exist as beer categories in supabase/seed_categories.sql.
// A style that is not in this set stays uncategorised. Do not add categories here.
const BEER_CATEGORY = new Set(['Amber Ale', 'IPA', 'Lager', 'Pale Ale', 'Pilsner', 'Porter', 'Saison', 'Sour', 'Stout', 'Wheat Beer']);

function categoryOf(row) {
  if (row.category) return row.category;
  if (row.type === 'beer' && BEER_CATEGORY.has(row.style)) return row.style;
  return null;
}

function domain(row) {
  if (!categoryOf(row)) return null;
  if (row.type === 'wine') return 'wine';
  if (row.type === 'beer') return 'beer';
  return 'spirit';
}

function q(value) {
  if (value == null || value === '') return 'NULL';
  const text = String(value);
  if (!text.includes('$q$')) return `$q$${text}$q$`;
  return `'${text.replaceAll("'", "''")}'`;
}

function num(value) {
  return value == null || value === '' ? 'NULL' : String(value);
}

function sqlArray(values) {
  const clean = (values || []).filter((v) => ACTIONS.has(v));
  if (!clean.length) return "'{}'::text[]";
  return `ARRAY[${clean.map(q).join(', ')}]::text[]`;
}

function build() {
  const rows = load();
  const aliases = aliasesFor(rows);
  const known = new Set(rows.filter((r) => r.type === 'ingredient').map((r) => r.name.toLocaleLowerCase('en')));
  const missing = [];
  for (const row of rows) {
    for (const line of row.recipe || []) {
      const name = line.ingredient;
      if (name && !known.has(name.toLocaleLowerCase('en'))) missing.push(`${row.name}: ${name}`);
    }
  }
  if (missing.length) throw new Error(`Recipe lines with no ingredient:\n${missing.join('\n')}`);
  const dangling = rows
    .filter((r) => r.type === 'ingredient' && r.generic && !known.has(String(r.generic).toLocaleLowerCase('en')))
    .map((r) => `${r.name} -> ${r.generic}`);
  if (dangling.length) throw new Error(`Generic with no ingredient:\n${dangling.join('\n')}`);

  const items = [];
  const aliasRows = [];
  const lines = [];
  const preps = [];
  const steps = [];
  for (const row of rows) {
    items.push(
      `(${q(row.name)}, ${q(row.type)}, ${q(row.role)}, ${q(row.description)}, ${num(row.abv)}, ${q(row.type === 'ingredient' ? row.generic : null)}, ${q(categoryOf(row))}, ${q(domain(row))}, ${q(row.maker)}, ${q(row.origin)})`,
    );
    for (const alias of [...aliases.get(key(row.type, row.name))].sort((a, b) => a.localeCompare(b))) {
      aliasRows.push(`(${q(row.type)}, ${q(row.name)}, ${q(alias)})`);
    }
    if (row.role !== 'complex') continue;
    (row.recipe || []).forEach((line, i) => {
      lines.push(`(${q(row.name)}, ${i}, ${q(line.ingredient)}, ${num(line.amount)}, ${q(line.unit)}, ${q(line.note || null)})`);
    });
    preps.push(`(${q(row.name)}, ${num(row.yield_amount)}, ${q(row.yield_unit)}, ${num(row.shelf_life_hours)}, ${q(row.storage)}, ${sqlArray(row.actions)})`);
    (row.steps || []).forEach((step, i) => {
      steps.push(`(${q(row.name)}, ${i}, ${q(step.body)})`);
    });
  }

  const counts = {
    items: rows.length,
    products: rows.filter((r) => r.role === 'product').length,
    generics: rows.filter((r) => r.role === 'generic').length,
    complex: rows.filter((r) => r.role === 'complex').length,
  };

  return `-- Shared catalog: the bottles, wines, beers and house preps bars actually use.
--
-- ${counts.items} entries (${counts.products} products, ${counts.generics} generics, ${counts.complex} house recipes).
-- A shared item of the same type whose name is the entry, or a listed alias,
-- keeps its name and only gains facts it does not already have (description,
-- ABV, maker, origin, generic, a category when it has none). Anything else
-- is inserted under the catalog name. Nothing is renamed, merged or deleted.
-- House recipes land only on a shared item that has no recipe yet.
-- Safe to re-run. Skips automatic sketches: catalog rows have no one to bill.
--
-- Photos are not in this migration. Commercial bottle shots are not ours to
-- ship, and the image worker drops catalog rows that have no payer.

SET statement_timeout = 0;
SET "app.image_worker" = 'on';

CREATE TEMP TABLE "seed_items" (
    "name" text NOT NULL,
    "item_type" text NOT NULL,
    "role" text NOT NULL,
    "description" text,
    "abv" numeric,
    "generic_name" text,
    "category_name" text,
    "category_domain" text,
    "maker" text,
    "origin" text,
    PRIMARY KEY ("item_type", "name")
);
CREATE TEMP TABLE "seed_alias" (
    "item_type" text NOT NULL,
    "name" text NOT NULL,
    "alias" text NOT NULL,
    PRIMARY KEY ("item_type", "alias")
);
CREATE TEMP TABLE "seed_line" (
    "name" text NOT NULL,
    "pos" integer NOT NULL,
    "ingredient" text NOT NULL,
    "amount" numeric,
    "unit" text,
    "note" text
);
CREATE TEMP TABLE "seed_prep" (
    "name" text NOT NULL PRIMARY KEY,
    "yield_amount" numeric,
    "yield_unit" text,
    "shelf_life_hours" integer,
    "storage" text,
    "actions" text[]
);
CREATE TEMP TABLE "seed_step" (
    "name" text NOT NULL,
    "pos" integer NOT NULL,
    "body" text NOT NULL,
    PRIMARY KEY ("name", "pos")
);

INSERT INTO "seed_items" VALUES
${items.join(',\n')};

INSERT INTO "seed_alias" VALUES
${aliasRows.join(',\n')};

INSERT INTO "seed_line" VALUES
${lines.join(',\n')};

INSERT INTO "seed_prep" VALUES
${preps.join(',\n')};

INSERT INTO "seed_step" VALUES
${steps.join(',\n')};

-- The insert below asks, for every catalog name, whether a shared item already
-- has it. Without this, that check scans the whole items table once per name.
CREATE INDEX "items_shared_name_tmp" ON "public"."items" ("item_type", lower("name")) WHERE "bar_id" IS NULL;
CREATE INDEX "seed_alias_lookup" ON "seed_alias" ("item_type", lower("alias"));
ANALYZE "seed_items", "seed_alias", "public"."items";

-- New shared items. Skip when any alias already names one of this type.
INSERT INTO "public"."items" ("name", "item_type", "description", "abv", "brand_maker", "origin", "hide_from_search")
SELECT "s"."name", "s"."item_type"::"public"."entity_type", "s"."description", "s"."abv", "s"."maker", "s"."origin", false
FROM "seed_items" "s"
WHERE NOT EXISTS (
    SELECT 1
    FROM "seed_alias" "a"
    JOIN "public"."items" "i"
      ON "i"."bar_id" IS NULL
     AND "i"."item_type"::text = "a"."item_type"
     AND lower("i"."name") = lower("a"."alias")
    WHERE "a"."item_type" = "s"."item_type" AND "a"."name" = "s"."name"
);

-- Fill blanks on every shared row an alias points at. Leave anything already set.
UPDATE "public"."items" "i"
SET "description" = COALESCE(NULLIF(btrim("i"."description"), ''), "s"."description"),
    "abv" = COALESCE("i"."abv", "s"."abv"),
    "brand_maker" = COALESCE(NULLIF(btrim("i"."brand_maker"), ''), "s"."maker"),
    "origin" = COALESCE(NULLIF(btrim("i"."origin"), ''), "s"."origin")
FROM "seed_alias" "a"
JOIN "seed_items" "s" ON "s"."item_type" = "a"."item_type" AND "s"."name" = "a"."name"
WHERE "i"."bar_id" IS NULL
  AND "i"."item_type"::text = "a"."item_type"
  AND lower("i"."name") = lower("a"."alias")
  AND (
    NULLIF(btrim("i"."description"), '') IS NULL
    OR "i"."abv" IS NULL
    OR ("s"."maker" IS NOT NULL AND NULLIF(btrim("i"."brand_maker"), '') IS NULL)
    OR ("s"."origin" IS NOT NULL AND NULLIF(btrim("i"."origin"), '') IS NULL)
  );

-- Generics, only on ingredients, and only where one is not set yet.
UPDATE "public"."items" "i"
SET "generic_id" = "g"."id"
FROM "seed_alias" "a"
JOIN "seed_items" "s" ON "s"."item_type" = "a"."item_type" AND "s"."name" = "a"."name"
-- The generic may already exist under one of its aliases ("Sugar Cubes" for
-- "Sugar Cube"), because we do not insert a second row for the same thing.
JOIN LATERAL (
    SELECT "g"."id"
    FROM "seed_alias" "ga"
    JOIN "public"."items" "g"
      ON "g"."bar_id" IS NULL AND "g"."item_type" = 'ingredient' AND lower("g"."name") = lower("ga"."alias")
    WHERE "ga"."item_type" = 'ingredient' AND "ga"."name" = "s"."generic_name"
    ORDER BY ("g"."name" = "s"."generic_name") DESC, "g"."created_at"
    LIMIT 1
) "g" ON true
WHERE "s"."generic_name" IS NOT NULL
  AND "i"."bar_id" IS NULL
  AND "i"."item_type" = 'ingredient'
  AND "i"."item_type"::text = "a"."item_type"
  AND lower("i"."name") = lower("a"."alias")
  AND "i"."generic_id" IS NULL
  AND "g"."id" <> "i"."id";

-- A category only when the item has none. Domain keeps "Lager" the beer style
-- off an ingredient that happens to share the name.
INSERT INTO "public"."item_categories" ("item_id", "category_id", "is_primary")
SELECT DISTINCT ON ("i"."id") "i"."id", "c"."id", true
FROM "seed_alias" "a"
JOIN "seed_items" "s" ON "s"."item_type" = "a"."item_type" AND "s"."name" = "a"."name"
JOIN "public"."items" "i"
  ON "i"."bar_id" IS NULL AND "i"."item_type"::text = "a"."item_type" AND lower("i"."name") = lower("a"."alias")
JOIN LATERAL (
    SELECT "c"."id"
    FROM "public"."categories" "c"
    WHERE "c"."domain"::text = "s"."category_domain" AND "c"."name" = "s"."category_name"
    ORDER BY "c"."created_at"
    LIMIT 1
) "c" ON true
WHERE "s"."category_name" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "public"."item_categories" "x" WHERE "x"."item_id" = "i"."id")
ORDER BY "i"."id", ("i"."name" = "s"."name") DESC;

-- One shared row per house recipe: the catalog name when it exists, else the
-- oldest alias. Recipes are added only when that row has none.
CREATE TEMP TABLE "seed_target" AS
SELECT DISTINCT ON ("s"."name") "s"."name", "i"."id"
FROM "seed_prep" "s"
JOIN "seed_alias" "a" ON "a"."item_type" = 'ingredient' AND "a"."name" = "s"."name"
JOIN "public"."items" "i"
  ON "i"."bar_id" IS NULL AND "i"."item_type" = 'ingredient' AND lower("i"."name") = lower("a"."alias")
ORDER BY "s"."name", ("i"."name" = "s"."name") DESC, "i"."created_at";

INSERT INTO "public"."recipes" ("recipe_item_id", "ingredient_item_id", "amount", "unit", "preparation_notes", "is_optional", "sort_order")
SELECT "t"."id", "ing"."id", "l"."amount", "l"."unit", "l"."note", false, "l"."pos"
FROM "seed_line" "l"
JOIN "seed_target" "t" ON "t"."name" = "l"."name"
JOIN LATERAL (
    SELECT "i"."id"
    FROM "public"."items" "i"
    WHERE "i"."bar_id" IS NULL AND "i"."item_type" = 'ingredient' AND lower("i"."name") = lower("l"."ingredient")
    ORDER BY ("i"."name" = "l"."ingredient") DESC, "i"."created_at"
    LIMIT 1
) "ing" ON true
WHERE NOT EXISTS (SELECT 1 FROM "public"."recipes" "r" WHERE "r"."recipe_item_id" = "t"."id");

-- The strength trigger reads a batch as if it were one serve. These are prep
-- recipes, so clear that and keep the ABV written above.
UPDATE "public"."items" "i"
SET "serve_ml" = NULL, "serve_abv" = NULL
FROM "seed_target" "t"
WHERE "i"."id" = "t"."id" AND "i"."abv_source" = 'manual';

INSERT INTO "public"."item_prep" ("item_id", "yield_amount", "yield_unit", "shelf_life_hours", "storage", "actions")
SELECT "t"."id", "p"."yield_amount", "p"."yield_unit", "p"."shelf_life_hours", "p"."storage", "p"."actions"
FROM "seed_prep" "p"
JOIN "seed_target" "t" ON "t"."name" = "p"."name"
WHERE NOT EXISTS (SELECT 1 FROM "public"."item_prep" "x" WHERE "x"."item_id" = "t"."id");

INSERT INTO "public"."item_steps" ("item_id", "position", "body")
SELECT "t"."id", "s"."pos", "s"."body"
FROM "seed_step" "s"
JOIN "seed_target" "t" ON "t"."name" = "s"."name"
WHERE NOT EXISTS (SELECT 1 FROM "public"."item_steps" "x" WHERE "x"."item_id" = "t"."id");

DROP INDEX "public"."items_shared_name_tmp";
DROP TABLE "seed_target", "seed_step", "seed_prep", "seed_line", "seed_alias", "seed_items";

RESET "app.image_worker";
`;
}

const sql = build();
if (process.argv.includes('--print')) process.stdout.write(sql);
else {
  writeFileSync(OUT, sql);
  process.stdout.write(`${OUT} ${sql.length} bytes\n`);
}
