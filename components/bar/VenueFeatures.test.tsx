import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { VenueFeatures } from './VenueFeatures';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
// The switches and their save come from hooks/useVenueFeatures.ts; here, a list and a spy.
const mockSet = jest.fn();
let mockOn: string[] = [];
jest.mock('@/hooks/useVenueFeatures', () => ({ useSetVenueFeature: () => ({ features: mockOn, set: mockSet, error: null }) }));
let mockWide = false;
jest.mock('@/hooks/useIsWideWeb', () => ({ useIsWideWeb: () => mockWide }));

beforeEach(() => {
  mockOn = [];
  mockWide = false;
  jest.clearAllMocks();
});

const tryButtons = () => screen.queryAllByRole('button').filter((b) => /^Try /.test(b.props.accessibilityLabel ?? ''));

test('what is always on, a switch per feature, and Try it only on Tonight and Back bar', async () => {
  await renderWithTamagui(<VenueFeatures barId="rye" venueName="Little Rye" />);
  expect(screen.getByText('Start small. Switch the rest on when your team is ready. Everyone at Little Rye sees what’s on.')).toBeTruthy();
  expect(screen.getByLabelText('Library, Menus and Discover: always on, for everyone here')).toBeTruthy();
  expect(screen.getAllByRole('switch').map((s) => s.props.accessibilityLabel)).toEqual(['Tonight', 'Back bar', 'Prep', 'Study', 'History', 'Flavor map', 'Techniques', 'More library filters', 'Advanced options']);
  expect(tryButtons().map((b) => b.props.accessibilityLabel)).toEqual(['Try Tonight, 1 min', 'Try Back bar, 2 min']);
  expect(screen.getByText(/^Always there: Batch on every drink page/)).toBeTruthy();
});

test('Try it on Back bar: tick the sample bottles, then Turn on flips the switch', async () => {
  await renderWithTamagui(<VenueFeatures barId="rye" venueName="Little Rye" />);
  await fireEvent.press(screen.getByRole('button', { name: 'Try Back bar, 2 min' }));
  expect(screen.getByText('Try it · sample bottles, nothing is saved')).toBeTruthy();
  expect(screen.getByText('Your Old Fashioned: everything in stock')).toBeTruthy();
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Angostura, Bitters' }));
  expect(screen.getByText('Your Old Fashioned: out of Angostura')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Turn on for Little Rye' }));
  expect(mockSet).toHaveBeenCalledWith('backBar', true);
  expect(screen.queryByText('Try it · sample bottles, nothing is saved')).toBeNull();
});

test('Not yet closes Try it without saving anything', async () => {
  await renderWithTamagui(<VenueFeatures barId="rye" venueName="Little Rye" />);
  await fireEvent.press(screen.getByRole('button', { name: 'Try Tonight, 1 min' }));
  expect(screen.getByText('Bolo Tie')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Not yet' }));
  expect(mockSet).not.toHaveBeenCalled();
  expect(screen.queryByText('Bolo Tie')).toBeNull();
});

test('flipping a switch saves it', async () => {
  await renderWithTamagui(<VenueFeatures barId="rye" venueName="Little Rye" />);
  await fireEvent(screen.getByRole('switch', { name: 'Prep' }), 'valueChange', true);
  expect(mockSet).toHaveBeenCalledWith('prep', true);
});

test('wide web: cards, the always-on line in the intro, Try it on the same two', async () => {
  mockWide = true;
  await renderWithTamagui(<VenueFeatures barId="rye" venueName="Little Rye" />);
  expect(screen.queryByLabelText('Library, Menus and Discover: always on, for everyone here')).toBeNull();
  expect(screen.getByText(/Library, Menus and Discover are always on\.$/)).toBeTruthy();
  expect(screen.getAllByRole('switch')).toHaveLength(9);
  expect(tryButtons()).toHaveLength(2);
});
