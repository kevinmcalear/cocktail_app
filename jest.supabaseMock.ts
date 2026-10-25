/**
 * A stand-in for lib/supabase that records every table call (what it did, the
 * payload, the filters) and answers reads from `rows`. An RPC is recorded as
 * a call with op 'rpc', the function as its table and its args as payload. In a test:
 *   const mockDb = { rows: {}, calls: [] } as MockDb;
 *   jest.mock('@/lib/supabase', () => jest.requireActual('@/jest.supabaseMock').mockSupabase(() => mockDb));
 */
export interface MockCall {
  table: string;
  op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' | 'rpc';
  payload?: unknown;
  filters: [string, unknown][];
}
export interface MockDb {
  /** What a read of each table returns (a row for .single(), a list otherwise). */
  rows: Record<string, unknown>;
  calls: MockCall[];
}

export function mockSupabase(db: () => MockDb) {
  const from = (table: string) => {
    const call: MockCall = { table, op: 'select', filters: [] };
    db().calls.push(call);
    const result = () => ({ data: call.op === 'select' ? (db().rows[table] ?? null) : null, error: null });
    const write = (op: MockCall['op']) => (payload?: unknown) => {
      call.op = op;
      call.payload = payload;
      return q;
    };
    const filter = (column: string, value: unknown) => {
      call.filters.push([column, value]);
      return q;
    };
    const q = {
      select: () => q,
      insert: write('insert'),
      update: write('update'),
      upsert: write('upsert'),
      delete: write('delete'),
      eq: filter,
      in: filter,
      single: async () => result(),
      maybeSingle: async () => result(),
      then: <T>(resolve: (r: ReturnType<typeof result>) => T, reject?: (e: unknown) => T) => Promise.resolve(result()).then(resolve, reject),
    };
    return q;
  };
  const rpc = async (fn: string, args?: unknown) => {
    db().calls.push({ table: fn, op: 'rpc', payload: args, filters: [] });
    return { data: null, error: null };
  };
  return { supabase: { from, rpc } };
}
