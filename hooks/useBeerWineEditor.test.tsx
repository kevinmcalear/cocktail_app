import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useBeerWineEditor } from '@/hooks/useBeerWineEditor';
import type { MockDb } from '@/jest.supabaseMock';

const mockDb: MockDb = { rows: {}, calls: [] };
jest.mock('@/lib/supabase', () => jest.requireActual('@/jest.supabaseMock').mockSupabase(() => mockDb));
jest.mock('@/lib/toast', () => ({ toastDone: jest.fn() }));
jest.mock('@/components/drink/drinkImages', () => ({ imageIdFor: jest.fn(), pickDrinkPhotos: jest.fn(), setItemImages: jest.fn(async () => {}) }));

// The beer as app_item_presentation shows it: tags, but no override levels.
const BEER = { id: 'b1', name: 'Cottage Lager', description: 'Crisp', brand_maker: 'Bellwoods', abv: 5, price: '9.00', bar_id: 'bar1', item_images: [], item_categories: [{ category_id: 'lager' }] };
jest.mock('@/hooks/useBeers', () => ({ useBeer: () => ({ data: BEER, isLoading: false }) }));
jest.mock('@/hooks/useWines', () => ({ useWine: () => ({ data: undefined, isLoading: true }) }));

const LEVELS = { override_visibility_level: 20, override_generic_ingredient_level: 30, override_specific_brand_level: null, override_measurement_level: 40, override_prep_level: null };


async function openBeer() {
  mockDb.calls = [];
  // items answers the levels read; item_categories has a tag added elsewhere since the page loaded.
  mockDb.rows = { items: LEVELS, item_categories: [{ category_id: 'lager' }, { category_id: 'added-elsewhere' }] };
  // gcTime Infinity: no garbage-collection timer left running to hold Jest open.
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const view = await renderHook(() => useBeerWineEditor('beer', 'b1'), { wrapper });
  await waitFor(() => expect(view.result.current.ready).toBe(true));
  mockDb.calls = [];
  return view;
}

const writes = () => mockDb.calls.filter((c) => c.op !== 'select');

test('opens with the saved override levels, read from items', async () => {
  const { result } = await openBeer();
  expect(result.current).toMatchObject({ overrideVisibility: '20', overrideGeneric: '30', overrideSpecific: null, overrideMeasurement: '40', isDirty: false });
});

test('saving without changes writes nothing back and unlinks no tags', async () => {
  const { result } = await openBeer();
  await act(async () => {
    expect(await result.current.handleSave()).toBe(true);
  });
  expect(writes()).toEqual([]);
});

test('a change writes only that column, and an unticked tag unlinks only that tag', async () => {
  const { result } = await openBeer();
  await act(() => result.current.setDescription('Crisp and cold'));
  await act(() => result.current.toggleCategory('lager'));
  await act(async () => {
    await result.current.handleSave();
  });
  expect(writes()).toEqual([
    { table: 'items', op: 'update', payload: { description: 'Crisp and cold' }, filters: [['id', 'b1']] },
    { table: 'item_categories', op: 'delete', payload: undefined, filters: [['item_id', 'b1'], ['category_id', ['lager']]] },
  ]);
});

test.each([
  ['19.50', '19.50'],
  [' MP ', 'MP'],
  ['', null],
])('a price typed as %j saves as %j (items.price is text)', async (typed, saved) => {
  const { result } = await openBeer();
  await act(() => result.current.setPrice(typed));
  await act(async () => {
    await result.current.handleSave();
  });
  expect(writes()).toEqual([{ table: 'items', op: 'update', payload: { price: saved }, filters: [['id', 'b1']] }]);
});
