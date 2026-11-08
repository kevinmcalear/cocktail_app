import { act, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { DragList } from './DragList';
import type { DragRowProps } from './DragRow';

// DragRow's last props, by index: the test drives the drag through them, as the gesture would.
const mockRows: DragRowProps[] = [];
jest.mock('./DragRow', () => ({
  GRIP_SLOP: 10,
  DragRow: (props: DragRowProps) => {
    mockRows[props.index] = props;
    return props.children((node) => node, false);
  },
}));

const DATA = ['a', 'b', 'c'];

async function show(onReorder = jest.fn(), accept?: (next: string[]) => boolean) {
  await render(<DragList data={DATA} keyOf={(k) => k} onReorder={onReorder} accept={accept} renderRow={(k) => <Text>{k}</Text>} />);
  // Each row 50 tall.
  await act(() => mockRows.forEach((r) => r.onHeight(50)));
  return onReorder;
}

beforeEach(() => {
  mockRows.length = 0;
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

test('a cancelled drag eases the other rows back, then the list forgets it', async () => {
  const onReorder = await show();
  // Row a held over c: b slides up out of its way.
  await act(() => void mockRows[0].onMove?.(0, 100));
  expect(mockRows[1].shift).toBe(-50);
  await act(() => mockRows[0].onCancel?.(0));
  // Back to their places, still easing (a number, not null)...
  expect(mockRows[1].shift).toBe(0);
  expect(mockRows[2].shift).toBe(0);
  // ...then nothing is held, and nothing moved.
  await act(() => jest.advanceTimersByTime(300));
  expect(mockRows[1].shift).toBeNull();
  expect(onReorder).not.toHaveBeenCalled();
});

test('a move accept turns down shows no gap and lands the row back in its place', async () => {
  const onReorder = await show(jest.fn(), (next) => next[1] !== 'a');
  // Row a just past b would be second: turned down, so it lands where it was.
  let land: number | void = undefined;
  await act(() => void (land = mockRows[0].onMove?.(0, 60)));
  expect(land).toBe(0);
  expect(mockRows[1].shift).toBe(0);
  await act(() => mockRows[0].onDrop(0, 60));
  expect(onReorder).not.toHaveBeenCalled();
  // Past c, a lands last: allowed.
  await act(() => void (land = mockRows[0].onMove?.(0, 110)));
  expect(land).toBe(100);
  await act(() => mockRows[0].onDrop(0, 110));
  expect(onReorder).toHaveBeenCalledWith(['b', 'c', 'a'], 0, 2);
});
