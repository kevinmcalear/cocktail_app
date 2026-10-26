import { fireEvent, screen } from '@testing-library/react-native';

import type { CollectedDrink } from '@/hooks/useCollection';
import { renderWithTamagui } from '@/jest.setup';

import { MemorySheet } from './MemorySheet';

const mockSave = jest.fn(async () => {});
jest.mock('@/hooks/useCollection', () => ({ useUpdateMemory: () => ({ mutateAsync: mockSave, isPending: false }) }));

const memory: CollectedDrink = {
  id: 'c1',
  itemId: 'i1',
  releaseId: null,
  collectedAt: '2026-10-01T00:00:00Z',
  name: 'Bolo Tie',
  barName: 'Little Rye',
  imageUrl: null,
  hadOn: null,
  note: null,
  liveMode: null,
  readable: true,
  specOpens: true,
  classic: false,
};

beforeEach(() => mockSave.mockClear());

test('starts on Don’t remember with no date field, and saves no date', async () => {
  const onClose = jest.fn();
  await renderWithTamagui(<MemorySheet memory={memory} onClose={onClose} />);
  expect(screen.getByRole('radio', { name: 'Don’t remember', checked: true })).toBeTruthy();
  expect(screen.queryByText('Day')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(mockSave).toHaveBeenCalledWith({ id: 'c1', hadOn: null, note: null });
  expect(onClose).toHaveBeenCalled();
});

test('the date field shows only after Pick a day, which needs a day to save', async () => {
  await renderWithTamagui(<MemorySheet memory={memory} onClose={jest.fn()} />);
  await fireEvent.press(screen.getByRole('radio', { name: 'Pick a day' }));
  expect(screen.getByText('Day')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(mockSave).not.toHaveBeenCalled();
  expect(screen.getByText('Pick a day.')).toBeTruthy();
});

test('a day already saved opens on Pick a day with it', async () => {
  await renderWithTamagui(<MemorySheet memory={{ ...memory, hadOn: '2026-09-12' }} onClose={jest.fn()} />);
  expect(screen.getByRole('radio', { name: 'Pick a day', checked: true })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(mockSave).toHaveBeenCalledWith({ id: 'c1', hadOn: '2026-09-12', note: null });
});
