import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { JobRequests, MyJobRequests } from './JobRequests';

const mockAnswer = jest.fn();
const jo = { id: 'jo', handle: 'jo', display_name: 'Jo Juniper', avatar_url: null };
const bar = (name: string) => ({ id: name, handle: name.toLowerCase(), display_name: name, avatar_url: null });
const request = (id: string, venue: string | null, name: string, title: string) => ({
  id, title, is_current: true, created_at: '', venue_id: venue, bar_profile_id: `b-${id}`, bar_name: `Bar ${id}`,
  person_profile_id: `p-${id}`, person_handle: id, person_name: name, person_avatar_url: null, person_is_public: true,
});

jest.mock('@/hooks/usePositionRequests', () => ({
  usePositionRequests: () => ({
    data: [request('1', 'venue', 'Sam Sour', 'Bartender'), request('2', null, 'Ana Amaro', 'Head bartender')],
  }),
  useAnswerPosition: () => ({ mutate: mockAnswer, isPending: false, error: null }),
}));
jest.mock('@/hooks/useProfiles', () => ({
  useProfilePositions: () => ({
    data: [
      { id: 'asked', title: 'Barback', is_current: true, is_shown: false, person_accepted: false, bar_accepted: true, person: jo, bar: bar('Dante') },
      { id: 'mine', title: 'Bartender', is_current: true, is_shown: false, person_accepted: true, bar_accepted: false, person: jo, bar: bar('Attaboy') },
      { id: 'done', title: 'Owner', is_current: true, is_shown: false, person_accepted: true, bar_accepted: true, person: jo, bar: bar('Lyaness') },
    ],
  }),
}));

beforeEach(() => mockAnswer.mockClear());

test("a venue's Admins see only their venue's requests, and accept or decline each", async () => {
  await renderWithTamagui(<JobRequests venueId="venue" title="Job requests" />);
  expect(screen.getByText('Sam Sour')).toBeTruthy();
  expect(screen.queryByText('Ana Amaro')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Accept'));
  expect(mockAnswer).toHaveBeenCalledWith({ id: '1', accept: true });
  await fireEvent.press(screen.getByLabelText('Decline'));
  expect(mockAnswer).toHaveBeenCalledWith({ id: '1', accept: false });
});

test('moderators see requests at bars with no venue, with the bar named', async () => {
  await renderWithTamagui(<JobRequests venueId={null} title="Jobs at bars not on Cocktail" />);
  expect(screen.getByText('Ana Amaro')).toBeTruthy();
  expect(screen.getByText('Head bartender at Bar 2')).toBeTruthy();
});

test('the person accepts a job a bar listed them in, and sees what waits on the bar', async () => {
  await renderWithTamagui(<MyJobRequests personId="jo" />);
  expect(screen.getByText('Barback, Dante')).toBeTruthy();
  expect(screen.getByText('Bartender, Attaboy')).toBeTruthy();
  expect(screen.getByText(/marked not confirmed, until the bar says yes/)).toBeTruthy();
  expect(screen.queryByText('Owner, Lyaness')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Accept'));
  expect(mockAnswer).toHaveBeenCalledWith({ id: 'asked', accept: true });
});
