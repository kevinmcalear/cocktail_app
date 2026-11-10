import { linesOnKeptHouseMades, saveEditItems, withKeptHouseMades } from '@/hooks/specLineSave';
import type { WizardLine } from '@/lib/drinkWizard';
import { startPrep } from '@/lib/prepKinds';
import type { SortableRecipeItem } from '@/lib/recipeItem';

// The editors' saves (saveEditItems): house-mades written inside a spec save with it or not at all (review of #1187).
jest.mock('@/hooks/usePrepCard', () => ({ savePrepCard: jest.fn(), savePrepRecipe: jest.fn() }));
jest.mock('@/hooks/useDrinkDesk', () => ({ saveNewBottles: async () => [] }));

const mockDeletes: string[][] = [];
const mockState = { deleteFails: false, houseMadeCalls: 0 };
jest.mock('@/lib/supabase', () => {
  const chain = (result: () => unknown) => {
    const q: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'ilike', 'limit', 'is']) q[m] = () => q;
    q.in = async () => ({ data: [], error: null });
    q.maybeSingle = q.single = async () => result();
    return q;
  };
  return {
    supabase: {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        if (fn === 'save_house_mades') {
          mockState.houseMadeCalls++;
          return { data: (args.p_preps as unknown[]).map((_, i) => `made-${i}`), error: null };
        }
        // A typed line whose lookup loses the connection.
        if (args.p_name === 'Blip') throw new TypeError('Network request failed');
        return { data: null, error: null };
      },
      from: () => ({
        ...chain(() => ({ data: null, error: null })),
        // A typed line the database refuses outright.
        insert: (row: { name: string }) => chain(() => (row.name === 'Nope' ? { data: null, error: { code: '42501', message: 'not allowed' } } : { data: { id: 'typed-row' }, error: null })),
        delete: () => ({ in: async (_: string, ids: string[]) => (mockDeletes.push(ids), { error: mockState.deleteFails ? { message: 'no signal' } : null }) }),
      }),
    },
  };
});

const pine: SortableRecipeItem = { key: 'p', ingredient_id: '', name: 'Pine syrup', amount: '15', unit: 'ml', prep: startPrep('syrup', 'Pine syrup') };
const lime: SortableRecipeItem = { key: 'l', ingredient_id: 'lime', name: 'Lime', amount: '30', unit: 'ml' };
const typed = (name: string): SortableRecipeItem => ({ key: name, ingredient_id: '', name, amount: '5', unit: 'ml' });
const refused = { code: 'P0001', message: 'spec refused' };
const dropped = new TypeError('Network request failed');

// What the editor is left with (the last put), and what the save threw.
async function save(items: SortableRecipeItem[], write: (items: SortableRecipeItem[]) => Promise<unknown>) {
  const put: SortableRecipeItem[][] = [];
  const error = await saveEditItems(items, 'bar-1', (i) => put.push(i), write).then(
    () => null,
    (e: unknown) => e
  );
  return { error, last: put.at(-1)! };
}

beforeEach(() => {
  mockDeletes.length = 0;
  mockState.deleteFails = false;
  mockState.houseMadeCalls = 0;
});

test('a spec the server refuses: the house-made goes again and its line is as it was, recipe and all', async () => {
  const { error, last } = await save([lime, pine], () => Promise.reject(refused));
  expect(error).toBe(refused);
  expect(mockDeletes).toEqual([['made-0']]);
  expect(last).toEqual([lime, pine]);
});

test('a dropped connection on the spec: the house-made stays (the spec may be in), and its line is on it, so a retry uses it', async () => {
  const { error, last } = await save([lime, pine], () => Promise.reject(dropped));
  expect(error).toBe(dropped);
  expect(mockDeletes).toEqual([]);
  expect(last[1]).toMatchObject({ ingredient_id: 'made-0', name: 'Pine syrup' });
  expect(last[1].prep).toBeUndefined();
  // Tried again: the house-made isn't sent twice.
  const again = await save(last, async (items) => items);
  expect(again.error).toBeNull();
  expect(mockState.houseMadeCalls).toBe(1);
});

test('a line refused after the house-mades saved, before the spec is written, takes them back too', async () => {
  const write = jest.fn();
  const { error, last } = await save([pine, typed('Nope')], write);
  expect(error).toMatchObject({ message: 'not allowed' });
  expect(write).not.toHaveBeenCalled();
  expect(mockDeletes).toEqual([['made-0']]);
  expect(last[0]).toBe(pine);
});

test('a line whose lookup loses the connection before the spec: the house-made stays and its line is on it', async () => {
  const { error, last } = await save([pine, typed('Blip')], jest.fn());
  expect(error).toBeInstanceOf(TypeError);
  expect(mockDeletes).toEqual([]);
  expect(last[0]).toMatchObject({ ingredient_id: 'made-0' });
});

test('a clean-up delete that fails leaves the line on the saved house-made', async () => {
  mockState.deleteFails = true;
  const { last } = await save([pine], () => Promise.reject(refused));
  expect(mockDeletes).toEqual([['made-0']]);
  expect(last[0]).toMatchObject({ ingredient_id: 'made-0' });
  expect(last[0].prep).toBeUndefined();
});

test('two lines with one house-made send it once, and both use it', async () => {
  const finish: SortableRecipeItem = { ...pine, key: 'f', name: 'pine syrup', amount: '3', unit: 'drop' };
  const { last } = await save([pine, finish], async (items) => items);
  expect(mockState.houseMadeCalls).toBe(1);
  expect(last.map((i) => i.ingredient_id)).toEqual(['made-0', 'made-0']);
});

test('the add-drink draft: a kept house-made puts its line on the saved row; none kept changes nothing', () => {
  const line: WizardLine = { key: 'p', id: null, name: 'Pine syrup', amount: '15', unit: 'ml', prep: startPrep('syrup', 'Pine syrup') };
  const other: WizardLine = { key: 'l', id: 'lime', name: 'Lime', amount: '30', unit: 'ml' };
  const on = linesOnKeptHouseMades(withKeptHouseMades(dropped, new Map([[line, 'made-0']])), { lines: [other, line], garnishes: [] })!;
  expect(on.lines[0]).toBe(other);
  expect(on.lines[1]).toEqual({ key: 'p', id: 'made-0', name: 'Pine syrup', amount: '15', unit: 'ml' });
  expect(linesOnKeptHouseMades(withKeptHouseMades(refused, new Map()), { lines: [line], garnishes: [] })).toBeNull();
});
