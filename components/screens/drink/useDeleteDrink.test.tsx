import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useToastStore } from '@/store/useToastStore';

import { useDeleteDrink } from './useDeleteDrink';

const mockDelete = jest.fn();
jest.mock('@/components/ds', () => ({ useToast: () => ({ show: (t: object) => jest.requireActual('@/store/useToastStore').useToastStore.getState().show(t) }) }));
jest.mock('@/hooks/useCocktails', () => ({ useDeleteCocktail: () => ({ mutate: mockDelete }) }));

const DRINKS = [{ id: 'ash-garden' }, { id: 'bolo-tie' }];

async function deleteAshGarden(onUndo?: () => void) {
  const client = new QueryClient();
  client.setQueryData(['cocktails', null, 'user-1'], DRINKS);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result } = await renderHook(() => useDeleteDrink(), { wrapper });
  await act(async () => result.current({ id: 'ash-garden', name: 'Ash Garden', onUndo }));
  return { client, list: () => client.getQueryData<{ id: string }[]>(['cocktails', null, 'user-1']) };
}

beforeEach(() => {
  jest.clearAllMocks();
  useToastStore.setState({ toast: null });
});

test('the drink leaves the list at once, and the delete waits for the toast to go', async () => {
  const { list } = await deleteAshGarden();
  expect(list()).toEqual([{ id: 'bolo-tie' }]);
  expect(useToastStore.getState().toast?.title).toBe('Ash Garden deleted');
  expect(mockDelete).not.toHaveBeenCalled();
  await act(async () => useToastStore.getState().hide());
  expect(mockDelete).toHaveBeenCalledWith('ash-garden');
});

test('a new toast replacing it sends the delete too', async () => {
  await deleteAshGarden();
  await act(async () => void useToastStore.getState().show({ title: 'Something else' }));
  expect(mockDelete).toHaveBeenCalledTimes(1);
});

test('Undo puts the drink back and never deletes it', async () => {
  const onUndo = jest.fn();
  const { list } = await deleteAshGarden(onUndo);
  await act(async () => {
    useToastStore.getState().toast?.action?.onPress();
    useToastStore.getState().hide();
  });
  expect(list()).toEqual(DRINKS);
  expect(onUndo).toHaveBeenCalled();
  expect(mockDelete).not.toHaveBeenCalled();
});
