import { act, renderHook } from '@testing-library/react-native';

import { useNextOnceChecked } from './useNextOnceChecked';

// The first tap on Next right after typing a name (owner walkthrough, 25 Oct).
describe('useNextOnceChecked', () => {
  test('a tap while the name is checked goes once the check is back', async () => {
    const next = jest.fn();
    const { result, rerender } = await renderHook(({ checking, held }: { checking: boolean; held: boolean }) => useNextOnceChecked(checking, held, next), { initialProps: { checking: true, held: false } });
    await act(async () => result.current());
    expect(next).not.toHaveBeenCalled();
    await rerender({ checking: false, held: false });
    expect(next).toHaveBeenCalledTimes(1);
    await rerender({ checking: false, held: false });
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('a check that finds the bar’s drink holds it for the pick', async () => {
    const next = jest.fn();
    const { result, rerender } = await renderHook(({ checking, held }: { checking: boolean; held: boolean }) => useNextOnceChecked(checking, held, next), { initialProps: { checking: true, held: false } });
    await act(async () => result.current());
    await rerender({ checking: false, held: true });
    expect(next).not.toHaveBeenCalled();
    await act(async () => result.current());
    expect(next).not.toHaveBeenCalled();
  });

  test('with the check done, a tap goes straight on', async () => {
    const next = jest.fn();
    const { result } = await renderHook(() => useNextOnceChecked(false, false, next));
    await act(async () => result.current());
    expect(next).toHaveBeenCalledTimes(1);
  });
});
