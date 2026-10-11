import { act, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { EquipmentDrawing } from './EquipmentDrawing';

// How many elements the drawing rendered: blank paper is a frame and a rect.
function size(node: unknown): number {
  if (!node || typeof node !== 'object') return 0;
  const children = (node as { children?: unknown[] | null }).children ?? [];
  return 1 + children.reduce<number>((n, c) => n + size(c), 0);
}

jest.useFakeTimers();

test('a lazy drawing is blank paper first, then painted once the app is idle', async () => {
  await renderWithTamagui(<EquipmentDrawing id="boston-shaker" lazy />);
  const blank = size(screen.toJSON());
  await act(async () => jest.runAllTimers());
  expect(size(screen.toJSON())).toBeGreaterThan(blank + 2);
});

test('a hero drawing paints at once', async () => {
  await renderWithTamagui(<EquipmentDrawing id="jigger" />);
  const now = size(screen.toJSON());
  await act(async () => jest.runAllTimers());
  expect(size(screen.toJSON())).toBe(now);
});
