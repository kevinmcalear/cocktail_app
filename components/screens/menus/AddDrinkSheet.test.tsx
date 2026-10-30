import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import { blankSection } from '@/lib/menuLayout';
import type { MenuDrink } from '@/types/menus';

import { AddDrinkSheet } from './AddDrinkSheet';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/hooks/useActiveVenue', () => ({ useActiveVenue: () => ({ venues: [{ id: 'bar', name: 'Little Rye' }] }) }));

const drink = (name: string): MenuDrink => ({ id: name, name, kind: 'cocktail', line: '', price: null, imageUrl: null, isSketch: false, glass: null });
const section = { ...blankSection('Long & bright'), key: 'sec' };

test('a name that isn’t there is made from the same search, straight onto the section', async () => {
  const onClose = jest.fn();
  await renderWithTamagui(<AddDrinkSheet section={section} barId="bar" onClose={onClose} library={[drink('Dusk Spritz')]} canMake={[]} elsewhere={{}} onAdd={jest.fn()} />);
  await fireEvent.changeText(screen.getByLabelText('Search'), 'fig leaf spritz');
  expect(screen.getByText('Not at Little Rye yet.')).toBeTruthy();
  // Close names stay under it: Dusk Spritz shares "spritz".
  expect(screen.getByText('Dusk Spritz')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: /^Make “Fig Leaf Spritz”/ }));
  expect(onClose).toHaveBeenCalled();
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/add-cocktail', params: { menuSectionId: 'sec', barId: 'bar', name: 'Fig Leaf Spritz' } });
});

test('a drink that is there offers no Make', async () => {
  await renderWithTamagui(<AddDrinkSheet section={section} barId="bar" onClose={jest.fn()} library={[drink('Dusk Spritz')]} canMake={[]} elsewhere={{}} onAdd={jest.fn()} />);
  await fireEvent.changeText(screen.getByLabelText('Search'), 'dusk spritz');
  expect(screen.queryByText(/^Make/)).toBeNull();
});

test('Not on another menu shows only when another menu has drinks, and leaves those out', async () => {
  const library = [drink('Dusk Spritz'), drink('Bolo Tie')];
  const { unmount } = await renderWithTamagui(<AddDrinkSheet section={section} barId="bar" onClose={jest.fn()} library={library} canMake={[]} elsewhere={{}} onAdd={jest.fn()} />);
  expect(screen.queryByRole('radio', { name: 'Not on another menu' })).toBeNull();
  await unmount();
  await renderWithTamagui(<AddDrinkSheet section={section} barId="bar" onClose={jest.fn()} library={library} canMake={[]} elsewhere={{ 'Dusk Spritz': 'Summer' }} onAdd={jest.fn()} />);
  await fireEvent.press(screen.getByRole('radio', { name: 'Not on another menu' }));
  expect(screen.queryByText('Dusk Spritz')).toBeNull();
  expect(screen.getByText('Bolo Tie')).toBeTruthy();
});

test('before a search, the list is grouped: yours, what you can make, Popular, then A to Z', async () => {
  const library = [drink('Twelve Mile Limit'), drink('Negroni'), { ...drink('Bolo Tie'), mine: true }, drink('Abbey')];
  await renderWithTamagui(<AddDrinkSheet section={section} barId={null} onClose={jest.fn()} library={library} canMake={['Abbey']} elsewhere={{}} onAdd={jest.fn()} />);
  expect(screen.getAllByText(/^(FROM YOUR COLLECTION|YOU CAN MAKE THESE|POPULAR|A TO Z)$/).map((t) => t.props.children)).toEqual(['FROM YOUR COLLECTION', 'YOU CAN MAKE THESE', 'POPULAR', 'A TO Z']);
  await fireEvent.changeText(screen.getByLabelText('Search'), 'negroni');
  expect(screen.queryByText('POPULAR')).toBeNull();
  expect(screen.getByText('Negroni')).toBeTruthy();
});

test('says how many are picked, shows just those again, and closes with a tick', async () => {
  const picked = { ...section, drinks: [drink('Bolo Tie')] };
  await renderWithTamagui(<AddDrinkSheet section={picked} barId="bar" onClose={jest.fn()} library={[drink('Dusk Spritz'), drink('Bolo Tie')]} canMake={[]} elsewhere={{}} onAdd={jest.fn()} />);
  await fireEvent.press(screen.getByRole('radio', { name: 'In Long & bright · 1' }));
  expect(screen.queryByText('Dusk Spritz')).toBeNull();
  expect(screen.getByText('Bolo Tie')).toBeTruthy();
  expect(screen.getByLabelText('Done')).toBeTruthy();
});
