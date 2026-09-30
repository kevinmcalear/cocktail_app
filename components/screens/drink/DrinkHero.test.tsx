import { act, fireEvent, screen } from '@testing-library/react-native';
import 'react-native-gesture-handler/jestSetup';

import { BackbarTheme } from '@/components/ds';
import { renderWithTamagui } from '@/jest.setup';

import { DrinkHero } from './DrinkHero';

const pictures = [
  { url: 'a.jpg', isSketch: false, isOutdated: true },
  { url: 'b.jpg', isSketch: false, isOutdated: false },
  { url: 'c.png', isSketch: true, isOutdated: false },
];

// The pager draws its pages once it knows its width.
const layOut = () =>
  act(() => {
    for (const node of screen.container.queryAll((n) => typeof n.props.onLayout === 'function')) {
      node.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 600 } } });
    }
  });

test('each picture is labelled in words, and tapping one opens the viewer on it', async () => {
  await renderWithTamagui(
    <BackbarTheme>
      <DrinkHero name="Martinez" pictures={pictures} glass={null} height={320} fade />
    </BackbarTheme>
  );
  await layOut();

  expect(screen.getAllByRole('button').map((b) => b.props.accessibilityLabel)).toEqual([
    'Martinez, photo 1 of 3, may be out of date. Open full screen',
    'Martinez, photo 2 of 3. Open full screen',
    'Martinez, photo 3 of 3, sketch. Open full screen',
  ]);
  // The visible count and tag, in words, not colour. Hidden from screen
  // readers, which already hear both in each picture's label.
  const hidden = { includeHiddenElements: true };
  expect(screen.getByText('1 of 3', hidden)).toBeTruthy();
  expect(screen.getByText('May be out of date', hidden)).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Martinez, photo 3 of 3, sketch. Open full screen' }));
  // The viewer measures itself, then its pager.
  await layOut();
  await layOut();
  expect(screen.getByRole('button', { name: 'Close photo' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Zoom in' })).toBeTruthy();
  expect(screen.getAllByText('3 of 3').length).toBeGreaterThan(0);
  expect(screen.getByLabelText('Martinez, photo 3 of 3, sketch')).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Zoom in' }));
  expect(screen.getByRole('button', { name: 'Zoom out' })).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Close photo' }));
  expect(screen.queryByRole('button', { name: 'Close photo' })).toBeNull();
});

test('one picture: no count, and no picture shows the glass', async () => {
  await renderWithTamagui(
    <BackbarTheme>
      <DrinkHero name="Daiquiri" pictures={[pictures[1]]} glass={null} height={320} fade />
    </BackbarTheme>
  );
  await layOut();
  expect(screen.getByRole('button', { name: 'Daiquiri, photo. Open full screen' })).toBeTruthy();
  expect(screen.queryByText('1 of 1', { includeHiddenElements: true })).toBeNull();

  await renderWithTamagui(
    <BackbarTheme>
      <DrinkHero name="Daiquiri" pictures={[]} glass={null} height={320} fade />
    </BackbarTheme>
  );
  expect(screen.getByLabelText('Daiquiri, no photo yet')).toBeTruthy();
  expect(screen.queryAllByRole('button')).toHaveLength(0);
});
