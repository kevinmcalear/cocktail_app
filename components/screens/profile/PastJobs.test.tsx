import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { PastJobs } from './PastJobs';

const mockShow = jest.fn();
const jo = { id: 'jo', handle: 'jo', display_name: 'Jo Juniper', avatar_url: null };
const bar = (name: string) => ({ id: name, handle: name.toLowerCase(), display_name: name, avatar_url: null });

jest.mock('@/hooks/useProfiles', () => ({
  useProfilePositions: () => ({
    data: [
      { id: 'now', title: 'Head bartender', is_current: true, is_shown: false, is_hidden: false, start_year: 2023, end_year: null, person_accepted: true, bar_accepted: true, person: jo, bar: bar('Little Rye') },
      { id: 'pm', title: 'Bartender', is_current: false, is_shown: false, is_hidden: false, start_year: 2019, end_year: 2023, person_accepted: true, bar_accepted: true, person: jo, bar: bar('Pale Moth') },
      { id: 'new', title: 'Bar manager', is_current: true, is_shown: false, is_hidden: false, start_year: null, end_year: null, person_accepted: true, bar_accepted: false, person: jo, bar: bar('Attaboy') },
      { id: 'asked', title: 'Barback', is_current: true, is_shown: false, person_accepted: false, bar_accepted: true, person: jo, bar: bar('Dante') },
    ],
  }),
  useShowPosition: () => ({ mutate: mockShow, isPending: false, error: null }),
  useEditPosition: () => ({ mutate: jest.fn(), isPending: false, error: null }),
}));

test('one list, a Shown switch on every job, the current one too; a past job starts hidden', async () => {
  await renderWithTamagui(<PastJobs personId="jo" />);
  expect(screen.getByText('Little Rye · 2023 to now')).toBeTruthy();
  expect(screen.getByText('Confirmed by Little Rye')).toBeTruthy();
  expect(screen.getByText('Pale Moth · 2019 to 2023')).toBeTruthy();
  expect(screen.queryByText('Now')).toBeNull();

  const current = screen.getByLabelText('Show Head bartender at Little Rye on your profile');
  expect(current.props.value).toBe(true);
  await fireEvent(current, 'valueChange', false);
  expect(mockShow).toHaveBeenCalledWith({ id: 'now', shown: false });
  const past = screen.getByLabelText('Show Bartender at Pale Moth on your profile');
  expect(past.props.value).toBe(false);
  await fireEvent(past, 'valueChange', true);
  expect(mockShow).toHaveBeenCalledWith({ id: 'pm', shown: true });
});

test("a job the bar hasn't confirmed says so; one waiting on the person is left to the asking card", async () => {
  await renderWithTamagui(<PastJobs personId="jo" />);
  expect(screen.getByText('Bar manager')).toBeTruthy();
  expect(screen.getByText('Not confirmed by the bar yet')).toBeTruthy();
  expect(screen.queryByText('Barback')).toBeNull();
});
