import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { renderWithProviders } from '@/jest.setup';
import { newLine } from '@/lib/drinkWizard';

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

test('a house-made still to write says New and offers to write it here', async () => {
  const write = jest.fn();
  await renderWithProviders(<DraftLine line={line('Pine syrup', '', { id: null, later: true })} row={<Text>editor</Text>} write={write} />);
  expect(screen.getByText('Pine syrup isn’t one of yours yet.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Write it now' }));
  expect(write).toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Later' }));
  expect(screen.queryByText('Pine syrup isn’t one of yours yet.')).toBeNull();
});
