import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { PastJobs } from './PastJobs';

const mockShow = jest.fn();
const jo = { id: 'jo', handle: 'jo', display_name: 'Jo Juniper', avatar_url: null };
const bar = (name: string) => ({ id: name, handle: name.toLowerCase(), display_name: name, avatar_url: null });

jest.mock('@/hooks/useProfiles', () => ({
  useProfilePositions: () => ({
    data: [
      { id: 'now', title: 'Head bartender', is_current: true, is_shown: false, person: jo, bar: bar('Little Rye') },
      { id: 'pm', title: 'Bartender', is_current: false, is_shown: false, person: jo, bar: bar('Pale Moth') },
    ],
  }),
  useShowPosition: () => ({ mutate: mockShow, isPending: false, error: null }),
}));

test('the current job always shows; each past job has its own switch, off to start', async () => {
  await renderWithTamagui(<PastJobs personId="jo" />);
  expect(screen.getByText('Head bartender, Little Rye')).toBeTruthy();
  expect(screen.getByText('Always shown')).toBeTruthy();
  expect(screen.getByText('Bartender, Pale Moth')).toBeTruthy();
  expect(screen.getByText(/keep your credit either way/)).toBeTruthy();

  const toggle = screen.getByLabelText('Show Pale Moth on my profile');
  expect(toggle.props.value).toBe(false);
  expect(screen.queryByLabelText('Show Little Rye on my profile')).toBeNull();
  await fireEvent(toggle, 'valueChange', true);
  expect(mockShow).toHaveBeenCalledWith({ id: 'pm', shown: true });
});
