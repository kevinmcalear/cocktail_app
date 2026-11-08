import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/jest.setup';

import { NestedPrep } from './NestedPrep';

jest.mock('@/components/ViewAsBanner', () => ({ ViewAsPill: () => null }));
jest.mock('@/hooks/useNearIngredients', () => ({ useNearIngredients: () => [], useNearIngredientsChecked: () => ({ near: [], checking: false }) }));
jest.mock('@/hooks/useKit', () => ({ useKit: () => ({ owned: [], kit: new Set(), toggle: jest.fn() }) }));
jest.mock('@/hooks/useBarKit', () => ({ useMakingKit: () => ({ kit: new Set(), where: 'My Bar', add: jest.fn() }) }));
jest.mock('@/hooks/usePrepCard', () => ({
  ...jest.requireActual('@/hooks/usePrepCard'),
  useCatalogRecipe: () => ({ data: null }),
}));

const open = async (props: { onLater?: jest.Mock; onDone?: jest.Mock; onClose?: jest.Mock }) => {
  await renderWithProviders(<NestedPrep name="Pine syrup" venueName={null} drinkName="Pine Old Fashioned" ingredients={[]} onDone={jest.fn()} onClose={jest.fn()} {...props} />);
  // iOS draws the screen after its first layout (the keyboard offset needs it).
  await fireEvent(screen.getByTestId('nested-prep'), 'layout', { persist: () => {}, nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } } });
};

// Android's back goes to the Modal, not the page's Back.
const androidBack = () => fireEvent(screen.getByTestId('nested-prep'), 'requestClose');

test('Android’s back keeps what’s done, as the page’s Back does', async () => {
  const onLater = jest.fn();
  const onClose = jest.fn();
  await open({ onLater, onClose });
  await androidBack();
  expect(onLater).toHaveBeenCalledTimes(1);
  expect(onLater.mock.calls[0][1]).toBe('Pine syrup');
  expect(onClose).not.toHaveBeenCalled();
});

test('with nothing to keep, Android’s back just closes', async () => {
  const onClose = jest.fn();
  await open({ onClose });
  await androidBack();
  expect(onClose).toHaveBeenCalledTimes(1);
});
