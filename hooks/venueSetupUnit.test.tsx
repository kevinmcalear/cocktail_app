import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';

import { useSettingsStore } from '@/store/useSettingsStore';

import { useCreateSetupVenue } from './useVenueSetup';

const mockUpdate = jest.fn();
jest.mock('expo-localization', () => ({ getLocales: () => [{ regionCode: 'GB' }] }));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: async () => ({ data: { id: 'new-bar' }, error: null }),
    from: () => ({ update: (row: unknown) => ({ eq: async (_c: string, id: string) => (mockUpdate(row, id), { error: null }) }) }),
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockUpdate.mockReset();
  useSettingsStore.setState({ units: null });
});

async function create(country: string | null) {
  const { result } = await renderHook(() => useCreateSetupVenue(), { wrapper });
  await act(async () => void (await result.current.mutateAsync({ name: 'Attaboy', country })));
}

test('a new bar starts on its country’s unit: a New York bar on oz, though the phone is British', async () => {
  await create('US');
  expect(mockUpdate).toHaveBeenCalledWith({ spec_unit: 'oz' }, 'new-bar');
});

test('the owner’s own unit wins, and a bar on ml writes nothing', async () => {
  useSettingsStore.setState({ units: 'cl' });
  await create('US');
  expect(mockUpdate).toHaveBeenCalledWith({ spec_unit: 'cl' }, 'new-bar');
  mockUpdate.mockReset();
  useSettingsStore.setState({ units: null });
  await create('GB');
  expect(mockUpdate).not.toHaveBeenCalled();
});

// Review 12 Nov: confirming Where and when again on a bar that exists reset its unit (cl became ml).
// The country's unit is written only as a bar is made: nothing else in setup (re-confirming Where and
// when, a changed country, the checklist's way back in) may write bars.spec_unit.
test('only creating a bar sets its unit from the country; setup never writes it again', () => {
  const read = (f: string) => readFileSync(join(__dirname, '..', f), 'utf8');
  const hooks = read('hooks/useVenueSetup.ts');
  expect(hooks.match(/spec_unit/g)).toHaveLength(1);
  expect(hooks.indexOf('spec_unit')).toBeGreaterThan(hooks.indexOf("rpc('create_new_bar'"));
  for (const f of ['components/screens/venueSetup/VenueSetupScreen.tsx', 'components/screens/venueSetup/WhereWhenStep.tsx']) {
    expect(read(f)).not.toMatch(/spec_unit|startingBarUnit|StartingBarUnit/);
  }
});
