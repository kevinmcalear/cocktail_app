// Recipe details and member emails follow the caller's role in the bar.
// Recipes are read through app_recipe_presentation, which masks ingredients,
// measurements and prep notes per the bar's levels and each drink's overrides;
// raw recipe rows are for editors only. The ingredient a row shows is embedded
// through the display_ingredient computed relationship, never through the raw
// ingredient columns. Raw bar items follow each item's visibility level, except
// for editors. get_bar_members shows emails to admins.
// Runs through the real API against the local stack.
//
//   supabase start && supabase db reset
//   npm run test:security

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run role-scoped read tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);

// Bar defaults (the column defaults): visibility 10, generic ingredient 20,
// specific brand 30, measurements 30, prep 40.
const ROLES = { guest: 10, employee: 20, bartender: 30, creator: 35, admin: 40 };

const users = {};
const ids = {};

async function makeUser(label) {
  const email = `${label}-${run}@role-reads-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, email, client };
}

async function serviceInsert(table, row) {
  const { data, error } = await service.from(table).insert(row).select().single();
  if (error) throw new Error(`fixture insert into ${table} failed: ${error.message}`);
  return data;
}

async function addRecipe(drinkId, notes) {
  return (
    await serviceInsert('recipes', {
      recipe_item_id: drinkId,
      ingredient_item_id: ids.brand,
      parent_ingredient_id: ids.generic,
      amount: 2,
      unit: 'oz',
      preparation_notes: notes,
      sort_order: 0,
    })
  ).id;
}

async function presented(client, drinkId) {
  const { data, error } = await client
    .from('app_recipe_presentation')
    .select('display_ingredient_id, amount, unit, preparation_notes')
    .eq('recipe_item_id', drinkId);
  assert.ifError(error);
  return data;
}

async function rawRecipes(client, drinkId) {
  const { data, error } = await client.from('recipes').select('id, amount, unit, preparation_notes').eq('recipe_item_id', drinkId);
  assert.ifError(error);
  return data;
}

before(async () => {
  for (const label of [...Object.keys(ROLES), 'outsider']) users[label] = await makeUser(label);

  ids.bar = (await serviceInsert('bars', { name: `Role reads bar ${run}` })).id;
  for (const [label, role] of Object.entries(ROLES)) {
    await serviceInsert('user_bars', { user_id: users[label].id, bar_id: ids.bar, role_level: role });
  }

  ids.generic = (await serviceInsert('items', { name: `Gin ${run}`, item_type: 'ingredient' })).id;
  ids.brand = (await serviceInsert('items', { name: `House gin ${run}`, item_type: 'ingredient' })).id;

  // Uses the bar's defaults.
  ids.standard = (await serviceInsert('items', { name: `Standard sour ${run}`, item_type: 'cocktail', bar_id: ids.bar })).id;
  ids.standardRecipe = await addRecipe(ids.standard, `standard prep ${run}`);

  // Opens measurements to employees and prep to bartenders.
  ids.open = (
    await serviceInsert('items', {
      name: `Open fizz ${run}`, item_type: 'cocktail', bar_id: ids.bar,
      override_measurement_level: 20, override_prep_level: 30,
    })
  ).id;
  await addRecipe(ids.open, `open prep ${run}`);

  // Hidden from anyone below bartender.
  ids.hidden = (
    await serviceInsert('items', {
      name: `Hidden flip ${run}`, item_type: 'cocktail', bar_id: ids.bar, override_visibility_level: 30,
    })
  ).id;
  await addRecipe(ids.hidden, `hidden prep ${run}`);

  // Readable only by admins, or by anyone who may edit the bar's items.
  ids.adminOnly = (
    await serviceInsert('items', {
      name: `Admin only tonic ${run}`, item_type: 'cocktail', bar_id: ids.bar, override_visibility_level: 40,
    })
  ).id;
  ids.image = (await serviceInsert('images', { url: `https://example.test/${run}.jpg` })).id;
  await serviceInsert('item_images', { item_id: ids.hidden, image_id: ids.image, sort_order: 0 });

  // Shared catalog drink with no bar: full detail for anyone signed in.
  ids.shared = (await serviceInsert('items', { name: `Shared daiquiri ${run}`, item_type: 'cocktail' })).id;
  await addRecipe(ids.shared, `shared prep ${run}`);
});

after(async () => {
  const allItems = [ids.standard, ids.open, ids.hidden, ids.adminOnly, ids.shared, ids.generic, ids.brand].filter(Boolean);
  if (allItems.length) await service.from('items').delete().in('id', allItems);
  if (ids.image) await service.from('images').delete().eq('id', ids.image);
  if (ids.bar) await service.from('bars').delete().eq('id', ids.bar);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
});

describe('app_recipe_presentation with the bar defaults', () => {
  // [role, display ingredient, amount, unit, prep notes]
  const expected = {
    guest: [null, null, null, null],
    employee: ['generic', null, null, null],
    bartender: ['brand', 2, 'oz', null],
    creator: ['brand', 2, 'oz', null],
    admin: ['brand', 2, 'oz', 'standard prep'],
  };

  for (const [label, [ingredient, amount, unit, prep]] of Object.entries(expected)) {
    test(`${label} (${ROLES[label]}) sees exactly their level of detail`, async () => {
      const rows = await presented(users[label].client, ids.standard);
      assert.equal(rows.length, 1);
      const [row] = rows;
      assert.equal(row.display_ingredient_id, ingredient && ids[ingredient]);
      assert.equal(row.amount === null ? null : Number(row.amount), amount);
      assert.equal(row.unit, unit);
      assert.equal(row.preparation_notes, prep && `${prep} ${run}`);
    });
  }

  test('someone outside the bar sees no rows', async () => {
    assert.deepEqual(await presented(users.outsider.client, ids.standard), []);
  });

  test('signed-out requests see nothing', async () => {
    const { data } = await anon.from('app_recipe_presentation').select('id').eq('recipe_item_id', ids.shared);
    assert.ok(!data || data.length === 0);
  });

  test('view-as lowers what an admin sees but never raises it', async () => {
    const admin = users.admin;
    await service.from('user_prefs').upsert({ user_id: admin.id, view_as_role_level: 10 });
    try {
      const [row] = await presented(admin.client, ids.standard);
      assert.equal(row.display_ingredient_id, null);
      assert.equal(row.amount, null);
      assert.equal(row.preparation_notes, null);
    } finally {
      await service.from('user_prefs').delete().eq('user_id', admin.id);
    }
  });

  test('embedding through app_item_presentation keeps the masking', async () => {
    const { data, error } = await users.employee.client
      .from('app_item_presentation')
      .select('id, recipes:app_recipe_presentation!recipe_item_id(amount, preparation_notes, display_ingredient_id)')
      .eq('id', ids.standard)
      .single();
    assert.ifError(error);
    assert.deepEqual(data.recipes, [{ amount: null, preparation_notes: null, display_ingredient_id: ids.generic }]);
  });
});

describe('ingredient columns and the display_ingredient relationship', () => {
  async function ingredientColumns(label, drinkId = ids.standard) {
    const { data, error } = await users[label].client
      .from('app_recipe_presentation')
      .select('display_ingredient_id, ingredient_item_id, parent_ingredient_id, ingredient:display_ingredient(id, name)')
      .eq('recipe_item_id', drinkId)
      .single();
    assert.ifError(error);
    return data;
  }

  // [role, shown ingredient, ingredient_item_id, parent_ingredient_id]
  const expected = {
    guest: [null, null, null],
    employee: ['generic', null, 'generic'],
    bartender: ['brand', 'brand', 'generic'],
    admin: ['brand', 'brand', 'generic'],
  };

  for (const [label, [shown, specific, parent]] of Object.entries(expected)) {
    test(`${label} (${ROLES[label]}) gets raw ingredient ids and the embedded ingredient only at their level`, async () => {
      const row = await ingredientColumns(label);
      assert.equal(row.ingredient_item_id, specific && ids[specific]);
      assert.equal(row.parent_ingredient_id, parent && ids[parent]);
      assert.equal(row.display_ingredient_id, shown && ids[shown]);
      if (shown) {
        assert.equal(row.ingredient.id, ids[shown]);
        assert.equal(row.ingredient.name, `${shown === 'brand' ? 'House gin' : 'Gin'} ${run}`);
      } else {
        assert.equal(row.ingredient, null);
      }
    });
  }

  test('the raw ingredient columns cannot be used to embed items', async () => {
    for (const hint of ['ingredient_item_id', 'parent_ingredient_id']) {
      const { data, error } = await users.employee.client
        .from('app_recipe_presentation')
        .select(`id, item:items!${hint}(name)`)
        .eq('recipe_item_id', ids.standard);
      assert.ok(error, `embedding through ${hint} should be rejected`);
      assert.equal(data, null);
    }
  });

  test('view-as masks the embedded ingredient too', async () => {
    const admin = users.admin;
    await service.from('user_prefs').upsert({ user_id: admin.id, view_as_role_level: 20 });
    try {
      const row = await ingredientColumns('admin');
      assert.equal(row.ingredient_item_id, null);
      assert.equal(row.ingredient.id, ids.generic);
    } finally {
      await service.from('user_prefs').delete().eq('user_id', admin.id);
    }
  });

  test('a shared drink shows its specific ingredient to anyone signed in', async () => {
    const row = await ingredientColumns('outsider', ids.shared);
    assert.equal(row.ingredient_item_id, ids.brand);
    assert.equal(row.ingredient.id, ids.brand);
  });

  test('the embed nests under both presentation views and under items', async () => {
    const { data: viaView, error: viewError } = await users.employee.client
      .from('app_item_presentation')
      .select('id, recipes:app_recipe_presentation!recipe_item_id(ingredient:display_ingredient(id, item_images(image_id)))')
      .eq('id', ids.standard)
      .single();
    assert.ifError(viewError);
    assert.deepEqual(viaView.recipes, [{ ingredient: { id: ids.generic, item_images: [] } }]);

    const { data: viaItems, error: itemsError } = await users.employee.client
      .from('items')
      .select('id, recipes:app_recipe_presentation!recipe_item_id(amount, ingredient:display_ingredient(name))')
      .eq('id', ids.standard)
      .single();
    assert.ifError(itemsError);
    assert.deepEqual(viaItems.recipes, [{ amount: null, ingredient: { name: `Gin ${run}` } }]);
  });
});

describe('app_recipe_presentation with per-drink overrides', () => {
  test('lower measurement and prep levels open detail to those roles', async () => {
    const [employeeRow] = await presented(users.employee.client, ids.open);
    assert.equal(Number(employeeRow.amount), 2);
    assert.equal(employeeRow.unit, 'oz');
    assert.equal(employeeRow.preparation_notes, null);

    const [bartenderRow] = await presented(users.bartender.client, ids.open);
    assert.equal(bartenderRow.preparation_notes, `open prep ${run}`);
  });

  test('a raised visibility level hides the whole recipe from lower roles', async () => {
    assert.deepEqual(await presented(users.guest.client, ids.hidden), []);
    assert.deepEqual(await presented(users.employee.client, ids.hidden), []);
    assert.equal((await presented(users.bartender.client, ids.hidden)).length, 1);
  });

  test('a shared drink with no bar shows full detail to anyone signed in', async () => {
    const [row] = await presented(users.outsider.client, ids.shared);
    assert.equal(Number(row.amount), 2);
    assert.equal(row.preparation_notes, `shared prep ${run}`);
  });
});

describe('the raw recipes table', () => {
  for (const label of ['guest', 'employee', 'bartender', 'outsider']) {
    test(`${label} cannot read raw recipe rows`, async () => {
      assert.deepEqual(await rawRecipes(users[label].client, ids.standard), []);
      assert.deepEqual(await rawRecipes(users[label].client, ids.open), []);
    });
  }

  test('a non-editor cannot read raw rows of a shared drink they did not create', async () => {
    assert.deepEqual(await rawRecipes(users.outsider.client, ids.shared), []);
  });

  for (const label of ['creator', 'admin']) {
    test(`${label} (${ROLES[label]}) reads raw rows of the bar's drinks, which they can edit`, async () => {
      const rows = await rawRecipes(users[label].client, ids.standard);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].preparation_notes, `standard prep ${run}`);
    });
  }

  test('an editor can still update a recipe row by id', async () => {
    const { data, error } = await users.creator.client
      .from('recipes')
      .update({ unit: 'ml' })
      .eq('id', ids.standardRecipe)
      .select('unit');
    assert.ifError(error);
    assert.deepEqual(data, [{ unit: 'ml' }]);
    await service.from('recipes').update({ unit: 'oz' }).eq('id', ids.standardRecipe);
  });

  test('a bartender cannot update a recipe row', async () => {
    const { data } = await users.bartender.client
      .from('recipes')
      .update({ unit: 'ml' })
      .eq('id', ids.standardRecipe)
      .select('unit');
    assert.deepEqual(data, []);
    const { data: row } = await service.from('recipes').select('unit').eq('id', ids.standardRecipe).single();
    assert.equal(row.unit, 'oz');
  });
});

describe('the raw items table', () => {
  async function readable(label, itemId) {
    const { data, error } = await users[label].client.from('items').select('id').eq('id', itemId);
    assert.ifError(error);
    return data.length === 1;
  }

  // [role, can read ids.hidden (visibility 30), can read ids.adminOnly (visibility 40)]
  const expected = {
    guest: [false, false],
    employee: [false, false],
    bartender: [true, false],
    creator: [true, true],
    admin: [true, true],
    outsider: [false, false],
  };

  for (const [label, [hidden, adminOnly]] of Object.entries(expected)) {
    test(`${label} reads bar items only at or above their visibility level, unless they edit them`, async () => {
      assert.equal(await readable(label, ids.hidden), hidden);
      assert.equal(await readable(label, ids.adminOnly), adminOnly);
      assert.equal(await readable(label, ids.standard), label !== 'outsider');
      assert.equal(await readable(label, ids.shared), true);
    });
  }

  test('child rows of a hidden item are hidden with it', async () => {
    for (const [label, visible] of [['employee', false], ['bartender', true]]) {
      const { data, error } = await users[label].client.from('item_images').select('image_id').eq('item_id', ids.hidden);
      assert.ifError(error);
      assert.equal(data.length, visible ? 1 : 0, label);
    }
  });

  test('an editor can still update an item above their own visibility level', async () => {
    const { data, error } = await users.creator.client
      .from('items')
      .update({ notes: `edited ${run}` })
      .eq('id', ids.adminOnly)
      .select('id');
    assert.ifError(error);
    assert.deepEqual(data, [{ id: ids.adminOnly }]);
  });

  test('app_item_presentation still applies view-as on top of the table policy', async () => {
    const admin = users.admin;
    await service.from('user_prefs').upsert({ user_id: admin.id, view_as_role_level: 10 });
    try {
      const { data, error } = await admin.client.from('app_item_presentation').select('id').eq('id', ids.hidden);
      assert.ifError(error);
      assert.deepEqual(data, []);
    } finally {
      await service.from('user_prefs').delete().eq('user_id', admin.id);
    }
  });
});

describe('get_bar_members', () => {
  async function members(label) {
    return users[label].client.rpc('get_bar_members', { p_bar_id: ids.bar });
  }

  test('an admin sees every member\'s email', async () => {
    const { data, error } = await members('admin');
    assert.ifError(error);
    assert.equal(data.length, Object.keys(ROLES).length);
    for (const label of Object.keys(ROLES)) {
      assert.equal(data.find((m) => m.user_id === users[label].id).email, users[label].email);
    }
  });

  for (const label of ['guest', 'employee', 'bartender', 'creator']) {
    test(`${label} (${ROLES[label]}) sees the roster and only their own email`, async () => {
      const { data, error } = await members(label);
      assert.ifError(error);
      assert.equal(data.length, Object.keys(ROLES).length);
      for (const member of data) {
        assert.equal(member.email, member.user_id === users[label].id ? users[label].email : null);
        assert.ok(Number.isInteger(member.role_level));
      }
    });
  }

  test('someone outside the bar gets an error', async () => {
    const { data, error } = await members('outsider');
    assert.ok(error);
    assert.equal(data, null);
  });

  test('signed-out requests cannot call it', async () => {
    const { error } = await anon.rpc('get_bar_members', { p_bar_id: ids.bar });
    assert.ok(error);
  });
});
