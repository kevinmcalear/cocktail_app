import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useBottleSpots } from '@/hooks/useBackBar';

// Each write resolves what its table and verb are set to; every call is kept.
type Result = { data: unknown; error: { code?: string; message: string } | null };
let mockResults: Record<string, Result> = {};
let mockCalls: { table: string; op: string; payload?: unknown }[] = [];

jest.mock('@/hooks/useBulk', () => ({ useSwapSource: () => ({ data: null }) }));
jest.mock('@/hooks/useTonight', () => ({ useTonight: () => ({ drinks: [], isLoading: false }) }));
jest.mock('@/lib/dialogs', () => ({ showMessage: jest.fn() }));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const write = (op: string, payload?: unknown) => {
        mockCalls.push({ table, op, payload });
        const result = mockResults[`${table}.${op}`] ?? { data: null, error: null };
        const chain = { eq: () => chain, in: () => chain, select: () => chain, then: (done: (r: Result) => unknown) => Promise.resolve(result).then(done) };
        return chain;
      };
      return { update: (v: unknown) => write('update', v), delete: () => write('delete'), insert: (v: unknown) => write('insert', v) };
    },
  },
}));

const SPOT = { id: 'spot-1', bar_id: 'rye', item_id: 'vida', zone_id: 'z', shelf: null, container: null, photo_url: null, par_amount: null, par_unit: null, sort_order: 1 };
const STOCK = { item_id: 'vida', source: 'drink', from_name: 'Ash Garden', added_at: '2026-10-01T12:00:00.000Z' };

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(() => useBottleSpots('rye'), { wrapper });
}

beforeEach(() => {
  mockCalls = [];
  mockResults = {};
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('taking a bottle off the back bar', () => {
  test('the spots and the stock row come off, and Undo puts both back as they were', async () => {
    mockResults = { 'item_locations.delete': { data: [SPOT], error: null }, 'back_bar_items.delete': { data: [STOCK], error: null } };
    const { result } = await setup();
    let done!: Awaited<ReturnType<typeof result.current.takeOff.mutateAsync>>;
    await act(async () => {
      done = await result.current.takeOff.mutateAsync('vida');
    });
    expect(done).toEqual({ removed: [SPOT], stock: STOCK });

    await act(async () => {
      await result.current.putBack.mutateAsync(done.removed);
      await result.current.restock.mutateAsync(done.stock!);
    });
    expect(mockCalls.filter((c) => c.op === 'insert')).toEqual([
      { table: 'item_locations', op: 'insert', payload: [SPOT] },
      { table: 'back_bar_items', op: 'insert', payload: { bar_id: 'rye', ...STOCK } },
    ]);
  });

  test('a stock row that will not come off does not fail it: the spots still changed', async () => {
    mockResults = { 'item_locations.delete': { data: [SPOT], error: null }, 'back_bar_items.delete': { data: null, error: { message: 'offline' } } };
    const { result } = await setup();
    let done!: Awaited<ReturnType<typeof result.current.takeOff.mutateAsync>>;
    await act(async () => {
      done = await result.current.takeOff.mutateAsync('vida');
    });
    expect(done).toEqual({ removed: [SPOT], stock: null });
  });

  test('Replace hands back the old bottle’s stock row too, and a row already back is fine', async () => {
    mockResults = {
      'item_locations.update': { data: [{ id: 'spot-1' }], error: null },
      'back_bar_items.delete': { data: [STOCK], error: null },
      'back_bar_items.insert': { data: null, error: { code: '23505', message: 'duplicate' } },
    };
    const { result } = await setup();
    let done!: Awaited<ReturnType<typeof result.current.replace.mutateAsync>>;
    await act(async () => {
      done = await result.current.replace.mutateAsync({ fromId: 'vida', toId: 'montelobos' });
    });
    expect(done).toEqual({ moved: ['spot-1'], stock: STOCK });
    await act(async () => {
      await result.current.restock.mutateAsync(done.stock!);
    });
  });
});
