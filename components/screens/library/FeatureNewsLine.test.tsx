import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import type { FeatureEvent } from '@/lib/featureNews';

import { FeatureNewsLine } from './FeatureNewsLine';

const mockMarkSeen = jest.fn();
let mockLine: FeatureEvent | null = null;
let mockFeatures = ['tonight'];
jest.mock('@/hooks/useFeatureNews', () => ({
  useFeatureNews: () => ({ line: mockLine, barId: 'rye', venueName: 'Little Rye', dots: [], markSeen: mockMarkSeen }),
}));
jest.mock('@/hooks/useBarDetail', () => ({ useBarMembers: () => ({ data: [{ user_id: 'sam', email: null, role_level: 40, display_name: 'Sam Rye' }] }) }));
jest.mock('@/hooks/useVenueFeatures', () => ({ useVenueFeatures: () => ({ ready: true, has: (k: string) => mockFeatures.includes(k) }) }));
jest.mock('@/hooks/useIsWideWeb', () => ({ useIsWideWeb: () => false }));
jest.mock('@/hooks/useServiceDay', () => ({ useServiceDay: () => 15 }));

const tonight: FeatureEvent = { id: 'e1', feature: 'tonight', enabled: true, by_user: 'sam', at: new Date().toISOString() };

afterEach(() => {
  mockLine = null;
  mockFeatures = ['tonight'];
  mockMarkSeen.mockClear();
});

test('nothing new: no line', async () => {
  await renderWithTamagui(<FeatureNewsLine />);
  expect(screen.queryByText(/New at/)).toBeNull();
});

test('the board’s line: what’s new, who turned it on and when, and where to look', async () => {
  mockLine = tonight;
  await renderWithTamagui(<FeatureNewsLine />);
  expect(screen.getByText('New at Little Rye: Tonight')).toBeTruthy();
  expect(screen.getByText('Sam turned it on today. Look for this tab.')).toBeTruthy();
  expect(screen.getByLabelText('New at Little Rye')).toBeTruthy();
});

test('a place, not a tab: no "Look for this tab"', async () => {
  mockLine = { ...tonight, feature: 'history' };
  mockFeatures = ['history'];
  await renderWithTamagui(<FeatureNewsLine />);
  expect(screen.getByText('New at Little Rye: History')).toBeTruthy();
  expect(screen.getByText('Sam turned it on today.')).toBeTruthy();
});

test('Dismiss hides it at once and saves it as seen', async () => {
  mockLine = tonight;
  await renderWithTamagui(<FeatureNewsLine />);
  await fireEvent.press(screen.getByRole('button', { name: 'Dismiss' }));
  expect(mockMarkSeen).toHaveBeenCalledWith(tonight, 'line');
  expect(screen.queryByText('New at Little Rye: Tonight')).toBeNull();
});
