import { act, screen } from '@testing-library/react-native';
import 'react-native-gesture-handler/jestSetup';

import { renderWithTamagui } from '@/jest.setup';
import { drinkSeed, seedDrink } from '@/lib/drinkSeeds';

import { DrinkLoading } from './DrinkLoading';

// The pager draws its pages once it knows its width.
const layOut = () =>
  act(() => {
    for (const node of screen.container.queryAll((n) => typeof n.props.onLayout === 'function')) {
      node.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 600 } } });
    }
  });

test('a tapped row paints its picture and name while the drink loads', async () => {
  seedDrink({ id: 'd1', name: 'Martinez', imageUrl: 'https://x/martinez.jpg' });
  await renderWithTamagui(<DrinkLoading seed={drinkSeed('d1')} />);
  await layOut();
  expect(screen.getByLabelText('Loading Martinez')).toBeTruthy();
  expect(screen.getByText('Martinez')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Martinez, photo. Open full screen' })).toBeTruthy();
});

test('with no row, just the page ground', async () => {
  await renderWithTamagui(<DrinkLoading seed={null} />);
  expect(screen.getByLabelText('Loading drink')).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
});
