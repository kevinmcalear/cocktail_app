import { act, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { EquipmentDrawing } from './EquipmentDrawing';

// How much the drawing holds: blank paper is an empty frame, a painted scene
// hundreds of paths (one image's SVG document on native, elements on web).
const size = (node: unknown) => JSON.stringify(node).length;

jest.useFakeTimers();

test('a lazy drawing is blank paper first, then painted once the app is idle', async () => {
  await renderWithTamagui(<EquipmentDrawing id="boston-shaker" lazy />);
  const blank = size(screen.toJSON());
  await act(async () => jest.runAllTimers());
  expect(size(screen.toJSON())).toBeGreaterThan(blank * 2);
});

test('a hero drawing paints at once', async () => {
  await renderWithTamagui(<EquipmentDrawing id="jigger" />);
  const now = size(screen.toJSON());
  await act(async () => jest.runAllTimers());
  expect(size(screen.toJSON())).toBe(now);
});
