import { savePrepRecipe } from '@/hooks/usePrepCard';
import { startPrep } from '@/lib/prepKinds';

// Every update, by table: [table, values, id].
const mockUpdates: [string, Record<string, unknown>, unknown][] = [];
const ROLES: Record<string, string> = { bacardi: 'product', 'coconut-oil': 'generic' };
jest.mock('@/lib/supabase', () => {
  const chain = (table: string, result: () => unknown) => {
    const q: Record<string, unknown> = {};
    let id: unknown;
    let values: Record<string, unknown> | null = null;
    q.select = () => q;
    q.update = (v: Record<string, unknown>) => ((values = v), q);
    q.eq = (_: string, v: unknown) => {
      id = v;
      if (values) mockUpdates.push([table, values, v]);
      return q;
    };
    q.maybeSingle = async () => ({ data: ROLES[id as string] ? { ingredient_role: ROLES[id as string] } : null, error: null });
    q.then = (res: (v: unknown) => unknown) => Promise.resolve(result()).then(res);
    return q;
  };
  return {
    supabase: {
      from: (table: string) => ({
        ...chain(table, () => ({ data: null, error: null })),
        insert: () => chain(table, () => ({ data: null, error: null })),
        upsert: () => chain(table, () => ({ data: null, error: null })),
        delete: () => chain(table, () => ({ data: null, error: null })),
      }),
    },
  };
});

const ensure = async ({ name }: { id: string | null; name: string }) => (name === 'Bacardí Carta Blanca' ? 'bacardi' : name === 'Coconut oil' ? 'coconut-oil' : 'other');

test('a prep whose base is a bottle is made from that bottle', async () => {
  mockUpdates.length = 0;
  const prep = startPrep('infusion', 'Coconut infused rum');
  const base = prep.lines.find((l) => l.key === prep.baseKey)!;
  base.name = 'Bacardí Carta Blanca';
  await savePrepRecipe('prep-1', prep, ensure);
  expect(mockUpdates).toContainEqual(['items', { made_from_id: 'bacardi' }, 'prep-1']);
});

test('a prep whose base is a plain ingredient isn’t made from anything', async () => {
  mockUpdates.length = 0;
  const prep = startPrep('infusion', 'Coconut infused rum');
  prep.lines.find((l) => l.key === prep.baseKey)!.name = 'Coconut oil';
  await savePrepRecipe('prep-2', prep, ensure);
  expect(mockUpdates.some(([, v]) => 'made_from_id' in v)).toBe(false);
});

test('made house from a bottle in the drink: made from that bottle, and a stand-in is never saved', async () => {
  mockUpdates.length = 0;
  const prep = startPrep('infusion', 'Coconut infused rum');
  prep.madeFrom = { id: 'bacardi', name: 'Bacardí Carta Blanca' };
  prep.lines.push({ key: 'slot', id: null, name: 'Spirit', parts: 1, unit: 'ml', amount: '', slot: 'spirit' });
  const names: string[] = [];
  await savePrepRecipe('prep-3', prep, async (p) => (names.push(p.name), 'other'));
  expect(mockUpdates).toContainEqual(['items', { made_from_id: 'bacardi' }, 'prep-3']);
  expect(names).not.toContain('Spirit');
});
