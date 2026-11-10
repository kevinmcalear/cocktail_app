import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { renderWithProviders } from '@/jest.setup';
import { newLine } from '@/lib/drinkWizard';
import { startPrep } from '@/lib/prepKinds';

import { DraftLine } from './DraftLine';

const line = (name: string, amount: string, more = {}) => ({ ...newLine({ id: 'x', name }, 'ml', amount), ...more });

test('a line reads as the board draws it, and a tap opens its editor', async () => {
  await renderWithProviders(<DraftLine line={line('Mezcal', '45')} row={<Text>editor</Text>} write={jest.fn()} />);
  expect(screen.getByRole('button', { name: '45 ml Mezcal. Edit' })).toBeTruthy();
  expect(screen.queryByText('editor')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '45 ml Mezcal. Edit' }));
  expect(screen.getByText('editor')).toBeTruthy();
});

test('no amount is an amber "?" with Add amount', async () => {
  await renderWithProviders(<DraftLine line={line('Aperol', '')} row={<Text>editor</Text>} write={jest.fn()} />);
  expect(screen.getByText('?')).toBeTruthy();
  expect(screen.getByText('Add amount')).toBeTruthy();
});

test('a house-made still to write says New and offers to make it here, with no Later (Kevin, 8 Nov)', async () => {
  const write = jest.fn();
  await renderWithProviders(<DraftLine line={line('Pine syrup', '20', { id: null, later: true })} row={<Text>editor</Text>} write={write} />);
  expect(screen.getByText('Pine syrup isn’t one of yours yet.')).toBeTruthy();
  expect(screen.getByText('New')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Later' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Make Pine syrup here' }));
  expect(write).toHaveBeenCalled();
});

test('one left part-way says Recipe to finish', async () => {
  await renderWithProviders(<DraftLine line={line('Pine syrup', '20', { id: null, prep: { ...startPrep('syrup', 'Pine syrup'), at: 'recipe' } })} row={<Text>editor</Text>} write={jest.fn()} />);
  expect(screen.getByText('Recipe to finish')).toBeTruthy();
});

test('closed, a held line shows its grip, its fold and what letting go does', async () => {
  await renderWithProviders(<DraftLine line={line('Mezcal', '45')} row={<Text>editor</Text>} write={jest.fn()} grip={(node) => node} lifted combineWith="Lime" />);
  expect(screen.getByText('Mezcal + Lime')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Reorder Mezcal' })).toBeTruthy();
});

test('closed, the line under a held one says let go to combine', async () => {
  await renderWithProviders(<DraftLine line={line('Lime', '30')} row={<Text>editor</Text>} write={jest.fn()} dropTarget="Mezcal" />);
  expect(screen.getByText('Let go to combine')).toBeTruthy();
});

test('a closed line keeps a venue’s cost and a new bottle’s card; the bottle’s hint waits for the open line', async () => {
  await renderWithProviders(<DraftLine line={line('Mezcal', '45')} row={<Text>editor</Text>} write={jest.fn()} detail={<Text>$1.28</Text>} below={<Text>bottle card</Text>} hint={<Text>the bottle hint</Text>} />);
  expect(screen.getByText('$1.28')).toBeTruthy();
  expect(screen.getByText('bottle card')).toBeTruthy();
  expect(screen.queryByText('the bottle hint')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '45 ml Mezcal. Edit' }));
  expect(screen.getByText('the bottle hint')).toBeTruthy();
});
